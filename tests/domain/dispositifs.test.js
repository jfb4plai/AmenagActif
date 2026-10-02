import { describe, it, expect } from 'vitest';
import {
  estModeAU, chapitreEnModeAU, typeEffectif, appliquerTypesEffectifs,
  selectionsActives, dispositifsAU, bloqueBasculeDispositif, messageConfirmationRetraitAU,
} from '../../src/domain/dispositifs.js';

const chapitres = [
  { id: 'c1', ordre: 1, titre: '1. SUPPORTS', est_dispositif: false },
  { id: 'd1', ordre: 13, titre: 'Dispositif de régulation des comportements', est_dispositif: true },
];
const amenagements = [
  { id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Mise en page', type: 'AU' },
  { id: 'a2', chapitre_id: 'c1', ordre: 2, libelle: 'Doubler les espaces', type: 'AR' },
  { id: 'x2', chapitre_id: 'd1', ordre: 2, libelle: 'Pictogramme de pause', type: 'AR' },
  { id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR' },
];
const modeAU = [{ chapitre_id: 'd1', pour_toute_la_classe: true }];
const modeAR = [{ chapitre_id: 'd1', pour_toute_la_classe: false }];

describe('estModeAU / chapitreEnModeAU', () => {
  it('vrai seulement pour une ligne pour_toute_la_classe = true', () => {
    expect(estModeAU('d1', modeAU)).toBe(true);
    expect(estModeAU('d1', modeAR)).toBe(false);
    expect(estModeAU('d1', [])).toBe(false);
    expect(estModeAU('d1')).toBe(false);
  });
  it("ignore une ligne de mode sur un chapitre qui n'est pas un dispositif", () => {
    expect(chapitreEnModeAU(chapitres[0], [{ chapitre_id: 'c1', pour_toute_la_classe: true }])).toBe(false);
    expect(chapitreEnModeAU(chapitres[1], modeAU)).toBe(true);
  });
});

describe('typeEffectif', () => {
  it('un item de dispositif est AU en mode AU, AR sinon', () => {
    expect(typeEffectif(amenagements[3], chapitres, modeAU)).toBe('AU');
    expect(typeEffectif(amenagements[3], chapitres, modeAR)).toBe('AR');
    expect(typeEffectif(amenagements[3], chapitres, [])).toBe('AR');
  });
  it('un item ordinaire garde son type', () => {
    expect(typeEffectif(amenagements[0], chapitres, modeAU)).toBe('AU');
    expect(typeEffectif(amenagements[1], chapitres, modeAU)).toBe('AR');
  });
  it('un aménagement inconnu renvoie undefined sans lever', () => {
    expect(typeEffectif(undefined, chapitres, modeAU)).toBeUndefined();
  });
});

describe('appliquerTypesEffectifs', () => {
  it("renvoie l'entrée telle quelle sans mode", () => {
    const input = { amenagements, chapitres };
    expect(appliquerTypesEffectifs(input)).toBe(input);
  });
  it('réécrit le type des items de dispositif en mode AU, sans muter la source', () => {
    const out = appliquerTypesEffectifs({ amenagements, chapitres, modesDispositifs: modeAU });
    expect(out.amenagements.find((a) => a.id === 'x1').type).toBe('AU');
    expect(out.amenagements.find((a) => a.id === 'a2').type).toBe('AR');
    expect(amenagements.find((a) => a.id === 'x1').type).toBe('AR');
  });
});

describe('selectionsActives', () => {
  const sels = [
    { eleve_id: 'e1', amenagement_id: 'x1' },
    { eleve_id: 'e1', amenagement_id: 'a2' },
  ];
  it('écarte les sélections élève sur un dispositif passé en AU', () => {
    expect(selectionsActives(sels, amenagements, chapitres, modeAU)).toEqual([{ eleve_id: 'e1', amenagement_id: 'a2' }]);
  });
  it('garde tout en mode AR ou sans mode', () => {
    expect(selectionsActives(sels, amenagements, chapitres, modeAR)).toHaveLength(2);
    expect(selectionsActives(sels, amenagements, chapitres)).toHaveLength(2);
  });
});

describe('dispositifsAU', () => {
  const auClasse = [{ amenagement_id: 'x2' }, { amenagement_id: 'x1' }, { amenagement_id: 'a1' }];
  it('un bloc par dispositif en mode AU, items triés par ordre, AU ordinaires exclus', () => {
    expect(dispositifsAU({ amenagements, chapitres, auClasse, modes: modeAU })).toEqual([
      { titre: 'Dispositif de régulation des comportements', items: ['Coin calme', 'Pictogramme de pause'] },
    ]);
  });
  it("un item de type AU rangé dans un chapitre dispositif n'est pas dupliqué dans le bloc", () => {
    const amgts = [...amenagements, { id: 'x3', chapitre_id: 'd1', ordre: 3, libelle: 'AU rangé ici', type: 'AU' }];
    const blocs = dispositifsAU({ amenagements: amgts, chapitres, auClasse: [...auClasse, { amenagement_id: 'x3' }], modes: modeAU });
    expect(blocs).toEqual([
      { titre: 'Dispositif de régulation des comportements', items: ['Coin calme', 'Pictogramme de pause'] },
    ]);
  });
  it('rien en mode AR ou sans mode, ou sans item coché', () => {
    expect(dispositifsAU({ amenagements, chapitres, auClasse, modes: modeAR })).toEqual([]);
    expect(dispositifsAU({ amenagements, chapitres, auClasse, modes: [] })).toEqual([]);
    expect(dispositifsAU({ amenagements, chapitres, auClasse: [], modes: modeAU })).toEqual([]);
  });
});

describe('bloqueBasculeDispositif', () => {
  const eleveIds = new Set(['e1', 'e2']);
  it('vers AU : refuse si des élèves ont des items cochés, en comptant les élèves distincts', () => {
    const sels = [
      { eleve_id: 'e1', amenagement_id: 'x1' }, { eleve_id: 'e1', amenagement_id: 'x2' }, { eleve_id: 'e2', amenagement_id: 'x1' },
    ];
    const msg = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: sels, auClasse: [] });
    expect(msg).toMatch(/2 élèves ont déjà/);
  });
  it('vers AU : accord au singulier, et élèves hors classe ignorés', () => {
    const un = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }], auClasse: [] });
    expect(un).toMatch(/1 élève a déjà/);
    const horsClasse = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [{ eleve_id: 'zz', amenagement_id: 'x1' }], auClasse: [] });
    expect(horsClasse).toBeNull();
  });
  it("vers AU : ignore les sélections d'un autre chapitre", () => {
    expect(bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'a2' }], auClasse: [] })).toBeNull();
  });
  it('vers AU : un aménagement libre seul bloque, avec accord au singulier et au pluriel', () => {
    const base = { vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [], auClasse: [] };
    const un = bloqueBasculeDispositif({ ...base, libres: [{ eleve_id: 'e1', chapitre_id: 'd1' }] });
    expect(un).toMatch(/1 aménagement libre ajouté pour des élèves de ce dispositif\. Supprimez-le d'abord/);
    const deux = bloqueBasculeDispositif({ ...base, libres: [{ eleve_id: 'e1', chapitre_id: 'd1' }, { eleve_id: 'e2', chapitre_id: 'd1' }] });
    expect(deux).toMatch(/2 aménagements libres ajoutés pour des élèves de ce dispositif\. Supprimez-les d'abord/);
  });
  it("vers AU : un libre d'un élève hors classe ou d'un autre chapitre ne bloque pas", () => {
    const base = { vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [], auClasse: [] };
    expect(bloqueBasculeDispositif({ ...base, libres: [{ eleve_id: 'zz', chapitre_id: 'd1' }, { eleve_id: 'e1', chapitre_id: 'autre' }] })).toBeNull();
  });
  it('vers AU : sélection et libre ensemble, le message mentionne les deux', () => {
    const msg = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds,
      selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }], auClasse: [], libres: [{ eleve_id: 'e2', chapitre_id: 'd1' }] });
    expect(msg).toMatch(/1 élève a déjà/);
    expect(msg).toMatch(/1 aménagement libre ajouté/);
  });
  it('vers AR : refuse si des items sont cochés pour la classe', () => {
    const msg = bloqueBasculeDispositif({ vers: 'AR', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [], auClasse: [{ amenagement_id: 'x1' }, { amenagement_id: 'a1' }] });
    expect(msg).toMatch(/1 aménagement/);
  });
  it('vers AR : accord si rien de coché pour la classe sur ce dispositif', () => {
    expect(bloqueBasculeDispositif({ vers: 'AR', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [], auClasse: [{ amenagement_id: 'a1' }] })).toBeNull();
  });
});

describe('messageConfirmationRetraitAU', () => {
  it("nomme l'aménagement et explique les deux conséquences", () => {
    const m = messageConfirmationRetraitAU('Coin calme');
    expect(m).toContain('« Coin calme »');
    expect(m).toMatch(/fiche de la classe/);
    expect(m).not.toContain('prochain envoi');
    expect(m).toMatch(/DiffActif/);
  });
});
