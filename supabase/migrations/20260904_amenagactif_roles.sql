-- AménagActif — modèle de rôles : admin (global) + referent_plai / direction (une école).
-- À exécuter après 20260903_amenagactif_core.sql.

-- ── Rôles ──
-- Ordre important : retirer l'ancienne contrainte, convertir les lignes, PUIS
-- ajouter la nouvelle contrainte (sinon 23514 sur les lignes role='plai').
alter table ar_profils_acces drop constraint if exists ar_profils_acces_role_check;

update ar_profils_acces set role = 'admin'         where role = 'plai' and ecole_id is null;
update ar_profils_acces set role = 'referent_plai' where role = 'plai';

alter table ar_profils_acces
  add constraint ar_profils_acces_role_check check (role in ('admin', 'referent_plai', 'direction'));

-- ── Helpers ──
create or replace function ar_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ar_profils_acces where user_id = auth.uid() and role = 'admin');
$$;

-- compat : ar_is_plai() était utilisé par les politiques de référence → devient « est admin »
create or replace function ar_is_plai() returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin();
$$;

create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces where user_id = auth.uid() and ecole_id = target
  );
$$;

create or replace function ar_can_edit_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and ecole_id = target and role in ('referent_plai', 'direction')
  );
$$;

-- ── Politiques d'écriture : les rôles rattachés à une école éditent leur école ──
drop policy if exists ar_classes_write on ar_classes;
create policy ar_classes_write on ar_classes for all to authenticated
  using (ar_can_edit_ecole(ecole_id)) with check (ar_can_edit_ecole(ecole_id));

drop policy if exists ar_ref_ecole_write on ar_referents_ecole;
create policy ar_ref_ecole_write on ar_referents_ecole for all to authenticated
  using (ar_can_edit_ecole(ecole_id)) with check (ar_can_edit_ecole(ecole_id));

drop policy if exists ar_eleves_write on ar_eleves;
create policy ar_eleves_write on ar_eleves for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

drop policy if exists ar_amgt_classe_write on ar_amenagements_classe;
create policy ar_amgt_classe_write on ar_amenagements_classe for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

drop policy if exists ar_selections_write on ar_selections;
create policy ar_selections_write on ar_selections for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));

drop policy if exists ar_libres_write on ar_amenagements_libres;
create policy ar_libres_write on ar_amenagements_libres for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));

drop policy if exists ar_enseignants_write on ar_enseignants;
create policy ar_enseignants_write on ar_enseignants for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

drop policy if exists ar_snap_write on ar_fiche_snapshots;
create policy ar_snap_write on ar_fiche_snapshots for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

-- Référence (années, chapitres, aménagements), écoles, comptes, envois :
-- restent en écriture admin uniquement — les politiques existantes utilisent
-- ar_is_plai() qui pointe désormais sur ar_is_admin(). Rien à changer.
