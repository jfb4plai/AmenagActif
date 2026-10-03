-- Test manuel (NON exécuté automatiquement) de l'archivage à la suppression (migration 20261006).
-- Tout est annulé : le script se termine par une EXCEPTION volontaire dont le message est le bilan.
-- Attendu : « BILAN : N/N contrôles OK ». Voir « Commande de test » dans le plan.

create table zz_res (n serial, step text, ok boolean, info text);
grant all on zz_res to authenticated;
grant usage, select on sequence zz_res_n_seq to authenticated;

create function zz_check(p_step text, p_ok boolean, p_info text default '') returns void
language sql as $$ insert into zz_res (step, ok, info) values (p_step, coalesce(p_ok, false), p_info) $$;

-- Exécute p_sql sous le rôle courant et exige une erreur dont le message correspond à p_motif (LIKE).
create function zz_erreur(p_step text, p_sql text, p_motif text) returns void
language plpgsql as $$
begin
  execute p_sql;
  insert into zz_res (step, ok, info) values (p_step, false, 'aucune erreur levée');
exception when others then
  insert into zz_res (step, ok, info) values (p_step, sqlerrm like p_motif, sqlstate || ' ' || sqlerrm);
end $$;

-- ── Données de départ (superutilisateur) ──
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'dir-archive@example.invalid'),
  ('00000000-0000-0000-0000-0000000000a9', 'agent-archive@example.invalid');
insert into ar_ecoles (id, nom) values
  ('11111111-1111-1111-1111-111111111111', 'Ecole test 1'),
  ('22222222-2222-2222-2222-222222222222', 'Ecole test 2');
insert into ar_annees (id, libelle, active) values ('aaaaaaaa-0000-0000-0000-000000000001', '2098-2099', false);
insert into ar_profils_acces (user_id, role, ecole_id, nom) values
  ('00000000-0000-0000-0000-0000000000d1', 'direction',  '11111111-1111-1111-1111-111111111111', 'Direction Test'),
  ('00000000-0000-0000-0000-0000000000a9', 'agent_plai', '11111111-1111-1111-1111-111111111111', 'Agent Test');

insert into ar_chapitres (id, ordre, titre, est_dispositif) values
  ('00000000-0000-0000-0000-000000000c01', 9998, 'Chapitre test', false),
  ('00000000-0000-0000-0000-000000000c02', 9997, 'Dispositif test', true);
insert into ar_amenagements (id, chapitre_id, ordre, libelle, type) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000c01', 1, 'Amenagement test', 'AR');

insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c0', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '2B'),
  ('00000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000c0', 'Zoe', 'P', 'PAR');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut, eleve_precedent_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', 'Ana', 'T', 'PAR', '00000000-0000-0000-0000-0000000000f0');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c1', 'Bob', 'T', 'IPT');
