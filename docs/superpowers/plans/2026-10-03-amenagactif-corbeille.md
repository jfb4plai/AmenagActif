# AménagActif — Corbeille (suppression récupérable) en deux phases — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Permettre de récupérer une classe ou un élève supprimé par erreur (un référent maladroit), pendant 30 jours, **sans rien changer à la fluidité du parcours validé par les référents**.

**Architecture :** Suppression logique (colonne `supprime_le`) au lieu de suppression physique : les lignes en corbeille deviennent invisibles pour tous les clients par la RLS, donc aucun écran existant ne doit filtrer. La suppression, la restauration et la lecture de la corbeille passent par des fonctions SQL qui contrôlent les droits. Déploiement en **deux phases** pour ne jamais casser l'app en production : la phase A est purement additive (l'ancien front continue de fonctionner), la phase B (retrait de l'ancienne contrainte d'unicité) n'est appliquée qu'une fois le nouveau front déployé. Côté app : même confirmation qu'aujourd'hui (texte corrigé), bandeau « Annuler » pendant 15 secondes, page « Corbeille », pastille et encadré « supprimé par quelqu'un d'autre ».

**Tech Stack :** React 18 + Vite 5 + Tailwind 3, Supabase v2 (RPC + RLS + pg_cron déjà activée), TanStack Query, Vitest + Testing Library. Fonctions serverless `/api/*` (filtres seulement).

---

## Décisions prises (validées par JF le 2026-10-03)

1. **Rétention 30 jours**, puis purge quotidienne automatique (`pg_cron`, activée sur le projet).
2. **Bandeau « Annuler »** après chaque suppression (15 secondes) **et** page « Corbeille ».
3. **Restauration sous un autre nom** quand le nom d'une classe est déjà pris.
4. **Prévenir le référent = options A + B, sans e-mail** : pastille « Corbeille (n) » dans la Saisie (A) et encadré « Supprimé par quelqu'un d'autre » à l'ouverture de la Saisie, avec « Restaurer » / « C'est voulu » (B). L'état « C'est voulu » est mémorisé sur le navigateur (`localStorage`, par utilisateur), sans table.
5. **Libres hors périmètre** (un seul en base) ; cases AR/AU : on recoche.
6. **« ÉTAPE 2 » de la version initiale abandonnée** (fermer la suppression directe) : elle ne sert pas l'objectif (l'accident passe par l'interface) et provoquerait des suppressions silencieuses dans les onglets restés ouverts.

