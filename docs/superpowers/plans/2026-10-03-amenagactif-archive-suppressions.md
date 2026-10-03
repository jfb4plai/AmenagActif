# AménagActif — Archivage à la suppression (filet de sécurité) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Garder automatiquement une copie complète de toute classe ou tout élève supprimé, pour pouvoir le **réactiver** (restaurer) dans les 30 jours, **sans rien changer au parcours validé par les référents**.

**Architecture :** Deux déclencheurs `BEFORE DELETE` (classes, élèves) copient ce qui va disparaître dans une table d'archive invisible pour tous les clients. La suppression reste une vraie suppression : aucun changement de RLS, de contrainte, de front ni de code serveur. La restauration est faite par l'administrateur (éditeur SQL de Supabase ou ligne de commande) avec une fonction qui réinsère les lignes archivées, avec leurs identifiants d'origine. Les déclencheurs sont « fail-open » : si l'archivage échoue, la suppression passe quand même.

**Tech Stack :** PostgreSQL (Supabase), pg_cron (déjà activée). Aucun changement React/Vite.

---

## Décisions (JF, 2026-10-03)

1. Remplace le plan « Corbeille » complet (abandonné après analyse coût-bénéfice) : la corbeille est jugée disproportionnée au risque.
2. Rétention **30 jours**, purge quotidienne (`pg_cron`).
3. **Restauration par l'administrateur** (pas de libre-service), via fonctions SQL. Une page « Archives » ou un bouton référent pourra s'y ajouter plus tard sans rien refaire.
4. **Fail-open** : l'archivage ne doit jamais bloquer une suppression.
5. Périmètre : classe (avec élèves, AR, libres, AU, modes de dispositif, rattachement des liens enseignants) et élève (avec AR et libres). Hors périmètre : modification/écrasement de texte, sauvegarde globale de la base, restauration du lien « élève repris » des successeurs, enseignants et snapshots (tables non utilisées, 0 ligne).

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261006_amenagactif_archive_suppressions.sql` (créer) | Table d'archive, déclencheurs, fonctions de recherche, restauration, purge, droits, planification |
| `supabase/tests/archive_suppressions.sql` (créer) | Test manuel annulé d'office |
| `docs/procedures/restaurer-une-suppression.md` (créer) | Procédure de l'administrateur : retrouver et réactiver |

## Garde-fous de fluidité

Aucun changement visible : mêmes clics, mêmes confirmations, même effet à l'écran. Le seul ajout est une insertion en base lors d'une suppression (rare, quelques lignes). Si l'archivage échoue, un avertissement est écrit dans les journaux Postgres et la suppression aboutit.

## Retour arrière

```sql
drop trigger if exists ar_archiver_classe on ar_classes;
drop trigger if exists ar_archiver_eleve on ar_eleves;
```
(l'archive peut rester ; `select cron.unschedule('ar_purge_archive');` pour arrêter la purge).

---

### Task 0 : Worktree

- [ ] **Step 1 :**

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif
git fetch origin
git worktree add .claude/worktrees/amenagactif-archive -b feature/archive-suppressions main
cd .claude/worktrees/amenagactif-archive
mkdir -p supabase/tests docs/procedures
```
Toutes les commandes suivantes s'exécutent dans ce worktree. Aucun `npm install` nécessaire (pas de code applicatif).

---

### Task 1 : Migration

**Files:** Create: `supabase/migrations/20261006_amenagactif_archive_suppressions.sql`

- [ ] **Step 1 : Écrire la migration (code exact)**

