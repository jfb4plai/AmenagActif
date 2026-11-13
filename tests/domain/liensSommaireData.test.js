// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { fakeDb } from './fakeDb.js';
import { creerLien, definirClasses, chargerSommaire, ErreurLien } from '../../api/_lib/liensData.js';
import { modeValide, versLienPublic } from '../../api/_lib/liens.js';

const NOW = new Date('2098-09-15T10:00:00Z');
const cid = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;

function monde(nbClasses = 22) {
  return {
    ar_annees: [{ id: 'an1', libelle: '2098-2099' }],
    ar_ecoles: [{ id: 'ec1', nom: 'Athénée A', implantation: '4012', implantation_nom: 'Site Centre' }],
    ar_classes: Array.from({ length: nbClasses }, (_, i) => ({ id: cid(i + 1), nom: `C${i + 1}`, niveau: '3e', ecole_id: 'ec1', annee_id: 'an1' })),
    ar_liens: [],
    ar_liens_classes: [],
  };
}
const ids = (n) => Array.from({ length: n }, (_, i) => cid(i + 1));
const base = { userId: 'u1', destinataire: 'Mme Dupont', secret: 's'.repeat(43), now: NOW };
const nouvelleDb = (tables, opts = {}) => fakeDb(tables, { autoIncrement: { ar_liens: 'numero' }, ...opts });

describe('creerLien : modes', () => {
  it('sommaire de 22 classes accepté : mode, numéro, nom_groupe nul, 22 lignes ar_liens_classes', async () => {
    const t = monde();
    const r = await creerLien(nouvelleDb(t), { ...base, classeIds: ids(22), nomGroupe: 'Ignoré', mode: 'sommaire' });
    expect(r.numero).toBe(1);
    expect(t.ar_liens[0]).toMatchObject({ mode: 'sommaire', nom_groupe: null, numero: 1 });
    expect(t.ar_liens_classes).toHaveLength(22);
  });

  it('fusion de 11 classes refusée (ErreurLien 400, "1 à 10 classes")', async () => {
    const err = await creerLien(nouvelleDb(monde()), { ...base, classeIds: ids(11) }).catch((e) => e);
    expect(err).toBeInstanceOf(ErreurLien);
    expect(err.statut).toBe(400);
    expect(err.message).toContain('1 à 10 classes');
  });

  it('sommaire de 101 classes refusé (400)', async () => {
    const err = await creerLien(nouvelleDb(monde(101)), { ...base, classeIds: ids(101), mode: 'sommaire' }).catch((e) => e);
    expect(err).toBeInstanceOf(ErreurLien);
    expect(err.statut).toBe(400);
  });

  it('fusion par défaut : mode fusion inséré, nom_groupe conservé', async () => {
    const t = monde();
    await creerLien(nouvelleDb(t), { ...base, classeIds: ids(2), nomGroupe: 'Groupe A' });
    expect(t.ar_liens[0]).toMatchObject({ mode: 'fusion', nom_groupe: 'Groupe A' });
  });

  it('deux créations successives donnent des numéros croissants', async () => {
    const db = nouvelleDb(monde());
    const a = await creerLien(db, { ...base, classeIds: ids(1), mode: 'sommaire' });
    const b = await creerLien(db, { ...base, secret: 'z'.repeat(43), classeIds: ids(1), mode: 'sommaire' });
    expect([a.numero, b.numero]).toEqual([1, 2]);
  });
});

describe('modeValide', () => {
  it('undefined → fusion, sommaire → sommaire, inconnu → null', () => {
    expect(modeValide(undefined)).toBe('fusion');
    expect(modeValide('sommaire')).toBe('sommaire');
    expect(modeValide('fusion')).toBe('fusion');
    expect(modeValide('x')).toBeNull();
  });
});

describe('definirClasses', () => {
  it('appelle la fonction SQL avec p_lien et p_classes', async () => {
    const db = fakeDb({});
    await definirClasses(db, 'L1', ['a', 'b']);
    expect(db.journal.rpc).toEqual([{ fn: 'ar_lien_definir_classes', args: { p_lien: 'L1', p_classes: ['a', 'b'] } }]);
  });

  it('une erreur P0001 devient ErreurLien 400 avec son message', async () => {
    const db = fakeDb({}, { rpc: () => ({ data: null, error: { code: 'P0001', message: 'Lien introuvable.' } }) });
    const err = await definirClasses(db, 'L1', ['a']).catch((e) => e);
    expect(err).toBeInstanceOf(ErreurLien);
    expect(err.statut).toBe(400);
    expect(err.message).toBe('Lien introuvable.');
  });

  it('une autre erreur est relancée telle quelle', async () => {
    const autre = { code: '42501', message: 'permission denied' };
    const db = fakeDb({}, { rpc: () => ({ data: null, error: autre }) });
    const err = await definirClasses(db, 'L1', ['a']).catch((e) => e);
    expect(err).toBe(autre);
  });
});

describe('chargerSommaire', () => {
  it('école, numéro, classes triées', async () => {
    const t = monde(0);
    t.ar_classes.push(
      { id: 'k2', nom: 'B', niveau: '4e', ecole_id: 'ec1', annee_id: 'an1' },
      { id: 'k1', nom: 'A', niveau: '3e', ecole_id: 'ec1', annee_id: 'an1' },
    );
    t.ar_liens_classes.push({ lien_id: 'L1', classe_id: 'k2' }, { lien_id: 'L1', classe_id: 'k1' });
    const r = await chargerSommaire(fakeDb(t), { id: 'L1', ecole_id: 'ec1', numero: 7 });
    expect(r).toEqual({
      numero: 7,
      ecole: { nom: 'Athénée A', implantation: '4012', implantation_nom: 'Site Centre' },
      classes: [{ id: 'k1', nom: 'A', niveau: '3e' }, { id: 'k2', nom: 'B', niveau: '4e' }],
    });
  });

  it("liste vide si le lien n'a plus de classes", async () => {
    const r = await chargerSommaire(fakeDb(monde(0)), { id: 'L1', ecole_id: 'ec1', numero: 3 });
    expect(r.classes).toEqual([]);
    expect(r.numero).toBe(3);
  });
});

describe('versLienPublic étendu', () => {
  it('expose mode, numero, annee_id, classe_ids et jamais token_hash', () => {
    const p = versLienPublic(
      { id: 'i', ecole_id: 'e', annee_id: 'an1', mode: 'sommaire', numero: 5, token_hash: 'SECRETHASH', destinataire: 'D', expire_le: '2099-08-31', cree_le: 'x' },
      { classes: ['3LA'], classeIds: ['c1', 'c2'] },
    );
    expect(p).toMatchObject({ mode: 'sommaire', numero: 5, annee_id: 'an1', classe_ids: ['c1', 'c2'] });
    expect(p).not.toHaveProperty('token_hash');
    expect(JSON.stringify(p)).not.toContain('SECRETHASH');
  });
});