Choix techniques issus de l'audit du 2026-10-03 :
- **L'ancien front doit rester compatible pendant la phase A** : son `upsert … onConflict 'ecole_id,annee_id,nom'` casserait (erreur `42P10`) dès que la contrainte d'unicité devient un index partiel. La phase A **conserve l'ancienne contrainte** à côté du nouvel index partiel ; la phase B la supprime.
- `ar_assurer_classe` (création ou récupération d'une classe) n'utilise **pas** `ON CONFLICT` : lecture, puis insertion, avec reprise sur `unique_violation`. Elle fonctionne donc dans les deux états de la base.
- **L'auteur d'une suppression peut l'annuler** (y compris un agent accompagnant, qui ne voit pas la corbeille) : sans cela, le bandeau « Annuler » serait refusé à l'agent.
- **Le code serveur en service role contourne la RLS** : 4 endroits à filtrer (liens enseignants, génération de lien, export de profil), avec un message clair (« Cette fiche n'est plus disponible ») au lieu d'une erreur 500.

## Garde-fous de fluidité (critères d'acceptation, vérifiés à la Task 11)

| Parcours validé | Avant | Après (doit être identique) |
|---|---|---|
| Créer une classe | « + Nouvelle classe », nom, niveau, valider | identique |
| Supprimer un élève | clic nom, « Supprimer l'élève », **une** confirmation | identique (texte de la confirmation corrigé) + bandeau « Annuler » non bloquant |
| Supprimer une classe | « Supprimer la classe », **une** confirmation | identique (texte corrigé) + bandeau « Annuler » |
| Saisie, grille, fiches, liens, reprise | — | aucun changement visible ; temps de réponse inchangé |

Aucun clic, aucune confirmation, aucun écran en plus dans le parcours habituel. La corbeille n'apparaît (pastille) que lorsqu'elle contient quelque chose, et seulement pour les référents, directions et administrateurs.

## Retour arrière

- **Phase A** : additive. Revenir en arrière = revenir sur le front (`git revert`) ; la base peut rester telle quelle.
- **Phase B** : `alter table ar_classes add constraint ar_classes_ecole_id_annee_id_nom_key unique (ecole_id, annee_id, nom);` (échoue s'il existe des classes homonymes en corbeille : appeler d'abord `select ar_purger_corbeille();` côté service role ou vider les éléments concernés).

## Prérequis d'exécution

- Partir de `main` à jour (reprise, changement de classe, modes d'emploi déjà poussés).
- Les fichiers `supabase/migrations/20261004_amenagactif_corbeille.sql` et `supabase/tests/corbeille.sql` présents, **non suivis**, dans le dossier principal sont une version de départ non validée : ce plan les **remplace**. Avant la fusion (Task 11), les mettre de côté pour éviter un conflit de fichiers non suivis.
- **Ordre de déploiement obligatoire** : migration A appliquée → front et API déployés → migration B appliquée. Ne jamais appliquer B avant le déploiement du front.
- Build check local avant tout push : `npx vite build`. Aucun push sans accord de JF.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261004_amenagactif_corbeille_a.sql` (créer) | Phase A : colonnes, index, RLS, fonctions, droits, purge planifiée |
| `supabase/migrations/20261005_amenagactif_corbeille_b.sql` (créer) | Phase B : retrait de l'ancienne contrainte d'unicité des classes |
| `supabase/tests/corbeille_a.sql` (créer) | Test manuel annulé d'office de la phase A (compatibilité de l'ancien front incluse) |
| `supabase/tests/corbeille.sql` (créer, adapté de la version de départ) | Test manuel annulé d'office des phases A + B |
| `src/domain/corbeille.js` (créer) | Logique pure : textes de confirmation, messages d'erreur, filtre « supprimé par quelqu'un d'autre », mémoire « C'est voulu » |
| `tests/domain/corbeille.test.js` (créer) | Tests de la logique pure |
| `src/domain/chargeurFiche.js`, `api/_lib/ficheData.js`, `api/_lib/liensData.js`, `api/fiche-token.js` (modifier) | Filtres `supprime_le` côté serveur et message « fiche indisponible » |
| `tests/domain/chargeurFiche.test.js`, `tests/domain/liensApi.test.js` (modifier) | Tests des filtres |
| `src/hooks/useCorbeille.js` (créer) | Lecture de la corbeille et restaurations |
| `src/hooks/useGridMutations.js` (modifier) | `deleteEleve`, `deleteClasse`, `ensureClasse` sur les fonctions |
| `src/components/saisie/SuppressionRecente.jsx` (créer) | Bandeau « Annuler » |
| `src/components/saisie/ZoneCorbeille.jsx` (créer) | Pastille « Corbeille (n) » + encadré « supprimé par quelqu'un d'autre » |
| `src/components/saisie/EleveEditor.jsx`, `src/pages/SaisieEcole.jsx` (modifier) | Textes de confirmation, câblage |
| `src/pages/Corbeille.jsx`, `src/App.jsx` (créer / modifier) | Page `/corbeille` |
| `tests/domain/suppressionRecente.test.jsx`, `zoneCorbeille.test.jsx`, `corbeillePage.test.jsx` (créer) ; `tests/domain/saisieEcoleDispositifs.test.jsx` (modifier) | Tests de composants |
| `docs/modes-emploi/*.html`, `public/modes-emploi/*.html` (modifier) | Mode d'emploi (référents, directions, accompagnants) |

---

### Task 0 : Worktree

- [ ] **Step 1 : Créer le worktree depuis main**

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif
git fetch origin
git worktree add .claude/worktrees/amenagactif-corbeille -b feature/corbeille main
cd .claude/worktrees/amenagactif-corbeille
cp ../../../.env.local .
npm install
npm test
```
Expected : tests PASS (baseline : 323).

- [ ] **Step 2 : Récupérer la version de départ du test (non suivie)**

```bash
mkdir -p supabase/tests
cp /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif/supabase/tests/corbeille.sql supabase/tests/corbeille.sql
```
Ce fichier sera adapté à la Task 2. Ne pas le commiter avant.

Toutes les commandes suivantes s'exécutent dans ce worktree.

---

### Task 1 : Migration phase A (additive) et son test

**Files:**
- Create: `supabase/migrations/20261004_amenagactif_corbeille_a.sql`
- Create: `supabase/tests/corbeille_a.sql`

- [ ] **Step 1 : Écrire la migration A**

```sql
-- AménagActif — corbeille (suppression logique) des classes et des élèves — PHASE A (additive).
-- À exécuter AVANT le déploiement du front. Idempotent. L'ancien front continue de fonctionner :
--  * l'ancienne contrainte d'unicité des classes est CONSERVÉE (elle sera retirée par la phase B) ;
--  * la suppression directe (delete) reste permise ;
--  * aucune ligne n'a encore supprime_le : les politiques modifiées sont sans effet visible.
--
-- Politique :
--  * Périmètre : classes et élèves. Rétention : 30 jours (ar_corbeille_retention), purge quotidienne (pg_cron).
--  * Mise en corbeille : admin, référent PLAI, direction (classes et élèves) ; agent accompagnant (élèves seulement).
--  * Voir / restaurer : admin, référent PLAI, direction de l'école. L'AUTEUR d'une suppression d'élève peut l'annuler
--    (y compris un agent accompagnant). Purge manuelle : admin seul.
--
-- Choix techniques :
--  * Une ligne en corbeille est INVISIBLE pour tous les clients authentifiés (RLS) : les écrans existants n'ont rien à filtrer.
--  * La corbeille se lit et se vide UNIQUEMENT par des fonctions SECURITY DEFINER qui contrôlent le droit à la main.
--  * Le code serveur en service role (api/) contourne la RLS : il filtre lui-même (supprime_le is null).
--  * Aucun EXISTS auto-joint dans une politique (incident RLS du 2026-09-23).
--  * Aucune nouvelle table : pas de GRANT de table. EXECUTE accordé fonction par fonction.

begin;

-- ── 1. Colonnes et index ──
alter table ar_classes
  add column if not exists supprime_le      timestamptz,
  add column if not exists supprime_par     uuid references auth.users(id) on delete set null,
  add column if not exists lot_suppression  uuid;

alter table ar_eleves
  add column if not exists supprime_le      timestamptz,
  add column if not exists supprime_par     uuid references auth.users(id) on delete set null,
  add column if not exists lot_suppression  uuid;

-- lot_suppression : identifiant commun à une classe et aux élèves mis en corbeille avec elle.
-- Restaurer la classe ne ressuscite que ces élèves, jamais un élève supprimé volontairement avant.

create index if not exists ar_classes_corbeille_idx on ar_classes (supprime_le) where supprime_le is not null;
create index if not exists ar_eleves_corbeille_idx  on ar_eleves  (supprime_le) where supprime_le is not null;

-- ── 2. Unicité : seules les lignes ACTIVES comptent ──
-- Index partiel ajouté À CÔTÉ de l'ancienne contrainte (retirée en phase B).
create unique index if not exists ar_classes_nom_actif_uniq
  on ar_classes (ecole_id, annee_id, nom) where supprime_le is null;

-- Un élève N a au plus un successeur ACTIF (un successeur en corbeille ne bloque plus une nouvelle reprise).
drop index if exists ar_eleves_precedent_uniq;
create unique index ar_eleves_precedent_uniq
  on ar_eleves (eleve_precedent_id) where eleve_precedent_id is not null and supprime_le is null;

-- ── 3. RLS : les lignes en corbeille disparaissent pour tous les clients ──
drop policy if exists ar_classes_read on ar_classes;
create policy ar_classes_read on ar_classes for select to authenticated
  using (ar_can_read_ecole(ecole_id) and supprime_le is null);

-- Le client ne peut pas poser supprime_le lui-même (with check) : passage obligé par les fonctions.
drop policy if exists ar_classes_update on ar_classes;
create policy ar_classes_update on ar_classes for update to authenticated
  using (ar_can_edit_ecole(ecole_id) and supprime_le is null)
  with check (ar_can_edit_ecole(ecole_id) and supprime_le is null);

drop policy if exists ar_eleves_read on ar_eleves;
create policy ar_eleves_read on ar_eleves for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) and supprime_le is null);

-- ar_eleves_write était « for all » : il donnait aussi la lecture aux éditeurs et aurait exposé les lignes en
-- corbeille. On le scinde en trois politiques de même droit (ar_can_edit_ecole, agent inclus).
drop policy if exists ar_eleves_write  on ar_eleves;
drop policy if exists ar_eleves_insert on ar_eleves;
drop policy if exists ar_eleves_update on ar_eleves;
drop policy if exists ar_eleves_delete on ar_eleves;
create policy ar_eleves_insert on ar_eleves for insert to authenticated
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) and supprime_le is null);
create policy ar_eleves_update on ar_eleves for update to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) and supprime_le is null)
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) and supprime_le is null);
-- Suppression directe conservée (ancien front, et suppression définitive) : pas de « phase 2 » qui la ferme.
create policy ar_eleves_delete on ar_eleves for delete to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

-- ── 4. Durée de rétention : une seule source de vérité côté base (le front l'affiche : JOURS_CORBEILLE) ──
create or replace function ar_corbeille_retention() returns integer
language sql immutable as $$ select 30 $$;

-- ── 5. Mise en corbeille ──
create or replace function ar_mettre_eleve_en_corbeille(p_eleve uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid;
begin
  select c.ecole_id into v_ecole
  from ar_eleves e join ar_classes c on c.id = e.classe_id
  where e.id = p_eleve and e.supprime_le is null and c.supprime_le is null;
  if not found then
    raise exception 'eleve_introuvable' using errcode = 'P0002';
  end if;
  if not ar_can_edit_ecole(v_ecole) then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;

  update ar_eleves
     set supprime_le = now(), supprime_par = auth.uid(), lot_suppression = gen_random_uuid()
   where id = p_eleve;
end $$;

-- Renvoie le nombre d'élèves mis en corbeille avec la classe (pour le message du bandeau « Annuler »).
create or replace function ar_mettre_classe_en_corbeille(p_classe uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid;
  v_lot   uuid := gen_random_uuid();
  v_n     integer;
begin
  select ecole_id into v_ecole from ar_classes where id = p_classe and supprime_le is null;
  if not found then
    raise exception 'classe_introuvable' using errcode = 'P0002';
  end if;
  -- Création/suppression de classe : droit « structure » (pas l'agent accompagnant), comme avant.
  if not ar_can_editer_structure_ecole(v_ecole) then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;

  update ar_classes
     set supprime_le = now(), supprime_par = auth.uid(), lot_suppression = v_lot
   where id = p_classe;
  update ar_eleves
     set supprime_le = now(), supprime_par = auth.uid(), lot_suppression = v_lot
   where classe_id = p_classe and supprime_le is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 6. Restauration ──
-- Élève : droit « structure » (admin, référent PLAI, direction) OU auteur de la suppression (annulation immédiate,
-- y compris pour un agent accompagnant, qui ne voit pas la corbeille).
create or replace function ar_restaurer_eleve(p_eleve uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ecole          uuid;
  v_classe_en_corb timestamptz;
  v_par            uuid;
begin
  select c.ecole_id, c.supprime_le, e.supprime_par into v_ecole, v_classe_en_corb, v_par
  from ar_eleves e join ar_classes c on c.id = e.classe_id
  where e.id = p_eleve and e.supprime_le is not null;
  if not found then
    raise exception 'element_introuvable' using errcode = 'P0002';
  end if;
  if not (ar_can_editer_structure_ecole(v_ecole)
          or (v_par is not null and v_par = auth.uid() and ar_can_edit_ecole(v_ecole))) then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;
  if v_classe_en_corb is not null then
    raise exception 'classe_en_corbeille' using errcode = 'P0001';  -- restaurer la classe d'abord
  end if;

  begin
    update ar_eleves
       set supprime_le = null, supprime_par = null, lot_suppression = null
     where id = p_eleve;
  exception when unique_violation then
    raise exception 'successeur_existant' using errcode = 'P0001';  -- cet élève a été repris dans l'année suivante entre-temps
  end;
end $$;

-- Classe : droit « structure ». Nom facultatif : restaure la classe sous un autre nom (conflit d'homonyme).
-- Renvoie le nombre d'élèves restaurés avec la classe.
create or replace function ar_restaurer_classe(p_classe uuid, p_nouveau_nom text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid;
  v_lot   uuid;
  v_n     integer;
  v_nom   text := nullif(btrim(coalesce(p_nouveau_nom, '')), '');
begin
  if p_nouveau_nom is not null and (v_nom is null or char_length(v_nom) > 60) then
    raise exception 'nom_invalide' using errcode = 'P0001';
  end if;

  select ecole_id, lot_suppression into v_ecole, v_lot
  from ar_classes where id = p_classe and supprime_le is not null;
  if not found then
    raise exception 'element_introuvable' using errcode = 'P0002';
  end if;
  if not ar_can_editer_structure_ecole(v_ecole) then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;

  begin
    update ar_classes
       set supprime_le = null, supprime_par = null, lot_suppression = null, nom = coalesce(v_nom, nom)
     where id = p_classe;
  exception when unique_violation then
    raise exception 'nom_deja_utilise' using errcode = 'P0001';  -- une classe active porte déjà ce nom (école + année)
  end;

  begin
    update ar_eleves
       set supprime_le = null, supprime_par = null, lot_suppression = null
     where classe_id = p_classe and lot_suppression = v_lot and supprime_le is not null;
    get diagnostics v_n = row_count;
  exception when unique_violation then
    raise exception 'successeur_existant' using errcode = 'P0001';
  end;
  return v_n;
end $$;

-- ── 7. Lecture de la corbeille (admin, référent PLAI, direction) ──
-- Une classe supprimée est listée avec le nombre d'élèves partis avec elle ; ces élèves ne sont pas listés à part.
-- Un élève est listé seul s'il a été supprimé individuellement (classe active, ou lot différent de celui de sa classe).
create or replace function ar_corbeille(p_ecole uuid default null)
returns table (
  genre text, element_id uuid, ecole_id uuid, ecole_nom text, libelle text, classe_nom text,
  nb_eleves integer, supprime_le timestamptz, supprime_par uuid, supprime_par_nom text, jours_restants integer
)
language sql stable security definer set search_path = public as $$
  select 'classe'::text, c.id, c.ecole_id, coalesce(ec.implantation_nom, ec.nom), c.nom, null::text,
         (select count(*)::integer from ar_eleves e where e.classe_id = c.id and e.lot_suppression = c.lot_suppression),
         c.supprime_le, c.supprime_par, pa.nom,
         greatest(0, ceil(extract(epoch from (c.supprime_le + make_interval(days => ar_corbeille_retention()) - now())) / 86400))::integer
  from ar_classes c
  join ar_ecoles ec on ec.id = c.ecole_id
  left join ar_profils_acces pa on pa.user_id = c.supprime_par
  where c.supprime_le is not null
    and (p_ecole is null or c.ecole_id = p_ecole)
    and ar_can_editer_structure_ecole(c.ecole_id)
  union all
  select 'eleve'::text, e.id, c.ecole_id, coalesce(ec.implantation_nom, ec.nom), btrim(e.prenom || ' ' || e.initiale_nom), c.nom,
         null::integer, e.supprime_le, e.supprime_par, pa.nom,
         greatest(0, ceil(extract(epoch from (e.supprime_le + make_interval(days => ar_corbeille_retention()) - now())) / 86400))::integer
  from ar_eleves e
  join ar_classes c on c.id = e.classe_id
  join ar_ecoles ec on ec.id = c.ecole_id
  left join ar_profils_acces pa on pa.user_id = e.supprime_par
  where e.supprime_le is not null
    and (c.supprime_le is null or e.lot_suppression is distinct from c.lot_suppression)
    and (p_ecole is null or c.ecole_id = p_ecole)
    and ar_can_editer_structure_ecole(c.ecole_id)
  order by 8 desc;
$$;

-- ── 8. Purge ──
-- Automatique (quotidienne, service role / pg_cron) : tout ce qui dépasse la rétention.
create or replace function ar_purger_corbeille()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_limite timestamptz := now() - make_interval(days => ar_corbeille_retention());
  v_c integer;
  v_e integer;
begin
  delete from ar_classes where supprime_le < v_limite;   -- cascade : élèves, AR, libres, AU, dispositifs, liens_classes
  get diagnostics v_c = row_count;
  delete from ar_eleves where supprime_le < v_limite;    -- élèves supprimés seuls
  get diagnostics v_e = row_count;
  return v_c + v_e;
end $$;

-- Manuelle : admin seul, un élément déjà en corbeille.
create or replace function ar_vider_corbeille(p_genre text, p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not ar_is_admin() then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;
  if p_genre = 'classe' then
    delete from ar_classes where id = p_id and supprime_le is not null;
  elsif p_genre = 'eleve' then
    delete from ar_eleves where id = p_id and supprime_le is not null;
  else
    raise exception 'genre_invalide' using errcode = 'P0001';
  end if;
  if not found then
    raise exception 'element_introuvable' using errcode = 'P0002';
  end if;
end $$;

-- ── 9. Fonctions existantes à adapter ──
-- 9a. Créer-ou-retrouver une classe. SECURITY INVOKER : mêmes droits qu'avant (création = droit « structure »).
-- Sans ON CONFLICT : fonctionne avec l'ancienne contrainte (phase A) comme avec l'index partiel seul (phase B).
-- Met à jour le niveau comme l'ancien upsert.
create or replace function ar_assurer_classe(p_ecole uuid, p_annee uuid, p_nom text, p_niveau text default null)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from ar_classes
  where ecole_id = p_ecole and annee_id = p_annee and nom = p_nom and supprime_le is null;
  if found then
    update ar_classes set niveau = p_niveau where id = v_id;
    return v_id;
  end if;

  begin
    insert into ar_classes (ecole_id, annee_id, nom, niveau)
    values (p_ecole, p_annee, p_nom, p_niveau)
    returning id into v_id;
  exception when unique_violation then
    -- Course (même nom créé au même instant) : on retrouve la classe active. Sinon, le nom est pris par une classe
    -- de la corbeille (tant que l'ancienne contrainte existe) : erreur claire.
    select id into v_id from ar_classes
    where ecole_id = p_ecole and annee_id = p_annee and nom = p_nom and supprime_le is null;
    if not found then
      raise exception 'nom_pris_corbeille' using errcode = 'P0001';
    end if;
  end;
  return v_id;
end $$;

-- 9b. Reprise annuelle : classes sources actives seulement. ON CONFLICT DO NOTHING sans cible : valable avec ou sans
-- l'ancienne contrainte. (Reprend la version de 20261003b ; seuls les filtres supprime_le changent.)
create or replace function ar_cloner_classes(p_ecole uuid, p_source uuid, p_cible uuid)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_nouvelles uuid[];
begin
  with ins as (
    insert into ar_classes (ecole_id, annee_id, nom, niveau, referent_plai_nom)
    select ecole_id, p_cible, nom, niveau, referent_plai_nom
    from ar_classes
    where ecole_id = p_ecole and annee_id = p_source and supprime_le is null
    on conflict do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_nouvelles from ins;

  insert into ar_amenagements_classe (classe_id, amenagement_id, cree_par, a_confirmer)
  select cc.id, ac.amenagement_id, auth.uid(), true
  from ar_classes cc
  join ar_classes cs on cs.ecole_id = cc.ecole_id and cs.annee_id = p_source and cs.nom = cc.nom and cs.supprime_le is null
  join ar_amenagements_classe ac on ac.classe_id = cs.id
  where cc.id = any(v_nouvelles);

  insert into ar_classe_dispositifs (classe_id, chapitre_id, pour_toute_la_classe)
  select cc.id, m.chapitre_id, m.pour_toute_la_classe
  from ar_classes cc
  join ar_classes cs on cs.ecole_id = cc.ecole_id and cs.annee_id = p_source and cs.nom = cc.nom and cs.supprime_le is null
  join ar_classe_dispositifs m on m.classe_id = cs.id
  where cc.id = any(v_nouvelles)
  on conflict (classe_id, chapitre_id) do nothing;

  return coalesce(array_length(v_nouvelles, 1), 0);
end $$;

-- 9c. « Cet élève a-t-il déjà un successeur ? » : un successeur en corbeille ne compte pas.
create or replace function ar_eleves_deja_repris(p_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select eleve_precedent_id from ar_eleves
  where eleve_precedent_id = any(p_ids) and supprime_le is null;
$$;

-- ── 10. Droits d'exécution ──
revoke all on function ar_corbeille_retention()                     from public, anon;
revoke all on function ar_mettre_eleve_en_corbeille(uuid)           from public, anon;
revoke all on function ar_mettre_classe_en_corbeille(uuid)          from public, anon;
revoke all on function ar_restaurer_eleve(uuid)                     from public, anon;
revoke all on function ar_restaurer_classe(uuid, text)              from public, anon;
revoke all on function ar_corbeille(uuid)                           from public, anon;
revoke all on function ar_vider_corbeille(text, uuid)               from public, anon;
revoke all on function ar_assurer_classe(uuid, uuid, text, text)   from public, anon;
revoke all on function ar_purger_corbeille()                        from public, anon, authenticated;

grant execute on function ar_corbeille_retention()                     to authenticated;
grant execute on function ar_mettre_eleve_en_corbeille(uuid)           to authenticated;
grant execute on function ar_mettre_classe_en_corbeille(uuid)          to authenticated;
grant execute on function ar_restaurer_eleve(uuid)                     to authenticated;
grant execute on function ar_restaurer_classe(uuid, text)              to authenticated;
grant execute on function ar_corbeille(uuid)                           to authenticated;
grant execute on function ar_vider_corbeille(text, uuid)               to authenticated;
grant execute on function ar_assurer_classe(uuid, uuid, text, text)   to authenticated;
grant execute on function ar_purger_corbeille()                        to service_role;
-- ar_cloner_classes / ar_eleves_deja_repris : create or replace conserve les droits existants.

-- ── 11. Planification de la purge (pg_cron est activée sur le projet) ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ar_purge_corbeille', '15 3 * * *', 'select public.ar_purger_corbeille()');
  else
    raise notice 'pg_cron non activée : la corbeille ne sera PAS purgée automatiquement.';
  end if;
exception when others then
  raise notice 'Planification pg_cron impossible : %', sqlerrm;
end $$;

commit;

-- Vérifications à jouer après exécution :
-- 1) Colonnes (6 lignes) : select table_name, column_name from information_schema.columns
--      where table_name in ('ar_classes','ar_eleves') and column_name in ('supprime_le','supprime_par','lot_suppression');
-- 2) Index (3 lignes) : select indexname from pg_indexes
--      where indexname in ('ar_classes_nom_actif_uniq','ar_eleves_precedent_uniq','ar_classes_corbeille_idx');
-- 3) L'ancienne contrainte existe ENCORE (1 ligne) : select conname from pg_constraint
--      where conrelid = 'public.ar_classes'::regclass and contype = 'u';
-- 4) Planification (1 ligne) : select jobname, schedule from cron.job where jobname = 'ar_purge_corbeille';
```

- [ ] **Step 2 : Écrire le test de la phase A**

Créer `supabase/tests/corbeille_a.sql` en assemblant, dans cet ordre :

1. Cet en-tête :
```sql
-- Test manuel (NON exécuté automatiquement) de la phase A de la corbeille (migration 20261004_amenagactif_corbeille_a.sql).
-- Tout est annulé : le script se termine par une EXCEPTION volontaire dont le message est le bilan.
-- Attendu : « BILAN : N/N contrôles OK ». Voir « Commande de test » dans le plan.
```
2. **Les lignes 9 à 60 de `supabase/tests/corbeille.sql`** (copiées telles quelles : création de `zz_res`, `zz_n`, des fonctions `zz_check` et `zz_erreur`, des comptes de test, des écoles, de l'année, de la classe `3A` (`…c1`), des élèves `…f1` et `…f2`, de la sélection et de l'AU). On ne copie pas la ligne 7 (`begin;`).
3. Ce bloc d'aide et de contrôles :

```sql
-- Exécute p_sql sous le rôle courant et enregistre le succès ou l'échec (au lieu d'interrompre le script).
create function zz_ok(p_step text, p_sql text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into zz_res (step, ok, info) values (p_step, true, '');
exception when others then
  insert into zz_res (step, ok, info) values (p_step, false, sqlstate || ' ' || sqlerrm);
end $$;

-- ══ DIRECTION : l'ancien front doit continuer à fonctionner (ancienne contrainte conservée) ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

select zz_ok('A : ancien upsert supabase-js (crée)',
  $q$ insert into ar_classes (ecole_id, annee_id, nom, niveau)
      values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3B', '3e')
      on conflict (ecole_id, annee_id, nom) do update set niveau = excluded.niveau $q$);
select zz_ok('A : ancien upsert supabase-js (met à jour)',
  $q$ insert into ar_classes (ecole_id, annee_id, nom, niveau)
      values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3B', '4e')
      on conflict (ecole_id, annee_id, nom) do update set niveau = excluded.niveau $q$);
select zz_check('A : un seul « 3B », niveau 4e',
  (select count(*) from ar_classes where nom = '3B' and niveau = '4e') = 1);
select zz_ok('A : suppression directe d''une classe (ancien front)',
  $q$ delete from ar_classes where nom = '3B' and ecole_id = '11111111-1111-1111-1111-111111111111' $q$);
select zz_check('A : « 3B » supprimée pour de bon',
  (select count(*) from ar_classes where nom = '3B') = 0);
select zz_ok('A : suppression directe d''un élève (ancien front)',
  $q$ delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2' $q$);
select zz_check('A : élève supprimé directement',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2') = 0);

-- ══ ar_assurer_classe (nouveau front) ══
select zz_check('A : ar_assurer_classe crée une classe',
  ar_assurer_classe('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3C', '3e') is not null);
select zz_check('A : ar_assurer_classe idempotent et met à jour le niveau',
  ar_assurer_classe('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3C', '4e')
  = ar_assurer_classe('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3C', '4e')
  and (select niveau from ar_classes where nom = '3C') = '4e');

-- ══ Élève : corbeille, auteur, restauration ══
select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f1');
select zz_check('A : élève en corbeille invisible',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = 0);
select zz_check('A : ses AR deviennent invisibles',
  (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 0);
select zz_check('A : la corbeille indique l''auteur de la suppression',
  (select supprime_par from ar_corbeille() where element_id = '00000000-0000-0000-0000-0000000000f1')
  = '00000000-0000-0000-0000-0000000000d1'::uuid);
select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f1');
select zz_check('A : élève et AR restaurés',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1);

-- ══ Classe : corbeille, homonyme pendant la phase A, restauration sous un autre nom ══
select zz_check('A : classe mise en corbeille avec son élève',
  ar_mettre_classe_en_corbeille('00000000-0000-0000-0000-0000000000c1') = 1);
select zz_check('A : classe en corbeille invisible, AU aussi',
  (select count(*) from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = 0
  and (select count(*) from ar_amenagements_classe where classe_id = '00000000-0000-0000-0000-0000000000c1') = 0);
select zz_erreur('A : recréer « 3A » tant que l''ancienne contrainte existe : message clair',
  $q$ select ar_assurer_classe('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A', '3e') $q$,
  'nom_pris_corbeille');
select zz_erreur('A : nom de restauration vide refusé',
  $q$ select ar_restaurer_classe('00000000-0000-0000-0000-0000000000c1', '   ') $q$, 'nom_invalide');
select zz_check('A : restaurer sous un autre nom renvoie 1 élève',
  ar_restaurer_classe('00000000-0000-0000-0000-0000000000c1', '3A (ancienne)') = 1);
select zz_check('A : nom mis à jour, AU revenus',
  (select nom from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = '3A (ancienne)'
  and (select count(*) from ar_amenagements_classe where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1);

-- ══ AGENT : peut annuler SA suppression, pas celle d'un autre ══
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f1');
select zz_check('A : agent met un élève en corbeille',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = 0);
select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f1');
select zz_check('A : agent annule sa propre suppression',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = 1);
select zz_erreur('A : agent ne peut pas mettre une classe en corbeille',
  $q$ select ar_mettre_classe_en_corbeille('00000000-0000-0000-0000-0000000000c1') $q$, 'droit_insuffisant');
select zz_check('A : agent ne voit pas la corbeille', (select count(*) from ar_corbeille()) = 0);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select zz_erreur('A : agent ne peut pas annuler la suppression d''un autre',
  $q$ select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f1') $q$, 'droit_insuffisant');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f1');

-- ══ DIRECTION D'UNE AUTRE ÉCOLE ══
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
select zz_check('A : autre école : corbeille inaccessible',
  (select count(*) from ar_corbeille('11111111-1111-1111-1111-111111111111')) = 0);
select zz_erreur('A : autre école : ne peut pas mettre en corbeille',
  $q$ select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f1') $q$, 'droit_insuffisant');

-- ══ BILAN (annule tout) ══
reset role;
do $$
declare
  v_total integer; v_ko integer; v_detail text;
begin
  select count(*), count(*) filter (where not ok),
         string_agg(n || ') ' || step || ' -> ' || info, E'\n' order by n) filter (where not ok)
    into v_total, v_ko, v_detail
  from zz_res;
  raise exception E'BILAN : %/% contrôles OK%', v_total - v_ko, v_total,
    case when v_ko > 0 then E'\nKO :\n' || v_detail else '' end;
end $$;
```

- [ ] **Step 3 : Lancer le test de la phase A (transaction annulée, rien n'est appliqué)**

Les scripts de test ne contiennent pas la migration : on les concatène avec elle (sans ses `begin;` / `commit;`) pour tout exécuter dans une seule transaction implicite, que l'exception finale annule.

```bash
T="$(mktemp -d)"
{ grep -v -E '^(begin|commit);$' supabase/migrations/20261004_amenagactif_corbeille_a.sql
  grep -v -E '^begin;$' supabase/tests/corbeille_a.sql; } > "$T/a.sql"
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f "$T/a.sql" 2>&1 | grep -v "^Initialising"
```
Expected : message d'erreur `P0001: BILAN : 33/33 contrôles OK` (le nombre exact peut différer de un ou deux ; **aucune ligne « KO »**). Toute ligne KO est détaillée dans le message.

- [ ] **Step 4 : Vérifier que la base n'a pas bougé**

```bash
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json "select (select count(*) from information_schema.columns where table_name in ('ar_classes','ar_eleves') and column_name='supprime_le')::int colonnes, (select count(*) from pg_proc where proname like 'ar_corbeille%' or proname like 'ar_assurer%' or proname like 'zz_%')::int fonctions, (select count(*) from pg_tables where tablename like 'zz_%')::int tables_zz" 2>&1 | grep -A5 '"rows"'
```
Expected : `colonnes: 0`, `fonctions: 0`, `tables_zz: 0`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20261004_amenagactif_corbeille_a.sql supabase/tests/corbeille_a.sql
git commit -m "feat(corbeille): migration phase A (additive) et test de compatibilité de l'ancien front"
```

---

### Task 2 : Migration phase B et test A+B

**Files:**
- Create: `supabase/migrations/20261005_amenagactif_corbeille_b.sql`
- Create: `supabase/tests/corbeille.sql` (adapté du fichier copié à la Task 0)

- [ ] **Step 1 : Écrire la migration B**

```sql
-- AménagActif — corbeille — PHASE B : retrait de l'ancienne contrainte d'unicité des classes.
-- À exécuter UNIQUEMENT APRÈS le déploiement du front qui utilise ar_assurer_classe (phase A déjà appliquée). Idempotent.
--
-- Pourquoi après le front : l'ancien front crée les classes avec un upsert « ON CONFLICT (ecole_id, annee_id, nom) »
-- qui n'est plus accepté une fois la contrainte retirée (erreur 42P10). Les onglets restés ouverts avec l'ancien code
-- doivent être rechargés (la création de classe est le seul geste concerné).
-- Effet : une classe de la corbeille ne bloque plus la recréation d'une classe de même nom.

begin;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.ar_classes'::regclass and contype = 'u'
      and (select array_agg(a.attname order by a.attname) from pg_attribute a
           where a.attrelid = conrelid and a.attnum = any(conkey)) = array['annee_id', 'ecole_id', 'nom']::name[]
  loop
    execute format('alter table public.ar_classes drop constraint %I', c.conname);
  end loop;
end $$;

commit;

-- Vérification (0 ligne) : select conname from pg_constraint where conrelid = 'public.ar_classes'::regclass and contype = 'u';
-- L'unicité des classes actives reste garantie par l'index ar_classes_nom_actif_uniq (phase A).
```

- [ ] **Step 2 : Adapter le test complet (`supabase/tests/corbeille.sql`)**

Dans le fichier copié à la Task 0, appliquer **exactement** ces modifications.

(a) Remplacer l'en-tête (lignes 1 à 5) par :
```sql
-- Test manuel (NON exécuté automatiquement) de la corbeille : phases A et B appliquées
-- (migrations 20261004_amenagactif_corbeille_a.sql puis 20261005_amenagactif_corbeille_b.sql).
-- Tout est annulé : le script se termine par une EXCEPTION volontaire dont le message est le bilan.
-- Attendu : « BILAN : N/N contrôles OK ». Voir « Commande de test » dans le plan.
```

(b) Insérer, juste après le bloc `select zz_check('dir : la corbeille liste cet élève', …);` (ligne 77 du fichier d'origine), ce contrôle :
```sql
select zz_check('dir : la corbeille indique l''auteur de la suppression',
  (select supprime_par from ar_corbeille() where element_id = '00000000-0000-0000-0000-0000000000f1')
  = '00000000-0000-0000-0000-0000000000d1'::uuid);
```

(c) Remplacer le bloc `-- ══ AGENT ACCOMPAGNANT ══` jusqu'à la ligne `select zz_erreur('agent : ne peut pas restaurer', …);` (lignes 157 à 167 d'origine) par :
```sql
-- ══ AGENT ACCOMPAGNANT ══
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f2');
select zz_check('agent : peut mettre un élève en corbeille',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2') = 0);
select zz_erreur('agent : ne peut pas mettre une classe en corbeille',
  $q$ select ar_mettre_classe_en_corbeille('00000000-0000-0000-0000-0000000000c1') $q$, 'droit_insuffisant');
select zz_check('agent : ne voit pas la corbeille',
  (select count(*) from ar_corbeille()) = 0);
-- L'auteur d'une suppression peut l'annuler (bandeau « Annuler »), puis on remet l'élève en corbeille pour la suite.
select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f2');
select zz_check('agent : annule sa propre suppression',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2') = 1);
select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f2');
```

(d) Dans le bloc `-- ══ ADMIN ══`, juste après le contrôle `select zz_check('admin : peut restaurer', …);` (ligne 184 d'origine) et avant `select ar_mettre_eleve_en_corbeille('…f2');`, insérer :
```sql
-- Une suppression faite par un autre ne peut pas être annulée par un agent.
select ar_mettre_eleve_en_corbeille('00000000-0000-0000-0000-0000000000f1');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select zz_erreur('agent : ne peut pas annuler la suppression d''un autre',
  $q$ select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f1') $q$, 'droit_insuffisant');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select ar_restaurer_eleve('00000000-0000-0000-0000-0000000000f1');
```

(e) Juste avant la ligne `-- ══ PURGE AUTOMATIQUE ══`, après le bloc admin (donc après `select zz_check('admin : la ligne n''existe plus en base', …);`), insérer :
```sql
-- ══ RESTAURATION SOUS UN AUTRE NOM (phase B : une classe homonyme peut exister) ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select ar_mettre_classe_en_corbeille('00000000-0000-0000-0000-0000000000c1');
select zz_check('dir : recréer « 3A » possible tant que l''ancienne est en corbeille',
  ar_assurer_classe('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A', '3e') is not null);
select zz_erreur('dir : restaurer l''ancienne « 3A » sans nouveau nom : refusé',
  $q$ select ar_restaurer_classe('00000000-0000-0000-0000-0000000000c1') $q$, 'nom_deja_utilise');
select zz_erreur('dir : nouveau nom vide : refusé',
  $q$ select ar_restaurer_classe('00000000-0000-0000-0000-0000000000c1', '   ') $q$, 'nom_invalide');
select zz_check('dir : restaurer sous un autre nom',
  ar_restaurer_classe('00000000-0000-0000-0000-0000000000c1', '3A (ancienne)') >= 0);
select zz_check('dir : les deux classes coexistent',
  (select count(*) from ar_classes where ecole_id = '11111111-1111-1111-1111-111111111111'
     and annee_id = 'aaaaaaaa-0000-0000-0000-000000000001' and nom in ('3A', '3A (ancienne)')) = 2);
```
(`reset role;` est déjà présent au début de la section PURGE.)

- [ ] **Step 3 : Lancer le test A + B (transaction annulée)**

```bash
T="$(mktemp -d)"
{ grep -v -E '^(begin|commit);$' supabase/migrations/20261004_amenagactif_corbeille_a.sql
  grep -v -E '^(begin|commit);$' supabase/migrations/20261005_amenagactif_corbeille_b.sql
  grep -v -E '^begin;$' supabase/tests/corbeille.sql; } > "$T/ab.sql"
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f "$T/ab.sql" 2>&1 | grep -v "^Initialising"
```
Expected : `BILAN : N/N contrôles OK`, **aucune ligne KO** (une quarantaine de contrôles).

- [ ] **Step 4 : Vérifier que la base n'a pas bougé** (même commande qu'à la Task 1 Step 4 ; attendu : trois zéros ; et `select count(*) from pg_constraint where conrelid='public.ar_classes'::regclass and contype='u'` doit toujours renvoyer 1).

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20261005_amenagactif_corbeille_b.sql supabase/tests/corbeille.sql
git commit -m "feat(corbeille): migration phase B (retrait de l'ancienne contrainte) et test complet"
```

---

### Task 3 : Logique pure (TDD)

**Files:**
- Create: `src/domain/corbeille.js`
- Test: `tests/domain/corbeille.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
import { describe, it, expect } from 'vitest';
import {
  JOURS_CORBEILLE, messageConfirmationSuppressionEleve, messageConfirmationSuppressionClasse,
  messageErreurCorbeille, nomRestaurationParDefaut, libelleElement, joursRestantsTexte,
  suppressionsDAutrui, lireVus, marquerVu,
} from '../../src/domain/corbeille.js';

describe('textes de confirmation (même confirmation qu\'avant, texte corrigé)', () => {
  it('élève : ne parle plus d\'irréversible, annonce la corbeille et la durée', () => {
    const m = messageConfirmationSuppressionEleve('Emilie', 'D');
    expect(m).toContain('Emilie D');
    expect(m).toContain(`${JOURS_CORBEILLE} jours`);
    expect(m).not.toMatch(/irréversible/i);
  });
  it('classe : annonce le nombre d\'élèves ; sans élève, pas de phrase sur les élèves', () => {
    expect(messageConfirmationSuppressionClasse('5LA', 12)).toContain('12 élève(s)');
    expect(messageConfirmationSuppressionClasse('5LA', 0)).not.toContain('élève');
    expect(messageConfirmationSuppressionClasse('5LA', 12)).not.toMatch(/irréversible/i);
  });
});

describe('messageErreurCorbeille', () => {
  it.each([
    ['droit_insuffisant', "pas le droit"],
    ['classe_en_corbeille', 'restaurez-la d\'abord'],
    ['nom_deja_utilise', 'porte déjà ce nom'],
    ['nom_pris_corbeille', 'corbeille'],
    ['successeur_existant', 'doublon'],
    ['element_introuvable', 'n\'existe plus'],
    ['nom_invalide', '1 à 60'],
  ])('%s', (code, extrait) => {
    expect(messageErreurCorbeille({ message: code })).toContain(extrait);
  });
  it('code 42501 et défaut', () => {
    expect(messageErreurCorbeille({ code: '42501', message: 'x' })).toContain('pas le droit');
    expect(messageErreurCorbeille(undefined)).toContain('réessayez');
  });
});

describe('affichage', () => {
  it('nom de restauration par défaut, borné à 60 caractères', () => {
    expect(nomRestaurationParDefaut('3A')).toBe('3A (ancienne)');
    expect(nomRestaurationParDefaut('x'.repeat(80)).length).toBe(60);
  });
  it('libellé d\'un élément', () => {
    expect(libelleElement({ genre: 'classe', libelle: '5LA', nb_eleves: 12 })).toBe('Classe 5LA (12 élèves)');
    expect(libelleElement({ genre: 'classe', libelle: '5LA', nb_eleves: 1 })).toBe('Classe 5LA (1 élève)');
    expect(libelleElement({ genre: 'classe', libelle: '5LA', nb_eleves: 0 })).toBe('Classe 5LA');
    expect(libelleElement({ genre: 'eleve', libelle: 'Bao K', classe_nom: '5LA' })).toBe('Bao K (classe 5LA)');
  });
  it('jours restants', () => {
    expect(joursRestantsTexte(0)).toBe('dernier jour');
    expect(joursRestantsTexte(1)).toBe('1 jour restant');
    expect(joursRestantsTexte(12)).toBe('12 jours restants');
  });
});

describe('suppressionsDAutrui', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const el = (id, par, jours) => ({ element_id: id, supprime_par: par, supprime_le: new Date(now - jours * 86400000).toISOString() });
  const elements = [el('a', 'moi', 1), el('b', 'agent', 1), el('c', 'agent', 20), el('d', 'autre', 3), el('e', null, 1)];

  it('exclut mes propres suppressions, les anciennes (> 7 jours) et les suppressions sans auteur', () => {
    expect(suppressionsDAutrui({ elements, userId: 'moi', now }).map((e) => e.element_id)).toEqual(['b', 'd']);
  });
  it('exclut ce qui est marqué « C\'est voulu »', () => {
    expect(suppressionsDAutrui({ elements, userId: 'moi', now, vus: ['b'] }).map((e) => e.element_id)).toEqual(['d']);
  });
});

describe('mémoire « C\'est voulu » (par utilisateur, sans base)', () => {
  const faux = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
  it('lit une liste vide, puis mémorise sans doublon', () => {
    const s = faux();
    expect(lireVus('u1', s)).toEqual([]);
    marquerVu('u1', 'e1', s); marquerVu('u1', 'e1', s); marquerVu('u1', 'e2', s);
    expect(lireVus('u1', s)).toEqual(['e1', 'e2']);
    expect(lireVus('u2', s)).toEqual([]);
  });
  it('ne plante pas si le stockage est indisponible', () => {
    const casse = { getItem() { throw new Error('bloqué'); }, setItem() { throw new Error('bloqué'); } };
    expect(lireVus('u1', casse)).toEqual([]);
    expect(() => marquerVu('u1', 'e1', casse)).not.toThrow();
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — `npx vitest run tests/domain/corbeille.test.js` → FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

```js
// Logique pure de la corbeille. Aucune dépendance React/Supabase.

/** Doit rester égal à ar_corbeille_retention() côté SQL (affiché dans les textes). */
export const JOURS_CORBEILLE = 30;
/** Durée d'affichage du bandeau « Annuler » (le reste se fait depuis la page Corbeille). */
export const DUREE_BANDEAU_ANNULER_MS = 15000;
/** Une suppression faite par un autre n'est signalée que pendant ce délai. */
export const JOURS_ENCADRE_AUTRUI = 7;

const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function messageConfirmationSuppressionEleve(prenom, initiale) {
  return `Supprimer la fiche de ${prenom} ${initiale} ? Ses aménagements seront retirés des fiches. Vous pourrez la récupérer pendant ${JOURS_CORBEILLE} jours depuis la corbeille.`;
}

export function messageConfirmationSuppressionClasse(nom, nbEleves) {
  const eleves = nbEleves > 0 ? ` Ses ${nbEleves} élève(s) et leurs aménagements seront retirés des fiches.` : '';
  return `Supprimer la classe ${nom} ?${eleves} Vous pourrez la récupérer pendant ${JOURS_CORBEILLE} jours depuis la corbeille.`;
}

/** Traduit l'erreur d'une fonction de la corbeille en message pour la personne qui saisit. */
export function messageErreurCorbeille(err) {
  const m = err?.message ?? '';
  if (err?.code === '42501' || m.includes('droit_insuffisant')) return "Vous n'avez pas le droit de faire cette action.";
  if (m.includes('classe_en_corbeille')) return "Cette classe est elle-même dans la corbeille : restaurez-la d'abord.";
  if (m.includes('nom_pris_corbeille')) return 'Une classe supprimée porte ce nom. Restaurez-la depuis la corbeille, ou choisissez un autre nom.';
  if (m.includes('nom_deja_utilise')) return 'Une classe porte déjà ce nom : choisissez un autre nom pour la restaurer.';
  if (m.includes('successeur_existant')) return "Cet élève a déjà été repris dans l'année suivante : le restaurer créerait un doublon.";
  if (m.includes('element_introuvable')) return "Cet élément n'existe plus (déjà restauré ou effacé).";
  if (m.includes('nom_invalide')) return 'Le nom doit comporter de 1 à 60 caractères.';
  return 'Action impossible, réessayez.';
}

export function nomRestaurationParDefaut(nom) {
  return `${nom} (ancienne)`.slice(0, 60);
}

export function libelleElement(e) {
  if (e.genre === 'classe') {
    return `Classe ${e.libelle}${e.nb_eleves > 0 ? ` (${plur(e.nb_eleves, 'élève')})` : ''}`;
  }
  return `${e.libelle} (classe ${e.classe_nom})`;
}

export function joursRestantsTexte(n) {
  if (n <= 0) return 'dernier jour';
  return n === 1 ? '1 jour restant' : `${n} jours restants`;
}

/** Suppressions récentes faites par QUELQU'UN D'AUTRE que moi et pas encore marquées « C'est voulu ». */
export function suppressionsDAutrui({ elements, userId, now = new Date(), vus = [] }) {
  const limite = now.getTime() - JOURS_ENCADRE_AUTRUI * 86400000;
  const vusSet = new Set(vus);
  return elements.filter((e) => e.supprime_par && e.supprime_par !== userId
    && new Date(e.supprime_le).getTime() >= limite && !vusSet.has(e.element_id));
}

const cleVus = (userId) => `aa-corbeille-vus:${userId}`;

/** Mémoire locale (par utilisateur, par navigateur) : convenance, jamais source de vérité. */
export function lireVus(userId, storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(cleVus(userId)) ?? '[]'); } catch { return []; }
}

export function marquerVu(userId, elementId, storage = globalThis.localStorage) {
  try {
    const vus = new Set(lireVus(userId, storage));
    vus.add(elementId);
    storage.setItem(cleVus(userId), JSON.stringify([...vus].slice(-200)));
  } catch { /* stockage indisponible : l'encadré réapparaîtra, sans gravité */ }
}
```

- [ ] **Step 4 : Vérifier le succès** — `npx vitest run tests/domain/corbeille.test.js` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/domain/corbeille.js tests/domain/corbeille.test.js
git commit -m "feat(corbeille): logique pure (textes, erreurs, suppressions d'autrui, mémoire C'est voulu)"
```

---

### Task 4 : Filtres côté serveur (liens enseignants, génération de lien, export de profil)

**Files:**
- Modify: `src/domain/chargeurFiche.js`, `api/_lib/ficheData.js`, `api/_lib/liensData.js`, `api/fiche-token.js`, `api/_lib/liens.js`
- Test: `tests/domain/chargeurFiche.test.js`, `tests/domain/liensApi.test.js`

Contexte : le code serveur utilise la clé service role et contourne la RLS. Sans filtre, une classe ou un élève en corbeille resterait lisible sur les liens enseignants et dans l'export de profil. Ces filtres sont **sans effet tant que rien n'est en corbeille** : ils peuvent être déployés avant le front. `api/liens.js` (liste des liens) n'est **pas** modifié : il n'affiche que des noms de classes, et un lien dont la classe est en corbeille doit rester visible pour être révoqué.

- [ ] **Step 1 : Test de `chargeurFiche` (échec attendu)**

Dans `tests/domain/chargeurFiche.test.js`, remplacer la fonction `fauxDb` par cette version, qui enregistre aussi les filtres `is` :

```js
function fauxDb(tables, erreurs = {}) {
  const selects = [];
  const filtres = [];
  const from = (table) => {
    const res = () => (erreurs[table] ? { data: null, error: { message: 'boom ' + table } } : { data: tables[table] ?? [], error: null });
    const q = {
      select(cols) { selects.push({ table, cols }); return q; },
      eq() { return q; },
      in() { return q; },
      is(colonne, valeur) { filtres.push({ table, colonne, valeur }); return q; },
      order() { return q; },
      single() { const r = res(); return Promise.resolve(r.error ? r : { data: r.data[0] ?? null, error: null }); },
      then(ok, ko) { return Promise.resolve(res()).then(ok, ko); },
    };
    return q;
  };
  return { from, selects, filtres };
}
```

Ajouter dans le `describe('chargeur de fiche partagé', …)` :

```js
  it('ne lit que les classes et élèves hors corbeille (le service role contourne la RLS)', async () => {
    const db = fauxDb(tables);
    await chargerDonneesClasseAvec(db, 'c1');
    expect(db.filtres).toContainEqual({ table: 'ar_classes', colonne: 'supprime_le', valeur: null });
    expect(db.filtres).toContainEqual({ table: 'ar_eleves', colonne: 'supprime_le', valeur: null });
  });
```
Run : `npx vitest run tests/domain/chargeurFiche.test.js` → FAIL (filtre absent).

- [ ] **Step 2 : Modifier `src/domain/chargeurFiche.js`**

Remplacer :
`const rClasse = await db.from('ar_classes').select(COLONNES_CLASSE).eq('id', classeId).single();`
par :
`const rClasse = await db.from('ar_classes').select(COLONNES_CLASSE).eq('id', classeId).is('supprime_le', null).single();`

Remplacer :
`await db.from('ar_eleves').select(COLONNES_ELEVES).eq('classe_id', classeId).order('prenom'),`
par :
`await db.from('ar_eleves').select(COLONNES_ELEVES).eq('classe_id', classeId).is('supprime_le', null).order('prenom'),`

Run : `npx vitest run tests/domain/chargeurFiche.test.js` → PASS. (Une classe en corbeille fait échouer `.single()` avec le code `PGRST116`, déjà géré à l'étape 5.)

- [ ] **Step 3 : Filtres dans `api/_lib/ficheData.js` et `api/_lib/liensData.js`**

Dans `verifierAccesClasses` (`api/_lib/ficheData.js`), remplacer :
`const { data: classes, error: ec } = await db.from('ar_classes').select('id, ecole_id').in('id', classeIds);`
par :
`const { data: classes, error: ec } = await db.from('ar_classes').select('id, ecole_id').in('id', classeIds).is('supprime_le', null);`

Dans `loadClassesData` (même fichier), remplacer la fonction par :

```js
/** Charge les données de plusieurs classes en parallèle (regroupement "cours pratique"). Une classe en corbeille est ignorée. */
export async function loadClassesData(classeIds) {
  const parties = await Promise.all(classeIds.map((id) => loadClasseData(id).catch((e) => {
    if (e?.cause?.code === 'PGRST116') return null; // classe en corbeille ou supprimée
    throw e;
  })));
  return parties.filter(Boolean);
}
```

Dans `creerLien` (`api/_lib/liensData.js`), remplacer :
`const { data: classes, error } = await db.from('ar_classes').select('id, ecole_id, annee_id, ar_annees(libelle)').in('id', ids);`
par :
`const { data: classes, error } = await db.from('ar_classes').select('id, ecole_id, annee_id, ar_annees(libelle)').in('id', ids).is('supprime_le', null);`

- [ ] **Step 4 : Message « fiche indisponible » (`api/_lib/liens.js` et `api/fiche-token.js`)**

Dans `api/_lib/liens.js`, après la ligne `export const MESSAGE_LIEN_INACTIF = …;`, ajouter :
```js
export const MESSAGE_FICHE_INDISPONIBLE = "Cette fiche n'est plus disponible. Contactez le référent PLAI de l'implantation.";
```

Dans `api/fiche-token.js` : ajouter `MESSAGE_FICHE_INDISPONIBLE` à l'import depuis `./_lib/liens.js` (la ligne 3 déjà citée), puis :

1. Dans la branche « groupe », remplacer
```js
      const parties = await loadClassesData(cible.classeIds);
      const fusion = fusionnerDonneesClasses(parties, cible.nomGroupe);
```
par
```js
      const parties = await loadClassesData(cible.classeIds);
      if (parties.length === 0) { res.status(410).json({ error: MESSAGE_FICHE_INDISPONIBLE }); return; }
      const fusion = fusionnerDonneesClasses(parties, cible.nomGroupe);
```
2. Dans le `catch (e)`, juste après la ligne `if (e instanceof ErreurLien) { … }`, ajouter :
```js
    if (e?.cause?.code === 'PGRST116') { res.status(410).json({ error: MESSAGE_FICHE_INDISPONIBLE }); return; } // classe en corbeille
```

- [ ] **Step 5 : Tests d'API (échec puis succès)**

Dans `tests/domain/liensApi.test.js` : ajouter `MESSAGE_FICHE_INDISPONIBLE` à l'import `const { hasherSecret, MESSAGE_LIEN_INACTIF } = await import('../../api/_lib/liens.js');`, puis ajouter à la fin du fichier :

```js
describe('corbeille : classes supprimées (service role)', () => {
  it('refuse de créer un lien pour une classe en corbeille', async () => {
    connecte('ref1');
    mocks.verifier.mockResolvedValue(true);
    tables.ar_classes.find((c) => c.id === C1).supprime_le = '2026-10-01T08:00:00Z';
    const r = reponse();
    await ficheHandler({ method: 'POST', headers: auth, body: { classeId: C1, destinataire: 'Mme X' } }, r);
    expect(r.statusCode).toBe(400);
    expect(r.body.error).toBe('Classe introuvable.');
  });

  it('un lien dont la classe est en corbeille répond 410 « fiche indisponible » (et non 500)', async () => {
    connecte('ref1');
    mocks.verifier.mockResolvedValue(true);
    const { token } = await creerVia([C1]);
    mocks.loadClasseData.mockRejectedValueOnce(Object.assign(new Error('classe introuvable'), { cause: { code: 'PGRST116' } }));
    const r = reponse();
    await ficheHandler({ method: 'GET', headers: {}, query: { token } }, r);
    expect(r.statusCode).toBe(410);
    expect(r.body.error).toBe(MESSAGE_FICHE_INDISPONIBLE);
  });

  it('un lien groupé dont toutes les classes sont en corbeille répond 410', async () => {
    connecte('ref1');
    mocks.verifier.mockResolvedValue(true);
    const { token } = await creerVia([C1, C2]);
    mocks.loadClassesData.mockResolvedValueOnce([]);
    const r = reponse();
    await ficheHandler({ method: 'GET', headers: {}, query: { token } }, r);
    expect(r.statusCode).toBe(410);
    expect(r.body.error).toBe(MESSAGE_FICHE_INDISPONIBLE);
  });
});
```
Si `connecte`, `mocks.verifier` ou `creerVia` se configurent différemment dans les tests voisins du même fichier (lire les tests existants de `describe` proches pour la forme exacte du GET d'un lien opaque et la configuration de `mocks.verifier`), s'aligner sur ces conventions sans changer les assertions.

Run : `npm test` → PASS (baseline 323 + nouveaux tests).

- [ ] **Step 6 : Build et commit**

```bash
npx vite build
git add src/domain/chargeurFiche.js api tests/domain/chargeurFiche.test.js tests/domain/liensApi.test.js
git commit -m "feat(corbeille): filtres supprime_le côté serveur et message de fiche indisponible"
```

---

### Task 5 : Hooks et mutations

**Files:**
- Create: `src/hooks/useCorbeille.js`
- Modify: `src/hooks/useGridMutations.js` (3 mutations)

- [ ] **Step 1 : Créer `src/hooks/useCorbeille.js`**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/**
 * Contenu de la corbeille (classes et élèves supprimés) que l'utilisateur a le droit de voir :
 * admin, référent PLAI, direction. Une personne sans ce droit reçoit simplement une liste vide.
 * ecoleId null = toutes les écoles auxquelles il a droit.
 */
export function useCorbeille(ecoleId, enabled = true) {
  return useQuery({
    queryKey: ['corbeille', ecoleId ?? 'toutes'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ar_corbeille', { p_ecole: ecoleId ?? null });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCorbeilleMutations() {
  const qc = useQueryClient();
  const invalider = () => {
    for (const k of ['corbeille', 'grille', 'classes-cibles', 'fiche-classe', 'fiche-groupe', 'a-confirmer-classes']) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const restaurerEleve = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc('ar_restaurer_eleve', { p_eleve: id });
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  /** nouveauNom facultatif : restaure la classe sous un autre nom (quand son nom est pris). Renvoie le nombre d'élèves restaurés. */
  const restaurerClasse = useMutation({
    mutationFn: async ({ id, nouveauNom }) => {
      const { data, error } = await supabase.rpc('ar_restaurer_classe', { p_classe: id, p_nouveau_nom: nouveauNom ?? null });
      if (error) throw error;
      return data;
    },
    onSuccess: invalider,
  });

  /** Suppression définitive d'un élément de la corbeille (administrateur seulement, vérifié côté SQL). */
  const viderElement = useMutation({
    mutationFn: async ({ genre, id }) => {
      const { error } = await supabase.rpc('ar_vider_corbeille', { p_genre: genre, p_id: id });
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  return { restaurerEleve, restaurerClasse, viderElement };
}
```

- [ ] **Step 2 : Basculer les 3 mutations de `useGridMutations.js` sur les fonctions**

Ajouter l'import en tête : `import { messageErreurCorbeille } from '../domain/corbeille.js';`

Remplacer la mutation `deleteEleve` par :
```js
  const deleteEleve = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.rpc('ar_mettre_eleve_en_corbeille', { p_eleve: id });
      if (error) throw new Error(messageErreurCorbeille(error));
    },
    onSuccess: () => { invalider(); qc.invalidateQueries({ queryKey: ['corbeille'] }); },
  });
```

Remplacer la mutation `ensureClasse` par :
```js
  const ensureClasse = useMutation({
    mutationFn: async ({ nom, niveau }) => {
      const { data, error } = await supabase.rpc('ar_assurer_classe', {
        p_ecole: ecoleId, p_annee: anneeId, p_nom: nom, p_niveau: niveau ?? null,
      });
      if (error) throw new Error(messageErreurCorbeille(error));
      return data; // identifiant de la classe
    },
    onSuccess: invalider,
  });
```

Remplacer la mutation `deleteClasse` par :
```js
  /** Met la classe et ses élèves en corbeille. Renvoie le nombre d'élèves partis avec elle. */
  const deleteClasse = useMutation({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase.rpc('ar_mettre_classe_en_corbeille', { p_classe: id });
      if (error) throw new Error(messageErreurCorbeille(error));
      return data;
    },
    onSuccess: () => { invalider(); qc.invalidateQueries({ queryKey: ['corbeille'] }); },
  });
```

- [ ] **Step 3 : Build et tests**

Run : `npx vite build && npm test` → build OK, tests PASS (les tests existants mockent `useGridMutations`).

- [ ] **Step 4 : Commit**

```bash
git add src/hooks/useCorbeille.js src/hooks/useGridMutations.js
git commit -m "feat(corbeille): hooks de la corbeille et suppressions sur les fonctions SQL"
```

---

### Task 6 : Composants « Annuler » et « Corbeille (n) »

**Files:**
- Create: `src/components/saisie/SuppressionRecente.jsx`, `src/components/saisie/ZoneCorbeille.jsx`
- Test: `tests/domain/suppressionRecente.test.jsx`, `tests/domain/zoneCorbeille.test.jsx`

Convention du projet : texte ≥ 16 px (`text-base`), état exprimé en texte, labels explicites.

- [ ] **Step 1 : Test du bandeau « Annuler » (échec attendu)**

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ restaurerEleve: vi.fn(), restaurerClasse: vi.fn() }));
vi.mock('../../src/hooks/useCorbeille.js', () => ({
  useCorbeilleMutations: () => ({
    restaurerEleve: { mutateAsync: h.restaurerEleve },
    restaurerClasse: { mutateAsync: h.restaurerClasse },
  }),
}));

import SuppressionRecente from '../../src/components/saisie/SuppressionRecente.jsx';

const rendre = (suppression, onFermer = vi.fn()) => {
  render(<MemoryRouter><SuppressionRecente suppression={suppression} onFermer={onFermer} /></MemoryRouter>);
  return onFermer;
};

beforeEach(() => { vi.useFakeTimers(); h.restaurerEleve.mockReset(); h.restaurerClasse.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SuppressionRecente (bandeau Annuler)', () => {
  it('annonce la suppression d\'un élève et propose Annuler', () => {
    rendre({ genre: 'eleve', id: 'e1', libelle: 'Bao K' });
    expect(screen.getByRole('status').textContent).toContain('Bao K');
    expect(screen.getByRole('status').textContent).toContain('supprimé');
    expect(screen.getByRole('button', { name: /Annuler la suppression/ })).toBeTruthy();
  });

  it('annonce le nombre d\'élèves d\'une classe supprimée', () => {
    rendre({ genre: 'classe', id: 'c1', libelle: '5LA', detail: 12 });
    expect(screen.getByRole('status').textContent).toContain('5LA');
    expect(screen.getByRole('status').textContent).toContain('12 élèves');
  });

  it('Annuler restaure l\'élève puis confirme', async () => {
    h.restaurerEleve.mockResolvedValue(undefined);
    rendre({ genre: 'eleve', id: 'e1', libelle: 'Bao K' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Annuler la suppression/ })); });
    expect(h.restaurerEleve).toHaveBeenCalledWith({ id: 'e1' });
    expect(screen.getByRole('status').textContent).toContain('restauré');
  });

  it('Annuler restaure la classe (sans nouveau nom)', async () => {
    h.restaurerClasse.mockResolvedValue(12);
    rendre({ genre: 'classe', id: 'c1', libelle: '5LA', detail: 12 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Annuler la suppression/ })); });
    expect(h.restaurerClasse).toHaveBeenCalledWith({ id: 'c1' });
  });

  it('affiche l\'erreur et renvoie vers la corbeille si la restauration échoue', async () => {
    h.restaurerClasse.mockRejectedValue({ message: 'nom_deja_utilise' });
    rendre({ genre: 'classe', id: 'c1', libelle: '5LA', detail: 0 });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Annuler la suppression/ })); });
    expect(screen.getByRole('status').textContent).toContain('porte déjà ce nom');
    expect(screen.getByRole('link', { name: /corbeille/i }).getAttribute('href')).toBe('/corbeille');
  });

  it('se ferme seul après 15 secondes', () => {
    const onFermer = rendre({ genre: 'eleve', id: 'e1', libelle: 'Bao K' });
    act(() => { vi.advanceTimersByTime(14000); });
    expect(onFermer).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onFermer).toHaveBeenCalled();
  });
});
```
Run : `npx vitest run tests/domain/suppressionRecente.test.jsx` → FAIL (module introuvable).

- [ ] **Step 2 : Créer `SuppressionRecente.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCorbeilleMutations } from '../../hooks/useCorbeille.js';
import { DUREE_BANDEAU_ANNULER_MS, messageErreurCorbeille } from '../../domain/corbeille.js';

/**
 * Bandeau affiché juste après une suppression : « Annuler » pendant 15 secondes. Non bloquant, aucun clic en plus
 * dans le parcours habituel. Au-delà, la page « Corbeille » prend le relais.
 * suppression : { genre: 'eleve' | 'classe', id, libelle, detail? (nombre d'élèves d'une classe) }
 */
export default function SuppressionRecente({ suppression, onFermer }) {
  const { restaurerEleve, restaurerClasse } = useCorbeilleMutations();
  const [etat, setEtat] = useState('attente'); // attente | restauration | restaure | erreur
  const [erreur, setErreur] = useState('');
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    const delai = etat === 'attente' ? DUREE_BANDEAU_ANNULER_MS : etat === 'restaure' ? 4000 : null;
    if (delai === null) return undefined;
    const t = setTimeout(() => fermer.current(), delai);
    return () => clearTimeout(t);
  }, [etat, suppression.id]);

  async function annuler() {
    setEtat('restauration');
    setErreur('');
    try {
      if (suppression.genre === 'classe') await restaurerClasse.mutateAsync({ id: suppression.id });
      else await restaurerEleve.mutateAsync({ id: suppression.id });
      setEtat('restaure');
    } catch (e) {
      setEtat('erreur');
      setErreur(messageErreurCorbeille(e));
    }
  }

  const texte = suppression.genre === 'classe'
    ? `Classe « ${suppression.libelle} » supprimée${suppression.detail > 0 ? ` avec ${suppression.detail} élève${suppression.detail > 1 ? 's' : ''}` : ''}.`
    : `« ${suppression.libelle} » supprimé.`;

  return (
    <div role="status" className="plai-card p-3 flex flex-wrap items-center gap-3 text-base" style={{ borderColor: '#0f6e56' }}>
      {etat === 'restaure' ? (
        <span>{suppression.genre === 'classe' ? `Classe « ${suppression.libelle} » restaurée.` : `« ${suppression.libelle} » est restauré.`}</span>
      ) : (
        <>
          <span>{texte}</span>
          <button type="button" className="plai-btn" onClick={annuler} disabled={etat === 'restauration'}>
            {etat === 'restauration' ? 'Restauration…' : 'Annuler la suppression'}
          </button>
        </>
      )}
      {erreur && (
        <span className="plai-error">{erreur} <Link to="/corbeille" className="underline">Ouvrir la corbeille</Link></span>
      )}
      <button type="button" className="underline text-base" onClick={onFermer}>Fermer</button>
    </div>
  );
}
```
Run : `npx vitest run tests/domain/suppressionRecente.test.jsx` → PASS.

- [ ] **Step 3 : Test de `ZoneCorbeille` (échec attendu)**

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ data: [], restaurerEleve: vi.fn(), restaurerClasse: vi.fn() }));
vi.mock('../../src/lib/auth.jsx', () => ({ useAuth: () => ({ session: { user: { id: 'u-moi' } } }) }));
vi.mock('../../src/hooks/useCorbeille.js', () => ({
  useCorbeille: () => ({ data: h.data }),
  useCorbeilleMutations: () => ({
    restaurerEleve: { mutateAsync: h.restaurerEleve },
    restaurerClasse: { mutateAsync: h.restaurerClasse },
  }),
}));

import ZoneCorbeille from '../../src/components/saisie/ZoneCorbeille.jsx';

const recent = () => new Date(Date.now() - 3600 * 1000).toISOString();
const eleve = (id, par, parNom) => ({
  genre: 'eleve', element_id: id, libelle: 'Bao K', classe_nom: '5LA', nb_eleves: null,
  supprime_le: recent(), supprime_par: par, supprime_par_nom: parNom, jours_restants: 30,
});
const rendre = () => render(<MemoryRouter><ZoneCorbeille ecoleId="s1" /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); h.restaurerEleve.mockReset(); h.restaurerClasse.mockReset(); });
afterEach(cleanup);

describe('ZoneCorbeille', () => {
  it('rien à afficher quand la corbeille est vide', () => {
    h.data = [];
    const { container } = rendre();
    expect(container.textContent).toBe('');
  });

  it('pastille « Corbeille (n) » vers la page /corbeille', () => {
    h.data = [eleve('e1', 'u-moi', 'Moi')];
    rendre();
    const lien = screen.getByRole('link', { name: /Corbeille \(1\)/ });
    expect(lien.getAttribute('href')).toBe('/corbeille');
  });

  it('encadré pour une suppression faite par quelqu\'un d\'autre, avec son nom', () => {
    h.data = [eleve('e1', 'u-agent', 'Agent X')];
    rendre();
    expect(screen.getByText(/Supprimé par quelqu'un d'autre/)).toBeTruthy();
    expect(screen.getByText(/Agent X/)).toBeTruthy();
  });

  it('pas d\'encadré pour mes propres suppressions', () => {
    h.data = [eleve('e1', 'u-moi', 'Moi')];
    rendre();
    expect(screen.queryByText(/Supprimé par quelqu'un d'autre/)).toBeNull();
  });

  it('« C\'est voulu » masque l\'encadré et le mémorise', () => {
    h.data = [eleve('e1', 'u-agent', 'Agent X')];
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /C'est voulu/ }));
    expect(screen.queryByText(/Supprimé par quelqu'un d'autre/)).toBeNull();
    expect(JSON.parse(localStorage.getItem('aa-corbeille-vus:u-moi'))).toEqual(['e1']);
  });

  it('« Restaurer » restaure l\'élève', async () => {
    h.data = [eleve('e1', 'u-agent', 'Agent X')];
    h.restaurerEleve.mockResolvedValue(undefined);
    rendre();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Restaurer/ })); });
    expect(h.restaurerEleve).toHaveBeenCalledWith({ id: 'e1' });
  });

  it('une classe restaurée en conflit de nom renvoie vers la corbeille', async () => {
    h.data = [{ genre: 'classe', element_id: 'c1', libelle: '5LA', classe_nom: null, nb_eleves: 3,
      supprime_le: recent(), supprime_par: 'u-autre', supprime_par_nom: 'Direction B', jours_restants: 30 }];
    h.restaurerClasse.mockRejectedValue({ message: 'nom_deja_utilise' });
    rendre();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Restaurer/ })); });
    expect(screen.getByText(/porte déjà ce nom/)).toBeTruthy();
  });
});
```
Run → FAIL (module introuvable).

- [ ] **Step 4 : Créer `ZoneCorbeille.jsx`**

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';
import { useCorbeille, useCorbeilleMutations } from '../../hooks/useCorbeille.js';
import { dateFR } from '../../domain/liens.js';
import {
  JOURS_CORBEILLE, libelleElement, suppressionsDAutrui, lireVus, marquerVu, messageErreurCorbeille,
} from '../../domain/corbeille.js';

/**
 * Zone discrète de la Saisie (référents, directions, administrateur) :
 *  A. pastille « Corbeille (n) », seulement si la corbeille n'est pas vide ;
 *  B. encadré « Supprimé par quelqu'un d'autre » pour les suppressions récentes faites par un autre membre.
 * Elle ne rend rien quand il n'y a rien à signaler : le parcours habituel n'est pas modifié.
 */
export default function ZoneCorbeille({ ecoleId }) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data = [] } = useCorbeille(ecoleId, !!ecoleId && !!userId);
  const { restaurerEleve, restaurerClasse } = useCorbeilleMutations();
  const [vus, setVus] = useState(() => (userId ? lireVus(userId) : []));
  const [erreurs, setErreurs] = useState({});

  if (data.length === 0) return null;
  const aSignaler = suppressionsDAutrui({ elements: data, userId, vus });

  async function restaurer(e) {
    setErreurs((x) => ({ ...x, [e.element_id]: '' }));
    try {
      if (e.genre === 'classe') await restaurerClasse.mutateAsync({ id: e.element_id });
      else await restaurerEleve.mutateAsync({ id: e.element_id });
    } catch (err) {
      setErreurs((x) => ({ ...x, [e.element_id]: messageErreurCorbeille(err) }));
    }
  }

  function cestVoulu(e) {
    marquerVu(userId, e.element_id);
    setVus((v) => [...v, e.element_id]);
  }

  return (
    <div className="space-y-2">
      <p className="text-base">
        <Link to="/corbeille" className="underline text-teal font-medium">Corbeille ({data.length})</Link>
        <span className="text-[color:var(--text2)]"> : éléments supprimés, récupérables pendant {JOURS_CORBEILLE} jours.</span>
      </p>
      {aSignaler.length > 0 && (
        <section role="status" className="p-3 rounded space-y-2 text-base" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>
          <h2 className="font-semibold">Supprimé par quelqu'un d'autre</h2>
          <ul className="space-y-2">
            {aSignaler.map((e) => (
              <li key={e.element_id} className="flex flex-wrap items-center gap-2">
                <span>
                  {libelleElement(e)}, supprimé par {e.supprime_par_nom || 'un membre de l\'équipe'} le {dateFR(e.supprime_le)}.
                </span>
                <button type="button" className="plai-btn" onClick={() => restaurer(e)}>Restaurer</button>
                <button type="button" className="underline" onClick={() => cestVoulu(e)}>C'est voulu</button>
                {erreurs[e.element_id] && (
                  <span className="plai-error">{erreurs[e.element_id]} <Link to="/corbeille" className="underline">Ouvrir la corbeille</Link></span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```
