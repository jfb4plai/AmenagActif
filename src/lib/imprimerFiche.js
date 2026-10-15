/**
 * Ouvre la boîte d'impression du navigateur. L'utilisateur choisit
 * « Enregistrer au format PDF » ou une imprimante. Le CSS @media print
 * (plai-style.css) masque nav / pied de page / boutons et met la fiche en A4.
 *
 * pied (optionnel) : { gauche, dateEdition } — injecte un @page temporaire qui remplace
 * le pied par défaut (« Page n / N » centré) : gauche = implantation + classe(s),
 * droite = date d'édition + « Page n / N ». Le CSS statique ne peut pas lire ces textes,
 * d'où l'injection au moment d'imprimer (retirée à la fin).
 */
export function imprimerFiche(pied) {
  // appelé aussi comme onClick={imprimerFiche} : l'argument est alors un événement, pas un pied
  if (!pied || typeof pied.gauche !== 'string') {
    window.print();
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-pied-fiche', '');
  const base = 'font-family: Arial, sans-serif; font-size: 9pt; color: #555;';
  style.textContent = `@page {
    @bottom-left { content: ${chaineCss(pied.gauche)}; ${base} text-align: left; }
    @bottom-center { content: ""; }
    @bottom-right { content: ${chaineCss(`Édité le ${pied.dateEdition ?? dateEdition()} · Page `)} counter(page) " / " counter(pages); ${base} text-align: right; }
  }`;
  document.head.appendChild(style);
  const retirer = () => {
    style.remove();
    window.removeEventListener('afterprint', retirer);
  };
  window.addEventListener('afterprint', retirer);
  window.print();
}

/** Date du jour au format jj/mm/aaaa. */
export function dateEdition() {
  return new Date().toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Pied d'une fiche classe ou groupée : implantation · classe(s). */
export function piedFicheClasse(vm) {
  const classes = vm.classesSources?.length ? vm.classesSources.join(', ') : vm.classeNom;
  return { gauche: [vm.ecoleNom, classes].filter(Boolean).join(' · '), dateEdition: dateEdition() };
}

/** Littéral de chaîne CSS sûr (guillemets, antislash, retours ligne). */
function chaineCss(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
}
