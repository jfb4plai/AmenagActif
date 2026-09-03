/**
 * Profil AU/AR d'une classe, format d'échange pour DiffActif.
 * @param {{
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  auClasse: { amenagement_id: string }[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 * }} input
 */
export function computeProfilDiffActif(input) {
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = input;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const chapTitre = (id) => chapById.get(id)?.titre ?? '';
  const chapOrdre = (a) => chapById.get(a?.chapitre_id)?.ordre ?? 999;

  const auCommuns = auClasse
    .map((x) => amgtById.get(x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
    .map((a) => ({ id: a.id, libelle: a.libelle, chapitre: chapTitre(a.chapitre_id) }));

  const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;
  const arByEleve = new Map();
  for (const s of selectionsAR) {
    const a = amgtById.get(s.amenagement_id);
    if (!a || a.type !== 'AR') continue;
    if (!arByEleve.has(s.eleve_id)) arByEleve.set(s.eleve_id, []);
    arByEleve.get(s.eleve_id).push(a);
  }
  const libresByEleve = new Map();
  for (const l of libres) {
    if (!libresByEleve.has(l.eleve_id)) libresByEleve.set(l.eleve_id, []);
    libresByEleve.get(l.eleve_id).push(l.texte);
  }

  const arParEleve = eleves
    .map((e) => {
      const cat = (arByEleve.get(e.id) ?? [])
        .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
        .map((a) => a.libelle);
      return { eleve: nomEleve(e), amenagements: [...cat, ...(libresByEleve.get(e.id) ?? [])] };
    })
    .filter((x) => x.amenagements.length > 0);

  return {
    app: 'amenagactif',
    version: 1,
    annee: contexte.anneeLibelle,
    ecole: contexte.ecoleNom,
    classe: contexte.classeNom,
    auCommuns,
    arParEleve,
  };
}