Run : `npx vitest run tests/domain/zoneCorbeille.test.jsx` → PASS.

- [ ] **Step 5 : Suite complète, build, commit**

```bash
npm test && npx vite build
git add src/components/saisie/SuppressionRecente.jsx src/components/saisie/ZoneCorbeille.jsx tests/domain/suppressionRecente.test.jsx tests/domain/zoneCorbeille.test.jsx
git commit -m "feat(corbeille): bandeau Annuler et zone Corbeille (pastille + suppressions d'autrui)"
```

---

### Task 7 : Câblage dans la Saisie (même parcours, textes corrigés)

**Files:**
- Modify: `src/components/saisie/EleveEditor.jsx`, `src/pages/SaisieEcole.jsx`
- Modify: `tests/domain/saisieEcoleDispositifs.test.jsx`

- [ ] **Step 1 : Adapter les mocks du test existant et ajouter les tests (échec attendu)**

Dans `tests/domain/saisieEcoleDispositifs.test.jsx`, remplacer la ligne `vi.mock('../../src/lib/auth.jsx', …)` par :
```jsx
vi.mock('../../src/lib/auth.jsx', () => ({
  useRole: () => ({ role: h.role, isAdmin: false }),
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
vi.mock('../../src/hooks/useCorbeille.js', () => ({
  useCorbeille: () => ({ data: [] }),
  useCorbeilleMutations: () => ({
    restaurerEleve: { mutateAsync: vi.fn() }, restaurerClasse: { mutateAsync: vi.fn() }, viderElement: { mutateAsync: vi.fn() },
  }),
}));
```
À la fin du fichier, ajouter :
```jsx
describe('SaisieEcole : suppression récupérable', () => {
  it('la confirmation de suppression d\'élève annonce la corbeille (plus « irréversible »)', () => {
    installer();
    ouvrirClasse();
    fireEvent.click(screen.getByTitle('Cliquer pour modifier'));
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'élève/ }));
    expect(confirmer).toHaveBeenCalledTimes(1);
    expect(confirmer.mock.calls[0][0]).toContain('30 jours');
    expect(confirmer.mock.calls[0][0]).not.toMatch(/irréversible/i);
  });

  it('une confirmation, puis le bandeau Annuler après la suppression d\'un élève', async () => {
    installer();
    h.mut.deleteEleve = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, isError: false };
    ouvrirClasse();
    fireEvent.click(screen.getByTitle('Cliquer pour modifier'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Supprimer l'élève/ }));
    await screen.findByRole('button', { name: /Annuler la suppression/ });
    expect(h.mut.deleteEleve.mutateAsync).toHaveBeenCalledWith({ id: 'e1' });
  });
});
```
Run : `npx vitest run tests/domain/saisieEcoleDispositifs.test.jsx` → FAIL sur les deux nouveaux tests.

