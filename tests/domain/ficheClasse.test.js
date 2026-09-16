import { describe, it, expect } from 'vitest';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import * as f from '../../src/test/fixtures/sample.js';

const args = () => ({
  classe: f.classe5LA,
  contexte: f.contexte,
  eleves: f.eleves,
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
  referents: f.referents,
});

describe('computeFicheClasse', () => {
  it('place les AU de la classe dans pourTous, triés par ordre de chapitre', () => {
    const vm = computeFicheClasse(args());
    expect(vm.pourTous.map((x) => x.libelle)).toEqual(['Mise en page']);
    expect(vm.pourTous[0].chapitreTitre).toContain('1. SUPPORTS');
  });

  it('marque surligne=true pour l\'AU « Mise en page »', () => {
    const vm = computeFicheClasse(args());
    expect(vm.pourTous[0].surligne).toBe(true);
  });

  it('regroupe les AR par élève et masque les élèves sans AR spécifique', () => {
    const vm = computeFicheClasse(args());
    const noms = vm.parEleve.map((x) => x.eleve);
    expect(noms).toEqual(['Emilie D.', 'Lea M.']);
    const emilie = vm.parEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.eleveId).toBe('e1');
    expect(emilie.amenagements).toContain('Doubler les espaces de réponse');
    expect(emilie.amenagements).toContain('Vérifier oralement la consigne avant de commencer');
  });

  it('ne compte pas l\'AR « recto » comme AR spécifique affiché', () => {
    const vm = computeFicheClasse(args());
    const emilie = vm.parEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.amenagements).not.toContain('Cours uniquement en recto');
  });

  it('nbRecto = nombre d\'élèves ayant l\'AR recto', () => {
    const vm = computeFicheClasse(args());
    expect(vm.nbRecto).toBe(2);
  });

  it('tableauReferents sépare PIA (accompagnateurs élèves) et PAR (direction)', () => {
    const vm = computeFicheClasse(args());
    expect(vm.tableauReferents.pia.sort()).toEqual(['Carole', 'Mona']);
    expect(vm.tableauReferents.par).toEqual(['Julien']);
  });

  it('PAR : une direction sans niveaux assignés apparaît sur toutes les classes ; une direction restreinte à d\'autres niveaux est exclue', () => {
    const vm = computeFicheClasse(args());
    expect(vm.tableauReferents.par).toEqual(['Julien']);
  });

  it('PAR : une direction dont les niveaux incluent celui de la classe apparaît', () => {
    const referents = [...args().referents, { nom: 'Karim', fonction: 'direction', niveaux: ['5e', '6e'] }];
    const vm = computeFicheClasse({ ...args(), referents });
    expect(vm.tableauReferents.par.sort()).toEqual(['Julien', 'Karim']);
  });

  it('PIA retombe sur le référent PLAI de l\'implantation si aucun accompagnateur par élève', () => {
    const eleves = args().eleves.map((e) => ({ ...e, referent_plai_nom: '' }));
    const vm = computeFicheClasse({ ...args(), eleves });
    expect(vm.tableauReferents.pia).toEqual(['Mona']);
  });

  it('dateMaj = date de sélection la plus récente', () => {
    const vm = computeFicheClasse(args());
    expect(vm.dateMaj).toBe('2026-09-03T08:00:00Z');
  });

  it('classe vide → pourTous et parEleve vides, nbRecto 0, dateMaj = création de la classe', () => {
    const vm = computeFicheClasse({ ...args(), eleves: [], selectionsAR: [], auClasse: [], libres: [] });
    expect(vm.pourTous).toEqual([]);
    expect(vm.parEleve).toEqual([]);
    expect(vm.nbRecto).toBe(0);
    expect(vm.dateMaj).toBe('2026-08-20T08:00:00Z');
  });

  it('sans aucune donnée → dateMaj null', () => {
    const vm = computeFicheClasse({ ...args(), classe: { nom: '5LA' }, eleves: [], selectionsAR: [], auClasse: [], libres: [] });
    expect(vm.dateMaj).toBeNull();
  });

  it('commentaires : un élève avec commentaire non vide, les autres omis', () => {
    const vm = computeFicheClasse(args());
    expect(vm.commentaires).toEqual([
      { eleve: 'Karim B.', texte: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle' },
    ]);
  });
});
