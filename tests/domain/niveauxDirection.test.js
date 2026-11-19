import { describe, it, expect } from 'vitest';
import { optionsNiveaux, basculerNiveau, messageNiveaux } from '../../src/domain/niveauxDirection.js';

describe('optionsNiveaux', () => {
  it('distincts triés, absents ajoutés, sansNiveau compté', () => {
    const r = optionsNiveaux({ niveauxClasses: ['5e', '3e', '5E', null, '', '10e', '3e'], enregistres: ['3e', '2e'] });
    expect(r.options).toEqual([
      { valeur: '3e', coche: true, absent: false },
      { valeur: '5e', coche: false, absent: false },
      { valeur: '5E', coche: false, absent: false },
      { valeur: '10e', coche: false, absent: false },
      { valeur: '2e', coche: true, absent: true },
    ]);
    expect(r.sansNiveau).toBe(2);
  });
});

describe('basculerNiveau', () => {
  it('ajoute en gardant l\'ordre', () => expect(basculerNiveau(['3e'], '4e', true)).toEqual(['3e', '4e']));
  it('décocher la dernière', () => expect(basculerNiveau(['3e'], '3e', false)).toEqual([]));
  it('pas de doublon', () => expect(basculerNiveau(['3e'], '3e', true)).toEqual(['3e']));
  it('ordre numérique', () => expect(basculerNiveau(['10e', '3e'], '5e', true)).toEqual(['3e', '5e', '10e']));
});

describe('messageNiveaux', () => {
  it('zéro case', () => expect(messageNiveaux({ nbCoches: 0, sansNiveau: 3 })).toEqual({
    texte: 'Aucun niveau coché : apparaît sur toutes les classes.', avertissement: null }));
  it('une case, 0 sans niveau', () => expect(messageNiveaux({ nbCoches: 1, sansNiveau: 0 })).toEqual({
    texte: 'Apparaît seulement sur les classes des niveaux cochés.', avertissement: null }));
  it('une case, 1 sans niveau', () => expect(messageNiveaux({ nbCoches: 1, sansNiveau: 1 }).avertissement)
    .toBe('1 classe sans niveau : cette direction n\'y apparaît pas.'));
  it('une case, 2 sans niveau', () => expect(messageNiveaux({ nbCoches: 2, sansNiveau: 2 }).avertissement)
    .toBe('2 classes sans niveau : cette direction n\'y apparaît pas.'));
});