```sql
-- AménagActif — archivage à la suppression : filet de sécurité pour réactiver une classe ou un élève supprimé.
-- À exécuter à la main dans le SQL Editor (ou via la CLI). Idempotent. N'affecte AUCUN écran : la suppression reste
-- une vraie suppression ; une copie est conservée 30 jours dans ar_archive_suppressions.
--
--  * Invisible pour tous les clients (RLS activée sans politique + droits retirés). Lecture et restauration
--    uniquement par les fonctions ar_archive_* (service role / SQL Editor), jamais depuis l'application.
--  * Fail-open : si l'archivage échoue, un avertissement est journalisé et la suppression aboutit quand même.
--  * Cascade : supprimer une classe archive la classe ET ses élèves en UNE ligne ; les élèves supprimés en cascade
--    ne sont pas archivés une seconde fois (leur classe n'existe plus quand leur déclencheur s'exécute).
--  * Restauration : mêmes identifiants qu'à l'origine ; best-effort ligne par ligne (une ligne dont un parent a disparu
--    est ignorée et comptée dans le bilan) ; le champ cree_par n'est pas rétabli (simple trace d'audit).
--  * Nouvelle table préfixée ar_ ; aucun accès pour anon/authenticated (service_role seulement).

begin;

-- ── 1. Table d'archive ──
create table if not exists ar_archive_suppressions (
  id           uuid primary key default gen_random_uuid(),
  genre        text not null check (genre in ('classe', 'eleve')),
  element_id   uuid not null,
  ecole_id     uuid,                      -- pas de clé étrangère : l'école peut disparaître, l'archive reste
  annee_id     uuid,
  libelle      text not null,
  nb_eleves    integer,
  supprime_le  timestamptz not null default now(),
  supprime_par uuid,                      -- auth.uid(), null si suppression par le service role / SQL
  contenu      jsonb not null,
  restaure_le  timestamptz
);
create index if not exists ar_archive_supp_date_idx    on ar_archive_suppressions (supprime_le);
create index if not exists ar_archive_supp_element_idx on ar_archive_suppressions (element_id);

alter table ar_archive_suppressions enable row level security;   -- aucune politique : invisible pour les clients
revoke all on table ar_archive_suppressions from public, anon, authenticated;
grant select, insert, update, delete on table ar_archive_suppressions to service_role;

-- ── 2. Durée de rétention (une seule source de vérité) ──
create or replace function ar_archive_retention() returns integer
language sql immutable as $$ select 30 $$;

-- ── 3. Déclencheurs d'archivage ──
create or replace function ar_archiver_classe() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
begin
  begin
    select coalesce(array_agg(id), '{}') into v_ids from ar_eleves where classe_id = old.id;
    insert into ar_archive_suppressions (genre, element_id, ecole_id, annee_id, libelle, nb_eleves, supprime_par, contenu)
    values (
      'classe', old.id, old.ecole_id, old.annee_id, old.nom, coalesce(array_length(v_ids, 1), 0), auth.uid(),
      jsonb_build_object(
        'classe',      to_jsonb(old),
        'eleves',      (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from ar_eleves e where e.classe_id = old.id),
        'selections',  (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from ar_selections s where s.eleve_id = any(v_ids)),
        'libres',      (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from ar_amenagements_libres l where l.eleve_id = any(v_ids)),
        'au',          (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from ar_amenagements_classe a where a.classe_id = old.id),
        'dispositifs', (select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) from ar_classe_dispositifs d where d.classe_id = old.id),
        'liens',       (select coalesce(jsonb_agg(to_jsonb(lc)), '[]'::jsonb) from ar_liens_classes lc where lc.classe_id = old.id)
      )
    );
  exception when others then
    raise warning 'archivage de la classe % impossible : %', old.id, sqlerrm;   -- fail-open : la suppression continue
  end;
  return old;
end $$;

create or replace function ar_archiver_eleve() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ecole uuid;
  v_annee uuid;
begin
  begin
    select c.ecole_id, c.annee_id into v_ecole, v_annee from ar_classes c where c.id = old.classe_id;
    if not found then
      return old;   -- suppression en cascade d'une classe : déjà archivée avec la classe
    end if;
    insert into ar_archive_suppressions (genre, element_id, ecole_id, annee_id, libelle, nb_eleves, supprime_par, contenu)
    values (
      'eleve', old.id, v_ecole, v_annee, btrim(old.prenom || ' ' || old.initiale_nom), null, auth.uid(),
      jsonb_build_object(
        'eleve',      to_jsonb(old),
        'selections', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from ar_selections s where s.eleve_id = old.id),
        'libres',     (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from ar_amenagements_libres l where l.eleve_id = old.id)
      )
    );
  exception when others then
    raise warning 'archivage de l''élève % impossible : %', old.id, sqlerrm;   -- fail-open
  end;
  return old;
end $$;

drop trigger if exists ar_archiver_classe on ar_classes;
create trigger ar_archiver_classe before delete on ar_classes
  for each row execute function ar_archiver_classe();

drop trigger if exists ar_archiver_eleve on ar_eleves;
create trigger ar_archiver_eleve before delete on ar_eleves
  for each row execute function ar_archiver_eleve();

-- ── 4. Outils internes de restauration ──
-- Réinsère des lignes archivées (jsonb) dans une table autorisée, une par une. Une ligne dont un parent a disparu
-- (clé étrangère), en doublon ou refusée par un contrôle est ignorée et comptée. Les clés absentes de la table
-- (colonne supprimée depuis) sont ignorées ; les colonnes absentes du jsonb prennent leur valeur par défaut.
create or replace function ar_archive_reinserer(
  p_table text, p_lignes jsonb, p_sans text[] default '{}', out n_ok integer, out n_ignore integer
) language plpgsql set search_path = public as $$
declare
  v_ligne jsonb;
  v_cols  text;
begin
  n_ok := 0;
  n_ignore := 0;
  if p_table not in ('ar_classes', 'ar_eleves', 'ar_selections', 'ar_amenagements_libres',
                     'ar_amenagements_classe', 'ar_classe_dispositifs', 'ar_liens_classes') then
    raise exception 'table_non_autorisee' using errcode = 'P0001';
  end if;
  for v_ligne in select value from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_ligne := v_ligne - p_sans;
    select string_agg(quote_ident(k), ', ') into v_cols
    from jsonb_object_keys(v_ligne) as k
    where exists (select 1 from pg_attribute a
                  where a.attrelid = ('public.' || quote_ident(p_table))::regclass
                    and a.attname = k and a.attnum > 0 and not a.attisdropped);
    begin
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)',
                     p_table, v_cols, v_cols, p_table) using v_ligne;
      n_ok := n_ok + 1;
    exception when foreign_key_violation or unique_violation or check_violation or not_null_violation or raise_exception then
      n_ignore := n_ignore + 1;
    end;
  end loop;
end $$;

-- Rétablit, au mieux, le lien « élève repris de l'année précédente » (clé étrangère facultative).
create or replace function ar_archive_relier_precedents(p_eleves jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
begin
  for v in select value from jsonb_array_elements(coalesce(p_eleves, '[]'::jsonb)) loop
    continue when v ->> 'eleve_precedent_id' is null;
    begin
      update ar_eleves set eleve_precedent_id = (v ->> 'eleve_precedent_id')::uuid
       where id = (v ->> 'id')::uuid
         and exists (select 1 from ar_eleves p where p.id = (v ->> 'eleve_precedent_id')::uuid);
    exception when unique_violation then
      null;   -- cet élève a déjà un autre successeur : on laisse
    end;
  end loop;
end $$;

-- ── 5. Rechercher une suppression ──
create or replace function ar_archive_lister(p_texte text default null)
returns table (
  id uuid, genre text, libelle text, nb_eleves integer, ecole text, annee text,
  supprime_le timestamptz, supprime_par_nom text, jours_restants integer, restaure_le timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.genre, s.libelle, s.nb_eleves, coalesce(ec.implantation_nom, ec.nom), an.libelle,
         s.supprime_le, pa.nom,
         greatest(0, ceil(extract(epoch from (s.supprime_le + make_interval(days => ar_archive_retention()) - now())) / 86400))::integer,
         s.restaure_le
  from ar_archive_suppressions s
  left join ar_ecoles ec on ec.id = s.ecole_id
  left join ar_annees an on an.id = s.annee_id
  left join ar_profils_acces pa on pa.user_id = s.supprime_par
  where p_texte is null
     or s.libelle ilike '%' || p_texte || '%'
     or coalesce(ec.implantation_nom, ec.nom, '') ilike '%' || p_texte || '%'
  order by s.supprime_le desc;
$$;

-- ── 6. Réactiver (restaurer) ──
-- p_nouveau_nom : restaurer une classe sous un autre nom (si le nom d'origine est déjà pris).
-- p_classe_cible : restaurer un élève dans une autre classe que celle d'origine (si elle n'existe plus).
-- Renvoie un bilan jsonb : { genre, libelle, eleves, selections, libres, au, ignores }.
create or replace function ar_archive_restaurer(p_id uuid, p_nouveau_nom text default null, p_classe_cible uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a        ar_archive_suppressions%rowtype;
  c        jsonb;
  e        jsonb;
  v_nom    text;
  v_classe uuid;
  r        record;
  v_el     integer := 0;
  v_sel    integer := 0;
  v_lib    integer := 0;
  v_au     integer := 0;
  v_ign    integer := 0;
begin
  select * into a from ar_archive_suppressions where id = p_id for update;
  if not found then
    raise exception 'archive_introuvable' using errcode = 'P0002';
  end if;
  if a.restaure_le is not null then
    raise exception 'deja_restauree' using errcode = 'P0001';
  end if;

  if a.genre = 'classe' then
    c := a.contenu -> 'classe';
    if not exists (select 1 from ar_ecoles where id = (c ->> 'ecole_id')::uuid) then
      raise exception 'ecole_disparue' using errcode = 'P0001';
    end if;
    if not exists (select 1 from ar_annees where id = (c ->> 'annee_id')::uuid) then
      raise exception 'annee_disparue' using errcode = 'P0001';
    end if;
    if exists (select 1 from ar_classes where id = (c ->> 'id')::uuid) then
      raise exception 'deja_restauree' using errcode = 'P0001';
    end if;
    v_nom := coalesce(nullif(btrim(coalesce(p_nouveau_nom, '')), ''), c ->> 'nom');
    if exists (select 1 from ar_classes
               where ecole_id = (c ->> 'ecole_id')::uuid and annee_id = (c ->> 'annee_id')::uuid and nom = v_nom) then
      raise exception 'nom_deja_utilise' using errcode = 'P0001';
    end if;

    select * into r from ar_archive_reinserer('ar_classes', jsonb_build_array(jsonb_set(c, '{nom}', to_jsonb(v_nom))));
    if r.n_ok <> 1 then
      raise exception 'restauration_classe_impossible' using errcode = 'P0001';
    end if;
    select * into r from ar_archive_reinserer('ar_eleves', a.contenu -> 'eleves', array['eleve_precedent_id']);
    v_el := r.n_ok;  v_ign := v_ign + r.n_ignore;
    select * into r from ar_archive_reinserer('ar_selections', a.contenu -> 'selections', array['cree_par']);
    v_sel := r.n_ok; v_ign := v_ign + r.n_ignore;
    select * into r from ar_archive_reinserer('ar_amenagements_libres', a.contenu -> 'libres', array['cree_par']);
    v_lib := r.n_ok; v_ign := v_ign + r.n_ignore;
    select * into r from ar_archive_reinserer('ar_amenagements_classe', a.contenu -> 'au', array['cree_par']);
    v_au := r.n_ok;  v_ign := v_ign + r.n_ignore;
    select * into r from ar_archive_reinserer('ar_classe_dispositifs', a.contenu -> 'dispositifs');
    v_ign := v_ign + r.n_ignore;
    select * into r from ar_archive_reinserer('ar_liens_classes', a.contenu -> 'liens');
    v_ign := v_ign + r.n_ignore;
    perform ar_archive_relier_precedents(a.contenu -> 'eleves');
  else
    e := a.contenu -> 'eleve';
    v_classe := coalesce(p_classe_cible, (e ->> 'classe_id')::uuid);
    if not exists (select 1 from ar_classes where id = v_classe) then
      raise exception 'classe_introuvable' using errcode = 'P0002';
    end if;
    if exists (select 1 from ar_eleves where id = (e ->> 'id')::uuid) then
      raise exception 'deja_restauree' using errcode = 'P0001';
    end if;
    select * into r from ar_archive_reinserer('ar_eleves',
      jsonb_build_array(jsonb_set(e, '{classe_id}', to_jsonb(v_classe))), array['eleve_precedent_id']);
    if r.n_ok <> 1 then
      raise exception 'restauration_eleve_impossible' using errcode = 'P0001';
    end if;
    v_el := 1;
    select * into r from ar_archive_reinserer('ar_selections', a.contenu -> 'selections', array['cree_par']);
    v_sel := r.n_ok; v_ign := v_ign + r.n_ignore;
    select * into r from ar_archive_reinserer('ar_amenagements_libres', a.contenu -> 'libres', array['cree_par']);
    v_lib := r.n_ok; v_ign := v_ign + r.n_ignore;
    perform ar_archive_relier_precedents(jsonb_build_array(e));
  end if;

  update ar_archive_suppressions set restaure_le = now() where id = p_id;
  return jsonb_build_object('genre', a.genre, 'libelle', a.libelle, 'eleves', v_el, 'selections', v_sel,
                            'libres', v_lib, 'au', v_au, 'ignores', v_ign);
end $$;

-- ── 7. Purge ──
create or replace function ar_archive_purger() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v integer;
begin
  delete from ar_archive_suppressions where supprime_le < now() - make_interval(days => ar_archive_retention());
  get diagnostics v = row_count;
  return v;
end $$;

-- Effacement immédiat d'une ligne d'archive (ex. demande d'effacement RGPD).
create or replace function ar_archive_effacer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from ar_archive_suppressions where id = p_id;
  if not found then
    raise exception 'archive_introuvable' using errcode = 'P0002';
  end if;
end $$;

-- ── 8. Droits : aucun accès depuis l'application ──
revoke all on function ar_archive_retention()                                  from public, anon, authenticated;
revoke all on function ar_archiver_classe()                                    from public, anon, authenticated;
revoke all on function ar_archiver_eleve()                                     from public, anon, authenticated;
revoke all on function ar_archive_reinserer(text, jsonb, text[])               from public, anon, authenticated;
revoke all on function ar_archive_relier_precedents(jsonb)                     from public, anon, authenticated;
revoke all on function ar_archive_lister(text)                                 from public, anon, authenticated;
revoke all on function ar_archive_restaurer(uuid, text, uuid)                  from public, anon, authenticated;
revoke all on function ar_archive_purger()                                     from public, anon, authenticated;
revoke all on function ar_archive_effacer(uuid)                                from public, anon, authenticated;

grant execute on function ar_archive_lister(text)                              to service_role;
grant execute on function ar_archive_restaurer(uuid, text, uuid)               to service_role;
grant execute on function ar_archive_purger()                                  to service_role;
grant execute on function ar_archive_effacer(uuid)                             to service_role;

-- ── 9. Planification de la purge (pg_cron est activée sur le projet) ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ar_purge_archive', '30 3 * * *', 'select public.ar_archive_purger()');
  else
    raise notice 'pg_cron non activée : l''archive ne sera PAS purgée automatiquement.';
  end if;
exception when others then
  raise notice 'Planification pg_cron impossible : %', sqlerrm;
end $$;

commit;

-- Vérifications à jouer après exécution :
-- 1) Table (1 ligne) :       select tablename from pg_tables where tablename = 'ar_archive_suppressions';
-- 2) Déclencheurs (2 lignes) : select tgname from pg_trigger where tgname in ('ar_archiver_classe', 'ar_archiver_eleve');
-- 3) Droits (0 ligne) :        select grantee from information_schema.role_table_grants
--                              where table_name = 'ar_archive_suppressions' and grantee in ('anon', 'authenticated', 'PUBLIC');
-- 4) Planification (1 ligne) : select jobname, schedule from cron.job where jobname = 'ar_purge_archive';
```

