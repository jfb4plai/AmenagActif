# AménagActif — Rôles, permissions et autorisations

Document de référence pour comprendre ce que voit et peut modifier chaque rôle, et comment un administrateur gère les comptes. Mis à jour au 2026-09-24 (Administration.jsx, App.jsx, Nav.jsx, MonEcole.jsx, SaisieEcole.jsx, BandeauAU.jsx, migrations Supabase `2026090x`–`20260924`).

## Les 4 rôles

| Rôle | Portée | Écriture | Lecture | Visible dans « Mon école » (équipe) |
|---|---|---|---|---|
| **Administrateur** (`admin`) | Toute l'application, toutes les écoles | Tout : membres, écoles, années, catalogue AU/AR, saisie de toute classe (y compris créer/supprimer une classe) | Tout | — (page Administration à la place) |
| **Référent PLAI** (`referent_plai`) | Une ou plusieurs écoles | Saisie complète : classes (créer/modifier/supprimer), élèves, AU (ajouter/retirer), AR, commentaires | Fiches de ses écoles | Oui |
| **Direction** (`direction`) | Une ou plusieurs écoles, éventuellement limitée à certains niveaux | Identique à Référent PLAI sur ses écoles | Fiches de ses écoles | Oui |
| **Agent accompagnant** (`agent_plai`) | Une ou plusieurs écoles | Élèves (créer/modifier/supprimer), AR par élève, aménagements libres, nom du référent PLAI classe, AU (**ajouter seulement**). **Ne peut pas** créer ni supprimer une classe, ni retirer un AU déjà coché | Fiches de ses écoles | Oui (depuis le 2026-09-23) |

Référent PLAI et Direction ont exactement les mêmes droits techniques ; la distinction est surtout d'usage (à qui s'adresser) et se reflète sur les fiches imprimées : le nom d'un Référent PLAI atterrit dans la colonne « Référent(s) PLAI », celui d'une Direction dans la colonne « PAR (Direction) ».

L'agent accompagnant est un éditeur à parité presque complète avec référent/direction sur ses écoles — deux exceptions volontaires (voir « Restrictions de l'agent accompagnant » ci-dessous), pour que la structure des classes et le socle des AU restent sous la responsabilité du référent/direction/admin.

## Ce que chaque rôle voit dans la navigation

