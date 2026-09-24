/**
 * Projection `plai.profil-classe` v1 : profil d'aménagements d'une classe, minimisé
 * pour être transmis à un autre outil PLAI (passerelle). Fonction pure, déterministe.
 * Contrat complet : docs/contrat-profil-classe.md.
 *
 * Principe : on ne transmet QUE des codes de catalogue et des tranches d'effectif.
 * Jamais de nom, prénom, initiale, commentaire, texte d'AR libre, nom de référent PLAI,
 * statut IPT/PAR, ni identifiant interne. N'utilise PAS computeProfilDiffActif (qui
 * contient des noms) et ne l'appelle pas.
 *
 * Périmètre : un aménagement (AU ou AR) est publié si et seulement si son drapeau
 * `partage_profil` est vrai. Aucune dépendance au numéro d'ordre des chapitres : renuméroter,
 * déplacer ou insérer un chapitre ne change pas le profil. Le champ `chapitre` du contrat est
 * le CODE du chapitre.
 *
 * Changements de vocabulaire (contrat toujours en version 1, aucune app cible ne le consomme
 * encore) : `ar_mecanisables` devient `ar` (savoir si un AR est « mécanisable » relève de l'app
 * cible, pas de ce contrat) ; `ar_hors_perimetre_present` devient `elements_non_transmis_present`.
 */

/**
 * Seuil de suppression k : un AR porté par moins de k élèves n'est pas détaillé
 * (il est absorbé par `elements_non_transmis_present = true`), pour éviter de désigner
 * indirectement un élève dans une petite classe.
 *
 * DÉCISION (Jean-François, 2026-09-24) : k = 1, donc aucune suppression par défaut.
 * Motif : un AR masqué n'est pas appliqué par l'app cible, et l'élève concerné recevrait
 * un support non adapté. Risque accepté : en petite classe, un AR porté par un seul élève
 * peut désigner indirectement cet élève pour quelqu'un qui connaît la classe.
 * Le mécanisme reste actif et configurable (option `k`) si la décision est révisée.
 */
export const K_SEUIL_DEFAUT = 1;

/** Durée de validité par défaut du profil émis (jours). DÉCISION 2026-09-24 : 30 jours, sans révocation ; renouvellement en repartant de la fiche. */
export const DUREE_JOURS_DEFAUT = 30;

/**
 * Règles de conflit : paires de codes qui ne peuvent pas être satisfaites ensemble
 * dans une même classe. Exprimées en codes. HYPOTHÈSE À VALIDER : liste à confirmer.
 * Une paire n'est signalée que si les DEUX codes sont publiés dans le profil
 * (un AR supprimé par le seuil k ne peut donc jamais être deviné via un conflit).
 */
export const REGLES_CONFLIT = [
  ['ar_supports_carte_mentale_oui', 'ar_supports_carte_mentale_non'],
  ['ar_lecture_lire_voix_haute', 'ar_lecture_voix_haute_jamais'],
  ['ar_lecture_fluo_oui', 'ar_lecture_fluo_non'],
];

export const SCHEMA = 'plai.profil-classe';
export const VERSION = 1;

/** Tranche d'effectif (jamais le nombre exact). */
export function trancheEffectif(n) {
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  return '6+';
}

const jour = (d) => d.toISOString().slice(0, 10);

/**
 * @param {{
 *  classe?: { niveau?: string|null, created_at?: string },
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: { id: string }[],
 *  amenagements: { id: string, chapitre_id: string, ordre?: number, libelle: string, type: 'AU'|'AR', code?: string|null, partage_profil: boolean }[],
 *  chapitres: { id: string, titre?: string, code?: string|null }[],
 *  auClasse: { amenagement_id: string, cree_le?: string }[],
 *  selectionsAR: { eleve_id: string, amenagement_id: string, cree_le?: string }[],
 *  libres: { eleve_id: string, cree_le?: string }[],
 * }} input
 * @param {{ now?: Date, dureeJours?: number, expireAt?: Date, k?: number, regles?: string[][] }} [options]
 */
