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
