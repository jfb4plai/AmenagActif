-- AménagActif — référent PLAI / direction rattachés à plusieurs écoles.
-- ar_profils_acces.ecole_id reste en base (compat historique, toujours
-- utilisé par agent_plai) mais n'est plus la seule source de vérité pour
-- referent_plai/direction : nouvelle relation many-to-many, backfillée
-- depuis les données existantes. Méthode additive (OR sur les deux
-- chemins) : rien de ce qui marchait avant ne casse.

begin;

create table ar_profils_acces_ecoles (
  user_id  uuid not null references auth.users(id) on delete cascade,
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  cree_le  timestamptz not null default now(),
  primary key (user_id, ecole_id)
);

alter table ar_profils_acces_ecoles enable row level security;

-- Backfill : chaque referent_plai/direction avec un ecole_id garde cette
-- école comme première entrée de la nouvelle table.
insert into ar_profils_acces_ecoles (user_id, ecole_id)
select user_id, ecole_id from ar_profils_acces
where role in ('referent_plai', 'direction') and ecole_id is not null
on conflict do nothing;

-- ── Helpers étendus (additif : l'ancien chemin ecole_id reste valide) ──
create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces where user_id = auth.uid() and ecole_id = target
  ) or exists (
    select 1 from ar_profils_acces_ecoles where user_id = auth.uid() and ecole_id = target
  );
$$;

create or replace function ar_can_edit_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and ecole_id = target and role in ('referent_plai', 'direction')
  ) or exists (
    select 1 from ar_profils_acces p
    join ar_profils_acces_ecoles pe on pe.user_id = p.user_id
    where p.user_id = auth.uid() and pe.ecole_id = target and p.role in ('referent_plai', 'direction')
  );
$$;

-- Lecture des profils : « mon école » (legacy, inchangé) OU tout collègue
-- partageant au moins une école avec moi via la nouvelle table.
drop policy if exists ar_acces_read on ar_profils_acces;
create policy ar_acces_read on ar_profils_acces for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or (ecole_id is not null and ecole_id = ar_mon_ecole())
    or exists (
      select 1 from ar_profils_acces_ecoles mine
      join ar_profils_acces_ecoles theirs on theirs.ecole_id = mine.ecole_id
      where mine.user_id = auth.uid() and theirs.user_id = ar_profils_acces.user_id
    )
  );

-- ── ar_profils_acces_ecoles elle-même ──
-- Lecture : l'intéressé, tout collègue de la même école, ou l'admin.
-- Écriture : admin uniquement (gestion centralisée des comptes, comme le
-- reste de ar_profils_acces).
create policy ar_pae_read on ar_profils_acces_ecoles for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or exists (
      select 1 from ar_profils_acces_ecoles mine
      where mine.user_id = auth.uid() and mine.ecole_id = ar_profils_acces_ecoles.ecole_id
    )
  );
create policy ar_pae_write on ar_profils_acces_ecoles for all to authenticated
  using (ar_is_admin()) with check (ar_is_admin());

commit;
