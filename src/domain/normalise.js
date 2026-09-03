/**
 * Forme canonique d'un libellé d'aménagement pour comparaison / matching d'import.
 * @param {string} s
 * @returns {string}
 */
export function normaliseLibelle(s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^au\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Libellé de l'AR compté pour « nombre de cours à imprimer en recto ». */
export const LIBELLE_RECTO_NORMALISE = normaliseLibelle('Cours uniquement en recto');