- [ ] **Step 2 : Commit** (après le test de la Task 2, pour ne livrer que du code validé).

---

### Task 2 : Test annulé d'office

**Files:** Create: `supabase/tests/archive_suppressions.sql`

- [ ] **Step 1 : Écrire le test (code exact)**

```sql
-- Test manuel (NON exécuté automatiquement) de l'archivage à la suppression (migration 20261006).
-- Tout est annulé : le script se termine par une EXCEPTION volontaire dont le message est le bilan.
-- Attendu : « BILAN : N/N contrôles OK ». Voir « Commande de test » dans le plan.

create table zz_res (n serial, step text, ok boolean, info text);
grant all on zz_res to authenticated;
grant usage, select on sequence zz_res_n_seq to authenticated;

create function zz_check(p_step text, p_ok boolean, p_info text default '') returns void
language sql as $$ insert into zz_res (step, ok, info) values (p_step, coalesce(p_ok, false), p_info) $$;

-- Exécute p_sql sous le rôle courant et exige une erreur dont le message correspond à p_motif (LIKE).
create function zz_erreur(p_step text, p_sql text, p_motif text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into zz_res (step, ok, info) values (p_step, false, 'aucune erreur levée');
exception when others then
  insert into zz_res (step, ok, info) values (p_step, sqlerrm like p_motif, sqlstate || ' ' || sqlerrm);
end $$;

-- ── Données de départ (superutilisateur) ──
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'dir-archive@example.invalid'),
  ('00000000-0000-0000-0000-0000000000a9', 'agent-archive@example.invalid');
insert into ar_ecoles (id, nom) values
  ('11111111-1111-1111-1111-111111111111', 'Ecole test 1'),
  ('22222222-2222-2222-2222-222222222222', 'Ecole test 2');
insert into ar_annees (id, libelle, active) values ('aaaaaaaa-0000-0000-0000-000000000001', '2098-2099', false);
insert into ar_profils_acces (user_id, role, ecole_id, nom) values
  ('00000000-0000-0000-0000-0000000000d1', 'direction',  '11111111-1111-1111-1111-111111111111', 'Direction Test'),
  ('00000000-0000-0000-0000-0000000000a9', 'agent_plai', '11111111-1111-1111-1111-111111111111', 'Agent Test');

insert into ar_chapitres (id, ordre, titre, est_dispositif) values
  ('00000000-0000-0000-0000-000000000c01', 9998, 'Chapitre test', false),
  ('00000000-0000-0000-0000-000000000c02', 9997, 'Dispositif test', true);
insert into ar_amenagements (id, chapitre_id, ordre, libelle, type) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000c01', 1, 'Amenagement test', 'AR');

insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c0', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '2B'),
  ('00000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000c0', 'Zoe', 'P', 'PAR');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut, eleve_precedent_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Ana', 'T', 'PAR', '00000000-0000-0000-0000-0000000000f0');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', 'Bob', 'T', 'IPT');
insert into ar_selections (eleve_id, amenagement_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000a01');
insert into ar_amenagements_libres (eleve_id, chapitre_id, texte) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000c01', 'libre de test');
insert into ar_amenagements_classe (classe_id, amenagement_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000a01');
insert into ar_classe_dispositifs (classe_id, chapitre_id, pour_toute_la_classe) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c02', true);
insert into ar_liens (id, token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le) values
  ('00000000-0000-0000-0000-00000000001a', 'zz-hash-archive', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Destinataire test', '00000000-0000-0000-0000-0000000000d1', '2099-12-31');
insert into ar_liens_classes (lien_id, classe_id) values
  ('00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-0000000000c1');

-- ══ 1. Suppression d'un élève (rôle direction, comme dans l'application) ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1';
reset role;

select zz_check('élève : suppression inchangée (vraiment supprimé)',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = 0);
select zz_check('élève : une ligne d''archive',
  (select count(*) from ar_archive_suppressions where genre = 'eleve' and element_id = '00000000-0000-0000-0000-0000000000f1') = 1);
select zz_check('élève : l''archive contient sa sélection et son libre',
  (select jsonb_array_length(contenu -> 'selections') = 1 and jsonb_array_length(contenu -> 'libres') = 1
     from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));
select zz_check('élève : auteur = la direction, libellé lisible',
  (select supprime_par = '00000000-0000-0000-0000-0000000000d1'::uuid and libelle = 'Ana T'
     from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));

-- ══ 2. Réactivation de l'élève ══
select ar_archive_restaurer((select id from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));
select zz_check('élève restauré : même identifiant, même classe',
  (select classe_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-0000000000c1');
select zz_check('élève restauré : sélection, libre et lien « élève précédent » rétablis',
  (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_amenagements_libres where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select eleve_precedent_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-0000000000f0');
select zz_check('élève : archive marquée « restaurée »',
  (select restaure_le is not null from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));
select zz_erreur('élève : restaurer deux fois refusé',
  $q$ select ar_archive_restaurer((select id from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1')) $q$,
  'deja_restauree');

-- ══ 3. Suppression d'une classe (cascade : élèves, AR, libres, AU, dispositif, lien) ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_classes where id = '00000000-0000-0000-0000-0000000000c1';
reset role;

select zz_check('classe : suppression inchangée (classe et élèves supprimés)',
  (select count(*) from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = 0
  and (select count(*) from ar_eleves where classe_id = '00000000-0000-0000-0000-0000000000c1') = 0);
select zz_check('classe : une ligne d''archive avec 2 élèves',
  (select count(*) from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select nb_eleves from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1') = 2);
select zz_check('classe : contenu complet (élèves, sélection, libre, AU, dispositif, lien)',
  (select jsonb_array_length(contenu -> 'eleves') = 2 and jsonb_array_length(contenu -> 'selections') = 1
      and jsonb_array_length(contenu -> 'libres') = 1 and jsonb_array_length(contenu -> 'au') = 1
      and jsonb_array_length(contenu -> 'dispositifs') = 1 and jsonb_array_length(contenu -> 'liens') = 1
     from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1'));
select zz_check('classe : les élèves de la cascade ne sont pas archivés une seconde fois',
  (select count(*) from ar_archive_suppressions where genre = 'eleve') = 1);   -- seulement l'élève supprimé seul à l'étape 1

-- ══ 4. Réactivation de la classe ══
select ar_archive_restaurer((select id from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1'));
select zz_check('classe restaurée : même identifiant, 2 élèves',
  (select count(*) from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select count(*) from ar_eleves where classe_id = '00000000-0000-0000-0000-0000000000c1') = 2);
select zz_check('classe restaurée : sélection, libre, AU, dispositif et lien rétablis',
  (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_amenagements_libres where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_amenagements_classe where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select count(*) from ar_classe_dispositifs where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select count(*) from ar_liens_classes where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1);
select zz_check('classe restaurée : lien « élève précédent » rétabli',
  (select eleve_precedent_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-0000000000f0');

-- ══ 5. Nom déjà pris : restauration sous un autre nom ══
delete from ar_classes where id = '00000000-0000-0000-0000-0000000000c1';
insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c3', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A');
select zz_erreur('nom pris : restauration refusée avec un message clair',
  $q$ select ar_archive_restaurer((select id from ar_archive_suppressions
        where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1' and restaure_le is null)) $q$,
  'nom_deja_utilise');
select ar_archive_restaurer((select id from ar_archive_suppressions
  where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1' and restaure_le is null), '3A (ancienne)');
select zz_check('restaurée sous un autre nom, avec ses 2 élèves',
  (select nom from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = '3A (ancienne)'
  and (select count(*) from ar_eleves where classe_id = '00000000-0000-0000-0000-0000000000c1') = 2);

-- ══ 6. Élève restauré dans une autre classe (la sienne n'existe plus) ══
delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2';
select ar_archive_restaurer((select id from ar_archive_suppressions
  where genre = 'eleve' and element_id = '00000000-0000-0000-0000-0000000000f2' and restaure_le is null),
  null, '00000000-0000-0000-0000-0000000000c3');
select zz_check('élève restauré dans la classe cible choisie',
  (select classe_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2') = '00000000-0000-0000-0000-0000000000c3');

-- ══ 7. École supprimée : l'archive subsiste, la restauration est refusée proprement ══
insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c9', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'X1');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000c9', 'Xavier', 'X', 'PAR');
delete from ar_ecoles where id = '22222222-2222-2222-2222-222222222222';
select zz_check('école supprimée : la classe est archivée (une ligne) sans doublon pour ses élèves',
  (select count(*) from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c9') = 1
  and (select count(*) from ar_archive_suppressions where genre = 'eleve' and libelle = 'Xavier X') = 0);
select zz_erreur('école supprimée : restauration refusée',
  $q$ select ar_archive_restaurer((select id from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c9')) $q$,
  'ecole_disparue');

-- ══ 8. Fail-open : si l'archivage échoue, la suppression aboutit quand même ══
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3', 'Cal', 'C', 'PAR');
alter table ar_archive_suppressions add constraint zz_bloque check (false) not valid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f3';
reset role;
select zz_check('fail-open : la suppression aboutit même si l''archivage échoue',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f3') = 0
  and (select count(*) from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f3') = 0);
alter table ar_archive_suppressions drop constraint zz_bloque;

-- ══ 9. Aucun accès depuis l'application ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select zz_erreur('direction : table d''archive inaccessible', $q$ select count(*) from ar_archive_suppressions $q$, '%permission denied%');
select zz_erreur('direction : ar_archive_lister inaccessible', $q$ select * from ar_archive_lister() $q$, '%permission denied%');
select zz_erreur('direction : ar_archive_restaurer inaccessible', $q$ select ar_archive_restaurer(gen_random_uuid()) $q$, '%permission denied%');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select zz_erreur('agent : table d''archive inaccessible', $q$ select count(*) from ar_archive_suppressions $q$, '%permission denied%');
select zz_erreur('agent : ar_archive_effacer inaccessible', $q$ select ar_archive_effacer(gen_random_uuid()) $q$, '%permission denied%');
reset role;

-- ══ 10. Recherche et purge ══
select zz_check('lister : filtre par texte',
  (select count(*) from ar_archive_lister('3A')) >= 1 and (select count(*) from ar_archive_lister('zzz-inexistant')) = 0);
select zz_check('lister : sans filtre, plusieurs lignes avec auteur lisible',
  (select count(*) from ar_archive_lister()) >= 3
  and (select count(*) from ar_archive_lister() where supprime_par_nom = 'Direction Test') >= 1);
update ar_archive_suppressions set supprime_le = now() - interval '31 days'
 where genre = 'eleve' and element_id = '00000000-0000-0000-0000-0000000000f1';
select zz_check('purge : supprime seulement ce qui dépasse 30 jours', ar_archive_purger() = 1);
select zz_check('purge : le reste est conservé',
  (select count(*) from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000c1') >= 1);
select ar_archive_effacer((select id from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c9'));
select zz_check('effacer : une ligne d''archive peut être effacée immédiatement',
  (select count(*) from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000c9') = 0);

-- ══ BILAN (annule tout) ══
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

- [ ] **Step 2 : Lancer le test (migration + test dans une transaction annulée, rien n'est appliqué)**

La migration et le test sont concaténés (sans leurs `begin;` / `commit;`) en une seule transaction implicite que l'exception finale annule.

```bash
T="$(mktemp -d)"
{ grep -v -E '^(begin|commit);$' supabase/migrations/20261006_amenagactif_archive_suppressions.sql
  cat supabase/tests/archive_suppressions.sql; } > "$T/a.sql"
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f "$T/a.sql" 2>&1 | grep -v "^Initialising"
```
Expected : message d'erreur `P0001: BILAN : N/N contrôles OK` avec **aucune ligne « KO »** (une trentaine de contrôles). Toute ligne KO est détaillée. Si un contrôle échoue : corriger la **migration** (ou le test s'il est faux), relancer, jusqu'à zéro KO.

- [ ] **Step 3 : Vérifier que la base n'a pas bougé**

```bash
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json "select (select count(*) from pg_tables where tablename like 'ar_archive%' or tablename like 'zz_%')::int tables, (select count(*) from pg_proc where proname like 'ar_archiv%' or proname like 'zz_%')::int fonctions, (select count(*) from pg_trigger where tgname in ('ar_archiver_classe','ar_archiver_eleve'))::int declencheurs, (select count(*) from ar_ecoles where nom like 'Ecole test %')::int ecoles_test, (select count(*) from auth.users where email like '%archive@example.invalid')::int users_test" 2>&1 | grep -A8 '"rows"'
```
Expected : tous les compteurs à `0`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20261006_amenagactif_archive_suppressions.sql supabase/tests/archive_suppressions.sql
git commit -m "feat(archive): archivage à la suppression des classes et élèves, avec restauration par l'administrateur"
```

