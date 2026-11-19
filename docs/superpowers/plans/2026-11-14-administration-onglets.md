# Administration en onglets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper la page Administration (603 lignes) en six onglets à adresse propre, ajouter recherche et cases à cocher des niveaux dans « Membres », et un onglet « Droits » en lecture seule, sans changer le comportement existant.

**Architecture:** `/administration/*` devient une mise en page (`AdminLayout`) avec une barre de liens et des sous-routes ; chaque section existante est déplacée à l'identique dans son fichier d'onglet. La logique nouvelle (filtre, niveaux, droits) vit dans des modules purs de `src/domain/`, testés sans réseau ; les droits sont centralisés dans `droits.js`, dont `App.jsx` et `Nav.jsx` importent leurs tableaux de rôles. Aucune migration, aucune modification de `api/*`.

**Tech Stack:** React 18, React Router 6, TanStack Query, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-13-administration-onglets-design.md` (corrigée le 2026-11-14 : tests de composants autorisés, lien de retour de Transmission supprimé, `docs/permissions-roles.md` cité sans lien). Maquette de référence : `docs/maquettes/administration-onglets.html`.

## Global Constraints

- Branche `feat/administration-onglets` issue de `main`. `npx vite build` et `npx vitest run` passent avant tout push ; aucun push sans accord de JF.
- Chaque commit se termine par la ligne : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Aucune migration SQL, aucun changement dans `api/`, `supabase/`, aucune règle RLS.
- Adresses : `/administration` redirige (remplacement d'historique) vers `/administration/membres` ; sous-routes `membres`, `droits`, `ecoles`, `annees`, `catalogue`, `transmission` ; `/administration/transmission` garde son adresse actuelle.
- Libellés des onglets : « Membres & accès », « Droits », « Écoles », « Années », « Catalogue », « Transmission ». Un seul `h1` (« Administration »), un `h2` par onglet.
- Contrôle d'accès `RequireRole roles={['admin']}` appliqué une seule fois, sur la route parente.
- Texte 16 px minimum, focus visible, aucun défilement horizontal de la page à 375 px (le tableau des droits défile dans son propre cadre), texte français sans emoji.
- Aucune nouvelle table, aucun nouveau nom de rôle en dur, aucun chiffre propre à Liège dans les textes (« 11 implantations » disparaît).
- Les nouvelles lectures de classes passent par `ar_classes` côté client (RLS existante) ; les écritures des niveaux passent par l'appel existant `changerRole.mutate({ userId, role, niveaux })`.

## Review Focus

1. Un compte non administrateur (référent, direction, agent) ouvrant `/administration`, `/administration/droits` ou `/administration/catalogue` doit être refusé comme aujourd'hui : le contrôle est sur la route parente, vérifié par lecture de `App.jsx` (pas de test automatique cheap) et à la recette (Task 9).
2. Adresses héritées : `/administration` redirige sans empiler l'historique, `/administration/transmission` fonctionne, une adresse inconnue sous `/administration/` affiche la page « introuvable » (Task 3).
3. Niveaux de la direction : valeur enregistrée absente des classes actuelles reste cochée et conservée ; zéro case = toutes les classes (`niveaux` envoyé vide) ; variantes de saisie (« 5e » et « 5E ») = deux cases ; classes sans niveau comptées et signalées ; décocher la dernière case n'efface pas d'autres niveaux (Tasks 2 et 5).
4. Filtre des membres : recherche partielle, sans casse ni accents, sur adresse et nom ; filtre de rôle ; groupes vides masqués ; compteur « X comptes affichés sur Y » (singulier/pluriel) ; un compte sans école reste signalé même filtré (Tasks 2 et 4).
5. Dérive des droits : les tableaux importés par `App.jsx` et `Nav.jsx` doivent rester strictement identiques à leurs valeurs d'origine (épinglés par test sur les littéraux) ; chaque cellule de la matrice cite sa preuve (fichier:ligne) ou reste « À confirmer » (Task 1).

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/domain/droits.js` (nouveau) | rôles, libellés, matrice des capacités, tableaux de rôles dérivés |
| `src/domain/membres.js` (nouveau) | `filtrerMembres`, `grouperMembres`, `compteurMembres` |
| `src/domain/niveauxDirection.js` (nouveau) | options, bascule et messages des niveaux de la direction |
| `src/hooks/useNiveauxEcoles.js` (nouveau) | lecture des niveaux des classes |
| `src/pages/administration/AdminLayout.jsx`, `onglets.js`, `AdministrationRoutes.jsx` (nouveaux) | mise en page, liste des onglets (données), sous-routes |
| `src/pages/administration/{Membres,Ecoles,Annees,Catalogue,Droits}Tab.jsx`, `NiveauxDirection.jsx` (nouveaux) | onglets |
| `src/pages/Administration.jsx` | supprimé |
| `src/pages/TransmissionProfil.jsx`, `src/App.jsx`, `src/components/Nav.jsx` | adaptés |
| `src/components/BandeauBascule.jsx`, `src/pages/Reprise.jsx`, `public/modes-emploi/reprise-nouvelle-annee.html`, `docs/modes-emploi/reprise-nouvelle-annee.html`, `docs/permissions-roles.md` | liens et textes |

