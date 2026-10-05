# Diffusion par enseignant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter dans AménagActif les 4 briques de diffusion d'AccèsActif — cloisonnement par enseignant, envoi d'e-mails, révocation de lien, journal d'accès — plus un écran d'historique bâti sur les snapshots existants.

**Architecture :** AménagActif expose aujourd'hui un lien JWT *par classe* (toute la fiche classe). On le remplace par un lien opaque *par enseignant*, stocké en base (`ar_liens`), résolu côté serverless, qui ne renvoie que les élèves assignés à cet enseignant via une nouvelle table `ar_enseignant_eleves`. Chaque consultation écrit une ligne dans `ar_acces_log` (sans IP). L'envoi groupé fige un `ar_fiche_snapshots`, fait tourner les jetons, écrit `ar_envois` et pousse l'e-mail via Resend (ou statut `simule` si `RESEND_API_KEY` absent). L'écran d'historique lit les snapshots figés et affiche `diffSnapshots` entre deux envois consécutifs.

**Tech Stack :** React 18 + Vite 5, `@tanstack/react-query` v5, `react-router-dom` v6, Supabase (RLS, tables `ar_`), Vercel serverless `/api/*.js` (ESM, imports `.js` explicites), `resend`, Vitest. Les tokens opaques remplacent `jose` (dépendance retirée).

---

## Contexte pour l'exécutant

**Ce qui existe déjà et sert de fondation (ne pas recréer) :**

- `ar_enseignants (id, classe_id, annee_id, nom, email, cours, created_at)` — fiche enseignant par classe. RLS lecture = `ar_can_read_ecole` via la classe, écriture = `ar_can_edit_ecole`.
- `ar_fiche_snapshots (id, classe_id, fige_le, fige_par, contenu jsonb, envoi_le)` — instantané complet AU/AR d'une classe.
- `ar_envois (id, snapshot_id, enseignant_id, destinataire_email, statut, erreur, envoye_le)` — `statut in ('en_attente','simule','envoye','erreur')`.
- `src/domain/projections/snapshot.js` : `buildSnapshot(input)` → `{ au: string[], parEleve: Record<nom,string[]> }` et `diffSnapshots(prev, next)` → `{ auAjoutes, auRetires, arAjoutes, arRetires }`. **Pur, testé, non branché à l'UI aujourd'hui.**
- `src/domain/projections/ficheClasse.js` : `computeFicheClasse(input)` → `FicheClasseVM`. `input` = `{ classe, contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres, referents }`.
- `api/_lib/ficheData.js` : `loadClasseData(classeId)` (service role) charge toutes les lignes d'une classe dans la forme attendue par `computeFicheClasse`.
- `api/_lib/supabaseAdmin.js` : `supabaseAdmin()` → client service role.
- `src/test/fixtures/sample.js` : jeu de données (classe `cl-5la`, élèves `e1` Emilie D. / `e2` Karim B. / `e3` Lea M., catalogue réduit).

**Ce qui manque et que ce plan crée :**

