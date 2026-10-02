// Logique pure du changement de classe en cours d'année. Aucune dépendance React/Supabase.
import { estModeAU } from './dispositifs.js';
import { dateFR } from './liens.js';

const JOURS_CHANGEMENT_RECENT = 30;

const modesDe = (modes, classeId) => modes.filter((m) => m.classe_id === classeId);
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Titres des dispositifs que la classe d'arrivée applique à toute la classe (AU) et dans lesquels
 * l'élève a des cases ou des aménagements libres : ils deviendraient invisibles. Même règle que
 * ar_conflits_dispositif côté SQL (le SQL fait foi, ceci sert à prévenir avant l'appel).
 */
export function dispositifsBloquants({ eleveId, classeCibleId, modes = [], chapitres = [], amenagements = [], selectionsAR = [], libres = [] }) {
  const modesCible = modesDe(modes, classeCibleId);
  const chapitreDe = new Map(amenagements.map((a) => [a.id, a.chapitre_id]));
  const touches = new Set([
    ...selectionsAR.filter((s) => s.eleve_id === eleveId).map((s) => chapitreDe.get(s.amenagement_id)),
    ...libres.filter((l) => l.eleve_id === eleveId).map((l) => l.chapitre_id),
  ]);
  return chapitres.filter((c) => c.est_dispositif && touches.has(c.id) && estModeAU(c.id, modesCible)).map((c) => c.titre);
}

/** Titres des dispositifs appliqués à toute la classe au départ mais pas à l'arrivée : l'élève perd cette couverture. */
export function dispositifsPerdus({ classeSourceId, classeCibleId, modes = [], chapitres = [] }) {
  const source = modesDe(modes, classeSourceId);
  const cible = modesDe(modes, classeCibleId);
  return chapitres.filter((c) => c.est_dispositif && estModeAU(c.id, source) && !estModeAU(c.id, cible)).map((c) => c.titre);
}

export function messageBlocageChangement(titres, prenom) {
  const pl = titres.length > 1;
  const liste = titres.map((t) => `« ${t} »`).join(', ');
  return `Impossible : dans la classe d'arrivée, ${pl ? 'les dispositifs' : 'le dispositif'} ${liste} ${pl ? "s'appliquent" : "s'applique"} à toute la classe, alors que ${prenom} a des aménagements cochés à titre individuel. Décochez-les d'abord dans la colonne de l'élève (et supprimez ses aménagements libres de ce chapitre), puis relancez le changement de classe.`;
}

export function messagePerte(titres) {
  const pl = titres.length > 1;
  const liste = titres.map((t) => `« ${t} »`).join(', ');
  return `Dans la classe de départ, ${pl ? 'les dispositifs' : 'le dispositif'} ${liste} ${pl ? "s'appliquaient" : "s'appliquait"} à toute la classe ; dans la classe d'arrivée, ${pl ? 'ils se cochent' : 'il se coche'} élève par élève. Après le changement, cochez-${pl ? 'les' : 'le'} pour cet élève si nécessaire.`;
}

/**
 * Lignes d'avertissement à afficher quand on édite un élève : changement de classe récent
 * et/ou aménagements « à confirmer » (repris d'une autre classe ou de l'année précédente).
 * @returns {string[]} vide s'il n'y a rien à signaler
 */
export function avertissementEleve({ eleve, nAConfirmer = 0, now = new Date() }) {
  const lignes = [];
  if (eleve?.classe_changee_le) {
    const jours = (now - new Date(eleve.classe_changee_le)) / 86400000;
    if (jours >= 0 && jours <= JOURS_CHANGEMENT_RECENT) {
      const depuis = eleve.classe_precedente_nom ? ` (depuis ${eleve.classe_precedente_nom})` : '';
      lignes.push(`Changement de classe le ${dateFR(eleve.classe_changee_le)}${depuis}.`);
    }
  }
  if (nAConfirmer > 0) {
    lignes.push(`${plur(nAConfirmer, 'aménagement')} « à confirmer » (repris d'une autre classe ou de l'année précédente) : relisez-${nAConfirmer > 1 ? 'les' : 'le'} avant d'envoyer un lien enseignant.`);
  }
  return lignes;
}

/** Avertissement affiché avant de générer un lien. `r` = résultat de aConfirmerParClasse. null s'il n'y a rien à confirmer. */
export function messageAvantEnvoi(r) {
  if (!r || r.total === 0) return null;
  const detail = [];
  if (r.parEleve.length) detail.push(plur(r.parEleve.length, 'élève'));
  if (r.nAU) detail.push(`${r.nAU} AU de classe`);
  return `${plur(r.total, 'aménagement')} « à confirmer » dans cette fiche (${detail.join(', ')}). Relisez-les dans la Saisie avant d'envoyer le lien : l'enseignant voit la fiche telle qu'elle est au moment où il l'ouvre.`;
}

/** Traduit l'erreur d'ar_changer_classe_eleve en message pour la personne qui saisit. */
export function messageErreurChangement(err) {
  const m = err?.message ?? '';
  if (m.startsWith('dispositif_incompatible')) {
    const titres = m.split(':').slice(1).join(':').trim();
    return `Impossible : l'élève a des aménagements individuels dans ${titres}, appliqué à toute la classe d'arrivée. Décochez-les d'abord, puis relancez.`;
  }
  if (err?.code === '42501' || m.includes('droit_insuffisant')) {
    return "Droit insuffisant : un changement vers une autre implantation est réservé à l'administrateur (ou à un référent rattaché aux deux implantations).";
  }
  if (m.includes('annee_differente')) return "La classe d'arrivée doit être de la même année scolaire. Pour passer à l'année suivante, utilisez « Reprise d'année ».";
  if (m.includes('classe_cible_introuvable')) return "Classe d'arrivée introuvable, ou non accessible avec vos droits.";
  if (m.includes('meme_classe')) return "L'élève est déjà dans cette classe.";
  return 'Changement de classe impossible, réessayez.';
}
