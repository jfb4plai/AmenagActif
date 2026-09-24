// Logique pure de l'écran « Liens enseignants » (filtres, regroupement, libellés). Sans React ni réseau.

export const LIBELLE_STATUT = { actif: 'Actif', expire: 'Expiré', revoque: 'Révoqué' };
export const JOURS_INACTIF_DEFAUT = 60;

const JOUR_MS = 86400000;

/** Dernière activité d'un lien : dernière ouverture, à défaut la création. */
export function derniereActivite(lien) {
  return lien.derniere_ouverture ?? lien.cree_le;
}

/**
 * @param {Array} liens
 * @param {{ statut?: 'tous'|'actif'|'expire'|'revoque', inactifJours?: number|null, now?: Date }} opts
 * inactifJours : si nombre, ne garde que les liens dont la dernière activité remonte à plus de N jours.
 */
export function filtrerLiens(liens, { statut = 'tous', inactifJours = null, now = new Date() } = {}) {
  return liens.filter((l) => {
    if (statut !== 'tous' && l.statut !== statut) return false;
    if (inactifJours !== null && inactifJours !== undefined) {
      const t = Date.parse(derniereActivite(l));
      if (!Number.isFinite(t) || now.getTime() - t <= inactifJours * JOUR_MS) return false;
    }
    return true;
  });
}

/** Regroupe par implantation, dans l'ordre de `ecoles`. Les écoles sans lien gardent une section vide. */
export function grouperParEcole(liens, ecoles) {
  return ecoles.map((e) => ({ ecole: e, liens: liens.filter((l) => l.ecole_id === e.id) }));
}

export function titreEcole(e) {
  const base = e.implantation_nom || e.nom;
  return e.implantation ? `${base} (FASE ${e.implantation})` : base;
}

/** Date lisible fr-BE ; '' si absente. */
export function dateFR(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}