- **Saisie** : tous les rôles (admin, referent_plai, direction, agent_plai)
- **Fiches** : tous les rôles
- **Mon école** : tous sauf admin (l'admin a « Administration » à la place)
- **Administration** : admin uniquement

Après connexion, tout éditeur (admin/référent/direction/agent) arrive sur `/saisie`.

## Restrictions de l'agent accompagnant

Deux gestes réservés à référent PLAI / direction / admin, appliqués **en base (RLS)**, pas seulement à l'écran — un appel API direct échouerait pareil :

1. **Pas de création (ni suppression) de classe.** Dans le sélecteur de classe, le bouton « + Nouvelle classe » n'apparaît pas pour l'agent ; s'il n'y a aucune classe dans l'école, un message l'invite à demander au référent/direction/admin d'en créer une.
2. **Aménagements universels (AU) : peut ajouter, pas retirer.** Une case AU déjà cochée est grisée (désactivée) pour l'agent, avec un bandeau d'avertissement au-dessus du bloc AU expliquant la restriction. Il peut cocher un AU non encore actif.

Techniquement, `ar_amenagements_classe` (table des AU cochés) autorise l'`INSERT` pour l'agent mais pas le `DELETE` ; `ar_classes` autorise l'`UPDATE` (ex. nom du référent PLAI classe) mais pas l'`INSERT`/`DELETE`.

## Rattachement à une ou plusieurs écoles

- **Référent PLAI / Direction / Agent accompagnant** : tous les trois peuvent être rattachés à **plusieurs écoles** (table `ar_profils_acces_ecoles`, relation many-to-many). Dans Administration, ça se gère par des « chips » (une par école) avec un sélecteur « + ajouter une école… ».
- **Direction** a un champ optionnel **Niveaux** (ex. `3e,4e,5e,6e`) qui limite son apparition aux classes de ces niveaux sur les fiches — vide, elle apparaît sur toutes les classes de l'école.

## Vue par école

- **Administration → Membres & accès** : la liste est **groupée par implantation** (une section « Administrateurs », puis une section par école active, triées comme le sélecteur d'écoles). Un référent, une direction ou un agent multi-écoles apparaît dans chacune des siennes — c'est voulu, l'admin édite « par implantation ». Une section « Sans école assignée » apparaît si un profil scope n'a ni `ecole_id` ni entrée dans `ar_profils_acces_ecoles` (état anormal à corriger).
- **Mon école** (vue non-admin) : chaque référent/direction/agent accompagnant voit l'équipe complète de sa (ses) école(s), agents accompagnants inclus. Objectif : que les référents/directions puissent repérer un changement nécessaire (agent parti, mal orthographié…) et le signaler à l'administrateur, qui édite dans Administration.

## Vue par accompagnant

Pas de fiche individuelle par accompagnant. Dans Administration → Membres & accès, chaque ligne = un compte (email, nom, rôle, école(s), niveaux si direction) — c'est à la fois la vue et le formulaire d'édition, il n'y a pas de page de détail séparée.

## Comment éditer un membre existant

Tout se passe en ligne, dans **Administration → Membres & accès**, sans bouton « Enregistrer » séparé — chaque champ s'enregistre à sa propre sortie de focus ou sélection :

1. **Nom** : champ texte, sauvegarde au `onBlur` (clic ailleurs).
2. **Rôle** : liste déroulante, changement immédiat.
3. **École(s)** : chips + « ajouter une école » / « retirer » par chip (tous les rôles rattachés à une école).
4. **Niveaux** (Direction uniquement) : champ texte libre séparé par virgules, sauvegarde au `onBlur`.
5. **Retirer** : bouton avec confirmation — révoque complètement l'accès (le compte reste dans Supabase Auth mais n'a plus de profil `ar_profils_acces`, donc plus aucun accès à l'application).

Il n'y a pas de suppression de compte au sens strict (Supabase Auth) depuis cette interface — seulement une révocation d'accès applicatif.

## Créer un nouveau membre

Formulaire en haut de la section « Membres & accès » : e-mail, nom (celui affiché sur les fiches), rôle, école de départ. Le bouton **Inviter** envoie un e-mail Supabase avec un lien pour définir le mot de passe — la personne n'existe dans `ar_profils_acces` qu'après avoir cliqué ce lien et créé son compte. Le domaine d'envoi étant récent, le mail peut finir en indésirables (Outlook surtout) : prévenir la personne par un autre canal.

## Sécurité (RLS Supabase)

Les droits ci-dessus sont appliqués côté base de données (Row Level Security), pas seulement côté interface :

- `ar_is_admin()` : vrai si le profil a `role = 'admin'`.
- `ar_can_read_ecole(ecole_id)` : admin, ou profil rattaché à cette école (legacy `ecole_id` colonne, ou table `ar_profils_acces_ecoles`) — peu importe le rôle.
- `ar_can_edit_ecole(ecole_id)` : admin, ou profil rattaché à cette école avec un rôle `referent_plai`, `direction` **ou `agent_plai`** — base de la parité élève/AR/AU-ajout.
- `ar_can_editer_structure_ecole(ecole_id)` : identique mais **sans `agent_plai`** — réservé aux deux restrictions ci-dessus (création/suppression de classe, retrait d'un AU).

Incidents corrigés :
- **2026-09-23** : une politique RLS sur `ar_profils_acces_ecoles` se référençait elle-même via un `EXISTS` auto-joint sur la même table, provoquant une récursion infinie Postgres (bloquait toute connexion, admin compris). Corrigé par une fonction `security definer` (`ar_partage_ecole`). Voir `20260923_amenagactif_fix_rls_recursion_pae.sql`.
- **2026-09-23** : un référent/direction multi-écoles ne pouvait lire les profils (dont les agents accompagnants) que de sa première école (`ar_mon_ecole()` ne couvrait pas les écoles secondaires). Corrigé via `ar_can_read_ecole(ecole_id)`. Voir `20260923b_amenagactif_lecture_agents_multi_ecoles.sql`.

**Règle à ne jamais enfreindre** : pas d'`EXISTS` auto-joint sur la même table dans une politique RLS — toujours passer par une fonction security definer (`ar_is_admin`, `ar_can_read_ecole`, `ar_can_edit_ecole`, `ar_can_editer_structure_ecole`, `ar_partage_ecole`).

## Historique des migrations liées aux accompagnants

- `20260918_amenagactif_agent_plai.sql` — création du rôle, lecture seule.
- `20260922d_amenagactif_referent_multi_ecoles.sql` — multi-écoles pour référent/direction.
- `20260923_amenagactif_fix_rls_recursion_pae.sql` — fix récursion RLS.
- `20260923b_amenagactif_lecture_agents_multi_ecoles.sql` — fix lecture croisée multi-écoles.
- `20260924_amenagactif_agent_plai_editeur.sql` — agent devient éditeur (élèves/AR/AU-ajout), multi-écoles, avec les deux restrictions décrites plus haut.

## Catalogue : codes et transmission aux autres apps (admin)

Chaque aménagement et chaque chapitre du catalogue reçoit un code automatique à la création (déclencheur SQL, migration `20260924e`) ; un code posé ne change plus. Le drapeau `partage_profil` de chaque aménagement décide s'il est inclus dans le profil de classe envoyé aux autres apps (défaut : oui). Il se règle par la case « Ne pas transmettre aux autres apps » dans Administration, ou en revue dans `/administration/transmission` (admin uniquement). Le périmètre ne dépend plus du numéro d'ordre des chapitres. Contrat : `docs/contrat-profil-classe.md`.
