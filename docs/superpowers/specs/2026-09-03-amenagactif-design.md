# AménagActif — Conception

**Date :** 2026-09-03
**Statut :** validé (brainstorming), en attente de relecture utilisateur avant plan d'implémentation
**Auteur :** Jean-François Beguin (PLAI — Pôle Territorial Ville de Liège) + Claude

---

## 1. Problème et objectif

Les référent·es PLAI et les écoles secondaires accompagnées (11 implantations) tiennent aujourd'hui, dans un classeur Excel partagé (`Classeur source AR.xlsx`), la matrice des aménagements par élève : lignes = ~150 aménagements répartis en 12 chapitres, colonnes = élèves, cases à cocher. Une feuille de synthèse (Feuil2) et un gabarit PDF par classe (`lay-out fiche AUs-ARs par classe.pdf`) sont produits manuellement.

**Objectif :** une application web qui rend la **mise à jour** (aménagement, élève, classe) la plus simple possible, génère automatiquement les fiches par classe et par élève, permet de notifier par mail les enseignants concernés, et exporte un profil d'aménagements de classe réutilisable par DiffActif.

**Principes PLAI applicables :**
- Inclusion : l'outil sert d'abord la continuité des aménagements pour l'élève en difficulté, pas seulement le confort administratif.
- IA amplificateur : pas d'IA en v1 (outil de structuration de données).
- RISS : toute référence scientifique affichée dans l'app devra être vérifiée dans le corpus RISS avant implémentation. Aucune n'est prévue en v1.
- Contexte FWB : cadre des Aménagements Universels (AU) / Aménagements Raisonnables (AR), décret inclusion.

---

## 2. Décisions de conception

| Sujet | Décision |
|---|---|
| Périmètre | 11 implantations secondaires, tout le pôle, dès la v1 |
| Architecture données | Données canoniques Supabase, **seule source de vérité** ; vues = projections pures, jamais stockées |
| Support historique | Snapshot complet de l'état AU/AR d'une classe à chaque envoi de notification |
| Identité élève | Prénom + initiale du nom ; diffusion restreinte aux enseignants concernés (base RGPD acceptée) |
| AU vs AR | `AU` = aménagement universel, **sélection au niveau classe**, apparaît dans « Pour tous ». `AR` = sélection **par élève** |
| « Cours en recto » | AR par élève ; la fiche affiche le **comptage** des élèves concernés |
| Référent PIA (accompagnateur) | Par élève, texte libre en v1 |
| Référents d'école (direction / référent école) | Désignés par année scolaire, au niveau école |
| Catalogue d'aménagements | Figé (~150 items, 12 chapitres), éditable admin PLAI uniquement ; **+ champ libre AR par élève** (le « + » de l'Excel) |
| Écran de saisie | **Vue école** : une colonne par élève (≤ 60), colonnes groupées par classe ; chapitres **repliés par défaut (repli imposé)** ; en-tête élèves figé, titres de chapitres collants ; barre de saut vers les 12 chapitres |
| Listing enseignants | Import CSV/xlsx par école (`classe, nom, email, cours`) |
| Notification | Manuelle (« Notifier la classe ») ; mail = PDF joint + lien à jeton + résumé des changements ; transport branché plus tard (module isolé, stub en v1) |
| Rendu fiche | PDF A4 (gabarit fourni) + page web consultable + fiche synthèse par élève |
| DiffActif | Export d'un profil AU/AR de classe (JSON), format documenté et versionné ; intégration active hors v1 |
| Auth | Référent·es PLAI + directions. Enseignants : pas de compte, lien à jeton signé (lecture seule) |
| Année scolaire | Données rattachées à une année ; clôture + report des élèves montants (avec héritage optionnel de leurs AR) |
| Amorçage | Import du catalogue (obligatoire) + import xlsx classe/école comme **fonctionnalité** de l'app (écoles en transition) |
| Export de sécurité | Régénération de la grille école au format xlsx actuel |
| Stack | React 18 + Vite 5 + Tailwind v3 ; Supabase (projet partagé `dfoaumjleqtxjeaplnna`, tables préfixées `ar_`) ; Vercel (`amenagactif.jfb4plai.com`) ; Serverless Functions `/api/*` |
| Nom / repo | **AménagActif** ; repo GitHub `AmenagActif` (compte jfb4plai, branche `main`) |

