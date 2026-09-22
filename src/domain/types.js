/**
 * @typedef {Object} Chapitre
 * @property {string} id
 * @property {number} ordre
 * @property {string} titre
 *
 * @typedef {Object} Amenagement
 * @property {string} id
 * @property {string} chapitre_id
 * @property {number} ordre
 * @property {string} libelle
 * @property {'AU'|'AR'} type
 *
 * @typedef {Object} Eleve
 * @property {string} id
 * @property {string} classe_id
 * @property {string} prenom
 * @property {string} initiale_nom
 * @property {string} [commentaire]
 * @property {'IPT'|'PAR'} statut
 *
 * @typedef {Object} Classe
 * @property {string} id
 * @property {string} nom
 * @property {string} ecole_id
 * @property {string} annee_id
 * @property {string} [niveau]
 * @property {string} [referent_plai_nom]
 *
 * @typedef {Object} SelectionAR
 * @property {string} eleve_id
 * @property {string} amenagement_id
 *
 * @typedef {Object} AmenagementLibre
 * @property {string} id
 * @property {string} eleve_id
 * @property {string|null} chapitre_id
 * @property {string} texte
 *
 * @typedef {Object} ReferentEcole   // compte rattaché à l'implantation
 * @property {string} nom
 * @property {'direction'|'referent_plai'} fonction
 * @property {string[]|null} [niveaux]
 *
 * @typedef {Object} FicheClasseVM
 * @property {string} classeNom
 * @property {string} ecoleNom
 * @property {string} anneeLibelle
 * @property {string|null} dateMaj
 * @property {{ pia: string[], par: string[] }} tableauReferents
 * @property {{ libelle: string, chapitreTitre: string, surligne: boolean }[]} pourTous
 * @property {{ eleve: string, eleveId: string, amenagements: string[] }[]} parEleve
 * @property {{ libelle: string, eleves: { nom: string, eleveId: string, statut: string }[] }[]} parAmenagement
 * @property {{ eleve: string, statut: string, texte: string }[]} commentaires
 * @property {number} nbRecto
 *
 * @typedef {Object} FicheEleveVM
 * @property {string} eleve
 * @property {string} classeNom
 * @property {string} ecoleNom
 * @property {string} ecoleFase
 * @property {string} statut
 * @property {{ chapitreTitre: string, amenagements: string[] }[]} parChapitre
 * @property {string} commentaire
 */
export {};
