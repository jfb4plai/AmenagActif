-- AménagActif : suppression d'un aménagement ou d'un chapitre du catalogue, uniquement s'il n'a jamais servi.
-- Garde-fou en base (déclencheurs BEFORE DELETE) : la suppression en cascade ne peut pas effacer de cases cochées.
-- Utilisé => refus avec le décompte ; l'admin désactive alors l'aménagement au lieu de le supprimer.
-- Non destructif : aucune donnée existante n'est touchée.
begin;

create or replace function ar_amenagement_suppression_gardee()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_eleves integer;
  v_classes integer;
begin
  select count(distinct eleve_id) into v_eleves from ar_selections where amenagement_id = old.id;
  select count(distinct classe_id) into v_classes from ar_amenagements_classe where amenagement_id = old.id;
  if v_eleves > 0 or v_classes > 0 then
    raise exception 'Suppression refusée : cet aménagement est coché pour % élève(s) et % classe(s). Désactivez-le plutôt.', v_eleves, v_classes
      using errcode = 'P0001';
  end if;
  return old;
end $$;

create or replace function ar_chapitre_suppression_gardee()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_eleves integer;
  v_classes integer;
  v_libres integer;
begin
  select count(distinct s.eleve_id) into v_eleves
    from ar_selections s join ar_amenagements a on a.id = s.amenagement_id where a.chapitre_id = old.id;
  select count(distinct c.classe_id) into v_classes
    from ar_amenagements_classe c join ar_amenagements a on a.id = c.amenagement_id where a.chapitre_id = old.id;
  select count(*) into v_libres from ar_amenagements_libres where chapitre_id = old.id;
  if v_eleves > 0 or v_classes > 0 or v_libres > 0 then
    raise exception 'Suppression refusée : les aménagements de ce chapitre sont cochés pour % élève(s) et % classe(s)%. Désactivez ses aménagements plutôt.',
      v_eleves, v_classes,
      case when v_libres > 0 then format(', et %s aménagement(s) libre(s) lui sont rattachés', v_libres) else '' end
      using errcode = 'P0001';
  end if;
  return old;
end $$;

drop trigger if exists ar_amenagements_suppression_gardee on ar_amenagements;
create trigger ar_amenagements_suppression_gardee before delete on ar_amenagements
  for each row execute function ar_amenagement_suppression_gardee();

drop trigger if exists ar_chapitres_suppression_gardee on ar_chapitres;
create trigger ar_chapitres_suppression_gardee before delete on ar_chapitres
  for each row execute function ar_chapitre_suppression_gardee();

commit;

-- Vérification (attendu : 2 lignes) :
--   select tgname from pg_trigger where tgname in ('ar_amenagements_suppression_gardee', 'ar_chapitres_suppression_gardee');
