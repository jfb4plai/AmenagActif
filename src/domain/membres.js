const norme = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filtrerMembres(membres, { texte = '', role = '' } = {}) {
  const t = norme(texte.trim());
  return membres.filter((m) => {
    if (role && m.role !== role) return false;
    if (!t) return true;
    return norme(`${m.email ?? ''} ${m.nom ?? ''}`).includes(t);
  });
}

// Reprend la logique de SectionMembres : un admin rattaché apparaît aussi dans son école
// (identification seulement) ; un admin sans école n'est pas signalé dans sansEcole.
export function grouperMembres(membres, ecoles) {
  const dansEcole = (m, ecoleId) => m.ecoleId === ecoleId || (m.ecoleIds ?? []).includes(ecoleId);
  return {
    admins: membres.filter((m) => m.role === 'admin'),
    parEcole: ecoles.map((ecole) => ({ ecole, membres: membres.filter((m) => dansEcole(m, ecole.id)) })),
    sansEcole: membres.filter((m) => m.role !== 'admin' && !m.ecoleId && (m.ecoleIds ?? []).length === 0),
  };
}

export function compteurMembres(affiches, total) {
  return affiches === 1
    ? `1 compte affiché sur ${total}`
    : affiches === 0
      ? `0 compte affiché sur ${total}`
      : `${affiches} comptes affichés sur ${total}`;
}