---

### Task 3 : Procédure de l'administrateur

**Files:** Create: `docs/procedures/restaurer-une-suppression.md`

- [ ] **Step 1 : Écrire la procédure**

````markdown
# Réactiver une classe ou un élève supprimé par erreur

Quand un référent signale « j'ai supprimé la classe 5LA » (ou un élève) : tout est conservé **30 jours** dans une archive, invisible dans l'application. Seul l'administrateur peut le réactiver, dans l'éditeur SQL de Supabase (projet partagé, base « RetroActif ») ou en ligne de commande.

## 1. Retrouver la suppression

```sql
select * from ar_archive_lister('5LA');   -- un mot du nom de la classe, de l'élève ou de l'implantation
select * from ar_archive_lister();        -- toutes les suppressions récentes
```
Colonnes utiles : `id` (à recopier), `genre` (classe ou élève), `libelle`, `nb_eleves`, `ecole`, `annee`, `supprime_le`, `supprime_par_nom`, `jours_restants`, `restaure_le` (renseigné si déjà réactivé).

## 2. Réactiver

```sql
select ar_archive_restaurer('<id>');
```
Le résultat est un bilan (`eleves`, `selections`, `libres`, `au`, `ignores`). `ignores` doit valoir 0 ; sinon, des lignes n'ont pas pu être rétablies parce que leur parent n'existe plus (aménagement retiré du catalogue, par exemple).

