// Source unique des droits par rôle : tableaux de rôles APPLIQUÉS par App.jsx (routes) et Nav.jsx (menu),
// et matrice affichée par l'onglet Droits. Module pur, sans import.
// EDITEURS, GESTIONNAIRES_LIENS, LIENS_ENSEIGNANTS et LECTEURS sont dérivés de la matrice : modifier une cellule
// change le routage et le menu réels ; tests/domain/droits.test.js épingle ces tableaux et les cellules à risque.
// GESTIONNAIRES_LIENS est aujourd'hui la liste de la reprise d'année (nom conservé : c'est la constante d'App.jsx).
// La base (RLS) et api/* restent l'autorité : chaque capacité cite sa preuve (fichier:ligne, état de main au 2026-11-19).
// Absent volontairement : « archives et restauration » (ar_archive_* : droit d'exécution service_role seul,
// aucun appelant dans src/ ni api/) : ce n'est pas un droit de l'application.

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
    roles: r(true, true, true, true),
    preuve: 'App.jsx:54, 58-61 (LECTEURS) ; 20260924b_amenagactif_revocation_acces.sql:35 (ar_can_read_ecole : admin ou école rattachée)' },
  { id: 'saisir', libelle: 'Saisir élèves et AR',
    effet: 'Crée, modifie et supprime les élèves, leurs AR et leurs aménagements libres.',
    roles: r(true, true, true, true),
    preuve: 'App.jsx:53 (EDITEURS) ; 20260924_amenagactif_agent_plai_editeur.sql:15-25 (ar_can_edit_ecole : admin, référent, direction, agent)' },
  { id: 'ajouter_au', libelle: 'Ajouter un AU à une classe',
    effet: 'Coche un aménagement universel non encore actif dans la classe.',
    roles: r(true, true, true, true),
    preuve: '20260924_amenagactif_agent_plai_editeur.sql:56-57 (insert via ar_can_edit_ecole : les quatre rôles)' },
  { id: 'retirer_au', libelle: 'Retirer un AU déjà coché',
    effet: 'Décoche un aménagement universel déjà actif dans la classe.',
    roles: r(true, true, true, false),
    preuve: '20260924_amenagactif_agent_plai_editeur.sql:58-59 (delete via ar_can_editer_structure_ecole, sans agent) ; SaisieEcole.jsx:27' },
  { id: 'creer_classe', libelle: 'Créer une classe',
    effet: "Ajoute une classe à l'année active d'une de ses écoles.",
    roles: r(true, true, true, true),
    preuve: '20261119b_amenagactif_agent_cree_classe.sql:12-14 (insert via ar_can_edit_ecole : les quatre rôles) ; SaisieEcole.jsx:120' },
  { id: 'supprimer_renommer_classe', libelle: 'Supprimer ou renommer une classe',
    effet: 'Supprime une classe avec ses élèves, ou change son nom.',
    roles: r(true, true, true, false),
    preuve: '20260924_amenagactif_agent_plai_editeur.sql:49-50 (delete, sans agent) ; 20261015_amenagactif_renommer_classe.sql:16 (renommage, sans agent)' },
  { id: 'changer_classe', libelle: 'Changer un élève de classe',
    effet: 'Déplace un élève dans une autre classe de la même année ; ses AR sont marqués à confirmer.',
    roles: r(true, true, true, false),
    preuve: '20261003b_amenagactif_changement_classe.sql:65 (ar_can_editer_structure_ecole sur classe source et cible : sans agent)' },
  { id: 'reprise', libelle: "Reprise d'année",
    effet: "Ouvre la page de reprise : copie les classes et les élèves vers l'année suivante.",
    roles: r(true, true, true, false),
    preuve: 'App.jsx:57 (route GESTIONNAIRES_LIENS) ; Nav.jsx:26 (menu : pas agent_plai)' },
  { id: 'creer_liens', libelle: 'Créer des liens enseignants',
    effet: 'Crée un lien de fiche, de fiche groupée ou de sommaire pour des classes de ses écoles.',
    roles: r(true, true, true, true),
    preuve: 'api/_lib/ficheData.js:29-30 (admin, référent, direction, agent) ; api/_lib/liens.js:8 (ROLES_GESTION_LIENS)' },
  { id: 'gerer_tous_liens', libelle: 'Révoquer ou modifier les liens créés par d’autres',
    effet: "L'agent accompagnant ne révoque ni ne modifie que ses propres liens.",
    roles: r(true, true, true, false),
    preuve: "api/_lib/liens.js:54-57 (peutAgirSurLien : l'agent seulement ses propres liens ; les trois autres rôles tous)" },
  { id: 'mon_ecole', libelle: 'Voir « Mon école »',
    effet: "Affiche l'équipe de son école. Le lien du menu est masqué pour l'administrateur, mais la page reste accessible par son adresse.",
    roles: r(false, true, true, true),
    preuve: "Nav.jsx:30 (lien masqué pour l'administrateur) ; App.jsx:54 (route ouverte à LECTEURS, admin compris)" },
  { id: 'administration', libelle: 'Administration',
    effet: "Gère les membres, les écoles, les années, le catalogue, la transmission aux autres apps et l'envoi de messages aux utilisateurs.",
    roles: r(true, false, false, false),
    preuve: 'App.jsx:56 (RequireRole admin) ; api/membres.js:22 (refus si le rôle n\'est pas admin)' },
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
