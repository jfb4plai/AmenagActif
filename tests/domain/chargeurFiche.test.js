import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chargerDonneesClasseAvec, COLONNES_ELEVES, COLONNES_AMENAGEMENTS } from '../../src/domain/chargeurFiche.js';

/** Faux client Supabase : enregistre (table, colonnes) et renvoie des données de fixture. */
function fauxDb(tables, erreurs = {}) {
  const selects = [];
  const from = (table) => {
    const res = () => (erreurs[table] ? { data: null, error: { message: 'boom ' + table } } : { data: tables[table] ?? [], error: null });
    const q = {
      select(cols) { selects.push({ table, cols }); return q; },
      eq() { return q; },
      in() { return q; },
      order() { return q; },
      single() { const r = res(); return Promise.resolve(r.error ? r : { data: r.data[0] ?? null, error: null }); },
      then(ok, ko) { return Promise.resolve(res()).then(ok, ko); },
    };
    return q;
  };
  return { from, selects };
}

const tables = {
  ar_classes: [{ id: 'c1', nom: '3A', ecole_id: 'e1', ar_ecoles: { nom: 'E' }, ar_annees: { libelle: '2026-2027' } }],
  ar_eleves: [{ id: 'el1', classe_id: 'c1', prenom: 'X', statut: 'IPT' }],
  ar_profils_acces_ecoles: [{ user_id: 'multi' }],
  ar_profils_acces: [
    { user_id: 'legacy', nom: 'Legacy', role: 'direction', ecole_id: 'e1' },
    { user_id: 'multi', nom: 'Multi', role: 'referent_plai', ecole_id: 'autre' },
    { user_id: 'ailleurs', nom: 'Ailleurs', role: 'direction', ecole_id: 'autre' },
  ],
};

describe('chargeur de fiche partagé', () => {
  it('sélectionne le statut des élèves (I1)', async () => {
    const db = fauxDb(tables);
    await chargerDonneesClasseAvec(db, 'c1');
    expect(db.selects.find((s) => s.table === 'ar_eleves').cols).toContain('statut');
    expect(COLONNES_ELEVES).toContain('statut');
  });

  it('sélectionne code ET partage_profil du catalogue, côté client comme côté serveur', async () => {
    const db = fauxDb(tables);
    await chargerDonneesClasseAvec(db, 'c1');
    const cols = db.selects.find((s) => s.table === 'ar_amenagements').cols;
    for (const c of ['code', 'partage_profil']) {
      expect(cols).toContain(c);
      expect(COLONNES_AMENAGEMENTS).toContain(c);
    }
    // Le client (useFicheClasse) et le serveur (ficheData) passent tous deux par ce chargeur unique :
    // aucune autre lecture de ar_amenagements ne doit alimenter la projection profil.
    for (const f of ['api/_lib/ficheData.js', 'src/hooks/useFicheClasse.js']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/from\('ar_amenagements'\)/);
    }
  });

  it('inclut les référents multi-écoles et exclut les autres écoles (I2)', async () => {
    const d = await chargerDonneesClasseAvec(fauxDb(tables), 'c1');
    expect(d.referents.map((r) => r.nom).sort()).toEqual(['Legacy', 'Multi']);
  });

  it("lève l'erreur au lieu de produire une fiche partielle (I3)", async () => {
    const toutes = ['ar_classes', 'ar_eleves', 'ar_amenagements', 'ar_chapitres', 'ar_amenagements_classe', 'ar_selections', 'ar_amenagements_libres', 'ar_profils_acces_ecoles', 'ar_profils_acces'];
    for (const t of toutes) {
      await expect(chargerDonneesClasseAvec(fauxDb(tables, { [t]: true }), 'c1')).rejects.toThrow(/boom|impossible/);
    }
  });

  it('serveur et client délèguent au même chargeur (anti-régression de divergence)', () => {
    const serveur = readFileSync('api/_lib/ficheData.js', 'utf8');
    const client = readFileSync('src/hooks/useFicheClasse.js', 'utf8');
    expect(serveur).toContain('chargerDonneesClasseAvec');
    expect(client).toContain('chargerDonneesClasseAvec');
    for (const src of [serveur, client]) expect(src).not.toMatch(/\.select\('id, classe_id, prenom/);
  });
});
