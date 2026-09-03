import { describe, it, expect } from 'vitest';
import { buildSnapshot, diffSnapshots } from '../../src/domain/projections/snapshot.js';
import * as f from '../../src/test/fixtures/sample.js';

const base = {
  eleves: f.eleves,
  amenagements: f.amenagements,
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
};

describe('buildSnapshot', () => {
  it('produit une structure stable et sérialisable', () => {
    const s = buildSnapshot(base);
    expect(s.au.sort()).toEqual(['Mise en page']);
    expect(s.parEleve['Emilie D.'].sort()).toEqual(
      ['Cours uniquement en recto', 'Doubler les espaces de réponse', 'Vérifier oralement la consigne avant de commencer'].sort()
    );
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('diffSnapshots', () => {
  it('détecte AU ajouté / retiré et AR ajouté / retiré par élève', () => {
    const prev = buildSnapshot(base);
    const next = buildSnapshot({
      ...base,
      auClasse: [],
      selectionsAR: [
        ...f.selectionsAR.filter((s) => !(s.eleve_id === 'e1' && s.amenagement_id === 'a-ar1')),
        { eleve_id: 'e2', amenagement_id: 'a-ar5' },
      ],
    });
    const d = diffSnapshots(prev, next);
    expect(d.auRetires).toEqual(['Mise en page']);
    expect(d.auAjoutes).toEqual([]);
    expect(d.arRetires).toContainEqual({ eleve: 'Emilie D.', texte: 'Doubler les espaces de réponse' });
    expect(d.arAjoutes).toContainEqual({ eleve: 'Karim B.', texte: 'Utiliser les livres audio pour la lecture' });
  });

  it('snapshots identiques → diff vide', () => {
    const s = buildSnapshot(base);
    const d = diffSnapshots(s, s);
    expect(d).toEqual({ auAjoutes: [], auRetires: [], arAjoutes: [], arRetires: [] });
  });

  it('prev null (premier envoi) → tout est "ajouté"', () => {
    const next = buildSnapshot(base);
    const d = diffSnapshots(null, next);
    expect(d.auAjoutes).toEqual(['Mise en page']);
    expect(d.arAjoutes.length).toBeGreaterThan(0);
    expect(d.auRetires).toEqual([]);
  });
});
