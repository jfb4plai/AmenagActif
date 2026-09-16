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

  const eleveIds = new Set(eleves.map((e) => e.id));
  const nbRecto = new Set(
    selectionsAR
      .filter((s) => {
        const a = amgtById.get(s.amenagement_id);
        return a && eleveIds.has(s.eleve_id) && normaliseLibelle(a.libelle) === LIBELLE_RECTO_NORMALISE;
      })
      .map((s) => s.eleve_id)
  ).size;

  // referents : comptes rattachés à l'implantation, fonction ∈ 'direction' | 'referent_plai'.
  // PIA = accompagnateur saisi par élève ; à défaut, le référent PLAI de l'implantation.
  const piaEleves = [...new Set(eleves.map((e) => e.referent_plai_nom).filter(Boolean))];
  const piaEcole = referents.filter((r) => r.fonction === 'referent_plai').map((r) => r.nom).filter(Boolean);
  const pia = piaEleves.length ? piaEleves : piaEcole;
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
    commentaires,
    nbRecto,
  };
}
