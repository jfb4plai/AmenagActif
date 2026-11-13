-- AménagActif — super lien « sommaire de classes » : un lien peut porter un nombre quelconque de classes.
-- À exécuter à la main dans le SQL Editor Supabase, APRÈS 20260924d. Idempotent.
--
-- Choix documentés :
--  * ar_liens.mode : 'fusion' (comportement actuel, 10 classes au plus) ou 'sommaire' (pas de plafond).
--    Les liens existants prennent 'fusion' (valeur par défaut) : aucun changement pour eux.
--  * ar_liens.numero : numéro lisible, attribué automatiquement (identité), unique. Les lignes
--    existantes reçoivent un numéro à l'ajout de la colonne.
--  * Le plafond de 10 n'est plus codé en dur : le déclencheur l'applique seulement si le lien est 'fusion'.
--    Le contrôle école/année reste inchangé et s'applique aux deux modes.
--  * ar_lien_definir_classes : remplace l'ensemble des classes d'un lien 'sommaire' en une seule
--    transaction (appel = un seul bloc atomique). Les insertions passent par le déclencheur
--    ar_liens_classes_controle : la fonction ne le contourne pas.
--  * La fonction est réservée au service role (appelée par les fonctions serveur /api).
--  * Aucune politique RLS modifiée. Aucun EXISTS auto-joint.

begin;

alter table ar_liens
  add column if not exists mode text not null default 'fusion';

-- Contrainte nommée, ajoutée seulement si absente (add column if not exists ne rejoue pas un check inline).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.ar_liens'::regclass and conname = 'ar_liens_mode_check'
  ) then
    alter table ar_liens add constraint ar_liens_mode_check check (mode in ('fusion', 'sommaire'));
  end if;
end $$;

alter table ar_liens
  add column if not exists numero bigint generated always as identity;

create unique index if not exists ar_liens_numero_uidx on ar_liens (numero);

-- Défense en profondeur : mêmes école et année que le lien ; plafond de 10 classes pour les liens 'fusion' seulement.
create or replace function ar_liens_classes_controle() returns trigger
language plpgsql set search_path = public as $$
declare
  l record;
  c record;
begin
  select ecole_id, annee_id, mode into l from ar_liens where id = new.lien_id;
  select ecole_id, annee_id into c from ar_classes where id = new.classe_id;
  if l.ecole_id is distinct from c.ecole_id or l.annee_id is distinct from c.annee_id then
    raise exception 'Toutes les classes d''un lien doivent appartenir à la même école et à la même année.';
  end if;
  if l.mode = 'fusion'
     and (select count(*) from ar_liens_classes where lien_id = new.lien_id) >= 10 then
    raise exception 'Un lien regroupe au plus 10 classes.';
  end if;
  return new;
end $$;
-- Le trigger existant (20260924d) appelle déjà cette fonction par son nom : create or replace suffit.

-- Remplace atomiquement les classes d'un lien 'sommaire'. Renvoie le nombre final de classes.
create or replace function ar_lien_definir_classes(p_lien uuid, p_classes uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_mode text;
  v_classes uuid[];
  v_nb integer;
begin
  -- Verrou sur la ligne du lien : deux appels concurrents sur le même lien s'exécutent l'un après l'autre.
  select mode into v_mode from ar_liens where id = p_lien for update;
  if not found then
    raise exception 'Lien introuvable.' using errcode = 'P0001';
  end if;
  if v_mode is distinct from 'sommaire' then
    raise exception 'Cette opération concerne seulement les liens de type sommaire.' using errcode = 'P0001';
  end if;

  -- Retire les null, dédoublonne.
  select coalesce(array_agg(distinct x), '{}') into v_classes
    from unnest(coalesce(p_classes, '{}')) as x
   where x is not null;
  if coalesce(array_length(v_classes, 1), 0) = 0 then
    raise exception 'Un sommaire contient au moins une classe.' using errcode = 'P0001';
  end if;

  delete from ar_liens_classes
   where lien_id = p_lien and not (classe_id = any (v_classes));

  -- Les insertions passent par le déclencheur de contrôle (école/année).
  insert into ar_liens_classes (lien_id, classe_id)
  select p_lien, x from unnest(v_classes) as x
  on conflict do nothing;

  select count(*) into v_nb from ar_liens_classes where lien_id = p_lien;
  return v_nb;
end $$;

-- Lecture des nouvelles colonnes par authenticated (token_hash reste illisible).
grant select (mode, numero) on ar_liens to authenticated;

revoke all on function ar_lien_definir_classes(uuid, uuid[]) from public, anon, authenticated;
grant execute on function ar_lien_definir_classes(uuid, uuid[]) to service_role;

commit;

-- ── Vérifications à jouer après exécution ──
-- 1) Colonnes :  select column_name, column_default, is_identity from information_schema.columns
--                 where table_name = 'ar_liens' and column_name in ('mode','numero');   -- 2 lignes
-- 2) Lecture :   select has_column_privilege('authenticated','public.ar_liens','mode','select');       -- true
--                select has_column_privilege('authenticated','public.ar_liens','numero','select');     -- true
--                select has_column_privilege('authenticated','public.ar_liens','token_hash','select'); -- false
-- 3) Fonction :  select has_function_privilege('authenticated','public.ar_lien_definir_classes(uuid,uuid[])','execute'); -- false
--                select has_function_privilege('service_role','public.ar_lien_definir_classes(uuid,uuid[])','execute');  -- true
-- 4) Test complet : supabase/tests/liens_sommaire.sql
