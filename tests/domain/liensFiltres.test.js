import { describe, it, expect } from 'vitest';
import { filtrerLiens, grouperParEcole, titreEcole, dateFR } from '../../src/domain/liens.js';

const now = new Date('2026-12-01T12:00:00Z');
const lien = (o) => ({ id: 'x', ecole_id: 'e1', statut: 'actif', cree_le: '2026-09-01T00:00:00Z', derniere_ouverture: null, ...o });

describe('filtrerLiens', () => {
  const liens = [
    lien({ id: 'recent', derniere_ouverture: '2026-11-25T00:00:00Z' }),
    lien({ id: 'ancien', derniere_ouverture: '2026-08-01T00:00:00Z' }),
    lien({ id: 'jamais-ouvert-vieux', cree_le: '2026-05-01T00:00:00Z' }),
    lien({ id: 'jamais-ouvert-neuf', cree_le: '2026-11-20T00:00:00Z' }),
    lien({ id: 'rev', statut: 'revoque' }),
  ];
  it('sans filtre : tout', () => expect(filtrerLiens(liens, { now })).toHaveLength(5));
  it('par statut', () => expect(filtrerLiens(liens, { statut: 'revoque', now }).map((l) => l.id)).toEqual(['rev']));
  it('inactifs depuis plus de N jours (dernière ouverture, à défaut création)', () => {
    expect(filtrerLiens(liens, { inactifJours: 60, now }).map((l) => l.id).sort()).toEqual(['ancien', 'jamais-ouvert-vieux', 'rev'].sort());
  });
  it('N modifiable', () => {
    expect(filtrerLiens(liens, { inactifJours: 5, now }).map((l) => l.id)).toContain('recent');
  });
});

describe('regroupement et libellés', () => {
  it('une section par implantation, même vide', () => {
    const g = grouperParEcole([lien({ ecole_id: 'e1' })], [{ id: 'e1' }, { id: 'e2' }]);
    expect(g.map((s) => s.liens.length)).toEqual([1, 0]);
  });
  it("titre d'implantation", () => {
    expect(titreEcole({ nom: 'Athénée X', implantation: '4012', implantation_nom: 'Site Y' })).toBe('Site Y (FASE 4012)');
    expect(titreEcole({ nom: 'Athénée X' })).toBe('Athénée X');
  });
  it('dateFR tolère le vide', () => {
    expect(dateFR(null)).toBe('');
    expect(dateFR('2027-08-31')).toContain('2027');
  });
});
