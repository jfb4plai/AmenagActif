-- AménagActif : nom de famille complet (saisie école uniquement, jamais dans les fiches ni les liens enseignants).
-- Non destructif. Les droits RLS/GRANT existants de ar_eleves couvrent la nouvelle colonne.
begin;

alter table ar_eleves add column if not exists nom_famille text not null default '';

-- La reprise annuelle copie aussi le nom de famille.
create or replace function ar_reprendre_eleve(p_source uuid, p_classe_cible uuid)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new uuid;
begin
  insert into ar_eleves (classe_id, prenom, nom_famille, initiale_nom, statut, commentaire, eleve_precedent_id)
  select p_classe_cible, prenom, nom_famille, initiale_nom, statut, '', id
  from ar_eleves where id = p_source
  returning id into v_new;

  if v_new is null then
    raise exception 'eleve_source_introuvable' using errcode = 'P0002';
  end if;

  insert into ar_selections (eleve_id, amenagement_id, cree_par, a_confirmer)
  select v_new, s.amenagement_id, auth.uid(), true
  from ar_selections s
  join ar_amenagements a on a.id = s.amenagement_id
  where s.eleve_id = p_source
    and not exists (
      select 1 from ar_classe_dispositifs m
      where m.classe_id = p_classe_cible and m.chapitre_id = a.chapitre_id and m.pour_toute_la_classe
    );

  insert into ar_amenagements_libres (eleve_id, chapitre_id, texte, cree_par, a_confirmer)
  select v_new, l.chapitre_id, l.texte, auth.uid(), true
  from ar_amenagements_libres l
  where l.eleve_id = p_source
    and not exists (
      select 1 from ar_classe_dispositifs m
      where m.classe_id = p_classe_cible and m.chapitre_id = l.chapitre_id and m.pour_toute_la_classe
    );

  return v_new;
end $$;

commit;

-- Vérification (attendu : 1 ligne) :
--   select column_name from information_schema.columns where table_name = 'ar_eleves' and column_name = 'nom_famille';
