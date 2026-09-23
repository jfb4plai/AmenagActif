/**
 * Fusionne les données brutes de plusieurs classes (même école) en un seul
 * jeu d'entrée pour computeFicheClasse — regroupement ad hoc "cours pratique"
 * (ex. atelier réunissant des élèves de plusieurs classes), sans nouvelle
 * entité stockée : purement au moment de la génération du lien.
 *
 * Un élève n'appartient qu'à une seule classe (pas de doublon possible côté
 * élèves). Le seul doublon réel à éviter : un même AU coché dans plusieurs
 * classes sources, qui apparaîtrait sinon plusieurs fois dans "Pour tous".
 *
 * @param {Array<{
 *  classe: { referent_plai_nom?: string, niveau?: string|null, created_at?: string },
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  auClasse: { amenagement_id: string, cree_le?: string }[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 *  referents: import('../types.js').ReferentEcole[],
 * }>} parties
 * @param {string} [nomGroupe]
 */
export function fusionnerDonneesClasses(parties, nomGroupe) {
  if (!parties || parties.length === 0) throw new Error('Aucune classe à fusionner.');

  const classesSources = parties.map((p) => p.contexte.classeNom);
  const premiere = parties[0];

  const eleves = parties.flatMap((p) => p.eleves);
  const auClasse = [...new Map(parties.flatMap((p) => p.auClasse).map((x) => [x.amenagement_id, x])).values()];
  const selectionsAR = parties.flatMap((p) => p.selectionsAR);
  const libres = parties.flatMap((p) => p.libres);

  const referentPlaiNom = [...new Set(
    parties
      .map((p) => p.classe?.referent_plai_nom ?? '')
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter(Boolean)
  )].join(', ');

  const niveaux = [...new Set(parties.map((p) => p.classe?.niveau).filter(Boolean))];
  // Simplification volontaire (v1) : si le groupe mélange plusieurs niveaux,
  // le filtre "Direction restreinte à un niveau" ne peut pas s'appliquer
  // proprement à un seul niveau — on omet ces directions plutôt que de
  // risquer d'afficher le mauvais nom (sous-inclusion sûre).
  const niveau = niveaux.length === 1 ? niveaux[0] : null;

  const datesCreation = parties.map((p) => p.classe?.created_at).filter(Boolean).sort();

  return {
    classe: { referent_plai_nom: referentPlaiNom, niveau, created_at: datesCreation[0] ?? null },
    contexte: {
      classeNom: nomGroupe?.trim() || classesSources.join(' + '),
      ecoleNom: premiere.contexte.ecoleNom,
      anneeLibelle: premiere.contexte.anneeLibelle,
    },
    eleves,
    amenagements: premiere.amenagements,
    chapitres: premiere.chapitres,
    auClasse,
    selectionsAR,
    libres,
    referents: premiere.referents,
    classesSources,
  };
}
