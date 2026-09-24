-- Test manuel (NON exécuté automatiquement) de la migration 20260924e.
-- À lancer dans le SQL Editor Supabase APRÈS la migration e. Tout est annulé par le rollback final :
-- aucune donnée ne subsiste. Une assertion qui échoue lève une exception qui dit laquelle.
-- (Le SQL Editor s'exécute en rôle propriétaire : la RLS n'est pas testée ici.)

begin;

do $$
declare
  ch uuid; a1 ar_amenagements; a2 ar_amenagements; a3 ar_amenagements; chap_code text; ok boolean;
begin
  -- Chapitre de test SANS code : le trigger doit en poser un (ordre très élevé pour éviter tout conflit).
  insert into ar_chapitres (ordre, titre) values (99999, '99. Chapitre de test partage')
    returning id, code into ch, chap_code;
  if chap_code is distinct from 'chapitre_de_test_partage' then
    raise exception 'ECHEC chapitre : code attendu chapitre_de_test_partage, obtenu %', chap_code;
  end if;

  -- 1. Un nouvel AR sans code reçoit un code.
  insert into ar_amenagements (chapitre_id, ordre, libelle, type) values (ch, 1, 'Rédiger le cours en braille', 'AR') returning * into a1;
  if a1.code is distinct from 'ar_chapitre_de_test_partage_rediger_le_cours_en_braille' then
    raise exception 'ECHEC 1 : code obtenu %', a1.code;
  end if;

  -- 2. Deux libellés identiques reçoivent deux codes distincts.
  insert into ar_amenagements (chapitre_id, ordre, libelle, type) values (ch, 2, 'Rédiger le cours en braille', 'AR') returning * into a2;
  if a2.code is null or a2.code = a1.code then raise exception 'ECHEC 2 : codes identiques ou nuls (% / %)', a1.code, a2.code; end if;
  if a2.code !~ '_2$' then raise exception 'ECHEC 2 : suffixe _2 attendu, obtenu %', a2.code; end if;

  -- 3. partage_profil vaut true par défaut.
  if a1.partage_profil is not true or a2.partage_profil is not true then raise exception 'ECHEC 3 : partage_profil devrait valoir true'; end if;

  -- 3bis. Un code fourni explicitement est conservé.
  insert into ar_amenagements (chapitre_id, ordre, libelle, type, code) values (ch, 3, 'Autre', 'AU', 'ar_test_partage_fourni') returning * into a3;
  if a3.code <> 'ar_test_partage_fourni' then raise exception 'ECHEC 3bis : code fourni écrasé'; end if;

  -- 4. Un code posé ne peut plus changer.
  ok := false;
  begin
    update ar_amenagements set code = 'ar_test_partage_change' where id = a1.id;
  exception when others then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : le code a pu être modifié'; end if;

  -- 4bis. Renommer le libellé ou changer le drapeau ne touche pas au code.
  update ar_amenagements set libelle = 'Libellé renommé', partage_profil = false where id = a1.id;
  if (select code from ar_amenagements where id = a1.id) <> a1.code then raise exception 'ECHEC 4bis : code modifié par un renommage'; end if;

  raise notice 'OK : vérifications réussies (codes % / % / %)', a1.code, a2.code, a3.code;
end $$;

rollback;
