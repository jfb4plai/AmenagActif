import { describe, it, expect } from 'vitest';
import { filtrerMembres, grouperMembres, compteurMembres } from '../../src/domain/membres.js';

const m = (o) => ({ userId: o.userId, email: '', nom: '', role: 'referent_plai', ecoleId: null, ecoleIds: [], niveaux: [], ...o });
const helene = m({ userId: 'u1', email: 'dubois@ecole.be', nom: 'Hélène Dubois', role: 'direction' });
const paul = m({ userId: 'u2', email: 'paul@ecole.be', nom: 'Paul Martin', role: 'referent_plai' });
const tous = [helene, paul];

describe('filtrerMembres', () => {
  it('trouve par nom', () => expect(filtrerMembres(tous, { texte: 'dubois' })).toEqual([helene]));
  it('ignore les accents', () => expect(filtrerMembres(tous, { texte: 'helene' })).toEqual([helene]));
  it('ignore la casse sur l\'e-mail', () => expect(filtrerMembres(tous, { texte: 'DUBOIS@ECOLE.BE' })).toEqual([helene]));
  it('filtre par rôle', () => expect(filtrerMembres(tous, { role: 'direction' })).toEqual([helene]));
  it('combine texte et rôle', () => {
    expect(filtrerMembres(tous, { texte: 'paul', role: 'direction' })).toEqual([]);
    expect(filtrerMembres(tous, { texte: 'paul', role: 'referent_plai' })).toEqual([paul]);
  });
  it('texte vide ou espaces = tous', () => {
    expect(filtrerMembres(tous, { texte: '  ' })).toEqual(tous);
    expect(filtrerMembres(tous)).toEqual(tous);
  });
  it('ne modifie pas l\'entrée', () => {
    const copie = [...tous];
    filtrerMembres(tous, { texte: 'paul' });
    expect(tous).toEqual(copie);
  });
});

describe('grouperMembres', () => {
  const ecoles = [{ id: 'e1', nom: 'A' }, { id: 'e2', nom: 'B' }];
  const adminRattache = m({ userId: 'a1', role: 'admin', ecoleId: 'e1' });
  const adminLibre = m({ userId: 'a2', role: 'admin' });
  const refDeux = m({ userId: 'r1', ecoleIds: ['e1', 'e2'] });
  const orphelin = m({ userId: 'o1' });
  const g = grouperMembres([adminRattache, adminLibre, refDeux, orphelin], ecoles);

  it('admins', () => expect(g.admins.map((x) => x.userId)).toEqual(['a1', 'a2']));
  it('admin rattaché aussi dans son école', () => {
    expect(g.parEcole[0].ecole).toBe(ecoles[0]);
    expect(g.parEcole[0].membres.map((x) => x.userId)).toEqual(['a1', 'r1']);
  });
  it('référent à deux écoles dans les deux', () => expect(g.parEcole[1].membres.map((x) => x.userId)).toEqual(['r1']));
  it('sansEcole : non admin sans école seulement', () => expect(g.sansEcole.map((x) => x.userId)).toEqual(['o1']));
});

describe('compteurMembres', () => {
  it('singulier', () => expect(compteurMembres(1, 23)).toBe('1 compte affiché sur 23'));
  it('pluriel', () => expect(compteurMembres(5, 23)).toBe('5 comptes affichés sur 23'));
  it('zéro', () => expect(compteurMembres(0, 23)).toBe('0 compte affiché sur 23'));
});
