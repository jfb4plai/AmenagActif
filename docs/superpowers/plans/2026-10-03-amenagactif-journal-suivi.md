# AménagActif — Journal des modifications et suivi des enseignants (piste 1+) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Pouvoir répondre, pour chaque enseignant qui a un lien : *a-t-il ouvert sa fiche, quand, combien de fois, et la fiche a-t-elle changé depuis sa dernière visite (quoi, qui, quand) ?* — **sans rien changer à l'application ni à l'accès des enseignants**.

**Architecture :** SQL seulement. (1) Un **journal** `ar_journal` alimenté par des déclencheurs « fail-open » sur les tables qui composent une fiche (cases AR et AU, aménagements libres, modes de dispositif, élèves, classes). (2) Un **journal des ouvertures** `ar_lien_ouvertures` alimenté par la fonction `ar_lien_compter_ouverture`, que le code serveur appelle déjà (aucune modification de l'API, aucun redéploiement). (3) Des **fonctions de lecture** réservées à l'administrateur (éditeur SQL / ligne de commande) : `ar_suivi_enseignants`, `ar_ouvertures_lien`, `ar_journal_classe`. (4) Une **purge quotidienne** : les lignes d'une année scolaire sont effacées dès le 1er septembre suivant (fin d'année au 31 août, comme les liens).

**Tech Stack :** PostgreSQL (Supabase), `pg_cron` (déjà activée). Aucun changement React/Vite ni `/api/*`.

---

## Décisions (JF, 2026-10-03)