**Hors v1 (YAGNI) :** comptes enseignants, intégration DiffActif active, notifications automatiques, multilingue, toute fonctionnalité IA.

---

## 3. Architecture

### 3.1 Vue d'ensemble

```
Saisie (grille type Excel, vue école)
        │  écrit
        ▼
ar_selections (AR/élève) · ar_amenagements_classe (AU/classe) · ar_amenagements_libres (AR libre/élève)
ar_eleves · ar_classes · ar_ecoles · ar_annees · ar_referents_ecole
        │  lisent (projections pures, aucune écriture)
        ├──► Fiche classe (web + PDF)
        ├──► Fiche synthèse élève (web + PDF)
        ├──► Profil classe DiffActif (JSON)
        ├──► Export xlsx (grille école reconstituée)
        └──► Diff vs dernier snapshot (résumé du mail)
```

### 3.2 Modules isolés

| Module | Rôle | Dépendances |
|---|---|---|
| `catalogue` | Les ~150 aménagements + 12 chapitres, lecture seule (édition admin) | `ar_chapitres`, `ar_amenagements` |
| `saisie` | Grille école : écrit `ar_selections`, `ar_amenagements_classe`, `ar_amenagements_libres`, en-têtes élèves | `catalogue`, tables élèves/classes |
| `projections` | Fonctions **pures** `données → vues` (fiche classe, fiche élève, profil DiffActif, diff snapshots, comptage recto) | aucune (entrées en paramètres) |
| `rendu` | Template HTML fiche → PDF (serverless) | `projections` |
| `notification` | Diff snapshot + composition mail + file d'envoi ; transport branchable | `projections`, `ar_fiche_snapshots`, `ar_envois` |
| `import` | CSV enseignants ; xlsx classe/école (bootstrap) | `catalogue`, tables |
| `export` | Profil DiffActif JSON ; xlsx grille école | `projections` |
| `admin-annee` | Clôture d'année, report des élèves montants | tables |

Chaque module est compréhensible et testable seul : entrée / sortie / dépendances explicites. Les `projections` ne touchent jamais la base — elles reçoivent des tableaux et renvoient des objets de vue.

---

## 4. Modèle de données (tables `ar_`)

```
ar_annees              id, libelle ('2025-2026'), active bool

ar_ecoles              id, nom, implantation, actif bool

ar_referents_ecole     id, ecole_id FK, annee_id FK, nom, fonction ('direction'|'referent_ecole'|'plai')

ar_profils_acces       user_id FK profiles, role ('plai'|'direction'), ecole_id FK nullable
                       -- 'plai' sans ecole_id = accès global ; 'direction' = son école

ar_classes             id, ecole_id FK, annee_id FK, nom ('5LA'), niveau
                       unique(ecole_id, annee_id, nom)

ar_eleves              id, classe_id FK, prenom, initiale_nom,
                       referent_plai_nom text,          -- accompagnateur PIA, texte libre (v1)
                       eleve_precedent_id FK nullable    -- report d'année

ar_chapitres           id, ordre int, titre ('5. LECTURE')

ar_amenagements        id, chapitre_id FK, ordre int, libelle text, type ('AU'|'AR'), actif bool
                       -- catalogue figé ; édition admin PLAI uniquement

ar_amenagements_classe classe_id FK, amenagement_id FK, cree_le, cree_par
                       PK(classe_id, amenagement_id)     -- AU retenus pour la classe ('Pour tous')

ar_selections          eleve_id FK, amenagement_id FK, cree_le, cree_par
                       PK(eleve_id, amenagement_id)      -- AR cochés par élève

ar_amenagements_libres id, eleve_id FK, chapitre_id FK nullable, texte, cree_le, cree_par
                       -- le « + » de l'Excel ; type AR implicite ; par élève

ar_enseignants         id, classe_id FK, annee_id FK, nom, email, cours nullable
                       -- importé par CSV/xlsx par école

ar_fiche_snapshots     id, classe_id FK, fige_le, fige_par, contenu jsonb, envoi_le nullable
                       -- état complet AU/AR de la classe au clic « Notifier »

ar_envois              id, snapshot_id FK, enseignant_id FK, statut ('en_attente'|'simule'|'envoye'|'erreur'),
                       erreur text nullable, envoye_le nullable
```

### 4.1 RLS

