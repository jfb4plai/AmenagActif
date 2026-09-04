-- AménagActif — consolidation : les acteurs d'implantation sont des comptes.
-- Nom d'affichage sur ar_profils_acces ; suppression de ar_referents_ecole ;
-- lecture des comptes d'une même implantation par ses membres.
-- À exécuter après 20260904_amenagactif_roles.sql.

begin;

alter table ar_profils_acces add column if not exists nom text not null default '';

drop table if exists ar_referents_ecole cascade;

-- École de l'utilisateur courant (sans récursion de politique).
create or replace function ar_mon_ecole() returns uuid
language sql stable security definer set search_path = public as $$
  select ecole_id from ar_profils_acces where user_id = auth.uid();
$$;

-- Lecture des profils : soi-même, ou admin, ou membre de la même implantation.
drop policy if exists ar_acces_self on ar_profils_acces;
drop policy if exists ar_acces_read on ar_profils_acces;
create policy ar_acces_read on ar_profils_acces for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or (ecole_id is not null and ecole_id = ar_mon_ecole())
  );
-- (l'écriture reste admin only : politique ar_acces_admin inchangée)

commit;
