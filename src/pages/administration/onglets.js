// Onglets de l'administration : un chemin relatif à /administration, un libellé, les rôles qui le voient.
export const ONGLETS_ADMIN = [
  { chemin: 'membres', libelle: 'Membres & accès', roles: ['admin'] },
  { chemin: 'droits', libelle: 'Droits', roles: ['admin'] },
  { chemin: 'ecoles', libelle: 'Écoles', roles: ['admin'] },
  { chemin: 'annees', libelle: 'Années', roles: ['admin'] },
  { chemin: 'catalogue', libelle: 'Catalogue', roles: ['admin'] },
  { chemin: 'transmission', libelle: 'Transmission', roles: ['admin'] },
  { chemin: 'messages', libelle: 'Messages', roles: ['admin'] },
];