- [ ] **Step 2 : Modifier `EleveEditor.jsx` (texte de la confirmation seulement)**

Ajouter l'import : `import { messageConfirmationSuppressionEleve } from '../../domain/corbeille.js';`
Remplacer :
```jsx
    if (!confirm(`Supprimer la fiche de ${eleve.prenom} ${eleve.initiale_nom} ? Tous ses aménagements cochés seront retirés. Cette action est irréversible.`)) return;
```
par :
```jsx
    if (!confirm(messageConfirmationSuppressionEleve(eleve.prenom, eleve.initiale_nom))) return;
```

- [ ] **Step 3 : Modifier `SaisieEcole.jsx`**

Ajouter aux imports :
```jsx
import SuppressionRecente from '../components/saisie/SuppressionRecente.jsx';
import ZoneCorbeille from '../components/saisie/ZoneCorbeille.jsx';
import { messageConfirmationSuppressionClasse } from '../domain/corbeille.js';
```

Après la ligne `const [blocages, setBlocages] = useState({});`, ajouter :
```jsx
  const [derniere, setDerniere] = useState(null); // dernière suppression : alimente le bandeau « Annuler »
```

Après le bloc `const avertissementsDe = …` (ajouté par le changement de classe), ajouter :
```jsx
  const supprimerEleve = async (e) => {
    await mut.deleteEleve.mutateAsync({ id: e.id });
    setDerniere({ genre: 'eleve', id: e.id, libelle: `${e.prenom} ${e.initiale_nom}` });
  };
```

