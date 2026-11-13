# Super lien (sommaire de classes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un enseignant reçoit une seule adresse qui ouvre le sommaire de ses classes (sans plafond), chaque classe ouvrant sa fiche habituelle ; le gestionnaire crée le sommaire et en modifie les classes.

**Architecture:** Un sommaire est une ligne de `ar_liens` avec `mode = 'sommaire'` et un `numero` attribué par la base ; ses classes sont dans `ar_liens_classes`. `api/fiche-token.js` sert le sommaire (sans `classe`) ou la fiche d'une classe du sommaire (avec `classe`) ; `api/liens.js` gère la modification des classes. Les liens existants (`fusion`) ne changent pas.

**Tech Stack:** React 18 + Vite 5, Vercel Serverless (`api/*.js`, ESM), Supabase (SQL manuel), Vitest (+ Testing Library, faux client `tests/domain/fakeDb.js`).

**Spec:** `docs/superpowers/specs/2026-11-13-super-lien-sommaire-design.md`

## Global Constraints

- Branche de travail `feat/super-lien-sommaire` issue de `main` ; `main` = branche Vercel. `npx vite build` doit passer avant tout `git push`.
- Chaque message de commit se termine par la ligne : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Aucune migration appliquée en base sans l'accord explicite de JF. Ordre de mise en ligne : migration, puis code.
- Un sommaire n'a **aucun plafond de classes** ; une fiche `fusion` reste plafonnée à 10 (`MAX_CLASSES_PAR_LIEN`). Garde-fou technique d'entrée : 100 identifiants par requête (`MAX_IDS_PAR_REQUETE`), pas une règle métier.
- Identifiant affiché : `SL-` + numéro sur 4 chiffres (`SL-0042`), numéro global attribué par la base (`numero bigint generated always as identity`), date = `cree_le` existant.
- Nom composé (gestionnaire) : `Super lien SL-0042 (créé le 13 novembre 2026) · {implantation} · {repère enseignant} · {N} classes`. L'enseignant voit « Vos classes — {implantation} » et la référence, jamais le repère « destinataire ».
- Refus uniformes : secret inconnu, lien révoqué, lien expiré, classe absente du sommaire, mauvais format de `classe` : **même** réponse 410 `MESSAGE_LIEN_INACTIF`, `Cache-Control: private, no-store`.
- Aucune table nouvelle ; tables et colonnes préfixées `ar_`. Aucun `console.log` de donnée personnelle. Texte d'interface 16 px minimum, sans défilement horizontal à 375 px.
- Avertissement avant génération d'un sommaire, mot pour mot : « Ce lien ouvre toutes les classes listées. Ne le transmettez qu'à l'enseignant concerné. »
- Pas de dépendance nouvelle. Pas de reconduction automatique d'une année à l'autre.

## Review Focus

1. Paramètre `classe` envoyé avec le secret d'un lien `fusion` ou d'une classe unique : doit donner le 410 uniforme, jamais la fiche (Task 4).
2. Sommaire dont toutes les classes ont disparu (suppression en cascade) : réponse 200 avec liste vide et message clair côté page, pas d'erreur 500 (Tasks 4 et 6).
3. Classes sans niveau ou avec des niveaux de formes mixtes (`3e`, `10e`, absent) : tri stable, niveau absent en dernier, aucune exception (Task 2).
4. Modification des classes avec doublons, classes d'une autre école ou d'une autre année, liste vide, agent PLAI, lien révoqué : refus ou dédoublonnage, jamais d'état partiel (Tasks 3 et 5).
5. 22 classes : cases du dialogue groupées par niveau avec « Tout cocher » par niveau, enregistrement possible, impossible de décocher la dernière (Task 8).

---

