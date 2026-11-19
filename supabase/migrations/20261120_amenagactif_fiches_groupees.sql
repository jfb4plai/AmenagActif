-- AménagActif — fiches groupées ENREGISTRÉES (plusieurs classes fusionnées, nom propre) et leur place dans un sommaire.
-- À exécuter à la main dans le SQL Editor Supabase, APRÈS 20261113. Idempotent.
--
-- À appliquer AVANT le déploiement du code : le code lit ces tables dès qu'un sommaire est ouvert.
--
-- Modèle :
--  * ar_fiches_groupees          : une fiche groupée = nom + école + année. Elle apparaît dans l'onglet Fiches.
--  * ar_fiches_groupees_classes  : les classes qu'elle fusionne (2 à 10, même école et même année).
--  * ar_liens_fiches_groupees    : les fiches groupées qu'un SOMMAIRE contient (à côté de ses classes).
--  La fiche groupée est « vivante » : elle reflète toujours les élèves et aménagements actuels de ses classes.
--  Supprimer une fiche groupée la retire des sommaires qui la contenaient (cascade) ; les classes ne sont pas touchées.
--  Un lien « fusion » existant reste inchangé (il garde son nom propre, sans passer par ces tables).
--
-- Droits :
--  * Lecture : toute personne qui lit l'école (ar_can_read_ecole). Une fiche groupée ne contient aucune donnée d'élève.
--  * Écriture : admin, référent PLAI, direction et agent accompagnant (ar_can_edit_ecole), comme la création de classe.
--  * ar_liens_fiches_groupees : service role seulement (comme ar_liens_classes pour l'écriture) ; lecture client par
--    ar_can_editer_structure_ecole n'est pas nécessaire : l'écran passe par /api/liens.
--  * Aucun EXISTS auto-joint dans une politique : les politiques des tables enfants passent par des fonctions
--    security definer.

begin;

create table if not exists ar_fiches_groupees (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 60),
  cree_par uuid references auth.users(id) on delete set null,
  cree_le timestamptz not null default now(),
  unique (ecole_id, annee_id, nom)
);

create table if not exists ar_fiches_groupees_classes (
  fiche_groupee_id uuid not null references ar_fiches_groupees(id) on delete cascade,
  classe_id uuid not null references ar_classes(id) on delete cascade,
  primary key (fiche_groupee_id, classe_id)
);
create index if not exists ar_fiches_groupees_classes_classe_idx on ar_fiches_groupees_classes (classe_id);

create table if not exists ar_liens_fiches_groupees (
  lien_id uuid not null references ar_liens(id) on delete cascade,
  fiche_groupee_id uuid not null references ar_fiches_groupees(id) on delete cascade,
  primary key (lien_id, fiche_groupee_id)
);
create index if not exists ar_liens_fiches_groupees_fg_idx on ar_liens_fiches_groupees (fiche_groupee_id);

