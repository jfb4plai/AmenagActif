import { describe, it, expect } from 'vitest';
import { referenceLien, trierClasses, nomSommaire } from '../../src/domain/liens.js';

describe('super lien : fonctions pures', () => {
  it('referenceLien formate sur 4 chiffres', () => {
    expect(referenceLien(42)).toBe('SL-0042');
    expect(referenceLien(5)).toBe('SL-0005');
    expect(referenceLien(12345)).toBe('SL-12345');
    expect(referenceLien(null)).toBe('');
    expect(referenceLien(undefined)).toBe('');
  });

  it('trierClasses : niveau naturel puis nom, niveau absent en dernier, sans muter', () => {
    const entree = [
      { id: 'a', nom: '5B', niveau: '5e' },
      { id: 'b', nom: 'ZZ', niveau: null },
      { id: 'c', nom: '3A', niveau: '3e' },
      { id: 'd', nom: '10A', niveau: '10e' },
      { id: 'e', nom: '5A', niveau: '5e' },
    ];
    const copie = JSON.parse(JSON.stringify(entree));
    const sortie = trierClasses(entree);
    expect(sortie.map((c) => c.id)).toEqual(['c', 'e', 'a', 'd', 'b']);
    expect(entree).toEqual(copie);
    expect(sortie).not.toBe(entree);
  });

  it('nomSommaire compose numéro, date, implantation, repère et nombre', () => {
    const p = {
      numero: 42,
      cree_le: '2026-11-13T12:00:00Z',
      ecole: { nom: 'Athénée A', implantation: '4012', implantation_nom: 'Site Centre' },
      destinataire: 'A., français',
      nbClasses: 12,
    };
    expect(nomSommaire(p)).toBe('Super lien SL-0042 (créé le 13 novembre 2026) · Site Centre (FASE 4012) · A., français · 12 classes');
    expect(nomSommaire({ ...p, nbClasses: 1 }).endsWith('· 1 classe')).toBe(true);
  });
});
