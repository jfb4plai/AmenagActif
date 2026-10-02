import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FicheClasseView from '../../src/components/fiche/FicheClasseView.jsx';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../../src/domain/projections/fusionClasses.js';
import * as f from '../../src/test/fixtures/sample.js';

export const chapD = { id: 'd1', ordre: 13, titre: 'Dispositif de régulation des comportements', est_dispositif: true };
export const itemsD = [
  { id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR' },
  { id: 'x2', chapitre_id: 'd1', ordre: 2, libelle: 'Pictogramme de pause', type: 'AR' },
];
export const modeAU = [{ chapitre_id: 'd1', pour_toute_la_classe: true }];
export const modeAR = [{ chapitre_id: 'd1', pour_toute_la_classe: false }];

const base = (extra = {}) => ({
  classe: f.classe5LA,
  contexte: f.contexte,
  eleves: f.eleves,
  amenagements: [...f.amenagements, ...itemsD],
  chapitres: [...f.chapitres, chapD],
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
  referents: f.referents,
  ...extra,
});

describe('computeFicheClasse — dispositifs', () => {
  it('mode AU : un bloc dispositif, absent de pourTous et du tableau AR', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([{ titre: chapD.titre, items: ['Coin calme'], classe: '5LA' }]);
    expect(vm.pourTous.map((x) => x.libelle)).toEqual(['Mise en page']);
    expect(vm.parAmenagement.map((r) => r.libelle)).not.toContain('Coin calme');
  });

  it('mode AR : les items vont dans le tableau AR avec leurs élèves, pas de bloc dispositif', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAR,
      selectionsAR: [...f.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([]);
    const row = vm.parAmenagement.find((r) => r.libelle === 'Coin calme');
    expect(row.eleves.map((e) => e.nom)).toEqual(['Karim B.']);
  });

  it('sans ligne de mode : défaut AR', () => {
    const vm = computeFicheClasse(base({
      selectionsAR: [...f.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([]);
    expect(vm.parAmenagement.map((r) => r.libelle)).toContain('Coin calme');
  });

  it('mode AU : une sélection élève restée sur le dispositif est ignorée', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      selectionsAR: [...f.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.parAmenagement.map((r) => r.libelle)).not.toContain('Coin calme');
    expect(vm.parEleve.map((x) => x.eleve)).not.toContain('Karim B.');
  });

  it('mode AR : une ligne AU de classe restée sur le dispositif est ignorée', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAR,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([]);
    expect(vm.pourTous.map((x) => x.libelle)).toEqual(['Mise en page']);
  });
});

describe('fusionnerDonneesClasses — dispositifs', () => {
  const partieA = () => base({
    modesDispositifs: modeAU,
    auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
  });
  const partieB = () => ({
    classe: { referent_plai_nom: 'Carole', niveau: '5e', created_at: '2026-08-19T08:00:00Z' },
    contexte: { classeNom: '5LB', ecoleNom: f.contexte.ecoleNom, anneeLibelle: f.contexte.anneeLibelle },
    eleves: [{ id: 'e4', classe_id: 'cl-5lb', prenom: 'Yasmine', initiale_nom: 'T', commentaire: '', statut: 'IPT', created_at: '2026-08-21T08:00:00Z' }],
    amenagements: [...f.amenagements, ...itemsD],
    chapitres: [...f.chapitres, chapD],
    auClasse: [],
    selectionsAR: [{ eleve_id: 'e4', amenagement_id: 'x1', cree_le: '2026-09-05T08:00:00Z' }],
    libres: [],
    referents: f.referents,
    modesDispositifs: modeAR,
  });

  it('un dispositif AU dans une classe et AR dans une autre : bloc étiqueté par classe + AR de la seconde', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    const vm = computeFicheClasse(fusion);
    expect(vm.dispositifsClasse).toEqual([{ titre: chapD.titre, items: ['Coin calme'], classe: '5LA' }]);
    const row = vm.parAmenagement.find((r) => r.libelle === 'Coin calme');
    expect(row.eleves.map((e) => e.nom)).toEqual(['Yasmine T.']);
  });

  it('écarte la sélection résiduelle de la classe en mode AU avant fusion', () => {
    const a = partieA();
    a.selectionsAR = [...a.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }];
    const fusion = fusionnerDonneesClasses([a, partieB()]);
    expect(fusion.selectionsAR.some((s) => s.eleve_id === 'e2' && s.amenagement_id === 'x1')).toBe(false);
  });
});

describe('FicheClasseView — bloc dispositif', () => {
  it('affiche le titre exact du dispositif et ses items sous les AU', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    render(<FicheClasseView vm={vm} />);
    expect(screen.getByText(`${chapD.titre} :`)).toBeTruthy();
    expect(screen.getByText('Coin calme')).toBeTruthy();
  });
  it('ajoute le nom de la classe en fiche groupée', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    vm.classesSources = ['5LA', '5LB'];
    render(<FicheClasseView vm={vm} />);
    expect(screen.getByText(`${chapD.titre} (5LA) :`)).toBeTruthy();
  });
});
