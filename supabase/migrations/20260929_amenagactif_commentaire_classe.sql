-- Commentaire libre par classe (contexte utile à l'enseignant qui reçoit la fiche),
-- même principe que ar_eleves.commentaire (20260916_amenagactif_commentaires_niveaux.sql).
-- Colonnes nullables : les classes existantes n'en ont pas. RLS/GRANT inchangés :
-- ar_classes_update (ar_can_edit_ecole) couvre déjà la table entière.
begin;

alter table ar_classes
  add column if not exists commentaire text check (commentaire is null or char_length(commentaire) <= 500),
  add column if not exists commentaire_modifie_le timestamptz;

-- Date de dernière modification tenue à jour côté base (pas seulement par l'app) :
-- un commentaire périmé doit se voir sur la fiche. Un commentaire vidé repasse à null.
-- Ne lit aucune table : pas de risque de récursion RLS.
create or replace function ar_classes_maj_commentaire() returns trigger
language plpgsql as $$
begin
  new.commentaire := nullif(btrim(new.commentaire), '');
  if new.commentaire is distinct from old.commentaire then
    new.commentaire_modifie_le := case when new.commentaire is null then null else now() end;
  end if;
  return new;
end $$;

drop trigger if exists ar_classes_commentaire_maj on ar_classes;
create trigger ar_classes_commentaire_maj before update on ar_classes
  for each row execute function ar_classes_maj_commentaire();

commit;