export function computeProfilClasse(input, options = {}) {
  const {
    now = new Date(),
    dureeJours = DUREE_JOURS_DEFAUT,
    expireAt = null, // si fourni (ex. exp du jeton), prime sur dureeJours
    k = K_SEUIL_DEFAUT,
    regles = REGLES_CONFLIT,
  } = options;
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = input;

  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  // Code du chapitre (jamais son numéro d'ordre ni son titre numéroté).
  const chapCode = (a) => chapById.get(a?.chapitre_id)?.code ?? null;
  // Publié seulement si le drapeau est explicitement vrai (échec fermé : colonne absente = non publié).
  const transmis = (a) => a?.partage_profil === true;
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const tri = (x, y) => cmp(x.chapitre ?? '', y.chapitre ?? '') || cmp(x.code ?? x.libelle, y.code ?? y.libelle) || cmp(x.libelle, y.libelle);

  // Vrai dès qu'un élément coché n'est pas transmis (drapeau faux, inclassable, ou sous le seuil k).
  let elementsNonTransmis = false;

  // ---- AU (classe entière : pas de donnée d'élève) ----
  const au = [];
  const nonCodes = [];
  for (const x of auClasse) {
    const a = amgtById.get(x.amenagement_id);
    if (!a || a.type !== 'AU') continue;
    if (!transmis(a)) { elementsNonTransmis = true; continue; }
    const base = { chapitre: chapCode(a), libelle: a.libelle };
    if (a.code) au.push({ code: a.code, ...base });
    else nonCodes.push(base);
  }

  // ---- AR : effectif par aménagement (élèves distincts de la classe) ----
  const eleveIds = new Set(eleves.map((e) => e.id));
  const parAmgt = new Map(); // amenagement_id -> Set(eleve_id)
  for (const s of selectionsAR) {
    if (!eleveIds.has(s.eleve_id)) continue;
    const a = amgtById.get(s.amenagement_id);
    if (!a || a.type !== 'AR') { elementsNonTransmis = true; continue; } // inclassable : jamais omis, réduit au booléen
    if (!parAmgt.has(a.id)) parAmgt.set(a.id, new Set());
    parAmgt.get(a.id).add(s.eleve_id);
  }

  const ar = [];
  for (const [id, set] of parAmgt) {
    const a = amgtById.get(id);
    const n = set.size;
    if (!transmis(a) || n < k) { elementsNonTransmis = true; continue; }
    const base = { chapitre: chapCode(a), libelle: a.libelle };
    if (a.code) ar.push({ code: a.code, ...base, effectif: trancheEffectif(n) });
    else nonCodes.push(base);
  }

  const libresPresent = libres.some((l) => eleveIds.has(l.eleve_id));

  au.sort(tri);
  ar.sort(tri);
  nonCodes.sort(tri);

  // ---- Conflits, calculés sur les seuls codes publiés ----
  const publies = new Set([...au, ...ar].map((x) => x.code));
  const conflits = regles
    .filter(([a, b]) => publies.has(a) && publies.has(b))
    .map(([a, b]) => [a, b]);

  // ---- Dates ----
  const dates = [
    ...selectionsAR.map((s) => s.cree_le),
    ...auClasse.map((x) => x.cree_le),
    ...libres.map((l) => l.cree_le),
  ].filter(Boolean).sort();
  const ficheDu = dates.length ? String(dates[dates.length - 1]).slice(0, 10) : (input.classe?.created_at ? String(input.classe.created_at).slice(0, 10) : jour(now));
  const expire = expireAt ?? new Date(now.getTime() + dureeJours * 86400000);

  return {
    schema: SCHEMA,
    version: VERSION,
    emis_le: now.toISOString(),
    fiche_du: ficheDu,
    expire_le: jour(expire),
    contexte: {
      classe_libelle: contexte.classeNom,
      niveau: input.classe?.niveau ?? null,
      annee: contexte.anneeLibelle,
      ecole: contexte.ecoleNom,
    },
    au,
    ar,
    non_codes: nonCodes,
    elements_non_transmis_present: elementsNonTransmis,
    libres_present: libresPresent,
    conflits,
  };
}
