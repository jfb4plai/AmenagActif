/**
 * Où un aménagement (ou tous ceux d'un chapitre) est-il utilisé ? Regroupe des lignes plates
 * (une par case cochée) par implantation puis par classe, pour que l'admin sache qui prévenir
 * avant de décocher, désactiver ou supprimer. Fonction pure : le chargement est dans useAdmin.js.
 *
 * @typedef {{ ecoleId: string, ecole: string, annee: string, classe: string }} Lieu
 * @param {{
 *   ar: (Lieu & { eleve: string, libelle: string })[],
 *   au: (Lieu & { libelle: string })[],
 *   libres: (Lieu & { eleve: string, texte: string })[],
 *   referents?: Record<string, string[]>,
 * }} entree
 */
export function regrouperUsage({ ar = [], au = [], libres = [], referents = {} }) {
  const ecoles = new Map();
  const classeDe = (l) => {
    if (!ecoles.has(l.ecoleId)) ecoles.set(l.ecoleId, { ecoleId: l.ecoleId, ecole: l.ecole, referents: referents[l.ecoleId] ?? [], classes: new Map() });
    const e = ecoles.get(l.ecoleId);
    const cle = `${l.annee}|${l.classe}`;
    if (!e.classes.has(cle)) e.classes.set(cle, { annee: l.annee, classe: l.classe, eleves: new Map(), au: new Set() });
    return e.classes.get(cle);
  };
  const eleveDe = (c, nom) => {
    if (!c.eleves.has(nom)) c.eleves.set(nom, new Set());
    return c.eleves.get(nom);
  };
  for (const r of ar) eleveDe(classeDe(r), r.eleve).add(r.libelle);
  for (const r of libres) eleveDe(classeDe(r), r.eleve).add(`${r.texte} (libre)`);
  for (const r of au) classeDe(r).au.add(r.libelle);

  const parNom = (a, b) => a.localeCompare(b, 'fr');
  const resultat = [...ecoles.values()]
    .map((e) => ({
      ecoleId: e.ecoleId,
      ecole: e.ecole,
      referents: e.referents,
      classes: [...e.classes.values()]
        .map((c) => ({
          annee: c.annee,
          classe: c.classe,
          eleves: [...c.eleves.entries()].map(([nom, libs]) => ({ nom, libelles: [...libs].sort(parNom) })).sort((a, b) => parNom(a.nom, b.nom)),
          au: [...c.au].sort(parNom),
        }))
        .sort((a, b) => parNom(b.annee, a.annee) || parNom(a.classe, b.classe)),
    }))
    .sort((a, b) => parNom(a.ecole, b.ecole));

  const nbEleves = resultat.reduce((n, e) => n + e.classes.reduce((m, c) => m + c.eleves.length, 0), 0);
  const nbClassesAU = resultat.reduce((n, e) => n + e.classes.filter((c) => c.au.length > 0).length, 0);
  return { ecoles: resultat, nbEleves, nbClassesAU, nbEcoles: resultat.length, vide: resultat.length === 0 };
}
