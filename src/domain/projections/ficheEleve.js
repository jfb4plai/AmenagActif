import { dispositifsAU, selectionsActives } from '../dispositifs.js';
import { normaliseLibelle } from '../normalise.js';

const LIBELLE_MISE_EN_PAGE = normaliseLibelle('Mise en page');

/**
 * @param {{
 *  eleve: import('../types.js').Eleve,
 *  classeNom: string,
 *  ecoleNom: string,
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 *  auClasse?: { amenagement_id: string }[],
 *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],
 * }} input
 * @returns {import('../types.js').FicheEleveVM}
 */
export function computeFicheEleve(input) {
  const { eleve, classeNom, ecoleNom, amenagements, chapitres, libres } = input;
  const modes = input.modesDispositifs ?? [];
  const selectionsAR = selectionsActives(input.selectionsAR, amenagements, chapitres, modes);
  // Dispositifs passés en AU pour la classe : valent pour chaque élève de la classe.
  const dispositifsClasse = dispositifsAU({ amenagements, chapitres, auClasse: input.auClasse ?? [], modes })
    .map(({ titre, items }) => ({ titre, items }));
  // AU ordinaires de la classe (même règle que la fiche classe : type AU stocké, triés par chapitre puis ordre).
  // Les items de dispositif ont un type de base AR : ils n'entrent jamais ici (voir dispositifsClasse).
  const chapOrdre = (a) => chapitres.find((c) => c.id === a.chapitre_id)?.ordre ?? 999;
  const pourTous = (input.auClasse ?? [])
    .map((x) => amenagements.find((a) => a.id === x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
    .map((a) => ({
      libelle: a.libelle,
      chapitreTitre: chapitres.find((c) => c.id === a.chapitre_id)?.titre ?? '',
      surligne: normaliseLibelle(a.libelle) === LIBELLE_MISE_EN_PAGE,
    }));
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

  return { eleve: nomEleve, classeNom, ecoleNom, statut: eleve.statut, parChapitre, pourTous, dispositifsClasse, commentaire: (eleve.commentaire ?? '').trim() };
}
