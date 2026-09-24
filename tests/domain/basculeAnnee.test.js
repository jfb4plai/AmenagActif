import { describe, it, expect } from 'vitest';
import { besoinBasculeAnnee } from '../../src/domain/basculeAnnee.js';

const A = (libelle) => ({ libelle, active: true });

describe('besoinBasculeAnnee', () => {
  it('rien à signaler en janvier–juillet', () => {
    expect(besoinBasculeAnnee(A('2026-2027'), new Date('2027-03-10'))).toBe(false);
    expect(besoinBasculeAnnee(A('2026-2027'), new Date('2027-07-31'))).toBe(false);
  });

  it('signale dès le 15 août si l\'année active se termine cette année civile', () => {
    expect(besoinBasculeAnnee(A('2026-2027'), new Date('2027-08-15'))).toBe(true);
    expect(besoinBasculeAnnee(A('2026-2027'), new Date('2027-11-02'))).toBe(true);
  });

  it('ne signale pas avant le 15 août', () => {
    expect(besoinBasculeAnnee(A('2026-2027'), new Date('2027-08-10'))).toBe(false);
  });

  it('ne signale pas si l\'année active est déjà la bonne', () => {
    expect(besoinBasculeAnnee(A('2027-2028'), new Date('2027-09-01'))).toBe(false);
  });

  it('signale si aucune année active, en période', () => {
    expect(besoinBasculeAnnee(null, new Date('2027-09-01'))).toBe(true);
    expect(besoinBasculeAnnee(null, new Date('2027-04-01'))).toBe(false);
  });

  it('libellé non parsable → pas de faux positif', () => {
    expect(besoinBasculeAnnee(A('à définir'), new Date('2027-09-01'))).toBe(false);
  });
});
