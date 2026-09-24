-- Test manuel (NON exécuté automatiquement) : un compte révoqué ne lit plus rien.
-- À lancer dans le SQL Editor Supabase APRÈS la migration 20260924b, sur une base
-- de test ou en transaction annulée (le rollback final défait tout).
-- Remplacer <ECOLE_ID> (partout) par l'id d'une école existante. Utilise un faux utilisateur
-- créé dans auth.users puis supprimé par le rollback.

begin;

-- 1. Faux compte direction rattaché à l'école
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000aa01', 'test-revoque@example.invalid');
insert into ar_profils_acces (user_id, role, ecole_id, nom)
  values ('00000000-0000-0000-0000-00000000aa01', 'direction', '<ECOLE_ID>', 'Test');
insert into ar_profils_acces_ecoles (user_id, ecole_id)
  values ('00000000-0000-0000-0000-00000000aa01', '<ECOLE_ID>');

-- 2. Se placer en tant que ce compte
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000aa01","role":"authenticated"}', true);

-- Attendu AVANT révocation : true
select ar_can_read_ecole('<ECOLE_ID>') as lecture_avant;

-- 3. Révocation (comme api/membres.js : suppression du profil ; la cascade nettoie les écoles)
reset role;
delete from ar_profils_acces where user_id = '00000000-0000-0000-0000-00000000aa01';

-- Attendu : 0 ligne restante dans ar_profils_acces_ecoles (cascade)
select count(*) as lignes_ecoles_restantes from ar_profils_acces_ecoles
  where user_id = '00000000-0000-0000-0000-00000000aa01';

-- 4. Rejouer le pire cas : ligne orpheline réinsérée sans profil (la FK doit refuser)
-- Attendu : ERREUR 23503 (violation de clé étrangère). Décommenter pour tester seul.
-- insert into ar_profils_acces_ecoles (user_id, ecole_id) values ('00000000-0000-0000-0000-00000000aa01', '<ECOLE_ID>');

-- 5. Lecture après révocation
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000aa01","role":"authenticated"}', true);
-- Attendu : false
select ar_can_read_ecole('<ECOLE_ID>') as lecture_apres;
-- Attendu : 0 ligne partout
select count(*) as classes_visibles from ar_classes;
select count(*) as eleves_visibles from ar_eleves;
select count(*) as enseignants_visibles from ar_enseignants;

rollback;
