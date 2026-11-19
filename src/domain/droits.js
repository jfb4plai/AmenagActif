// Source unique des droits par rôle (lecture seule) : tableaux de rôles utilisés par l'interface
// et matrice affichée par l'onglet Droits. Module pur, sans import.
// Chaque cellule de CAPACITES a été relevée dans le code et le SQL (état de main au 2026-11-19) ;
// ce module décrit les droits, il ne les applique pas : la base (RLS) et api/* restent l'autorité.

export const ROLES = ['admin', 'referent_plai', 'direction', 'agent_plai'];

export const LIBELLE_ROLE = {
  admin: 'Administrateur',
  referent_plai: 'Référent PLAI',
  direction: 'Direction',
  agent_plai: 'Agent accompagnant',
};

// roles : true = oui, false = non, null = à confirmer (le code ne tranche pas).
const r = (admin, referent_plai, direction, agent_plai) => ({ admin, referent_plai, direction, agent_plai });

export const CAPACITES = [
  { id: 'consulter_fiches', libelle: 'Consulter les fiches de ses écoles',
    effet: "Ouvre les fiches d'élève, de classe et d'école ; l'administrateur voit toutes les écoles.",
    roles: r(true, true, true, true) },
  { id: 'saisir', libelle: 'Saisir élèves et AR',
    effet: 'Crée, modifie et supprime les élèves, leurs AR et leurs aménagements libres.',
    roles: r(true, true, true, true) },
  { id: 'ajouter_au', libelle: 'Ajouter un AU à une classe',
    effet: 'Coche un aménagement universel non encore actif dans la classe.',
    roles: r(true, true, true, true) },
  { id: 'retirer_au', libelle: 'Retirer un AU déjà coché',
    effet: 'Décoche un aménagement universel déjà actif dans la classe.',
    roles: r(true, true, true, false) },
  { id: 'creer_classe', libelle: 'Créer une classe',
    effet: "Ajoute une classe à l'année active d'une de ses écoles.",
    roles: r(true, true, true, true) },
  { id: 'supprimer_renommer_classe', libelle: 'Supprimer ou renommer une classe',
    effet: 'Supprime une classe avec ses élèves, ou change son nom.',
    roles: r(true, true, true, false) },
  { id: 'changer_classe', libelle: "Changer un élève de classe",
    effet: "Déplace un élève dans une autre classe de la même année ; ses AR sont marqués à confirmer.",
    roles: r(true, true, true, false) },
  { id: 'reprise', libelle: "Reprise d'année",
    effet: "Ouvre la page de reprise : copie les classes et les élèves vers l'année suivante.",
    roles: r(true, true, true, false) },
  { id: 'creer_liens', libelle: 'Créer des liens enseignants',
    effet: 'Crée un lien de fiche, de fiche groupée ou de sommaire pour des classes de ses écoles.',
    roles: r(true, true, true, true) },
  { id: 'gerer_tous_liens', libelle: 'Révoquer ou modifier les liens créés par d’autres',
    effet: "L'agent accompagnant ne révoque ni ne modifie que ses propres liens.",
    roles: r(true, true, true, false) },
  { id: 'mon_ecole', libelle: 'Voir « Mon école »',
    effet: "Affiche l'équipe de son école ; l'administrateur a la page Administration à la place.",
    roles: r(false, true, true, true) },
  { id: 'administration', libelle: 'Administration',
    effet: 'Gère les membres, les écoles, les années, le catalogue et la transmission.',
    roles: r(true, false, false, false) },
  { id: 'archives', libelle: 'Archives et restauration',
    effet: "Aucun rôle n'y accède dans l'application : les suppressions archivées ne se restaurent que depuis la base.",
    roles: r(false, false, false, false) },
];

/** Rôles à `true` pour une capacité, dans l'ordre de ROLES ; [] si la capacité est inconnue. */
export function rolesAvec(id) {
  const c = CAPACITES.find((x) => x.id === id);
  return c ? ROLES.filter((role) => c.roles[role] === true) : [];
}

export const EDITEURS = rolesAvec('saisir'); // accès à la saisie
export const GESTIONNAIRES_LIENS = rolesAvec('reprise'); // nom conservé (constante d'App.jsx) : ne sert plus qu'à la reprise d'année
export const LIENS_ENSEIGNANTS = rolesAvec('creer_liens');
export const LECTEURS = EDITEURS; // fiches accessibles aux mêmes rôles
