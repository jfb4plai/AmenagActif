import { describe, it, expect } from 'vitest';
import { computeProfilDiffActif } from '../../src/domain/projections/profilDiffActif.js';
import * as f from '../../src/test/fixtures/sample.js';

describe('computeProfilDiffActif', () => {
  const vm = computeProfilDiffActif({
    contexte: f.contexte,
    eleves: f.eleves,
    amenagements: f.amenagements,
    chapitres: f.chapitres,
    auClasse: f.auClasse,
    selectionsAR: f.selectionsAR,
    libres: f.libres,
  });

  it('métadonnées versionnées', () => {
    expect(vm.app).toBe('amenagactif');
    expect(vm.version).toBe(1);
    expect(vm.classe).toBe('5LA');
    expect(vm.ecole).toBe('Athénée X');
    expect(vm.annee).toBe('2025-2026');
  });

  it('auCommuns = AU de la classe avec chapitre', () => {
    expect(vm.auCommuns).toEqual([
      { id: 'a-au1', libelle: 'Mise en page', chapitre: f.chapitres[0].titre },
    ]);
  });

  it('arParEleve inclut AR catalogue + recto + libres, élèves sans AR exclus', () => {
    const noms = vm.arParEleve.map((x) => x.eleve);
    expect(noms).toEqual(['Emilie D.', 'Lea M.']);
    const emilie = vm.arParEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.amenagements).toEqual([
      'Doubler les espaces de réponse',
      'Cours uniquement en recto',
      'Vérifier oralement la consigne avant de commencer',
    ]);
  });
});
