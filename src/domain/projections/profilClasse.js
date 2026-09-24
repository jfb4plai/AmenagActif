/**
 * Projection `plai.profil-classe` v1 : profil d'aménagements d'une classe, minimisé
 * pour être transmis à un autre outil PLAI (passerelle). Fonction pure, déterministe.
 *
 * Principe : on ne transmet QUE des codes de catalogue et des tranches d'effectif.
 * Jamais de nom, prénom, initiale, commentaire, texte d'AR libre, nom de référent PLAI,
 * statut IPT/PAR, ni identifiant interne. N'utilise PAS computeProfilDiffActif (qui
 * contient des noms) et ne l'appelle pas.
 */

/** Ordres de chapitres dont les AR peuvent être détaillés (chapitres 1, 5, 7, 9). Configurable. */
export const CHAPITRES_PERIMETRE = [1, 5, 7, 9];

/**
 * Seuil de suppression k : un AR porté par moins de k élèves n'est pas détaillé
 * (il est absorbé par `ar_hors_perimetre_present = true`), pour éviter de désigner
 * indirectement un élève dans une petite classe.
 *
 * HYPOTHÈSE À VALIDER PAR L'ENSEIGNANT-CONCEPTEUR : k = 3 est une valeur par défaut
 * de travail, la décision n'est pas encore prise.
 */
export const K_SEUIL_DEFAUT = 3;

/** Durée de validité par défaut du profil émis (jours). À valider (même durée que les liens de fiche). */
export const DUREE_JOURS_DEFAUT = 120;

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
 *  amenagements: { id: string, chapitre_id: string, ordre: number, libelle: string, type: 'AU'|'AR', code?: string|null }[],
 *  chapitres: { id: string, ordre: number, titre: string, code?: string|null }[],
 *  auClasse: { amenagement_id: string, cree_le?: string }[],
 *  selectionsAR: { eleve_id: string, amenagement_id: string, cree_le?: string }[],
 *  libres: { eleve_id: string, cree_le?: string }[],
 * }} input
 * @param {{ now?: Date, dureeJours?: number, k?: number, chapitresPerimetre?: number[], regles?: string[][] }} [options]
 */
export function computeProfilClasse(input, options = {}) {
  const {
    now = new Date(),
    dureeJours = DUREE_JOURS_DEFAUT,
    k = K_SEUIL_DEFAUT,
    chapitresPerimetre = CHAPITRES_PERIMETRE,
    regles = REGLES_CONFLIT,
  } = options;
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = input;

  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const chapOrdre = (a) => chapById.get(a?.chapitre_id)?.ordre ?? 999;
  // Libellé stable du chapitre : son code si présent, sinon son titre de catalogue.
  const chapLabel = (a) => {
    const c = chapById.get(a?.chapitre_id);
    return c ? (c.code || c.titre) : '';
  };
  const tri = (x, y) => x._o - y._o || x._a - y._a || (x.code ?? x.libelle).localeCompare(y.code ?? y.libelle);
  const nu = (r) => { const { _o, _a, ...reste } = r; return reste; };

  // ---- AU (classe entière : pas de donnée d'élève) ----
  const au = [];
  const nonCodes = [];
  for (const x of auClasse) {
    const a = amgtById.get(x.amenagement_id);
    if (!a || a.type !== 'AU') continue;
    const base = { chapitre: chapLabel(a), libelle: a.libelle, _o: chapOrdre(a), _a: a.ordre };
    if (a.code) au.push({ code: a.code, ...base });
    else nonCodes.push(base);
  }

  // ---- AR : effectif par aménagement (élèves distincts de la classe) ----
  const eleveIds = new Set(eleves.map((e) => e.id));
  const parAmgt = new Map(); // amenagement_id -> Set(eleve_id)
  let horsPerimetre = false;
  for (const s of selectionsAR) {
    if (!eleveIds.has(s.eleve_id)) continue;
    const a = amgtById.get(s.amenagement_id);
    if (!a || a.type !== 'AR') { horsPerimetre = true; continue; } // inclassable : jamais omis, réduit au booléen
    if (!parAmgt.has(a.id)) parAmgt.set(a.id, new Set());
    parAmgt.get(a.id).add(s.eleve_id);
  }

  const arMecanisables = [];
  for (const [id, set] of parAmgt) {
    const a = amgtById.get(id);
    const n = set.size;
    const dansPerimetre = chapitresPerimetre.includes(chapOrdre(a));
    if (!dansPerimetre || n < k) { horsPerimetre = true; continue; }
    const base = { chapitre: chapLabel(a), libelle: a.libelle, _o: chapOrdre(a), _a: a.ordre };
    if (a.code) arMecanisables.push({ code: a.code, ...base, effectif: trancheEffectif(n) });
    else nonCodes.push(base);
  }

  const libresPresent = libres.some((l) => eleveIds.has(l.eleve_id));

  au.sort(tri);
  arMecanisables.sort(tri);
  nonCodes.sort(tri);

  // ---- Conflits, calculés sur les seuls codes publiés ----
  const publies = new Set([...au, ...arMecanisables].map((x) => x.code));
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
  const expire = new Date(now.getTime() + dureeJours * 86400000);

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
    au: au.map(nu),
    ar_mecanisables: arMecanisables.map(nu),
    non_codes: nonCodes.map(nu),
    ar_hors_perimetre_present: horsPerimetre,
    libres_present: libresPresent,
    conflits,
  };
}
