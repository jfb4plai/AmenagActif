import { normaliseLibelle, LIBELLE_RECTO_NORMALISE } from '../normalise.js';

const LIBELLE_MISE_EN_PAGE = normaliseLibelle('Mise en page');

/**
 * @param {{
 *  classe: import('../types.js').Classe,
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  auClasse: { amenagement_id: string, cree_le?: string }[],
 *  selectionsAR: (import('../types.js').SelectionAR & { cree_le?: string })[],
 *  libres: import('../types.js').AmenagementLibre[],
 *  referents: import('../types.js').ReferentEcole[],
 * }} input
 * @returns {import('../types.js').FicheClasseVM}
 */
export function computeFicheClasse(input) {
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres, referents } = input;

  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const chapOrdre = (amgt) => chapById.get(amgt?.chapitre_id)?.ordre ?? 999;
  const chapTitre = (amgt) => chapById.get(amgt?.chapitre_id)?.titre ?? '';

  const pourTous = auClasse
    .map((x) => amgtById.get(x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
    .map((a) => ({
      libelle: a.libelle,
      chapitreTitre: chapTitre(a),
      surligne: normaliseLibelle(a.libelle) === LIBELLE_MISE_EN_PAGE,
    }));

  const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;
  const commentaires = eleves
    .filter((e) => (e.commentaire ?? '').trim())
    .map((e) => ({ eleve: nomEleve(e), texte: e.commentaire.trim() }));
  const arParEleveId = new Map();
  for (const s of selectionsAR) {
    const a = amgtById.get(s.amenagement_id);
    if (!a || a.type !== 'AR') continue;
    if (normaliseLibelle(a.libelle) === LIBELLE_RECTO_NORMALISE) continue;
    if (!arParEleveId.has(s.eleve_id)) arParEleveId.set(s.eleve_id, []);
    arParEleveId.get(s.eleve_id).push(a);
  }
  const libresParEleveId = new Map();
  for (const l of libres) {
    if (!libresParEleveId.has(l.eleve_id)) libresParEleveId.set(l.eleve_id, []);
    libresParEleveId.get(l.eleve_id).push(l.texte);
  }

  const parEleve = eleves
    .map((e) => {
      const cat = (arParEleveId.get(e.id) ?? [])
        .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
        .map((a) => a.libelle);
      const amenagements = [...cat, ...(libresParEleveId.get(e.id) ?? [])];
      return { eleve: nomEleve(e), eleveId: e.id, amenagements };
    })
    .filter((x) => x.amenagements.length > 0);

  const parAmenagementMap = new Map();
  const ajouterEleveAAmenagement = (libelle, chapOrdreVal, ordreVal, nom) => {
    if (!parAmenagementMap.has(libelle)) parAmenagementMap.set(libelle, { chapOrdreVal, ordreVal, eleves: [] });
    parAmenagementMap.get(libelle).eleves.push(nom);
  };
  for (const [eleveId, amgts] of arParEleveId.entries()) {
    const e = eleves.find((x) => x.id === eleveId);
    if (!e) continue;
    // arParEleveId exclut déjà l'AR recto (filtré plus haut à sa construction).
    for (const a of amgts) ajouterEleveAAmenagement(a.libelle, chapOrdre(a), a.ordre, nomEleve(e));
  }
  // Les aménagements libres n'ont pas d'ordre de catalogue : ils se placent
  // après tous les AR, dans le même ordre que dans parEleve (Infinity trie en dernier).
  // Entre eux, l'ordre suit celui du tableau `libres` (insertion) : non garanti au-delà.
  for (const l of libres) {
    const e = eleves.find((x) => x.id === l.eleve_id);
    if (!e) continue;
    ajouterEleveAAmenagement(l.texte, Infinity, Infinity, nomEleve(e));
  }
  const parAmenagement = [...parAmenagementMap.entries()]
    .sort(([, a], [, b]) => a.chapOrdreVal - b.chapOrdreVal || a.ordreVal - b.ordreVal)
    .map(([libelle, { eleves: es }]) => ({ libelle, eleves: es }));

  const eleveIds = new Set(eleves.map((e) => e.id));
  const nbRecto = new Set(
    selectionsAR
      .filter((s) => {
        const a = amgtById.get(s.amenagement_id);
        return a && eleveIds.has(s.eleve_id) && normaliseLibelle(a.libelle) === LIBELLE_RECTO_NORMALISE;
      })
      .map((s) => s.eleve_id)
  ).size;

  // PIA = référent(s) PLAI de la classe (texte libre, un ou plusieurs noms séparés par une
  // virgule, saisi une fois pour la classe — pas dérivé des élèves individuels).
  const pia = (input.classe?.referent_plai_nom ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  // referents : comptes direction rattachés à l'implantation (PAR de la fiche).
  const niveauClasse = input.classe?.niveau ?? null;
  const par = referents
    .filter((r) => r.fonction === 'direction')
    .filter((r) => !r.niveaux || r.niveaux.length === 0 || (niveauClasse && r.niveaux.includes(niveauClasse)))
    .map((r) => r.nom)
    .filter(Boolean);

  // Date de mise à jour : dernier changement d'aménagement ; à défaut, la
  // création de la classe / des élèves (= « première mise à jour »).
  const dates = [
    ...selectionsAR.map((s) => s.cree_le),
    ...auClasse.map((x) => x.cree_le),
    ...libres.map((l) => l.cree_le),
    input.classe?.created_at,
    ...eleves.map((e) => e.created_at),
  ].filter(Boolean).sort();
  const dateMaj = dates.length ? dates[dates.length - 1] : null;

  return {
    classeNom: contexte.classeNom,
    ecoleNom: contexte.ecoleNom,
    anneeLibelle: contexte.anneeLibelle,
    dateMaj,
    tableauReferents: { pia, par },
    pourTous,
    parEleve,
    parAmenagement,
    commentaires,
    nbRecto,
  };
}
