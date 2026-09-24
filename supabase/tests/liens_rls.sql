-- Test manuel RLS de ar_liens (NON exécuté automatiquement ; transaction annulée à la fin).
-- À jouer dans le SQL Editor Supabase APRÈS la migration 20260924d. Remplacer les valeurs de _t.
-- Le SQL Editor tourne en rôle postgres : on simule chaque utilisateur avec set local role + claims JWT.
begin;

-- A ADAPTER : un référent PLAI de l'école A, un référent d'une AUTRE école, un agent_plai (école A), un admin.
create temp table _t as select
  '00000000-0000-0000-0000-000000000001'::uuid as ref_a,
  '00000000-0000-0000-0000-000000000002'::uuid as ref_b,
  '00000000-0000-0000-0000-000000000003'::uuid as agent,
  '00000000-0000-0000-0000-000000000004'::uuid as admin_,
  '00000000-0000-0000-0000-0000000000a1'::uuid as ecole_a,
  '00000000-0000-0000-0000-0000000000b1'::uuid as annee;
grant select on _t to authenticated;

insert into ar_liens (token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le)
select 'hash-de-test-rls', ecole_a, annee, 'Mme Test, français, 3e TQ B', ref_a, current_date + 30 from _t;

set local role authenticated;

-- 1) agent_plai : 0 ligne attendue
select set_config('request.jwt.claims', json_build_object('sub', (select agent from _t), 'role', 'authenticated')::text, true);
select count(*) as agent_lit__attendu_0 from ar_liens;

-- 2) référent d'une autre école : 0 ligne attendue
select set_config('request.jwt.claims', json_build_object('sub', (select ref_b from _t), 'role', 'authenticated')::text, true);
select count(*) as autre_ecole__attendu_0 from ar_liens;

-- 3) référent de l'école A : 1 ligne attendue
select set_config('request.jwt.claims', json_build_object('sub', (select ref_a from _t), 'role', 'authenticated')::text, true);
select count(*) as referent_ecole__attendu_1 from ar_liens;
select id, destinataire from ar_liens;   -- colonnes autorisées : OK

-- 4) token_hash illisible : ERREUR « permission denied for table ar_liens » attendue.
--    Décommenter pour tester (l'erreur avorte la transaction : tout est de toute façon annulé).
-- select token_hash from ar_liens;

-- 5) écriture refusée pour authenticated : ERREUR attendue (ni politique ni GRANT).
-- update ar_liens set revoque_le = now();

rollback;