-- École d'une fiche groupée (security definer : aucune sous-requête sur la table dans une politique RLS).
create or replace function ar_fg_ecole(target uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select ecole_id from ar_fiches_groupees where id = target;
$$;

-- Défense en profondeur : une classe n'entre dans une fiche groupée que de la même école et de la même année ;
-- au plus 10 classes (comme une fiche fusionnée).
create or replace function ar_fg_classes_controle() returns trigger
language plpgsql set search_path = public as $$
declare
  f record;
  c record;
begin
  select ecole_id, annee_id into f from ar_fiches_groupees where id = new.fiche_groupee_id;
  select ecole_id, annee_id into c from ar_classes where id = new.classe_id;
  if f.ecole_id is distinct from c.ecole_id or f.annee_id is distinct from c.annee_id then
    raise exception 'Toutes les classes d''une fiche groupée doivent appartenir à la même école et à la même année.';
  end if;
  if (select count(*) from ar_fiches_groupees_classes where fiche_groupee_id = new.fiche_groupee_id) >= 10 then
    raise exception 'Une fiche groupée regroupe au plus 10 classes.';
  end if;
  return new;
end $$;
drop trigger if exists ar_fg_classes_controle on ar_fiches_groupees_classes;
create trigger ar_fg_classes_controle before insert on ar_fiches_groupees_classes
  for each row execute function ar_fg_classes_controle();

-- Un sommaire ne contient que des fiches groupées de sa propre école et de sa propre année ; jamais un lien « fusion ».
create or replace function ar_liens_fg_controle() returns trigger
language plpgsql set search_path = public as $$
declare
  l record;
  f record;
begin
  select ecole_id, annee_id, mode into l from ar_liens where id = new.lien_id;
  select ecole_id, annee_id into f from ar_fiches_groupees where id = new.fiche_groupee_id;
  if l.mode is distinct from 'sommaire' then
    raise exception 'Seul un sommaire peut contenir des fiches groupées.';
  end if;
  if l.ecole_id is distinct from f.ecole_id or l.annee_id is distinct from f.annee_id then
    raise exception 'Les fiches groupées d''un sommaire doivent appartenir à la même école et à la même année.';
  end if;
  return new;
end $$;
drop trigger if exists ar_liens_fg_controle on ar_liens_fiches_groupees;
create trigger ar_liens_fg_controle before insert on ar_liens_fiches_groupees
  for each row execute function ar_liens_fg_controle();

-- Enregistre (crée ou modifie) une fiche groupée et remplace ses classes, en une seule transaction.
-- SECURITY INVOKER : les politiques RLS de l'appelant s'appliquent (admin/référent/direction/agent de l'école).
-- p_id null : création. Erreurs métier : P0001, message français affichable tel quel.
create or replace function ar_fg_enregistrer(p_id uuid, p_ecole uuid, p_annee uuid, p_nom text, p_classes uuid[])
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_nom text := btrim(coalesce(p_nom, ''));
  v_classes uuid[];
begin
  if char_length(v_nom) < 1 or char_length(v_nom) > 60 then
    raise exception 'Le nom d''une fiche groupée compte de 1 à 60 caractères.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_classes
    from unnest(coalesce(p_classes, '{}')) as x where x is not null;
  if coalesce(array_length(v_classes, 1), 0) < 2 or array_length(v_classes, 1) > 10 then
    raise exception 'Une fiche groupée regroupe de 2 à 10 classes.' using errcode = 'P0001';
  end if;

  if p_id is null then
    begin
      insert into ar_fiches_groupees (ecole_id, annee_id, nom, cree_par)
      values (p_ecole, p_annee, v_nom, auth.uid())
      returning id into v_id;
    exception when unique_violation then
      raise exception 'Une fiche groupée porte déjà ce nom pour cette année.' using errcode = 'P0001';
    end;
  else
    v_id := p_id;
    begin
      update ar_fiches_groupees set nom = v_nom where id = v_id and ecole_id = p_ecole and annee_id = p_annee;
    exception when unique_violation then
      raise exception 'Une fiche groupée porte déjà ce nom pour cette année.' using errcode = 'P0001';
    end;
    if not found then
      raise exception 'Fiche groupée introuvable.' using errcode = 'P0001';
    end if;
  end if;

  delete from ar_fiches_groupees_classes where fiche_groupee_id = v_id and not (classe_id = any (v_classes));
  -- N'insère que les classes absentes : le déclencheur de plafond (10) s'exécute AVANT la détection d'un doublon,
  -- donc un « on conflict do nothing » ferait échouer l'enregistrement d'une fiche qui compte déjà 10 classes.
  insert into ar_fiches_groupees_classes (fiche_groupee_id, classe_id)
  select v_id, x from unnest(v_classes) as x
   where not exists (select 1 from ar_fiches_groupees_classes e where e.fiche_groupee_id = v_id and e.classe_id = x);
  return v_id;
end $$;

-- Remplace atomiquement le contenu d'un sommaire : classes ET fiches groupées. Au moins un élément au total.
-- Réservée au service role (appelée par /api/liens). Les insertions passent par les déclencheurs de contrôle.
create or replace function ar_lien_definir_contenu(p_lien uuid, p_classes uuid[], p_fiches_groupees uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_mode text;
  v_classes uuid[];
  v_fgs uuid[];
begin
  select mode into v_mode from ar_liens where id = p_lien for update;
  if not found then
    raise exception 'Lien introuvable.' using errcode = 'P0001';
  end if;
  if v_mode is distinct from 'sommaire' then
    raise exception 'Cette opération concerne seulement les liens de type sommaire.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_classes from unnest(coalesce(p_classes, '{}')) as x where x is not null;
  select coalesce(array_agg(distinct x), '{}') into v_fgs from unnest(coalesce(p_fiches_groupees, '{}')) as x where x is not null;
  if coalesce(array_length(v_classes, 1), 0) + coalesce(array_length(v_fgs, 1), 0) = 0 then
    raise exception 'Un sommaire contient au moins une classe ou une fiche groupée.' using errcode = 'P0001';
  end if;

  delete from ar_liens_classes where lien_id = p_lien and not (classe_id = any (v_classes));
  insert into ar_liens_classes (lien_id, classe_id) select p_lien, x from unnest(v_classes) as x on conflict do nothing;
  delete from ar_liens_fiches_groupees where lien_id = p_lien and not (fiche_groupee_id = any (v_fgs));
  insert into ar_liens_fiches_groupees (lien_id, fiche_groupee_id) select p_lien, x from unnest(v_fgs) as x on conflict do nothing;

  return (select count(*) from ar_liens_classes where lien_id = p_lien)
       + (select count(*) from ar_liens_fiches_groupees where lien_id = p_lien);
end $$;

-- ── RLS ──
alter table ar_fiches_groupees enable row level security;
alter table ar_fiches_groupees_classes enable row level security;
alter table ar_liens_fiches_groupees enable row level security;

drop policy if exists ar_fg_read on ar_fiches_groupees;
create policy ar_fg_read on ar_fiches_groupees for select to authenticated
  using (ar_can_read_ecole(ecole_id));
drop policy if exists ar_fg_insert on ar_fiches_groupees;
create policy ar_fg_insert on ar_fiches_groupees for insert to authenticated
  with check (ar_can_edit_ecole(ecole_id));
drop policy if exists ar_fg_update on ar_fiches_groupees;
create policy ar_fg_update on ar_fiches_groupees for update to authenticated
  using (ar_can_edit_ecole(ecole_id)) with check (ar_can_edit_ecole(ecole_id));
drop policy if exists ar_fg_delete on ar_fiches_groupees;
create policy ar_fg_delete on ar_fiches_groupees for delete to authenticated
  using (ar_can_edit_ecole(ecole_id));

drop policy if exists ar_fgc_read on ar_fiches_groupees_classes;
create policy ar_fgc_read on ar_fiches_groupees_classes for select to authenticated
  using (ar_can_read_ecole(ar_fg_ecole(fiche_groupee_id)));
drop policy if exists ar_fgc_insert on ar_fiches_groupees_classes;
create policy ar_fgc_insert on ar_fiches_groupees_classes for insert to authenticated
  with check (ar_can_edit_ecole(ar_fg_ecole(fiche_groupee_id)));
drop policy if exists ar_fgc_delete on ar_fiches_groupees_classes;
create policy ar_fgc_delete on ar_fiches_groupees_classes for delete to authenticated
  using (ar_can_edit_ecole(ar_fg_ecole(fiche_groupee_id)));

-- ar_liens_fiches_groupees : aucune politique pour authenticated (service role contourne la RLS).

-- ── GRANT explicites (Data API) ──
revoke all on ar_fiches_groupees from public, anon;
revoke all on ar_fiches_groupees_classes from public, anon;
revoke all on ar_liens_fiches_groupees from public, anon, authenticated;
grant select, insert, update, delete on ar_fiches_groupees to authenticated;
grant select, insert, delete on ar_fiches_groupees_classes to authenticated;
grant select, insert, update, delete on ar_fiches_groupees to service_role;
grant select, insert, update, delete on ar_fiches_groupees_classes to service_role;
grant select, insert, update, delete on ar_liens_fiches_groupees to service_role;

revoke all on function ar_fg_enregistrer(uuid, uuid, uuid, text, uuid[]) from public, anon;
grant execute on function ar_fg_enregistrer(uuid, uuid, uuid, text, uuid[]) to authenticated, service_role;
revoke all on function ar_lien_definir_contenu(uuid, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function ar_lien_definir_contenu(uuid, uuid[], uuid[]) to service_role;

commit;

-- ── Vérifications à jouer après exécution ──
-- 1) Tables :   select count(*) from information_schema.tables
--                where table_name in ('ar_fiches_groupees','ar_fiches_groupees_classes','ar_liens_fiches_groupees');   -- 3
-- 2) Droits :   select has_table_privilege('authenticated','public.ar_liens_fiches_groupees','select');   -- false
--               select has_function_privilege('authenticated','public.ar_lien_definir_contenu(uuid,uuid[],uuid[])','execute');  -- false
--               select has_function_privilege('authenticated','public.ar_fg_enregistrer(uuid,uuid,uuid,text,uuid[])','execute'); -- true
-- 3) RLS :      select tablename, rowsecurity from pg_tables where tablename like 'ar_%fiches_groupees%';   -- true partout
