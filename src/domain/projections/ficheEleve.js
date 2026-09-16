/**
 * @param {{
 *  eleve: import('../types.js').Eleve,
 *  classeNom: string,
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 * }} input
 * @returns {import('../types.js').FicheEleveVM}
 */
export function computeFicheEleve(input) {
  const { eleve, classeNom, amenagements, chapitres, selectionsAR, libres } = input;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));

  const nomEleve = `${eleve.prenom}${eleve.initiale_nom ? ' ' + eleve.initiale_nom + '.' : ''}`;

  const parChapId = new Map();
  const push = (chapId, ordre, libelle) => {
    if (!parChapId.has(chapId)) parChapId.set(chapId, []);
    parChapId.get(chapId).push({ ordre, libelle });
  };

  for (const s of selectionsAR) {
    if (s.eleve_id !== eleve.id) continue;
    const a = amgtById.get(s.amenagement_id);
    if (!a) continue;
    push(a.chapitre_id, a.ordre, a.libelle);
  }
  for (const l of libres) {
    if (l.eleve_id !== eleve.id) continue;
    push(l.chapitre_id ?? '__sans__', 9999, l.texte);
  }

  const parChapitre = [...parChapId.entries()]
    .map(([chapId, items]) => ({
      ordre: chapById.get(chapId)?.ordre ?? 9999,
      chapitreTitre: chapById.get(chapId)?.titre ?? 'Aménagements complémentaires',
      amenagements: items.sort((a, b) => a.ordre - b.ordre).map((i) => i.libelle),
    }))
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ chapitreTitre, amenagements }) => ({ chapitreTitre, amenagements }));

  return { eleve: nomEleve, classeNom, parChapitre, commentaire: (eleve.commentaire ?? '').trim() };
}
