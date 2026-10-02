/**
 * Dispositifs : chapitres marqués `est_dispositif`. Leurs items sont stockés en type 'AR' ;
 * pour une classe donnée, une ligne `ar_classe_dispositifs` avec pour_toute_la_classe = true
 * les fait lire comme des AU (cochés une fois pour la classe, table ar_amenagements_classe).
 * Sans ligne : mode AR (cochés par élève, table ar_selections).
 * Source de vérité UNIQUE du mode : toutes les projections passent par ici.
 *
 * @typedef {{ chapitre_id: string, pour_toute_la_classe: boolean }} ModeDispositif
 */

/** @param {string} chapitreId @param {ModeDispositif[]} [modes] */
export function estModeAU(chapitreId, modes = []) {
  return modes.some((m) => m.chapitre_id === chapitreId && m.pour_toute_la_classe === true);
}

/** Vrai si le chapitre est un dispositif ET passé en « pour toute la classe ». Une ligne de mode sur un chapitre ordinaire est ignorée. */
export function chapitreEnModeAU(chapitre, modes = []) {
  return chapitre?.est_dispositif === true && estModeAU(chapitre.id, modes);
}

export function typeEffectif(amenagement, chapitres, modes = []) {
  const ch = chapitres.find((c) => c.id === amenagement?.chapitre_id);
  return chapitreEnModeAU(ch, modes) ? 'AU' : amenagement?.type;
}

/**
 * Pour les consommateurs qui raisonnent en AU/AR (snapshot, profils DiffActif) : réécrit le type
 * des items de dispositif passés en AU. Ne mute pas l'entrée ; sans mode, renvoie l'entrée telle quelle.
 * @template {{ amenagements: any[], chapitres?: any[], modesDispositifs?: ModeDispositif[] }} T
 * @param {T} input
 * @returns {T}
 */
export function appliquerTypesEffectifs(input) {
  const modes = input.modesDispositifs ?? [];
  if (modes.length === 0) return input;
  const chapById = new Map((input.chapitres ?? []).map((c) => [c.id, c]));
  return {
    ...input,
    amenagements: input.amenagements.map((a) => (chapitreEnModeAU(chapById.get(a.chapitre_id), modes) ? { ...a, type: 'AU' } : a)),
  };
}

/** Écarte les sélections par élève restées sur un dispositif désormais en mode AU (état qui ne devrait pas exister). */
export function selectionsActives(selectionsAR, amenagements, chapitres, modes = []) {
  if (modes.length === 0) return selectionsAR;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  return selectionsAR.filter((s) => !chapitreEnModeAU(chapById.get(amgtById.get(s.amenagement_id)?.chapitre_id), modes));
}

/**
 * Blocs « dispositif pour toute la classe » de la fiche : un bloc par dispositif en mode AU
 * ayant au moins un item coché. Titre exact du chapitre ; items triés par ordre de catalogue.
 * @returns {{ titre: string, items: string[] }[]}
 */
export function dispositifsAU({ amenagements, chapitres, auClasse, modes = [] }) {
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const parChap = new Map();
  for (const x of auClasse) {
    const a = amgtById.get(x.amenagement_id);
    const ch = a && chapById.get(a.chapitre_id);
    if (!ch || a.type !== 'AR' || !chapitreEnModeAU(ch, modes)) continue; // seuls les items stockés AR sont des items de dispositif
    if (!parChap.has(ch.id)) parChap.set(ch.id, { titre: ch.titre, ordre: ch.ordre, items: [] });
    parChap.get(ch.id).items.push({ ordre: a.ordre, libelle: a.libelle });
  }
  return [...parChap.values()]
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ titre, items }) => ({ titre, items: items.sort((a, b) => a.ordre - b.ordre).map((i) => i.libelle) }));
}

/**
 * Règle de blocage de la bascule : jamais de conversion automatique.
 * @param {{ vers: 'AU'|'AR', chapitreId: string, amenagements: any[], eleveIds: Set<string>,
 *           selectionsAR: any[], auClasse: any[], libres?: any[] }} p  (auClasse : lignes de LA classe ; libres : aménagements libres, toute l'école)
 * @returns {string|null} message d'erreur à afficher, ou null si la bascule est permise
 */
export function bloqueBasculeDispositif({ vers, chapitreId, amenagements, eleveIds, selectionsAR, auClasse, libres = [] }) {
  const ids = new Set(amenagements.filter((a) => a.chapitre_id === chapitreId).map((a) => a.id));
  if (vers === 'AU') {
    const eleves = new Set(selectionsAR.filter((s) => ids.has(s.amenagement_id) && eleveIds.has(s.eleve_id)).map((s) => s.eleve_id));
    const n = eleves.size;
    const nl = libres.filter((l) => l.chapitre_id === chapitreId && eleveIds.has(l.eleve_id)).length;
    const pl = nl > 1;
    const msgLibres = `${nl} aménagement${pl ? 's' : ''} libre${pl ? 's' : ''} ajouté${pl ? 's' : ''} pour des élèves de ce dispositif`;
    if (n > 0 && nl === 0) {
      return `Impossible : ${n} élève${n > 1 ? 's ont' : ' a'} déjà des aménagements de ce dispositif cochés individuellement. Décochez-les d'abord dans la colonne de chaque élève, puis passez le dispositif à toute la classe.`;
    }
    if (n > 0) {
      return `Impossible : ${n} élève${n > 1 ? 's ont' : ' a'} déjà des aménagements de ce dispositif cochés individuellement, et ${msgLibres}. Décochez-les d'abord dans la colonne de chaque élève et supprimez les aménagements libres, puis passez le dispositif à toute la classe.`;
    }
    if (nl > 0) {
      return `Impossible : ${msgLibres}. Supprimez-${pl ? 'les' : 'le'} d'abord (lien « retirer » sous le chapitre), puis passez le dispositif à toute la classe.`;
    }
  } else {
    const n = auClasse.filter((x) => ids.has(x.amenagement_id)).length;
    if (n > 0) {
      return `Impossible : ${n} aménagement${n > 1 ? 's' : ''} de ce dispositif ${n > 1 ? 'sont cochés' : 'est coché'} pour toute la classe. Décochez-${n > 1 ? 'les' : 'le'} d'abord, puis repassez le dispositif en mode élève par élève.`;
    }
  }
  return null;
}

/**
 * Vrai si déplacer un item du chapitre source vers le chapitre cible entre ou sort d'un dispositif
 * (ses cochages existants changeraient de sens ou deviendraient invisibles).
 */
export function traverseDispositif(source, cible) {
  return (source?.est_dispositif === true || cible?.est_dispositif === true) && source?.id !== cible?.id;
}

/** Texte de la confirmation avant de décocher un AU de classe (ordinaire ou dispositif). */
export function messageConfirmationRetraitAU(libelle) {
  return `Décocher « ${libelle} » pour toute la classe ?\n\n- il disparaît de la fiche de la classe pour tous les enseignants qui la consultent ;\n- il ne figurera plus dans le profil transmis aux autres apps (DiffActif).\n\nÀ confirmer seulement si l'aménagement ne s'applique réellement plus.`;
}
