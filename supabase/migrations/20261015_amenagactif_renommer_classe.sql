-- AménagActif — renommer une classe (colonne ar_classes.nom).
-- La politique ar_classes_update (ar_can_edit_ecole) inclut l'agent PLAI, qui doit pouvoir
-- modifier le référent PLAI et le commentaire de la classe, mais PAS son nom (décision JF
-- 2026-10-15 : même restriction que créer/supprimer une classe). Verrou par trigger sur
-- la seule colonne nom : référent PLAI, direction et admin passent (ar_can_editer_structure_ecole).
-- auth.uid() null = service_role / SQL éditeur : non bloqué.
-- Aucune table nouvelle, donc pas de GRANT à ajouter.

begin;

create or replace function ar_classes_controle_nom() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nom is distinct from old.nom
     and auth.uid() is not null
     and not ar_can_editer_structure_ecole(old.ecole_id) then
    raise exception 'Renommer une classe est réservé au référent PLAI, à la direction et à l''administrateur'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ar_classes_nom_controle on ar_classes;
create trigger ar_classes_nom_controle before update on ar_classes
  for each row execute function ar_classes_controle_nom();

commit;

-- Vérification après application :
--   select tgname from pg_trigger where tgrelid = 'ar_classes'::regclass and not tgisinternal;  -- contient ar_classes_nom_controle
