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
