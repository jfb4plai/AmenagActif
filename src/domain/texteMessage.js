// Texte simple des messages aux utilisateurs : conversion en HTML (même code côté serveur et pour l'aperçu)
// et aides de mise en forme des boutons. Sans React ni réseau.

const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mise en forme d'une ligne déjà échappée : **gras** et adresses https://… cliquables. */
function ligneVersHtml(ligneEchappee) {
  return ligneEchappee
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
}

/**
 * Texte simple → HTML. Jamais de HTML saisi : tout est échappé d'abord.
 * Paragraphes séparés par une ligne vide ; « ## Titre » = intertitre ; lignes « - ... » = liste ; **gras** ; adresses https.
 */
export function texteVersHtml(texte) {
  const blocs = String(texte ?? '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocs.map((bloc) => {
    const lignes = bloc.split('\n').map((l) => l.trimEnd());
    if (lignes.length === 1 && lignes[0].startsWith('## ')) return `<h3>${ligneVersHtml(echapper(lignes[0].slice(3)))}</h3>`;
    if (lignes.every((l) => l.startsWith('- '))) return `<ul>${lignes.map((l) => `<li>${ligneVersHtml(echapper(l.slice(2)))}</li>`).join('')}</ul>`;
    return `<p>${lignes.map((l) => ligneVersHtml(echapper(l))).join('<br>')}</p>`;
  }).join('\n');
}

/* ───────── Boutons de mise en forme : chacun renvoie { texte, debut, fin } (nouveau texte + sélection à restaurer) ───────── */

/** Gras : entoure la sélection de ** ; sans sélection, insère **texte** avec « texte » sélectionné ; retire les ** si déjà présents. */
export function appliquerGras(texte, debut, fin) {
  const sel = texte.slice(debut, fin);
  if (sel.length >= 4 && sel.startsWith('**') && sel.endsWith('**')) {
    return { texte: texte.slice(0, debut) + sel.slice(2, -2) + texte.slice(fin), debut, fin: fin - 4 };
  }
  if (sel === '') {
    const insere = '**texte**';
    return { texte: texte.slice(0, debut) + insere + texte.slice(fin), debut: debut + 2, fin: debut + 7 };
  }
  return { texte: texte.slice(0, debut) + '**' + sel + '**' + texte.slice(fin), debut: debut + 2, fin: fin + 2 };
}

/** Bornes (début, fin) des lignes touchées par la sélection. */
function bornesLignes(texte, debut, fin) {
  const d = debut === 0 ? 0 : texte.lastIndexOf('\n', debut - 1) + 1;
  const finLigne = texte.indexOf('\n', fin);
  return { d, f: finLigne === -1 ? texte.length : finLigne };
}

/** Intertitre : la ligne courante devient un paragraphe à elle seule, précédée de « ## » ; recliquer retire le « ## ». */
export function appliquerTitre(texte, debut, fin) {
  const { d, f } = bornesLignes(texte, debut, fin);
  const ligne = texte.slice(d, f);
  const avant = texte.slice(0, d);
  const apres = texte.slice(f);
  if (ligne.startsWith('## ')) {
    const nue = ligne.slice(3);
    return { texte: avant + nue + apres, debut: d, fin: d + nue.length };
  }
  const nue = ligne.replace(/^- /, '');
  const prefixe = avant.trim() === '' ? '' : avant.replace(/\s+$/, '') + '\n\n';
  const suffixe = apres.trim() === '' ? '' : '\n\n' + apres.replace(/^\s+/, '');
  const nouveau = `${prefixe}## ${nue}${suffixe}`;
  const pos = prefixe.length + 3;
  return { texte: nouveau, debut: pos, fin: pos + nue.length };
}

/** Puces : chaque ligne touchée reçoit « - » ; si toutes l'ont déjà, il est retiré. */
export function appliquerPuce(texte, debut, fin) {
  const { d, f } = bornesLignes(texte, debut, fin);
  const lignes = texte.slice(d, f).split('\n');
  const toutes = lignes.every((l) => l.startsWith('- '));
  const nouvelles = lignes.map((l) => (toutes ? l.slice(2) : (l.startsWith('- ') ? l : `- ${l.replace(/^## /, '')}`)));
  const bloc = nouvelles.join('\n');
  return { texte: texte.slice(0, d) + bloc + texte.slice(f), debut: d, fin: d + bloc.length };
}

/** Lien : insère « https:// » (sélectionné) à la place de la sélection ; une adresse https:// devient cliquable d'elle-même. */
export function insererLien(texte, debut, fin) {
  const sel = texte.slice(debut, fin);
  if (/^https?:\/\//.test(sel)) return { texte, debut, fin };
  const adresse = 'https://';
  return { texte: texte.slice(0, debut) + adresse + texte.slice(fin), debut, fin: debut + adresse.length };
}