insert into ar_selections (eleve_id, amenagement_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000a01');
insert into ar_amenagements_libres (eleve_id, chapitre_id, texte) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000c01', 'libre de test');
insert into ar_amenagements_classe (classe_id, amenagement_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000a01');
insert into ar_classe_dispositifs (classe_id, chapitre_id, pour_toute_la_classe) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c02', true);
insert into ar_liens (id, token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le) values
  ('00000000-0000-0000-0000-00000000001a', 'zz-hash-archive', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Destinataire test', '00000000-0000-0000-0000-0000000000d1', '2099-12-31');
insert into ar_liens_classes (lien_id, classe_id) values
  ('00000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-0000000000c1');

-- ══ 1. Suppression d'un élève (rôle direction, comme dans l'application) ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1';
reset role;

select zz_check('élève : suppression inchangée (vraiment supprimé)',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = 0);
select zz_check('élève : une ligne d''archive',
  (select count(*) from ar_archive_suppressions where genre = 'eleve' and element_id = '00000000-0000-0000-0000-0000000000f1') = 1);
select zz_check('élève : l''archive contient sa sélection et son libre',
  (select jsonb_array_length(contenu -> 'selections') = 1 and jsonb_array_length(contenu -> 'libres') = 1
     from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));
select zz_check('élève : auteur = la direction, libellé lisible',
  (select supprime_par = '00000000-0000-0000-0000-0000000000d1'::uuid and libelle = 'Ana T'
     from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));

-- ══ 2. Réactivation de l'élève ══
select ar_archive_restaurer((select id from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));
select zz_check('élève restauré : même identifiant, même classe',
  (select classe_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-0000000000c1');
select zz_check('élève restauré : sélection, libre et lien « élève précédent » rétablis',
  (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_amenagements_libres where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select eleve_precedent_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-0000000000f0');
select zz_check('élève : archive marquée « restaurée »',
  (select restaure_le is not null from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1'));
select zz_erreur('élève : restaurer deux fois refusé',
  $q$ select ar_archive_restaurer((select id from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f1')) $q$,
  'deja_restauree');

-- ══ 3. Suppression d'une classe (cascade : élèves, AR, libres, AU, dispositif, lien) ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_classes where id = '00000000-0000-0000-0000-0000000000c1';
reset role;

select zz_check('classe : suppression inchangée (classe et élèves supprimés)',
  (select count(*) from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = 0
  and (select count(*) from ar_eleves where classe_id = '00000000-0000-0000-0000-0000000000c1') = 0);
select zz_check('classe : une ligne d''archive avec 2 élèves',
  (select count(*) from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select nb_eleves from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1') = 2);
select zz_check('classe : contenu complet (élèves, sélection, libre, AU, dispositif, lien)',
  (select jsonb_array_length(contenu -> 'eleves') = 2 and jsonb_array_length(contenu -> 'selections') = 1
      and jsonb_array_length(contenu -> 'libres') = 1 and jsonb_array_length(contenu -> 'au') = 1
      and jsonb_array_length(contenu -> 'dispositifs') = 1 and jsonb_array_length(contenu -> 'liens') = 1
     from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1'));
select zz_check('classe : les élèves de la cascade ne sont pas archivés une seconde fois',
  (select count(*) from ar_archive_suppressions where genre = 'eleve') = 1);   -- seulement l'élève supprimé seul à l'étape 1

-- ══ 4. Réactivation de la classe ══
select ar_archive_restaurer((select id from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1'));
select zz_check('classe restaurée : même identifiant, 2 élèves',
  (select count(*) from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select count(*) from ar_eleves where classe_id = '00000000-0000-0000-0000-0000000000c1') = 2);
select zz_check('classe restaurée : sélection, libre, AU, dispositif et lien rétablis',
  (select count(*) from ar_selections where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_amenagements_libres where eleve_id = '00000000-0000-0000-0000-0000000000f1') = 1
  and (select count(*) from ar_amenagements_classe where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select count(*) from ar_classe_dispositifs where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1
  and (select count(*) from ar_liens_classes where classe_id = '00000000-0000-0000-0000-0000000000c1') = 1);
select zz_check('classe restaurée : lien « élève précédent » rétabli',
  (select eleve_precedent_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-0000000000f0');

-- ══ 5. Nom déjà pris : restauration sous un autre nom ══
delete from ar_classes where id = '00000000-0000-0000-0000-0000000000c1';
insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c3', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '3A');
select zz_erreur('nom pris : restauration refusée avec un message clair',
  $q$ select ar_archive_restaurer((select id from ar_archive_suppressions
        where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1' and restaure_le is null)) $q$,
  'nom_deja_utilise');
select ar_archive_restaurer((select id from ar_archive_suppressions
  where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c1' and restaure_le is null), '3A (ancienne)');
select zz_check('restaurée sous un autre nom, avec ses 2 élèves',
  (select nom from ar_classes where id = '00000000-0000-0000-0000-0000000000c1') = '3A (ancienne)'
  and (select count(*) from ar_eleves where classe_id = '00000000-0000-0000-0000-0000000000c1') = 2);

-- ══ 6. Élève restauré dans une autre classe (la sienne n'existe plus) ══
delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2';
select ar_archive_restaurer((select id from ar_archive_suppressions
  where genre = 'eleve' and element_id = '00000000-0000-0000-0000-0000000000f2' and restaure_le is null),
  null, '00000000-0000-0000-0000-0000000000c3');
select zz_check('élève restauré dans la classe cible choisie',
  (select classe_id from ar_eleves where id = '00000000-0000-0000-0000-0000000000f2') = '00000000-0000-0000-0000-0000000000c3');

-- ══ 7. École supprimée : l'archive subsiste, la restauration est refusée proprement ══
insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c9', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'X1');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000c9', 'Xavier', 'X', 'PAR');
delete from ar_ecoles where id = '22222222-2222-2222-2222-222222222222';
select zz_check('école supprimée : la classe est archivée (une ligne) sans doublon pour ses élèves',
  (select count(*) from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c9') = 1
  and (select count(*) from ar_archive_suppressions where genre = 'eleve' and libelle = 'Xavier X') = 0);
select zz_erreur('école supprimée : restauration refusée',
  $q$ select ar_archive_restaurer((select id from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c9')) $q$,
  'ecole_disparue');

-- ══ 8. Fail-open : si l'archivage échoue, la suppression aboutit quand même ══
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3', 'Cal', 'C', 'PAR');
alter table ar_archive_suppressions add constraint zz_bloque check (false) not valid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
delete from ar_eleves where id = '00000000-0000-0000-0000-0000000000f3';
reset role;
select zz_check('fail-open : la suppression aboutit même si l''archivage échoue',
  (select count(*) from ar_eleves where id = '00000000-0000-0000-0000-0000000000f3') = 0
  and (select count(*) from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000f3') = 0);
alter table ar_archive_suppressions drop constraint zz_bloque;

-- ══ 9. Aucun accès depuis l'application ══
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select zz_erreur('direction : table d''archive inaccessible', $q$ select count(*) from ar_archive_suppressions $q$, '%permission denied%');
select zz_erreur('direction : ar_archive_lister inaccessible', $q$ select * from ar_archive_lister() $q$, '%permission denied%');
select zz_erreur('direction : ar_archive_restaurer inaccessible', $q$ select ar_archive_restaurer(gen_random_uuid()) $q$, '%permission denied%');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
select zz_erreur('agent : table d''archive inaccessible', $q$ select count(*) from ar_archive_suppressions $q$, '%permission denied%');
select zz_erreur('agent : ar_archive_effacer inaccessible', $q$ select ar_archive_effacer(gen_random_uuid()) $q$, '%permission denied%');
reset role;

-- ══ 10. Recherche et purge ══
select zz_check('lister : filtre par texte',
  (select count(*) from ar_archive_lister('3A')) >= 1 and (select count(*) from ar_archive_lister('zzz-inexistant')) = 0);
select zz_check('lister : sans filtre, plusieurs lignes avec auteur lisible',
  (select count(*) from ar_archive_lister()) >= 3
  and (select count(*) from ar_archive_lister() where supprime_par_nom = 'Direction Test') >= 1);
update ar_archive_suppressions set supprime_le = now() - interval '31 days'
 where genre = 'eleve' and element_id = '00000000-0000-0000-0000-0000000000f1';
select zz_check('purge : supprime seulement ce qui dépasse 30 jours', ar_archive_purger() = 1);
select zz_check('purge : le reste est conservé',
  (select count(*) from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000c1') >= 1);
select ar_archive_effacer((select id from ar_archive_suppressions where genre = 'classe' and element_id = '00000000-0000-0000-0000-0000000000c9'));
select zz_check('effacer : une ligne d''archive peut être effacée immédiatement',
  (select count(*) from ar_archive_suppressions where element_id = '00000000-0000-0000-0000-0000000000c9') = 0);

-- ══ BILAN (annule tout) ══
do $$
declare
  v_total integer; v_ko integer; v_detail text;
begin
  select count(*), count(*) filter (where not ok),
         string_agg(n || ') ' || step || ' -> ' || info, E'\n' order by n) filter (where not ok)
    into v_total, v_ko, v_detail
  from zz_res;
  raise exception E'BILAN : %/% contrôles OK%', v_total - v_ko, v_total,
    case when v_ko > 0 then E'\nKO :\n' || v_detail else '' end;
end $$;
