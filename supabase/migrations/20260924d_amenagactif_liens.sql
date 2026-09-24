-- AménagActif — liens enseignants opaques, révocables (remplace le JWT 120 jours pour les nouveaux liens).
-- À exécuter à la main dans le SQL Editor Supabase, APRÈS 20260924b et 20260924c. Idempotent.
--
-- Choix documentés :
--  * ar_annees ne porte AUCUNE date de fin (colonnes : id, libelle, active, created_at). La fin d'année
--    scolaire est donc calculée côté serveur (api/_lib/liens.js, finAnneeScolaire) : 31 août de la
--    seconde année du libellé « AAAA-AAAA », et stockée dans ar_liens.expire_le à la création du lien.
--  * Le secret du lien n'est jamais stocké : seulement son SHA-256 (hex) dans token_hash.
--  * Lecture côté client : ar_can_editer_structure_ecole (admin + référent PLAI + direction de l'école).
--    NE PAS utiliser ar_can_edit_ecole : depuis 20260924 elle inclut agent_plai (lecture interdite ici).
--  * Aucune politique d'écriture pour authenticated : les écritures passent par les fonctions serveur (service role).
--  * Aucun EXISTS auto-joint dans les politiques : fonctions security definer uniquement.

begin;

create table if not exists ar_liens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  destinataire text not null check (char_length(destinataire) between 1 and 80),
  nom_groupe text check (nom_groupe is null or char_length(nom_groupe) <= 60),
  cree_par uuid not null references auth.users(id),
  cree_le timestamptz not null default now(),
  expire_le date not null,
  revoque_le timestamptz,
  revoque_par uuid references auth.users(id),
  derniere_ouverture timestamptz,
  nb_ouvertures integer not null default 0
);

create table if not exists ar_liens_classes (
  lien_id uuid not null references ar_liens(id) on delete cascade,
  classe_id uuid not null references ar_classes(id) on delete cascade,
  primary key (lien_id, classe_id)
);

create index if not exists ar_liens_ecole_idx on ar_liens (ecole_id, revoque_le, expire_le);
create index if not exists ar_liens_classes_classe_idx on ar_liens_classes (classe_id);

-- Défense en profondeur (le serveur vérifie déjà) : mêmes école et année que le lien, 10 classes au plus.
create or replace function ar_liens_classes_controle() returns trigger
language plpgsql set search_path = public as $$
declare
  l record;
  c record;
begin
  select ecole_id, annee_id into l from ar_liens where id = new.lien_id;
  select ecole_id, annee_id into c from ar_classes where id = new.classe_id;
  if l.ecole_id is distinct from c.ecole_id or l.annee_id is distinct from c.annee_id then
    raise exception 'Toutes les classes d''un lien doivent appartenir à la même école et à la même année.';
  end if;
  if (select count(*) from ar_liens_classes where lien_id = new.lien_id) >= 10 then
    raise exception 'Un lien regroupe au plus 10 classes.';
  end if;
  return new;
end $$;

drop trigger if exists ar_liens_classes_controle on ar_liens_classes;
create trigger ar_liens_classes_controle before insert on ar_liens_classes
  for each row execute function ar_liens_classes_controle();

-- École d'un lien (security definer : évite toute sous-requête sur ar_liens dans une politique RLS).
create or replace function ar_lien_ecole(target uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select ecole_id from ar_liens where id = target;
$$;

-- Compteur d'ouvertures atomique : au plus une incrémentation par heure et par lien (limite les écritures).
create or replace function ar_lien_compter_ouverture(p_id uuid) returns boolean
language sql set search_path = public as $$
  with u as (
    update ar_liens
       set derniere_ouverture = now(), nb_ouvertures = nb_ouvertures + 1
     where id = p_id
       and revoque_le is null
       and (derniere_ouverture is null or derniere_ouverture < now() - interval '1 hour')
    returning 1
  )
  select exists (select 1 from u);
$$;

alter table ar_liens enable row level security;
alter table ar_liens_classes enable row level security;

drop policy if exists ar_liens_read on ar_liens;
create policy ar_liens_read on ar_liens for select to authenticated
  using (ar_can_editer_structure_ecole(ecole_id));

drop policy if exists ar_liens_classes_read on ar_liens_classes;
create policy ar_liens_classes_read on ar_liens_classes for select to authenticated
  using (ar_can_editer_structure_ecole(ar_lien_ecole(lien_id)));

-- GRANT explicites. Les privilèges par défaut de Supabase sont retirés d'abord, puis
-- authenticated ne reçoit qu'une lecture par colonnes SANS token_hash.
revoke all on ar_liens from public, anon, authenticated;
revoke all on ar_liens_classes from public, anon, authenticated;
grant select (id, ecole_id, annee_id, destinataire, nom_groupe, cree_par, cree_le, expire_le,
              revoque_le, revoque_par, derniere_ouverture, nb_ouvertures)
  on ar_liens to authenticated;
grant select on ar_liens_classes to authenticated;
grant select, insert, update, delete on ar_liens to service_role;
grant select, insert, update, delete on ar_liens_classes to service_role;

revoke all on function ar_lien_compter_ouverture(uuid) from public, anon, authenticated;
grant execute on function ar_lien_compter_ouverture(uuid) to service_role;

commit;

-- ── Vérifications à jouer après exécution ──
-- 1) RLS active :   select relname, relrowsecurity from pg_class where relname in ('ar_liens','ar_liens_classes');   -- true, true
-- 2) Politiques :   select tablename, policyname, cmd from pg_policies where tablename in ('ar_liens','ar_liens_classes');  -- 2 lignes, cmd = SELECT
-- 3) token_hash illisible :
--    select has_column_privilege('authenticated','public.ar_liens','token_hash','select');   -- false
--    select has_column_privilege('authenticated','public.ar_liens','destinataire','select'); -- true
-- 4) Trigger :      select tgname from pg_trigger where tgrelid = 'ar_liens_classes'::regclass and not tgisinternal;
