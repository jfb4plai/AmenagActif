-- AménagActif — l'agent accompagnant devient éditeur (pas seulement lecture),
-- multi-écoles comme référent PLAI / direction, avec deux restrictions
-- explicitement demandées par JF :
--   1. ne peut pas créer (ni supprimer) une classe — travaille sur les
--      classes déjà créées par un référent/direction/admin ;
--   2. peut AJOUTER un aménagement universel (AU) à une classe, mais pas en
--      RETIRER un déjà coché — geste réservé à référent/direction/admin.
-- Tout le reste (élèves : créer/modifier/supprimer, AR par élève, aménagements
-- libres, commentaire, nom du référent PLAI de la classe) est à parité avec
-- référent PLAI / direction, sur les écoles où l'agent est actif.

begin;

-- ar_can_edit_ecole : parité élève/AR/AU-ajout/référent-nom → agent_plai inclus.
create or replace function ar_can_edit_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and ecole_id = target and role in ('referent_plai', 'direction', 'agent_plai')
  ) or exists (
    select 1 from ar_profils_acces p
    join ar_profils_acces_ecoles pe on pe.user_id = p.user_id
    where p.user_id = auth.uid() and pe.ecole_id = target and p.role in ('referent_plai', 'direction', 'agent_plai')
  );
$$;

-- Variante stricte (référent/direction/admin, PAS agent_plai) : création/suppression
-- de classe, retrait d'un AU déjà coché.
create or replace function ar_can_editer_structure_ecole(target uuid) returns boolean
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

-- ar_classes : lecture inchangée (ar_classes_read, ar_can_read_ecole).
-- Écriture scindée : update via ar_can_edit_ecole (agent inclus — nom référent
-- PLAI classe) ; insert/delete via ar_can_editer_structure_ecole (pas l'agent).
drop policy if exists ar_classes_write on ar_classes;
create policy ar_classes_update on ar_classes for update to authenticated
  using (ar_can_edit_ecole(ecole_id)) with check (ar_can_edit_ecole(ecole_id));
create policy ar_classes_insert on ar_classes for insert to authenticated
  with check (ar_can_editer_structure_ecole(ecole_id));
create policy ar_classes_delete on ar_classes for delete to authenticated
  using (ar_can_editer_structure_ecole(ecole_id));

-- ar_amenagements_classe (cases AU, une ligne = un AU coché) : insert via
-- ar_can_edit_ecole (agent peut ajouter) ; delete via ar_can_editer_structure_ecole
-- (agent ne peut pas retirer un AU déjà coché).
drop policy if exists ar_amgt_classe_write on ar_amenagements_classe;
create policy ar_amgt_classe_insert on ar_amenagements_classe for insert to authenticated
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_amgt_classe_delete on ar_amenagements_classe for delete to authenticated
  using (ar_can_editer_structure_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

-- Élèves, sélections AR, aménagements libres, enseignants, snapshots : restent
-- sur ar_can_edit_ecole "for all" (politiques du 2026-09-04/22, inchangées ici)
-- — parité complète agent/référent/direction, comme demandé.

commit;
