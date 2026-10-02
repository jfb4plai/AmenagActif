-- AménagActif — reprise des élèves d'une année à l'autre.
-- À exécuter APRÈS 20261002_amenagactif_dispositifs.sql, AVANT le déploiement du front.
-- ar_cloner_classes et ar_reprendre_eleve sont SECURITY INVOKER (RLS de l'appelant).

begin;

-- ── Marqueur « repris de l'année précédente, à confirmer » ──
alter table ar_selections          add column if not exists a_confirmer boolean not null default false;
alter table ar_amenagements_libres add column if not exists a_confirmer boolean not null default false;
alter table ar_amenagements_classe add column if not exists a_confirmer boolean not null default false;

-- ── Devenir d'un élève non repris dans la même implantation ──
-- transfert : change d'implantation (file « à réaffecter » de l'admin)
-- termine   : fin de parcours / quitte le réseau (rien à faire)
alter table ar_eleves add column if not exists devenir text
  check (devenir in ('transfert', 'termine'));

-- ── Un élève N ne peut avoir qu'un successeur ──
create unique index if not exists ar_eleves_precedent_uniq
  on ar_eleves (eleve_precedent_id) where eleve_precedent_id is not null;

-- ── ar_amenagements_classe n'a plus de politique UPDATE (20260924) : nécessaire pour « confirmer » ──
drop policy if exists ar_amgt_classe_update on ar_amenagements_classe;
create policy ar_amgt_classe_update on ar_amenagements_classe for update to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

-- ── 1. Cloner les classes d'une année vers une autre (idempotent) ──
-- Copie nom, niveau, référent PLAI. Copie les AU (a_confirmer) uniquement des classes créées ici.
-- Deux instructions séparées : la 2e doit « voir » les classes insérées par la 1re (RLS).
create or replace function ar_cloner_classes(p_ecole uuid, p_source uuid, p_cible uuid)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_nouvelles uuid[];
begin
  with ins as (
    insert into ar_classes (ecole_id, annee_id, nom, niveau, referent_plai_nom)
    select ecole_id, p_cible, nom, niveau, referent_plai_nom
    from ar_classes
    where ecole_id = p_ecole and annee_id = p_source
    on conflict (ecole_id, annee_id, nom) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_nouvelles from ins;

  insert into ar_amenagements_classe (classe_id, amenagement_id, cree_par, a_confirmer)
  select cc.id, ac.amenagement_id, auth.uid(), true
  from ar_classes cc
  join ar_classes cs on cs.ecole_id = cc.ecole_id and cs.annee_id = p_source and cs.nom = cc.nom
  join ar_amenagements_classe ac on ac.classe_id = cs.id
  where cc.id = any(v_nouvelles);

  return coalesce(array_length(v_nouvelles, 1), 0);
end $$;

-- ── 2. Reprendre un élève dans une classe de l'année suivante ──
-- Lève 23505 (index unique) si l'élève a déjà un successeur.
create or replace function ar_reprendre_eleve(p_source uuid, p_classe_cible uuid)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new uuid;
begin
  -- referent_plai_nom n'existe plus sur ar_eleves (supprimée par 20260916b : il vit sur ar_classes).
  insert into ar_eleves (classe_id, prenom, initiale_nom, statut, commentaire, eleve_precedent_id)
  select p_classe_cible, prenom, initiale_nom, statut, '', id
  from ar_eleves where id = p_source
  returning id into v_new;

  if v_new is null then
    raise exception 'eleve_source_introuvable' using errcode = 'P0002';
  end if;

  insert into ar_selections (eleve_id, amenagement_id, cree_par, a_confirmer)
  select v_new, amenagement_id, auth.uid(), true
  from ar_selections where eleve_id = p_source;

  insert into ar_amenagements_libres (eleve_id, chapitre_id, texte, cree_par, a_confirmer)
  select v_new, chapitre_id, texte, auth.uid(), true
  from ar_amenagements_libres where eleve_id = p_source;

  return v_new;
end $$;

-- ── 3. Quels élèves ont déjà un successeur (même dans une implantation que l'appelant ne lit pas) ──
-- SECURITY DEFINER : ne renvoie que des ids parmi ceux passés en argument, aucune donnée d'élève.
create or replace function ar_eleves_deja_repris(p_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select eleve_precedent_id from ar_eleves where eleve_precedent_id = any(p_ids);
$$;

revoke all on function ar_cloner_classes(uuid, uuid, uuid) from public, anon;
revoke all on function ar_reprendre_eleve(uuid, uuid)      from public, anon;
revoke all on function ar_eleves_deja_repris(uuid[])       from public, anon;
grant execute on function ar_cloner_classes(uuid, uuid, uuid) to authenticated;
grant execute on function ar_reprendre_eleve(uuid, uuid)      to authenticated;
grant execute on function ar_eleves_deja_repris(uuid[])       to authenticated;

commit;