---

### Task 0: Branche et documents

- [ ] **Step 1:** `git switch -c feat/administration-onglets` ; `git add docs/superpowers/specs/2026-11-13-administration-onglets-design.md docs/superpowers/plans/2026-11-14-administration-onglets.md docs/maquettes/administration-onglets.html` ; commit `docs: spec, plan et maquette de l'administration en onglets`.

---

### Task 1: Droits centralisés

**Files:**
- Create: `src/domain/droits.js`, `tests/domain/droits.test.js`
- Modify: `src/App.jsx` (constantes lignes 25-27), `src/components/Nav.jsx` (ligne 28)

**Interfaces:**
- Produces (exports de `src/domain/droits.js`) :
  - `ROLES = ['admin','referent_plai','direction','agent_plai']` ; `LIBELLE_ROLE: Record<Role,string>` = Administrateur, Référent PLAI, Direction, Agent accompagnant.
  - `CAPACITES: { id: string, libelle: string, effet: string, roles: Record<Role, boolean | null> }[]` (`null` = à confirmer). Identifiants : `consulter_fiches`, `saisir`, `ajouter_au`, `retirer_au`, `creer_classe`, `supprimer_renommer_classe`, `changer_classe`, `reprise`, `creer_liens`, `gerer_tous_liens`, `mon_ecole`, `administration`, `archives`. (Mise à jour du 2026-11-19 : `main` a changé depuis la rédaction : l'agent accompagnant crée désormais des classes et des liens enseignants, et ne révoque/modifie que ses propres liens. Les valeurs ci-dessous du spec sont donc périmées pour l'agent : **le code actuel de `main` fait foi**.)
  - `rolesAvec(id: string): Role[]` (rôles à `true`, dans l'ordre de `ROLES`) ; `EDITEURS = rolesAvec('saisir')` ; `GESTIONNAIRES_LIENS = rolesAvec('reprise')` (nom conservé : c'est la constante d'`App.jsx`, qui ne sert plus qu'à la reprise d'année) ; `LIENS_ENSEIGNANTS = rolesAvec('creer_liens')` ; `LECTEURS = EDITEURS`.

- [ ] **Step 1: Écrire les tests** (`droits.test.js`) : `EDITEURS` égal à `['admin','referent_plai','direction','agent_plai']` ; `GESTIONNAIRES_LIENS` égal à `['admin','referent_plai','direction']` ; `LIENS_ENSEIGNANTS` égal à `['admin','referent_plai','direction','agent_plai']` ; `LECTEURS` égal à `EDITEURS` (littéraux copiés des constantes actuelles d'`App.jsx`, lignes 24-27) ; chaque capacité a une valeur (`true`, `false` ou `null`) pour chacun des quatre rôles ; `administration` n'est `true` que pour `admin` ; `mon_ecole` est `false` pour `admin` et `true` pour les trois autres ; `LIBELLE_ROLE` a quatre entrées non vides ; `rolesAvec('inconnu')` renvoie `[]`.
- [ ] **Step 2:** `npx vitest run tests/domain/droits.test.js` : FAIL.
- [ ] **Step 3: Implémenter `droits.js`.** Valeurs de départ : celles de la matrice du spec (section « Onglet Droits »). **Vérifier chaque cellule contre le code avant de la figer** : `App.jsx` (`EDITEURS`, `GESTIONNAIRES_LIENS`, routes), `Nav.jsx`, `api/_lib/liens.js` (`ROLES_GESTION_LIENS`), `api/membres.js`, et les fonctions SQL `ar_can_edit_ecole`, `ar_can_editer_structure_ecole`, `ar_can_read_ecole`, `ar_classes_controle_nom`, `ar_changer_classe_eleve`, `ar_archive_*` (dans `supabase/migrations/`). Relire en particulier les migrations récentes `20261119_*`, `20261119b_amenagactif_agent_cree_classe.sql`, `20261120_*` et `api/liens.js` (`peutAgirSurLien`). Pour les lignes à `null` du spec (`changer_classe`, `archives`), déterminer la valeur par lecture du SQL et du code ; laisser `null` seulement si le code ne permet pas de trancher. Chaque `effet` est une phrase française courte et exacte.
- [ ] **Step 4: Brancher `App.jsx` et `Nav.jsx`** : `App.jsx` importe `EDITEURS`, `GESTIONNAIRES_LIENS`, `LIENS_ENSEIGNANTS`, `LECTEURS` de `droits.js` et supprime ses quatre définitions (lignes 24-27) ; `Nav.jsx` remplace le tableau `['admin', 'referent_plai', 'direction', 'agent_plai']` (lien « Liens enseignants ») par `LIENS_ENSEIGNANTS`. Rien d'autre ne change (la condition `role !== 'agent_plai'` du lien « Reprise d'année » reste telle quelle).
- [ ] **Step 5: Rapport de vérification** (à mettre dans le compte rendu de la tâche, pas dans le code) : un tableau capacité × rôle avec, pour chaque cellule, la preuve (fichier:ligne) ou « à confirmer », et la liste des écarts entre le spec et le code. Ne corriger aucun écart en silence : la valeur du code l'emporte et l'écart est signalé.
- [ ] **Step 6:** `npx vitest run` et `npx vite build` : PASS. Commit `feat(admin): droits centralisés (droits.js)`.

---

### Task 2: Logique pure des membres et des niveaux

**Files:**
- Create: `src/domain/membres.js`, `src/domain/niveauxDirection.js`, `tests/domain/membres.test.js`, `tests/domain/niveauxDirection.test.js`

**Interfaces:**
- Produces :
  - `filtrerMembres(membres: Membre[], opts?: { texte?: string, role?: string }): Membre[]` — `texte` rogné, insensible à la casse et aux accents, cherché dans `email + ' ' + nom` ; `role` vide = tous ; ne modifie pas l'entrée.
  - `grouperMembres(membres, ecoles): { admins: Membre[], parEcole: { ecole, membres: Membre[] }[], sansEcole: Membre[] }` — mêmes règles que le code actuel de `SectionMembres` : `admins` = rôle `admin` ; `parEcole` suit l'ordre de `ecoles`, un membre y figure si `m.ecoleId === ecole.id` ou `m.ecoleIds` le contient (un admin rattaché apparaît aussi dans son école) ; `sansEcole` = rôle ≠ `admin`, sans `ecoleId` et sans `ecoleIds`.
  - `compteurMembres(affiches: number, total: number): string` — `'1 compte affiché sur 23'`, `'5 comptes affichés sur 23'`, `'0 compte affiché sur 23'`.
  - `optionsNiveaux({ niveauxClasses: (string | null)[], enregistres: string[] }): { options: { valeur: string, coche: boolean, absent: boolean }[], sansNiveau: number }` — valeurs distinctes (comparaison exacte, rognées, vides ignorées) triées par `Intl.Collator('fr', { numeric: true })`, puis les `enregistres` absents des classes ajoutés (`absent: true`, `coche: true`) ; `coche` = présent dans `enregistres` ; `sansNiveau` = nombre de `null`/chaînes vides.
  - `basculerNiveau(enregistres: string[], valeur: string, coche: boolean): string[]` — sans doublon, autres valeurs conservées, ordre collator numérique.
  - `messageNiveaux({ nbCoches: number, sansNiveau: number }): { texte: string, avertissement: string | null }` — zéro case : `texte` = « Aucun niveau coché : apparaît sur toutes les classes. », pas d'avertissement ; sinon `texte` = « Apparaît seulement sur les classes des niveaux cochés. » et, si `sansNiveau > 0`, `avertissement` = « 1 classe sans niveau : cette direction n'y apparaît pas. » ou « N classes sans niveau : cette direction n'y apparaît pas. ».

- [ ] **Step 1: Écrire les tests.**
  - `membres.test.js` : recherche `dubois` trouve `Hélène Dubois` ; `helene` trouve `Hélène` (accents) ; `DUBOIS@ECOLE.BE` (casse) ; filtre de rôle `direction` ; combinaison texte + rôle ; texte vide = tous ; `grouperMembres` : un admin rattaché apparaît dans `admins` ET dans son école, un référent à deux écoles apparaît dans les deux, un compte sans école (non admin) est dans `sansEcole`, un admin sans école n'y est pas ; `compteurMembres(1, 23)`, `(5, 23)`, `(0, 23)` aux chaînes ci-dessus.
  - `niveauxDirection.test.js` : `optionsNiveaux({ niveauxClasses: ['5e','3e','5E',null,'', '10e','3e'], enregistres: ['3e','2e'] })` → valeurs dans l'ordre `3e, 5e, 5E, 10e` puis `2e` (absent, coché), `3e` coché, `sansNiveau` = 2 ; `basculerNiveau(['3e'], '4e', true)` → `['3e','4e']` ; décocher la dernière → `[]` ; `basculerNiveau(['3e'], '3e', true)` → pas de doublon ; `messageNiveaux` : zéro case, une case avec 0/1/2 classes sans niveau (chaînes exactes ci-dessus).
- [ ] **Step 2:** `npx vitest run tests/domain/membres.test.js tests/domain/niveauxDirection.test.js` : FAIL.
- [ ] **Step 3: Implémenter** les six fonctions (modules purs, sans import). `grouperMembres` reprend la logique inline de `SectionMembres` (`Administration.jsx`, lignes 36-43) sans en changer le sens.
- [ ] **Step 4:** mêmes tests : PASS. Commit `feat(admin): logique pure des membres et des niveaux`.

---

### Task 3: Mise en page, routes et déplacement des sections

C'est un déplacement à l'identique : aucun comportement ne change.

**Files:**
- Create: `src/pages/administration/AdminLayout.jsx`, `onglets.js`, `AdministrationRoutes.jsx`, `MembresTab.jsx`, `EcolesTab.jsx`, `AnneesTab.jsx`, `CatalogueTab.jsx`, `tests/domain/administrationOnglets.test.jsx`
- Delete: `src/pages/Administration.jsx`
- Modify: `src/App.jsx` (routes lignes 58 et 60), `src/pages/TransmissionProfil.jsx`, `tests/domain/dispositifsAdminCatalogue.test.jsx` (fonction `rendre`, ligne 88), `tests/domain/transmissionPage.test.jsx`

**Interfaces:**
- Produces :
  - `ONGLETS_ADMIN: { chemin: string, libelle: string, roles: Role[] }[]` (`onglets.js`) : `membres`, `ecoles`, `annees`, `catalogue`, `transmission` (le tableau reçoit `droits` à la Task 6), tous `roles: ['admin']`.
  - `AdminLayout()` : conteneur `plai-section space-y-4 max-w-4xl px-4` avec `h1` « Administration », `<nav aria-label="Sections de l'administration">` de `NavLink` construits depuis `ONGLETS_ADMIN` (retour à la ligne, texte 16 px, focus visible, `aria-current="page"` via NavLink), puis `<Outlet />`.
  - `AdministrationRoutes()` : `<Routes>` avec `AdminLayout` en route parente, `index` → `<Navigate to="membres" replace />`, une route par onglet, `*` → `NotFound`.
  - Composants par défaut `MembresTab`, `EcolesTab`, `AnneesTab`, `CatalogueTab`.
  - `App.jsx` : `<Route path="/administration/*" element={<RequireAuth><Shell><RequireRole roles={['admin']}><AdministrationRoutes /></RequireRole></Shell></RequireAuth>} />` remplace les deux routes `/administration` et `/administration/transmission`.

- [ ] **Step 1: Écrire `administrationOnglets.test.jsx`** (les cinq onglets sont remplacés par des stubs via `vi.mock` : `default: () => <h2>…</h2>`) avec `MemoryRouter` + `<Routes><Route path="/administration/*" element={<AdministrationRoutes />} /></Routes>` : `/administration` affiche l'onglet Membres et l'adresse devient `/administration/membres` sans entrée d'historique supplémentaire ; chaque onglet est atteint par son adresse directe ; la navigation expose cinq liens nommés ci-dessus et `aria-current="page"` sur l'actif seul ; `/administration/inexistant` affiche la page « introuvable » ; un seul `h1` « Administration ».
- [ ] **Step 2:** `npx vitest run tests/domain/administrationOnglets.test.jsx` : FAIL.
- [ ] **Step 3: Déplacer le code** de `Administration.jsx` sans le modifier : `SectionMembres`, `MembreRow` et les constantes `LABEL_ROLE`, `ROLE_SCOPE`, `ROLE_SCOPE_MULTI` → `MembresTab.jsx` (`SectionMembres` devient le composant par défaut `MembresTab`) ; `SectionEcoles` → `EcolesTab.jsx` ; `SectionAnnees` → `AnneesTab.jsx` ; `SectionCatalogue`, `FenetreUsage`, `AIDE_NE_PAS_TRANSMETTRE`, `AjoutAmenagement`, `AjoutChapitre` → `CatalogueTab.jsx`. Chaque fichier reprend uniquement les imports dont il a besoin. Le lien du catalogue vers `/administration/transmission` reste valide. Supprimer `Administration.jsx`.
- [ ] **Step 4: Adapter `TransmissionProfil.jsx`** : retirer le paragraphe du lien « Retour à l'Administration », passer son `h1` en `h2`, retirer le conteneur de page redondant si le layout le fournit déjà (garder le contenu et les textes). Adapter `transmissionPage.test.jsx` à ces deux changements sans affaiblir ses autres assertions.
- [ ] **Step 5: Adapter `dispositifsAdminCatalogue.test.jsx`** : `rendre` monte `CatalogueTab` dans `MemoryRouter` (importer `CatalogueTab` au lieu de `Administration`) ; les autres assertions restent.
- [ ] **Step 6:** écrire `AdminLayout`, `onglets.js`, `AdministrationRoutes`, brancher `App.jsx`. Lancer `npx vitest run` (tout) et `npx vite build` : PASS.
- [ ] **Step 7: Commit** `refactor(admin): onglets par adresse, sections déplacées à l'identique`.

---

### Task 4: Membres, recherche, alerte et aide

**Files:**
- Modify: `src/pages/administration/MembresTab.jsx`
- Create: `tests/domain/membresTab.test.jsx`

**Interfaces:**
- Consumes: `filtrerMembres`, `grouperMembres`, `compteurMembres` (Task 2) ; `LIBELLE_ROLE` (Task 1, remplace `LABEL_ROLE`).

- [ ] **Step 1: Écrire `membresTab.test.jsx`** (hooks `useMembres`, `useMembresMutations`, `useEcoles` simulés ; cinq comptes fictifs dans deux écoles dont deux sans école) : au chargement, le compteur affiche « 5 comptes affichés sur 5 » ; saisir `dubois` ne laisse que ce compte, le compteur dit « 1 compte affiché sur 5 », et les écoles sans résultat disparaissent ; le filtre de rôle `Direction` ne garde que les directions ; une alerte `role="status"` annonce « 2 comptes sans école assignée (à corriger) » et reste affichée même si un filtre masque ces comptes ; l'aide courte est visible et le détail des rôles est dans un `<details>` « Comprendre les rôles » fermé par défaut ; les champs de recherche et de rôle ont un label, un placeholder (« Adresse ou nom, ex. dubois ») et le texte d'aide « Tapez une partie de l'adresse ou du nom. Les groupes sans résultat disparaissent. ».
- [ ] **Step 2:** `npx vitest run tests/domain/membresTab.test.jsx` : FAIL.
- [ ] **Step 3: Implémenter** dans `MembresTab.jsx` : état `{ texte, role }`, liste filtrée par `filtrerMembres` puis regroupée par `grouperMembres` ; le comptage « sans école » se calcule sur la liste **non filtrée** ; l'invitation, les mutations et toutes les actions de `MembreRow` restent inchangées ; le long paragraphe d'aide est déplacé dans le `<details>` (texte conservé), remplacé en tête par une phrase courte visible.
- [ ] **Step 4:** `npx vitest run` et `npx vite build` : PASS. Commit `feat(admin): recherche et filtre des membres, alerte comptes sans école`.

---

### Task 5: Niveaux de la direction en cases à cocher

**Files:**
- Create: `src/hooks/useNiveauxEcoles.js`, `src/pages/administration/NiveauxDirection.jsx`, `tests/domain/niveauxDirectionUi.test.jsx`
- Modify: `src/pages/administration/MembresTab.jsx` (ligne `direction` de `MembreRow`)

**Interfaces:**
- Consumes: `optionsNiveaux`, `basculerNiveau`, `messageNiveaux` (Task 2) ; `useAnneeActive()` (renvoie la ligne d'année active ou `null`) ; `changerRole.mutate({ userId, role, niveaux })` existant (l'API enregistre `null` si le tableau est vide).
- Produces : `useNiveauxEcoles(ecoleIds: string[], anneeId: string | null | undefined)` → requête TanStack `{ data: (string | null)[] }` (valeur `niveau` de chaque classe de ces écoles pour cette année), désactivée sans école ou sans année, clé `['niveaux-ecoles', ecoleIds triés, anneeId]` ; `NiveauxDirection({ membre, onChange(niveaux: string[]), enregistrement: 'idle' | 'enCours' | 'ok' | 'erreur' })`.

- [ ] **Step 1: Écrire les tests** (`niveauxDirectionUi.test.jsx`, hook `useNiveauxEcoles` simulé) : le groupe « Apparaît sur les fiches des classes de niveau » (`fieldset` + `legend`) liste une case par niveau des classes, cochée selon `membre.niveaux` ; cocher une case appelle `onChange` avec les niveaux enregistrés plus celui-ci ; décocher la dernière appelle `onChange([])` ; une valeur enregistrée absente des classes reste cochée avec « (absent des classes actuelles) » ; `5e` et `5E` donnent deux cases ; zéro case coché affiche « Aucun niveau coché : apparaît sur toutes les classes. » ; une case cochée avec 2 classes sans niveau affiche l'avertissement « 2 classes sans niveau : cette direction n'y apparaît pas. » ; l'état `ok` affiche « Enregistré » dans une région `role="status"`, `erreur` affiche « Enregistrement impossible, réessayez. » en `role="alert"` ; un membre sans école de rattachement ou une année active absente affiche « Aucune classe à proposer pour le moment. » sans case.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implémenter** `useNiveauxEcoles` (lecture `ar_classes` : `select('niveau')`, `.in('ecole_id', ids)`, `.eq('annee_id', anneeId)`), `NiveauxDirection` (texte 16 px, cases au moins 24 px, labels explicites) et l'intégrer à la ligne `direction` de `MembreRow` à la place du champ texte « Niveaux (ex: 3e,4e,5e,6e), vide=tous » : écoles de la direction = union dédoublonnée de `membre.ecoleId` et `membre.ecoleIds` ; l'enregistrement se fait à chaque case via `changerRole.mutate({ userId, role, niveaux })`, l'état affiché venant de `isPending`/`isSuccess`/`isError` de cette mutation pour ce membre.
- [ ] **Step 4:** `npx vitest run` et `npx vite build` : PASS. Commit `feat(admin): niveaux de la direction en cases à cocher`.

---

### Task 6: Onglet Droits (lecture seule)

**Files:**
- Create: `src/pages/administration/DroitsTab.jsx`, `tests/domain/droitsTab.test.jsx`
- Modify: `src/pages/administration/onglets.js`, `src/pages/administration/AdministrationRoutes.jsx`

**Interfaces:**
- Consumes: `CAPACITES`, `ROLES`, `LIBELLE_ROLE` (Task 1) ; `ONGLETS_ADMIN`, `AdministrationRoutes` (Task 3).

- [ ] **Step 1: Écrire `droitsTab.test.jsx`** : `h2` « Droits » ; bandeau exact « Ce tableau décrit les droits actuels. Il n'est pas encore modifiable ici. » avec mention en texte simple de `docs/permissions-roles.md` (sans lien) ; un tableau avec légende (`sr-only`), cinq en-têtes de colonne (`scope="col"`) et une ligne par capacité de `CAPACITES` (`scope="row"`) ; chaque cellule contient « Oui », « Non » ou « À confirmer » en toutes lettres ; le cadre du tableau est une région `role="region"` focalisable (`tabIndex=0`) nommée « Tableau des droits, défilable horizontalement » ; la page de navigation expose maintenant six liens, « Droits » en deuxième position.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implémenter** `DroitsTab`, ajouter `{ chemin: 'droits', libelle: 'Droits', roles: ['admin'] }` en 2e position de `ONGLETS_ADMIN` et la route `droits`. Mettre à jour `administrationOnglets.test.jsx` (six liens).
- [ ] **Step 4:** `npx vitest run` et `npx vite build` : PASS. Commit `feat(admin): onglet Droits en lecture seule`.

---

### Task 7: Liens entrants et textes

**Files:**
- Modify: `src/components/BandeauBascule.jsx` (ligne 17), `src/pages/Reprise.jsx` (ligne ~99), `src/pages/administration/EcolesTab.jsx`, `public/modes-emploi/reprise-nouvelle-annee.html`, `docs/modes-emploi/reprise-nouvelle-annee.html`, `docs/permissions-roles.md`
- Test: `tests/domain/basculeAnnee.test.js` (relire), un test de rendu de `BandeauBascule` si aucun n'existe

- [ ] **Step 1: Écrire un test** : le lien « Administration » de `BandeauBascule` mène à `/administration/annees` ; le renvoi de `Reprise.jsx` vers l'administration est un lien vers `/administration/annees` ; le texte d'aide de `EcolesTab` ne contient plus « 11 » (il dit « Les implantations accompagnées »).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implémenter** ces trois changements. Dans les deux modes d'emploi, remplacer « rubrique / section Années » par « onglet Années » (lignes `public/…:109`, `docs/…:93` et `:104`) sans toucher au reste ; les fins de ligne du fichier sont préservées. `docs/permissions-roles.md` : mettre à jour les sections Administration (six onglets, onglet Droits en lecture seule, niveaux en cases à cocher, adresses des onglets).
- [ ] **Step 4:** `grep -rn "rubrique « Années »\|section Années" public docs` ne renvoie plus rien ; `npx vitest run` et `npx vite build` : PASS. Commit `docs(admin): liens vers l'onglet Années et textes des guides`.

---

### Task 8: Revue globale

- [ ] **Step 1:** revue de toute la branche (un relecteur indépendant) : droits non dérivés, aucun comportement changé dans les sections déplacées (comparer chaque corps de composant avec l'ancien `Administration.jsx` via `git show main:src/pages/Administration.jsx`), accès réservé à l'administrateur sur la route parente, un seul `h1`, textes 16 px.

---

### Task 9: Recette et mise en ligne

- [ ] **Step 1:** `npx vite build` et `npx vitest run` : citer les sorties. Aucune migration : le code peut partir sans précondition de base.
- [ ] **Step 2: Recette de JF (connexion requise, non testable par l'exécutant)** : avec un compte administrateur, ouvrir chaque onglet par son adresse et après rechargement ; vérifier que `/administration` redirige vers Membres ; essayer la recherche, le filtre de rôle et les cases « Niveaux » sur une direction d'essai (puis contrôler la colonne PAR d'une fiche) ; avec un compte référent d'essai, vérifier le refus sur `/administration/droits` et `/administration/catalogue` ; vérifier l'affichage à 375 px (pas de défilement horizontal de la page) ; faire un geste réel de l'ancien comportement par onglet (ajouter puis désactiver une école d'essai, ajouter une année sans l'activer, ouvrir une fenêtre d'usage du catalogue). Aucune invitation réelle sans accord.
- [ ] **Step 3: Mise en ligne, sur accord de JF** : fusion dans `main`, `npx vite build`, `git push`, puis vérifier les guides modifiés et l'adresse `/administration` sur le domaine public.
