import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const catalogue = JSON.parse(readFileSync('supabase/seed/catalogue.json', 'utf8'));
const codes = JSON.parse(readFileSync('supabase/seed/codes_catalogue.json', 'utf8'));
const migration = readFileSync('supabase/migrations/20260924c_amenagactif_codes_catalogue.sql', 'utf8');

const CHAPITRES_CODES = [1, 5, 7, 9];
const FORMAT = /^ar_[a-z0-9]+(_[a-z0-9]+)+$/;

describe('codes stables du catalogue (chapitres 1, 5, 7, 9)', () => {
  it('chaque libellé de ces chapitres a un code dans le catalogue de référence', () => {
    const sansCode = [];
    for (const ordre of CHAPITRES_CODES) {
      const chap = catalogue.find((c) => c.ordre === ordre);
      const mapping = codes.chapitres.find((c) => c.ordre === ordre);
      expect(chap, `chapitre ${ordre} présent dans catalogue.json`).toBeTruthy();
      expect(mapping, `chapitre ${ordre} présent dans codes_catalogue.json`).toBeTruthy();
      for (const item of chap.items) {
        const m = mapping.items.find((i) => i.ordre === item.ordre);
        if (!m?.code) sansCode.push(`ch${ordre}#${item.ordre} ${item.libelle}`);
      }
    }
    expect(sansCode).toEqual([]);
  });

  it('aucun code orphelin : chaque code correspond à un aménagement du catalogue', () => {
    for (const m of codes.chapitres) {
      const chap = catalogue.find((c) => c.ordre === m.ordre);
      for (const i of m.items) expect(chap.items.some((x) => x.ordre === i.ordre), i.code).toBe(true);
    }
  });

  it('codes uniques, au bon format, préfixés par le code de leur chapitre', () => {
    const tous = codes.chapitres.flatMap((c) => c.items.map((i) => ({ c, code: i.code })));
    expect(new Set(tous.map((t) => t.code)).size).toBe(tous.length);
    for (const { c, code } of tous) {
      expect(code).toMatch(FORMAT);
      expect(code.startsWith(`ar_${c.code}_`)).toBe(true);
    }
  });

  it('Arial 14 existe comme AR du chapitre 1', () => {
    const chap = catalogue.find((c) => c.ordre === 1);
    const m = codes.chapitres.find((c) => c.ordre === 1).items.find((i) => i.code === 'ar_supports_arial_14');
    expect(m).toBeTruthy();
    const item = chap.items.find((i) => i.ordre === m.ordre);
    expect(item.type).toBe('AR');
    expect(item.libelle).toMatch(/Arial 14/);
  });

  it('la migration contient tous les codes (pas de dérive entre JSON et SQL)', () => {
    for (const m of codes.chapitres) {
      expect(migration).toContain(`'${m.code}'`);
      for (const i of m.items) expect(migration).toContain(`'${i.code}'`);
    }
  });
});