## File Structure

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261113_amenagactif_liens_sommaire.sql` (nouveau) | colonnes `mode`, `numero`, trigger de plafond par mode, fonction atomique, droits |
| `supabase/tests/liens_sommaire.sql` (nouveau) | test manuel SQL (transaction annulée) |
| `src/domain/liens.js` (modifié) | `referenceLien`, `trierClasses`, `nomSommaire` (purs, partagés avec `api/`) |
| `api/_lib/liens.js`, `api/_lib/liensData.js` (modifiés) | mode, plafond par mode, numéro, `definirClasses`, `chargerSommaire`, `versLienPublic` étendu |
| `api/fiche-token.js`, `api/liens.js` (modifiés) | création, lecture du sommaire et d'une classe, `definir_classes`, liste enrichie |
| `src/components/SommairePublic.jsx` (nouveau), `src/pages/FichePublique.jsx`, `src/App.jsx` | page publique |
| `src/components/ChoixModeLien.jsx` (nouveau), `GenerateurLien.jsx`, `src/pages/FicheClassePage.jsx` | création |
| `src/components/DialogueClasses.jsx` (nouveau), `src/hooks/useLiens.js`, `src/pages/LiensEnseignants.jsx` | gestion |
| `public/modes-emploi/*.html`, `docs/modes-emploi/*.html`, `docs/permissions-roles.md` | documentation |

---

### Task 1: Migration SQL et test SQL manuel

**Files:**
- Create: `supabase/migrations/20261113_amenagactif_liens_sommaire.sql`
- Create: `supabase/tests/liens_sommaire.sql`

**Interfaces:**
- Produces: colonnes `ar_liens.mode text` (`'fusion'` défaut, `'sommaire'`), `ar_liens.numero bigint` (identité, index unique) ; fonction `ar_lien_definir_classes(p_lien uuid, p_classes uuid[]) returns integer` (service role uniquement ; erreurs métier `errcode 'P0001'` avec message français) ; `authenticated` peut lire `mode` et `numero`.

- [ ] **Step 0: Créer la branche et versionner les documents**

```bash
git switch -c feat/super-lien-sommaire
git add docs/superpowers/specs/2026-11-13-super-lien-sommaire-design.md docs/superpowers/plans/2026-11-13-super-lien-sommaire.md
git commit -m "docs: spec et plan du super lien (sommaire de classes)"
```

- [ ] **Step 1: Écrire le test SQL** `supabase/tests/liens_sommaire.sql`, même style que `supabase/tests/liens_rls.sql` (table temporaire `_t` à adapter, `begin` … `rollback`, requêtes avec résultat attendu en commentaire). Cas : (a) insérer un lien `mode='sommaire'` puis 11 lignes `ar_liens_classes` : tout passe ; (b) un lien `mode='fusion'` : la 11e insertion échoue (« au plus 10 classes ») ; (c) une classe d'une autre école ou année échoue pour les deux modes ; (d) deux liens créés à la suite ont des `numero` strictement croissants ; (e) `ar_lien_definir_classes(lien, '{}')` échoue (« au moins une classe ») ; (f) appel avec 3 classes dont une déjà présente et un doublon : le lien finit avec exactement 3 classes, retour 3 ; (g) appel sur un lien `fusion` échoue ; (h) `has_column_privilege('authenticated','public.ar_liens','mode','select')` et `'numero'` = true, `'token_hash'` = false ; (i) `ar_lien_definir_classes` non exécutable par `authenticated` (erreur attendue sous `set local role authenticated`).

- [ ] **Step 2: Écrire la migration** (idempotente, `begin … commit`, en-tête dans le style de `20260924d`) : `add column if not exists mode … check (mode in ('fusion','sommaire'))` ; `add column if not exists numero bigint generated always as identity` + `create unique index if not exists` ; `create or replace function ar_liens_classes_controle()` réécrit : même contrôle école/année, plafond de 10 **seulement si le lien est `fusion`** ; `ar_lien_definir_classes` (plpgsql, `security definer`, `set search_path = public`, verrouille la ligne du lien `for update`, refuse tableau vide ou null, refuse lien non `sommaire`, supprime les classes hors tableau, insère les manquantes `on conflict do nothing` après dédoublonnage du tableau, renvoie le nombre final de classes) ; `grant select (mode, numero) on ar_liens to authenticated` ; `revoke all on function … from public, anon, authenticated` puis `grant execute … to service_role`. Aucune politique RLS modifiée.

- [ ] **Step 3: Relecture** : vérifier que la réécriture du trigger conserve le message actuel « Toutes les classes d'un lien doivent appartenir à la même école et à la même année. » et que `ar_lien_definir_classes` ne contourne pas le trigger (les insertions passent par lui).

- [ ] **Step 4: Application et test, uniquement avec l'accord explicite de JF** : JF (ou l'exécutant, sur autorisation) joue la migration dans le SQL Editor Supabase, puis `liens_sommaire.sql`. Résultat attendu : chaque ligne conforme à son commentaire « attendu » ; si le test ne peut pas être joué, le dire en rendant compte, ne pas écrire « vérifié ».

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261113_amenagactif_liens_sommaire.sql supabase/tests/liens_sommaire.sql
git commit -m "feat(liens): migration sommaire (mode, numero, plafond par mode, fonction atomique)"
```

---

### Task 2: Fonctions pures du domaine

**Files:**
- Modify: `src/domain/liens.js`
- Create: `tests/domain/liensSommaire.test.js`

**Interfaces:**
- Produces (exports de `src/domain/liens.js`, importables par `api/` comme `computeFicheClasse`) :
  - `referenceLien(numero: number | null | undefined): string` : `42` donne `'SL-0042'`, `12345` donne `'SL-12345'`, null ou undefined donne `''`.
  - `trierClasses<T extends { nom: string, niveau: string | null }>(classes: T[]): T[]` : nouveau tableau, niveau en ordre naturel numérique (`Intl.Collator('fr', { numeric: true })`), niveau absent en dernier, puis nom.
  - `nomSommaire(p: { numero: number, cree_le: string, ecole: { nom: string, implantation?: string | null, implantation_nom?: string | null }, destinataire: string, nbClasses: number }): string`.

- [ ] **Step 1: Écrire les tests** dans `tests/domain/liensSommaire.test.js` :
  - `referenceLien formate sur 4 chiffres` : 42 → `SL-0042`, 5 → `SL-0005`, 12345 → `SL-12345`, null → ``.
  - `trierClasses : niveau naturel puis nom, niveau absent en dernier, sans muter` : entrée `[{id:'a',nom:'5B',niveau:'5e'},{id:'b',nom:'ZZ',niveau:null},{id:'c',nom:'3A',niveau:'3e'},{id:'d',nom:'10A',niveau:'10e'},{id:'e',nom:'5A',niveau:'5e'}]` → ids `['c','e','a','d','b']` ; l'entrée est inchangée.
  - `nomSommaire compose numéro, date, implantation, repère et nombre` : `{ numero: 42, cree_le: '2026-11-13T12:00:00Z', ecole: { nom: 'Athénée A', implantation: '4012', implantation_nom: 'Site Centre' }, destinataire: 'A., français', nbClasses: 12 }` → `'Super lien SL-0042 (créé le 13 novembre 2026) · Site Centre (FASE 4012) · A., français · 12 classes'` ; avec `nbClasses: 1` → se termine par `· 1 classe`.

- [ ] **Step 2: Lancer** `npx vitest run tests/domain/liensSommaire.test.js` : attendu FAIL (fonctions absentes).
- [ ] **Step 3: Implémenter** les trois fonctions dans `src/domain/liens.js`, en réutilisant `titreEcole` et `dateFR` existants.
- [ ] **Step 4: Lancer** le même test : attendu PASS ; puis `npx vitest run tests/domain/liens.test.js tests/domain/liensFiltres.test.js` : PASS.
- [ ] **Step 5: Commit** `feat(liens): referenceLien, trierClasses, nomSommaire`.

---

### Task 3: Couche serveur des liens (mode, numéro, classes)

**Files:**
- Modify: `api/_lib/liens.js`, `api/_lib/liensData.js`, `tests/domain/fakeDb.js`
- Test: `tests/domain/liensSommaireData.test.js` (nouveau, `// @vitest-environment node`)

**Interfaces:**
- Consumes: `trierClasses` (Task 2).
- Produces :
  - `api/_lib/liens.js` : `MAX_IDS_PAR_REQUETE = 100` ; `modeValide(v: unknown): 'fusion' | 'sommaire' | null` (`undefined` donne `'fusion'`, valeur inconnue donne `null`) ; `versLienPublic(row, { classes, classeIds, creePar, now })` renvoie en plus `mode`, `numero`, `annee_id`, `classe_ids` (liste blanche, `token_hash` jamais).
  - `liensData.js` : `creerLien(db, { …, mode = 'fusion' }): Promise<{ id, expire_le, numero }>` (fusion : 1 à 10 classes, message actuel ; sommaire : 1 à `MAX_IDS_PAR_REQUETE` ; `nom_groupe` forcé à null pour un sommaire ; insère `mode`) ; `definirClasses(db, lienId: string, classeIds: string[]): Promise<void>` (appelle `db.rpc('ar_lien_definir_classes', { p_lien, p_classes })` ; une erreur `code === 'P0001'` devient `ErreurLien(400, error.message)`, toute autre erreur est relancée) ; `chargerSommaire(db, lien): Promise<{ numero: number, ecole: { nom, implantation, implantation_nom }, classes: { id, nom, niveau }[] }>` (classes triées par `trierClasses`, liste vide possible) ; `COLONNES_LIEN` inclut `mode, numero, annee_id`.
  - `fakeDb(tables, { autoIncrement })` : option `autoIncrement: { ar_liens: 'numero' }` donne `numero` 1, 2, 3… à l'insertion.

- [ ] **Step 1: Écrire les tests** (`liensSommaireData.test.js`, tables comme dans `liensApi.test.js`, avec 22 classes d'une même école/année ajoutées pour ce fichier) :
  - `sommaire de 22 classes accepté : mode, numéro, nom_groupe nul, 22 lignes ar_liens_classes`.
  - `fusion de 11 classes refusée (ErreurLien 400, "1 à 10 classes")` et `sommaire de 101 classes refusé (400)`.
  - `deux créations successives donnent des numéros croissants` (1 puis 2).
  - `modeValide` : `undefined` → `'fusion'`, `'sommaire'` → `'sommaire'`, `'x'` → `null`.
  - `definirClasses appelle la fonction SQL avec p_lien et p_classes` ; `une erreur P0001 devient ErreurLien 400 avec son message` ; `une autre erreur est relancée telle quelle`.
  - `chargerSommaire : école, numéro, classes triées ; liste vide si le lien n'a plus de classes`.
  - `versLienPublic : expose mode, numero, annee_id, classe_ids et jamais token_hash`.
- [ ] **Step 2: Lancer** `npx vitest run tests/domain/liensSommaireData.test.js` : attendu FAIL.
- [ ] **Step 3: Implémenter** les signatures ci-dessus. `fakeDb` : compteur par table, appliqué dans le chemin `insert` seulement si l'option est fournie.
- [ ] **Step 4: Lancer** `npx vitest run tests/domain` : attendu PASS (les tests existants de `liens.test.js` sur `versLienPublic` sont à mettre à jour pour les champs ajoutés, sans affaiblir leurs assertions).
- [ ] **Step 5: Commit** `feat(liens): couche serveur du mode sommaire`.

---

### Task 4: `api/fiche-token.js` : création et lecture d'un sommaire

**Files:**
- Modify: `api/fiche-token.js`
- Test: `tests/domain/liensApi.test.js` (nouveau `describe('sommaire')` ; `fakeDb(tables, { autoIncrement: { ar_liens: 'numero' }, users })` dans `beforeEach`)

**Interfaces:**
- Consumes: `modeValide`, `creerLien`, `chargerSommaire`, `MAX_IDS_PAR_REQUETE`, `trierClasses`.
- Produces (contrat HTTP) :
  - `POST /api/fiche-token` : corps accepte `mode` (`'fusion'` par défaut ; valeur inconnue → 400 « Mode inconnu. ») ; limite de classes dépendante du mode ; `nomGroupe` ignoré pour `sommaire` ; réponse `{ token, url, expire_le, numero }` (`numero` présent pour un sommaire).
  - `GET ?token=<secret>` sur un lien actif `sommaire` : `200 { sommaire: { numero, ecole, classes: [{ id, nom, niveau }] } }`, aucune donnée d'élève, `private, no-store`, ouverture comptée.
  - `GET ?token=<secret>&classe=<uuid>` : `200 { vm, depuisSommaire: true }` si la classe appartient au lien `sommaire` ; sinon 410 uniforme.
  - Paramètre `classe` avec un lien non `sommaire` : 410 uniforme. Chemin des jetons JWT hérités : inchangé.

- [ ] **Step 1: Écrire les tests** (helper `creerSommaire(classeIds = [C1, C2], extra = {})` calqué sur `creerVia`) :
  - `POST sommaire renvoie un numéro ; 22 classes acceptées ; fusion de 11 refusée ; mode inconnu → 400`.
  - `GET sommaire : liste triée, numéro, école, pas de vm, no-store, loadClasseData jamais appelé, ouverture comptée` (le `journal.rpc` contient `ar_lien_compter_ouverture`).
  - `GET sommaire + classe du sommaire : vm et depuisSommaire, loadClasseData appelé avec C1`.
  - `classe hors sommaire, UUID inconnu et mauvais format donnent un corps identique à celui d'un secret inconnu` (comparer avec `toEqual`).
  - `paramètre classe avec un lien fusion ou classe unique → 410 uniforme, loadClasseData non appelé` (Review Focus 1).
  - `sommaire révoqué, expiré : 410 sur le sommaire et sur la fiche`.
  - `sommaire dont ar_liens_classes est vide : 200 avec classes []` (Review Focus 2).
  - `profil-classe : le secret d'un sommaire donne un jeton pour une de ses classes (expiration plafonnée à celle du lien) et est refusé (403) pour une classe hors sommaire` (le spec le donne comme déduit : ce test le transforme en constaté ; si l'assertion échoue, corriger `api/profil-classe.js` au minimum nécessaire et le signaler).
  - Aucune régression : tout `liensApi.test.js` existant reste vert.
- [ ] **Step 2: Lancer** `npx vitest run tests/domain/liensApi.test.js` : nouveaux tests FAIL.
- [ ] **Step 3: Implémenter** dans `api/fiche-token.js` : validation de `mode`, branche `cible` pour `lien.mode === 'sommaire'` avant l'actuelle règle `classeIds.length > 1`, lecture de `req.query.classe`. Même structure de refus que `!lienActif(lien)`.
- [ ] **Step 4: Lancer** `npx vitest run tests/domain` : PASS.
- [ ] **Step 5: Commit** `feat(liens): creation et lecture d'un sommaire dans fiche-token`.

---

### Task 5: `api/liens.js` : liste enrichie et `definir_classes`

**Files:**
- Modify: `api/liens.js`
- Test: `tests/domain/liensApi.test.js` (nouveau `describe('gestion des sommaires')`)

**Interfaces:**
- Consumes: `definirClasses`, `versLienPublic` étendu, `MAX_IDS_PAR_REQUETE`, `statutLien`, `peutGererEcole`.
- Produces :
  - `GET /api/liens` : chaque lien porte aussi `mode`, `numero`, `annee_id`, `classe_ids` (la requête `ar_liens_classes` sélectionne `classe_id` en plus).
  - `POST /api/liens { action: 'definir_classes', lien_id, classe_ids }` → `200 { ok: true, nb }`. Contrôles : UUID valides ; `classe_ids` dédoublonné, de 1 à `MAX_IDS_PAR_REQUETE` ; lien existant (404) ; `peutGererEcole` (403, ce qui exclut l'agent PLAI) ; `mode === 'sommaire'` (400 « Seul un sommaire peut être modifié. ») ; statut `actif` (400 « Ce lien n'est plus actif. ») ; toutes les classes de l'école et de l'année du lien (400) ; puis `definirClasses`.

- [ ] **Step 1: Écrire les tests** (remplacer `mocks.db.rpc` par un double qui applique `ar_lien_definir_classes` à `tables.ar_liens_classes`) :
  - `la liste expose mode, numero, annee_id, classe_ids et jamais token_hash`.
  - `definir_classes remplace l'ensemble des classes (admin et référent de l'école)` : avant `[C1,C2]`, après `[C2, C5]` → lignes correspondantes, réponse `nb: 2`.
  - Refus : agent PLAI (403) ; référent d'une autre école (403) ; lien `fusion` (400) ; lien révoqué (400) ; classe d'une autre école ou d'une autre année (400) ; liste vide (400) ; `lien_id` ou classe non UUID (400) ; lien inconnu (404).
  - `doublons dans classe_ids : dédoublonnés, une seule ligne par classe` (Review Focus 4).
- [ ] **Step 2: Lancer** `npx vitest run tests/domain/liensApi.test.js` : nouveaux tests FAIL.
- [ ] **Step 3: Implémenter** dans `api/liens.js` (la purge et les contrôles existants restent en place).
- [ ] **Step 4: Lancer** `npx vitest run tests/domain` : PASS.
- [ ] **Step 5: Commit** `feat(liens): liste enrichie et definir_classes`.

---

### Task 6: Page publique du sommaire

**Files:**
- Create: `src/components/SommairePublic.jsx`
- Modify: `src/pages/FichePublique.jsx`, `src/App.jsx`
- Test: `tests/domain/sommairePublic.test.jsx` (modèle : `fichePubliqueGuide.test.jsx`)

**Interfaces:**
- Consumes: `referenceLien`, `GET /api/fiche-token` (Task 4).
- Produces : composant `SommairePublic({ sommaire: { numero, ecole, classes }, token })` ; route `/fiche/:token/classe/:classeId` rendant `FichePublique`. `FichePublique` ajoute `&classe=<classeId>` à l'appel quand le paramètre existe et inclut `classeId` dans la `queryKey`.

- [ ] **Step 1: Écrire les tests** (routes `/fiche/:token` et `/fiche/:token/classe/:classeId`, `fetch` simulé) :
  - `affiche le titre « Vos classes — {implantation_nom ou nom} », la référence SL-0042 et un lien par classe vers /fiche/{token}/classe/{id}, dans l'ordre reçu`.
  - `affiche les liens vers le catalogue et le mode d'emploi comme la fiche`.
  - `sommaire vide : message « Aucune classe n'est rattachée pour le moment. Contactez votre référent. », aucun lien de classe` (Review Focus 2).
  - `la fiche d'une classe (réponse avec depuisSommaire) affiche le lien « Retour à mes classes » vers /fiche/{token}` ; `sans depuisSommaire`, ce lien est absent ; `fetch` a été appelé avec une URL contenant `classe=`.
  - `410 → « Ce lien n'est plus actif »` (comportement existant conservé).
- [ ] **Step 2: Lancer** `npx vitest run tests/domain/sommairePublic.test.jsx tests/domain/fichePubliqueGuide.test.jsx` : nouveaux FAIL.
- [ ] **Step 3: Implémenter** : composant (boutons-liens `plai-btn`, 16 px, `no-print` sur le retour), branche dans `FichePublique` selon `data.sommaire` ou `data.vm`, route dans `App.jsx`.
- [ ] **Step 4: Lancer** les deux fichiers : PASS.
- [ ] **Step 5: Commit** `feat(liens): page publique du sommaire`.

---

### Task 7: Création d'un sommaire dans « Fiches »

**Files:**
- Create: `src/components/ChoixModeLien.jsx`
- Modify: `src/components/GenerateurLien.jsx`, `src/pages/FicheClassePage.jsx` (composant `Picker`)
- Test: `tests/domain/generateurLienSommaire.test.jsx` (modèle : `generateurLienAvertissement.test.jsx`)

**Interfaces:**
- Produces : `ChoixModeLien({ mode: 'fusion' | 'sommaire', onChange(mode), nbClasses: number })` (groupe de boutons radio, libellés « Une seule fiche fusionnée » et « Un sommaire : une fiche par classe ») ; `GenerateurLien` accepte `mode = 'fusion'`, l'envoie dans le corps du POST, et pour un sommaire affiche le numéro `SL-xxxx` renvoyé (`referenceLien`) à côté de l'URL.

- [ ] **Step 1: Écrire les tests** :
  - `ChoixModeLien : deux options, la valeur courante cochée, onChange appelé avec 'sommaire'`.
  - `GenerateurLien en mode sommaire : le corps du POST contient mode: 'sommaire' et classeIds (22 ids) ; sans nomGroupe ; après succès, SL-0042 est affiché` (fetch simulé renvoyant `numero: 42`).
  - `GenerateurLien sans mode : le corps ne change pas pour une fusion` (assertion sur `mode: 'fusion'` ou son absence selon l'implémentation, mais cohérente avec l'API).
  - `l'avertissement exact est affiché en mode sommaire`.
- [ ] **Step 2: Lancer** : FAIL.
- [ ] **Step 3: Implémenter**. Dans `Picker` (sélection de 2 classes ou plus, rôles pouvant lier : admin, référent, direction ; l'agent PLAI ne voit pas le choix) : état `mode`, `ChoixModeLien` ; en mode sommaire, masquer « Nom du groupe » et **ne pas** charger l'aperçu fusionné (`useFicheGroupe` désactivé) ; afficher la liste des classes choisies, l'avertissement et `GenerateurLien mode="sommaire"` avec le libellé `Aménagements à mettre en place — Vos classes ({école})`. Changer de mode ou de sélection invalide l'état validé.
- [ ] **Step 4: Lancer** `npx vitest run tests/domain` : PASS.
- [ ] **Step 5: Commit** `feat(liens): creation d'un sommaire depuis Fiches`.

---

### Task 8: Gestion dans « Liens enseignants »

**Files:**
- Create: `src/components/DialogueClasses.jsx`
- Modify: `src/hooks/useLiens.js`, `src/pages/LiensEnseignants.jsx`
- Test: `tests/domain/dialogueClasses.test.jsx` (nouveau) ; `tests/domain/liensPage.test.jsx` (étendu)

**Interfaces:**
- Consumes: `nomSommaire`, `trierClasses` (Task 2) ; `useEcoleGrid(ecoleId, anneeId)` renvoie `{ classes: [{ id, nom, niveau, … }] }`.
- Produces : `useDefinirClasses()` (mutation → `POST /api/liens { action: 'definir_classes', lien_id, classe_ids }`, invalide `['liens']`) ; `DialogueClasses({ lien, classes, enCours, erreur, onEnregistrer(classeIds: string[]), onAnnuler })` (`<dialog>` natif comme `DialogueRevocation`).

- [ ] **Step 1: Écrire les tests** :
  - `DialogueClasses : cases cochées = lien.classe_ids, regroupées par niveau`.
  - `22 classes : 22 cases, « Tout cocher 5e » coche toutes les classes de ce niveau et seulement elles` (Review Focus 5).
  - `impossible de tout décocher : bouton Enregistrer désactivé et message « Un sommaire doit garder au moins une classe. Pour le supprimer, révoquez-le. »`.
  - `Enregistrer appelle onEnregistrer avec les ids cochés ; l'erreur du serveur est affichée dans le dialogue`.
  - `liensPage : une ligne sommaire affiche le nom composé (SL-xxxx, implantation, repère, N classes) et un bouton « Modifier les classes » ; une ligne fusion ne l'a pas ; un sommaire révoqué ne l'a pas`.
  - `liensPage : le paragraphe « Un lien, un seul enseignant » contient la mention du sommaire` (mot pour mot ci-dessous).
- [ ] **Step 2: Lancer** : FAIL.
- [ ] **Step 3: Implémenter**. `TableLiens` reçoit l'objet `ecole` (pas seulement son titre) pour appeler `nomSommaire`. Un composant connecté charge `useEcoleGrid(lien.ecole_id, lien.annee_id)` et rend `DialogueClasses`. Texte du paragraphe, remplaçant la parenthèse actuelle : « la classe reste l'unité de tri d'un lien (un lien par classe, ou un sommaire qui regroupe, pour un même enseignant, l'accès à la fiche de chacune de ses classes) ».
- [ ] **Step 4: Lancer** `npx vitest run tests/domain` : PASS.
- [ ] **Step 5: Commit** `feat(liens): modification des classes d'un sommaire`.

---

### Task 9: Documentation

**Files:**
- Modify (chacun en deux exemplaires `public/modes-emploi/` et `docs/modes-emploi/`) : `directions.html`, `directions-complet.html`, `referents-plai.html`, `enseignants.html`
- Modify: `docs/permissions-roles.md`

- [ ] **Step 1:** Dans les trois guides gestionnaires, compléter la rubrique « Un lien, un seul enseignant » avec la même formulation qu'en Task 8, puis ajouter un court passage « Un enseignant qui a plusieurs classes : le sommaire » : comment le créer (Fiches, sélection de 2 classes ou plus, choix « Un sommaire »), son nom et son numéro `SL-xxxx`, comment ajouter ou retirer des classes (Liens enseignants, « Modifier les classes »), qu'on ne peut pas le vider (on le révoque), qu'il expire le 31 août et se recrée chaque année, et l'avertissement de diffusion.
- [ ] **Step 2:** Dans `enseignants.html` : section « Si vous avez plusieurs classes » (une adresse, la liste de vos classes, « Retour à mes classes », la référence à citer en cas de problème). Consignes à l'impératif, une action par puce.
- [ ] **Step 3:** `docs/permissions-roles.md` : une ligne sur les sommaires dans la section des liens (mêmes droits que les liens : admin, référent, direction ; jamais l'agent).
- [ ] **Step 4: Vérifier** : `grep -rn "un lien par classe, y compris" public docs src` ne renvoie plus rien ; ouvrir deux guides en `file://` et contrôler qu'ils s'affichent.
- [ ] **Step 5: Commit** `docs(liens): sommaire dans les modes d'emploi`.

---

### Task 10: Recette et mise en ligne

**Files:** aucun fichier de code. Compte rendu à JF.

**Précondition (bloquante) : la migration `supabase/migrations/20261113_amenagactif_liens_sommaire.sql` est appliquée AVANT tout déploiement du code.** Le code lit les colonnes `mode` et `numero` (`COLONNES_LIEN`) : sans elles, PostgREST répond 42703 et tous les liens opaques, la passerelle profil-classe, `GET /api/liens` et la création de lien répondent 500. Ordre : migration, puis `supabase/tests/liens_sommaire.sql`, puis merge/déploiement.

- [ ] **Step 1:** `npx vite build` et `npx vitest run` : citer les sorties.
- [ ] **Step 2: Accord de JF** pour appliquer la migration (si ce n'est pas déjà fait en Task 1) ; jouer `supabase/tests/liens_sommaire.sql` et citer le résultat de chaque cas.
- [ ] **Step 3: Parcours réel local** avec `vercel dev` (config `amenagactif-vercel` de `.claude/launch.json`, `NODE_OPTIONS=--use-system-ca` ; `npm run dev` ne lance pas `/api/*`), sur une école d'essai créée puis désactivée, jamais une vraie implantation : créer un sommaire de 3 classes ; ouvrir l'adresse en navigation privée ; ouvrir chaque fiche et revenir au sommaire ; retirer une classe, recharger, constater qu'elle a disparu et que l'ancienne adresse de sa fiche donne « Ce lien n'est plus actif » ; essayer de tout décocher (refusé) ; révoquer et constater le refus ; contrôler la largeur 375 px.
- [ ] **Step 4:** Revue globale de la branche par un relecteur indépendant (règle du projet : revue finale après la dernière tâche).
- [ ] **Step 5: Mise en ligne, sur accord de JF** : fusion dans `main`, `npx vite build`, `git push`, puis répéter le parcours de l'étape 3 sur l'URL publique `amenagactif.jfb4plai.com` (domaine publié) et noter ce qui est constaté, déduit ou non vérifié.
