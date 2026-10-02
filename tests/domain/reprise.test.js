import { describe, it, expect } from 'vitest';
import {
  groupesSource, choixDeBase, choixEffectifs, poserException, versChoix, versValeur,
  synthese, operations, marquages, aConfirmerParClasse, anneeSourceParDefaut,
} from '../../src/domain/reprise.js';

const classes = [{ id: 'c3b', nom: '3B' }, { id: 'c3a', nom: '3A' }];
const eleves = [
  { id: 'e1', classe_id: 'c3a', prenom: 'Zoé', initiale_nom: 'D', devenir: null },
  { id: 'e2', classe_id: 'c3a', prenom: 'Amir', initiale_nom: 'K', devenir: null },
  { id: 'e3', classe_id: 'c3b', prenom: 'Lina', initiale_nom: 'M', devenir: null },
];

describe('groupesSource', () => {
  it('trie les classes puis les élèves par prénom', () => {
    const g = groupesSource(classes, eleves);
    expect(g.map((x) => x.classe.nom)).toEqual(['3A', '3B']);
    expect(g[0].eleves.map((e) => e.prenom)).toEqual(['Amir', 'Zoé']);
  });
});

describe('versChoix / versValeur', () => {
  it('aller-retour pour chaque type', () => {
    for (const v of ['none', 'transfert', 'termine', 'classe:abc']) {
      expect(versValeur(versChoix(v))).toBe(v);
    }
  });
  it('valeur inconnue → none', () => {
    expect(versChoix('n-importe-quoi')).toEqual({ type: 'none' });
  });
});

describe('choixDeBase / choixEffectifs', () => {
  const mapping = { c3a: 'n4a', c3b: '' };

  it('le mapping du groupe fournit la classe par défaut', () => {
    expect(choixDeBase(eleves[0], mapping)).toEqual({ type: 'classe', classeId: 'n4a' });
  });
  it('groupe sans correspondance → none (non traité)', () => {
    expect(choixDeBase(eleves[2], mapping)).toEqual({ type: 'none' });
  });
  it('un devenir déjà enregistré prime sur le mapping', () => {
    expect(choixDeBase({ ...eleves[0], devenir: 'transfert' }, mapping)).toEqual({ type: 'transfert' });
  });
  it('exception > base ; élèves déjà repris exclus', () => {
    const c = choixEffectifs({
      eleves, mapping, dejaRepris: ['e2'],
      exceptions: { e1: { type: 'classe', classeId: 'n4b' } },
    });
    expect(c.e1).toEqual({ type: 'classe', classeId: 'n4b' });
    expect(c.e2).toBeUndefined();
    expect(c.e3).toEqual({ type: 'none' });
  });
});

describe('poserException', () => {
  const mapping = { c3a: 'n4a' };
  it('ajoute une exception quand le choix diffère de la base', () => {
    const r = poserException({}, eleves[0], { type: 'classe', classeId: 'n4b' }, mapping);
    expect(r.e1).toEqual({ type: 'classe', classeId: 'n4b' });
  });
  it('retire l\'exception quand le choix redevient la base', () => {
    const r = poserException({ e1: { type: 'termine' } }, eleves[0], { type: 'classe', classeId: 'n4a' }, mapping);
    expect(r.e1).toBeUndefined();
  });
  it('ne mute pas l\'objet d\'origine', () => {
    const avant = { e1: { type: 'termine' } };
    poserException(avant, eleves[0], { type: 'none' }, mapping);
    expect(avant).toEqual({ e1: { type: 'termine' } });
  });
});

describe('synthese / operations / marquages', () => {
  const choix = {
    e1: { type: 'classe', classeId: 'n4a' },
    e2: { type: 'transfert' },
    e3: { type: 'none' },
  };
  it('compte chaque type + les déjà repris', () => {
    expect(synthese(choix, ['x', 'y'])).toEqual({ classe: 1, transfert: 1, termine: 0, none: 1, dejaRepris: 2 });
  });
  it('operations : uniquement les reprises en classe', () => {
    expect(operations(choix)).toEqual([{ sourceId: 'e1', classeId: 'n4a' }]);
  });
  it('marquages : écrit le devenir voulu quand il diffère de la base', () => {
    expect(marquages(choix, eleves)).toEqual([{ id: 'e2', devenir: 'transfert' }]);
  });
  it('marquages : repasser un élève en « non traité » efface son devenir', () => {
    const els = [{ ...eleves[0], devenir: 'transfert' }];
    expect(marquages({ e1: { type: 'none' } }, els)).toEqual([{ id: 'e1', devenir: null }]);
  });
  it('marquages : rien si déjà à jour', () => {
    const els = [{ ...eleves[1], devenir: 'transfert' }];
    expect(marquages({ e2: { type: 'transfert' } }, els)).toEqual([]);
  });
});

describe('aConfirmerParClasse', () => {
  const els = [
    { id: 'e1', prenom: 'Zoé', initiale_nom: 'D' },
    { id: 'e2', prenom: 'Amir', initiale_nom: 'K' },
  ];
  it('compte AR, aménagements libres et AU à confirmer, par élève', () => {
    const r = aConfirmerParClasse({
      eleves: els,
      selectionsAR: [
        { eleve_id: 'e1', a_confirmer: true }, { eleve_id: 'e1', a_confirmer: true },
        { eleve_id: 'e2', a_confirmer: false }, { eleve_id: 'zz', a_confirmer: true },
      ],
      libres: [{ eleve_id: 'e1', a_confirmer: true }],
      auClasse: [{ a_confirmer: true }, { a_confirmer: false }],
    });
    expect(r.parEleve).toEqual([{ eleve: els[0], n: 3 }]);
    expect(r.nAU).toBe(1);
    expect(r.total).toBe(4);
  });
  it('rien à confirmer → total 0', () => {
    const r = aConfirmerParClasse({ eleves: els, selectionsAR: [], libres: [], auClasse: [] });
    expect(r).toEqual({ parEleve: [], nAU: 0, total: 0 });
  });
});

describe('anneeSourceParDefaut', () => {
  const annees = [
    { id: 'a27', libelle: '2027-2028' }, { id: 'a26', libelle: '2026-2027' }, { id: 'a25', libelle: '2025-2026' },
  ];
  it('prend l\'année juste avant la cible', () => {
    expect(anneeSourceParDefaut(annees, 'a27').id).toBe('a26');
  });
  it('null s\'il n\'y a pas d\'année antérieure ou si la cible est inconnue', () => {
    expect(anneeSourceParDefaut(annees, 'a25')).toBeNull();
    expect(anneeSourceParDefaut(annees, 'nope')).toBeNull();
  });
});
