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

  it("l'AR recto s'affiche comme tout AR spécifique (plus de compteur dédié)", () => {
    const vm = computeFicheClasse(args());
    const emilie = vm.parEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.amenagements).toContain('Cours uniquement en recto');
    expect(vm.nbRecto).toBeUndefined();
  });

  it('elevesListe : prénom + nom de famille complet, à défaut prénom + initiales', () => {
    const eleves = f.eleves.map((e) => (e.id === 'e1' ? { ...e, nom_famille: 'Dupont' } : e));
    const vm = computeFicheClasse({ ...args(), eleves });
    expect(vm.elevesListe.map((x) => x.nom)).toEqual(['Emilie Dupont', 'Karim B.', 'Lea M.']);
    // Le tableau des AR garde prénom + initiales.
    expect(vm.parEleve.map((x) => x.eleve)).toContain('Emilie D.');
  });

  it('initiales vides : le tableau des AR affiche le prénom seul', () => {
    const eleves = f.eleves.map((e) => (e.id === 'e1' ? { ...e, initiale_nom: '' } : e));
    const vm = computeFicheClasse({ ...args(), eleves });
    expect(vm.parEleve.map((x) => x.eleve)).toContain('Emilie');
  });

  it('tableauReferents sépare PIA (référent·e·s PLAI de la classe, texte libre) et PAR (direction)', () => {
    const vm = computeFicheClasse(args());
    expect(vm.tableauReferents.pia).toEqual(['Mona', 'Carole']);
    expect(vm.tableauReferents.par).toEqual(['Julien']);
  });

  it('PAR : une direction sans niveaux assignés apparaît sur toutes les classes ; une direction restreinte à d\'autres niveaux est exclue', () => {
    const vm = computeFicheClasse(args());
    expect(vm.tableauReferents.par).toEqual(['Julien']);
    expect(vm.tableauReferents.par).not.toContain('Sophie');
  });

  it('PAR : une direction dont les niveaux incluent celui de la classe apparaît', () => {
    const referents = [...args().referents, { nom: 'Karim', fonction: 'direction', niveaux: ['5e', '6e'] }];
    const vm = computeFicheClasse({ ...args(), referents });
    expect(vm.tableauReferents.par.sort()).toEqual(['Julien', 'Karim']);
  });

  it('PIA : classe sans référent PLAI saisi → liste vide', () => {
    const vm = computeFicheClasse({ ...args(), classe: { ...f.classe5LA, referent_plai_nom: '' } });
    expect(vm.tableauReferents.pia).toEqual([]);
  });

  it('dateMaj = date de sélection la plus récente', () => {
    const vm = computeFicheClasse(args());
    expect(vm.dateMaj).toBe('2026-09-03T08:00:00Z');
  });

  it('classe vide → pourTous, parEleve et elevesListe vides, dateMaj = création de la classe', () => {
    const vm = computeFicheClasse({ ...args(), eleves: [], selectionsAR: [], auClasse: [], libres: [] });
    expect(vm.pourTous).toEqual([]);
    expect(vm.parEleve).toEqual([]);
    expect(vm.elevesListe).toEqual([]);
    expect(vm.dateMaj).toBe('2026-08-20T08:00:00Z');
  });

  it('sans aucune donnée → dateMaj null', () => {
    const vm = computeFicheClasse({ ...args(), classe: { nom: '5LA' }, eleves: [], selectionsAR: [], auClasse: [], libres: [] });
    expect(vm.dateMaj).toBeNull();
  });

  it('commentaires : un élève avec commentaire non vide, les autres omis', () => {
    const vm = computeFicheClasse(args());
    expect(vm.commentaires).toEqual([
      { eleve: 'Karim B.', statut: 'IPT', texte: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle' },
    ]);
  });

  it('parAmenagement : une ligne par AR/libre, triée par ordre de chapitre, avec la liste des élèves concernés', () => {
    const vm = computeFicheClasse(args());
    expect(vm.parAmenagement.map((x) => x.libelle)).toEqual([
      'Doubler les espaces de réponse',
      'Cours uniquement en recto',
      'Utiliser les livres audio pour la lecture',
      'Vérifier oralement la consigne avant de commencer',
    ]);
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual([{ nom: 'Emilie D.', eleveId: 'e1', statut: 'PAR' }]);
  });

  it('parAmenagement : ne contient pas l\'AR recto ni les commentaires', () => {
    const vm = computeFicheClasse(args());
    expect(vm.parAmenagement.some((x) => x.libelle.includes('grand-mère'))).toBe(false);
  });

  it('parAmenagement : un même AR partagé par deux élèves liste les deux noms', () => {
    const selectionsAR = [...args().selectionsAR, { eleve_id: 'e3', amenagement_id: 'a-ar1', cree_le: '2026-09-03T08:00:00Z' }];
    const vm = computeFicheClasse({ ...args(), selectionsAR });
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual([
      { nom: 'Emilie D.', eleveId: 'e1', statut: 'PAR' },
      { nom: 'Lea M.', eleveId: 'e3', statut: 'PAR' },
    ]);
  });
});
