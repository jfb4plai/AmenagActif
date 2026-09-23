import { describe, it, expect } from 'vitest';
import { fusionnerDonneesClasses } from '../../src/domain/projections/fusionClasses.js';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import * as f from '../../src/test/fixtures/sample.js';

const partieA = () => ({
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

const partieB = () => ({
  classe: { referent_plai_nom: 'Carole', niveau: '5e', created_at: '2026-08-19T08:00:00Z' },
  contexte: { classeNom: '5LB', ecoleNom: f.contexte.ecoleNom, anneeLibelle: f.contexte.anneeLibelle },
  eleves: [{ id: 'e4', classe_id: 'cl-5lb', prenom: 'Yasmine', initiale_nom: 'T', commentaire: '', statut: 'IPT', created_at: '2026-08-21T08:00:00Z' }],
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  // même AU que la classe A, coché aussi ici -> doit rester unique dans le résultat fusionné.
  auClasse: [{ amenagement_id: 'a-au1', cree_le: '2026-09-04T08:00:00Z' }],
  selectionsAR: [{ eleve_id: 'e4', amenagement_id: 'a-ar1', cree_le: '2026-09-05T08:00:00Z' }],
  libres: [],
  referents: f.referents,
});

describe('fusionnerDonneesClasses', () => {
  it('dédoublonne un AU coché dans plusieurs classes sources', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    expect(fusion.auClasse).toHaveLength(1);
    expect(fusion.auClasse[0].amenagement_id).toBe('a-au1');
  });

  it('concatène les élèves de toutes les classes sans doublon', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    expect(fusion.eleves.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3', 'e4']);
  });

  it('liste les classes sources', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    expect(fusion.classesSources).toEqual(['5LA', '5LB']);
  });

  it('utilise le nom de groupe fourni, sinon la concatenation des classes', () => {
    expect(fusionnerDonneesClasses([partieA(), partieB()], 'Atelier cuisine 5e').contexte.classeNom).toBe('Atelier cuisine 5e');
    expect(fusionnerDonneesClasses([partieA(), partieB()]).contexte.classeNom).toBe('5LA + 5LB');
  });

  it('fusionne les référents PLAI de classe sans doublon', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    expect(fusion.classe.referent_plai_nom).toBe('Mona, Carole');
  });

  it('garde le niveau commun, ou null si les classes sources ont des niveaux différents', () => {
    expect(fusionnerDonneesClasses([partieA(), partieB()]).classe.niveau).toBe('5e');
    const partieC = { ...partieB(), classe: { ...partieB().classe, niveau: '3e' } };
    expect(fusionnerDonneesClasses([partieA(), partieC]).classe.niveau).toBeNull();
  });

  it('le résultat fusionné reste consommable par computeFicheClasse (AU non dupliqué dans pourTous)', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    const vm = computeFicheClasse(fusion);
    expect(vm.pourTous.filter((x) => x.libelle === 'Mise en page')).toHaveLength(1);
    expect(vm.parEleve.map((x) => x.eleve)).toContain('Yasmine T.');
  });
});
