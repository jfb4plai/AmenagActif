# AménagActif

Fiches d'aménagements universels (AU) et raisonnables (AR) par classe — Pôle Territorial de la Ville de Liège (PLAI).

Remplace le classeur Excel « uniformisation des tableaux AR » : saisie en **vue école** (une colonne par élève, groupées par classe ; AU cochés au niveau classe, AR par élève), génération des fiches classe / élève en web + PDF, lien à jeton pour les enseignants sans compte.

## Développement

- `npm run dev` — front seul (les routes `/api/*` ne tournent pas)
- `vercel dev` — front + fonctions serverless `/api/*` (obligatoire pour tester le PDF et les liens à jeton)
- `npm test` — projections pures (Vitest)
- `npm run build` — **obligatoire avant tout push** (chaque push redéploie Vercel)
- `node scripts/generate-catalogue.mjs` — régénère `supabase/seed/catalogue.json` + `seed_catalogue.sql` depuis le classeur source

### Variables d'environnement

Copier `.env.example` → `.env.local` :

| Variable | Portée | Rôle |
|---|---|---|
| `VITE_SUPABASE_URL` | front + serverless | URL du projet Supabase partagé |
| `VITE_SUPABASE_ANON_KEY` | front | clé anon |
| `SUPABASE_SERVICE_ROLE_KEY` | serverless uniquement | lecture des fiches hors RLS (PDF, lien à jeton) |
| `AMENAG_TOKEN_SECRET` | serverless uniquement | signature HS256 des liens enseignants (48+ caractères aléatoires) |

## Déploiement

GitHub `jfb4plai/AmenagActif` (branche `main`) → Vercel → `amenagactif.jfb4plai.com`.
Supabase : projet partagé `dfoaumjleqtxjeaplnna`, toutes les tables préfixées `ar_`.

## Base de données

- `supabase/migrations/20260903_amenagactif_core.sql` — schéma + RLS, à exécuter dans le SQL Editor Supabase (pas de CLI).
- `supabase/seed/seed_catalogue.sql` — 12 chapitres, 132 aménagements (généré).
- `supabase/seed/seed_ecoles.sql` — implantations + année active (à adapter aux 11 implantations réelles).

Rôles (`ar_profils_acces`) : `plai` (sans `ecole_id` → accès global, saisie + fiches + liens) ; `direction` (`ecole_id` → lecture seule des fiches de son école). Les enseignants n'ont pas de compte : ils reçoivent un lien `/fiche/<token>` en lecture seule.

## Architecture

Données canoniques Supabase = seule source. Les vues (fiche classe, fiche élève, profil DiffActif, diff de notification) sont des **fonctions pures** dans `src/domain/projections/`, testées, qui ne touchent jamais la base. `api/_lib/ficheData.js` est le seul point qui traduit un id de classe en lignes brutes pour ces projections.

## Périmètre

**Livré (Plan 1)** : schéma, auth + rôles, grille de saisie école, fiches classe/élève web + PDF, lien à jeton enseignant.
**À venir (Plan 2)** : notification mail, import CSV enseignants, import/export xlsx, export profil DiffActif actif, clôture d'année + report des élèves montants.
