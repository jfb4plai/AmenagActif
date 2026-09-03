# AménagActif — Plan 1 : socle (schéma, saisie, fiches, PDF)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un MVP déployé où un référent PLAI saisit les AU/AR d'une école dans une grille type Excel, et où fiches classe / fiche élève sont consultables en web et en PDF (lien à jeton pour les enseignants).

**Architecture:** Données canoniques Supabase (tables `ar_`, projet partagé) = seule source. Les vues (fiche classe, fiche élève, profil DiffActif) sont des **fonctions pures** dans `src/domain/projections/` qui reçoivent des tableaux et renvoient des objets d'affichage — elles ne touchent jamais la base. Le front React lit via `@tanstack/react-query` + `supabase-js`. Les PDF et le lien public passent par des Serverless Functions Vercel `api/*.js`.

**Tech Stack:** React 18, Vite 5, Tailwind CSS v3, `@tanstack/react-query` v5, `react-router-dom` v6, `@supabase/supabase-js` v2, `@react-pdf/renderer` (PDF), `jose` (JWT lien enseignant), Vitest (tests). Déploiement GitHub `jfb4plai/AmenagActif` (branche `main`) → Vercel → `amenagactif.jfb4plai.com`.

**Périmètre de CE plan :** scaffolding, schéma + RLS, catalogue, auth + rôles, projections, grille de saisie école, fiche classe web, fiche élève web, PDF, lien à jeton.
**Hors de ce plan (→ Plan 2) :** notification mail, import CSV enseignants, import/export xlsx, export profil DiffActif, clôture d'année. Les interfaces posées ici (tables, projections) sont stables pour le Plan 2.

**Spec de référence :** `docs/superpowers/specs/2026-09-03-amenagactif-design.md`

---

## Conventions

- Composants React : un fichier = un composant, `PascalCase.jsx`. Logique pure : `camelCase.js`.
- Types : JSDoc `@typedef` dans `src/domain/types.js` (pas de TypeScript).
- Commits : Conventional Commits, en français pour le corps si utile. Terminer chaque message par :
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
- Avant tout `git push` : `npm run build` doit passer (règle CLAUDE.md).
- Tables Supabase : **toujours** préfixe `ar_`. Ne jamais recréer `profiles` ni le trigger `updated_at` (projet partagé).
- Police : écran ≥ 16px ; PDF en Helvetica (équivalent métrique d'Arial, cf. règle « Arial 12 » pour les supports imprimés).

---

## File Structure

```
AmenagActif/
├── package.json
├── vite.config.js
├── vitest.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── vercel.json
├── .gitignore
├── .env.example
├── .env.local                      (non commité)
├── scripts/
│   └── generate-catalogue.mjs      Task 3 — extrait le catalogue depuis le xlsx source
├── supabase/
│   ├── migrations/
│   │   └── 20260903_amenagactif_core.sql    Task 2 — schéma + RLS
│   └── seed/
│       ├── catalogue.json          Task 3 — généré
│       └── seed_catalogue.sql      Task 3 — généré, à exécuter dans Supabase
├── api/
│   ├── _lib/
│   │   ├── supabaseAdmin.js        client service-role (serverless only)
│   │   ├── jwt.js                  signFicheToken / verifyFicheToken (jose)
│   │   └── ficheData.js            charge les lignes brutes d'une classe → entrée des projections
│   ├── _assets/
│   │   └── plai-logo.jpg           copié depuis portail-plai
│   ├── fiche-token.js              GET ?token= → données fiche (public, lecture seule)
│   └── fiche-pdf.js                GET ?type=classe|eleve&id= → PDF
├── public/
│   └── plai-logo.jpg
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── plai-style.css              copié depuis shared/css/plai-style.css
│   ├── lib/
│   │   ├── supabase.js             client anon (front)
│   │   ├── auth.jsx                AuthProvider + useAuth + useRole
│   │   └── queryClient.js
│   ├── domain/
│   │   ├── types.js                @typedef JSDoc
│   │   ├── normalise.js            normaliseLibelle() — matching de libellés
│   │   └── projections/
│   │       ├── ficheClasse.js      computeFicheClasse()
│   │       ├── ficheEleve.js       computeFicheEleve()
│   │       ├── profilDiffActif.js  computeProfilDiffActif()
│   │       └── snapshot.js         buildSnapshot() + diffSnapshots()
│   ├── hooks/
│   │   ├── useCatalogue.js
│   │   ├── useEcoleGrid.js         charge écoles/années/classes/élèves/sélections d'une école
│   │   └── useGridMutations.js     toggleAR / toggleAU / upsertEleve / addLibre / removeLibre
│   ├── components/
│   │   ├── Nav.jsx
│   │   ├── Footer.jsx
│   │   ├── RequireAuth.jsx
│   │   ├── RequireRole.jsx
│   │   ├── saisie/
│   │   │   ├── SelecteurContexte.jsx
│   │   │   ├── BarreSaut.jsx
│   │   │   ├── EnTeteEleves.jsx
│   │   │   ├── EleveEditor.jsx
│   │   │   ├── BandeauAU.jsx
│   │   │   ├── ChapitreAR.jsx
│   │   │   └── AmenagementLibreForm.jsx
│   │   └── fiche/
│   │       ├── FicheClasseView.jsx
│   │       └── FicheEleveView.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── SaisieEcole.jsx
│   │   ├── FicheClassePage.jsx
│   │   ├── FicheElevePage.jsx
│   │   ├── FichePublique.jsx
│   │   └── NotFound.jsx
│   └── test/
│       ├── setup.js
│       └── fixtures/
│           └── sample.js           jeu de données minimal partagé par les tests
└── tests/
    └── domain/
        ├── ficheClasse.test.js
        ├── ficheEleve.test.js
        ├── profilDiffActif.test.js
        ├── snapshot.test.js
        └── normalise.test.js
```

**Responsabilités :**
- `domain/projections/*` : pur, sans I/O, 100 % testé.
- `api/_lib/ficheData.js` : seul endroit qui traduit « id de classe » → tableaux bruts pour les projections (réutilisé par `fiche-token`, `fiche-pdf`, et le Plan 2).
- `hooks/*` : accès Supabase côté front, jamais de logique de présentation.
- `components/saisie/*` : la grille, découpée pour rester lisible (chaque sous-composant < 150 lignes).

---

## Task 1 : Scaffolding du projet

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.gitignore`, `.env.example`, `vercel.json`
- Create: `src/main.jsx`, `src/App.jsx`, `src/plai-style.css`, `src/lib/queryClient.js`
- Create: `src/pages/NotFound.jsx`
- Create: `public/plai-logo.jpg` (copie)

- [ ] **Step 1 : Initialiser le dépôt et npm**

```bash
cd "C:/Users/jfbeg/OneDrive/claude-workspace/AmenagActif"
git init -b main
npm init -y
npm i react react-dom react-router-dom @supabase/supabase-js @tanstack/react-query jose
npm i -D vite @vitejs/plugin-react tailwindcss@3 postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2 : Écrire les fichiers de config**

`vite.config.js` :
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

`vitest.config.js` :
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
  },
});
```

`tailwind.config.js` (fix `import.meta.url`, cf. CLAUDE.md) :
```js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

