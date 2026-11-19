// Onglets de l'administration : un chemin relatif à /administration, un libellé, les rôles qui le voient.
// Le tableau reçoit `droits` à la tâche 6.
export const ONGLETS_ADMIN = [
  { chemin: 'membres', libelle: 'Membres', roles: ['admin'] },
  { chemin: 'ecoles', libelle: 'Écoles', roles: ['admin'] },
  { chemin: 'annees', libelle: 'Années scolaires', roles: ['admin'] },
  { chemin: 'catalogue', libelle: 'Catalogue', roles: ['admin'] },
  { chemin: 'transmission', libelle: 'Transmission', roles: ['admin'] },
];
