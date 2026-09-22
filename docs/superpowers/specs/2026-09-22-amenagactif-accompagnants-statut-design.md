# AménagActif — statut IPT/PAR, vue admin écoles, accompagnants par élève

Date : 2026-09-22

## Contexte

Trois demandes distinctes de JF, ordonnées par priorité d'exécution :

1. **Statut IPT/PAR par élève** (priorité 1) — coche à la saisie élève entre IPT (Intégration Permanente Totale) et PAR (Protocole d'Aménagements Raisonnables). N'est **pas** un filtre d'affichage sur la fiche AménagActif : le PAR est un document officiel externe qui doit contenir les AR/AUs (la fiche AménagActif en est potentiellement l'annexe), mais un élève IPT garde lui aussi sa fiche AU/AR normale dans l'app. Le champ sert uniquement de donnée de tri, sans écran de filtrage construit pour l'instant — l'usage futur (export, filtre) n'est pas encore précisé.
2. **Vue et édition admin des écoles/implantations** — l'admin peut aujourd'hui créer et modifier une école (`SectionEcoles` dans [Administration.jsx](../../../src/pages/Administration.jsx:261)), mais la liste utilisée ([useEcoles](../../../src/hooks/useEcoleGrid.js:4)) filtre `actif = true` : une école désactivée disparaît purement et simplement de l'écran admin, sans moyen de la revoir ni de la réactiver.
3. **Accompagnants (agent_plai) saisissant les AR/AU par élève** — aujourd'hui `agent_plai` est un rôle lecture seule par école entière ([20260918_amenagactif_agent_plai.sql](../../../supabase/migrations/20260918_amenagactif_agent_plai.sql)). Décidé : modèle d'assignation par élève, multi-écoles, géré par le référent/la direction de l'école de l'élève, agent choisi parmi tous les comptes `agent_plai` du pôle.

## 1. Statut IPT/PAR (priorité)

### Données

- `ar_eleves.statut text not null check (statut in ('IPT','PAR'))`, sans valeur par défaut.
- Les données existantes sont uniquement des données de test ("École test") qui seront purgées avant mise en prod réelle → pas de problème de migration sur données réelles. La colonne est ajoutée `not null` directement ; si des lignes de test existent encore au moment de la migration, un `update ar_eleves set statut = 'PAR'` transitoire les couvre avant d'ajouter la contrainte `not null`, pour ne pas casser la migration elle-même.

### UI

- Champ obligatoire (radio ou toggle IPT/PAR) dans le formulaire de création/édition élève (`SaisieEcole.jsx`, composant `LigneEleve`/équivalent, mutation `upsertEleve`).
- Aucun filtre construit dans cette itération. Le champ est juste visible et modifiable comme les autres champs élève (prénom, initiale, commentaire).
- Pas de changement d'affichage sur les fiches (classe/élève/école/PDF) — AR et AU restent visibles pour tous les élèves, IPT compris.

### Portée d'édition

- Référent/direction/admin de l'école : oui (comme tout champ élève).
- Agent accompagnant assigné à cet élève (point 3 plus bas) : oui, explicitement demandé par JF — l'accompagnant qui suit l'élève au quotidien doit pouvoir corriger ce statut lui-même.

## 2. Vue et édition admin des écoles/implantations

### Constat

`SectionEcoles` réutilise le hook `useEcoles()` partagé par toute l'app, qui filtre `actif = true` côté requête. Une école désactivée devient invisible même côté admin — impossible de vérifier son état ou de la réactiver sans repasser par SQL direct.

### Changement

- Nouveau hook `useEcolesAdmin()` (admin uniquement, pas de filtre `actif`), utilisé exclusivement par `SectionEcoles`. Les autres usages de `useEcoles()` (sélecteurs de saisie, fiches, invitation membres) restent filtrés sur `actif = true` — inchangé.
- `SectionEcoles` affiche toutes les écoles (actives et désactivées), avec un badge/étiquette d'état visuelle claire par ligne.
- Bouton **"réactiver"** à côté de "désactiver" pour les lignes inactives (symétrique du bouton existant, même mutation `majEcole` avec `actif: true`).
- Les champs nom/implantation restent éditables en ligne (`onBlur`) pour toute école, active ou non — c'est déjà le comportement actuel de `majEcole`, juste étendu à un jeu de lignes plus large.

Pas de changement RLS : `ar_ecoles_write` est déjà `ar_is_admin()` pour toute la table, sans filtre sur `actif`.

## 3. Accompagnants (agent_plai) par élève

### Modèle de données

Nouvelle table :

```sql
create table ar_accompagnants_eleve (
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  cree_le  timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (eleve_id, user_id)
);
```