Remplacer le gestionnaire du bouton « Supprimer la classe » : le bloc
```jsx
                <button className="underline text-red-600" onClick={() => {
                  const avertissement = eleves.length > 0
                    ? `Supprimer la classe ${classe.nom} ? Ses ${eleves.length} élève(s) et tous leurs aménagements cochés seront supprimés définitivement. Cette action est irréversible.`
                    : `Supprimer la classe ${classe.nom} ? Cette action est irréversible.`;
                  if (!confirm(avertissement)) return;
                  mut.deleteClasse.mutate({ id: classeId }, { onSuccess: () => { setClasseId(null); setEditId(null); } });
                }} disabled={mut.deleteClasse.isPending}>
```
devient
```jsx
                <button className="underline text-red-600" onClick={() => {
                  if (!confirm(messageConfirmationSuppressionClasse(classe.nom, eleves.length))) return;
                  const supprimee = { genre: 'classe', id: classeId, libelle: classe.nom, detail: eleves.length };
                  mut.deleteClasse.mutate({ id: classeId }, { onSuccess: () => { setClasseId(null); setEditId(null); setDerniere(supprimee); } });
                }} disabled={mut.deleteClasse.isPending}>
```

Dans la liste des élèves, remplacer `onDelete={() => mut.deleteEleve.mutateAsync({ id: e.id })} />` par `onDelete={() => supprimerEleve(e)} />`.
Dans le tableau, remplacer `onDeleteEleve={(v) => mut.deleteEleve.mutateAsync(v)}` par `onDeleteEleve={(v) => supprimerEleve(eleves.find((x) => x.id === v.id))}`.

