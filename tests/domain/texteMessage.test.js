// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { appliquerGras, appliquerTitre, appliquerPuce, insererLien, texteVersHtml } from '../../src/domain/texteMessage.js';

const sel = (r) => r.texte.slice(r.debut, r.fin);

describe('appliquerGras', () => {
  it('entoure la sélection ; la sélection reste sur le mot', () => {
    const r = appliquerGras('Bonjour à tous', 8, 9);
    expect(r.texte).toBe('Bonjour **à** tous');
    expect(sel(r)).toBe('à');
  });
  it('sans sélection : insère **texte** avec « texte » sélectionné', () => {
    const r = appliquerGras('Salut ', 6, 6);
    expect(r.texte).toBe('Salut **texte**');
    expect(sel(r)).toBe('texte');
  });
  it('recliquer sur une sélection déjà en gras retire les astérisques', () => {
    const r = appliquerGras('a **gras** b', 2, 10);
    expect(r.texte).toBe('a gras b');
    expect(sel(r)).toBe('gras');
  });
});

describe('appliquerTitre', () => {
  it('la ligne devient un paragraphe à part, précédée de ##', () => {
    const t = 'Bonjour,\nCe qui change\nTexte suite';
    const r = appliquerTitre(t, 12, 12);
    expect(r.texte).toBe('Bonjour,\n\n## Ce qui change\n\nTexte suite');
    expect(sel(r)).toBe('Ce qui change');
  });
  it('première ligne : pas de ligne vide au début ; recliquer retire le ##', () => {
    const r = appliquerTitre('Titre\n\nTexte', 0, 0);
    expect(r.texte).toBe('## Titre\n\nTexte');
    const retour = appliquerTitre(r.texte, 3, 3);
    expect(retour.texte).toBe('Titre\n\nTexte');
  });
  it('transforme une puce en titre sans garder le tiret ; le rendu est un h3', () => {
    const r = appliquerTitre('- Idée', 2, 2);
    expect(r.texte).toBe('## Idée');
    expect(texteVersHtml(r.texte)).toBe('<h3>Idée</h3>');
  });
});

describe('appliquerPuce', () => {
  it('chaque ligne sélectionnée reçoit « - » ; le rendu est une liste', () => {
    const t = 'Intro\n\nun\ndeux';
    const r = appliquerPuce(t, 7, t.length);
    expect(r.texte).toBe('Intro\n\n- un\n- deux');
    expect(texteVersHtml(r.texte)).toContain('<ul><li>un</li><li>deux</li></ul>');
  });
  it('recliquer retire les puces ; une ligne déjà à puce n\'en reçoit pas deux', () => {
    const t = '- un\n- deux';
    expect(appliquerPuce(t, 0, t.length).texte).toBe('un\ndeux');
    expect(appliquerPuce('- un\ndeux', 0, 9).texte).toBe('- un\n- deux');
  });
  it('sans sélection : la ligne du curseur', () => {
    expect(appliquerPuce('a\nb\nc', 2, 2).texte).toBe('a\n- b\nc');
  });
});

describe('insererLien', () => {
  it('insère https:// sélectionné ; ne touche pas une adresse déjà présente', () => {
    const r = appliquerGras('x', 0, 0); // témoin : pas d'effet de bord entre fonctions
    expect(r.texte).toBe('**texte**x');
    const l = insererLien('Voir ', 5, 5);
    expect(l.texte).toBe('Voir https://');
    expect(sel(l)).toBe('https://');
    const deja = insererLien('https://a.be', 0, 12);
    expect(deja.texte).toBe('https://a.be');
  });
});

describe('gras sur plusieurs lignes (cas signalé : trois puces sélectionnées puis Gras)', () => {
  const t = "Voici les développements\n- la page 2\n- la page 3\n- la page 4";
  it('chaque ligne est mise en gras après son « - » : les puces restent des puces', () => {
    const r = appliquerGras(t, 25, t.length);
    expect(r.texte).toBe("Voici les développements\n- **la page 2**\n- **la page 3**\n- **la page 4**");
    const html = texteVersHtml(r.texte);
    expect(html).toContain('<ul><li><strong>la page 2</strong></li><li><strong>la page 3</strong></li><li><strong>la page 4</strong></li></ul>');
  });
  it('recliquer retire le gras de toutes les lignes ; les lignes vides sont laissées telles quelles', () => {
    const gras = "- **a**\n\n- **b**";
    expect(appliquerGras(gras, 0, gras.length).texte).toBe("- a\n\n- b");
    expect(appliquerGras("a\n\nb", 0, 4).texte).toBe("**a**\n\n**b**");
  });
  it('sélection partielle sur deux lignes : les deux lignes entières', () => {
    expect(appliquerGras("un deux\ntrois quatre", 3, 12).texte).toBe("**un deux**\n**trois quatre**");
  });
  it('un gras qui couvre plusieurs lignes d\'un même paragraphe est rendu en gras (aperçu et e-mail)', () => {
    expect(texteVersHtml('Voir **la page 2\nla page 3** ici')).toBe('<p>Voir <strong>la page 2<br>la page 3</strong> ici</p>');
  });
});

describe('puces et intertitres sans ligne vide autour', () => {
  it('des puces collées à une phrase forment quand même une liste ; le texte qui suit reste un paragraphe', () => {
    const h = texteVersHtml('Voici les nouveautés\n- page 2\n- page 3\nMerci');
    expect(h).toBe('<p>Voici les nouveautés</p>\n<ul><li>page 2</li><li>page 3</li></ul>\n<p>Merci</p>');
  });
  it('un intertitre collé à du texte est reconnu', () => {
    expect(texteVersHtml('Avant\n## Titre\nAprès')).toBe('<p>Avant</p>\n<h3>Titre</h3>\n<p>Après</p>');
  });
});

describe('Titre : un seul titre à la fois', () => {
  it('sélection sur plusieurs lignes : seule la première ligne devient un titre, le reste est inchangé', () => {
    const t = 'Bonjour,\n\nPremière idée\nDeuxième idée\nTroisième idée';
    const r = appliquerTitre(t, 10, t.length); // du début de « Première idée » à la fin du texte
    expect(r.texte).toBe('Bonjour,\n\n## Première idée\n\nDeuxième idée\nTroisième idée');
    expect(sel(r)).toBe('Première idée');
    expect(texteVersHtml(r.texte)).toContain('<h3>Première idée</h3>');
  });
});
