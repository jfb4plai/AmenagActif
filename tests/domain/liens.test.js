// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  genererSecret, hasherSecret, formeSecretValide, estFormeJwt, finAnneeScolaire, statutLien,
  peutGererEcole, ecolesGerables, plafonnerExpirationProfil, versLienPublic,
} from '../../api/_lib/liens.js';

describe('secret et empreinte', () => {
  it('secret : 43 caractères base64url, sans point, différent à chaque appel', () => {
    const a = genererSecret();
    expect(formeSecretValide(a)).toBe(true);
    expect(a).not.toContain('.');
    expect(genererSecret()).not.toBe(a);
  });
  it('hash SHA-256 hex déterministe, différent du secret', () => {
    const s = genererSecret();
    expect(hasherSecret(s)).toMatch(/^[0-9a-f]{64}$/);
    expect(hasherSecret(s)).toBe(hasherSecret(s));
    expect(hasherSecret(s)).not.toContain(s);
    expect(hasherSecret('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('forme JWT détectée par les points', () => {
    expect(estFormeJwt('a.b.c')).toBe(true);
    expect(estFormeJwt(genererSecret())).toBe(false);
  });
});

describe("fin d'année scolaire", () => {
  it('31 août de la seconde année', () => {
    expect(finAnneeScolaire('2026-2027')).toBe('2027-08-31');
    expect(finAnneeScolaire(' 2025 – 2026 ')).toBe('2026-08-31');
  });
  it('libellé illisible ou incohérent : null', () => {
    for (const l of ['', null, 'année 3', '2026-2029', '2026']) expect(finAnneeScolaire(l)).toBeNull();
  });
});

describe('statut', () => {
  const lien = { expire_le: '2027-08-31', revoque_le: null };
  it('actif le jour même de expire_le, expiré le lendemain', () => {
    expect(statutLien(lien, new Date('2027-08-31T10:00:00Z'))).toBe('actif');
    expect(statutLien(lien, new Date('2027-09-01T10:00:00Z'))).toBe('expire');
  });
  it("la révocation gagne, avant comme après l'échéance", () => {
    const r = { ...lien, revoque_le: '2026-10-01T00:00:00Z' };
    expect(statutLien(r, new Date('2026-10-02T00:00:00Z'))).toBe('revoque');
    expect(statutLien(r, new Date('2028-01-01T00:00:00Z'))).toBe('revoque');
  });
});

describe('autorisation par rôle', () => {
  const ECOLE_A = 'a';
  const ECOLE_B = 'b';
  it('admin : toutes les écoles', () => {
    expect(peutGererEcole({ role: 'admin', ecole_id: null }, [], ECOLE_B)).toBe(true);
    expect(ecolesGerables({ role: 'admin' }, [])).toBeNull();
  });
  it('référent / direction : leurs écoles seulement (legacy ou liaison)', () => {
    expect(peutGererEcole({ role: 'referent_plai', ecole_id: ECOLE_A }, [], ECOLE_A)).toBe(true);
    expect(peutGererEcole({ role: 'direction', ecole_id: null }, [ECOLE_A], ECOLE_A)).toBe(true);
    expect(peutGererEcole({ role: 'referent_plai', ecole_id: ECOLE_A }, [], ECOLE_B)).toBe(false);
  });
  it('agent_plai, rôle inconnu, absence de profil : refusés', () => {
    expect(peutGererEcole({ role: 'agent_plai', ecole_id: ECOLE_A }, [ECOLE_A], ECOLE_A)).toBe(false);
    expect(peutGererEcole({ role: 'enseignant', ecole_id: ECOLE_A }, [], ECOLE_A)).toBe(false);
    expect(peutGererEcole(null, [], ECOLE_A)).toBe(false);
    expect(ecolesGerables({ role: 'agent_plai', ecole_id: ECOLE_A }, [])).toEqual([]);
  });
});

describe('plafond du jeton de profil', () => {
  const now = Date.parse('2027-08-20T10:00:00Z');
  it('30 jours si le lien dure plus longtemps', () => {
    expect(plafonnerExpirationProfil(now, 30, '2027-12-31')).toBe(Math.floor(now / 1000) + 30 * 86400);
  });
  it("plafonné à la fin de journée d'expire_le", () => {
    expect(plafonnerExpirationProfil(now, 30, '2027-08-31')).toBe(Math.floor(Date.parse('2027-08-31T23:59:59Z') / 1000));
  });
});

describe('projection publique', () => {
  it('ne contient jamais token_hash', () => {
    const p = versLienPublic(
      { id: 'i', ecole_id: 'e', token_hash: 'SECRETHASH', destinataire: 'Mme Dupont', expire_le: '2099-08-31', cree_le: 'x', nb_ouvertures: 2 },
      { classes: ['3LA'] },
    );
    expect(JSON.stringify(p)).not.toContain('SECRETHASH');
    expect(p).not.toHaveProperty('token_hash');
    expect(p.statut).toBe('actif');
  });
});