Toutes les tables `ar_` : RLS `on`.

- `plai` (ligne `ar_profils_acces` sans `ecole_id`) : `select` + `insert` + `update` + `delete` sur tout.
- `direction` (`ecole_id` renseigné) : `select` uniquement, sur les lignes rattachées à son `ecole_id` (jointure via `classe → ecole` ou `ecole_id` direct).
- Aucun accès table pour les enseignants. La fiche leur est servie par `/api/fiche-token` (résolution du JWT signé, hors RLS, lecture seule).
- `ar_amenagements` / `ar_chapitres` : lecture pour tout utilisateur authentifié, écriture `plai` seulement.

### 4.2 Dérivations — jamais stockées

| Vue | Calcul |
|---|---|
| `pourTous` (fiche classe) | `ar_amenagements_classe` de la classe, jointe au catalogue, triée par ordre de chapitre. Puce « mise en page universelle communiquée » surlignée comme le gabarit. |
| `parEleve` (fiche classe) | `ar_selections` (type AR) + `ar_amenagements_libres`, groupés par élève ; élèves sans AR spécifique masqués. |
| `nbRecto` | Nombre d'élèves de la classe ayant coché l'AR « Cours uniquement en recto ». |
| `tableauReferents` | `ar_referents_ecole` (année courante) pour PAR/direction ; `ar_eleves.referent_plai_nom` agrégé par élève pour la colonne PIA. |
| `dateMaj` | `max(cree_le)` des sélections de la classe, ou date du dernier snapshot. |

---

## 5. Écran de saisie (vue école)

```
┌ Athénée X — 2025-2026        [+ élève] [importer xlsx] [exporter xlsx]           ┐
│  Sauter à : [1][2][3][4][5][6][7][8][9][10][11][12]                               │
│                    │ 5LA ───────────────── │ 3TP ───────── │ …   ≤ 60 élèves      │
│                    │ Emilie D.│ Karim B.   │ Léa M.        │     (en-tête figé)   │
│                    │ réf: Mona│ réf: Mona   │ réf: C.       │                     │
│ ── Aménagements universels (par classe) ─────────────────────────────────────────│
│    5LA : ☑ Mise en page communiquée   ☑ Fiches de procédures   ☐ …               │
│    3TP : ☐ …                                                                     │
│ ▶ 1. SUPPORTS, MISE EN PAGE & CONSIGNES              (7 AR cochés)                │
│ ▶ 2. COMMUNICATION ORALE                             (3)                          │
│ ▼ 5. LECTURE                                         (2)          (titre collant) │
│    Utiliser les livres audio        ☐  │ ☐        │ ☑ │                           │
│    Fluorer les lignes …             ☑  │ ☐        │ ☐ │                           │
│    [+ aménagement libre pour un élève]                                            │
│ ▶ 6. ÉCRITURE ET PRODUCTION ÉCRITE                   (0)                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Comportements

- **Vue école** : colonnes = tous les élèves de l'école pour l'année, groupées et étiquetées par classe. Maximum ~60 colonnes.
- **Bandeau AU** en tête : par classe, une seule case par AU du catalogue (écrit `ar_amenagements_classe`). Pas de case AU par élève.
- **Chapitres AR** : repliés par défaut, repli imposé, badge « n AR cochés ». On déplie le chapitre travaillé.
- En-tête élèves **figé** au défilement ; titres de chapitres **collants**.
- Barre de saut rapide vers les 12 chapitres.
- Case AR cochée → écriture immédiate d'une ligne `ar_selections` (autosave, indicateur « enregistré » / « non enregistré »).
- **Aménagement libre** : bouton par chapitre → mini-formulaire (élève concerné + texte). Guidage : label + placeholder concret + texte d'aide sur l'impact.
- En-tête élève éditable : prénom, initiale, référent PLAI (texte libre).
- `+ élève` : ajoute une colonne, choix de la classe (création de classe si absente).
- `importer xlsx` : dépôt du `Classeur source AR.xlsx` d'une école en transition → mapping vers `ar_selections` (AR) et `ar_amenagements_classe` (AU) ; rapport d'import.
- `exporter xlsx` : régénère la grille école au format du classeur actuel.

### Guidage contextuel (règle PLAI)

Chaque en-tête de chapitre porte une phrase d'aide ; chaque champ de saisie libre a label + placeholder + texte d'aide expliquant la portée de la saisie.

### Séparation saisie / vues

L'écran de saisie n'affiche **aucun aperçu de fiche**. Fiche classe, fiche élève, profil DiffActif sont des écrans distincts qui lisent les mêmes données.

---

## 6. Projections & rendu des fiches

Fonctions pures dans `src/projections/` (Vitest, sans DB) :

```
computeFicheClasse(classe, eleves, selectionsAR, auClasse, libres, referents, catalogue)
  → { classe, ecole, annee, dateMaj,
      tableauReferents: { PIA: [...], PAR: [...] },
      pourTous: [{ libelle, chapitre, surligne: bool }],
      parEleve: [{ eleve: 'Emilie D.', ar: ['…', '…'] }],
      nbRecto: int }