Le référent recharge la page (Ctrl+F5) : la classe, ses élèves, leurs aménagements, ses AU, ses dispositifs et le rattachement de ses **liens enseignants** sont revenus, avec les mêmes identifiants.

## 3. Cas particuliers

| Message | Cause | Solution |
|---|---|---|
| `nom_deja_utilise` | une classe porte déjà ce nom (recréée entre-temps) | `select ar_archive_restaurer('<id>', '5LA (ancienne)');` |
| `classe_introuvable` (élève) | la classe de l'élève n'existe plus | `select ar_archive_restaurer('<id>', null, '<id de la classe d''accueil>');` |
| `ecole_disparue` / `annee_disparue` | l'école ou l'année a été supprimée | restauration impossible : recréer d'abord l'école ou l'année avec le même identifiant, ou contacter le développeur |
| `deja_restauree` | cet élément a déjà été réactivé | rien à faire |
| `archive_introuvable` | identifiant erroné, ou archive purgée (plus de 30 jours) | relancer la recherche |

## 4. Ce qui n'est pas rétabli
- Le lien « élève repris de l'année précédente » des **successeurs** (les élèves de l'année suivante repris depuis un élève supprimé) : refaire une reprise si nécessaire.
- Les modifications de texte (commentaires écrasés, noms de référents), qui ne sont pas des suppressions.
- Au-delà de 30 jours, l'archive est purgée automatiquement (chaque nuit à 03 h 30).

