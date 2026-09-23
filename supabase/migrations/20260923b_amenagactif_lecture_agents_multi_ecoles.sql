-- AménagActif — un référent PLAI / direction multi-écoles ne voyait les agents
-- accompagnants (et les autres profils rattachés en legacy ecole_id) que de
-- sa première école (ar_mon_ecole() ne renvoie que l'ecole_id legacy du
-- lecteur, pas ses écoles ajoutées via ar_profils_acces_ecoles).
--
-- Remplace la comparaison ecole_id = ar_mon_ecole() par ar_can_read_ecole(ecole_id),
-- qui couvre déjà les deux chemins (ecole_id legacy + table many-to-many) et
-- reste security definer (aucune récursion, même patron que le fix du
-- 2026-09-23 — voir 20260923_amenagactif_fix_rls_recursion_pae.sql).

begin;

drop policy if exists ar_acces_read on ar_profils_acces;
create policy ar_acces_read on ar_profils_acces for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or (ecole_id is not null and ar_can_read_ecole(ecole_id))
    or exists (
      select 1 from ar_profils_acces_ecoles mine
      join ar_profils_acces_ecoles theirs on theirs.ecole_id = mine.ecole_id
      where mine.user_id = auth.uid() and theirs.user_id = ar_profils_acces.user_id
    )
  );

commit;