1. **Piste 1+** (journal des modifications + ouvertures horodatées), pas de stockage du contenu complet des fiches (piste 2 écartée : elle exigerait de modifier et redéployer l'API des enseignants).
2. **But : simple diagnostic** de la collaboration avec chaque enseignant, pas une preuve opposable.
3. **Rétention : l'année scolaire, jusqu'au 31/08**, puis purge automatique.
4. Le journal garde des **libellés courts** (libellé de l'aménagement, « Prénom I. », nom de classe) pour rester lisible après une suppression : même niveau de données que l'application, purgées avec elle.
5. Lecture **réservée à l'administrateur** pour l'instant (aucun accès depuis l'application) ; un écran pourra être ajouté plus tard sur ces mêmes fonctions.

## Ce que ça permet, et ses limites

| Question | Réponse |
|---|---|
| Quels enseignants n'ont jamais ouvert leur lien ? | oui (`ar_suivi_enseignants`, statut « jamais_ouvert ») |
| Combien de fois et quand a-t-il ouvert ? | oui, **une ligne par ouverture, au plus une par heure et par lien** (limite déjà en place pour le compteur) |
| La fiche a-t-elle changé depuis sa dernière visite ? Combien de modifications ? | oui (statut « modifie_depuis_la_visite », nombre et date de la dernière) |
| Qu'est-ce qui a changé, qui, quand ? | oui (`ar_journal_classe`) |
| Que contenait exactement la fiche à une ouverture passée ? | **non**, pas directement : il faut rejouer le journal (la piste 2 le ferait) |
| Ce qui s'est passé **avant** l'installation | **non** : seulement ce qui est journalisé à partir de l'application de la migration |

Limites : une classe supprimée journalise sa suppression (la classe, ses élèves) ; les lignes supprimées en cascade peuvent ne pas être rattachées à leur classe (le contenu reste dans l'archive de 30 jours). Les copies de sauvegarde (copies internes, exports) contiennent ces tables jusqu'à 30 jours de plus après la purge : à noter dans la procédure.

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261007_amenagactif_journal_suivi.sql` (créer) | Tables, déclencheurs, fonction d'ouverture, fonctions de lecture, purge, droits, planification |
| `supabase/tests/journal_suivi.sql` (créer) | Test manuel annulé d'office |
| `docs/procedures/suivi-collaboration-enseignants.md` (créer) | Procédure de l'administrateur |

## Garde-fous

- **Aucun changement visible**, ni pour les référents ni pour les enseignants ; le chemin public des liens n'est pas modifié (la fonction SQL existante enregistre simplement une ligne de plus).
- **Fail-open** : si l'écriture dans le journal échoue, la modification ou l'ouverture aboutit quand même (un avertissement est journalisé par Postgres).
- Nouvelles tables préfixées `ar_` ; RLS activée sans politique et droits retirés à `anon`/`authenticated` (accès `service_role` seulement).

## Retour arrière

```sql
drop trigger if exists ar_journal_selections on ar_selections;
drop trigger if exists ar_journal_au on ar_amenagements_classe;
drop trigger if exists ar_journal_libres on ar_amenagements_libres;
drop trigger if exists ar_journal_dispositifs on ar_classe_dispositifs;
drop trigger if exists ar_journal_eleves on ar_eleves;
drop trigger if exists ar_journal_classes on ar_classes;
select cron.unschedule('ar_journal_purge');
```
(Pour revenir à la fonction d'ouverture d'origine, rejouer la définition de `ar_lien_compter_ouverture` de `20260924d_amenagactif_liens.sql`.)

---

### Task 0 : Worktree

- [ ] **Step 1 :**

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif
git fetch origin
git worktree add .claude/worktrees/amenagactif-journal -b feature/journal-suivi main
cd .claude/worktrees/amenagactif-journal
mkdir -p supabase/tests docs/procedures
grep -rn "ar_journal\|ar_lien_ouvertures" supabase/migrations | head -3
```
Expected : aucune ligne (pas de conflit de noms de tables). Toutes les commandes suivantes s'exécutent dans ce worktree. Aucun `npm install` nécessaire (pas de code applicatif).

---

### Task 1 : Migration

**Files:** Create: `supabase/migrations/20261007_amenagactif_journal_suivi.sql`

- [ ] **Step 1 : Écrire la migration (code exact)**

```sql
-- AménagActif — journal des modifications (fiches) et journal des ouvertures de liens enseignants.
-- À exécuter à la main (SQL Editor ou CLI). Idempotent. N'affecte AUCUN écran ni l'accès des enseignants.
--  * ar_journal : une ligne par modification qui change ce que contient une fiche (cases AR et AU, aménagements libres,
--    modes de dispositif, élèves, classes). Rempli par des déclencheurs FAIL-OPEN : une erreur de journalisation n'empêche jamais la modification.
--  * ar_lien_ouvertures : une ligne par ouverture d'un lien enseignant (au plus une par heure et par lien, comme le compteur existant),
--    écrite par ar_lien_compter_ouverture (déjà appelée par le code serveur : aucun redéploiement).
--  * Lecture : fonctions réservées à l'administrateur (service_role / SQL Editor). Aucun accès depuis l'application.
--  * Rétention : l'année scolaire ; purge quotidienne dès le 1er septembre suivant (fin d'année = 31 août).
--  * Nouvelles tables préfixées ar_ ; RLS activée sans politique, droits retirés aux clients.

begin;

-- ── 1. Tables ──
create table if not exists ar_journal (
  id        bigint generated always as identity primary key,
  quand     timestamptz not null default now(),
  par       uuid,               -- auth.uid() ; null si le service role ou le SQL Editor a agi
  ecole_id  uuid,               -- pas de clés étrangères : le journal survit à la suppression des lignes qu'il décrit
  annee_id  uuid,
  classe_id uuid,
  eleve_id  uuid,
  objet     text not null check (objet in ('case_ar', 'case_au', 'libre', 'dispositif', 'eleve', 'classe')),
  action    text not null check (action in ('ajout', 'retrait', 'modification')),
  libelle   text,               -- libellé de l'aménagement, « Prénom I. », nom de classe… (court)
  detail    jsonb               -- champs modifiés : { "champ": [avant, après] } (tronqués à 300 caractères)
);
create index if not exists ar_journal_classe_idx on ar_journal (classe_id, quand);
create index if not exists ar_journal_eleve_idx  on ar_journal (eleve_id, quand);
create index if not exists ar_journal_annee_idx  on ar_journal (annee_id);

create table if not exists ar_lien_ouvertures (
  id        bigint generated always as identity primary key,
  lien_id   uuid not null references ar_liens(id) on delete cascade,
  ouvert_le timestamptz not null default now()
);
create index if not exists ar_lien_ouvertures_idx on ar_lien_ouvertures (lien_id, ouvert_le);

alter table ar_journal         enable row level security;   -- aucune politique : invisible pour les clients
alter table ar_lien_ouvertures enable row level security;
revoke all on table ar_journal, ar_lien_ouvertures from public, anon, authenticated;
grant select, insert, update, delete on table ar_journal, ar_lien_ouvertures to service_role;

-- ── 2. Outils internes ──
-- { "champ": [avant, après] } pour les seules colonnes de p_cols qui ont changé ; null si rien n'a changé.
create or replace function ar_journal_diff(p_old jsonb, p_new jsonb, p_cols text[]) returns jsonb
language sql immutable as $$
  select nullif(
    coalesce(jsonb_object_agg(t.col, jsonb_build_array(left(p_old ->> t.col, 300), left(p_new ->> t.col, 300)))
             filter (where (p_old -> t.col) is distinct from (p_new -> t.col)), '{}'::jsonb),
    '{}'::jsonb)
  from unnest(p_cols) as t(col)
$$;

-- Fin de l'année scolaire « AAAA-BBBB » : 31 août BBBB. Null si l'année est inconnue ou mal formée.
create or replace function ar_fin_annee(p_annee uuid) returns date
language sql stable as $$
  select case when a.libelle ~ '^\d{4}-\d{4}$' then make_date(split_part(a.libelle, '-', 2)::integer, 8, 31) end
  from ar_annees a where a.id = p_annee
$$;

-- ── 3. Déclencheur de journalisation (un seul, pour toutes les tables) ──
create or replace function ar_journaliser() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r        jsonb;
  v_objet  text;
  v_action text := case tg_op when 'INSERT' then 'ajout' when 'DELETE' then 'retrait' else 'modification' end;
  v_libelle text;
  v_detail jsonb;
  v_classe uuid;
  v_eleve  uuid;
  v_ecole  uuid;
  v_annee  uuid;
begin
  begin
    if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;

    case tg_table_name
      when 'ar_selections' then
        v_objet := 'case_ar';
        v_eleve := (r ->> 'eleve_id')::uuid;
        select a.libelle into v_libelle from ar_amenagements a where a.id = (r ->> 'amenagement_id')::uuid;
      when 'ar_amenagements_classe' then
        v_objet := 'case_au';
        v_classe := (r ->> 'classe_id')::uuid;
        select a.libelle into v_libelle from ar_amenagements a where a.id = (r ->> 'amenagement_id')::uuid;
      when 'ar_amenagements_libres' then
        v_objet := 'libre';
        v_eleve := (r ->> 'eleve_id')::uuid;
        v_libelle := left(r ->> 'texte', 120);
        if tg_op = 'UPDATE' then
          v_detail := ar_journal_diff(to_jsonb(old), to_jsonb(new), array['texte', 'chapitre_id']);
          if v_detail is null then return new; end if;
        end if;
      when 'ar_classe_dispositifs' then
        v_objet := 'dispositif';
        v_classe := (r ->> 'classe_id')::uuid;
        select c.titre into v_libelle from ar_chapitres c where c.id = (r ->> 'chapitre_id')::uuid;
        if tg_op = 'UPDATE' then
          v_detail := ar_journal_diff(to_jsonb(old), to_jsonb(new), array['pour_toute_la_classe']);
          if v_detail is null then return new; end if;
        else
          v_detail := jsonb_build_object('pour_toute_la_classe', r -> 'pour_toute_la_classe');
        end if;
      when 'ar_eleves' then
        v_objet := 'eleve';
        v_eleve := (r ->> 'id')::uuid;
        v_classe := (r ->> 'classe_id')::uuid;
        v_libelle := btrim((r ->> 'prenom') || ' ' || coalesce(r ->> 'initiale_nom', ''));
        if tg_op = 'UPDATE' then
          v_detail := ar_journal_diff(to_jsonb(old), to_jsonb(new), array['prenom', 'initiale_nom', 'statut', 'commentaire', 'classe_id']);
          if v_detail is null then return new; end if;
        end if;
      when 'ar_classes' then
        v_objet := 'classe';
        v_classe := (r ->> 'id')::uuid;
        v_libelle := r ->> 'nom';
        if tg_op = 'UPDATE' then
          v_detail := ar_journal_diff(to_jsonb(old), to_jsonb(new), array['nom', 'niveau', 'referent_plai_nom', 'commentaire']);
          if v_detail is null then return new; end if;
        end if;
    end case;

    -- Rattachement : classe (via l'élève au besoin), puis école et année.
    if v_classe is null and v_eleve is not null then
      select e.classe_id into v_classe from ar_eleves e where e.id = v_eleve;
    end if;
    if v_classe is not null then
      select c.ecole_id, c.annee_id into v_ecole, v_annee from ar_classes c where c.id = v_classe;
    end if;
    insert into ar_journal (par, ecole_id, annee_id, classe_id, eleve_id, objet, action, libelle, detail)
    values (auth.uid(), v_ecole, v_annee, v_classe, v_eleve, v_objet, v_action, v_libelle, v_detail);

    -- Un élève qui change de classe est aussi une modification pour la classe qu'il quitte (sa fiche change).
    if tg_table_name = 'ar_eleves' and tg_op = 'UPDATE' and old.classe_id is distinct from new.classe_id then
      select c.ecole_id, c.annee_id into v_ecole, v_annee from ar_classes c where c.id = old.classe_id;
      insert into ar_journal (par, ecole_id, annee_id, classe_id, eleve_id, objet, action, libelle, detail)
      values (auth.uid(), v_ecole, v_annee, old.classe_id, v_eleve, v_objet, v_action, v_libelle, v_detail);
    end if;
  exception when others then
    raise warning 'journalisation impossible (% sur %) : %', tg_op, tg_table_name, sqlerrm;   -- fail-open
  end;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists ar_journal_selections on ar_selections;
create trigger ar_journal_selections after insert or delete on ar_selections
  for each row execute function ar_journaliser();

drop trigger if exists ar_journal_au on ar_amenagements_classe;
create trigger ar_journal_au after insert or delete on ar_amenagements_classe
  for each row execute function ar_journaliser();

drop trigger if exists ar_journal_libres on ar_amenagements_libres;
create trigger ar_journal_libres after insert or delete or update of texte, chapitre_id on ar_amenagements_libres
  for each row execute function ar_journaliser();

drop trigger if exists ar_journal_dispositifs on ar_classe_dispositifs;
create trigger ar_journal_dispositifs after insert or delete or update of pour_toute_la_classe on ar_classe_dispositifs
  for each row execute function ar_journaliser();

drop trigger if exists ar_journal_eleves on ar_eleves;
create trigger ar_journal_eleves after insert or delete or update of prenom, initiale_nom, statut, commentaire, classe_id on ar_eleves
  for each row execute function ar_journaliser();

drop trigger if exists ar_journal_classes on ar_classes;
create trigger ar_journal_classes after insert or delete or update of nom, niveau, referent_plai_nom, commentaire on ar_classes
  for each row execute function ar_journaliser();

-- ── 4. Journal des ouvertures : la fonction existante écrit aussi une ligne (au plus une par heure et par lien) ──
create or replace function ar_lien_compter_ouverture(p_id uuid) returns boolean
language plpgsql set search_path = public as $$
declare
  v_compte boolean;
begin
  with u as (
    update ar_liens
       set derniere_ouverture = now(), nb_ouvertures = nb_ouvertures + 1
     where id = p_id
       and revoque_le is null
       and (derniere_ouverture is null or derniere_ouverture < now() - interval '1 hour')
    returning 1
  )
  select exists (select 1 from u) into v_compte;
  if v_compte then
    begin
      insert into ar_lien_ouvertures (lien_id) values (p_id);
    exception when others then
      raise warning 'journal des ouvertures impossible : %', sqlerrm;   -- fail-open : l'ouverture n'est jamais empêchée
    end;
  end if;
  return v_compte;
end $$;

-- ── 5. Lecture (administrateur seulement : service_role / SQL Editor) ──
-- Une ligne par lien : ouvertures, dernière visite, modifications depuis cette visite, statut.
create or replace function ar_suivi_enseignants(p_ecole uuid default null)
returns table (
  lien_id uuid, ecole text, destinataire text, classes text, cree_le timestamptz, expire_le date,
  ouvertures bigint, premiere_ouverture timestamptz, derniere_ouverture timestamptz,
  modifications_depuis_derniere_ouverture bigint, derniere_modification timestamptz, statut text
)
language sql stable security definer set search_path = public as $$
  select l.id, coalesce(ec.implantation_nom, ec.nom), l.destinataire,
         (select string_agg(c.nom, ', ' order by c.nom) from ar_liens_classes lc join ar_classes c on c.id = lc.classe_id where lc.lien_id = l.id),
         l.cree_le, l.expire_le,
         (select count(*) from ar_lien_ouvertures o where o.lien_id = l.id),
         (select min(o.ouvert_le) from ar_lien_ouvertures o where o.lien_id = l.id),
         l.derniere_ouverture,
         m.n, m.derniere,
         case when l.revoque_le is not null then 'revoque'
              when l.derniere_ouverture is null then 'jamais_ouvert'
              when m.n = 0 then 'a_jour'
              else 'modifie_depuis_la_visite' end
  from ar_liens l
  join ar_ecoles ec on ec.id = l.ecole_id
  cross join lateral (
    select count(*) filter (where j.quand > coalesce(l.derniere_ouverture, l.cree_le)) as n, max(j.quand) as derniere
    from ar_journal j
    where j.classe_id in (select lc.classe_id from ar_liens_classes lc where lc.lien_id = l.id)
  ) m
  where p_ecole is null or l.ecole_id = p_ecole
  order by coalesce(ec.implantation_nom, ec.nom), l.destinataire;
$$;

-- Les ouvertures d'un lien, avec le nombre de modifications « nouvelles » à chaque ouverture
-- (depuis l'ouverture précédente, ou depuis la création du lien pour la première).
create or replace function ar_ouvertures_lien(p_lien uuid)
returns table (ouvert_le timestamptz, modifications_depuis_precedente bigint)
language sql stable security definer set search_path = public as $$
  with o as (
    select x.ouvert_le,
           coalesce(lag(x.ouvert_le) over (order by x.ouvert_le), (select l.cree_le from ar_liens l where l.id = p_lien)) as precedente
    from ar_lien_ouvertures x where x.lien_id = p_lien
  )
  select o.ouvert_le,
         (select count(*) from ar_journal j
           where j.classe_id in (select lc.classe_id from ar_liens_classes lc where lc.lien_id = p_lien)
             and j.quand > o.precedente and j.quand <= o.ouvert_le)
  from o order by o.ouvert_le;
$$;

-- Les modifications d'une classe (plus récentes d'abord), éventuellement sur une période.
create or replace function ar_journal_classe(p_classe uuid, p_depuis timestamptz default null, p_jusqua timestamptz default null)
returns table (quand timestamptz, par_nom text, objet text, action text, libelle text, eleve text, detail jsonb)
language sql stable security definer set search_path = public as $$
  select j.quand, pa.nom, j.objet, j.action, j.libelle, btrim(e.prenom || ' ' || e.initiale_nom), j.detail
  from ar_journal j
  left join ar_profils_acces pa on pa.user_id = j.par
  left join ar_eleves e on e.id = j.eleve_id
  where j.classe_id = p_classe
    and (p_depuis is null or j.quand >= p_depuis)
    and (p_jusqua is null or j.quand <= p_jusqua)
  order by j.quand desc, j.id desc;
$$;

-- ── 6. Purge : tout ce qui concerne une année scolaire terminée (dès le 1er septembre) ──
-- Lignes sans année connue : conservées 400 jours.
create or replace function ar_journal_purger() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v1 integer;
  v2 integer;
begin
  delete from ar_journal
   where coalesce(ar_fin_annee(annee_id), (quand + interval '400 days')::date) < current_date;
  get diagnostics v1 = row_count;
  delete from ar_lien_ouvertures o using ar_liens l
   where l.id = o.lien_id
     and coalesce(ar_fin_annee(l.annee_id), (o.ouvert_le + interval '400 days')::date) < current_date;
  get diagnostics v2 = row_count;
  return v1 + v2;
end $$;

-- ── 7. Droits : aucun accès depuis l'application ──
revoke all on function ar_journal_diff(jsonb, jsonb, text[])                     from public, anon, authenticated;
revoke all on function ar_fin_annee(uuid)                                        from public, anon, authenticated;
revoke all on function ar_journaliser()                                          from public, anon, authenticated;
revoke all on function ar_suivi_enseignants(uuid)                                from public, anon, authenticated;
revoke all on function ar_ouvertures_lien(uuid)                                  from public, anon, authenticated;
revoke all on function ar_journal_classe(uuid, timestamptz, timestamptz)         from public, anon, authenticated;
revoke all on function ar_journal_purger()                                       from public, anon, authenticated;
grant execute on function ar_suivi_enseignants(uuid)                             to service_role;
grant execute on function ar_ouvertures_lien(uuid)                               to service_role;
grant execute on function ar_journal_classe(uuid, timestamptz, timestamptz)      to service_role;
grant execute on function ar_journal_purger()                                    to service_role;
-- ar_lien_compter_ouverture : create or replace conserve ses droits (service_role seulement).

-- ── 8. Planification de la purge (pg_cron est activée sur le projet) ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ar_journal_purge', '40 3 * * *', 'select public.ar_journal_purger()');
  else
    raise notice 'pg_cron non activée : le journal ne sera PAS purgé automatiquement.';
  end if;
exception when others then
  raise notice 'Planification pg_cron impossible : %', sqlerrm;
end $$;

commit;

-- Vérifications à jouer après exécution :
-- 1) Tables (2 lignes) :       select tablename from pg_tables where tablename in ('ar_journal', 'ar_lien_ouvertures');
-- 2) Déclencheurs (6 lignes) : select tgname from pg_trigger where tgname like 'ar\_journal\_%';
-- 3) Droits clients (0 ligne) : select grantee, table_name from information_schema.role_table_grants
--                               where table_name in ('ar_journal', 'ar_lien_ouvertures') and grantee in ('anon', 'authenticated', 'PUBLIC');
-- 4) Planification (1 ligne) : select jobname, schedule from cron.job where jobname = 'ar_journal_purge';
-- 5) Lecture :                 select * from ar_suivi_enseignants();
```

---

### Task 2 : Test annulé d'office

**Files:** Create: `supabase/tests/journal_suivi.sql`

- [ ] **Step 1 : Écrire le test (code exact)**

```sql
-- Test manuel (NON exécuté automatiquement) du journal et du suivi des enseignants (migration 20261007).
-- Tout est annulé : le script se termine par une EXCEPTION volontaire dont le message est le bilan.
-- Attendu : « BILAN : N/N contrôles OK ». Voir « Commande de test » dans le plan.

create table zz_res (n serial, step text, ok boolean, info text);
grant all on zz_res to authenticated, anon;
grant usage, select on sequence zz_res_n_seq to authenticated, anon;

create function zz_check(p_step text, p_ok boolean, p_info text default '') returns void
language sql as $$ insert into zz_res (step, ok, info) values (p_step, coalesce(p_ok, false), p_info) $$;

create function zz_erreur(p_step text, p_sql text, p_motif text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into zz_res (step, ok, info) values (p_step, false, 'aucune erreur levée');
exception when others then
  insert into zz_res (step, ok, info) values (p_step, sqlerrm like p_motif, sqlstate || ' ' || sqlerrm);
end $$;

-- ── Données de départ (superutilisateur) ──
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'dir-journal@example.invalid');
insert into ar_ecoles (id, nom) values ('11111111-1111-1111-1111-111111111111', 'Ecole test 1');
insert into ar_annees (id, libelle, active) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '2098-2099', false),
  ('aaaaaaaa-0000-0000-0000-000000000000', '2020-2021', false);
insert into ar_profils_acces (user_id, role, ecole_id, nom) values
  ('00000000-0000-0000-0000-0000000000d1', 'direction', '11111111-1111-1111-1111-111111111111', 'Direction Test');
insert into ar_chapitres (id, ordre, titre, est_dispositif) values
  ('00000000-0000-0000-0000-000000000c01', 9998, 'Chapitre test', false),
  ('00000000-0000-0000-0000-000000000c02', 9997, 'Dispositif test', true);
insert into ar_amenagements (id, chapitre_id, ordre, libelle, type) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000c01', 1, 'Amenagement test', 'AR');
insert into ar_classes (id, ecole_id, annee_id, nom, niveau) values
  ('00000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A', '3e'),
  ('00000000-0000-0000-0000-0000000000c2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3B', '3e');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Ana', 'T', 'PAR');
delete from ar_journal;   -- on repart d'un journal vide (les insertions de départ ont été journalisées)

-- ══ 1. Cases AR ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ar_selections (eleve_id, amenagement_id) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000a01');
reset role;
select zz_check('case AR ajoutée : une ligne complète (objet, libellé, rattachement, auteur)',
  (select count(*) from ar_journal where objet = 'case_ar' and action = 'ajout' and libelle = 'Amenagement test'
     and eleve_id = '00000000-0000-0000-0000-0000000000f1' and classe_id = '00000000-0000-0000-0000-0000000000c1'
     and annee_id = 'aaaaaaaa-0000-0000-0000-000000000001' and ecole_id = '11111111-1111-1111-1111-111111111111'
     and par = '00000000-0000-0000-0000-0000000000d1') = 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
update ar_selections set a_confirmer = true where eleve_id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select zz_check('confirmer une case (a_confirmer) ne change pas la fiche : pas de ligne', (select count(*) from ar_journal) = 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1';
reset role;
select zz_check('case AR retirée : ligne « retrait »',
  (select count(*) from ar_journal where objet = 'case_ar' and action = 'retrait' and libelle = 'Amenagement test') = 1);

-- ══ 2. Cases AU, aménagements libres, dispositifs ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ar_amenagements_classe (classe_id, amenagement_id) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000a01');
delete from ar_amenagements_classe where classe_id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select zz_check('AU ajouté puis retiré : 2 lignes rattachées à la classe',
  (select count(*) from ar_journal where objet = 'case_au' and classe_id = '00000000-0000-0000-0000-0000000000c1') = 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ar_amenagements_libres (id, eleve_id, chapitre_id, texte) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000c01', 'texte avant');
update ar_amenagements_libres set texte = 'texte après' where id = '00000000-0000-0000-0000-00000000b001';
update ar_amenagements_libres set texte = 'texte après' where id = '00000000-0000-0000-0000-00000000b001';   -- sans changement
delete from ar_amenagements_libres where id = '00000000-0000-0000-0000-00000000b001';
reset role;
select zz_check('libre : ajout, une seule modification (avant/après), retrait',
  (select count(*) from ar_journal where objet = 'libre') = 3
  and (select detail -> 'texte' ->> 0 from ar_journal where objet = 'libre' and action = 'modification') = 'texte avant'
  and (select detail -> 'texte' ->> 1 from ar_journal where objet = 'libre' and action = 'modification') = 'texte après');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ar_classe_dispositifs (classe_id, chapitre_id, pour_toute_la_classe) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c02', true);
update ar_classe_dispositifs set pour_toute_la_classe = false where classe_id = '00000000-0000-0000-0000-0000000000c1';
delete from ar_classe_dispositifs where classe_id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select zz_check('dispositif : ajout, passage AU → AR, retrait (libellé = titre du dispositif)',
  (select count(*) from ar_journal where objet = 'dispositif' and libelle = 'Dispositif test') = 3
  and (select detail -> 'pour_toute_la_classe' ->> 1 from ar_journal where objet = 'dispositif' and action = 'modification') = 'false');

-- ══ 3. Élèves et classes ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', 'Bob', 'T', 'IPT');
update ar_eleves set commentaire = 'nouveau commentaire' where id = '00000000-0000-0000-0000-0000000000f2';
update ar_eleves set devenir = 'termine' where id = '00000000-0000-0000-0000-0000000000f2';   -- sans effet sur la fiche
reset role;
select zz_check('élève : ajout et modification du commentaire journalisés, devenir ignoré',
  (select count(*) from ar_journal where objet = 'eleve' and libelle = 'Bob T') = 2
  and (select detail -> 'commentaire' ->> 1 from ar_journal where objet = 'eleve' and action = 'modification') = 'nouveau commentaire');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
update ar_eleves set classe_id = '00000000-0000-0000-0000-0000000000c2' where id = '00000000-0000-0000-0000-0000000000f2';
reset role;
select zz_check('changement de classe : une ligne pour la classe d''arrivée ET une pour la classe quittée',
  (select count(*) from ar_journal where objet = 'eleve' and detail ? 'classe_id' and classe_id = '00000000-0000-0000-0000-0000000000c2') = 1
  and (select count(*) from ar_journal where objet = 'eleve' and detail ? 'classe_id' and classe_id = '00000000-0000-0000-0000-0000000000c1') = 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
update ar_classes set niveau = '4e', commentaire_modifie_le = now() where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select zz_check('classe : changement de niveau journalisé (avant/après)',
  (select detail -> 'niveau' ->> 0 from ar_journal where objet = 'classe' and action = 'modification') = '3e'
  and (select detail -> 'niveau' ->> 1 from ar_journal where objet = 'classe' and action = 'modification') = '4e');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_classes where id = '00000000-0000-0000-0000-0000000000c2';   -- cascade : élève Bob
reset role;
select zz_check('suppression d''une classe (cascade) : aucune erreur, la suppression est journalisée',
  (select count(*) from ar_journal where objet = 'classe' and action = 'retrait' and libelle = '3B') = 1
  and (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2') = 0);

-- ══ 4. Fail-open : si le journal est inutilisable, les modifications aboutissent ══
alter table ar_journal add constraint zz_bloque check (false) not valid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
insert into ar_selections (eleve_id, amenagement_id) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000a01');
reset role;
select zz_check('fail-open : la modification aboutit même si le journal échoue',
  (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1);
alter table ar_journal drop constraint zz_bloque;

-- ══ 5. Aucun accès depuis l'application ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select zz_erreur('authenticated : ar_journal inaccessible', $q$ select * from ar_journal $q$, '%permission denied%');
select zz_erreur('authenticated : ar_lien_ouvertures inaccessible', $q$ select * from ar_lien_ouvertures $q$, '%permission denied%');
select zz_erreur('authenticated : ar_suivi_enseignants interdit', $q$ select * from ar_suivi_enseignants() $q$, '%permission denied%');
select zz_erreur('authenticated : ar_journal_classe interdit', $q$ select * from ar_journal_classe(gen_random_uuid()) $q$, '%permission denied%');
reset role;
set local role anon;
select zz_erreur('anon : ar_journal inaccessible', $q$ select * from ar_journal $q$, '%permission denied%');
select zz_erreur('anon : ar_journal_purger interdit', $q$ select ar_journal_purger() $q$, '%permission denied%');
reset role;

-- ══ 6. Journal des ouvertures (fonction existante étendue) ══
insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c3', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '4A'),
  ('00000000-0000-0000-0000-0000000000c4', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '4B');
insert into ar_liens (id, token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le, cree_le) values
  ('00000000-0000-0000-0000-00000000001a', 'zz-hash-1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Enseignant 1', '00000000-0000-0000-0000-0000000000d1', '2099-08-31', now() - interval '10 days'),
  ('00000000-0000-0000-0000-00000000001b', 'zz-hash-2', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Enseignant revoque', '00000000-0000-0000-0000-0000000000d1', '2099-08-31', now() - interval '10 days'),
  ('00000000-0000-0000-0000-00000000001c', 'zz-hash-3', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Enseignant 3', '00000000-0000-0000-0000-0000000000d1', '2099-08-31', now() - interval '10 days'),
  ('00000000-0000-0000-0000-00000000001d', 'zz-hash-4', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Enseignant jamais', '00000000-0000-0000-0000-0000000000d1', '2099-08-31', now() - interval '10 days');
update ar_liens set revoque_le = now() where id = '00000000-0000-0000-0000-00000000001b';
insert into ar_liens_classes (lien_id, classe_id) values
  ('00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-0000000000c3'),
  ('00000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-0000000000c4');

select zz_check('ouverture : la première est comptée et journalisée',
  ar_lien_compter_ouverture('00000000-0000-0000-0000-00000000001a') = true
  and (select count(*) from ar_lien_ouvertures where lien_id = '00000000-0000-0000-0000-00000000001a') = 1);
select zz_check('ouverture : une seconde dans l''heure n''est ni comptée ni journalisée',
  ar_lien_compter_ouverture('00000000-0000-0000-0000-00000000001a') = false
  and (select count(*) from ar_lien_ouvertures where lien_id = '00000000-0000-0000-0000-00000000001a') = 1);
update ar_liens set derniere_ouverture = now() - interval '2 hours' where id = '00000000-0000-0000-0000-00000000001a';
select zz_check('ouverture : deux heures plus tard, une nouvelle ligne',
  ar_lien_compter_ouverture('00000000-0000-0000-0000-00000000001a') = true
  and (select count(*) from ar_lien_ouvertures where lien_id = '00000000-0000-0000-0000-00000000001a') = 2);
select zz_check('ouverture : un lien révoqué n''est ni compté ni journalisé',
  ar_lien_compter_ouverture('00000000-0000-0000-0000-00000000001b') = false
  and (select count(*) from ar_lien_ouvertures where lien_id = '00000000-0000-0000-0000-00000000001b') = 0);

alter table ar_lien_ouvertures add constraint zz_bloque2 check (false) not valid;
update ar_liens set derniere_ouverture = now() - interval '2 hours' where id = '00000000-0000-0000-0000-00000000001a';
select zz_check('fail-open : l''ouverture est comptée même si le journal des ouvertures échoue',
  ar_lien_compter_ouverture('00000000-0000-0000-0000-00000000001a') = true);
alter table ar_lien_ouvertures drop constraint zz_bloque2;

-- ══ 7. Suivi des enseignants (dates maîtrisées) ══
delete from ar_journal;
delete from ar_lien_ouvertures;
insert into ar_lien_ouvertures (lien_id, ouvert_le) values
  ('00000000-0000-0000-0000-00000000001a', now() - interval '5 days'),
  ('00000000-0000-0000-0000-00000000001a', now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000001c', now() - interval '1 day');
update ar_liens set derniere_ouverture = now() - interval '1 day' where id in ('00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-00000000001c');
insert into ar_journal (quand, classe_id, annee_id, ecole_id, objet, action, libelle) values
  (now() - interval '6 days',  '00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'case_ar', 'ajout', 'avant la 1re visite'),
  (now() - interval '6 days',  '00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'case_ar', 'ajout', 'avant la 1re visite (bis)'),
  (now() - interval '3 days',  '00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'case_ar', 'retrait', 'entre les deux visites'),
  (now() - interval '12 hours','00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'case_au', 'ajout', 'après la dernière visite'),
  (now() - interval '2 hours', '00000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'libre', 'ajout', 'après la dernière visite (bis)'),
  (now() - interval '2 days',  '00000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'case_ar', 'ajout', 'classe 4A, avant sa visite');

select zz_check('suivi : lien modifié depuis la visite (2 ouvertures, 2 modifications depuis la dernière)',
  (select ouvertures = 2 and modifications_depuis_derniere_ouverture = 2 and statut = 'modifie_depuis_la_visite' and classes = '3A'
     from ar_suivi_enseignants() where lien_id = '00000000-0000-0000-0000-00000000001a'));
select zz_check('suivi : lien à jour (aucune modification depuis la visite)',
  (select statut = 'a_jour' and modifications_depuis_derniere_ouverture = 0 from ar_suivi_enseignants() where lien_id = '00000000-0000-0000-0000-00000000001c'));
select zz_check('suivi : lien jamais ouvert',
  (select statut = 'jamais_ouvert' and ouvertures = 0 from ar_suivi_enseignants() where lien_id = '00000000-0000-0000-0000-00000000001d'));
select zz_check('suivi : lien révoqué',
  (select statut = 'revoque' from ar_suivi_enseignants() where lien_id = '00000000-0000-0000-0000-00000000001b'));
select zz_check('suivi : filtre par école',
  (select count(*) from ar_suivi_enseignants('11111111-1111-1111-1111-111111111111')) = 4
  and (select count(*) from ar_suivi_enseignants(gen_random_uuid())) = 0);
select zz_check('ouvertures du lien : modifications nouvelles à chaque ouverture (2 puis 1)',
  (select array_agg(modifications_depuis_precedente order by ouvert_le) from ar_ouvertures_lien('00000000-0000-0000-0000-00000000001a')) = array[2, 1]::bigint[]);
select zz_check('journal d''une classe : plus récent d''abord, avec filtre de période',
  (select count(*) from ar_journal_classe('00000000-0000-0000-0000-0000000000c1')) = 5
  and (select libelle from ar_journal_classe('00000000-0000-0000-0000-0000000000c1') limit 1) = 'après la dernière visite (bis)'
  and (select count(*) from ar_journal_classe('00000000-0000-0000-0000-0000000000c1', now() - interval '1 day')) = 2);

-- ══ 8. Fin d'année et purge ══
insert into ar_annees (id, libelle, active) values ('aaaaaaaa-0000-0000-0000-0000000000ff', 'abc', false);
select zz_check('fin d''année : 31 août de la seconde année, null si mal formée ou inconnue',
  ar_fin_annee('aaaaaaaa-0000-0000-0000-000000000000') = date '2021-08-31'
  and ar_fin_annee('aaaaaaaa-0000-0000-0000-000000000001') = date '2099-08-31'
  and ar_fin_annee('aaaaaaaa-0000-0000-0000-0000000000ff') is null
  and ar_fin_annee(null) is null);
delete from ar_journal;
insert into ar_journal (quand, annee_id, objet, action, libelle) values
  (now() - interval '1 day',   'aaaaaaaa-0000-0000-0000-000000000000', 'case_ar', 'ajout', 'année terminée : à purger'),
  (now() - interval '1 day',   'aaaaaaaa-0000-0000-0000-000000000001', 'case_ar', 'ajout', 'année en cours : conservée'),
  (now() - interval '500 days', null,                                  'case_ar', 'ajout', 'sans année, 500 jours : à purger'),
  (now() - interval '10 days',  null,                                  'case_ar', 'ajout', 'sans année, 10 jours : conservée');
insert into ar_liens (id, token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le) values
  ('00000000-0000-0000-0000-00000000002a', 'zz-hash-vieux', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000000', 'Lien d''une année terminée', '00000000-0000-0000-0000-0000000000d1', '2021-08-31');
insert into ar_lien_ouvertures (lien_id, ouvert_le) values ('00000000-0000-0000-0000-00000000002a', now() - interval '3 days');
select zz_check('purge : année terminée (journal et ouvertures) et lignes sans année très anciennes', ar_journal_purger() = 3);
select zz_check('purge : le reste est conservé',
  (select count(*) from ar_journal) = 2
  and (select count(*) from ar_journal where libelle like '%conservée') = 2
  and (select count(*) from ar_lien_ouvertures where lien_id = '00000000-0000-0000-0000-00000000001a') = 2);

-- ══ 9. Planification ══
select zz_check('planification : la purge quotidienne est programmée', exists (select 1 from cron.job where jobname = 'ar_journal_purge'));

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

```bash
T="$(mktemp -d)"
{ grep -v -E '^(begin|commit);$' supabase/migrations/20261007_amenagactif_journal_suivi.sql
  cat supabase/tests/journal_suivi.sql; } > "$T/j.sql"
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f "$T/j.sql" 2>&1 | grep -v "^Initialising"
```
Expected : `P0001: BILAN : N/N contrôles OK` (une trentaine), **aucune ligne KO**. Si un contrôle échoue : diagnostiquer la cause, corriger la **migration** (ou le test s'il est faux), relancer jusqu'à zéro KO. Points à surveiller : l'ordre d'évaluation dans `zz_check(… and …)` quand l'expression appelle `ar_lien_compter_ouverture` (si un contrôle est instable, séparer l'appel et la vérification en deux instructions) ; le comportement du déclencheur lors d'une suppression en cascade.

- [ ] **Step 3 : Contrôler la sensibilité du test** (au moins un sabotage) : retirer temporairement le déclencheur `ar_journal_selections` dans une copie du script, relancer, et vérifier que le test **échoue** (sinon il ne protège rien).

- [ ] **Step 4 : Vérifier que la base n'a pas bougé**

```bash
npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json "select (select count(*) from pg_tables where tablename in ('ar_journal','ar_lien_ouvertures') or tablename like 'zz\_%')::int tables, (select count(*) from pg_trigger where tgname like 'ar\_journal\_%')::int declencheurs, (select count(*) from cron.job where jobname = 'ar_journal_purge')::int cron, (select pg_get_functiondef('ar_lien_compter_ouverture'::regproc) like '%ar_lien_ouvertures%') fonction_deja_modifiee, (select count(*) from ar_annees where libelle in ('2098-2099','2020-2021','abc'))::int annees_test" 2>&1 | grep -A8 '"rows"'
```
Expected : `tables 0`, `declencheurs 0`, `cron 0`, `fonction_deja_modifiee false`, `annees_test 0`.

- [ ] **Step 5 : Commit** — `git add supabase/migrations/20261007_amenagactif_journal_suivi.sql supabase/tests/journal_suivi.sql && git commit -m "feat(journal): journal des modifications et des ouvertures de liens, suivi des enseignants"`.

---

### Task 3 : Procédure de l'administrateur

**Files:** Create: `docs/procedures/suivi-collaboration-enseignants.md`

- [ ] **Step 1 : Écrire la procédure (contenu exact)**

````markdown
# Suivre la collaboration avec chaque enseignant

AménagActif enregistre, à partir de la mise en service du journal : (1) chaque modification qui change le contenu d'une fiche ; (2) chaque ouverture d'un lien enseignant (au plus une par heure et par lien). Rien n'est visible dans l'application : la lecture se fait dans l'éditeur SQL de Supabase (projet partagé, base « RetroActif »), ou par la ligne de commande.

## 1. Où en est chaque enseignant ?

```sql
select * from ar_suivi_enseignants();                              -- tous les liens
select * from ar_suivi_enseignants('<id de l''implantation>');     -- une implantation
```
Colonnes : `destinataire` (le repère saisi à la création du lien), `classes`, `ouvertures`, `premiere_ouverture`, `derniere_ouverture`, `modifications_depuis_derniere_ouverture`, `derniere_modification`, `statut`.

| Statut | Signification | Action possible |
|---|---|---|
| `jamais_ouvert` | le lien n'a jamais été consulté | relancer l'enseignant, vérifier qu'il a bien reçu le lien |
| `a_jour` | rien n'a changé depuis sa dernière visite | rien |
| `modifie_depuis_la_visite` | la fiche a changé depuis sa dernière visite | l'informer des changements (voir ci-dessous) |
| `revoque` | le lien a été coupé | rien |

## 2. Quand a-t-il consulté, et que découvrait-il ?

```sql
select * from ar_ouvertures_lien('<lien_id>');
-- une ligne par ouverture, avec le nombre de modifications « nouvelles » à ce moment-là
```

## 3. Qu'est-ce qui a changé ?

```sql
select * from ar_journal_classe('<id de la classe>');                                  -- tout, le plus récent d'abord
select * from ar_journal_classe('<id de la classe>', now() - interval '14 days');      -- les 14 derniers jours
```
Colonnes : `quand`, `par_nom` (qui), `objet` (`case_ar`, `case_au`, `libre`, `dispositif`, `eleve`, `classe`), `action` (`ajout`, `retrait`, `modification`), `libelle` (aménagement, « Prénom I. », classe), `eleve`, `detail` (`{ "champ": [avant, après] }`).

Pour retrouver l'identifiant d'une classe : `select id, nom from ar_classes where nom ilike '%5LA%';`

## Limites à connaître
- **Seul ce qui a eu lieu après la mise en service est journalisé.**
- Les ouvertures sont comptées **au plus une par heure et par lien**.
- Le journal dit **ce qui a changé et quand**, pas **ce que l'enseignant a réellement vu** à une date passée (il faudrait rejouer le journal).
- Une classe supprimée est journalisée (la classe et ses élèves) ; le détail de son contenu est dans l'archive de 30 jours (`ar_archive_lister`).
- Les lignes d'une année scolaire sont **effacées dès le 1er septembre** qui suit (fin d'année au 31 août). Les copies de sauvegarde (copies internes, exports) peuvent conserver ces lignes jusqu'à 30 jours de plus.
- Finalité : **diagnostic de la collaboration**, pas une preuve opposable.
````

- [ ] **Step 2 : Commit** — `git add docs/procedures/suivi-collaboration-enseignants.md && git commit -m "docs(journal): procédure de suivi de la collaboration avec les enseignants"`.

---

### Task 4 : Application sur la base partagée et essai réel (avec l'accord de JF)

- [ ] **Step 1 :** rejouer le test de la Task 2 (zéro KO). **Demander l'accord de JF** avant d'appliquer.

- [ ] **Step 2 : Appliquer** : `npx supabase db query --linked --project-ref dfoaumjleqtxjeaplnna -o json -f supabase/migrations/20261007_amenagactif_journal_suivi.sql`, puis les 5 vérifications en bas du fichier SQL (2 tables ; 6 déclencheurs ; aucun droit client ; tâche `ar_journal_purge` planifiée ; lecture sans erreur).

- [ ] **Step 3 : Essai réel, sur École test uniquement** (année 2027-2028, vide ; identité d'administrateur simulée en lisant son `user_id` **avant** `set local role authenticated`, sinon les claims sont nuls et les écritures sont refusées sans erreur) :
  1. créer une classe fictive « ZZ2 » avec un élève « Zed Z » (superutilisateur) ;
  2. créer un lien fictif (`ar_liens` : `token_hash 'zz-essai-journal'`, école = École test, `annee_id` = 2027-2028, `cree_par` = administrateur, `expire_le '2028-08-31'`) rattaché à « ZZ2 » ;
  3. appeler `select ar_lien_compter_ouverture('<lien>');` (attendu : `true`) ;
  4. en rôle `authenticated` (administrateur), cocher puis décocher une case AR pour « Zed Z », ajouter un commentaire à l'élève ;
  5. `select * from ar_suivi_enseignants('<id École test>');` (attendu : statut `modifie_depuis_la_visite`, `modifications_depuis_derniere_ouverture` ≥ 2), `select * from ar_ouvertures_lien('<lien>');`, `select * from ar_journal_classe('<classe>');` ;
  6. **nettoyage** : supprimer le lien (les ouvertures partent en cascade), supprimer la classe « ZZ2 », effacer sa ligne d'archive (`ar_archive_effacer`), supprimer les lignes du journal de l'essai (`delete from ar_journal where ecole_id = '<École test>' and annee_id = '<2027-2028>'`) ;
  7. vérifier qu'il ne reste rien : `ar_classes`/`ar_eleves` (112 classes et 233 élèves avant l'essai : à comparer), `ar_liens`, `ar_lien_ouvertures`, `ar_journal` pour l'École test 2027-2028.

- [ ] **Step 4 : Vérifier que l'application est inchangée** : dans l'application (École test, année vide), cocher et décocher une case AR et supprimer un élève fictif : mêmes gestes et mêmes temps de réponse qu'avant.

- [ ] **Step 5 : Fusion et push** (après accord de JF) : `git merge --ff-only feature/journal-suivi` dans le dossier principal, `git add docs/superpowers/plans/2026-10-03-amenagactif-journal-suivi.md`, commit, `git push origin main`. Aucun redéploiement applicatif nécessaire.

---

### Task 5 : Revue finale et remise

- [ ] **Step 1 :** revue globale indépendante de la branche (`superpowers:requesting-code-review`). Points d'attention : **fail-open réel** des déclencheurs et de la fonction d'ouverture, absence de tout accès `anon`/`authenticated`, justesse des rattachements classe/école/année (y compris le cas « changement de classe »), justesse du calcul « depuis la dernière visite », purge (année terminée, lignes sans année), aucune dérive du comportement d'`ar_lien_compter_ouverture` (limite d'une ouverture par heure, lien révoqué).
- [ ] **Step 2 :** mettre à jour la mémoire du projet (état, procédure, limites, rappel : l'historique ne remonte pas avant la mise en service).

---

## Auto-revue

| Exigence | Où |
|---|---|
| Savoir si/quand chaque enseignant a ouvert son lien | `ar_lien_ouvertures`, `ar_suivi_enseignants` (Tasks 1, 2) |
| Savoir si la fiche a changé depuis sa dernière visite, quoi, qui, quand | `ar_journal`, `ar_ouvertures_lien`, `ar_journal_classe` |
| Rétention à l'année scolaire (31/08) | `ar_fin_annee`, `ar_journal_purger`, `pg_cron` (Task 1, test 8) |
| Aucun changement de l'application ni de l'accès des enseignants | SQL seulement, fonction d'ouverture étendue sans changement d'interface (Tasks 1, 4) |
| Fail-open | déclencheurs et fonction d'ouverture (tests 4 et 6) |
| Lecture réservée à l'administrateur | droits retirés aux clients (tests 5) |
| Test sans rien appliquer | transaction annulée d'office (Task 2) |

Points d'incertitude :
1. La suppression en cascade d'une classe journalise les lignes enfants sans toujours pouvoir les rattacher à leur classe (parent déjà supprimé) ; seul le contenu de l'archive (30 jours) les décrit : à confirmer par le test 3.
2. Le test appelle `ar_lien_compter_ouverture` dans des expressions `zz_check(… and …)` : l'ordre d'évaluation de `and` n'est pas garanti ; si un contrôle est instable, séparer l'appel et la vérification.
3. L'historique ne commence qu'à l'application de la migration ; les modifications antérieures (saisie initiale en cours) ne sont pas tracées.