computeFicheEleve(eleve, selectionsAR, libres, catalogue)
  → { eleve, classe, parChapitre: [{ chapitre, amenagements: ['…'] }] }

computeProfilDiffActif(classe, eleves, selectionsAR, auClasse, libres, catalogue)
  → { app, version, annee, ecole, classe, auCommuns: [...], arParEleve: [...] }

diffSnapshots(prev, next)
  → { auAjoutes: [...], auRetires: [...],
      arAjoutes: [{ eleve, texte }], arRetires: [{ eleve, texte }] }
```

### Rendu PDF

Fonction serverless `/api/fiche-pdf?type=classe|eleve&id=…`. Template HTML unique (logo PLAI `/plai-logo.jpg` — hauteur fixe, largeur auto ; police Arial pour l'impression ; format A4), converti en PDF. Fidèle au gabarit `lay-out fiche AUs-ARs par classe.pdf` : en-tête date de mise à jour, titre « Aménagements raisonnables - <CLASSE> », tableau PIA/PAR, bloc « Pour tous », tableau « AR spécifiques à un élève », ligne « Nombre de cours à imprimer en recto : N ».

### Rendu web

Mêmes projections, composants React :
- `/classe/:id/fiche` et `/eleve/:id/fiche` — accès `plai` + `direction`
- `/fiche/:token` — enseignant, lien signé, lecture seule

---

## 7. Notification des enseignants

Écran `/classe/:id/notifier` (référent PLAI) :

1. Aperçu de la fiche classe + **diff depuis le dernier envoi** (`diffSnapshots` entre l'état courant et le dernier `ar_fiche_snapshots.contenu`).
2. Destinataires = `ar_enseignants` de la classe (année courante), cases décochables, ajout ponctuel possible.
3. Message d'accompagnement éditable, gabarit pré-rempli, style déclaudisé (pas de « Voici », pas de préambule LLM).
4. **Envoyer** → crée `ar_fiche_snapshots` (fige l'état AU/AR complet) + N lignes `ar_envois` (`statut = 'en_attente'`).

### Module transport isolé

Interface : `sendMail({ to, subject, html, attachments }) → { ok, id?, error? }`.

- v1 : implémentation **stub** — logue et marque `ar_envois.statut = 'simule'`.
- Go-live : implémentation Resend ou SMTP branchée sans toucher au reste.
- File `ar_envois` rejouable : retry sur `statut = 'erreur'`, statuts visibles dans l'UI.

### Contenu du mail

PDF de la fiche en pièce jointe + lien `/fiche/:token` (toujours à jour) + résumé « AR ajoutés / retirés depuis le JJ/MM ».

---

## 8. Imports & exports

### Import enseignants (CSV / xlsx, par école)

- Colonnes : `classe, nom, email, cours` (`cours` optionnel).
- Validation : format email ; `classe` existe (sinon proposée à la création) ; doublons (même email + même classe) fusionnés.
- Rapport : lignes importées / rejetées avec motif — jamais silencieux.
- Remplace le listing de l'école pour l'`annee_id` courante.

### Import xlsx classe/école (bootstrap transition)

- Lit le format `Classeur source AR.xlsx` : ligne `Classe` → `ar_classes` ; colonnes → `ar_eleves` ; cellules cochées → `ar_selections` (AR) ou `ar_amenagements_classe` (AU selon `ar_amenagements.type`).
- Matching des libellés sur `ar_amenagements.libelle` avec normalisation (espaces insécables, casse, ponctuation). Libellés non trouvés : listés, non importés.
- Idempotent : réimport d'une classe = remplacement de son état.

### Export xlsx

`/api/export-xlsx?ecole=:id` — régénère la grille école au format du classeur actuel (filet de sécurité pendant la transition).

### Export profil DiffActif

`/api/profil-diffactif?classe=:id` — JSON téléchargeable + endpoint :

```json
{
  "app": "amenagactif",
  "version": 1,
  "annee": "2025-2026",
  "ecole": "Athénée X",
  "classe": "5LA",
  "auCommuns": [
    { "id": "…", "libelle": "Mise en page universelle communiquée", "chapitre": "1. Supports, mise en page & consignes" }
  ],
  "arParEleve": [
    { "eleve": "Emilie D.", "amenagements": ["Utiliser les livres audio pour la lecture"] }
  ]
}
```

Format documenté et versionné (`version`). DiffActif le consommera pour pré-cocher les aménagements ; l'intégration active est hors v1.

---

## 9. Cycle de vie annuel

- Toute donnée métier porte un `annee_id`.
- Écran `admin-annee` (référent PLAI) : **clôture** de l'année N (fiches passées en lecture seule, consultables) puis **création** de l'année N+1.
- **Report des élèves montants** : pour un élève, création d'une entrée N+1 dans sa nouvelle classe avec `eleve_precedent_id` renseigné et **héritage optionnel de ses AR** comme point de départ (le référent ajuste ensuite).
- Purge RGPD : suppression des années au-delà de la durée de conservation décidée (paramètre, hors v1 le cas échéant — à trancher au plan).

---

## 10. Gestion d'erreurs & tests

| Cible | Approche |
|---|---|
| `projections` | Tests unitaires purs (Vitest) : AU classe / AR élève, élève sans AR, `diffSnapshots`, comptage recto, classe vide, aménagement libre |
| `import` enseignants | Tests sur CSV valide + CSV malformé (email invalide, classe inconnue, doublon) |
| `import` xlsx | Test sur le vrai `Classeur source AR.xlsx` (Feuil1) : classes/élèves/coches attendus, libellés non matchés listés |
| `rendu` PDF | Snapshot du HTML pré-conversion (non-régression légère) |
| `notification` | Transport stub testable ; file `ar_envois` avec retry ; statuts dans l'UI |
| Build | `npx vite build` sans erreur **obligatoire** avant tout `git push` |
| Saisie | Autosave avec état « non enregistré » visible ; jamais de perte silencieuse |

---

## 11. Sécurité (checklist pre-deploy)

- Variables d'environnement dans Vercel uniquement.
- RLS `on` sur toutes les tables `ar_`, policies via `ar_profils_acces` et `auth.uid()`.
- Lien enseignant = JWT signé côté serveur, expiration, lecture seule, résolution hors RLS dans `/api/fiche-token`.
- Aucune clé exposée au frontend ; aucun `console.log` avec données élève ou secrets.
- Pas d'IA en v1 → pas d'`ANTHROPIC_API_KEY`.
- Données nominatives minimales (prénom + initiale) ; diffusion restreinte aux enseignants de la classe.

---

## 12. Pipeline PLAI

1. Dossier local : `C:\Users\jfbeg\OneDrive\claude-workspace\AmenagActif\` (ce doc + session-prompt).
2. Repo GitHub `AmenagActif` (jfb4plai, `main`) créé dès le début.
3. Vercel connecté au repo, sous-domaine `amenagactif.jfb4plai.com`.
4. Supabase : projet partagé `dfoaumjleqtxjeaplnna`, tables `ar_`, `profiles` réutilisée, pas de recréation du trigger `updated_at`.
5. CSS partagé PLAI (`shared/css/plai-style.css`) copié dans `src/`, fonts DM Serif Display + DM Sans dans `index.html`, logo `/plai-logo.jpg` dans `public/`, branding nav + container + footer inclus dans le plan.

---

## 13. Points ouverts pour le plan d'implémentation

- Bibliothèque de conversion PDF (`@react-pdf/renderer` vs HTML + Playwright/Chromium serverless sur Vercel).
- Durée de conservation RGPD et mécanisme de purge (paramètre vs manuel).
- Modèle exact des permissions `direction` (jointure `classe → ecole` ou `ecole_id` dénormalisé sur plus de tables).
- Détail du format d'import CSV enseignants (séparateur, encodage attendu).
