import { describe, it, expect } from 'vitest';
import { computeFicheEleve } from '../../src/domain/projections/ficheEleve.js';
import * as f from '../../src/test/fixtures/sample.js';

const args = (eleveId) => ({
  eleve: f.eleves.find((e) => e.id === eleveId),
  classeNom: '5LA',
  ecoleNom: f.contexte.ecoleNom,
  ecoleFase: f.contexte.ecoleFase,
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
});

describe('computeFicheEleve', () => {
  it('liste les AR (dont recto) et les aménagements libres, groupés par chapitre ordonné', () => {
    const vm = computeFicheEleve(args('e1'));
    expect(vm.eleve).toBe('Emilie D.');
    const ch1 = vm.parChapitre.find((c) => c.chapitreTitre.startsWith('1.'));
    expect(ch1.amenagements).toEqual([
      'Doubler les espaces de réponse',
      'Cours uniquement en recto',
      'Vérifier oralement la consigne avant de commencer',
    ]);
  });

  it('élève sans aménagement → parChapitre vide', () => {
    const vm = computeFicheEleve(args('e2'));
    expect(vm.parChapitre).toEqual([]);
  });

  it('ne crée pas de chapitre vide', () => {
    const vm = computeFicheEleve(args('e3'));
    expect(vm.parChapitre.map((c) => c.chapitreTitre.slice(0, 2))).toEqual(['1.', '5.']);
  });

  it('expose le commentaire de l\'élève (chaîne vide si aucun)', () => {
    expect(computeFicheEleve(args('e2')).commentaire).toBe('Décès de la grand-mère mi-septembre, vigilance émotionnelle');
    expect(computeFicheEleve(args('e1')).commentaire).toBe('');
  });

  it('expose le nom de l\'école, le numéro FASE et le statut IPT/PAR de l\'élève', () => {
    const vm = computeFicheEleve(args('e1'));
    expect(vm.ecoleNom).toBe('Athénée X');
    expect(vm.ecoleFase).toBe('482');
    expect(vm.statut).toBe('PAR');
  });
});
