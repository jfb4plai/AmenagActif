-- AménagActif — l'agent accompagnant peut CRÉER une classe (décision JF 2026-11-19).
-- À exécuter à la main dans le SQL Editor Supabase AVANT le déploiement du code. Idempotent.
--
-- Ce qui change : la politique d'insertion sur ar_classes passe de ar_can_editer_structure_ecole
-- (admin, référent PLAI, direction) à ar_can_edit_ecole (les mêmes + agent_plai).
-- Ce qui NE change PAS : suppression de classe (ar_classes_delete), renommage (déclencheur 20261015),
-- changement de classe d'un élève et reprise d'année restent réservés à ar_can_editer_structure_ecole.
-- Aucun EXISTS auto-joint sur ar_classes : ar_can_edit_ecole interroge ar_profils_acces, pas ar_classes.

begin;

drop policy if exists ar_classes_insert on ar_classes;
create policy ar_classes_insert on ar_classes for insert to authenticated
  with check (ar_can_edit_ecole(ecole_id));

commit;

-- Vérification : select policyname, cmd, with_check from pg_policies
--                where tablename = 'ar_classes' and policyname = 'ar_classes_insert';
--   with_check doit contenir ar_can_edit_ecole(ecole_id).
