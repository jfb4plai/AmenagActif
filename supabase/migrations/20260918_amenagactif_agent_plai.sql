-- AménagActif — ajoute le rôle "agent_plai" (agent accompagnant, lecture seule par école).
--
-- Aucun changement RLS nécessaire : ar_can_read_ecole() accepte déjà tout rôle
-- rattaché à l'école (aucun filtre sur le rôle, juste ecole_id) ; ar_can_edit_ecole()
-- reste strictement limité à role in ('referent_plai','direction'). Ce nouveau rôle
-- est donc en lecture seule par construction dès qu'il est ajouté à la contrainte.

begin;

alter table ar_profils_acces drop constraint if exists ar_profils_acces_role_check;
alter table ar_profils_acces
  add constraint ar_profils_acces_role_check check (role in ('admin', 'referent_plai', 'direction', 'agent_plai'));

commit;
