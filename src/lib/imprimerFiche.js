/**
 * Ouvre la boîte d'impression du navigateur. L'utilisateur choisit
 * « Enregistrer au format PDF » ou une imprimante. Le CSS @media print
 * (plai-style.css) masque nav / pied de page / boutons et met la fiche en A4.
 */
export function imprimerFiche() {
  window.print();
}