- Table d'assignation `ar_enseignant_eleves`, table de jetons `ar_liens`, table de journal `ar_acces_log`.
- Projection `computeFicheEnseignant` (fiche filtrée aux élèves assignés).
- Helper pur `evalueLien` (validité d'un jeton).
- APIs : `api/lien-enseignant.js` (GET consultation + POST génération), `api/envois.js`, `api/lien-revoquer.js`, `api/_lib/authEditeur.js`, `api/_lib/enseignantData.js`.
- Hooks `useEnseignants`, `useHistoriqueClasse` ; pages `EnseignantsPage`, `HistoriqueClassePage` ; composant `EnseignantsClasse`.
- Bascule de `FichePublique` sur le nouveau flux.

**À retirer :** `api/fiche-token.js`, `api/_lib/jwt.js`, la dépendance `jose`, le bouton « Copier le lien enseignant » *par classe* de `FicheClassePage.jsx` (remplacé par les liens par enseignant).

**Décision déjà prise (hors périmètre) :** pas de circuit « proposition → validation » du catalogue (AccèsActif) — AménagActif garde l'édition admin directe du catalogue.

**Rappels projet :**
- `npm run build` doit passer avant tout push (redéploiement Vercel automatique).
- `npm test` = `vitest run`. Tests de domaine uniquement aujourd'hui.
- Migrations SQL = fichiers dans `supabase/migrations/`, exécutées à la main par JF dans le SQL Editor (pas de CLI). Le plan produit le SQL ; il ne l'exécute pas.
- Tables toujours préfixées `ar_`. Projet Supabase partagé `dfoaumjleqtxjeaplnna`.
- Français partout, exemples FWB (secondaire, CE1D/CESS), pas de tiret cadratin dans les libellés produits pour l'élève.

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `supabase/migrations/20260907_amenagactif_diffusion.sql` | 3 tables + RLS + index + `unique(classe_id,email)` sur `ar_enseignants` | Créer |
| `src/domain/lienEnseignant.js` | `evalueLien(row, now)` — pur, validité d'un jeton | Créer |
| `src/domain/projections/ficheEnseignant.js` | `computeFicheEnseignant(input)` — délègue à `computeFicheClasse` sur données pré-filtrées | Créer |
| `tests/domain/lienEnseignant.test.js` | tests `evalueLien` | Créer |
| `tests/domain/ficheEnseignant.test.js` | tests `computeFicheEnseignant` | Créer |
| `api/_lib/authEditeur.js` | `requireEditeur(req)` — vérifie le JWT Supabase, renvoie `{ userId, role, ecoleId, isAdmin }` ; `peutEditerEcole(profil, ecoleId)` | Créer |
| `api/_lib/enseignantData.js` | `loadEnseignantView(token)` — résout `ar_liens`, charge enseignant + classe + élèves assignés + données de classe | Créer |
| `api/lien-enseignant.js` | `GET ?token=` (consultation + journal) ; `POST {enseignantId}` (génère/rote le jeton) | Créer |
| `api/envois.js` | `POST {classeId, enseignantIds}` — fige snapshot, rote jetons, écrit `ar_envois`, envoie Resend | Créer |
| `api/lien-revoquer.js` | `POST {enseignantId}` — `revoked_at = now()` sur les liens ouverts | Créer |
| `api/fiche-token.js` | ancien flux JWT par classe | **Supprimer** |
| `api/_lib/jwt.js` | signature JWT `jose` | **Supprimer** |
| `src/hooks/useEnseignants.js` | CRUD `ar_enseignants`, assignations, statut liens, historique envois/accès pour une classe | Créer |
| `src/hooks/useHistoriqueClasse.js` | liste des snapshots d'une classe + diffs | Créer |
| `src/components/saisie/EnseignantsClasse.jsx` | panneau par classe : ajout enseignant, assignation élèves, lien / révocation / envoi, dernier accès | Créer |
| `src/pages/EnseignantsPage.jsx` | route `/classe/:classeId/enseignants` | Créer |
| `src/pages/HistoriqueClassePage.jsx` | route `/classe/:classeId/historique` | Créer |
| `src/components/fiche/FicheClasseView.jsx` | afficher `vm.enseignant` si présent + adapter le titre | Modifier |
| `src/pages/FichePublique.jsx` | consommer `/api/lien-enseignant` | Modifier |
| `src/pages/FicheClassePage.jsx` | retirer `copierLien` par classe ; ajouter liens « Enseignants » / « Historique » | Modifier |
| `src/App.jsx` | 2 nouvelles routes | Modifier |
| `package.json` | +`resend`, -`jose` | Modifier |
| `.env.example` / `README.md` | `RESEND_API_KEY`, retrait `AMENAG_TOKEN_SECRET` | Modifier |

---

# PARTIE 1 — Cloisonnement par enseignant

## Task 1 : Migration SQL — tables d'assignation, jetons, journal

**Files:**
- Create: `supabase/migrations/20260907_amenagactif_diffusion.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- AménagActif — diffusion par enseignant : assignation élèves, jetons opaques, journal.
-- À exécuter après 20260904b_amenagactif_referents.sql, dans le SQL Editor Supabase.

begin;

-- ── Contrainte d'unicité sur les enseignants (un e-mail par classe) ──
alter table ar_enseignants
  add constraint ar_enseignants_classe_email_key unique (classe_id, email);

-- ── Assignation élève ↔ enseignant ──
create table if not exists ar_enseignant_eleves (
  enseignant_id uuid not null references ar_enseignants(id) on delete cascade,
  eleve_id      uuid not null references ar_eleves(id)      on delete cascade,
  cree_le       timestamptz not null default now(),
  primary key (enseignant_id, eleve_id)
);
create index if not exists ar_ens_eleves_eleve_idx on ar_enseignant_eleves (eleve_id);

-- ── Jetons opaques par enseignant (révocables) ──
create table if not exists ar_liens (
  id            uuid primary key default gen_random_uuid(),
  enseignant_id uuid not null references ar_enseignants(id) on delete cascade,
  token         text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at    timestamptz not null default (now() + interval '120 days'),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists ar_liens_ens_idx on ar_liens (enseignant_id, expires_at desc);

-- ── Journal d'accès : ni IP ni token en clair ──
create table if not exists ar_acces_log (
  id            uuid primary key default gen_random_uuid(),
  enseignant_id uuid references ar_enseignants(id) on delete cascade,
  consulte_le   timestamptz not null default now()
);
create index if not exists ar_acces_log_ens_idx on ar_acces_log (enseignant_id, consulte_le desc);

-- ── RLS ──
alter table ar_enseignant_eleves enable row level security;
alter table ar_liens             enable row level security;
alter table ar_acces_log         enable row level security;

-- ar_enseignant_eleves : lecture/écriture par les éditeurs de l'école de la classe.
create policy ar_ens_eleves_read on ar_enseignant_eleves for select to authenticated
  using (ar_can_read_ecole((
    select c.ecole_id from ar_enseignants en join ar_classes c on c.id = en.classe_id
    where en.id = enseignant_id)));
create policy ar_ens_eleves_write on ar_enseignant_eleves for all to authenticated
  using (ar_can_edit_ecole((
    select c.ecole_id from ar_enseignants en join ar_classes c on c.id = en.classe_id
    where en.id = enseignant_id)))
  with check (ar_can_edit_ecole((
    select c.ecole_id from ar_enseignants en join ar_classes c on c.id = en.classe_id
    where en.id = enseignant_id)));

-- ar_liens / ar_acces_log : lecture seule pour les éditeurs (l'écriture passe
-- par le service role dans les fonctions serverless, qui contourne la RLS).
create policy ar_liens_read on ar_liens for select to authenticated
  using (ar_can_read_ecole((
    select c.ecole_id from ar_enseignants en join ar_classes c on c.id = en.classe_id
    where en.id = enseignant_id)));
create policy ar_acces_log_read on ar_acces_log for select to authenticated
  using (ar_can_read_ecole((
    select c.ecole_id from ar_enseignants en join ar_classes c on c.id = en.classe_id
    where en.id = enseignant_id)));

commit;
```

- [ ] **Step 2 : Vérifier la syntaxe SQL**

Run : `node -e "const s=require('fs').readFileSync('supabase/migrations/20260907_amenagactif_diffusion.sql','utf8'); if(!/begin;[\s\S]*commit;/.test(s)) throw new Error('transaction manquante'); console.log('OK', s.length, 'caractères')"`
Expected : `OK <n> caractères`

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260907_amenagactif_diffusion.sql
git commit -m "feat(db): tables assignation enseignant, jetons opaques, journal d'acces"
```

- [ ] **Step 4 : Note pour JF (à faire figurer dans le rapport de tâche)**

> JF doit exécuter `20260907_amenagactif_diffusion.sql` dans le SQL Editor Supabase (projet `dfoaumjleqtxjeaplnna`) avant de tester le nouveau flux en `vercel dev`.

---

## Task 2 : Helper pur `evalueLien`

**Files:**
- Create: `src/domain/lienEnseignant.js`
- Test: `tests/domain/lienEnseignant.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
import { describe, it, expect } from 'vitest';
import { evalueLien } from '../../src/domain/lienEnseignant.js';

const NOW = new Date('2026-09-07T10:00:00Z');

describe('evalueLien', () => {
  it('accepte un lien valide non révoqué non expiré', () => {
    expect(evalueLien({ expires_at: '2026-12-01T00:00:00Z', revoked_at: null }, NOW))
      .toEqual({ ok: true });
  });

  it('rejette un lien révoqué', () => {
    expect(evalueLien({ expires_at: '2026-12-01T00:00:00Z', revoked_at: '2026-09-05T00:00:00Z' }, NOW))
      .toEqual({ ok: false, error: 'Lien révoqué par l’équipe PLAI.', status: 403 });
  });

  it('rejette un lien expiré', () => {
    expect(evalueLien({ expires_at: '2026-09-01T00:00:00Z', revoked_at: null }, NOW))
      .toEqual({ ok: false, error: 'Lien expiré. Demandez un lien à jour à l’équipe PLAI.', status: 410 });
  });

  it('rejette une ligne absente', () => {
    expect(evalueLien(null, NOW)).toEqual({ ok: false, error: 'Lien invalide.', status: 404 });
  });

  it('la révocation prime sur l’expiration', () => {
    const r = evalueLien({ expires_at: '2026-09-01T00:00:00Z', revoked_at: '2026-09-02T00:00:00Z' }, NOW);
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2 : Lancer — échec attendu**

Run : `npx vitest run tests/domain/lienEnseignant.test.js`
Expected : FAIL — `Failed to resolve import "../../src/domain/lienEnseignant.js"`

- [ ] **Step 3 : Implémenter**

```js
/**
 * Valide une ligne ar_liens.
 * @param {{ expires_at: string, revoked_at: string|null }|null} row
 * @param {Date} now
 * @returns {{ ok: true } | { ok: false, error: string, status: number }}
 */
export function evalueLien(row, now = new Date()) {
  if (!row) return { ok: false, error: 'Lien invalide.', status: 404 };
  if (row.revoked_at) return { ok: false, error: 'Lien révoqué par l’équipe PLAI.', status: 403 };
  if (new Date(row.expires_at) < now) {
    return { ok: false, error: 'Lien expiré. Demandez un lien à jour à l’équipe PLAI.', status: 410 };
  }
  return { ok: true };
}
```

- [ ] **Step 4 : Lancer — succès attendu**

Run : `npx vitest run tests/domain/lienEnseignant.test.js`
Expected : PASS (5 tests)

- [ ] **Step 5 : Commit**

```bash
git add src/domain/lienEnseignant.js tests/domain/lienEnseignant.test.js
git commit -m "feat(domain): evalueLien — validite d'un jeton enseignant"
```

---

## Task 3 : Projection `computeFicheEnseignant`

**Files:**
- Create: `src/domain/projections/ficheEnseignant.js`
- Test: `tests/domain/ficheEnseignant.test.js`

- [ ] **Step 1 : Écrire les tests**

```js
import { describe, it, expect } from 'vitest';
import { computeFicheEnseignant } from '../../src/domain/projections/ficheEnseignant.js';
import * as f from '../../src/test/fixtures/sample.js';

const base = {
  classe: f.classe5LA,
  contexte: f.contexte,
  eleves: f.eleves,
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
  referents: f.referents,
  enseignant: { nom: 'M. Dupont', cours: 'Mathématiques' },
  eleveIdsAssignes: ['e1'], // seulement Emilie D.
};

describe('computeFicheEnseignant', () => {
  it('ne garde que les élèves assignés dans le tableau AR par élève', () => {
    const vm = computeFicheEnseignant(base);
    expect(vm.parEleve.map((r) => r.eleve)).toEqual(['Emilie D.']);
  });

  it('conserve le bloc « Pour tous » (AU de la classe)', () => {
    const vm = computeFicheEnseignant(base);
    expect(vm.pourTous.map((x) => x.libelle)).toContain('Mise en page');
  });

  it('expose l’identité de l’enseignant', () => {
    const vm = computeFicheEnseignant(base);
    expect(vm.enseignant).toEqual({ nom: 'M. Dupont', cours: 'Mathématiques' });
  });

  it('nbRecto ne compte que les élèves assignés', () => {
    const vm = computeFicheEnseignant(base); // e1 a « Cours uniquement en recto », e3 aussi mais non assigné
    expect(vm.nbRecto).toBe(1);
  });

  it('tableau AR vide si aucun élève assigné', () => {
    const vm = computeFicheEnseignant({ ...base, eleveIdsAssignes: [] });
    expect(vm.parEleve).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer — échec attendu**

Run : `npx vitest run tests/domain/ficheEnseignant.test.js`
Expected : FAIL — import non résolu

- [ ] **Step 3 : Implémenter**

```js
import { computeFicheClasse } from './ficheClasse.js';

/**
 * Fiche vue par un enseignant : identique à la fiche classe mais restreinte
 * aux élèves qui lui sont assignés. Le bloc « Pour tous » (AU classe) est
 * conservé tel quel.
 * @param {{
 *  classe: import('../types.js').Classe,
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  auClasse: { amenagement_id: string, cree_le?: string }[],
 *  selectionsAR: (import('../types.js').SelectionAR & { cree_le?: string })[],
 *  libres: import('../types.js').AmenagementLibre[],
 *  referents: import('../types.js').ReferentEcole[],
 *  enseignant: { nom: string, cours: string|null },
 *  eleveIdsAssignes: string[],
 * }} input
 * @returns {import('../types.js').FicheClasseVM & { enseignant: { nom: string, cours: string|null } }}
 */
export function computeFicheEnseignant(input) {
  const garde = new Set(input.eleveIdsAssignes);
  const eleves = input.eleves.filter((e) => garde.has(e.id));
  const selectionsAR = input.selectionsAR.filter((s) => garde.has(s.eleve_id));
  const libres = input.libres.filter((l) => garde.has(l.eleve_id));

  const vm = computeFicheClasse({ ...input, eleves, selectionsAR, libres });
  return { ...vm, enseignant: { nom: input.enseignant.nom, cours: input.enseignant.cours ?? null } };
}
```

- [ ] **Step 4 : Lancer — succès attendu**

Run : `npx vitest run tests/domain/ficheEnseignant.test.js`
Expected : PASS (5 tests)

- [ ] **Step 5 : Suite complète + commit**

Run : `npm test`
Expected : PASS (tous les fichiers `tests/domain/`)

```bash
git add src/domain/projections/ficheEnseignant.js tests/domain/ficheEnseignant.test.js
git commit -m "feat(domain): computeFicheEnseignant — fiche restreinte aux eleves assignes"
```

---

## Task 4 : `api/_lib/authEditeur.js`

**Files:**
- Create: `api/_lib/authEditeur.js`

- [ ] **Step 1 : Implémenter**

```js
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Vérifie le JWT Supabase de l'appelant et renvoie son profil AménagActif.
 * Répond lui-même (401/403) et renvoie null en cas d'échec.
 * @returns {Promise<{ userId: string, role: string, ecoleId: string|null, isAdmin: boolean }|null>}
 */
export async function requireEditeur(req, res) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) { res.status(401).json({ error: 'Non authentifié' }); return null; }

  const db = supabaseAdmin();
  const { data: auth, error } = await db.auth.getUser(jwt);
  if (error || !auth?.user) { res.status(401).json({ error: 'Session invalide' }); return null; }

  const { data: profil } = await db
    .from('ar_profils_acces')
    .select('role, ecole_id')
    .eq('user_id', auth.user.id)
    .single();
  if (!profil || !['admin', 'referent_plai', 'direction'].includes(profil.role)) {
    res.status(403).json({ error: 'Accès refusé' }); return null;
  }
  return {
    userId: auth.user.id,
    role: profil.role,
    ecoleId: profil.ecole_id,
    isAdmin: profil.role === 'admin',
  };
}

/**
 * L'éditeur peut-il agir sur une école donnée ?
 * admin → oui partout ; referent_plai / direction → uniquement leur école.
 */
export function peutEditerEcole(editeur, ecoleId) {
  return editeur.isAdmin || (editeur.ecoleId != null && editeur.ecoleId === ecoleId);
}
```

- [ ] **Step 2 : Vérifier le parse**

Run : `node --check api/_lib/authEditeur.js`
Expected : (aucune sortie, code 0)

- [ ] **Step 3 : Commit**

```bash
git add api/_lib/authEditeur.js
git commit -m "feat(api): requireEditeur + peutEditerEcole"
```

---

## Task 5 : `api/_lib/enseignantData.js`

**Files:**
- Create: `api/_lib/enseignantData.js`

- [ ] **Step 1 : Implémenter**

```js
import { supabaseAdmin } from './supabaseAdmin.js';
import { loadClasseData } from './ficheData.js';
import { evalueLien } from '../../src/domain/lienEnseignant.js';

/**
 * Résout un jeton enseignant et charge tout ce qu'il faut pour la projection.
 * @param {string} token
 * @returns {Promise<
 *  { error: string, status: number } |
 *  { enseignant: { id, nom, email, cours, classe_id }, classeData: object, eleveIdsAssignes: string[] }
 * >}
 */
export async function loadEnseignantView(token) {
  const db = supabaseAdmin();

  const { data: lien } = await db
    .from('ar_liens')
    .select('enseignant_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  const verdict = evalueLien(lien, new Date());
  if (!verdict.ok) return { error: verdict.error, status: verdict.status };

  const { data: enseignant } = await db
    .from('ar_enseignants')
    .select('id, nom, email, cours, classe_id')
    .eq('id', lien.enseignant_id)
    .single();
  if (!enseignant) return { error: 'Enseignant introuvable.', status: 404 };

  const { data: assigns } = await db
    .from('ar_enseignant_eleves')
    .select('eleve_id')
    .eq('enseignant_id', enseignant.id);

  const classeData = await loadClasseData(enseignant.classe_id);
  return {
    enseignant,
    classeData,
    eleveIdsAssignes: (assigns ?? []).map((a) => a.eleve_id),
  };
}
```

- [ ] **Step 2 : Vérifier le parse**

Run : `node --check api/_lib/enseignantData.js`
Expected : code 0

- [ ] **Step 3 : Commit**

```bash
git add api/_lib/enseignantData.js
git commit -m "feat(api): loadEnseignantView — resolution jeton + donnees classe filtrees"
```

---

## Task 6 : `api/lien-enseignant.js` (GET consultation + POST génération)

**Files:**
- Create: `api/lien-enseignant.js`
- Delete: `api/fiche-token.js`, `api/_lib/jwt.js`

- [ ] **Step 1 : Implémenter `api/lien-enseignant.js`**

```js
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { loadEnseignantView } from './_lib/enseignantData.js';
import { requireEditeur, peutEditerEcole } from './_lib/authEditeur.js';
import { computeFicheEnseignant } from '../src/domain/projections/ficheEnseignant.js';

export default async function handler(req, res) {
  // ── POST : génère (ou fait tourner) le jeton d'un enseignant ──
  if (req.method === 'POST') {
    const editeur = await requireEditeur(req, res);
    if (!editeur) return;

    const { enseignantId } = req.body || {};
    if (!enseignantId) { res.status(400).json({ error: 'enseignantId requis' }); return; }

    const db = supabaseAdmin();
    const { data: ens } = await db
      .from('ar_enseignants')
      .select('id, classe_id, ar_classes(ecole_id)')
      .eq('id', enseignantId)
      .single();
    if (!ens) { res.status(404).json({ error: 'Enseignant introuvable' }); return; }
    if (!peutEditerEcole(editeur, ens.ar_classes?.ecole_id)) {
      res.status(403).json({ error: 'Accès refusé' }); return;
    }

    // Rotation : révoquer les liens ouverts, en émettre un neuf.
    await db.from('ar_liens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('enseignant_id', enseignantId)
      .is('revoked_at', null);

    const { data: lien, error } = await db
      .from('ar_liens')
      .insert({ enseignant_id: enseignantId })
      .select('token')
      .single();
    if (error || !lien) { res.status(500).json({ error: 'Jeton non créé' }); return; }

    const origin = req.headers.origin || `https://${req.headers.host || ''}`;
    res.status(200).json({ token: lien.token, url: `${origin}/fiche/${lien.token}` });
    return;
  }

  // ── GET : consultation par l'enseignant (sans compte) ──
  if (req.method === 'GET') {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    const token = req.query.token;
    if (!token) { res.status(400).json({ error: 'token requis' }); return; }

    const view = await loadEnseignantView(token);
    if (view.error) { res.status(view.status).json({ error: view.error }); return; }

    // Journal : rattaché à l'enseignant, sans IP ni token en clair.
    await supabaseAdmin()
      .from('ar_acces_log')
      .insert({ enseignant_id: view.enseignant.id });

    const vm = computeFicheEnseignant({
      ...view.classeData,
      enseignant: { nom: view.enseignant.nom, cours: view.enseignant.cours },
      eleveIdsAssignes: view.eleveIdsAssignes,
    });
    res.status(200).json({ vm });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
```

- [ ] **Step 2 : Supprimer l'ancien flux**

```bash
git rm api/fiche-token.js api/_lib/jwt.js
```

- [ ] **Step 3 : Retirer `jose` de `package.json`**

Modifier `package.json` : supprimer la ligne `"jose": "^5.10.0",` du bloc `dependencies`.

Run : `npm install`
Expected : `package-lock.json` mis à jour, pas d'erreur.

- [ ] **Step 4 : Vérifier qu'aucun import résiduel ne pointe vers les fichiers supprimés**

Run : `grep -rn "jwt.js\|fiche-token\|from 'jose'\|AMENAG_TOKEN_SECRET" src api || echo "aucune référence résiduelle"`
Expected : `aucune référence résiduelle`

- [ ] **Step 5 : Build**

Run : `npx vite build`
Expected : `built in ...` sans erreur

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "feat(api): lien-enseignant (consultation filtree + rotation jeton), suppression du flux JWT par classe"
```

---

## Task 7 : `FichePublique` sur le nouveau flux + `FicheClasseView` avec identité enseignant

**Files:**
- Modify: `src/pages/FichePublique.jsx`
- Modify: `src/components/fiche/FicheClasseView.jsx`

- [ ] **Step 1 : `FicheClasseView` — afficher l'enseignant si présent**

Dans `src/components/fiche/FicheClasseView.jsx`, juste après la ligne `<p className="text-sm text-gray-600 mb-4">{vm.ecoleNom} · {vm.anneeLibelle}</p>`, ajouter :

```jsx
      {vm.enseignant && (
        <p className="text-sm mb-4">
          Enseignant·e : <strong>{vm.enseignant.nom}</strong>
          {vm.enseignant.cours ? ` — ${vm.enseignant.cours}` : ''}
        </p>
      )}
```

Et remplacer le `<h1>` par un titre adapté :

```jsx
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">
        Aménagements {vm.enseignant ? 'des élèves suivis' : 'raisonnables'} — {vm.classeNom}
      </h1>
```

- [ ] **Step 2 : `FichePublique` — pointer sur `/api/lien-enseignant`**

Remplacer le contenu de `src/pages/FichePublique.jsx` par :

```jsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';

export default function FichePublique() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['fiche-enseignant', token],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/lien-enseignant?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Lien invalide.');
      }
      return res.json();
    },
  });

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error || !data?.vm) {
    return (
      <div className="plai-section">
        <p className="plai-error">{error?.message || 'Ce lien est invalide ou a expiré.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-6">
      <div className="text-center mb-3 no-print space-y-2">
        <p className="text-sm text-[color:var(--text3)]">
          Fiche en lecture seule — diffusion restreinte à l'enseignant·e destinataire.
        </p>
        <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>
      </div>
      <FicheClasseView vm={data.vm} />
    </div>
  );
}
```

- [ ] **Step 3 : Build**

Run : `npx vite build`
Expected : succès

- [ ] **Step 4 : Commit**

```bash
git add src/pages/FichePublique.jsx src/components/fiche/FicheClasseView.jsx
git commit -m "feat(fiche): consultation enseignant filtree + identite enseignant sur la fiche"
```

---

## Task 8 : Hook `useEnseignants`

**Files:**
- Create: `src/hooks/useEnseignants.js`

- [ ] **Step 1 : Implémenter**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Enseignants d'une classe + assignations + statut lien + dernier accès + derniers envois. */
export function useEnseignantsClasse(classeId, anneeId) {
  return useQuery({
    queryKey: ['enseignants-classe', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data: enseignants, error } = await supabase
        .from('ar_enseignants')
        .select('id, nom, email, cours, classe_id, annee_id')
        .eq('classe_id', classeId)
        .order('nom');
      if (error) throw error;
      const ids = enseignants.map((e) => e.id);

      const { data: eleves } = await supabase
        .from('ar_eleves').select('id, prenom, initiale_nom').eq('classe_id', classeId).order('prenom');

      if (ids.length === 0) return { enseignants, eleves: eleves ?? [], assignations: [], liens: [], acces: [], envois: [] };

      const [assign, liens, acces, envois] = await Promise.all([
        supabase.from('ar_enseignant_eleves').select('enseignant_id, eleve_id').in('enseignant_id', ids),
        supabase.from('ar_liens').select('enseignant_id, expires_at, revoked_at, created_at').in('enseignant_id', ids),
        supabase.from('ar_acces_log').select('enseignant_id, consulte_le').in('enseignant_id', ids),
        supabase.from('ar_envois').select('enseignant_id, statut, envoye_le, erreur').in('enseignant_id', ids),
      ]);

      return {
        enseignants,
        eleves: eleves ?? [],
        assignations: assign.data ?? [],
        liens: liens.data ?? [],
        acces: acces.data ?? [],
        envois: envois.data ?? [],
      };
    },
  });
}

export function useEnseignantMutations(classeId, anneeId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['enseignants-classe', classeId] });

  const creer = useMutation({
    mutationFn: async ({ nom, email, cours }) => {
      const { error } = await supabase.from('ar_enseignants')
        .insert({ classe_id: classeId, annee_id: anneeId, nom, email, cours: cours || null });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const modifier = useMutation({
    mutationFn: async ({ id, nom, email, cours }) => {
      const { error } = await supabase.from('ar_enseignants')
        .update({ nom, email, cours: cours || null }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const supprimer = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('ar_enseignants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const basculerAssignation = useMutation({
    mutationFn: async ({ enseignantId, eleveId, assigne }) => {
      if (assigne) {
        const { error } = await supabase.from('ar_enseignant_eleves')
          .insert({ enseignant_id: enseignantId, eleve_id: eleveId });
        if (error && error.code !== '23505') throw error; // ignore doublon
      } else {
        const { error } = await supabase.from('ar_enseignant_eleves')
          .delete().eq('enseignant_id', enseignantId).eq('eleve_id', eleveId);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { creer, modifier, supprimer, basculerAssignation, invalidate };
}
```

- [ ] **Step 2 : Vérifier le parse via build**

Run : `npx vite build`
Expected : succès (le hook n'est pas encore importé, mais la syntaxe est validée par esbuild au prochain import ; on le vérifie en Task 9)

- [ ] **Step 3 : Commit**

```bash
git add src/hooks/useEnseignants.js
git commit -m "feat(hook): useEnseignantsClasse + mutations (CRUD enseignant, assignation eleve)"
```

---

## Task 9 : Composant `EnseignantsClasse` + page + route

**Files:**
- Create: `src/components/saisie/EnseignantsClasse.jsx`
- Create: `src/pages/EnseignantsPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/pages/FicheClassePage.jsx`

- [ ] **Step 1 : `EnseignantsClasse.jsx`**

```jsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useEnseignantsClasse, useEnseignantMutations } from '../../hooks/useEnseignants.js';

const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;

async function appelAuth(url, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || 'Échec de la requête');
  }
  return res.json();
}

export default function EnseignantsClasse({ classeId, anneeId }) {
  const { data, isLoading, error } = useEnseignantsClasse(classeId, anneeId);
  const mut = useEnseignantMutations(classeId, anneeId);
  const [form, setForm] = useState({ nom: '', email: '', cours: '' });
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <p className="plai-error">{error.message}</p>;

  const { enseignants, eleves, assignations, liens, acces, envois } = data;
  const estAssigne = (ensId, elId) => assignations.some((a) => a.enseignant_id === ensId && a.eleve_id === elId);
  const lienActif = (ensId) => liens.some((l) => l.enseignant_id === ensId && !l.revoked_at && new Date(l.expires_at) > new Date());
  const dernierAcces = (ensId) => acces.filter((a) => a.enseignant_id === ensId).map((a) => a.consulte_le).sort().at(-1);
  const dernierEnvoi = (ensId) => envois.filter((e) => e.enseignant_id === ensId).sort((a, b) => (a.envoye_le || '').localeCompare(b.envoye_le || '')).at(-1);

  async function action(ensId, fn, okMsg) {
    setBusy(ensId); setMsg(null);
    try { const r = await fn(); setMsg(okMsg(r)); mut.invalidate(); }
    catch (e) { setMsg(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <form
        className="plai-card space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await mut.creer.mutateAsync(form);
          setForm({ nom: '', email: '', cours: '' });
        }}
      >
        <h3 className="font-semibold">Ajouter un·e enseignant·e</h3>
        <label className="block text-sm">Nom
          <input className="plai-input w-full" required value={form.nom}
            placeholder="Mme Renard"
            onChange={(e) => setForm({ ...form, nom: e.target.value })} />
        </label>
        <p className="text-xs text-[color:var(--text3)]">Tel qu'il apparaîtra en tête de la fiche que l'enseignant·e recevra.</p>
        <label className="block text-sm">Adresse e-mail
          <input className="plai-input w-full" type="email" required value={form.email}
            placeholder="c.renard@athenee-liege.be"
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <p className="text-xs text-[color:var(--text3)]">Destination du lien personnel. Une seule adresse par enseignant·e et par classe.</p>
        <label className="block text-sm">Cours (optionnel)
          <input className="plai-input w-full" value={form.cours}
            placeholder="Français, 3e année"
            onChange={(e) => setForm({ ...form, cours: e.target.value })} />
        </label>
        <p className="text-xs text-[color:var(--text3)]">Affiché sous le nom sur la fiche. Utile quand un·e enseignant·e a plusieurs cours dans la classe.</p>
        <button className="plai-btn" disabled={mut.creer.isPending}>Ajouter</button>
        {mut.creer.isError && <p className="plai-error">{mut.creer.error.message}</p>}
      </form>

      {msg && <p className="plai-banner">{msg}</p>}

      {enseignants.length === 0 && <p className="plai-empty">Aucun·e enseignant·e pour cette classe.</p>}

      {enseignants.map((ens) => {
        const acc = dernierAcces(ens.id);
        const env = dernierEnvoi(ens.id);
        return (
          <div key={ens.id} className="plai-card space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="font-semibold">{ens.nom}{ens.cours ? ` — ${ens.cours}` : ''}</p>
                <p className="text-sm text-[color:var(--text3)]">{ens.email}</p>
                <p className="text-xs text-[color:var(--text3)]">
                  Lien : {lienActif(ens.id) ? 'actif' : 'aucun / révoqué'}
                  {' · '}Dernière consultation : {acc ? new Date(acc).toLocaleDateString('fr-BE') : 'jamais'}
                  {env ? ` · Dernier envoi : ${env.statut}${env.envoye_le ? ' le ' + new Date(env.envoye_le).toLocaleDateString('fr-BE') : ''}` : ''}
                </p>
              </div>
              <button className="plai-btn plai-btn--ghost text-sm"
                onClick={() => { if (confirm(`Retirer ${ens.nom} ?`)) mut.supprimer.mutate(ens.id); }}>
                Retirer
              </button>
            </div>

            <fieldset className="border border-[color:var(--border)] rounded p-2">
              <legend className="text-sm px-1">Élèves suivis</legend>
              <p className="text-xs text-[color:var(--text3)] mb-1">
                L'enseignant·e ne verra que les élèves cochés ici (et le bloc « Pour tous » de la classe).
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {eleves.map((el) => (
                  <label key={el.id} className="text-sm flex items-center gap-1">
                    <input type="checkbox" checked={estAssigne(ens.id, el.id)}
                      onChange={(e) => mut.basculerAssignation.mutate({
                        enseignantId: ens.id, eleveId: el.id, assigne: e.target.checked,
                      })} />
                    {nomEleve(el)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <button className="plai-btn" disabled={busy === ens.id}
                onClick={() => action(ens.id,
                  () => appelAuth('/api/lien-enseignant', { enseignantId: ens.id }),
                  (r) => { navigator.clipboard?.writeText(r.url); return 'Lien copié dans le presse-papier (les liens précédents sont révoqués).'; })}>
                Générer / copier le lien
              </button>
              <button className="plai-btn" disabled={busy === ens.id}
                onClick={() => action(ens.id,
                  () => appelAuth('/api/envois', { classeId, enseignantIds: [ens.id] }),
                  (r) => `Envoi : ${r.resultats?.[0]?.statut ?? 'terminé'}`)}>
                Envoyer par e-mail
              </button>
              <button className="plai-btn plai-btn--ghost" disabled={busy === ens.id}
                onClick={() => action(ens.id,
                  () => appelAuth('/api/lien-revoquer', { enseignantId: ens.id }),
                  (r) => `Lien${(r.revoques ?? 0) > 1 ? 's' : ''} révoqué(s) : ${r.revoques ?? 0}`)}>
                Révoquer le lien
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

> Vérifié : `plai-style.css` fournit `plai-banner`, `plai-card`, `plai-empty`, `plai-success` mais **pas** `plai-btn--ghost`. Remplacer les trois `className="plai-btn plai-btn--ghost ..."` ci-dessus par `className="plai-btn ..."` (boutons « Retirer » et « Révoquer le lien »). Idem `plai-btn--ghost` dans `FicheClassePage` / `EnseignantsPage` : utiliser `plai-btn` ou un simple lien.

- [ ] **Step 2 : `EnseignantsPage.jsx`**

```jsx
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import EnseignantsClasse from '../components/saisie/EnseignantsClasse.jsx';

export default function EnseignantsPage() {
  const { classeId } = useParams();
  const { data: classe, isLoading } = useQuery({
    queryKey: ['classe-entete', classeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_classes')
        .select('id, nom, annee_id, ar_ecoles(nom), ar_annees(libelle)')
        .eq('id', classeId).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  return (
    <div className="plai-section space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">
          Enseignants — {classe?.nom} <span className="text-sm text-[color:var(--text3)]">
            {classe?.ar_ecoles?.nom} · {classe?.ar_annees?.libelle}
          </span>
        </h1>
        <Link className="text-teal underline text-sm" to={`/classe/${classeId}/fiche`}>Voir la fiche classe</Link>
      </div>
      <EnseignantsClasse classeId={classeId} anneeId={classe?.annee_id} />
    </div>
  );
}
```

- [ ] **Step 3 : Routes dans `src/App.jsx`**

Ajouter l'import :

```jsx
import EnseignantsPage from './pages/EnseignantsPage.jsx';
```

Ajouter la route (après la ligne `/classe/:classeId/fiche`) :

```jsx
      <Route path="/classe/:classeId/enseignants" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><EnseignantsPage /></RequireRole></Shell></RequireAuth>} />
```

- [ ] **Step 4 : `FicheClassePage.jsx` — retirer le lien par classe, ajouter l'accès « Enseignants »**

Dans `FicheClasseContenu`, supprimer la fonction `copierLien` et le bouton « Copier le lien enseignant ». Remplacer la barre `no-print` par :

```jsx
      <div className="flex gap-3 no-print">
        <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>
        <Link className="plai-btn" to={`/classe/${classeId}/enseignants`}>Enseignants &amp; envois</Link>
        <Link className="plai-btn" to={`/classe/${classeId}/historique`}>Historique</Link>
      </div>
```

Ajouter `import { Link } from 'react-router-dom';` si absent (déjà importé : `useParams, Link`). Retirer l'import `supabase` s'il n'est plus utilisé.

Dans le `Picker`, ajouter à côté de chaque classe un lien « Enseignants » :

```jsx
        {(grid?.classes ?? []).map((c) => (
          <li key={c.id}>
            <Link className="text-teal underline" to={`/classe/${c.id}/fiche`}>{c.nom}</Link>
            {' · '}
            <Link className="text-teal underline" to={`/classe/${c.id}/enseignants`}>enseignants</Link>
          </li>
        ))}
```

- [ ] **Step 5 : Build**

Run : `npx vite build`
Expected : succès

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "feat(ui): gestion des enseignants par classe (assignation, lien, envoi, revocation)"
```

---

# PARTIE 2 — Envoi d'e-mails automatisé

## Task 10 : Dépendance `resend` + variables d'environnement

**Files:**
- Modify: `package.json`, `.env.example`, `README.md`

- [ ] **Step 1 : Installer `resend`**

Run : `npm install resend@^6.16.0`
Expected : ajout dans `dependencies`, lock mis à jour.

- [ ] **Step 2 : `.env.example`**

Retirer `AMENAG_TOKEN_SECRET`. Ajouter :

```
# Envoi des liens enseignants (Resend). Si absent, les envois passent en statut "simulé".
RESEND_API_KEY=
```

- [ ] **Step 3 : `README.md`**

Dans le tableau des variables d'environnement, retirer la ligne `AMENAG_TOKEN_SECRET` et ajouter :

```
| `RESEND_API_KEY` | serverless uniquement | envoi des e-mails de lien ; si absent, envois « simulés » (aucun mail) |
```

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json .env.example README.md
git commit -m "chore: dependance resend + variable RESEND_API_KEY, retrait AMENAG_TOKEN_SECRET"
```

- [ ] **Step 5 : Note pour JF (rapport de tâche)**

> Ajouter `RESEND_API_KEY` dans les variables d'environnement Vercel du projet AménagActif (valeur = clé Resend, la même que pour AccèsActif). Sans elle, le bouton « Envoyer » marque l'envoi comme `simulé` et n'expédie aucun mail. Retirer `AMENAG_TOKEN_SECRET` (plus utilisé).

---

## Task 11 : `api/envois.js`

**Files:**
- Create: `api/envois.js`

- [ ] **Step 1 : Implémenter**

```js
import { Resend } from 'resend';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { requireEditeur, peutEditerEcole } from './_lib/authEditeur.js';
import { loadClasseData } from './_lib/ficheData.js';
import { buildSnapshot } from '../src/domain/projections/snapshot.js';

const RESEND_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function corpsMail({ enseignantNom, classeNom, url }) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;max-width:560px;margin:0 auto;color:#1a1814;">
      <div style="background:#0a9370;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">AménagActif — PLAI</h1>
      </div>
      <div style="background:#fff;border:1px solid #e8e4dd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p>Bonjour ${esc(enseignantNom)},</p>
        <p>Les aménagements des élèves que vous accompagnez en ${esc(classeNom)} sont disponibles.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${url}" style="background:#0a9370;color:#fff;padding:12px 24px;border-radius:20px;text-decoration:none;font-weight:600;display:inline-block;">
            Voir la fiche
          </a>
        </p>
        <p style="font-size:14px;color:#5a564f;">
          Ce lien est personnel et valable 120 jours. Ne le transmettez pas : il donne accès à des informations sur des élèves nommés.<br>
          Tout nouvel envoi remplace ce lien. En cas de problème, contactez l'équipe PLAI.
        </p>
      </div>
    </div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const editeur = await requireEditeur(req, res);
  if (!editeur) return;

  const { classeId, enseignantIds } = req.body || {};
  if (!classeId || !Array.isArray(enseignantIds) || enseignantIds.length === 0) {
    res.status(400).json({ error: 'classeId et enseignantIds requis' }); return;
  }

  const db = supabaseAdmin();

  const { data: classe } = await db
    .from('ar_classes').select('id, nom, ecole_id').eq('id', classeId).single();
  if (!classe) { res.status(404).json({ error: 'Classe introuvable' }); return; }
  if (!peutEditerEcole(editeur, classe.ecole_id)) { res.status(403).json({ error: 'Accès refusé' }); return; }

  // ── Fige un instantané complet de la classe ──
  const classeData = await loadClasseData(classeId);
  const contenu = buildSnapshot({
    eleves: classeData.eleves,
    amenagements: classeData.amenagements,
    auClasse: classeData.auClasse,
    selectionsAR: classeData.selectionsAR,
    libres: classeData.libres,
  });
  const { data: snapshot, error: snapErr } = await db
    .from('ar_fiche_snapshots')
    .insert({ classe_id: classeId, fige_par: editeur.userId, contenu, envoi_le: new Date().toISOString() })
    .select('id')
    .single();
  if (snapErr || !snapshot) { res.status(500).json({ error: 'Instantané non créé' }); return; }

  const origin = req.headers.origin || `https://${req.headers.host || ''}`;
  const resultats = [];

  for (const enseignantId of enseignantIds) {
    try {
      const { data: ens } = await db
        .from('ar_enseignants')
        .select('id, nom, email, classe_id')
        .eq('id', enseignantId)
        .eq('classe_id', classeId)
        .single();
      if (!ens) { resultats.push({ enseignantId, statut: 'introuvable' }); continue; }

      // Rotation du jeton
      await db.from('ar_liens').update({ revoked_at: new Date().toISOString() })
        .eq('enseignant_id', enseignantId).is('revoked_at', null);
      const { data: lien, error: lienErr } = await db.from('ar_liens')
        .insert({ enseignant_id: enseignantId }).select('token').single();
      if (lienErr || !lien) { resultats.push({ enseignantId, statut: 'erreur', erreur: 'jeton' }); continue; }

      const url = `${origin}/fiche/${lien.token}`;
      let statut = 'simule';
      let erreur = null;

      if (resend) {
        try {
          await resend.emails.send({
            from: 'AménagActif PLAI <noreply@jfb4plai.com>',
            to: ens.email,
            subject: `Aménagements — ${classe.nom}`,
            html: corpsMail({ enseignantNom: ens.nom, classeNom: classe.nom, url }),
          });
          statut = 'envoye';
        } catch (e) {
          statut = 'erreur';
          erreur = e.message;
        }
      }

      await db.from('ar_envois').insert({
        snapshot_id: snapshot.id,
        enseignant_id: enseignantId,
        destinataire_email: ens.email,
        statut,
        erreur,
        envoye_le: statut === 'envoye' || statut === 'simule' ? new Date().toISOString() : null,
      });

      resultats.push({ enseignantId, statut, erreur });
    } catch (e) {
      resultats.push({ enseignantId, statut: 'erreur', erreur: e.message });
    }
  }

  res.status(200).json({ snapshotId: snapshot.id, resultats });
}
```

- [ ] **Step 2 : Vérifier le parse**

Run : `node --check api/envois.js`
Expected : code 0

- [ ] **Step 3 : Build**

Run : `npx vite build`
Expected : succès

- [ ] **Step 4 : Commit**

```bash
git add api/envois.js
git commit -m "feat(api): envois — fige un instantane, rote les jetons, envoie via Resend (ou simule)"
```

---

# PARTIE 3 — Révocation de lien

## Task 12 : `api/lien-revoquer.js`

**Files:**
- Create: `api/lien-revoquer.js`

- [ ] **Step 1 : Implémenter**

```js
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { requireEditeur, peutEditerEcole } from './_lib/authEditeur.js';

/**
 * Coupe immédiatement l'accès d'un enseignant à ses liens en cours.
 * Cas d'usage : départ de l'école, lien transmis par erreur, changement d'affectation.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const editeur = await requireEditeur(req, res);
  if (!editeur) return;

  const { enseignantId } = req.body || {};
  if (!enseignantId) { res.status(400).json({ error: 'enseignantId requis' }); return; }

  const db = supabaseAdmin();
  const { data: ens } = await db
    .from('ar_enseignants')
    .select('id, ar_classes(ecole_id)')
    .eq('id', enseignantId)
    .single();
  if (!ens) { res.status(404).json({ error: 'Enseignant introuvable' }); return; }
  if (!peutEditerEcole(editeur, ens.ar_classes?.ecole_id)) { res.status(403).json({ error: 'Accès refusé' }); return; }

  const { data, error } = await db
    .from('ar_liens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('enseignant_id', enseignantId)
    .is('revoked_at', null)
    .select('id');
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.status(200).json({ revoques: (data || []).length });
}
```

- [ ] **Step 2 : Vérifier le parse + build**

Run : `node --check api/lien-revoquer.js && npx vite build`
Expected : code 0 puis build réussi

- [ ] **Step 3 : Commit**

```bash
git add api/lien-revoquer.js
git commit -m "feat(api): lien-revoquer — coupe les liens ouverts d'un enseignant"
```

> Le bouton « Révoquer le lien » est déjà câblé dans `EnseignantsClasse.jsx` (Task 9).

---

# PARTIE 4 — Journal d'accès

Le journal est **déjà écrit** par `api/lien-enseignant.js` (Task 6, insertion dans `ar_acces_log` à chaque GET) et **déjà lu** par `useEnseignantsClasse` + affiché dans `EnseignantsClasse.jsx` (« Dernière consultation »). Cette partie ajoute la vue détaillée.

## Task 13 : Détail du journal dans la page Enseignants

**Files:**
- Modify: `src/components/saisie/EnseignantsClasse.jsx`

- [ ] **Step 1 : Ajouter un dépliant « historique des consultations » par enseignant**

Dans `EnseignantsClasse.jsx`, dans le bloc `enseignants.map(...)`, après la `<fieldset>` des élèves, ajouter :

```jsx
            <details className="text-sm">
              <summary className="cursor-pointer text-[color:var(--text2)]">
                Consultations ({acces.filter((a) => a.enseignant_id === ens.id).length})
              </summary>
              <ul className="list-disc pl-6 mt-1 text-[color:var(--text3)]">
                {acces
                  .filter((a) => a.enseignant_id === ens.id)
                  .sort((a, b) => b.consulte_le.localeCompare(a.consulte_le))
                  .slice(0, 20)
                  .map((a, i) => (
                    <li key={i}>{new Date(a.consulte_le).toLocaleString('fr-BE')}</li>
                  ))}
                {acces.filter((a) => a.enseignant_id === ens.id).length === 0 && (
                  <li className="list-none">Jamais consulté.</li>
                )}
              </ul>
            </details>
```

- [ ] **Step 2 : Build + commit**

Run : `npx vite build`
Expected : succès

```bash
git add src/components/saisie/EnseignantsClasse.jsx
git commit -m "feat(ui): detail des consultations par enseignant (journal d'acces)"
```

---

# PARTIE 5 — Écran d'historique (bâti sur les snapshots)

## Task 14 : Hook `useHistoriqueClasse`

**Files:**
- Create: `src/hooks/useHistoriqueClasse.js`

- [ ] **Step 1 : Implémenter**

```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { diffSnapshots } from '../domain/projections/snapshot.js';

/**
 * Instantanés d'une classe, du plus récent au plus ancien, chacun accompagné
 * du diff par rapport à l'instantané précédent.
 */
export function useHistoriqueClasse(classeId) {
  return useQuery({
    queryKey: ['historique-classe', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data: snaps, error } = await supabase
        .from('ar_fiche_snapshots')
        .select('id, fige_le, envoi_le, contenu')
        .eq('classe_id', classeId)
        .order('fige_le', { ascending: true });
      if (error) throw error;

      const enrichis = snaps.map((s, i) => ({
        ...s,
        diff: diffSnapshots(i === 0 ? null : snaps[i - 1].contenu, s.contenu),
      }));
      return enrichis.reverse(); // plus récent d'abord
    },
  });
}
```

- [ ] **Step 2 : Commit**

```bash
git add src/hooks/useHistoriqueClasse.js
git commit -m "feat(hook): useHistoriqueClasse — snapshots + diff entre envois"
```

---

## Task 15 : Page `HistoriqueClassePage` + route

**Files:**
- Create: `src/pages/HistoriqueClassePage.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1 : `HistoriqueClassePage.jsx`**

```jsx
import { useParams, Link } from 'react-router-dom';
import { useHistoriqueClasse } from '../hooks/useHistoriqueClasse.js';

function ListeDiff({ titre, items, render }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-sm font-medium">{titre}</p>
      <ul className="list-disc pl-6 text-sm">{items.map((x, i) => <li key={i}>{render(x)}</li>)}</ul>
    </div>
  );
}

export default function HistoriqueClassePage() {
  const { classeId } = useParams();
  const { data: snaps, isLoading, error } = useHistoriqueClasse(classeId);

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;

  return (
    <div className="plai-section space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Historique des envois</h1>
        <Link className="text-teal underline text-sm" to={`/classe/${classeId}/enseignants`}>Enseignants &amp; envois</Link>
      </div>

      {(!snaps || snaps.length === 0) && (
        <p className="plai-empty">Aucun envoi enregistré. L'historique se remplit à chaque envoi par e-mail.</p>
      )}

      {(snaps ?? []).map((s, idx) => {
        const d = s.diff;
        const vide = !d.auAjoutes.length && !d.auRetires.length && !d.arAjoutes.length && !d.arRetires.length;
        return (
          <div key={s.id} className="plai-card space-y-2">
            <p className="font-semibold">
              {new Date(s.envoi_le || s.fige_le).toLocaleString('fr-BE')}
              {idx === snaps.length - 1 && ' · premier envoi'}
            </p>
            {vide ? (
              <p className="text-sm text-[color:var(--text3)]">Aucun changement depuis l'envoi précédent.</p>
            ) : (
              <div className="space-y-2">
                <ListeDiff titre="AU ajoutés (classe)" items={d.auAjoutes} render={(x) => x} />
                <ListeDiff titre="AU retirés (classe)" items={d.auRetires} render={(x) => x} />
                <ListeDiff titre="AR ajoutés" items={d.arAjoutes} render={(x) => `${x.eleve} : ${x.texte}`} />
                <ListeDiff titre="AR retirés" items={d.arRetires} render={(x) => `${x.eleve} : ${x.texte}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2 : Route dans `src/App.jsx`**

Import :

```jsx
import HistoriqueClassePage from './pages/HistoriqueClassePage.jsx';
```

Route (après `/classe/:classeId/enseignants`) :

```jsx
      <Route path="/classe/:classeId/historique" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><HistoriqueClassePage /></RequireRole></Shell></RequireAuth>} />
```

- [ ] **Step 3 : Build**

Run : `npx vite build`
Expected : succès

- [ ] **Step 4 : Commit**

```bash
git add src/pages/HistoriqueClassePage.jsx src/App.jsx
git commit -m "feat(ui): ecran historique des envois (diff entre instantanes)"
```

---

# PARTIE 6 — Vérification de bout en bout

## Task 16 : Suite de tests + build complet

- [ ] **Step 1 : Tests de domaine**

Run : `npm test`
Expected : PASS — tous les fichiers `tests/domain/` (dont `lienEnseignant`, `ficheEnseignant`, et les tests préexistants `snapshot`, `ficheClasse`, `ficheEleve`, `basculeAnnee`, `normalise`, `profilDiffActif`)

- [ ] **Step 2 : Build de production**

Run : `npx vite build`
Expected : `built in ...` sans erreur ni warning bloquant

- [ ] **Step 3 : Vérifier l'absence de références mortes**

Run : `grep -rn "jose\|fiche-token\|AMENAG_TOKEN_SECRET\|jwt.js" src api package.json || echo "propre"`
Expected : `propre`

- [ ] **Step 4 : Commit (si des ajustements ont été nécessaires)**

```bash
git add -A
git commit -m "test: suite complete verte apres portage des 4 briques"
```

---

## Task 17 : Procédure de recette manuelle (pour JF, `vercel dev`)

- [ ] **Step 1 : Rédiger `docs/superpowers/plans/recette-diffusion-enseignant.md`**

```markdown
# Recette — diffusion par enseignant

Prérequis : migration `20260907_amenagactif_diffusion.sql` exécutée ;
`RESEND_API_KEY` dans `.env.local` (sinon les envois seront « simulés ») ;
`vercel dev` lancé (obligatoire pour `/api/*`).

1. Se connecter (compte admin ou référent PLAI).
2. Saisie : créer une classe avec 3 élèves, cocher 1 AU classe, poser 2 AR sur 2 élèves différents.
3. Fiches → choisir la classe → « Enseignants & envois ».
4. Ajouter un enseignant (nom, e-mail réel, cours). Vérifier le message d'erreur si on ajoute deux fois le même e-mail dans la classe.
5. Cocher 1 seul élève pour cet enseignant.
6. « Générer / copier le lien ». Ouvrir le lien en navigation privée :
   - la fiche ne montre QUE l'élève coché + le bloc « Pour tous » ;
   - le nom + le cours de l'enseignant apparaissent en tête ;
   - « nombre de cours à imprimer en recto » ne compte que l'élève affiché.
7. Revenir sur la page Enseignants : « Dernière consultation » est renseignée ; le dépliant « Consultations » liste l'accès.
8. « Envoyer par e-mail » : vérifier la réception (ou le statut « simulé »). Le lien précédent doit cesser de fonctionner (ouvrir l'ancien onglet → « Lien révoqué »).
9. « Révoquer le lien » : le nouveau lien cesse de fonctionner immédiatement.
10. Modifier un AR, renvoyer. Aller dans « Historique » : le diff liste le changement ; le premier envoi est marqué « premier envoi ».
11. Tester le cloisonnement de rôle : un compte `direction` d'une autre école ne doit pas pouvoir générer de lien pour cette classe (403).
```

- [ ] **Step 2 : Commit**

```bash
git add docs/superpowers/plans/recette-diffusion-enseignant.md
git commit -m "docs: procedure de recette diffusion par enseignant"
```

- [ ] **Step 3 : Note finale pour JF (rapport)**

> Avant push : `npm test` + `npx vite build` verts (fait). Actions JF :
> 1. Exécuter `supabase/migrations/20260907_amenagactif_diffusion.sql` sur `dfoaumjleqtxjeaplnna`.
> 2. Vercel : ajouter `RESEND_API_KEY`, retirer `AMENAG_TOKEN_SECRET`.
> 3. Vérifier que `noreply@jfb4plai.com` est autorisé côté Resend pour le domaine (déjà OK pour AccèsActif).
> 4. Recette manuelle (`docs/superpowers/plans/recette-diffusion-enseignant.md`).
> 5. Mettre à jour la vignette portail `portail-plai/src/data/apps.ts` (repo + déploiement séparés).
> 6. Une fois AménagActif validé en usage, planifier le retrait d'AccèsActif (repo + projet Vercel + purge des tables `acces_*` sur le projet partagé).

---

## Self-Review

**Couverture des 4 briques + bonus :**

| Brique | Tâches |
|---|---|
| 1. Cloisonnement par enseignant | Tasks 1–9 (table d'assignation, jeton par enseignant, projection filtrée, API, UI) |
| 2. Envoi d'e-mails | Tasks 10–11 (`resend`, `api/envois.js`, snapshot figé) |
| 3. Révocation de lien | Task 12 (`api/lien-revoquer.js`) + bouton câblé Task 9 |
| 4. Journal d'accès | écriture Task 6, lecture Tasks 8–9, détail Task 13 |
| Bonus. Historique | Tasks 14–15 (sur snapshots existants + `diffSnapshots`) |

**Cohérence des types :**
- `evalueLien(row, now)` → `{ ok: true } | { ok: false, error, status }` : consommé par `loadEnseignantView` (Task 5) et testé (Task 2).
- `computeFicheEnseignant(input)` attend `enseignant: { nom, cours }` + `eleveIdsAssignes: string[]` : fourni identiquement par `api/lien-enseignant.js` (Task 6) et les tests (Task 3).
- `loadEnseignantView` renvoie `{ enseignant, classeData, eleveIdsAssignes }` ou `{ error, status }` : `api/lien-enseignant.js` teste `view.error` avant d'utiliser les autres champs.
- APIs d'envoi renvoient `{ resultats: [{ enseignantId, statut, erreur }] }` : `EnseignantsClasse.jsx` lit `r.resultats?.[0]?.statut`. Cohérent.
- `api/lien-revoquer.js` renvoie `{ revoques: n }` : l'UI lit `r.revoques`. Cohérent.
- `requireEditeur` renvoie `{ userId, role, ecoleId, isAdmin }` : `api/envois.js` utilise `editeur.userId` pour `fige_par`, `peutEditerEcole(editeur, ecoleId)` partout. Cohérent.

**Points à valider par l'exécutant avant de figer (signalés inline) :**
- Classes CSS `plai-btn--ghost` / `plai-banner` : vérifier `src/plai-style.css`, sinon retomber sur `plai-btn` / `plai-success`.
- `RequireRole` : confirmer que la prop s'appelle bien `roles` (utilisée telle quelle dans `App.jsx` existant — OK).
- `imprimerFiche` importé depuis `../lib/imprimerFiche.js` — chemin déjà utilisé par `FichePublique` actuel.

**Placeholders :** aucun `TODO`/`TBD`. Chaque étape de code porte le code complet ; les étapes UI de modification pointent une ancre textuelle précise dans un fichier existant.

**Décision laissée à JF (hors plan, à trancher avant Task 9) :** faut-il conserver *aussi* un lien « classe entière » pour un cas d'usage direction ? Le plan supprime le lien par classe. Si un besoin apparaît, il se réajoute comme un `ar_enseignants` spécial « Direction » assigné à tous les élèves — pas de code jetable.

---

## Execution Handoff

**Plan complet, enregistré dans `docs/superpowers/plans/2026-09-07-amenagactif-diffusion-enseignant.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent neuf par tâche, revue entre les tâches, itération rapide.

**2. Inline Execution** — exécution des tâches dans cette session via executing-plans, par lots avec points de contrôle.

**Quelle approche ?**
