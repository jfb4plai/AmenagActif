-- Test des garde-fous de suppression du catalogue (migration 20261012b). Superutilisateur ; tout est annulé par le BILAN final.
-- Usage : exécuter après application de la migration (ou concaténer la migration sans begin/commit avant ce fichier).
create temp table zz_res (n serial, step text, ok boolean, info text);
create or replace function pg_temp.zz_check(p_step text, p_ok boolean, p_info text default '') returns void
language sql as $$ insert into zz_res (step, ok, info) values (p_step, coalesce(p_ok, false), p_info) $$;
create or replace function pg_temp.refuse(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null; exception when others then return sqlerrm; end $$;

insert into ar_ecoles (id, nom) values ('11111111-1111-1111-1111-111111111111', 'Ecole test 1');
insert into ar_annees (id, libelle, active) values ('aaaaaaaa-0000-0000-0000-000000000001', '2098-2099', false);
insert into ar_classes (id, ecole_id, annee_id, nom) values
  ('00000000-0000-0000-0000-0000000000c0', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '2B');
insert into ar_eleves (id, classe_id, prenom, initiale_nom, statut) values
  ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000c0', 'Zoe', 'P', 'PAR');

insert into ar_chapitres (id, ordre, titre) values
  ('00000000-0000-0000-0000-000000000c01', 9998, 'Chapitre utilisé'),
  ('00000000-0000-0000-0000-000000000c02', 9997, 'Chapitre libre de tout'),
  ('00000000-0000-0000-0000-000000000c03', 9996, 'Chapitre avec libre');
insert into ar_amenagements (id, chapitre_id, ordre, libelle, type) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000c01', 1, 'AR coché', 'AR'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000c01', 2, 'AU coché', 'AU'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-000000000c02', 1, 'Jamais utilisé', 'AR'),
  ('00000000-0000-0000-0000-000000000a04', '00000000-0000-0000-0000-000000000c02', 2, 'Jamais utilisé bis', 'AU'),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000c03', 1, 'Jamais utilisé ter', 'AR');
insert into ar_selections (eleve_id, amenagement_id) values ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000a01');
insert into ar_amenagements_classe (classe_id, amenagement_id) values ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-000000000a02');
insert into ar_amenagements_libres (eleve_id, chapitre_id, texte) values ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-000000000c03', 'libre');

select pg_temp.zz_check('AR coché : suppression refusée',
  pg_temp.refuse($$delete from ar_amenagements where id = '00000000-0000-0000-0000-000000000a01'$$) like 'Suppression refusée%1 élève(s) et 0 classe(s)%');
select pg_temp.zz_check('AU coché : suppression refusée',
  pg_temp.refuse($$delete from ar_amenagements where id = '00000000-0000-0000-0000-000000000a02'$$) like 'Suppression refusée%0 élève(s) et 1 classe(s)%');
select pg_temp.zz_check('chapitre contenant un aménagement coché : refusé et rien supprimé',
  pg_temp.refuse($$delete from ar_chapitres where id = '00000000-0000-0000-0000-000000000c01'$$) like 'Suppression refusée%'
  and (select count(*) from ar_selections) = 1
  and (select count(*) from ar_amenagements where chapitre_id = '00000000-0000-0000-0000-000000000c01') = 2);
select pg_temp.zz_check('chapitre avec aménagement libre rattaché : refusé',
  pg_temp.refuse($$delete from ar_chapitres where id = '00000000-0000-0000-0000-000000000c03'$$) like 'Suppression refusée%libre%');

select pg_temp.zz_check('aménagement jamais utilisé : supprimé',
  pg_temp.refuse($$delete from ar_amenagements where id = '00000000-0000-0000-0000-000000000a03'$$) is null
  and not exists (select 1 from ar_amenagements where id = '00000000-0000-0000-0000-000000000a03'));
select pg_temp.zz_check('chapitre jamais utilisé : supprimé avec ses aménagements',
  pg_temp.refuse($$delete from ar_chapitres where id = '00000000-0000-0000-0000-000000000c02'$$) is null
  and not exists (select 1 from ar_chapitres where id = '00000000-0000-0000-0000-000000000c02')
  and not exists (select 1 from ar_amenagements where id = '00000000-0000-0000-0000-000000000a04'));
select pg_temp.zz_check('les données cochées sont intactes',
  (select count(*) from ar_selections) = 1 and (select count(*) from ar_amenagements_classe) = 1);

do $$
declare v_total integer; v_ko integer; v_detail text;
begin
  select count(*), count(*) filter (where not ok),
         string_agg(n || ') ' || step || ' -> ' || info, E'\n' order by n) filter (where not ok)
    into v_total, v_ko, v_detail from zz_res;
  raise exception E'BILAN : %/% contrôles OK%', v_total - v_ko, v_total,
    case when v_ko > 0 then E'\nKO :\n' || v_detail else '' end;
end $$;
