// Jeu minimal : 1 école, 1 année, 2 classes (5LA, 3TP), 3 élèves, catalogue réduit.
export const chapitres = [
  { id: 'c1', ordre: 1, titre: '1. SUPPORTS ET DOCUMENTS ÉCRITS, MISE EN PAGE & CONSIGNES' },
  { id: 'c5', ordre: 5, titre: '5. LECTURE' },
];

export const amenagements = [
  { id: 'a-au1', chapitre_id: 'c1', ordre: 1, libelle: 'Mise en page', type: 'AU' },
  { id: 'a-ar1', chapitre_id: 'c1', ordre: 2, libelle: 'Doubler les espaces de réponse', type: 'AR' },
  { id: 'a-recto', chapitre_id: 'c1', ordre: 19, libelle: 'Cours uniquement en recto', type: 'AR' },
  { id: 'a-ar5', chapitre_id: 'c5', ordre: 1, libelle: 'Utiliser les livres audio pour la lecture', type: 'AR' },
];

export const classe5LA = { id: 'cl-5la', nom: '5LA', ecole_id: 'ec1', annee_id: 'an1', created_at: '2026-08-20T08:00:00Z' };

export const eleves = [
  { id: 'e1', classe_id: 'cl-5la', prenom: 'Emilie', initiale_nom: 'D', referent_plai_nom: 'Mona', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e2', classe_id: 'cl-5la', prenom: 'Karim', initiale_nom: 'B', referent_plai_nom: 'Mona', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e3', classe_id: 'cl-5la', prenom: 'Lea', initiale_nom: 'M', referent_plai_nom: 'Carole', created_at: '2026-08-21T08:00:00Z' },
];

export const auClasse = [{ classe_id: 'cl-5la', amenagement_id: 'a-au1', cree_le: '2026-09-01T08:00:00Z' }];

export const selectionsAR = [
  { eleve_id: 'e1', amenagement_id: 'a-ar1', cree_le: '2026-09-02T08:00:00Z' },
  { eleve_id: 'e1', amenagement_id: 'a-recto', cree_le: '2026-09-02T08:00:00Z' },
  { eleve_id: 'e3', amenagement_id: 'a-ar5', cree_le: '2026-09-03T08:00:00Z' },
  { eleve_id: 'e3', amenagement_id: 'a-recto', cree_le: '2026-09-03T08:00:00Z' },
];

export const libres = [
  { id: 'l1', eleve_id: 'e1', chapitre_id: 'c1', texte: 'Vérifier oralement la consigne avant de commencer' },
];

export const referents = [
  { nom: 'Julien', fonction: 'direction' },
  { nom: 'Mona', fonction: 'referent_plai' },
];

export const contexte = { classeNom: '5LA', ecoleNom: 'Athénée X', anneeLibelle: '2025-2026' };