Juste après le titre `<h1 className="text-xl font-semibold">Saisie des aménagements</h1>` ajouter :
```jsx
      {derniere && <SuppressionRecente key={derniere.id} suppression={derniere} onFermer={() => setDerniere(null)} />}
      {peutEditerStructure && ctx.ecoleId && <ZoneCorbeille ecoleId={ctx.ecoleId} />}
```

- [ ] **Step 4 : Tests et build**

Run : `npx vitest run tests/domain/saisieEcoleDispositifs.test.jsx && npm test && npx vite build` → tout PASS ; build OK.

- [ ] **Step 5 : Commit**

```bash
git add src/components/saisie/EleveEditor.jsx src/pages/SaisieEcole.jsx tests/domain/saisieEcoleDispositifs.test.jsx
git commit -m "feat(corbeille): câblage dans la Saisie (textes de confirmation, bandeau Annuler, zone Corbeille)"
```

---

### Task 8 : Page « Corbeille » et route

**Files:**
- Create: `src/pages/Corbeille.jsx`
- Modify: `src/App.jsx`
- Test: `tests/domain/corbeillePage.test.jsx`

- [ ] **Step 1 : Test de la page (échec attendu)**

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ isAdmin: false, data: [], restaurerEleve: vi.fn(), restaurerClasse: vi.fn(), viderElement: vi.fn() }));
vi.mock('../../src/lib/auth.jsx', () => ({ useRole: () => ({ role: 'referent_plai', isAdmin: h.isAdmin }) }));
vi.mock('../../src/hooks/useEcoleGrid.js', () => ({ useEcoles: () => ({ data: [{ id: 's1', nom: 'Athénée A' }, { id: 's2', nom: 'Athénée B' }] }) }));
vi.mock('../../src/hooks/useCorbeille.js', () => ({
  useCorbeille: () => ({ data: h.data, isLoading: false, error: null }),
  useCorbeilleMutations: () => ({
    restaurerEleve: { mutateAsync: h.restaurerEleve },
    restaurerClasse: { mutateAsync: h.restaurerClasse },
    viderElement: { mutateAsync: h.viderElement },
  }),
}));

