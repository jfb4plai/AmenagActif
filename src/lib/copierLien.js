/** Copie un lien dans le presse-papier (HTML cliquable si possible, sinon texte). @returns {Promise<'riche'|'texte'|'echec'>} */
export async function copierLien(url, libelle) {
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        const html = `<a href="${encodeURI(url)}">${libelle.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</a>`;
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([`${libelle} : ${url}`], { type: 'text/plain' }),
          }),
        ]);
        return 'riche';
      } catch {
        // navigateur sans support du presse-papier riche : repli plein texte
      }
    }
    await navigator.clipboard.writeText(`${libelle} : ${url}`);
    return 'texte';
  } catch {
    return 'echec';
  }
}
