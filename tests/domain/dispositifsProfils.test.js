import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../../src/domain/projections/snapshot.js';
import { computeProfilDiffActif } from '../../src/domain/projections/profilDiffActif.js';
import { computeProfilClasse } from '../../src/domain/projections/profilClasse.js';

const chapitres = [{ id: 'd1', ordre: 13, titre: 'Dispositif de régulation des comportements', code: 'dispositif_regulation', est_dispositif: true }];
const amenagements = [{ id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR', code: 'ar_coin_calme', partage_profil: true }];
const eleves = [{ id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D', statut: 'PAR' }];
const contexte = { classeNom: '5LA', ecoleNom: 'Athénée X', anneeLibelle: '2026-2027' };
const modeAU = [{ chapitre_id: 'd1', pour_toute_la_classe: true }];
const modeAR = [{ chapitre_id: 'd1', pour_toute_la_classe: false }];

const auInput = { contexte, eleves, amenagements, chapitres, auClasse: [{ amenagement_id: 'x1' }], selectionsAR: [], libres: [], modesDispositifs: modeAU };
const arInput = { contexte, eleves, amenagements, chapitres, auClasse: [], selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }], libres: [], modesDispositifs: modeAR };

describe('snapshot — dispositifs', () => {
  it('mode AU : item dans au', () => {
    const s = buildSnapshot(auInput);
    expect(s.au).toEqual(['Coin calme']);
    expect(s.parEleve['Emilie D.']).toEqual([]);
  });
  it('mode AR : item dans les AR de l’élève', () => {
    const s = buildSnapshot(arInput);
    expect(s.au).toEqual([]);
    expect(s.parEleve['Emilie D.']).toEqual(['Coin calme']);
  });
});

describe('profilDiffActif — dispositifs', () => {
  it('mode AU : auCommuns', () => {
    const p = computeProfilDiffActif(auInput);
    expect(p.auCommuns.map((a) => a.libelle)).toEqual(['Coin calme']);
    expect(p.arParEleve).toEqual([]);
  });
  it('mode AR : arParEleve', () => {
    const p = computeProfilDiffActif(arInput);
    expect(p.auCommuns).toEqual([]);
    expect(p.arParEleve).toEqual([{ eleve: 'Emilie D.', amenagements: ['Coin calme'] }]);
  });
});

describe('profilClasse (contrat DiffActif) — dispositifs', () => {
  const classe = { niveau: '5e', created_at: '2026-08-20T08:00:00Z' };
  it('mode AU : transmis comme AU avec son code', () => {
    const p = computeProfilClasse({ ...auInput, classe }, { now: new Date('2026-10-02T08:00:00Z') });
    expect(p.au.map((x) => x.code)).toEqual(['ar_coin_calme']);
    expect(p.ar).toEqual([]);
  });
  it('mode AU : une sélection élève résiduelle est non transmise et exclue de ar', () => {
    const p = computeProfilClasse({ ...auInput, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }], classe }, { now: new Date('2026-10-02T08:00:00Z') });
    expect(p.elements_non_transmis_present).toBe(true);
    expect(p.ar).toEqual([]);
  });
  it('mode AR : transmis comme AR avec sa tranche d’effectif', () => {
    const p = computeProfilClasse({ ...arInput, classe }, { now: new Date('2026-10-02T08:00:00Z') });
    expect(p.au).toEqual([]);
    expect(p.ar.map((x) => [x.code, x.effectif])).toEqual([['ar_coin_calme', '1-2']]);
  });
});