import Corbeille from '../../src/pages/Corbeille.jsx';

const classe = { genre: 'classe', element_id: 'c1', ecole_id: 's1', ecole_nom: 'Athénée A', libelle: '5LA', classe_nom: null, nb_eleves: 12,
  supprime_le: '2026-10-01T08:00:00Z', supprime_par: 'u1', supprime_par_nom: 'Direction A', jours_restants: 28 };
const eleve = { genre: 'eleve', element_id: 'e1', ecole_id: 's1', ecole_nom: 'Athénée A', libelle: 'Bao K', classe_nom: '5LB', nb_eleves: null,
  supprime_le: '2026-10-02T08:00:00Z', supprime_par: 'u2', supprime_par_nom: 'Agent X', jours_restants: 29 };

const rendre = () => render(<MemoryRouter><Corbeille /></MemoryRouter>);

beforeEach(() => { h.isAdmin = false; h.data = [classe, eleve]; h.restaurerEleve.mockReset(); h.restaurerClasse.mockReset(); h.viderElement.mockReset(); });
afterEach(cleanup);

describe('page Corbeille', () => {
  it('liste les éléments avec auteur, jours restants et durée de conservation', () => {
    rendre();
    expect(screen.getByText(/Classe 5LA \(12 élèves\)/)).toBeTruthy();
    expect(screen.getByText(/Bao K \(classe 5LB\)/)).toBeTruthy();
    expect(screen.getByText(/Direction A/)).toBeTruthy();
    expect(screen.getByText(/28 jours restants/)).toBeTruthy();
    expect(screen.getByText(/30 jours/)).toBeTruthy();
  });

  it('message clair quand la corbeille est vide', () => {
    h.data = [];
    rendre();
    expect(screen.getByText(/La corbeille est vide/)).toBeTruthy();
  });

  it('restaure un élève', async () => {
    h.restaurerEleve.mockResolvedValue(undefined);
    rendre();
    const ligne = screen.getByText(/Bao K \(classe 5LB\)/).closest('li');
    await act(async () => { fireEvent.click(ligne.querySelector('button')); });
    expect(h.restaurerEleve).toHaveBeenCalledWith({ id: 'e1' });
  });

  it('conflit de nom : propose de restaurer la classe sous un autre nom, pré-rempli', async () => {
    h.restaurerClasse.mockRejectedValueOnce({ message: 'nom_deja_utilise' }).mockResolvedValueOnce(12);
    rendre();
    const ligne = screen.getByText(/Classe 5LA/).closest('li');
    await act(async () => { fireEvent.click(ligne.querySelector('button')); });
    const champ = screen.getByLabelText(/Nouveau nom de la classe restaurée/);
    expect(champ.value).toBe('5LA (ancienne)');
    fireEvent.change(champ, { target: { value: '5LA bis' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Restaurer sous ce nom/ })); });
    expect(h.restaurerClasse).toHaveBeenLastCalledWith({ id: 'c1', nouveauNom: '5LA bis' });
  });

  it('« Supprimer définitivement » réservé à l\'administrateur', () => {
    rendre();
    expect(screen.queryByRole('button', { name: /Supprimer définitivement/ })).toBeNull();
    cleanup();
    h.isAdmin = true;
    rendre();
    expect(screen.getAllByRole('button', { name: /Supprimer définitivement/ }).length).toBe(2);
  });
});
```
Run → FAIL (module introuvable).

- [ ] **Step 2 : Créer `src/pages/Corbeille.jsx`**

```jsx
import { useState } from 'react';
import { useCorbeille, useCorbeilleMutations } from '../hooks/useCorbeille.js';
import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useRole } from '../lib/auth.jsx';
import { dateFR } from '../domain/liens.js';
import {
  JOURS_CORBEILLE, libelleElement, joursRestantsTexte, messageErreurCorbeille, nomRestaurationParDefaut,
} from '../domain/corbeille.js';

