/**
 * État complet AU/AR d'une classe, sérialisable, comparable.
 * @param {{
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  auClasse: { amenagement_id: string }[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 * }} input
 * @returns {{ au: string[], parEleve: Record<string,string[]> }}
 */
export function buildSnapshot(input) {
  const { eleves, amenagements, auClasse, selectionsAR, libres } = input;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;
  const eleveById = new Map(eleves.map((e) => [e.id, nomEleve(e)]));

  const au = auClasse
    .map((x) => amgtById.get(x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .map((a) => a.libelle)
    .sort();

  /** @type {Record<string,string[]>} */
  const parEleve = {};
  for (const nom of eleveById.values()) parEleve[nom] = [];
  for (const s of selectionsAR) {
    const nom = eleveById.get(s.eleve_id);
    const a = amgtById.get(s.amenagement_id);
    if (!nom || !a || a.type !== 'AR') continue;
    parEleve[nom].push(a.libelle);
  }
  for (const l of libres) {
    const nom = eleveById.get(l.eleve_id);
    if (!nom) continue;
    parEleve[nom].push(l.texte);
  }
  for (const nom of Object.keys(parEleve)) parEleve[nom].sort();

  return { au, parEleve };
}

const EMPTY = { au: [], parEleve: {} };

/**
 * @param {{ au: string[], parEleve: Record<string,string[]> }|null} prev
 * @param {{ au: string[], parEleve: Record<string,string[]> }} next
 */
export function diffSnapshots(prev, next) {
  const p = prev ?? EMPTY;
  const setP = new Set(p.au);
  const setN = new Set(next.au);
  const auAjoutes = next.au.filter((x) => !setP.has(x));
  const auRetires = p.au.filter((x) => !setN.has(x));

  const eleves = new Set([...Object.keys(p.parEleve), ...Object.keys(next.parEleve)]);
  const arAjoutes = [];
  const arRetires = [];
  for (const eleve of eleves) {
    const av = new Set(p.parEleve[eleve] ?? []);
    const ap = new Set(next.parEleve[eleve] ?? []);
    for (const t of ap) if (!av.has(t)) arAjoutes.push({ eleve, texte: t });
    for (const t of av) if (!ap.has(t)) arRetires.push({ eleve, texte: t });
  }
  return { auAjoutes, auRetires, arAjoutes, arRetires };
}
