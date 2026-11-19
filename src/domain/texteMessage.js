// Texte simple des messages aux utilisateurs : conversion en HTML (même code côté serveur et pour l'aperçu)
// et aides de mise en forme des boutons. Sans React ni réseau.

const echapper = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mise en forme d'une ligne déjà échappée : **gras** et adresses https://… cliquables. */
function ligneVersHtml(ligneEchappee) {
  return ligneEchappee
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}">${u}</a>`);
}

/**
 * Texte simple → HTML. Jamais de HTML saisi : tout est échappé d'abord.
 * Paragraphes séparés par une ligne vide ; « ## Titre » = intertitre ; lignes « - ... » = liste (même collée à un texte) ; **gras** ; adresses https.
 */
export function texteVersHtml(texte) {
  const blocs = String(texte ?? '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  return blocs.map((bloc) => {
    // Dans un bloc, les lignes « ## » et les suites de lignes « - » sont reconnues même sans ligne vide autour :
    // l'enseignant n'a pas à connaître cette règle. Le reste forme des paragraphes.
    const sorties = [];
    let liste = [];
    let texteCourant = [];
    const viderListe = () => { if (liste.length) sorties.push(`<ul>${liste.map((l) => `<li>${ligneVersHtml(echapper(l))}</li>`).join('')}</ul>`); liste = []; };
    const viderTexte = () => {
      // Le gras peut s'étendre sur plusieurs lignes d'un même paragraphe : on met en forme le bloc entier, puis les retours à la ligne.
      if (texteCourant.length) sorties.push(`<p>${ligneVersHtml(echapper(texteCourant.join('\n'))).replace(/\n/g, '<br>')}</p>`);
      texteCourant = [];
    };
    for (const l of bloc.split('\n').map((x) => x.trimEnd())) {
      if (l.startsWith('## ')) { viderListe(); viderTexte(); sorties.push(`<h3>${ligneVersHtml(echapper(l.slice(3)))}</h3>`); }
      else if (l.startsWith('- ')) { viderTexte(); liste.push(l.slice(2)); }
      else { viderListe(); texteCourant.push(l); }
    }
    viderListe();
    viderTexte();
    return sorties.join('\n');
  }).join('\n');
}

/* ───────── Boutons de mise en forme : chacun renvoie { texte, debut, fin } (nouveau texte + sélection à restaurer) ───────── */

/** Gras : entoure la sélection de ** ; sans sélection, insère **texte** avec « texte » sélectionné ; retire les ** si déjà présents. */
export function appliquerGras(texte, debut, fin) {
  const sel = texte.slice(debut, fin);
  if (sel.includes('\n')) return grasParLigne(texte, debut, fin);
  if (sel.length >= 4 && sel.startsWith('**') && sel.endsWith('**')) {
    return { texte: texte.slice(0, debut) + sel.slice(2, -2) + texte.slice(fin), debut, fin: fin - 4 };
  }
  if (sel === '') {
    const insere = '**texte**';
    return { texte: texte.slice(0, debut) + insere + texte.slice(fin), debut: debut + 2, fin: debut + 7 };
  }
  return { texte: texte.slice(0, debut) + '**' + sel + '**' + texte.slice(fin), debut: debut + 2, fin: fin + 2 };
}

/**
 * Sélection sur plusieurs lignes : chaque ligne non vide est mise en gras séparément, APRÈS son éventuel « - » ou « ## »
 * (sinon la puce ou le titre ne serait plus reconnu). Si toutes le sont déjà, le gras est retiré.
 */
function grasParLigne(texte, debut, fin) {
  const { d, f } = bornesLignes(texte, debut, fin);
  const parts = texte.slice(d, f).split('\n').map((l) => { const m = /^(- |## )?(.*)$/.exec(l); return { pre: m[1] ?? '', corps: m[2] }; });
  const gras = (c) => /^\*\*.+\*\*$/.test(c);
  const actives = parts.filter((p) => p.corps.trim() !== '');
  const retirer = actives.length > 0 && actives.every((p) => gras(p.corps));
  const bloc = parts.map((p) => {
    if (p.corps.trim() === '') return p.pre + p.corps;
    if (retirer) return p.pre + p.corps.slice(2, -2);
    return p.pre + (gras(p.corps) ? p.corps : `**${p.corps}**`);
  }).join('\n');
  return { texte: texte.slice(0, d) + bloc + texte.slice(f), debut: d, fin: d + bloc.length };
}

/** Bornes (début, fin) des lignes touchées par la sélection. */
function bornesLignes(texte, debut, fin) {
  const d = debut === 0 ? 0 : texte.lastIndexOf('\n', debut - 1) + 1;
  const finLigne = texte.indexOf('\n', fin);
  return { d, f: finLigne === -1 ? texte.length : finLigne };
}

/**
 * Intertitre : la ligne courante devient un paragraphe à elle seule, précédée de « ## » ; recliquer retire le « ## ».
 * Un seul titre à la fois : si la sélection couvre plusieurs lignes, seule la PREMIÈRE ligne devient un titre.
 */
export function appliquerTitre(texte, debut) {
  const { d, f } = bornesLignes(texte, debut, debut);
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
