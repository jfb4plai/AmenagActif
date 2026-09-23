-- Corrige une récursion RLS infinie introduite par 20260922d : la politique
-- ar_pae_read sur ar_profils_acces_ecoles se référençait elle-même via un
-- EXISTS auto-joint sur la même table, ce qui bloquait TOUTE lecture de
-- ar_profils_acces (donc toute connexion, y compris admin) avec l'erreur
-- Postgres 42P17 "infinite recursion detected in policy for relation
-- ar_profils_acces_ecoles". Corrigé en urgence en prod le 2026-09-23,
-- migration ajoutée après coup pour traçabilité.
--
-- Fix : remplacer l'EXISTS auto-référentiel par une fonction security
-- definer (même pattern que ar_is_admin/ar_mon_ecole/ar_can_read_ecole/
-- ar_can_edit_ecole déjà utilisées ailleurs dans ce projet) — une fonction
-- security definer s'exécute avec les droits du propriétaire de la table
-- (sans FORCE ROW LEVEL SECURITY), donc ne redéclenche pas la RLS de la
-- table qu'elle interroge en interne.

begin;

create or replace function ar_partage_ecole(target_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_profils_acces_ecoles mine
    where mine.user_id = auth.uid()
      and mine.ecole_id in (select ecole_id from ar_profils_acces_ecoles where user_id = target_user)
  );
$$;

drop policy if exists ar_pae_read on ar_profils_acces_ecoles;
create policy ar_pae_read on ar_profils_acces_ecoles for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or ar_partage_ecole(user_id)
  );

commit;