export default function Corbeille() {
  const { isAdmin } = useRole();
  const { data: ecoles = [] } = useEcoles();
  const [ecoleId, setEcoleId] = useState('');
  const { data: elements = [], isLoading, error } = useCorbeille(ecoleId || null);
  const { restaurerEleve, restaurerClasse, viderElement } = useCorbeilleMutations();
  const [messages, setMessages] = useState({}); // { [id]: { type: 'ok' | 'erreur', texte } }
  const [renommer, setRenommer] = useState(null); // { id, nom }

  const noter = (id, type, texte) => setMessages((m) => ({ ...m, [id]: { type, texte } }));

  async function restaurer(e) {
    noter(e.element_id, 'ok', '');
    try {
      if (e.genre === 'classe') {
        const n = await restaurerClasse.mutateAsync({ id: e.element_id });
        noter(e.element_id, 'ok', `Classe restaurée${n > 0 ? ` avec ${n} élève${n > 1 ? 's' : ''}` : ''}.`);
      } else {
        await restaurerEleve.mutateAsync({ id: e.element_id });
        noter(e.element_id, 'ok', 'Élève restauré.');
      }
    } catch (err) {
      if (e.genre === 'classe' && /nom_deja_utilise|nom_pris_corbeille/.test(err?.message ?? '')) {
        setRenommer({ id: e.element_id, nom: nomRestaurationParDefaut(e.libelle) });
        noter(e.element_id, 'erreur', messageErreurCorbeille(err));
      } else {
        noter(e.element_id, 'erreur', messageErreurCorbeille(err));
      }
    }
  }

  async function restaurerSousAutreNom(e) {
    try {
      const n = await restaurerClasse.mutateAsync({ id: e.element_id, nouveauNom: renommer.nom });
      setRenommer(null);
      noter(e.element_id, 'ok', `Classe restaurée sous le nom « ${renommer.nom} »${n > 0 ? `, avec ${n} élève${n > 1 ? 's' : ''}` : ''}.`);
    } catch (err) {
      noter(e.element_id, 'erreur', messageErreurCorbeille(err));
    }
  }

  async function vider(e) {
    if (!confirm(`Supprimer définitivement « ${e.libelle} » ? Cette action est irréversible.`)) return;
    try {
      await viderElement.mutateAsync({ genre: e.genre, id: e.element_id });
    } catch (err) {
      noter(e.element_id, 'erreur', messageErreurCorbeille(err));
    }
  }

  return (
    <div className="plai-section space-y-4 px-4">
      <h1 className="text-xl font-semibold">Corbeille</h1>
      <p className="text-base text-[color:var(--text2)]">
        Les classes et les élèves supprimés sont conservés {JOURS_CORBEILLE} jours, puis effacés définitivement.
        Une classe se restaure avec les élèves qui ont été supprimés en même temps qu'elle.
      </p>

      {ecoles.length > 1 && (
        <div>
          <label htmlFor="corbeille-ecole" className="block font-medium">Implantation</label>
          <select id="corbeille-ecole" className="plai-input" value={ecoleId} onChange={(ev) => setEcoleId(ev.target.value)}>
            <option value="">Toutes mes implantations</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
          <p className="text-sm text-[color:var(--text3)]">Limite la liste à une implantation.</p>
        </div>
      )}

      {isLoading ? <p>Chargement…</p>
        : error ? <p className="plai-error">Erreur de chargement : {error.message}</p>
        : elements.length === 0 ? <p className="plai-empty">La corbeille est vide.</p>
        : (
          <ul className="space-y-3">
            {elements.map((e) => (
              <li key={`${e.genre}-${e.element_id}`} className="plai-card p-3 space-y-2 text-base">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{libelleElement(e)}</strong>
                  {ecoles.length > 1 && <span className="text-[color:var(--text3)]">{e.ecole_nom}</span>}
                </div>
                <p className="text-[color:var(--text2)]">
                  Supprimé par {e.supprime_par_nom || 'un membre de l\'équipe'} le {dateFR(e.supprime_le)} · {joursRestantsTexte(e.jours_restants)}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="plai-btn" onClick={() => restaurer(e)}>Restaurer</button>
                  {isAdmin && <button type="button" className="underline text-red-600" onClick={() => vider(e)}>Supprimer définitivement</button>}
                </div>
                {renommer?.id === e.element_id && (
                  <div className="space-y-1">
                    <label htmlFor={`renom-${e.element_id}`} className="block font-medium">Nouveau nom de la classe restaurée</label>
                    <input id={`renom-${e.element_id}`} className="plai-input w-full max-w-sm" maxLength={60} value={renommer.nom}
                      placeholder="5LA (ancienne)" onChange={(ev) => setRenommer({ ...renommer, nom: ev.target.value })} />
                    <p className="text-sm text-[color:var(--text3)]">
                      Une autre classe porte déjà ce nom : elle n'est pas modifiée. Après la restauration, vous pourrez déplacer des
                      élèves d'une classe à l'autre avec « Changer de classe en cours d'année ».
                    </p>
                    <div className="flex gap-3">
                      <button type="button" className="plai-btn" disabled={!renommer.nom.trim()} onClick={() => restaurerSousAutreNom(e)}>Restaurer sous ce nom</button>
                      <button type="button" className="underline" onClick={() => setRenommer(null)}>Annuler</button>
                    </div>
                  </div>
                )}
                {messages[e.element_id]?.texte && (
                  <p className={messages[e.element_id].type === 'erreur' ? 'plai-error' : 'plai-success'} role="status">{messages[e.element_id].texte}</p>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
```
Run : `npx vitest run tests/domain/corbeillePage.test.jsx` → PASS.

- [ ] **Step 3 : Route dans `src/App.jsx`**

Ajouter l'import après `import Reprise from './pages/Reprise.jsx';` :
```jsx
import Corbeille from './pages/Corbeille.jsx';
```
Ajouter la route juste après la route `/reprise` :
```jsx
      <Route path="/corbeille" element={<RequireAuth><Shell><RequireRole roles={GESTIONNAIRES_LIENS}><Corbeille /></RequireRole></Shell></RequireAuth>} />
```
(`GESTIONNAIRES_LIENS` = admin, référent PLAI, direction : pas l'agent accompagnant, qui annule sa suppression par le bandeau.)

- [ ] **Step 4 : Suite complète, build, commit**

```bash
npm test && npx vite build
git add src/pages/Corbeille.jsx src/App.jsx tests/domain/corbeillePage.test.jsx
git commit -m "feat(corbeille): page Corbeille (restauration, renommage, purge admin) et route"
```

---

### Task 9 : Modes d'emploi

**Files:**
- Modify: `docs/modes-emploi/referents-plai.html`, `docs/modes-emploi/directions-complet.html`, `docs/modes-emploi/accompagnants.html`
- Modify: les mêmes fichiers dans `public/modes-emploi/` (copies identiques ; `dist/` est un résultat de build, ne pas l'éditer)

- [ ] **Step 1 : Référents PLAI** — dans `docs/modes-emploi/referents-plai.html`, remplacer :
```html
      <li><strong>Commentaire par élève</strong> : zone de texte libre, éditable depuis la liste des élèves.</li>
```
par :
```html
      <li><strong>Commentaire par élève</strong> : zone de texte libre, éditable depuis la liste des élèves.</li>
      <li><strong>Supprimer un élève ou une classe par erreur, c'est rattrapable.</strong> Rien n'est effacé tout de suite : l'élément passe dans la <strong>corbeille</strong> et reste récupérable <strong>30 jours</strong>. Juste après la suppression, un bandeau « Annuler la suppression » reste affiché 15 secondes. Passé ce délai, ouvrez le lien <strong>« Corbeille (n) »</strong> (visible dans la Saisie quand elle n'est pas vide) : cliquez <strong>« Restaurer »</strong>. Une classe se restaure avec les élèves supprimés en même temps qu'elle. Si une autre classe porte déjà le même nom, l'application propose de restaurer l'ancienne <strong>sous un autre nom</strong> (ex. « 3A (ancienne) »). Au bout de 30 jours, l'élément est effacé définitivement. Si un agent accompagnant ou un autre membre de l'équipe supprime un élève, un encadré orange « Supprimé par quelqu'un d'autre » vous le signale à l'ouverture de la Saisie : « Restaurer » ou « C'est voulu ».</li>
```
Ajouter, dans la section « Bonnes pratiques » de ce même fichier, un item :
```html
      <li><strong>Ne comptez pas sur la corbeille pour effacer des données :</strong> un élément supprimé reste lisible par les administrateurs pendant 30 jours. Pour une demande d'effacement immédiat (RGPD), contactez un administrateur PLAI, qui peut supprimer définitivement.</li>
```
(à placer à la fin de la liste `<ul>` de la section `<h2>Bonnes pratiques</h2>`).

- [ ] **Step 2 : Directions (complet) et accompagnants** — retrouver la section de saisie de chaque fichier (`grep -n "Supprimer\|Saisie\|Commentaire par élève" docs/modes-emploi/directions-complet.html docs/modes-emploi/accompagnants.html`).
  - `directions-complet.html` : ajouter le même item que pour les référents, à la suite de l'item « Commentaire par élève ».
  - `accompagnants.html` : ajouter, à la suite de l'item « Commentaire par élève », cet item (l'agent ne voit pas la corbeille) :
```html
      <li><strong>Supprimer un élève par erreur :</strong> juste après la suppression, un bandeau « Annuler la suppression » reste affiché 15 secondes : cliquez dessus pour le récupérer. Passé ce délai, prévenez le référent PLAI ou la direction : l'élève reste récupérable 30 jours depuis la corbeille, mais vous n'y avez pas accès.</li>
```

- [ ] **Step 3 : Copies publiques et vérification**

```bash
for f in referents-plai directions-complet accompagnants; do cp docs/modes-emploi/$f.html public/modes-emploi/$f.html; diff -q docs/modes-emploi/$f.html public/modes-emploi/$f.html && echo "$f identique"; done
```
Ouvrir un des fichiers dans le navigateur (aperçu) pour vérifier le rendu.

- [ ] **Step 4 : Commit**

```bash
git add docs/modes-emploi public/modes-emploi
git commit -m "docs(modes-emploi): corbeille (récupérer une suppression par erreur)"
```

---

### Task 10 : Déploiement phase A et vérification de l'ancien front (avant tout push)

Cette tâche se fait **avec l'accord de JF** (la migration touche la base partagée).

- [ ] **Step 1 : Rejouer les tests SQL sur la dernière version** (Task 1 Step 3 et Task 2 Step 3). Attendu : aucun KO.

- [ ] **Step 2 : Appliquer la migration A**

```bash
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f supabase/migrations/20261004_amenagactif_corbeille_a.sql 2>&1 | grep -v "^Initialising"
```
Puis les 4 vérifications en bas du fichier SQL (6 colonnes ; 3 index ; l'ancienne contrainte existe encore ; la tâche `ar_purge_corbeille` est planifiée).

- [ ] **Step 3 : Vérifier que le front DÉJÀ DÉPLOYÉ (`main` actuel) fonctionne toujours**

Dans le dossier principal (branche `main`, sans les changements de cette branche), lancer le front : `npm run dev -- --port 5175 --strictPort` (en gardant la même origine que la session de JF), puis, sur **École test** uniquement :
1. Saisie, année 2027-2028 (vide) : créer une classe « ZZ1 » (« + Nouvelle classe »). Attendu : créée, sans erreur.
2. Ajouter un élève fictif « Zed Z » ; le supprimer (une confirmation). Attendu : supprimé (suppression directe, ancien comportement).
3. Supprimer la classe « ZZ1 ». Attendu : supprimée.
Si l'un de ces gestes échoue : **arrêter**, ne pas déployer, analyser.

---

### Task 11 : Déploiement du front et de l'API, phase B, vérification de bout en bout

Avec l'accord de JF pour chaque push.

- [ ] **Step 1 : Fusion et vérification locale**

Mettre de côté les fichiers non suivis d'origine du dossier principal (ils entreraient en conflit avec les fichiers suivis de la branche) :
```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif
mkdir -p ../_corbeille_version_de_depart
mv supabase/migrations/20261004_amenagactif_corbeille.sql supabase/tests/corbeille.sql ../_corbeille_version_de_depart/ 2>/dev/null
git merge --ff-only feature/corbeille
npm test && npx vite build
```
Expected : tests PASS, build OK.

- [ ] **Step 2 : Parcours de l'application sur le front de la branche (École test, année 2027-2028)** — lancer le serveur sur le même port (voir `.claude/launch.json`, config `amenagactif-reprise` pointant sur le dossier voulu). Vérifier, **avec les critères de fluidité** (tableau en tête de plan) :

1. Créer une classe « ZZ1 », ajouter 2 élèves fictifs (« Zed Z », « Yan Y ») avec quelques AR : même nombre de clics qu'avant.
2. Supprimer « Zed Z » : **une** confirmation dont le texte parle de corbeille et de 30 jours (plus « irréversible »). Le bandeau « Annuler la suppression » apparaît ; cliquer « Annuler » : « Zed Z » est restauré avec ses AR.
3. Supprimer « Zed Z » à nouveau, ne pas annuler : le bandeau disparaît seul après 15 s ; la pastille « Corbeille (1) » apparaît dans la Saisie.
4. Page « Corbeille » : l'élément est listé (auteur, jours restants) ; « Restaurer » le rétablit.
5. Supprimer la classe « ZZ1 » : confirmation (nombre d'élèves, mention de la corbeille), bandeau « Annuler » ; laisser passer le délai ; page Corbeille : « Classe ZZ1 (n élèves) ».
6. **Phase B pas encore appliquée** : recréer « ZZ1 » pendant que l'ancienne est en corbeille → message clair « Une classe supprimée porte ce nom… ».
7. Un lien enseignant (généré **sur École test**, jamais sur une vraie classe) : pour la classe supprimée, la page du lien affiche « Cette fiche n'est plus disponible » (pas d'erreur 500) ; après restauration, le lien fonctionne de nouveau.
8. Comparer avec le comportement d'avant : aucun clic ni écran en plus, mêmes temps de réponse (ouvrir la grille d'une grande implantation ; pas de ralentissement perceptible).

- [ ] **Step 3 : Push (avec accord de JF)** : `git push origin main` (Vercel redéploie le front **et** l'API). Attendre la fin du déploiement, recharger l'application, rejouer rapidement les parcours 1 à 3 en production sur École test.

- [ ] **Step 4 : Appliquer la phase B (après le déploiement)**

```bash
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f supabase/migrations/20261005_amenagactif_corbeille_b.sql 2>&1 | grep -v "^Initialising"
```
Vérifier que `select count(*) from pg_constraint where conrelid = 'public.ar_classes'::regclass and contype = 'u'` renvoie 0. Rejouer en production, sur École test : supprimer « ZZ1 », la recréer (accepté), la restaurer (« nom déjà utilisé » → proposition « ZZ1 (ancienne) », acceptée).

- [ ] **Step 5 : Nettoyage des données de test** (École test seulement : classes « ZZ1 », « ZZ1 (ancienne) » et leurs élèves, y compris ce qui est en corbeille) puis vérification qu'il ne reste aucune donnée de test.

- [ ] **Step 6 : Prévenir les référents** (hors application) : « Une corbeille récupère les suppressions par erreur pendant 30 jours. Rechargez la page (Ctrl+F5) une fois pour profiter de la dernière version. »

---

### Task 12 : Revue finale et remise

- [ ] **Step 1 : Revue globale** — dispatcher `superpowers:requesting-code-review` sur `git diff main~N...HEAD` (toute la branche), pas seulement tâche par tâche. Points d'attention : droits de chaque fonction SQL (auteur, structure, admin), absence de fuite par les fonctions `security definer`, cohérence des noms (`supprime_le`, `supprime_par`, `lot_suppression`, `JOURS_CORBEILLE`), filtres serveur sur **tous** les chemins service role (`chargeurFiche`, `verifierAccesClasses`, `creerLien`, `fiche-token`), absence de `console.log`, texte ≥ 16 px, aucun changement du parcours validé.

- [ ] **Step 2 : Mémoire et suivi** — mettre à jour la mémoire du projet (état de la corbeille, décisions, ordre de déploiement) et signaler à JF que `supabase/tests/corbeille*.sql` sont des tests manuels annulés d'office, rejouables à tout moment (commande en Task 1 Step 3 et Task 2 Step 3).

---

## Auto-revue (couverture par rapport à la demande)

| Exigence | Où |
|---|---|
| Compenser une suppression maladroite d'un référent | Suppression logique + restauration (Tasks 1, 5, 6, 8) |
| Ne pas affecter la fluidité de l'app validée | Tableau des garde-fous, phase A additive, ancien front testé (Tasks 1, 10), aucun clic en plus (Tasks 7, 11) |
| Rétention 30 jours | `ar_corbeille_retention()`, purge `pg_cron`, `JOURS_CORBEILLE` |
| Bandeau « Annuler » | `SuppressionRecente` (Task 6), câblage (Task 7), auteur peut annuler (Task 1) |
| Restauration sous un autre nom | `ar_restaurer_classe(p_classe, p_nouveau_nom)` (Task 1), formulaire de la page (Task 8) |
| Prévenir le référent (A + B, sans e-mail) | `ZoneCorbeille` : pastille + encadré « supprimé par quelqu'un d'autre » (Task 6) |
| Création de classe non cassée | Ancienne contrainte conservée en phase A, `ar_assurer_classe` sans `ON CONFLICT`, phase B après le front (Tasks 1, 2, 10, 11) |
| Liens enseignants et export de profil ne montrent pas une suppression | Filtres serveur et message « fiche indisponible » (Task 4) |
| Deux phases | Migrations A et B, ordre imposé (Tasks 10, 11) |
| Accessibilité / guidage | Textes ≥ 16 px, labels et aides (formulaire de renommage), états en texte |
| Mode d'emploi HTML (règle PLAI) | Task 9 |

Points d'incertitude :
1. Le nombre exact de contrôles du test A (« 33/33 ») est indicatif ; l'important est l'absence de ligne KO.
2. Les tests d'API de la Task 4 supposent la même mécanique de `creerVia` / `connecte` / `mocks.verifier` que les tests voisins de `liensApi.test.js` ; ajuster à leurs conventions sans changer les assertions.
3. Les ancres d'insertion des modes d'emploi « directions » et « accompagnants » sont à retrouver par `grep` (seul celui des référents a été relu en détail).
4. L'effet des politiques RLS sur très gros volumes n'est pas mesuré (233 élèves en base aujourd'hui : négligeable).
