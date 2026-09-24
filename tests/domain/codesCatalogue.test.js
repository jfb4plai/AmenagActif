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

  it('« Rédiger le cours en Arial 14 » (déjà en production) porte le code ar_supports_arial_14', () => {
    const chap = catalogue.find((c) => c.ordre === 1);
    const m = codes.chapitres.find((c) => c.ordre === 1).items.find((i) => i.code === 'ar_supports_arial_14');
    expect(m).toBeTruthy();
    const item = chap.items.find((i) => i.ordre === m.ordre);
    expect(item.type).toBe('AR');
    expect(item.libelle).toBe('Rédiger le cours en Arial 14');
  });

  it('la migration ne crée aucun aménagement (pas de doublon avec la production)', () => {
    expect(migration).not.toMatch(/insert into ar_amenagements/i);
  });

  it('45 aménagements codés, comme la garde de la migration', () => {
    expect(codes.chapitres.flatMap((c) => c.items).length).toBe(45);
    expect(migration).toContain('<> 45');
  });

  it('la migration contient tous les codes (pas de dérive entre JSON et SQL)', () => {
    for (const m of codes.chapitres) {
      expect(migration).toContain(`'${m.code}'`);
      for (const i of m.items) expect(migration).toContain(`'${i.code}'`);
    }
  });
});

describe('codes automatiques et partage_profil (migration 20260924e, écrans)', () => {
  const e = readFileSync('supabase/migrations/20260924e_amenagactif_partage_profil.sql', 'utf8');
  const hook = readFileSync('src/hooks/useAdmin.js', 'utf8');

  it('la migration pose les deux déclencheurs BEFORE INSERT et le drapeau avec rattrapage unique', () => {
    expect(e).toMatch(/create trigger ar_chapitres_code_auto before insert on ar_chapitres/);
    expect(e).toMatch(/create trigger ar_amenagements_code_auto before insert on ar_amenagements/);
    expect(e).toMatch(/partage_profil boolean not null default true/);
    // le rattrapage false est dans le bloc conditionnel « colonne absente »
    const bloc = e.slice(e.indexOf('if not exists ('), e.indexOf('end if;', e.indexOf('if not exists (')));
    expect(bloc).toMatch(/set partage_profil = false/);
    expect(bloc).toMatch(/ordre not in \(1, 5, 7, 9\)/);
  });

  it('le catalogue admin ne transmet jamais code dans un UPDATE ni dans un INSERT', () => {
    const maj = hook.slice(hook.indexOf('const majAmenagement'), hook.indexOf('const ajouterAmenagement'));
    expect(maj).not.toMatch(/patch\.code|code:/);
    const ajout = hook.slice(hook.indexOf('const ajouterAmenagement'), hook.indexOf('const ajouterChapitre'));
    expect(ajout).not.toMatch(/\bcode\b\s*[:,}]/);
    expect(hook).toContain('partage_profil');
  });
});
