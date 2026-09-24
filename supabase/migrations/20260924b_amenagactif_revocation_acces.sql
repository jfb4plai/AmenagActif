-- AménagActif — correctif de la révocation d'accès (audit 2026-09, C1).
-- Problème : révoquer un membre supprimait seulement ar_profils_acces ; ses lignes
-- ar_profils_acces_ecoles restaient, et ar_can_read_ecole() accordait la lecture
-- dès qu'une telle ligne existait, sans exiger de profil. Un ex-membre gardait la
-- lecture (élèves, commentaires, e-mails des enseignants).
--
-- Règle de conception : AUCUN EXISTS auto-joint sur la même table dans une
-- politique RLS (incident de récursion du 2026-09-23). Ici on ne touche à aucune
-- politique : seule la fonction security definer ar_can_read_ecole est redéfinie.
--
-- À exécuter à la main dans le SQL Editor Supabase. Idempotent.

begin;

-- (a) Nettoyage des lignes orphelines (utilisateur sans profil d'accès).
delete from ar_profils_acces_ecoles pe
where not exists (select 1 from ar_profils_acces p where p.user_id = pe.user_id);

-- (c) Cascade : supprimer le profil supprime ses rattachements d'écoles.
-- Compatible avec le schéma : ar_profils_acces.user_id est la clé primaire.
-- La FK vers auth.users existante est conservée (double cascade sans conflit).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ar_pae_profil_fk' and conrelid = 'public.ar_profils_acces_ecoles'::regclass
  ) then
    alter table ar_profils_acces_ecoles
      add constraint ar_pae_profil_fk
      foreign key (user_id) references ar_profils_acces(user_id) on delete cascade;
  end if;
end $$;

-- (b) Lecture : exige l'existence du profil, puis école legacy OU rattachement.
create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces p
    where p.user_id = auth.uid()
      and (
        p.ecole_id = target
        or exists (
          select 1 from ar_profils_acces_ecoles pe
          where pe.user_id = p.user_id and pe.ecole_id = target
        )
      )
  );
$$;

-- Aucune nouvelle table : pas de GRANT à ajouter.

commit;
