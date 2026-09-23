# AménagActif — Rôles, permissions et autorisations

Document de référence pour comprendre ce que voit et peut modifier chaque rôle, et comment un administrateur gère les comptes. Généré à partir du code au 2026-09-23 (Administration.jsx, App.jsx, Nav.jsx, MonEcole.jsx, migrations Supabase `2026090x`–`20260923`).

## Les 4 rôles

| Rôle | Portée | Écriture | Lecture | Visible dans « Mon école » (équipe) |
|---|---|---|---|---|
| **Administrateur** (`admin`) | Toute l'application, toutes les écoles | Tout : membres, écoles, années, catalogue AU/AR, saisie de toute classe | Tout | — (page Administration à la place) |
| **Référent PLAI** (`referent_plai`) | Une ou plusieurs écoles | Saisie complète (classes, élèves, AU/AR, commentaires) sur ses écoles | Fiches de ses écoles | Oui |
| **Direction** (`direction`) | Une ou plusieurs écoles, éventuellement limitée à certains niveaux | Identique à Référent PLAI sur ses écoles | Fiches de ses écoles | Oui |
| **Agent accompagnant** (`agent_plai`) | Une seule école | Aucune — lecture seule | Fiches de son école, page « Mon école » | Non (filtré : seuls `referent_plai`/`direction` apparaissent dans la liste « Équipe de l'implantation ») |

Référent PLAI et Direction ont exactement les mêmes droits techniques ; la distinction est surtout d'usage (à qui s'adresser) et se reflète sur les fiches imprimées : le nom d'un Référent PLAI atterrit dans la colonne « Référent(s) PLAI », celui d'une Direction dans la colonne « PAR (Direction) ».

## Ce que chaque rôle voit dans la navigation

- **Saisie** : admin, referent_plai, direction (pas agent_plai)
- **Fiches** : tous les rôles
- **Mon école** : tous sauf admin (l'admin a « Administration » à la place)
- **Administration** : admin uniquement

Après connexion, un éditeur (admin/référent/direction) arrive sur `/saisie` ; un agent accompagnant arrive directement sur `/fiches/ecole` (lecture seule).

## Rattachement à une ou plusieurs écoles

- **Référent PLAI / Direction** : peuvent être rattachés à **plusieurs écoles** (table `ar_profils_acces_ecoles`, relation many-to-many). Dans Administration, ça se gère par des « chips » (une par école) avec un sélecteur « + ajouter une école… ».
- **Agent accompagnant** : rattaché à **une seule école** (champ `ecole_id` direct sur le profil). Pas de multi-école pour ce rôle — s'il faut en accompagner plusieurs, il faut un compte par école, ou une évolution du modèle.
- **Direction** a un champ optionnel **Niveaux** (ex. `3e,4e,5e,6e`) qui limite son apparition aux classes de ces niveaux sur les fiches — vide, elle apparaît sur toutes les classes de l'école.

## Vue par école (mise à jour 2026-09-23)

- **Administration → Membres & accès** : la liste est désormais **groupée par implantation** (une section « Administrateurs », puis une section par école active, triées comme le sélecteur d'écoles). Un référent ou une direction multi-écoles apparaît dans chacune des siennes — c'est voulu, l'admin édite « par implantation ». Une section « Sans école assignée » apparaît si un profil scope (referent_plai/direction/agent_plai) n'a ni `ecole_id` ni entrée dans `ar_profils_acces_ecoles` (état anormal à corriger).
- **Mon école** (vue non-admin) : chaque référent/direction/agent accompagnant voit désormais l'équipe complète de sa (ses) école(s), **agents accompagnants inclus** (avant : filtrés). Objectif : que les référents/directions puissent repérer un changement nécessaire (agent parti, mal orthographié…) et le signaler à l'administrateur, qui édite dans Administration.

## Vue par accompagnant

Pas de fiche individuelle par accompagnant. Dans Administration → Membres & accès, chaque ligne = un compte (email, nom, rôle, école(s), niveaux si direction) — c'est à la fois la vue et le formulaire d'édition, il n'y a pas de page de détail séparée.

## Comment éditer un membre existant

Tout se passe en ligne, dans **Administration → Membres & accès**, sans bouton « Enregistrer » séparé — chaque champ s'enregistre à sa propre sortie de focus ou sélection :

1. **Nom** : champ texte, sauvegarde au `onBlur` (clic ailleurs).
2. **Rôle** : liste déroulante, changement immédiat.
3. **École(s)** : selon le rôle —
   - Référent PLAI / Direction : chips + « ajouter une école » / « retirer » par chip.
   - Agent accompagnant : une seule liste déroulante (remplace l'école existante).
4. **Niveaux** (Direction uniquement) : champ texte libre séparé par virgules, sauvegarde au `onBlur`.
5. **Retirer** : bouton avec confirmation — révoque complètement l'accès (le compte reste dans Supabase Auth mais n'a plus de profil `ar_profils_acces`, donc plus aucun accès à l'application).

Il n'y a pas de suppression de compte au sens strict (Supabase Auth) depuis cette interface — seulement une révocation d'accès applicatif.

## Créer un nouveau membre

Formulaire en haut de la section « Membres & accès » : e-mail, nom (celui affiché sur les fiches), rôle, école de départ si le rôle en a besoin. Le bouton **Inviter** envoie un e-mail Supabase avec un lien pour définir le mot de passe — la personne n'existe dans `ar_profils_acces` qu'après avoir cliqué ce lien et créé son compte. Le domaine d'envoi étant récent, le mail peut finir en indésirables (Outlook surtout) : prévenir la personne par un autre canal.

## Sécurité (RLS Supabase)

Les droits ci-dessus sont appliqués côté base de données (Row Level Security), pas seulement côté interface :

- `ar_is_admin()` : vrai si le profil a `role = 'admin'`.
- `ar_can_read_ecole(ecole_id)` : admin, ou profil rattaché à cette école (legacy `ecole_id` colonne, ou nouvelle table `ar_profils_acces_ecoles`) — **peu importe le rôle**, donc agent_plai lit comme les autres.
- `ar_can_edit_ecole(ecole_id)` : admin, ou profil rattaché à cette école **avec un rôle `referent_plai` ou `direction`** — agent_plai en est exclu par construction, c'est ce qui le rend lecture seule sans logique supplémentaire côté écran.

Incident du 2026-09-23 (corrigé) : une politique RLS sur `ar_profils_acces_ecoles` se référençait elle-même via un `EXISTS` auto-joint sur la même table, provoquant une récursion infinie Postgres (bloquait toute connexion, admin compris). Corrigé par une fonction `security definer` (`ar_partage_ecole`), le même patron que les autres helpers `ar_*`. Voir `supabase/migrations/20260923_amenagactif_fix_rls_recursion_pae.sql` — **ne jamais réintroduire un EXISTS auto-joint sur la même table dans une politique RLS**, toujours passer par une fonction security definer.

## Limites actuelles / pistes

- Un agent accompagnant multi-écoles nécessite plusieurs comptes (un par école) — pas de relation many-to-many pour ce rôle comme pour référent/direction.
- La lecture croisée (référent multi-écoles → agents des écoles secondaires) nécessite la migration `20260923b_amenagactif_lecture_agents_multi_ecoles.sql` — à exécuter dans le SQL Editor Supabase si pas encore fait.