Un élève peut avoir plusieurs accompagnants ; un accompagnant peut être assigné à des élèves de plusieurs écoles (le compte `agent_plai` n'est plus rattaché à une `ecole_id` fixe — voir plus bas).

### Rôle `agent_plai` — changement de portée

- À l'invitation (`Administration.jsx` / `api/membres.js`), l'agent n'est **plus** rattaché à une école : `ecole_id = null` pour ce rôle, comme `admin` aujourd'hui. Le sélecteur d'école disparaît du formulaire d'invitation et de la ligne membre quand le rôle est `agent_plai`.
- Le périmètre réel de l'agent est entièrement déterminé par `ar_accompagnants_eleve`.

### RLS

Nouvelles fonctions :

```sql
create or replace function ar_is_accompagnant_eleve(target_eleve uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_accompagnants_eleve
    where eleve_id = target_eleve and user_id = auth.uid()
  );
$$;

create or replace function ar_is_accompagnant_classe(target_classe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_accompagnants_eleve ae
    join ar_eleves e on e.id = ae.eleve_id
    where e.classe_id = target_classe and ae.user_id = auth.uid()
  );
$$;
```

Politiques modifiées (lecture et écriture) :

- **Lecture** `ar_ecoles`, `ar_classes`, `ar_eleves` : étendre `ar_can_read_ecole` (ou ajouter une condition `or` séparée) pour inclure le cas d'un élève/classe/école atteint via `ar_is_accompagnant_eleve`/`ar_is_accompagnant_classe` — un agent doit pouvoir lire le nom de l'école et de la classe des élèves qui lui sont assignés, même hors de son ancien rattachement d'école.
- **Écriture `ar_eleves`** : `ar_eleves_write` étendu avec `or ar_is_accompagnant_eleve(id)`. Comme discuté, la RLS ne restreint pas au seul champ `statut` (pas de colonne-level RLS raisonnable ici) — c'est l'UI qui, pour un agent, n'expose en édition que le statut IPT/PAR et pas prénom/initiale/commentaire.
- **Écriture `ar_selections` / `ar_amenagements_libres`** (AR de l'élève) : étendues avec `or ar_is_accompagnant_eleve(eleve_id)`.
- **Écriture `ar_amenagements_classe`** (AU de la classe) : étendue avec `or ar_is_accompagnant_classe(classe_id)` — un agent avec au moins un élève assigné dans une classe peut cocher/décocher les AU de **toute** la classe (décision JF : accès accepté, compensé par un avertissement UI, pas une restriction technique).
- Table `ar_accompagnants_eleve` elle-même : lecture par l'agent concerné + `ar_can_edit_ecole` (référent/direction/admin de l'école de l'élève) ; écriture réservée à `ar_can_edit_ecole` de l'école de l'élève (les agents ne s'auto-assignent pas).

### Garde-fou UI — AU partagé

Encart d'avertissement visible dans l'écran de saisie AU (pour tout éditeur : référent, direction, agent) : *"Ne décochez jamais un aménagement universel sans certitude — il a probablement été coché par un·e collègue pour un autre élève de cette classe."* Mesure sociale/UX, pas une garantie technique — cohérent avec le choix ci-dessus de ne pas verrouiller l'écriture `ar_eleves` au niveau colonne.

### UI — gestion des assignations

- Dans `/mon-ecole` (référent/direction de l'école), pour chaque élève : un multi-select recherchant parmi **tous** les comptes `agent_plai` du pôle (nom/email), permettant d'assigner ou retirer un accompagnant. Nécessite une requête listant les comptes `agent_plai` (via une fonction API dédiée réutilisant le pattern service-role de `api/membres.js`, car `ar_profils_acces` n'est lisible qu'en `select` par soi-même ou par un admin — un référent n'a pas accès à la liste complète des comptes aujourd'hui).

### UI — écran agent

- Nouvel écran (route dédiée, ex. `/mes-eleves`) remplaçant `SaisieEcole.jsx` pour ce rôle : liste des élèves assignés à l'agent connecté, toutes écoles confondues, avec pour chacun l'accès à la saisie AR + statut IPT/PAR + AU de sa classe (via lien/section vers le bloc AU de la classe concernée).
- `SaisieEcole.jsx` (vue école complète) reste réservée à référent/direction/admin, inchangée.
- `App.jsx` : la redirection et les routes accessibles à `agent_plai` sont mises à jour (`/mes-eleves` remplace l'accès en lecture à `/saisie` pour ce rôle ; les fiches restent accessibles en lecture comme aujourd'hui, potentiellement élargies aux écoles hors rattachement historique via la nouvelle RLS de lecture).

## Ordre d'implémentation recommandé

1. Statut IPT/PAR (isolé, rapide, aucune dépendance).
2. Vue/édition admin écoles-implantations (isolé, rapide).
3. Accompagnants par élève (le plus gros morceau : migration RLS multi-tables, nouvel écran agent, nouvelle gestion d'assignation référent).

Les points 1 et 2 sont indépendants l'un de l'autre et du point 3 ; ils peuvent être livrés et déployés séparément avant de démarrer le point 3.

## Hors périmètre (non traité ici)

- Filtre/écran d'exploitation du statut IPT/PAR (mentionné par JF comme "pas maintenant").
- Chantier "coordination" (accès lecture seule multi-écoles pour 4 personnes, [[amenagactif-session-prompt]] pistes V3 point 5) — modèle voisin de celui décrit ici pour les agents, mais resté hors périmètre, à traiter séparément si besoin plus tard.
- Report des assignations accompagnant→élève lors du passage d'année (l'élève change d'`id` au report, comme pour `referent_plai_nom` de classe aujourd'hui — non automatisé).