## 5. Effacement immédiat (demande RGPD)
```sql
select ar_archive_effacer('<id>');   -- supprime la ligne d'archive tout de suite
```
Penser à vérifier qu'il n'existe pas d'autre ligne d'archive pour la même personne (recherche par prénom).

## Limites
Cet archivage n'est **pas une sauvegarde** de la base : il ne protège que des suppressions de classes et d'élèves faites depuis l'application.
````

- [ ] **Step 2 : Commit**

```bash
git add docs/procedures/restaurer-une-suppression.md
git commit -m "docs(archive): procédure de l'administrateur pour réactiver une suppression"
```

---

### Task 4 : Application sur la base partagée et vérification (avec l'accord de JF)

- [ ] **Step 1 : Rejouer le test de la Task 2** (aucun KO). **Demander l'accord de JF** avant d'appliquer à la base partagée.

- [ ] **Step 2 : Appliquer**

```bash
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f supabase/migrations/20261006_amenagactif_archive_suppressions.sql 2>&1 | grep -v "^Initialising"
```
Puis jouer les 4 vérifications en bas du fichier SQL (table ; 2 déclencheurs ; aucun droit pour `anon`/`authenticated` ; tâche `ar_purge_archive` planifiée).

- [ ] **Step 3 : Essai réel minimal, sur École test uniquement** (via la CLI, avec le rôle de l'administrateur simulé ou directement) : créer une classe fictive « ZZ1 » avec un élève dans l'École test, la supprimer, vérifier `ar_archive_lister('ZZ1')`, la réactiver (`ar_archive_restaurer`), vérifier qu'elle est revenue, puis la supprimer à nouveau et effacer sa ligne d'archive (`ar_archive_effacer`). Aucune donnée réelle n'est touchée.

- [ ] **Step 4 : Vérifier que la suppression côté application est inchangée** (parcours à faire dans l'application, École test, année vide : supprimer un élève et une classe fictifs : une confirmation, même comportement qu'avant).

- [ ] **Step 5 : Fusion et push** (après accord de JF) : `git merge --ff-only feature/archive-suppressions` dans le dossier principal puis `git push origin main`. Aucun redéploiement applicatif n'est nécessaire (pas de code applicatif modifié) ; le push versionne la migration, le test et la procédure.

---

### Task 5 : Revue finale

- [ ] **Step 1 :** dispatcher une revue globale (`superpowers:requesting-code-review`) sur la branche. Points d'attention : droits (aucun accès `anon`/`authenticated` à la table et aux fonctions), fail-open réel, absence de double archivage en cascade, fiabilité de la restauration (identifiants, ordre des insertions, lignes ignorées comptées), aucun effet sur les parcours existants.

- [ ] **Step 2 :** mettre à jour la mémoire du projet (état, procédure, limites).

---

## Auto-revue

| Exigence | Où |
|---|---|
| Réactiver une classe ou un élève supprimé | `ar_archive_restaurer`, procédure (Tasks 1, 3) |
| Aucun effet sur la fluidité | Déclencheurs fail-open, aucun changement de front/RLS/API (Task 1, test 8) |
| Rétention 30 jours | `ar_archive_retention`, purge `pg_cron` (Task 1) |
| Restauration par l'administrateur | Fonctions réservées au service role, droits retirés aux clients (Task 1, test 9) |
| Nom déjà pris | `p_nouveau_nom` (Task 1, test 5) |
| Cascade sans doublon | Déclencheur élève conditionné à l'existence de la classe (Task 1, test 3) |
| Test sans rien appliquer | Transaction annulée d'office (Task 2) |

Points d'incertitude :
1. La détection de la cascade (« la classe n'existe plus quand le déclencheur élève s'exécute ») est vérifiée par le test 3 ; si elle échoue, utiliser `pg_trigger_depth() > 1` en complément.
2. `session_user` de la ligne de commande peut ne pas pouvoir appeler les fonctions réservées au `service_role` : si la Task 4 Step 3 échoue par un refus de droit, jouer les appels dans l'éditeur SQL de Supabase (propriétaire `postgres`).
3. Les colonnes ajoutées plus tard avec `NOT NULL` sans valeur par défaut empêcheraient la réinsertion d'anciennes archives (rétention de 30 jours : risque faible).
