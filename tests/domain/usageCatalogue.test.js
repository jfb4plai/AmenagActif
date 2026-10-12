import { describe, it, expect } from 'vitest';
import { regrouperUsage } from '../../src/domain/usageCatalogue.js';

const lieu = (ecoleId, ecole, classe, annee = '2026-2027') => ({ ecoleId, ecole, annee, classe });

describe('regrouperUsage', () => {
  it('regroupe par implantation puis par classe, avec élèves, AU, libres et référents', () => {
    const r = regrouperUsage({
      ar: [
        { ...lieu('e1', 'Pitteurs', '5LA'), eleve: 'Emilie Dupont', libelle: 'Doubler les espaces' },
        { ...lieu('e1', 'Pitteurs', '5LA'), eleve: 'Emilie Dupont', libelle: 'Tiers-temps' },
        { ...lieu('e1', 'Pitteurs', '5LA'), eleve: 'Karim B.', libelle: 'Tiers-temps' },
        { ...lieu('e2', 'Bressoux', '3A'), eleve: 'Lea M.', libelle: 'Tiers-temps' },
      ],
      au: [{ ...lieu('e2', 'Bressoux', '3A'), libelle: 'Mise en page' }],
      libres: [{ ...lieu('e1', 'Pitteurs', '5LA'), eleve: 'Karim B.', texte: 'Pause' }],
      referents: { e1: ['Hélène (référent PLAI)'] },
    });
    expect(r.nbEcoles).toBe(2);
    expect(r.nbEleves).toBe(3);
    expect(r.nbClassesAU).toBe(1);
    expect(r.ecoles.map((e) => e.ecole)).toEqual(['Bressoux', 'Pitteurs']);
    const pitteurs = r.ecoles.find((e) => e.ecole === 'Pitteurs');
    expect(pitteurs.referents).toEqual(['Hélène (référent PLAI)']);
    expect(pitteurs.classes[0].eleves.map((e) => e.nom)).toEqual(['Emilie Dupont', 'Karim B.']);
    expect(pitteurs.classes[0].eleves[0].libelles).toEqual(['Doubler les espaces', 'Tiers-temps']);
    expect(pitteurs.classes[0].eleves[1].libelles).toContain('Pause (libre)');
    expect(r.ecoles.find((e) => e.ecole === 'Bressoux').referents).toEqual([]);
  });

  it('jamais utilisé : vide', () => {
    const r = regrouperUsage({});
    expect(r.vide).toBe(true);
    expect(r.nbEleves).toBe(0);
  });
});