export default {
  content: [join(here, 'index.html'), join(here, 'src/**/*.{js,jsx}')],
  theme: {
    extend: {
      colors: { teal: '#0a9370', orange: '#f97316' },
      fontFamily: { sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
```

`postcss.config.js` :
```js
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default { plugins: [tailwindcss, autoprefixer] };
```

`index.html` :
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/plai-logo.jpg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>AménagActif</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`.gitignore` :
```
node_modules
dist
.env.local
.env*.local
.vercel
*.log
```

`.env.example` :
```
VITE_SUPABASE_URL=https://dfoaumjleqtxjeaplnna.supabase.co
VITE_SUPABASE_ANON_KEY=
# Serverless only (Vercel env, jamais dans le front) :
SUPABASE_SERVICE_ROLE_KEY=
AMENAG_TOKEN_SECRET=
```

`vercel.json` :
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "functions": {
    "api/fiche-pdf.js": { "includeFiles": "api/_assets/**" }
  }
}
```

- [ ] **Step 3 : Scripts `package.json`**

Ajouter dans `package.json` :
```json
"type": "module",
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4 : CSS PLAI, logo, entrée React**

```bash
cp "C:/Users/jfbeg/OneDrive/claude-workspace/shared/css/plai-style.css" src/plai-style.css
cp "C:/Users/jfbeg/OneDrive/claude-workspace/projets/portail-plai/public/plai-logo.jpg" public/plai-logo.jpg
mkdir -p api/_assets && cp public/plai-logo.jpg api/_assets/plai-logo.jpg
```

Ajouter en tête de `src/plai-style.css` :
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/lib/queryClient.js` :
```js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
```

`src/main.jsx` :
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { AuthProvider } from './lib/auth.jsx';
import App from './App.jsx';
import './plai-style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

`src/pages/NotFound.jsx` :
```jsx
export default function NotFound() {
  return <div className="plai-section"><p className="plai-empty">Page introuvable.</p></div>;
}
```

`src/App.jsx` (placeholder, complété Task 5) :
```jsx
import { Routes, Route } from 'react-router-dom';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div className="plai-section">AménagActif</div>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

`src/test/setup.js` :
```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5 : Vérifier build + dev**

Run: `npm run build`
Expected: `dist/` généré, aucune erreur.

Run: `npm run dev` puis ouvrir `http://localhost:5173`
Expected: page affichant « AménagActif ».

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "chore: scaffolding Vite + React + Tailwind + PLAI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 7 : Créer le dépôt GitHub et pousser**

```bash
git remote add origin https://github.com/jfb4plai/AmenagActif.git
git push -u origin main
```
Expected: push OK (credentials GCM en cache pour jfb4plai). Si le dépôt n'existe pas, le créer d'abord sur github.com (compte jfb4plai), repo `AmenagActif`, vide.

---

## Task 2 : Schéma Supabase + RLS

**Files:**
- Create: `supabase/migrations/20260903_amenagactif_core.sql`

- [ ] **Step 1 : Écrire la migration**

`supabase/migrations/20260903_amenagactif_core.sql` :
```sql
-- AménagActif — schéma coeur. Projet partagé dfoaumjleqtxjeaplnna.
-- Toutes les tables préfixées ar_. NE PAS recréer profiles ni le trigger updated_at.

-- ============ Tables de référence ============
create table if not exists ar_annees (
  id uuid primary key default gen_random_uuid(),
  libelle text not null unique,               -- '2025-2026'
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ar_ecoles (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  implantation text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ar_chapitres (
  id uuid primary key default gen_random_uuid(),
  ordre int not null unique,
  titre text not null
);

create table if not exists ar_amenagements (
  id uuid primary key default gen_random_uuid(),
  chapitre_id uuid not null references ar_chapitres(id) on delete cascade,
  ordre int not null,
  libelle text not null,
  type text not null check (type in ('AU','AR')),
  actif boolean not null default true,
  unique (chapitre_id, ordre)
);

-- ============ Accès ============
create table if not exists ar_profils_acces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('plai','direction')),
  ecole_id uuid references ar_ecoles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists ar_referents_ecole (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null,
  fonction text not null check (fonction in ('direction','referent_ecole','plai')),
  created_at timestamptz not null default now()
);

-- ============ Métier ============
create table if not exists ar_classes (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null,
  niveau text,
  created_at timestamptz not null default now(),
  unique (ecole_id, annee_id, nom)
);

create table if not exists ar_eleves (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references ar_classes(id) on delete cascade,
  prenom text not null,
  initiale_nom text not null default '',
  referent_plai_nom text not null default '',
  eleve_precedent_id uuid references ar_eleves(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists ar_amenagements_classe (
  classe_id uuid not null references ar_classes(id) on delete cascade,
  amenagement_id uuid not null references ar_amenagements(id) on delete cascade,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (classe_id, amenagement_id)
);

create table if not exists ar_selections (
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  amenagement_id uuid not null references ar_amenagements(id) on delete cascade,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (eleve_id, amenagement_id)
);

create table if not exists ar_amenagements_libres (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  chapitre_id uuid references ar_chapitres(id) on delete set null,
  texte text not null,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id)
);

create table if not exists ar_enseignants (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references ar_classes(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null,
  email text not null,
  cours text,
  created_at timestamptz not null default now()
);

create table if not exists ar_fiche_snapshots (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references ar_classes(id) on delete cascade,
  fige_le timestamptz not null default now(),
  fige_par uuid references auth.users(id),
  contenu jsonb not null,
  envoi_le timestamptz
);

create table if not exists ar_envois (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references ar_fiche_snapshots(id) on delete cascade,
  enseignant_id uuid references ar_enseignants(id) on delete set null,
  destinataire_email text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente','simule','envoye','erreur')),
  erreur text,
  envoye_le timestamptz
);

-- ============ Helpers RLS ============
create or replace function ar_is_plai() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and role = 'plai' and ecole_id is null
  );
$$;

create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_plai() or exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and ecole_id = target
  );
$$;

-- ============ RLS ============
alter table ar_annees              enable row level security;
alter table ar_ecoles              enable row level security;
alter table ar_chapitres           enable row level security;
alter table ar_amenagements        enable row level security;
alter table ar_profils_acces       enable row level security;
alter table ar_referents_ecole     enable row level security;
alter table ar_classes             enable row level security;
alter table ar_eleves              enable row level security;
alter table ar_amenagements_classe enable row level security;
alter table ar_selections          enable row level security;
alter table ar_amenagements_libres enable row level security;
alter table ar_enseignants         enable row level security;
alter table ar_fiche_snapshots     enable row level security;
alter table ar_envois              enable row level security;

-- Référence : lecture pour tout authentifié, écriture PLAI
create policy ar_ref_read_annees   on ar_annees       for select to authenticated using (true);
create policy ar_ref_write_annees  on ar_annees       for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_ref_read_chap     on ar_chapitres    for select to authenticated using (true);
create policy ar_ref_write_chap    on ar_chapitres    for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_ref_read_amgt     on ar_amenagements for select to authenticated using (true);
create policy ar_ref_write_amgt    on ar_amenagements for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());

-- Accès
create policy ar_acces_self   on ar_profils_acces for select to authenticated using (user_id = auth.uid() or ar_is_plai());
create policy ar_acces_admin  on ar_profils_acces for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());

-- Écoles
create policy ar_ecoles_read  on ar_ecoles for select to authenticated using (ar_can_read_ecole(id));
create policy ar_ecoles_write on ar_ecoles for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());

-- Référents / classes (ecole_id direct)
create policy ar_ref_ecole_read  on ar_referents_ecole for select to authenticated using (ar_can_read_ecole(ecole_id));
create policy ar_ref_ecole_write on ar_referents_ecole for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_classes_read    on ar_classes for select to authenticated using (ar_can_read_ecole(ecole_id));
create policy ar_classes_write   on ar_classes for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_enseignants_read  on ar_enseignants for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_enseignants_write on ar_enseignants for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

-- Élèves & sélections (ecole via classe)
create policy ar_eleves_read  on ar_eleves for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_eleves_write on ar_eleves for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_amgt_classe_read  on ar_amenagements_classe for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_amgt_classe_write on ar_amenagements_classe for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_selections_read  on ar_selections for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));
create policy ar_selections_write on ar_selections for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_libres_read  on ar_amenagements_libres for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));
create policy ar_libres_write on ar_amenagements_libres for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_snap_read  on ar_fiche_snapshots for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_snap_write on ar_fiche_snapshots for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_envois_read  on ar_envois for select to authenticated
  using (ar_is_plai());
create policy ar_envois_write on ar_envois for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());
```

- [ ] **Step 2 : Vérifier l'absence de collision de noms de tables**

Run:
```bash
grep -rn "create table" "C:/Users/jfbeg/OneDrive/claude-workspace/projets" "C:/Users/jfbeg/OneDrive/claude-workspace/socraactif/supabase" "C:/Users/jfbeg/OneDrive/claude-workspace/LireActif" "C:/Users/jfbeg/OneDrive/claude-workspace/corpusactif" 2>/dev/null | grep -i "ar_"
```
Expected: aucune ligne (aucun préfixe `ar_` existant ailleurs). Si collision, renommer le préfixe en `amng_` partout dans ce plan.

- [ ] **Step 3 : Appliquer la migration**

Ouvrir le SQL Editor du projet Supabase `dfoaumjleqtxjeaplnna`, coller le contenu de la migration, exécuter.
Expected: « Success. No rows returned ». Vérifier dans Table Editor que les 14 tables `ar_*` existent avec RLS activé (icône cadenas).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): schéma coeur ar_* + RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3 : Catalogue des aménagements (seed)

**Files:**
- Create: `scripts/generate-catalogue.mjs`
- Create: `supabase/seed/catalogue.json` (généré)
- Create: `supabase/seed/seed_catalogue.sql` (généré)

- [ ] **Step 1 : Écrire le script d'extraction**

`scripts/generate-catalogue.mjs` :
```js
// Génère supabase/seed/catalogue.json + seed_catalogue.sql depuis le classeur source.
// Usage : node scripts/generate-catalogue.mjs
import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';

const SRC = 'C:/Users/jfbeg/OneDrive/enseignement/pôle territorial/AR/uniformisation des tableaux AR/Classeur source AR.xlsx';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.getWorksheet('Feuil1');

const chapitres = [];
let ordreChap = 0;
let ordreItem = 0;

ws.eachRow((row) => {
  const raw = row.getCell(1).value;
  if (raw == null) return;
  const t = String(raw).replace(/\u00a0/g, ' ').trim();
  if (!t) return;
  if (/^\d+\.\s/.test(t)) {
    ordreChap += 1;
    ordreItem = 0;
    chapitres.push({ ordre: ordreChap, titre: t, items: [] });
    return;
  }
  if (t.includes('cliquer sur') || t === 'AR' || t === 'Classe' || /^El[eè]ve/i.test(t)) return;
  if (chapitres.length === 0) return;
  ordreItem += 1;
  const type = t.startsWith('AU ') ? 'AU' : 'AR';
  const libelle = type === 'AU' ? t.slice(3).trim() : t;
  chapitres.at(-1).items.push({ ordre: ordreItem, type, libelle });
});

writeFileSync('supabase/seed/catalogue.json', JSON.stringify(chapitres, null, 2), 'utf8');

const esc = (s) => s.replace(/'/g, "''");
const lines = ['-- Généré par scripts/generate-catalogue.mjs — ne pas éditer à la main', 'begin;'];
for (const c of chapitres) {
  lines.push(
    `insert into ar_chapitres (ordre, titre) values (${c.ordre}, '${esc(c.titre)}') on conflict (ordre) do update set titre = excluded.titre;`
  );
  for (const it of c.items) {
    lines.push(
      `insert into ar_amenagements (chapitre_id, ordre, libelle, type) ` +
        `select id, ${it.ordre}, '${esc(it.libelle)}', '${it.type}' from ar_chapitres where ordre = ${c.ordre} ` +
        `on conflict (chapitre_id, ordre) do update set libelle = excluded.libelle, type = excluded.type;`
    );
  }
}
lines.push('commit;');
writeFileSync('supabase/seed/seed_catalogue.sql', lines.join('\n'), 'utf8');

const total = chapitres.reduce((n, c) => n + c.items.length, 0);
console.log(`${chapitres.length} chapitres, ${total} aménagements → supabase/seed/`);
```

- [ ] **Step 2 : Installer exceljs et générer**

```bash
npm i -D exceljs
node scripts/generate-catalogue.mjs
```
Expected sortie : `12 chapitres, 131 aménagements → supabase/seed/`
Vérifier `supabase/seed/catalogue.json` : accents corrects (`réponse`, `élève`), pas de `�`.

- [ ] **Step 3 : Appliquer le seed dans Supabase**

Coller `supabase/seed/seed_catalogue.sql` dans le SQL Editor Supabase, exécuter.
Run (SQL Editor, vérification) : `select count(*) from ar_amenagements;`
Expected: `131`. Et `select count(*) from ar_chapitres;` → `12`.

- [ ] **Step 4 : Commit**

```bash
git add scripts/generate-catalogue.mjs supabase/seed/ package.json
git commit -m "feat(db): script d'extraction + seed du catalogue (12 chapitres, 131 aménagements)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4 : Client Supabase + authentification

**Files:**
- Create: `src/lib/supabase.js`, `src/lib/auth.jsx`
- Create: `src/pages/Login.jsx`
- Create: `src/components/RequireAuth.jsx`

- [ ] **Step 1 : Client anon**

`src/lib/supabase.js` :
```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants (voir .env.example)');
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 2 : AuthProvider + hooks**

`src/lib/auth.jsx` :
```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, ready }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}

/** @returns {{ role: 'plai'|'direction'|null, ecoleId: string|null, isPlai: boolean, loading: boolean }} */
export function useRole() {
  const { session, ready } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['role', session?.user?.id],
    enabled: ready && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_profils_acces')
        .select('role, ecole_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    role: data?.role ?? null,
    ecoleId: data?.ecole_id ?? null,
    isPlai: data?.role === 'plai' && !data?.ecole_id,
    loading: !ready || (!!session && isLoading),
  };
}
```

- [ ] **Step 3 : Page de connexion**

`src/pages/Login.jsx` :
```jsx
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { session, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (ready && session) return <Navigate to="/" replace />;

  async function soumettre(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
    setEnvoi(false);
    if (error) setErreur("Connexion impossible. Vérifiez l'adresse et le mot de passe.");
  }

  return (
    <div className="plai-section max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Connexion — AménagActif</h1>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-medium">Adresse e-mail</label>
          <input id="email" type="email" required className="plai-input w-full"
            placeholder="prenom.nom@ecole.be" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <p className="text-sm text-[color:var(--text3)]">Votre adresse professionnelle. Le compte est créé par l'équipe PLAI.</p>
        </div>
        <div>
          <label htmlFor="mdp" className="block font-medium">Mot de passe</label>
          <input id="mdp" type="password" required className="plai-input w-full"
            value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </div>
        {erreur && <p className="plai-error">{erreur}</p>}
        <button type="submit" className="plai-btn" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4 : Garde d'authentification**

`src/components/RequireAuth.jsx` :
```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function RequireAuth({ children }) {
  const { session, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="plai-section">Chargement…</div>;
  if (!session) return <Navigate to="/connexion" replace state={{ from: loc.pathname }} />;
  return children;
}
```

- [ ] **Step 5 : Vérifier manuellement**

Dans le SQL Editor Supabase : créer un utilisateur de test via Authentication → Users → Add user (email + mot de passe), puis
```sql
insert into ar_profils_acces (user_id, role) values ('<uuid-user>', 'plai');
```
Créer `.env.local` à partir de `.env.example` (URL + anon key du projet).
Run: `npm run dev`, aller sur `/connexion`, se connecter.
Expected: redirection vers `/`, pas d'erreur console.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/ src/pages/Login.jsx src/components/RequireAuth.jsx
git commit -m "feat(auth): connexion Supabase + AuthProvider + useRole

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5 : Coquille applicative (nav, footer, rôles, routes)

**Files:**
- Create: `src/components/Nav.jsx`, `src/components/Footer.jsx`, `src/components/RequireRole.jsx`
- Modify: `src/App.jsx` (routes complètes)

- [ ] **Step 1 : Nav (branding PLAI)**

`src/components/Nav.jsx` :
```jsx
import { Link, NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRole } from '../lib/auth.jsx';

const lien = ({ isActive }) => (isActive ? 'font-semibold text-teal' : 'text-[color:var(--text2)]');

export default function Nav() {
  const { role } = useRole();
  return (
    <header className="plai-nav flex items-center gap-6 px-4 py-2 border-b border-[color:var(--border)]">
      <Link to="/" className="flex items-center gap-2">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
        <span className="font-serif text-lg">AménagActif</span>
      </Link>
      <nav className="flex gap-4 text-sm">
        <NavLink to="/saisie" className={lien}>Saisie</NavLink>
        <NavLink to="/fiches" className={lien}>Fiches</NavLink>
      </nav>
      <div className="ml-auto text-sm flex items-center gap-3">
        {role && <span className="text-[color:var(--text3)]">{role === 'plai' ? 'Référent PLAI' : 'Direction'}</span>}
        <button className="plai-btn" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </div>
    </header>
  );
}
```

`src/components/Footer.jsx` :
```jsx
export default function Footer() {
  return (
    <footer className="plai-footer flex items-center gap-3 px-4 py-6 text-sm text-[color:var(--text3)]">
      <img src="/plai-logo.jpg" alt="" style={{ height: 40, width: 'auto' }} />
      <span>AménagActif — Pôle Territorial de la Ville de Liège (PLAI). Diffusion restreinte aux enseignants concernés.</span>
    </footer>
  );
}
```

- [ ] **Step 2 : Garde de rôle**

`src/components/RequireRole.jsx` :
```jsx
import { useRole } from '../lib/auth.jsx';

/** roles: tableau de rôles autorisés, ex. ['plai'] */
export default function RequireRole({ roles, children }) {
  const { role, loading } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  if (!role || !roles.includes(role)) {
    return <div className="plai-section"><p className="plai-error">Accès non autorisé pour votre profil.</p></div>;
  }
  return children;
}
```

- [ ] **Step 3 : Routes**

`src/App.jsx` :
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireRole from './components/RequireRole.jsx';
import Login from './pages/Login.jsx';
import SaisieEcole from './pages/SaisieEcole.jsx';
import FicheClassePage from './pages/FicheClassePage.jsx';
import FicheElevePage from './pages/FicheElevePage.jsx';
import FichePublique from './pages/FichePublique.jsx';
import NotFound from './pages/NotFound.jsx';

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Navigate to="/saisie" replace /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={['plai']}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={['plai','direction']}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
```

- [ ] **Step 4 : Stubs de pages pour compiler**

Créer des stubs minimaux (remplacés aux tasks suivantes) :

`src/pages/SaisieEcole.jsx` :
```jsx
export default function SaisieEcole() {
  return <div className="plai-section">Saisie (à venir)</div>;
}
```
`src/pages/FicheClassePage.jsx` :
```jsx
export default function FicheClassePage({ picker }) {
  return <div className="plai-section">Fiche classe {picker ? '(sélecteur)' : ''} (à venir)</div>;
}
```
`src/pages/FicheElevePage.jsx` :
```jsx
export default function FicheElevePage() {
  return <div className="plai-section">Fiche élève (à venir)</div>;
}
```
`src/pages/FichePublique.jsx` :
```jsx
export default function FichePublique() {
  return <div className="plai-section">Fiche publique (à venir)</div>;
}
```

- [ ] **Step 5 : Vérifier**

Run: `npm run build` → OK.
Run: `npm run dev`, se connecter, vérifier nav + footer + redirection `/` → `/saisie`.

- [ ] **Step 6 : Commit**

```bash
git add src/App.jsx src/components/ src/pages/
git commit -m "feat(shell): nav + footer PLAI, gardes de rôle, routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6 : Types du domaine + normalisation de libellés + fixtures

**Files:**
- Create: `src/domain/types.js`, `src/domain/normalise.js`
- Create: `src/test/fixtures/sample.js`
- Test: `tests/domain/normalise.test.js`

- [ ] **Step 1 : Écrire le test de normalisation**

`tests/domain/normalise.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { normaliseLibelle } from '../../src/domain/normalise.js';

describe('normaliseLibelle', () => {
  it('supprime accents, casse, espaces insécables et ponctuation de bord', () => {
    expect(normaliseLibelle('  Doubler les espaces de réponse\u00a0')).toBe(
      normaliseLibelle('doubler les espaces de reponse')
    );
  });
  it('réduit les espaces multiples', () => {
    expect(normaliseLibelle('Parler   sans  se déplacer')).toBe('parler sans se deplacer');
  });
  it('ignore le préfixe AU', () => {
    expect(normaliseLibelle('AU Mise en page')).toBe(normaliseLibelle('Mise en page'));
  });
});
```

- [ ] **Step 2 : Lancer le test (échec attendu)**

Run: `npx vitest run tests/domain/normalise.test.js`
Expected: FAIL — `normaliseLibelle` non défini.

- [ ] **Step 3 : Implémenter**

`src/domain/normalise.js` :
```js
/**
 * Forme canonique d'un libellé d'aménagement pour comparaison / matching d'import.
 * @param {string} s
 * @returns {string}
 */
export function normaliseLibelle(s) {
  return String(s ?? '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^au\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4 : Lancer le test (succès attendu)**

Run: `npx vitest run tests/domain/normalise.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5 : Types + fixtures**

`src/domain/types.js` :
```js
/**
 * @typedef {Object} Chapitre
 * @property {string} id
 * @property {number} ordre
 * @property {string} titre
 *
 * @typedef {Object} Amenagement
 * @property {string} id
 * @property {string} chapitre_id
 * @property {number} ordre
 * @property {string} libelle
 * @property {'AU'|'AR'} type
 *
 * @typedef {Object} Eleve
 * @property {string} id
 * @property {string} classe_id
 * @property {string} prenom
 * @property {string} initiale_nom
 * @property {string} referent_plai_nom
 *
 * @typedef {Object} Classe
 * @property {string} id
 * @property {string} nom
 * @property {string} ecole_id
 * @property {string} annee_id
 *
 * @typedef {Object} SelectionAR   // ar_selections
 * @property {string} eleve_id
 * @property {string} amenagement_id
 *
 * @typedef {Object} AmenagementLibre
 * @property {string} id
 * @property {string} eleve_id
 * @property {string|null} chapitre_id
 * @property {string} texte
 *
 * @typedef {Object} ReferentEcole
 * @property {string} nom
 * @property {'direction'|'referent_ecole'|'plai'} fonction
 *
 * @typedef {Object} FicheClasseVM
 * @property {string} classeNom
 * @property {string} ecoleNom
 * @property {string} anneeLibelle
 * @property {string|null} dateMaj              ISO
 * @property {{ pia: string[], par: string[] }} tableauReferents
 * @property {{ libelle: string, chapitreTitre: string, surligne: boolean }[]} pourTous
 * @property {{ eleve: string, amenagements: string[] }[]} parEleve
 * @property {number} nbRecto
 *
 * @typedef {Object} FicheEleveVM
 * @property {string} eleve
 * @property {string} classeNom
 * @property {{ chapitreTitre: string, amenagements: string[] }[]} parChapitre
 */
export {};
```

Constante partagée du libellé « recto » (source unique de vérité pour `computeFicheClasse`) :
`src/domain/normalise.js` — ajouter :
```js
/** Libellé de l'AR compté pour « nombre de cours à imprimer en recto ». */
export const LIBELLE_RECTO_NORMALISE = normaliseLibelle('Cours uniquement en recto');
```
> Note : si cet AR n'existe pas encore dans le catalogue extrait (le classeur source le portait dans « Pour tous »), l'ajouter au chapitre 1 via le SQL Editor :
> ```sql
> insert into ar_amenagements (chapitre_id, ordre, libelle, type)
> select id, 19, 'Cours uniquement en recto', 'AR' from ar_chapitres where ordre = 1
> on conflict (chapitre_id, ordre) do nothing;
> ```

`src/test/fixtures/sample.js` :
```js
// Jeu minimal : 1 école, 1 année, 2 classes (5LA, 3TP), 3 élèves, catalogue réduit.
export const chapitres = [
  { id: 'c1', ordre: 1, titre: '1. SUPPORTS ET DOCUMENTS ÉCRITS, MISE EN PAGE & CONSIGNES' },
  { id: 'c5', ordre: 5, titre: '5. LECTURE' },
];

export const amenagements = [
  { id: 'a-au1', chapitre_id: 'c1', ordre: 1, libelle: 'Mise en page', type: 'AU' },
  { id: 'a-ar1', chapitre_id: 'c1', ordre: 2, libelle: 'Doubler les espaces de réponse', type: 'AR' },
  { id: 'a-recto', chapitre_id: 'c1', ordre: 19, libelle: 'Cours uniquement en recto', type: 'AR' },
  { id: 'a-ar5', chapitre_id: 'c5', ordre: 1, libelle: 'Utiliser les livres audio pour la lecture', type: 'AR' },
];

export const classe5LA = { id: 'cl-5la', nom: '5LA', ecole_id: 'ec1', annee_id: 'an1' };

export const eleves = [
  { id: 'e1', classe_id: 'cl-5la', prenom: 'Emilie', initiale_nom: 'D', referent_plai_nom: 'Mona' },
  { id: 'e2', classe_id: 'cl-5la', prenom: 'Karim', initiale_nom: 'B', referent_plai_nom: 'Mona' },
  { id: 'e3', classe_id: 'cl-5la', prenom: 'Lea', initiale_nom: 'M', referent_plai_nom: 'Carole' },
];

export const auClasse = [{ classe_id: 'cl-5la', amenagement_id: 'a-au1', cree_le: '2026-09-01T08:00:00Z' }];

export const selectionsAR = [
  { eleve_id: 'e1', amenagement_id: 'a-ar1', cree_le: '2026-09-02T08:00:00Z' },
  { eleve_id: 'e1', amenagement_id: 'a-recto', cree_le: '2026-09-02T08:00:00Z' },
  { eleve_id: 'e3', amenagement_id: 'a-ar5', cree_le: '2026-09-03T08:00:00Z' },
  { eleve_id: 'e3', amenagement_id: 'a-recto', cree_le: '2026-09-03T08:00:00Z' },
];

export const libres = [
  { id: 'l1', eleve_id: 'e1', chapitre_id: 'c1', texte: 'Vérifier oralement la consigne avant de commencer' },
];

export const referents = [
  { nom: 'Julien', fonction: 'direction' },
  { nom: 'Mona', fonction: 'plai' },
];

export const contexte = { classeNom: '5LA', ecoleNom: 'Athénée X', anneeLibelle: '2025-2026' };
```

- [ ] **Step 6 : Commit**

```bash
git add src/domain/ src/test/fixtures/ tests/domain/normalise.test.js
git commit -m "feat(domain): types JSDoc, normalisation de libellés, fixtures

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7 : Projection `computeFicheClasse`

**Files:**
- Create: `src/domain/projections/ficheClasse.js`
- Test: `tests/domain/ficheClasse.test.js`

- [ ] **Step 1 : Écrire les tests**

`tests/domain/ficheClasse.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import * as f from '../../src/test/fixtures/sample.js';

const args = () => ({
  classe: f.classe5LA,
  contexte: f.contexte,
  eleves: f.eleves,
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
  referents: f.referents,
});

describe('computeFicheClasse', () => {
  it('place les AU de la classe dans pourTous, triés par ordre de chapitre', () => {
    const vm = computeFicheClasse(args());
    expect(vm.pourTous.map((x) => x.libelle)).toEqual(['Mise en page']);
    expect(vm.pourTous[0].chapitreTitre).toContain('1. SUPPORTS');
  });

  it('marque surligne=true pour l\'AU « Mise en page »', () => {
    const vm = computeFicheClasse(args());
    expect(vm.pourTous[0].surligne).toBe(true);
  });

  it('regroupe les AR par élève et masque les élèves sans AR spécifique', () => {
    const vm = computeFicheClasse(args());
    const noms = vm.parEleve.map((x) => x.eleve);
    expect(noms).toEqual(['Emilie D.', 'Lea M.']); // Karim n'a aucun AR
    const emilie = vm.parEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.amenagements).toContain('Doubler les espaces de réponse');
    expect(emilie.amenagements).toContain('Vérifier oralement la consigne avant de commencer');
  });

  it('ne compte pas l\'AR « recto » comme AR spécifique affiché', () => {
    const vm = computeFicheClasse(args());
    const emilie = vm.parEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.amenagements).not.toContain('Cours uniquement en recto');
  });

  it('nbRecto = nombre d\'élèves ayant l\'AR recto', () => {
    const vm = computeFicheClasse(args());
    expect(vm.nbRecto).toBe(2); // Emilie + Lea
  });

  it('tableauReferents sépare PIA (accompagnateurs élèves) et PAR (direction)', () => {
    const vm = computeFicheClasse(args());
    expect(vm.tableauReferents.pia.sort()).toEqual(['Carole', 'Mona']);
    expect(vm.tableauReferents.par).toEqual(['Julien']);
  });

  it('dateMaj = date de sélection la plus récente', () => {
    const vm = computeFicheClasse(args());
    expect(vm.dateMaj).toBe('2026-09-03T08:00:00Z');
  });

  it('classe vide → pourTous et parEleve vides, nbRecto 0', () => {
    const vm = computeFicheClasse({ ...args(), eleves: [], selectionsAR: [], auClasse: [], libres: [] });
    expect(vm.pourTous).toEqual([]);
    expect(vm.parEleve).toEqual([]);
    expect(vm.nbRecto).toBe(0);
    expect(vm.dateMaj).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run tests/domain/ficheClasse.test.js`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implémenter**

`src/domain/projections/ficheClasse.js` :
```js
import { normaliseLibelle, LIBELLE_RECTO_NORMALISE } from '../normalise.js';

const LIBELLE_MISE_EN_PAGE = normaliseLibelle('Mise en page');

/**
 * @param {{
 *  classe: import('../types.js').Classe,
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  auClasse: { amenagement_id: string, cree_le?: string }[],
 *  selectionsAR: import('../types.js').SelectionAR[] & { cree_le?: string }[],
 *  libres: import('../types.js').AmenagementLibre[],
 *  referents: import('../types.js').ReferentEcole[],
 * }} input
 * @returns {import('../types.js').FicheClasseVM}
 */
export function computeFicheClasse(input) {
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres, referents } = input;

  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const chapOrdre = (amgt) => chapById.get(amgt?.chapitre_id)?.ordre ?? 999;
  const chapTitre = (amgt) => chapById.get(amgt?.chapitre_id)?.titre ?? '';

  // --- Pour tous : AU retenus pour la classe ---
  const pourTous = auClasse
    .map((x) => amgtById.get(x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
    .map((a) => ({
      libelle: a.libelle,
      chapitreTitre: chapTitre(a),
      surligne: normaliseLibelle(a.libelle) === LIBELLE_MISE_EN_PAGE,
    }));

  // --- AR par élève ---
  const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;
  const arParEleveId = new Map();
  for (const s of selectionsAR) {
    const a = amgtById.get(s.amenagement_id);
    if (!a || a.type !== 'AR') continue;
    if (normaliseLibelle(a.libelle) === LIBELLE_RECTO_NORMALISE) continue; // compté ailleurs
    if (!arParEleveId.has(s.eleve_id)) arParEleveId.set(s.eleve_id, []);
    arParEleveId.get(s.eleve_id).push(a);
  }
  const libresParEleveId = new Map();
  for (const l of libres) {
    if (!libresParEleveId.has(l.eleve_id)) libresParEleveId.set(l.eleve_id, []);
    libresParEleveId.get(l.eleve_id).push(l.texte);
  }

  const parEleve = eleves
    .map((e) => {
      const cat = (arParEleveId.get(e.id) ?? [])
        .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
        .map((a) => a.libelle);
      const amenagements = [...cat, ...(libresParEleveId.get(e.id) ?? [])];
      return { eleve: nomEleve(e), amenagements };
    })
    .filter((x) => x.amenagements.length > 0);

  // --- Nombre de cours à imprimer en recto ---
  const eleveIds = new Set(eleves.map((e) => e.id));
  const nbRecto = new Set(
    selectionsAR
      .filter((s) => {
        const a = amgtById.get(s.amenagement_id);
        return a && eleveIds.has(s.eleve_id) && normaliseLibelle(a.libelle) === LIBELLE_RECTO_NORMALISE;
      })
      .map((s) => s.eleve_id)
  ).size;

  // --- Référents ---
  const pia = [...new Set(eleves.map((e) => e.referent_plai_nom).filter(Boolean))];
  const par = referents.filter((r) => r.fonction === 'direction' || r.fonction === 'referent_ecole').map((r) => r.nom);

  // --- Date de mise à jour ---
  const dates = [
    ...selectionsAR.map((s) => s.cree_le),
    ...auClasse.map((x) => x.cree_le),
  ].filter(Boolean).sort();
  const dateMaj = dates.length ? dates[dates.length - 1] : null;

  return {
    classeNom: contexte.classeNom,
    ecoleNom: contexte.ecoleNom,
    anneeLibelle: contexte.anneeLibelle,
    dateMaj,
    tableauReferents: { pia, par },
    pourTous,
    parEleve,
    nbRecto,
  };
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run tests/domain/ficheClasse.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/projections/ficheClasse.js tests/domain/ficheClasse.test.js src/domain/normalise.js
git commit -m "feat(domain): computeFicheClasse (pour tous / par élève / nbRecto / référents)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8 : Projection `computeFicheEleve`

**Files:**
- Create: `src/domain/projections/ficheEleve.js`
- Test: `tests/domain/ficheEleve.test.js`

- [ ] **Step 1 : Écrire les tests**

`tests/domain/ficheEleve.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { computeFicheEleve } from '../../src/domain/projections/ficheEleve.js';
import * as f from '../../src/test/fixtures/sample.js';

const args = (eleveId) => ({
  eleve: f.eleves.find((e) => e.id === eleveId),
  classeNom: '5LA',
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
});

describe('computeFicheEleve', () => {
  it('liste les AR (dont recto) et les aménagements libres, groupés par chapitre ordonné', () => {
    const vm = computeFicheEleve(args('e1'));
    expect(vm.eleve).toBe('Emilie D.');
    const ch1 = vm.parChapitre.find((c) => c.chapitreTitre.startsWith('1.'));
    expect(ch1.amenagements).toEqual([
      'Doubler les espaces de réponse',
      'Cours uniquement en recto',
      'Vérifier oralement la consigne avant de commencer',
    ]);
  });

  it('élève sans aménagement → parChapitre vide', () => {
    const vm = computeFicheEleve(args('e2'));
    expect(vm.parChapitre).toEqual([]);
  });

  it('ne crée pas de chapitre vide', () => {
    const vm = computeFicheEleve(args('e3'));
    expect(vm.parChapitre.map((c) => c.chapitreTitre.slice(0, 2))).toEqual(['1.', '5.']);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run tests/domain/ficheEleve.test.js`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

`src/domain/projections/ficheEleve.js` :
```js
/**
 * @param {{
 *  eleve: import('../types.js').Eleve,
 *  classeNom: string,
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 * }} input
 * @returns {import('../types.js').FicheEleveVM}
 */
export function computeFicheEleve(input) {
  const { eleve, classeNom, amenagements, chapitres, selectionsAR, libres } = input;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));

  const nomEleve = `${eleve.prenom}${eleve.initiale_nom ? ' ' + eleve.initiale_nom + '.' : ''}`;

  // chapitre_id -> [{ ordre, libelle }]
  const parChapId = new Map();
  const push = (chapId, ordre, libelle) => {
    if (!parChapId.has(chapId)) parChapId.set(chapId, []);
    parChapId.get(chapId).push({ ordre, libelle });
  };

  for (const s of selectionsAR) {
    if (s.eleve_id !== eleve.id) continue;
    const a = amgtById.get(s.amenagement_id);
    if (!a) continue;
    push(a.chapitre_id, a.ordre, a.libelle);
  }
  for (const l of libres) {
    if (l.eleve_id !== eleve.id) continue;
    push(l.chapitre_id ?? '__sans__', 9999, l.texte);
  }

  const parChapitre = [...parChapId.entries()]
    .map(([chapId, items]) => ({
      ordre: chapById.get(chapId)?.ordre ?? 9999,
      chapitreTitre: chapById.get(chapId)?.titre ?? 'Aménagements complémentaires',
      amenagements: items.sort((a, b) => a.ordre - b.ordre).map((i) => i.libelle),
    }))
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ chapitreTitre, amenagements }) => ({ chapitreTitre, amenagements }));

  return { eleve: nomEleve, classeNom, parChapitre };
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run tests/domain/ficheEleve.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/projections/ficheEleve.js tests/domain/ficheEleve.test.js
git commit -m "feat(domain): computeFicheEleve (AR + libres groupés par chapitre)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9 : Projection `computeProfilDiffActif`

**Files:**
- Create: `src/domain/projections/profilDiffActif.js`
- Test: `tests/domain/profilDiffActif.test.js`

- [ ] **Step 1 : Écrire les tests**

`tests/domain/profilDiffActif.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { computeProfilDiffActif } from '../../src/domain/projections/profilDiffActif.js';
import * as f from '../../src/test/fixtures/sample.js';

describe('computeProfilDiffActif', () => {
  const vm = computeProfilDiffActif({
    contexte: f.contexte,
    eleves: f.eleves,
    amenagements: f.amenagements,
    chapitres: f.chapitres,
    auClasse: f.auClasse,
    selectionsAR: f.selectionsAR,
    libres: f.libres,
  });

  it('métadonnées versionnées', () => {
    expect(vm.app).toBe('amenagactif');
    expect(vm.version).toBe(1);
    expect(vm.classe).toBe('5LA');
    expect(vm.ecole).toBe('Athénée X');
    expect(vm.annee).toBe('2025-2026');
  });

  it('auCommuns = AU de la classe avec chapitre', () => {
    expect(vm.auCommuns).toEqual([
      { id: 'a-au1', libelle: 'Mise en page', chapitre: f.chapitres[0].titre },
    ]);
  });

  it('arParEleve inclut AR catalogue + recto + libres, élèves sans AR exclus', () => {
    const noms = vm.arParEleve.map((x) => x.eleve);
    expect(noms).toEqual(['Emilie D.', 'Lea M.']);
    const emilie = vm.arParEleve.find((x) => x.eleve === 'Emilie D.');
    expect(emilie.amenagements).toEqual([
      'Doubler les espaces de réponse',
      'Cours uniquement en recto',
      'Vérifier oralement la consigne avant de commencer',
    ]);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run tests/domain/profilDiffActif.test.js`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

`src/domain/projections/profilDiffActif.js` :
```js
/**
 * Profil AU/AR d'une classe, format d'échange pour DiffActif.
 * @param {{
 *  contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  chapitres: import('../types.js').Chapitre[],
 *  auClasse: { amenagement_id: string }[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 * }} input
 */
export function computeProfilDiffActif(input) {
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = input;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const chapTitre = (id) => chapById.get(id)?.titre ?? '';
  const chapOrdre = (a) => chapById.get(a?.chapitre_id)?.ordre ?? 999;

  const auCommuns = auClasse
    .map((x) => amgtById.get(x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
    .map((a) => ({ id: a.id, libelle: a.libelle, chapitre: chapTitre(a.chapitre_id) }));

  const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;
  const arByEleve = new Map();
  for (const s of selectionsAR) {
    const a = amgtById.get(s.amenagement_id);
    if (!a || a.type !== 'AR') continue;
    if (!arByEleve.has(s.eleve_id)) arByEleve.set(s.eleve_id, []);
    arByEleve.get(s.eleve_id).push(a);
  }
  const libresByEleve = new Map();
  for (const l of libres) {
    if (!libresByEleve.has(l.eleve_id)) libresByEleve.set(l.eleve_id, []);
    libresByEleve.get(l.eleve_id).push(l.texte);
  }

  const arParEleve = eleves
    .map((e) => {
      const cat = (arByEleve.get(e.id) ?? [])
        .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
        .map((a) => a.libelle);
      return { eleve: nomEleve(e), amenagements: [...cat, ...(libresByEleve.get(e.id) ?? [])] };
    })
    .filter((x) => x.amenagements.length > 0);

  return {
    app: 'amenagactif',
    version: 1,
    annee: contexte.anneeLibelle,
    ecole: contexte.ecoleNom,
    classe: contexte.classeNom,
    auCommuns,
    arParEleve,
  };
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run tests/domain/profilDiffActif.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/projections/profilDiffActif.js tests/domain/profilDiffActif.test.js
git commit -m "feat(domain): computeProfilDiffActif (export profil classe versionné)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10 : Snapshot + diff

**Files:**
- Create: `src/domain/projections/snapshot.js`
- Test: `tests/domain/snapshot.test.js`

- [ ] **Step 1 : Écrire les tests**

`tests/domain/snapshot.test.js` :
```js
import { describe, it, expect } from 'vitest';
import { buildSnapshot, diffSnapshots } from '../../src/domain/projections/snapshot.js';
import * as f from '../../src/test/fixtures/sample.js';

const base = {
  eleves: f.eleves,
  amenagements: f.amenagements,
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
};

describe('buildSnapshot', () => {
  it('produit une structure stable et sérialisable', () => {
    const s = buildSnapshot(base);
    expect(s.au.sort()).toEqual(['Mise en page']);
    expect(s.parEleve['Emilie D.'].sort()).toEqual(
      ['Cours uniquement en recto', 'Doubler les espaces de réponse', 'Vérifier oralement la consigne avant de commencer'].sort()
    );
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('diffSnapshots', () => {
  it('détecte AU ajouté / retiré et AR ajouté / retiré par élève', () => {
    const prev = buildSnapshot(base);
    const next = buildSnapshot({
      ...base,
      auClasse: [],
      selectionsAR: [
        ...f.selectionsAR.filter((s) => !(s.eleve_id === 'e1' && s.amenagement_id === 'a-ar1')),
        { eleve_id: 'e2', amenagement_id: 'a-ar5' },
      ],
    });
    const d = diffSnapshots(prev, next);
    expect(d.auRetires).toEqual(['Mise en page']);
    expect(d.auAjoutes).toEqual([]);
    expect(d.arRetires).toContainEqual({ eleve: 'Emilie D.', texte: 'Doubler les espaces de réponse' });
    expect(d.arAjoutes).toContainEqual({ eleve: 'Karim B.', texte: 'Utiliser les livres audio pour la lecture' });
  });

  it('snapshots identiques → diff vide', () => {
    const s = buildSnapshot(base);
    const d = diffSnapshots(s, s);
    expect(d).toEqual({ auAjoutes: [], auRetires: [], arAjoutes: [], arRetires: [] });
  });

  it('prev null (premier envoi) → tout est "ajouté"', () => {
    const next = buildSnapshot(base);
    const d = diffSnapshots(null, next);
    expect(d.auAjoutes).toEqual(['Mise en page']);
    expect(d.arAjoutes.length).toBeGreaterThan(0);
    expect(d.auRetires).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `npx vitest run tests/domain/snapshot.test.js`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

`src/domain/projections/snapshot.js` :
```js
/**
 * État complet AU/AR d'une classe, sérialisable, comparable.
 * @param {{
 *  eleves: import('../types.js').Eleve[],
 *  amenagements: import('../types.js').Amenagement[],
 *  auClasse: { amenagement_id: string }[],
 *  selectionsAR: import('../types.js').SelectionAR[],
 *  libres: import('../types.js').AmenagementLibre[],
 * }} input
 * @returns {{ au: string[], parEleve: Record<string,string[]> }}
 */
export function buildSnapshot(input) {
  const { eleves, amenagements, auClasse, selectionsAR, libres } = input;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const nomEleve = (e) => `${e.prenom}${e.initiale_nom ? ' ' + e.initiale_nom + '.' : ''}`;
  const eleveById = new Map(eleves.map((e) => [e.id, nomEleve(e)]));

  const au = auClasse
    .map((x) => amgtById.get(x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .map((a) => a.libelle)
    .sort();

  /** @type {Record<string,string[]>} */
  const parEleve = {};
  for (const nom of eleveById.values()) parEleve[nom] = [];
  for (const s of selectionsAR) {
    const nom = eleveById.get(s.eleve_id);
    const a = amgtById.get(s.amenagement_id);
    if (!nom || !a || a.type !== 'AR') continue;
    parEleve[nom].push(a.libelle);
  }
  for (const l of libres) {
    const nom = eleveById.get(l.eleve_id);
    if (!nom) continue;
    parEleve[nom].push(l.texte);
  }
  for (const nom of Object.keys(parEleve)) parEleve[nom].sort();

  return { au, parEleve };
}

const EMPTY = { au: [], parEleve: {} };

/**
 * @param {{ au: string[], parEleve: Record<string,string[]> }|null} prev
 * @param {{ au: string[], parEleve: Record<string,string[]> }} next
 */
export function diffSnapshots(prev, next) {
  const p = prev ?? EMPTY;
  const setP = new Set(p.au);
  const setN = new Set(next.au);
  const auAjoutes = next.au.filter((x) => !setP.has(x));
  const auRetires = p.au.filter((x) => !setN.has(x));

  const eleves = new Set([...Object.keys(p.parEleve), ...Object.keys(next.parEleve)]);
  const arAjoutes = [];
  const arRetires = [];
  for (const eleve of eleves) {
    const av = new Set(p.parEleve[eleve] ?? []);
    const ap = new Set(next.parEleve[eleve] ?? []);
    for (const t of ap) if (!av.has(t)) arAjoutes.push({ eleve, texte: t });
    for (const t of av) if (!ap.has(t)) arRetires.push({ eleve, texte: t });
  }
  return { auAjoutes, auRetires, arAjoutes, arRetires };
}
```

- [ ] **Step 4 : Lancer (succès attendu)**

Run: `npx vitest run tests/domain/snapshot.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5 : Suite complète**

Run: `npm test`
Expected: PASS — 5 fichiers, ~25 tests.

- [ ] **Step 6 : Commit**

```bash
git add src/domain/projections/snapshot.js tests/domain/snapshot.test.js
git commit -m "feat(domain): buildSnapshot + diffSnapshots

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11 : Hooks de données pour la saisie

**Files:**
- Create: `src/hooks/useCatalogue.js`, `src/hooks/useEcoleGrid.js`, `src/hooks/useGridMutations.js`

- [ ] **Step 1 : `useCatalogue`**

`src/hooks/useCatalogue.js` :
```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

export function useCatalogue() {
  return useQuery({
    queryKey: ['catalogue'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: chapitres, error: e1 }, { data: amenagements, error: e2 }] = await Promise.all([
        supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
        supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type').eq('actif', true).order('ordre'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { chapitres, amenagements };
    },
  });
}
```

- [ ] **Step 2 : `useEcoleGrid`**

`src/hooks/useEcoleGrid.js` :
```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

export function useEcoles() {
  return useQuery({
    queryKey: ['ecoles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_ecoles').select('id, nom, implantation').eq('actif', true).order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export function useAnnees() {
  return useQuery({
    queryKey: ['annees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_annees').select('id, libelle, active').order('libelle', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Charge tout ce qu'il faut pour la grille d'une école/année. */
export function useEcoleGrid(ecoleId, anneeId) {
  return useQuery({
    queryKey: ['grille', ecoleId, anneeId],
    enabled: !!ecoleId && !!anneeId,
    queryFn: async () => {
      const { data: classes, error: ec } = await supabase
        .from('ar_classes').select('id, nom, niveau').eq('ecole_id', ecoleId).eq('annee_id', anneeId).order('nom');
      if (ec) throw ec;
      const classeIds = classes.map((c) => c.id);
      if (classeIds.length === 0) return { classes, eleves: [], selectionsAR: [], auClasse: [], libres: [] };

      const { data: eleves, error: ee } = await supabase
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom').in('classe_id', classeIds).order('prenom');
      if (ee) throw ee;
      const eleveIds = eleves.map((e) => e.id);

      const [{ data: auClasse, error: e1 }, sel, lib] = await Promise.all([
        supabase.from('ar_amenagements_classe').select('classe_id, amenagement_id, cree_le').in('classe_id', classeIds),
        eleveIds.length
          ? supabase.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds)
          : Promise.resolve({ data: [], error: null }),
        eleveIds.length
          ? supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').in('eleve_id', eleveIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (e1) throw e1;
      if (sel.error) throw sel.error;
      if (lib.error) throw lib.error;

      return { classes, eleves, selectionsAR: sel.data, auClasse, libres: lib.data };
    },
  });
}
```

- [ ] **Step 3 : `useGridMutations`**

`src/hooks/useGridMutations.js` :
```js
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Toutes les mutations invalident la grille de l'école/année courante. */
export function useGridMutations(ecoleId, anneeId) {
  const qc = useQueryClient();
  const invalider = () => qc.invalidateQueries({ queryKey: ['grille', ecoleId, anneeId] });

  const toggleAR = useMutation({
    mutationFn: async ({ eleveId, amenagementId, actif }) => {
      if (actif) {
        const { error } = await supabase.from('ar_selections').insert({ eleve_id: eleveId, amenagement_id: amenagementId });
        if (error && error.code !== '23505') throw error; // 23505 = déjà présent
      } else {
        const { error } = await supabase.from('ar_selections').delete().eq('eleve_id', eleveId).eq('amenagement_id', amenagementId);
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });

  const toggleAU = useMutation({
    mutationFn: async ({ classeId, amenagementId, actif }) => {
      if (actif) {
        const { error } = await supabase.from('ar_amenagements_classe').insert({ classe_id: classeId, amenagement_id: amenagementId });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase.from('ar_amenagements_classe').delete().eq('classe_id', classeId).eq('amenagement_id', amenagementId);
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });

  const upsertEleve = useMutation({
    mutationFn: async ({ id, classeId, prenom, initialeNom, referentPlaiNom }) => {
      const row = { prenom, initiale_nom: initialeNom ?? '', referent_plai_nom: referentPlaiNom ?? '' };
      if (id) {
        const { error } = await supabase.from('ar_eleves').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ar_eleves').insert({ ...row, classe_id: classeId });
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });

  const ensureClasse = useMutation({
    mutationFn: async ({ nom, niveau }) => {
      const { data, error } = await supabase
        .from('ar_classes')
        .upsert({ ecole_id: ecoleId, annee_id: anneeId, nom, niveau: niveau ?? null }, { onConflict: 'ecole_id,annee_id,nom' })
        .select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalider,
  });

  const addLibre = useMutation({
    mutationFn: async ({ eleveId, chapitreId, texte }) => {
      const { error } = await supabase.from('ar_amenagements_libres').insert({ eleve_id: eleveId, chapitre_id: chapitreId ?? null, texte });
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  const removeLibre = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('ar_amenagements_libres').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  return { toggleAR, toggleAU, upsertEleve, ensureClasse, addLibre, removeLibre };
}
```

- [ ] **Step 4 : Vérifier build**

Run: `npm run build`
Expected: OK.

- [ ] **Step 5 : Commit**

```bash
git add src/hooks/
git commit -m "feat(saisie): hooks catalogue / grille école / mutations

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12 : Grille de saisie — structure, sélecteurs, barre de saut, en-têtes

**Files:**
- Create: `src/components/saisie/SelecteurContexte.jsx`, `src/components/saisie/BarreSaut.jsx`, `src/components/saisie/EnTeteEleves.jsx`, `src/components/saisie/EleveEditor.jsx`
- Modify: `src/pages/SaisieEcole.jsx`

- [ ] **Step 1 : Sélecteur de contexte**

`src/components/saisie/SelecteurContexte.jsx` :
```jsx
import { useEcoles, useAnnees } from '../../hooks/useEcoleGrid.js';

export default function SelecteurContexte({ ecoleId, anneeId, onChange }) {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label htmlFor="sel-ecole" className="block font-medium">École / implantation</label>
        <select id="sel-ecole" className="plai-input" value={ecoleId ?? ''}
          onChange={(e) => onChange({ ecoleId: e.target.value || null, anneeId })}>
          <option value="">— choisir —</option>
          {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.implantation ? ` (${e.implantation})` : ''}</option>)}
        </select>
        <p className="text-sm text-[color:var(--text3)]">Une école = une grille. Les colonnes sont les élèves de ses classes.</p>
      </div>
      <div>
        <label htmlFor="sel-annee" className="block font-medium">Année scolaire</label>
        <select id="sel-annee" className="plai-input" value={anneeId ?? ''}
          onChange={(e) => onChange({ ecoleId, anneeId: e.target.value || null })}>
          <option value="">— choisir —</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.active ? ' (active)' : ''}</option>)}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Barre de saut**

`src/components/saisie/BarreSaut.jsx` :
```jsx
export default function BarreSaut({ chapitres }) {
  return (
    <nav aria-label="Aller au chapitre" className="flex flex-wrap gap-1 sticky top-0 bg-[color:var(--bg)] py-2 z-30">
      <span className="text-sm text-[color:var(--text3)] mr-2">Sauter à :</span>
      {chapitres.map((c) => (
        <a key={c.id} href={`#chap-${c.ordre}`}
          className="text-sm px-2 py-0.5 rounded border border-[color:var(--border)] hover:bg-white"
          title={c.titre}>{c.ordre}</a>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3 : En-tête élèves (figé) + éditeur**

`src/components/saisie/EleveEditor.jsx` :
```jsx
import { useState } from 'react';

export default function EleveEditor({ eleve, onSave, onClose }) {
  const [prenom, setPrenom] = useState(eleve?.prenom ?? '');
  const [initiale, setInitiale] = useState(eleve?.initiale_nom ?? '');
  const [ref, setRef] = useState(eleve?.referent_plai_nom ?? '');

  return (
    <div className="plai-card p-3 space-y-2 w-72">
      <div>
        <label className="block text-sm font-medium">Prénom</label>
        <input className="plai-input w-full" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Emilie" />
      </div>
      <div>
        <label className="block text-sm font-medium">Initiale du nom</label>
        <input className="plai-input w-full" maxLength={2} value={initiale} onChange={(e) => setInitiale(e.target.value)} placeholder="D" />
        <p className="text-xs text-[color:var(--text3)]">Affichée « Emilie D. » sur la fiche. Pas de nom complet.</p>
      </div>
      <div>
        <label className="block text-sm font-medium">Référent PLAI (accompagnateur)</label>
        <input className="plai-input w-full" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Mona" />
        <p className="text-xs text-[color:var(--text3)]">Nom de l'accompagnateur·ice qui suit cet élève. Apparaît dans le tableau PIA de la fiche.</p>
      </div>
      <div className="flex gap-2">
        <button className="plai-btn" onClick={() => onSave({ prenom, initialeNom: initiale, referentPlaiNom: ref })} disabled={!prenom.trim()}>Enregistrer</button>
        <button className="text-sm underline" onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}
```

`src/components/saisie/EnTeteEleves.jsx` :
```jsx
import { useState } from 'react';
import EleveEditor from './EleveEditor.jsx';

export default function EnTeteEleves({ classesAvecEleves, onSaveEleve }) {
  const [editId, setEditId] = useState(null);

  return (
    <thead className="sticky top-10 z-20 bg-[color:var(--bg)]">
      <tr>
        <th className="text-left align-bottom p-1 min-w-[16rem]"></th>
        {classesAvecEleves.map(({ classe, eleves }) =>
          eleves.map((e, i) => (
            <th key={e.id} className="p-1 align-bottom min-w-[3rem] border-l border-[color:var(--border)]">
              {i === 0 && <div className="text-xs text-teal font-semibold mb-1">{classe.nom}</div>}
              <button className="text-xs writing-vertical hover:underline" onClick={() => setEditId(editId === e.id ? null : e.id)}
                style={{ writingMode: 'vertical-rl' }} title="Modifier l'élève">
                {e.prenom} {e.initiale_nom}
              </button>
              {editId === e.id && (
                <div className="absolute mt-1">
                  <EleveEditor eleve={e} onClose={() => setEditId(null)}
                    onSave={(v) => { onSaveEleve({ id: e.id, classeId: e.classe_id, ...v }); setEditId(null); }} />
                </div>
              )}
            </th>
          ))
        )}
      </tr>
    </thead>
  );
}
```

- [ ] **Step 4 : Page SaisieEcole (assemblage partiel)**

`src/pages/SaisieEcole.jsx` :
```jsx
import { useState, useMemo } from 'react';
import SelecteurContexte from '../components/saisie/SelecteurContexte.jsx';
import BarreSaut from '../components/saisie/BarreSaut.jsx';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useGridMutations } from '../hooks/useGridMutations.js';

export default function SaisieEcole() {
  const [ctx, setCtx] = useState({ ecoleId: null, anneeId: null });
  const { data: cat } = useCatalogue();
  const { data: grid, isLoading, error } = useEcoleGrid(ctx.ecoleId, ctx.anneeId);
  const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);

  const classesAvecEleves = useMemo(() => {
    if (!grid) return [];
    return grid.classes.map((classe) => ({
      classe,
      eleves: grid.eleves.filter((e) => e.classe_id === classe.id),
    }));
  }, [grid]);

  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');

  return (
    <div className="plai-section space-y-4">
      <h1 className="text-xl font-semibold">Saisie des aménagements</h1>
      <SelecteurContexte ecoleId={ctx.ecoleId} anneeId={ctx.anneeId} onChange={setCtx} />

      {!ctx.ecoleId || !ctx.anneeId ? (
        <p className="plai-empty">Choisir une école et une année pour afficher la grille.</p>
      ) : isLoading ? (
        <p>Chargement de la grille…</p>
      ) : error ? (
        <p className="plai-error">Erreur de chargement : {error.message}</p>
      ) : grid.classes.length === 0 ? (
        <p className="plai-empty">Aucune classe. Ajouter un élève créera sa classe.</p>
      ) : (
        <>
          <BarreSaut chapitres={chapitres} />
          <div className="overflow-x-auto border border-[color:var(--border)] rounded">
            <table className="border-collapse text-sm">
              <EnTeteEleves classesAvecEleves={classesAvecEleves}
                onSaveEleve={(v) => mut.upsertEleve.mutate(v)} />
              <tbody>
                <BandeauAU classesAvecEleves={classesAvecEleves} auCatalogue={auCat}
                  auClasse={grid.auClasse} onToggle={(v) => mut.toggleAU.mutate(v)} />
                {chapitres.map((ch) => (
                  <ChapitreAR key={ch.id} chapitre={ch}
                    amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                    classesAvecEleves={classesAvecEleves}
                    selectionsAR={grid.selectionsAR}
                    libres={grid.libres}
                    onToggle={(v) => mut.toggleAR.mutate(v)}
                    onAddLibre={(v) => mut.addLibre.mutate(v)}
                    onRemoveLibre={(v) => mut.removeLibre.mutate(v)} />
                ))}
              </tbody>
            </table>
          </div>
          {mut.toggleAR.isError && <p className="plai-error">Échec d'enregistrement, réessayez.</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5 : Commit (build cassé attendu — BandeauAU/ChapitreAR arrivent Task 13)**

```bash
git add src/components/saisie/ src/pages/SaisieEcole.jsx
git commit -m "feat(saisie): sélecteur contexte, barre de saut, en-tête élèves

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13 : Grille de saisie — bandeau AU + chapitres AR repliables

**Files:**
- Create: `src/components/saisie/BandeauAU.jsx`, `src/components/saisie/ChapitreAR.jsx`, `src/components/saisie/AmenagementLibreForm.jsx`

- [ ] **Step 1 : Bandeau AU (case par classe, pas par élève)**

`src/components/saisie/BandeauAU.jsx` :
```jsx
export default function BandeauAU({ classesAvecEleves, auCatalogue, auClasse, onToggle }) {
  const estCoche = (classeId, amId) => auClasse.some((x) => x.classe_id === classeId && x.amenagement_id === amId);
  const totalCols = classesAvecEleves.reduce((n, x) => n + x.eleves.length, 0);

  return (
    <>
      <tr className="bg-[color:var(--teal)]/10">
        <td colSpan={totalCols + 1} className="p-2 font-semibold text-teal">
          Aménagements universels — cochés pour toute la classe (bloc « Pour tous » de la fiche)
        </td>
      </tr>
      {classesAvecEleves.map(({ classe }) => (
        <tr key={classe.id} className="border-b border-[color:var(--border)]">
          <td className="p-1 align-top">
            <div className="font-medium">{classe.nom}</div>
            <div className="flex flex-col gap-1 mt-1">
              {auCatalogue.map((a) => (
                <label key={a.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={estCoche(classe.id, a.id)}
                    onChange={(e) => onToggle({ classeId: classe.id, amenagementId: a.id, actif: e.target.checked })} />
                  <span>{a.libelle}</span>
                </label>
              ))}
            </div>
          </td>
          <td colSpan={totalCols}></td>
        </tr>
      ))}
    </>
  );
}
```

- [ ] **Step 2 : Formulaire d'aménagement libre**

`src/components/saisie/AmenagementLibreForm.jsx` :
```jsx
import { useState } from 'react';

export default function AmenagementLibreForm({ chapitre, eleves, onAdd, onClose }) {
  const [eleveId, setEleveId] = useState('');
  const [texte, setTexte] = useState('');

  return (
    <div className="plai-card p-3 space-y-2 max-w-lg">
      <p className="font-medium">Aménagement libre — {chapitre.titre}</p>
      <div>
        <label className="block text-sm font-medium">Élève concerné</label>
        <select className="plai-input w-full" value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
          <option value="">— choisir —</option>
          {eleves.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.initiale_nom}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Aménagement</label>
        <textarea className="plai-input w-full" rows={2} value={texte} onChange={(e) => setTexte(e.target.value)}
          placeholder="Ex. : En TP, vérifier que l'élève a compris la démarche avant de le laisser avancer" />
        <p className="text-xs text-[color:var(--text3)]">Formulez une action concrète et observable pour l'enseignant. Apparaît dans la fiche de cet élève.</p>
      </div>
      <div className="flex gap-2">
        <button className="plai-btn" disabled={!eleveId || !texte.trim()}
          onClick={() => { onAdd({ eleveId, chapitreId: chapitre.id, texte: texte.trim() }); onClose(); }}>Ajouter</button>
        <button className="text-sm underline" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Chapitre AR (replié par défaut, repli imposé)**

`src/components/saisie/ChapitreAR.jsx` :
```jsx
import { useState } from 'react';
import AmenagementLibreForm from './AmenagementLibreForm.jsx';

export default function ChapitreAR({ chapitre, amenagements, classesAvecEleves, selectionsAR, libres, onToggle, onAddLibre, onRemoveLibre }) {
  const [ouvert, setOuvert] = useState(false);
  const [libreOuvert, setLibreOuvert] = useState(false);

  const cols = classesAvecEleves.flatMap(({ eleves }) => eleves);
  const totalCols = cols.length;
  const estCoche = (eleveId, amId) => selectionsAR.some((s) => s.eleve_id === eleveId && s.amenagement_id === amId);
  const nbCoches = selectionsAR.filter((s) => amenagements.some((a) => a.id === s.amenagement_id)).length;
  const libresChap = libres.filter((l) => l.chapitre_id === chapitre.id);

  return (
    <>
      <tr id={`chap-${chapitre.ordre}`}>
        <td colSpan={totalCols + 1} className="p-0">
          <button className="w-full text-left px-2 py-2 bg-white border-y border-[color:var(--border)] sticky top-20 z-10 flex items-center gap-2"
            aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
            <span>{ouvert ? '▼' : '▶'}</span>
            <span className="font-semibold">{chapitre.titre}</span>
            <span className="text-sm text-[color:var(--text3)]">({nbCoches} AR cochés)</span>
          </button>
        </td>
      </tr>

      {ouvert && amenagements.map((a) => (
        <tr key={a.id} className="border-b border-[color:var(--border)] hover:bg-white/60">
          <td className="p-1 align-top">{a.libelle}</td>
          {cols.map((e) => (
            <td key={e.id} className="text-center border-l border-[color:var(--border)]">
              <input type="checkbox" checked={estCoche(e.id, a.id)}
                aria-label={`${a.libelle} — ${e.prenom} ${e.initiale_nom}`}
                onChange={(ev) => onToggle({ eleveId: e.id, amenagementId: a.id, actif: ev.target.checked })} />
            </td>
          ))}
        </tr>
      ))}

      {ouvert && (
        <tr>
          <td colSpan={totalCols + 1} className="p-2">
            {libresChap.map((l) => {
              const el = cols.find((c) => c.id === l.eleve_id);
              return (
                <div key={l.id} className="text-sm flex items-center gap-2">
                  <span className="text-teal">+</span>
                  <span>{el ? `${el.prenom} ${el.initiale_nom}` : '—'} : {l.texte}</span>
                  <button className="text-xs underline" onClick={() => onRemoveLibre({ id: l.id })}>retirer</button>
                </div>
              );
            })}
            {libreOuvert
              ? <AmenagementLibreForm chapitre={chapitre} eleves={cols} onAdd={onAddLibre} onClose={() => setLibreOuvert(false)} />
              : <button className="text-sm underline text-teal" onClick={() => setLibreOuvert(true)}>+ ajouter un aménagement libre pour un élève</button>}
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 4 : Ajout d'élève**

Ajouter dans `src/pages/SaisieEcole.jsx`, sous le `<h1>` (bloc « ajouter un élève »), un bouton + formulaire inline :
```jsx
// imports : useGridMutations déjà présent ; ajouter useState local 'ajout'
// dans le JSX, après <SelecteurContexte /> et seulement si ctx.ecoleId && ctx.anneeId :
{ctx.ecoleId && ctx.anneeId && (
  <AjoutEleve
    onCreate={async ({ classeNom, niveau, prenom, initiale, referent }) => {
      const classeId = await mut.ensureClasse.mutateAsync({ nom: classeNom, niveau });
      await mut.upsertEleve.mutateAsync({ classeId, prenom, initialeNom: initiale, referentPlaiNom: referent });
    }}
  />
)}
```

Créer `src/components/saisie/AjoutEleve.jsx` :
```jsx
import { useState } from 'react';

export default function AjoutEleve({ onCreate }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ classeNom: '', niveau: '', prenom: '', initiale: '', referent: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!ouvert) return <button className="plai-btn" onClick={() => setOuvert(true)}>+ élève</button>;

  return (
    <form className="plai-card p-3 flex flex-wrap gap-2 items-end"
      onSubmit={(e) => { e.preventDefault(); onCreate(f); setOuvert(false); setF({ classeNom: '', niveau: '', prenom: '', initiale: '', referent: '' }); }}>
      <label className="text-sm">Classe
        <input className="plai-input block" required value={f.classeNom} onChange={set('classeNom')} placeholder="5LA" />
      </label>
      <label className="text-sm">Niveau
        <input className="plai-input block" value={f.niveau} onChange={set('niveau')} placeholder="5e" />
      </label>
      <label className="text-sm">Prénom
        <input className="plai-input block" required value={f.prenom} onChange={set('prenom')} placeholder="Emilie" />
      </label>
      <label className="text-sm">Initiale
        <input className="plai-input block" maxLength={2} value={f.initiale} onChange={set('initiale')} placeholder="D" />
      </label>
      <label className="text-sm">Référent PLAI
        <input className="plai-input block" value={f.referent} onChange={set('referent')} placeholder="Mona" />
      </label>
      <button type="submit" className="plai-btn">Créer</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)}>Annuler</button>
    </form>
  );
}
```
Importer `AjoutEleve` dans `SaisieEcole.jsx`.

- [ ] **Step 5 : Vérifier build + saisie manuelle**

Run: `npm run build` → OK.

Préparer des données de test (SQL Editor Supabase) :
```sql
insert into ar_annees (libelle, active) values ('2025-2026', true) on conflict do nothing;
insert into ar_ecoles (nom, implantation) values ('École test', 'Impl. A') on conflict do nothing;
```
Run: `npm run dev`, aller sur `/saisie`, choisir « École test » + « 2025-2026 », ajouter un élève (classe 5LA, prénom Emilie, initiale D), cocher un AU sur la classe, déplier un chapitre, cocher un AR, ajouter un aménagement libre.
Vérifier dans Supabase : lignes créées dans `ar_eleves`, `ar_amenagements_classe`, `ar_selections`, `ar_amenagements_libres`.

- [ ] **Step 6 : Commit**

```bash
git add src/components/saisie/ src/pages/SaisieEcole.jsx
git commit -m "feat(saisie): bandeau AU par classe, chapitres AR repliables, aménagement libre, ajout élève

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14 : `ficheData` serverless — chargement des lignes brutes d'une classe

**Files:**
- Create: `api/_lib/supabaseAdmin.js`, `api/_lib/ficheData.js`

- [ ] **Step 1 : Client service-role**

`api/_lib/supabaseAdmin.js` :
```js
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2 : `loadClasseData` (entrée des projections)**

`api/_lib/ficheData.js` :
```js
import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Charge toutes les lignes nécessaires aux projections pour une classe.
 * @param {string} classeId
 * @returns {Promise<{
 *  classe: any, contexte: { classeNom: string, ecoleNom: string, anneeLibelle: string },
 *  eleves: any[], amenagements: any[], chapitres: any[],
 *  auClasse: any[], selectionsAR: any[], libres: any[], referents: any[],
 * }>}
 */
export async function loadClasseData(classeId) {
  const db = supabaseAdmin();

  const { data: classe, error: ec } = await db
    .from('ar_classes')
    .select('id, nom, ecole_id, annee_id, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId)
    .single();
  if (ec) throw ec;

  const { data: eleves, error: ee } = await db
    .from('ar_eleves')
    .select('id, classe_id, prenom, initiale_nom, referent_plai_nom')
    .eq('classe_id', classeId)
    .order('prenom');
  if (ee) throw ee;
  const eleveIds = eleves.map((e) => e.id);

  const [cat, chap, au, sel, lib, ref] = await Promise.all([
    db.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    db.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    db.from('ar_amenagements_classe').select('amenagement_id, cree_le').eq('classe_id', classeId),
    eleveIds.length
      ? db.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds)
      : Promise.resolve({ data: [] }),
    eleveIds.length
      ? db.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').in('eleve_id', eleveIds)
      : Promise.resolve({ data: [] }),
    db.from('ar_referents_ecole').select('nom, fonction').eq('ecole_id', classe.ecole_id).eq('annee_id', classe.annee_id),
  ]);
  for (const r of [cat, chap, au, sel, lib, ref]) if (r.error) throw r.error;

  return {
    classe,
    contexte: {
      classeNom: classe.nom,
      ecoleNom: classe.ar_ecoles?.nom ?? '',
      anneeLibelle: classe.ar_annees?.libelle ?? '',
    },
    eleves,
    amenagements: cat.data,
    chapitres: chap.data,
    auClasse: au.data,
    selectionsAR: sel.data,
    libres: lib.data,
    referents: ref.data,
  };
}
```

- [ ] **Step 3 : Commit**

```bash
git add api/_lib/
git commit -m "feat(api): loadClasseData — lignes brutes d'une classe pour les projections

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15 : Fiche classe — vue web

**Files:**
- Create: `src/components/fiche/FicheClasseView.jsx`
- Create: `src/hooks/useFicheClasse.js`
- Modify: `src/pages/FicheClassePage.jsx`

- [ ] **Step 1 : Hook de données fiche classe (front, via RLS)**

`src/hooks/useFicheClasse.js` :
```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheClasse } from '../domain/projections/ficheClasse.js';

async function chargerClasse(classeId) {
  const { data: classe, error } = await supabase
    .from('ar_classes')
    .select('id, nom, ecole_id, annee_id, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId).single();
  if (error) throw error;

  const { data: eleves } = await supabase
    .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom').eq('classe_id', classeId).order('prenom');
  const eleveIds = eleves.map((e) => e.id);

  const [cat, chap, au, sel, lib, ref] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_amenagements_classe').select('amenagement_id, cree_le').eq('classe_id', classeId),
    eleveIds.length ? supabase.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds) : { data: [] },
    eleveIds.length ? supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').in('eleve_id', eleveIds) : { data: [] },
    supabase.from('ar_referents_ecole').select('nom, fonction').eq('ecole_id', classe.ecole_id).eq('annee_id', classe.annee_id),
  ]);

  return computeFicheClasse({
    classe,
    contexte: { classeNom: classe.nom, ecoleNom: classe.ar_ecoles?.nom ?? '', anneeLibelle: classe.ar_annees?.libelle ?? '' },
    eleves,
    amenagements: cat.data,
    chapitres: chap.data,
    auClasse: au.data,
    selectionsAR: sel.data,
    libres: lib.data,
    referents: ref.data,
  });
}

export function useFicheClasse(classeId) {
  return useQuery({ queryKey: ['fiche-classe', classeId], enabled: !!classeId, queryFn: () => chargerClasse(classeId) });
}
```

- [ ] **Step 2 : Vue (réutilisable web + base du PDF HTML)**

`src/components/fiche/FicheClasseView.jsx` :
```jsx
/** @param {{ vm: import('../../domain/types.js').FicheClasseVM }} props */
export default function FicheClasseView({ vm }) {
  const date = vm.dateMaj ? new Date(vm.dateMaj).toLocaleDateString('fr-BE') : '…';
  return (
    <article className="fiche max-w-3xl mx-auto bg-white p-8 text-[15px] leading-relaxed" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
        <span>Date de mise à jour : {date}</span>
      </header>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">Aménagements raisonnables — {vm.classeNom}</h1>
      <p className="text-sm text-gray-600 mb-4">{vm.ecoleNom} · {vm.anneeLibelle}</p>

      <table className="w-full border border-black mb-4 text-sm">
        <thead><tr>
          <th className="border border-black p-1">Intégrations (référent·e PIA)</th>
          <th className="border border-black p-1">PAR (Direction)</th>
        </tr></thead>
        <tbody><tr>
          <td className="border border-black p-2 align-top">{vm.tableauReferents.pia.join(', ') || '—'}</td>
          <td className="border border-black p-2 align-top">{vm.tableauReferents.par.join(', ') || '—'}</td>
        </tr></tbody>
      </table>

      <h2 className="font-bold underline mb-1">Pour tous :</h2>
      <ul className="list-disc pl-6 mb-4">
        {vm.pourTous.length === 0 && <li className="list-none text-gray-500">Aucun aménagement universel retenu pour la classe.</li>}
        {vm.pourTous.map((x, i) => (
          <li key={i} className={x.surligne ? 'bg-yellow-200' : ''}>{x.libelle}</li>
        ))}
      </ul>

      <h2 className="font-bold underline mb-1">AR spécifiques à un élève :</h2>
      <table className="w-full border border-black mb-4 text-sm">
        <tbody>
          {vm.parEleve.length === 0 && <tr><td className="border border-black p-2 text-gray-500">Aucun.</td></tr>}
          {vm.parEleve.map((row) => (
            <tr key={row.eleve}>
              <td className="border border-black p-2 align-top w-32 font-medium">{row.eleve}</td>
              <td className="border border-black p-2">
                <ul className="list-disc pl-5">{row.amenagements.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="border border-black text-sm">
        <tbody><tr>
          <td className="border border-black p-2">Nombre de cours à imprimer en recto</td>
          <td className="border border-black p-2 text-center w-16">{vm.nbRecto}</td>
        </tr></tbody>
      </table>
    </article>
  );
}
```

- [ ] **Step 3 : Page fiche classe + sélecteur**

`src/pages/FicheClassePage.jsx` :
```jsx
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useFicheClasse } from '../hooks/useFicheClasse.js';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';

function Picker() {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');
  const { data: grid } = useEcoleGrid(ecoleId || null, anneeId || null);
  return (
    <div className="plai-section space-y-3">
      <h1 className="text-xl font-semibold">Fiches par classe</h1>
      <div className="flex gap-3">
        <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
          <option value="">École…</option>
          {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select className="plai-input" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
          <option value="">Année…</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
        </select>
      </div>
      <ul className="list-disc pl-6">
        {(grid?.classes ?? []).map((c) => (
          <li key={c.id}><Link className="text-teal underline" to={`/classe/${c.id}/fiche`}>{c.nom}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export default function FicheClassePage({ picker }) {
  const { classeId } = useParams();
  if (picker || !classeId) return <Picker />;
  return <FicheClasseContenu classeId={classeId} />;
}

function FicheClasseContenu({ classeId }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <div className="flex gap-3">
        <a className="plai-btn" href={`/api/fiche-pdf?type=classe&id=${classeId}`} target="_blank" rel="noreferrer">Télécharger le PDF</a>
      </div>
      <FicheClasseView vm={vm} />
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier**

Run: `npm run build` → OK.
Run: `npm run dev`, `/fiches` → choisir école/année → cliquer une classe → la fiche s'affiche avec « Pour tous », AR par élève, nbRecto.

- [ ] **Step 5 : Commit**

```bash
git add src/components/fiche/FicheClasseView.jsx src/hooks/useFicheClasse.js src/pages/FicheClassePage.jsx
git commit -m "feat(fiche): vue web fiche classe + sélecteur

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16 : Fiche élève — vue web

**Files:**
- Create: `src/components/fiche/FicheEleveView.jsx`, `src/hooks/useFicheEleve.js`
- Modify: `src/pages/FicheElevePage.jsx`

- [ ] **Step 1 : Hook**

`src/hooks/useFicheEleve.js` :
```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheEleve } from '../domain/projections/ficheEleve.js';

async function charger(eleveId) {
  const { data: eleve, error } = await supabase
    .from('ar_eleves').select('id, prenom, initiale_nom, classe_id, ar_classes(nom)').eq('id', eleveId).single();
  if (error) throw error;
  const [cat, chap, sel, lib] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_selections').select('eleve_id, amenagement_id').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').eq('eleve_id', eleveId),
  ]);
  return computeFicheEleve({
    eleve,
    classeNom: eleve.ar_classes?.nom ?? '',
    amenagements: cat.data,
    chapitres: chap.data,
    selectionsAR: sel.data,
    libres: lib.data,
  });
}

export function useFicheEleve(eleveId) {
  return useQuery({ queryKey: ['fiche-eleve', eleveId], enabled: !!eleveId, queryFn: () => charger(eleveId) });
}
```

- [ ] **Step 2 : Vue**

`src/components/fiche/FicheEleveView.jsx` :
```jsx
/** @param {{ vm: import('../../domain/types.js').FicheEleveVM }} props */
export default function FicheEleveView({ vm }) {
  return (
    <article className="max-w-3xl mx-auto bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
      </header>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">
        Aménagements — {vm.eleve} ({vm.classeNom})
      </h1>
      {vm.parChapitre.length === 0 && <p className="text-gray-500">Aucun aménagement spécifique enregistré.</p>}
      {vm.parChapitre.map((ch) => (
        <section key={ch.chapitreTitre} className="mb-3">
          <h2 className="font-bold">{ch.chapitreTitre}</h2>
          <ul className="list-disc pl-6">{ch.amenagements.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      ))}
    </article>
  );
}
```

- [ ] **Step 3 : Page**

`src/pages/FicheElevePage.jsx` :
```jsx
import { useParams } from 'react-router-dom';
import { useFicheEleve } from '../hooks/useFicheEleve.js';
import FicheEleveView from '../components/fiche/FicheEleveView.jsx';

export default function FicheElevePage() {
  const { eleveId } = useParams();
  const { data: vm, isLoading, error } = useFicheEleve(eleveId);
  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <a className="plai-btn" href={`/api/fiche-pdf?type=eleve&id=${eleveId}`} target="_blank" rel="noreferrer">Télécharger le PDF</a>
      <FicheEleveView vm={vm} />
    </div>
  );
}
```

- [ ] **Step 4 : Lien depuis la fiche classe**

Dans `src/components/fiche/FicheClasseView.jsx`, entourer `{row.eleve}` d'un lien si un `eleveId` est fourni. Simplifier : ajouter une prop optionnelle `eleveIdParNom` (Map nom→id) passée par `FicheClasseContenu` (le hook `useFicheClasse` renvoie déjà les élèves — exposer `vm.__eleveIds`). Pour rester DRY, ajouter dans `computeFicheClasse` : chaque `parEleve[i]` porte aussi `eleveId`. Mettre à jour le test `ficheClasse.test.js` (ajouter `eleveId` attendu sur Emilie = 'e1') et l'implémentation (`{ eleve: nomEleve(e), eleveId: e.id, amenagements }`).

Puis dans `FicheClasseView` :
```jsx
<td className="border border-black p-2 align-top w-32 font-medium">
  {row.eleveId ? <a className="text-teal underline" href={`/eleve/${row.eleveId}/fiche`}>{row.eleve}</a> : row.eleve}
</td>
```

- [ ] **Step 5 : Vérifier**

Run: `npm test` → PASS (test ficheClasse mis à jour).
Run: `npm run build` → OK.
Run: `npm run dev`, ouvrir une fiche classe, cliquer un nom d'élève → fiche élève.

- [ ] **Step 6 : Commit**

```bash
git add src/components/fiche/ src/hooks/useFicheEleve.js src/pages/FicheElevePage.jsx src/domain/projections/ficheClasse.js tests/domain/ficheClasse.test.js
git commit -m "feat(fiche): vue web fiche élève + lien depuis fiche classe

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 17 : Génération PDF (serverless `@react-pdf/renderer`)

**Files:**
- Create: `api/fiche-pdf.js`
- Create: `api/_lib/pdf/FichePdf.jsx`
- Modify: `package.json` (dépendance)

- [ ] **Step 1 : Installer**

```bash
npm i @react-pdf/renderer
```

- [ ] **Step 2 : Composants PDF**

`api/_lib/pdf/FichePdf.jsx` :
```jsx
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { readFileSync } from 'fs';
import { join } from 'path';

const logo = 'data:image/jpeg;base64,' +
  readFileSync(join(process.cwd(), 'api/_assets/plai-logo.jpg')).toString('base64');

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.4 },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  logo: { height: 32 },
  titre: { textAlign: 'center', backgroundColor: '#e5e5e5', padding: 6, fontFamily: 'Helvetica-Bold', fontSize: 13, marginBottom: 12 },
  h2: { fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginTop: 8, marginBottom: 4 },
  cellL: { width: 90, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderTop: '1 solid #000', padding: 4 },
  li: { marginLeft: 10, marginBottom: 2 },
  surligne: { backgroundColor: '#fde68a' },
  tblHead: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottom: '1 solid #000' },
  th: { flex: 1, padding: 4, fontFamily: 'Helvetica-Bold' },
});

export function FicheClassePdf({ vm }) {
  const date = vm.dateMaj ? new Date(vm.dateMaj).toLocaleDateString('fr-BE') : '...';
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Image src={logo} style={s.logo} />
          <Text>Date de mise a jour : {date}</Text>
        </View>
        <Text style={s.titre}>Amenagements raisonnables - {vm.classeNom}</Text>
        <Text style={{ color: '#555', marginBottom: 10 }}>{vm.ecoleNom} - {vm.anneeLibelle}</Text>

        <View style={{ border: '1 solid #000', marginBottom: 12 }}>
          <View style={s.tblHead}>
            <Text style={s.th}>Integrations (referent PIA)</Text>
            <Text style={s.th}>PAR (Direction)</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ flex: 1, padding: 6 }}>{vm.tableauReferents.pia.join(', ') || '-'}</Text>
            <Text style={{ flex: 1, padding: 6 }}>{vm.tableauReferents.par.join(', ') || '-'}</Text>
          </View>
        </View>

        <Text style={s.h2}>Pour tous :</Text>
        {vm.pourTous.length === 0 && <Text style={{ color: '#777' }}>Aucun amenagement universel retenu.</Text>}
        {vm.pourTous.map((x, i) => (
          <Text key={i} style={[s.li, x.surligne ? s.surligne : {}]}>- {x.libelle}</Text>
        ))}

        <Text style={s.h2}>AR specifiques a un eleve :</Text>
        <View style={{ border: '1 solid #000', marginBottom: 12 }}>
          {vm.parEleve.length === 0 && <Text style={{ padding: 6, color: '#777' }}>Aucun.</Text>}
          {vm.parEleve.map((row) => (
            <View key={row.eleve} style={s.row}>
              <Text style={s.cellL}>{row.eleve}</Text>
              <View style={{ flex: 1 }}>
                {row.amenagements.map((a, i) => <Text key={i} style={s.li}>- {a}</Text>)}
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', border: '1 solid #000', alignSelf: 'flex-start' }}>
          <Text style={{ padding: 6 }}>Nombre de cours a imprimer en recto</Text>
          <Text style={{ padding: 6, borderLeft: '1 solid #000' }}>{vm.nbRecto}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function FicheElevePdf({ vm }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.head}><Image src={logo} style={s.logo} /></View>
        <Text style={s.titre}>Amenagements - {vm.eleve} ({vm.classeNom})</Text>
        {vm.parChapitre.length === 0 && <Text style={{ color: '#777' }}>Aucun amenagement specifique.</Text>}
        {vm.parChapitre.map((ch) => (
          <View key={ch.chapitreTitre} style={{ marginBottom: 6 }}>
            <Text style={s.h2}>{ch.chapitreTitre}</Text>
            {ch.amenagements.map((a, i) => <Text key={i} style={s.li}>- {a}</Text>)}
          </View>
        ))}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3 : Endpoint**

`api/fiche-pdf.js` :
```js
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { loadClasseData } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';
import { computeFicheEleve } from '../src/domain/projections/ficheEleve.js';
import { FicheClassePdf, FicheElevePdf } from './_lib/pdf/FichePdf.jsx';

export default async function handler(req, res) {
  try {
    const { type, id } = req.query;
    if (!id || !['classe', 'eleve'].includes(type)) {
      res.status(400).json({ error: 'type=classe|eleve & id requis' });
      return;
    }

    // Auth : token Supabase de l'utilisateur (referent PLAI ou direction)
    const jwt = (req.headers.authorization || '').replace('Bearer ', '');
    if (jwt) {
      const { data, error } = await supabaseAdmin().auth.getUser(jwt);
      if (error || !data.user) { res.status(401).json({ error: 'non authentifie' }); return; }
    } else {
      res.status(401).json({ error: 'non authentifie' });
      return;
    }

    let element;
    let filename;
    if (type === 'classe') {
      const d = await loadClasseData(id);
      const vm = computeFicheClasse(d);
      element = React.createElement(FicheClassePdf, { vm });
      filename = `fiche-${vm.classeNom}.pdf`;
    } else {
      const db = supabaseAdmin();
      const { data: eleve, error } = await db
        .from('ar_eleves').select('id, prenom, initiale_nom, classe_id, ar_classes(nom)').eq('id', id).single();
      if (error) throw error;
      const d = await loadClasseData(eleve.classe_id);
      const vm = computeFicheEleve({
        eleve, classeNom: eleve.ar_classes?.nom ?? '',
        amenagements: d.amenagements, chapitres: d.chapitres,
        selectionsAR: d.selectionsAR.filter((s) => s.eleve_id === id),
        libres: d.libres.filter((l) => l.eleve_id === id),
      });
      element = React.createElement(FicheElevePdf, { vm });
      filename = `fiche-${vm.eleve}.pdf`;
    }

    const buffer = await renderToBuffer(element);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.status(200).send(buffer);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
```

> **Note build Vercel :** `api/*.js` important `../src/domain/*` sur un projet `"type":"module"` — l'extension `.js` explicite dans l'import est **obligatoire** (déjà le cas). `.jsx` dans `api/` : Vercel transpile via esbuild, OK sans config supplémentaire.

- [ ] **Step 4 : Passer le token Supabase au lien PDF (front)**

Le lien `<a href>` ne porte pas d'en-tête. Remplacer par un fetch + blob dans `FicheClasseContenu` et `FicheElevePage` :

`src/lib/telechargerPdf.js` :
```js
import { supabase } from './supabase.js';

export async function telechargerPdf(type, id) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/fiche-pdf?type=${type}&id=${id}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  if (!res.ok) throw new Error('Génération PDF impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
```

Dans `FicheClasseContenu` :
```jsx
import { telechargerPdf } from '../lib/telechargerPdf.js';
// ...
<button className="plai-btn" onClick={() => telechargerPdf('classe', classeId)}>Télécharger le PDF</button>
```
Idem `FicheElevePage` avec `telechargerPdf('eleve', eleveId)`.

- [ ] **Step 5 : Vérifier avec `vercel dev`**

```bash
npm i -g vercel   # si absent
vercel dev
```
Dans le navigateur (`http://localhost:3000`), se connecter, ouvrir une fiche classe, cliquer « Télécharger le PDF ».
Expected: un onglet s'ouvre avec le PDF fidèle au gabarit (logo, titre grisé, tableau PIA/PAR, « Pour tous », AR par élève, ligne recto). Vérifier les accents (Helvetica gère le Latin-1 français).

- [ ] **Step 6 : Commit**

```bash
git add api/ src/lib/telechargerPdf.js src/pages/FicheClassePage.jsx src/pages/FicheElevePage.jsx package.json
git commit -m "feat(pdf): génération serverless fiche classe + fiche élève (@react-pdf)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 18 : Lien à jeton pour les enseignants

**Files:**
- Create: `api/_lib/jwt.js`, `api/fiche-token.js`
- Modify: `src/pages/FichePublique.jsx`, `src/pages/FicheClassePage.jsx` (bouton « copier le lien enseignant »)

- [ ] **Step 1 : Signature / vérification JWT**

`api/_lib/jwt.js` :
```js
import { SignJWT, jwtVerify } from 'jose';

const secret = () => {
  const s = process.env.AMENAG_TOKEN_SECRET;
  if (!s) throw new Error('AMENAG_TOKEN_SECRET manquant');
  return new TextEncoder().encode(s);
};

/** @param {{ classeId: string, joursValide?: number }} p */
export async function signFicheToken({ classeId, joursValide = 120 }) {
  return new SignJWT({ classeId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${joursValide}d`)
    .sign(secret());
}

export async function verifyFicheToken(token) {
  const { payload } = await jwtVerify(token, secret());
  return { classeId: payload.classeId };
}
```

- [ ] **Step 2 : Endpoint public (lecture seule)**

`api/fiche-token.js` :
```js
import { verifyFicheToken } from './_lib/jwt.js';
import { loadClasseData } from './_lib/ficheData.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';

export default async function handler(req, res) {
  try {
    const token = req.query.token;
    if (!token) { res.status(400).json({ error: 'token requis' }); return; }
    const { classeId } = await verifyFicheToken(token);
    const d = await loadClasseData(classeId);
    const vm = computeFicheClasse(d);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ vm });
  } catch (e) {
    res.status(401).json({ error: 'lien invalide ou expiré' });
  }
}
```

- [ ] **Step 3 : Endpoint de création de lien (référent PLAI)**

Ajouter dans `api/fiche-token.js` la méthode POST :
```js
// en haut du handler, avant le GET :
if (req.method === 'POST') {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  const { supabaseAdmin } = await import('./_lib/supabaseAdmin.js');
  const { data, error } = await supabaseAdmin().auth.getUser(jwt);
  if (error || !data.user) { res.status(401).json({ error: 'non authentifie' }); return; }
  const { classeId } = req.body || {};
  if (!classeId) { res.status(400).json({ error: 'classeId requis' }); return; }
  const { signFicheToken } = await import('./_lib/jwt.js');
  const token = await signFicheToken({ classeId });
  res.status(200).json({ token, url: `${req.headers.origin || ''}/fiche/${token}` });
  return;
}
```

- [ ] **Step 4 : Page publique**

`src/pages/FichePublique.jsx` :
```jsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';

export default function FichePublique() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['fiche-publique', token],
    queryFn: async () => {
      const res = await fetch(`/api/fiche-token?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error('lien invalide');
      return res.json();
    },
  });

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">Ce lien est invalide ou a expiré. Demandez un lien à jour à l'équipe PLAI.</p></div>;

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-6">
      <p className="text-center text-sm text-[color:var(--text3)] mb-3">Fiche en lecture seule — diffusion restreinte aux enseignants concernés.</p>
      <FicheClasseView vm={data.vm} />
    </div>
  );
}
```

- [ ] **Step 5 : Bouton « lien enseignant » sur la fiche classe**

Dans `FicheClasseContenu` (`src/pages/FicheClassePage.jsx`) :
```jsx
async function copierLien() {
  const { data: { session } } = await import('../lib/supabase.js').then((m) => m.supabase.auth.getSession());
  const res = await fetch('/api/fiche-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify({ classeId }),
  });
  const { url } = await res.json();
  await navigator.clipboard.writeText(url);
  alert('Lien enseignant copié dans le presse-papier.');
}
// bouton :
<button className="plai-btn" onClick={copierLien}>Copier le lien enseignant</button>
```

- [ ] **Step 6 : Vérifier avec `vercel dev`**

Définir `AMENAG_TOKEN_SECRET` dans `.env.local` (chaîne aléatoire longue).
Run: `vercel dev`. Ouvrir une fiche classe, « Copier le lien enseignant », coller l'URL `/fiche/<token>` dans un onglet privé (non connecté).
Expected: la fiche s'affiche en lecture seule ; un token bidon → message d'erreur.

- [ ] **Step 7 : Commit**

```bash
git add api/ src/pages/FichePublique.jsx src/pages/FicheClassePage.jsx
git commit -m "feat(fiche): lien à jeton enseignant (JWT) + page publique lecture seule

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 19 : Données de démarrage + déploiement

**Files:**
- Create: `supabase/seed/seed_ecoles.sql`
- Modify: `README.md`

- [ ] **Step 1 : Seed des 11 implantations + année active**

`supabase/seed/seed_ecoles.sql` :
```sql
insert into ar_annees (libelle, active) values ('2025-2026', true)
on conflict (libelle) do update set active = true;

-- Remplacer par les noms/implantations réels avant exécution.
insert into ar_ecoles (nom, implantation) values
  ('Implantation 1', 'impl-1'),
  ('Implantation 2', 'impl-2'),
  ('Implantation 3', 'impl-3'),
  ('Implantation 4', 'impl-4'),
  ('Implantation 5', 'impl-5'),
  ('Implantation 6', 'impl-6'),
  ('Implantation 7', 'impl-7'),
  ('Implantation 8', 'impl-8'),
  ('Implantation 9', 'impl-9'),
  ('Implantation 10', 'impl-10'),
  ('Implantation 11', 'impl-11')
on conflict do nothing;
```
> Demander à JF la liste exacte des 11 implantations avant d'exécuter.

- [ ] **Step 2 : Variables d'environnement Vercel**

Dans le projet Vercel `AmenagActif` (lié au repo GitHub), onglet Settings → Environment Variables, ajouter (Production + Preview) :
```
VITE_SUPABASE_URL         = https://dfoaumjleqtxjeaplnna.supabase.co
VITE_SUPABASE_ANON_KEY    = <anon key>
SUPABASE_SERVICE_ROLE_KEY = <service role key>
AMENAG_TOKEN_SECRET       = <chaîne aléatoire 48+ caractères>
```
Utiliser `printf` (pas `echo`) si passage par CLI. Ne jamais committer ces valeurs.

- [ ] **Step 3 : README minimal**

`README.md` :
```markdown
# AménagActif

Fiches d'aménagements universels (AU) et raisonnables (AR) par classe — Pôle Territorial de la Ville de Liège (PLAI).

## Dév
- `npm run dev` — front seul (pas d'API)
- `vercel dev` — front + fonctions `/api/*` (obligatoire pour tester PDF et liens à jeton)
- `npm test` — projections (Vitest)
- `npm run build` — **obligatoire avant tout push**

## Déploiement
GitHub `jfb4plai/AmenagActif` (branche `main`) → Vercel → `amenagactif.jfb4plai.com`.
Supabase : projet partagé `dfoaumjleqtxjeaplnna`, tables préfixées `ar_`.

## Migrations
`supabase/migrations/` — à exécuter dans le SQL Editor Supabase (pas de CLI).
`supabase/seed/` — catalogue (généré par `scripts/generate-catalogue.mjs`) + écoles.
```

- [ ] **Step 4 : Build + push + vérif déploiement**

```bash
npm run build   # doit passer
git add supabase/seed/seed_ecoles.sql README.md
git commit -m "chore: seed écoles + doc déploiement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```
Vérifier sur Vercel : build vert. Ouvrir `https://amenagactif.jfb4plai.com`, se connecter, saisir, générer un PDF, tester un lien enseignant.

- [ ] **Step 5 : Configurer le sous-domaine**

Vercel → Settings → Domains → ajouter `amenagactif.jfb4plai.com`. Vérifier la résolution DNS.

- [ ] **Step 6 : Checklist post-build (CLAUDE.md)**

- [ ] RLS actif sur toutes les tables `ar_*` (vérifier dans Supabase).
- [ ] Aucune clé dans le front (`grep -rn "SERVICE_ROLE\|service_role" src/` → vide).
- [ ] Aucun `console.log` de données élève (`grep -rn "console.log" src/ api/`).
- [ ] Le lien enseignant est en lecture seule et expire.
- [ ] Les références scientifiques éventuelles affichées dans l'app sont vérifiées RISS (aucune en v1 — rien à faire).

---

## Self-Review

**1. Couverture spec (spec §) :**
- §3 Architecture / modules → Tasks 1, 6–10 (projections), 14 (ficheData). ✅
- §4 Modèle de données + RLS → Task 2. ✅
- §4.2 Dérivations → Tasks 7–10 (toutes testées). ✅
- §5 Écran de saisie vue école (chapitres repliés imposés, en-tête figé, barre de saut, bandeau AU par classe, aménagement libre, ajout élève) → Tasks 11–13. ✅
- §6 Projections & rendu (web + PDF) → Tasks 15–17. ✅
- §6 `/fiche/:token` → Task 18. ✅
- §7 Auth PLAI + direction, lien enseignant sans compte → Tasks 4, 5, 18. ✅
- §7 RLS via `ar_profils_acces` → Task 2. ✅
- §10 Tests projections + build gate → Tasks 6–10, 19. ✅
- §11 Sécurité → Task 19 checklist. ✅
- **Reporté explicitement au Plan 2 (hors périmètre, annoncé en tête) :** §6 export xlsx & profil DiffActif *actif*, §7 notification mail, §8 imports, §9 clôture d'année. `computeProfilDiffActif` est déjà écrit et testé (Task 9) pour préparer le Plan 2.
- **Écart mineur assumé :** l'export xlsx et l'import xlsx (boutons présents dans la maquette §5) sont désactivés/absents dans ce plan — ils arrivent au Plan 2. Les boutons ne sont pas rendus tant que la fonctionnalité n'existe pas (pas de bouton mort).

**2. Placeholders :** aucun « TBD / à compléter / gérer les erreurs ». Les blocs « demander à JF » (liste des 11 implantations, libellé recto) sont des données d'exploitation, pas du code non spécifié — chacun a une valeur par défaut fonctionnelle et une requête SQL prête.

**3. Cohérence des types :**
- `computeFicheClasse` renvoie `parEleve[i] = { eleve, eleveId, amenagements }` (ajout `eleveId` en Task 16, test mis à jour).
- `loadClasseData` renvoie exactement les clés attendues par `computeFicheClasse` (`classe, contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres, referents`). ✅
- `useGridMutations` : `toggleAR({eleveId, amenagementId, actif})`, `toggleAU({classeId, amenagementId, actif})`, `addLibre({eleveId, chapitreId, texte})` — noms identiques entre hook (Task 11) et composants (Tasks 12–13). ✅
- `buildSnapshot` / `diffSnapshots` : signatures identiques entre test (Task 10) et usage futur Plan 2. ✅
- `normaliseLibelle` + `LIBELLE_RECTO_NORMALISE` définis Task 6, utilisés Task 7. ✅

---

## Execution Handoff

**Plan complet et enregistré dans `docs/superpowers/plans/2026-09-03-amenagactif-socle.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un sous-agent neuf par tâche, revue entre les tâches, itération rapide.

**2. Inline Execution** — exécution des tâches dans cette session avec points de contrôle.

**Quelle approche ?**

Puis, le **Plan 2** (notification mail, imports CSV/xlsx, export xlsx + profil DiffActif, clôture d'année) sera rédigé une fois le socle en place — les interfaces (`loadClasseData`, `buildSnapshot`, `computeProfilDiffActif`) sont déjà posées et testées.
