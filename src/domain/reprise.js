// Logique pure de la reprise d'année. Aucune dépendance React/Supabase.

const cmp = (a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true });

/** Regroupe les élèves de l'année source par classe (classes et élèves triés). */
export function groupesSource(classes, eleves) {
  return [...classes].sort((a, b) => cmp(a.nom, b.nom)).map((classe) => ({
    classe,
    eleves: eleves.filter((e) => e.classe_id === classe.id).sort((a, b) => cmp(a.prenom, b.prenom)),
  }));
}

/** Valeur d'un <select> → choix. Valeurs : 'none' | 'transfert' | 'termine' | 'classe:<id>'. */
export function versChoix(valeur) {
  if (valeur === 'transfert' || valeur === 'termine') return { type: valeur };
  if (typeof valeur === 'string' && valeur.startsWith('classe:')) return { type: 'classe', classeId: valeur.slice(7) };
  return { type: 'none' };
}

export function versValeur(choix) {
  return choix.type === 'classe' ? `classe:${choix.classeId}` : choix.type;
}

/** Choix par défaut d'un élève : devenir déjà enregistré, sinon classe principale de son groupe, sinon non traité. */
export function choixDeBase(eleve, mapping) {
  if (eleve.devenir) return { type: eleve.devenir };
  const cible = mapping[eleve.classe_id];
  return cible ? { type: 'classe', classeId: cible } : { type: 'none' };
}

const memeChoix = (a, b) => a.type === b.type && (a.classeId ?? null) === (b.classeId ?? null);

/** Choix effectif de chaque élève pas encore repris : exception > base. */
export function choixEffectifs({ eleves, mapping, exceptions, dejaRepris }) {
  const deja = new Set(dejaRepris);
  const out = {};
  for (const e of eleves) {
    if (deja.has(e.id)) continue;
    out[e.id] = exceptions[e.id] ?? choixDeBase(e, mapping);
  }
  return out;
}

/** Nouvel objet d'exceptions ; l'exception disparaît si le choix redevient celui de la base. */
export function poserException(exceptions, eleve, choix, mapping) {
  const suivant = { ...exceptions };
  if (memeChoix(choix, choixDeBase(eleve, mapping))) delete suivant[eleve.id];
  else suivant[eleve.id] = choix;
  return suivant;
}

export function synthese(choix, dejaRepris = []) {
  const s = { classe: 0, transfert: 0, termine: 0, none: 0, dejaRepris: dejaRepris.length };
  for (const c of Object.values(choix)) s[c.type] += 1;
  return s;
}

/** Reprises à exécuter (une RPC par élève). */
export function operations(choix) {
  return Object.entries(choix)
    .filter(([, c]) => c.type === 'classe')
    .map(([sourceId, c]) => ({ sourceId, classeId: c.classeId }));
}

/** Écritures de `devenir` nécessaires (uniquement ce qui diffère de la base de données). */
export function marquages(choix, eleves) {
  const out = [];
  for (const e of eleves) {
    const c = choix[e.id];
    if (!c || c.type === 'classe') continue;
    const voulu = c.type === 'transfert' || c.type === 'termine' ? c.type : null;
    if ((e.devenir ?? null) !== voulu) out.push({ id: e.id, devenir: voulu });
  }
  return out;
}

/** Ce qui reste à confirmer dans une classe (AR, aménagements libres, AU). */
export function aConfirmerParClasse({ eleves, selectionsAR, libres, auClasse }) {
  const ids = new Set(eleves.map((e) => e.id));
  const compte = new Map();
  for (const ligne of [...selectionsAR, ...libres]) {
    if (ligne.a_confirmer && ids.has(ligne.eleve_id)) compte.set(ligne.eleve_id, (compte.get(ligne.eleve_id) ?? 0) + 1);
  }
  const parEleve = eleves.filter((e) => compte.has(e.id)).map((e) => ({ eleve: e, n: compte.get(e.id) }));
  const nAU = auClasse.filter((x) => x.a_confirmer).length;
  return { parEleve, nAU, total: parEleve.reduce((t, x) => t + x.n, 0) + nAU };
}

/** Année juste avant la cible (libellés '2026-2027' comparés lexicographiquement). */
export function anneeSourceParDefaut(annees, cibleId) {
  const cible = annees.find((a) => a.id === cibleId);
  if (!cible) return null;
  return annees
    .filter((a) => a.libelle < cible.libelle)
    .sort((a, b) => b.libelle.localeCompare(a.libelle))[0] ?? null;
}
