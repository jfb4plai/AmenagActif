-- AménagActif — changement de classe en cours d'année + alignement de la reprise annuelle sur les dispositifs.
-- À exécuter APRÈS 20261003_amenagactif_reprise_annee.sql, AVANT le déploiement du front. Idempotent.
--  * Même ligne élève (même id) : AR, libres, commentaire, identité suivent l'élève ; les AU de la nouvelle classe s'appliquent d'eux-mêmes.
--  * Fonctions SECURITY INVOKER : la RLS de l'appelant s'applique. Droit « structure » exigé sur les DEUX implantations.
--  * Aucune nouvelle table : pas de GRANT de table à ajouter. EXECUTE accordé aux fonctions (authenticated seulement).
--  * Les exceptions portent un message court : dispositif_incompatible: <titres>, droit_insuffisant, annee_differente,
--    classe_cible_introuvable, eleve_introuvable, meme_classe (traduits côté app par messageErreurChangement).

begin;

-- ── 1. Trace du dernier changement de classe ──
alter table ar_eleves add column if not exists classe_changee_le timestamptz;
alter table ar_eleves add column if not exists classe_precedente_nom text;

-- ── 2. Dispositifs de la classe d'arrivée qui rendraient les AR de l'élève invisibles ──
-- (dispositif appliqué à toute la classe ET élève avec des cases ou des aménagements libres dans ce dispositif).
create or replace function ar_conflits_dispositif(p_eleve uuid, p_classe_cible uuid)
returns setof text
language sql stable security invoker set search_path = public as $$
  select distinct ch.titre
  from ar_classe_dispositifs m
  join ar_chapitres ch on ch.id = m.chapitre_id and ch.est_dispositif
  where m.classe_id = p_classe_cible
    and m.pour_toute_la_classe
    and (
      exists (
        select 1 from ar_selections s
        join ar_amenagements a on a.id = s.amenagement_id
        where s.eleve_id = p_eleve and a.chapitre_id = m.chapitre_id
      )
      or exists (
        select 1 from ar_amenagements_libres l
        where l.eleve_id = p_eleve and l.chapitre_id = m.chapitre_id
      )
    );
$$;

-- ── 3. Changer un élève de classe (même année scolaire) ──
create or replace function ar_changer_classe_eleve(p_eleve uuid, p_classe_cible uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_src record;
  v_cib record;
  v_conflits text[];
begin
  select c.id, c.nom, c.ecole_id, c.annee_id into v_src
  from ar_eleves e join ar_classes c on c.id = e.classe_id
  where e.id = p_eleve;
  if not found then
    raise exception 'eleve_introuvable' using errcode = 'P0002';
  end if;

  select id, ecole_id, annee_id into v_cib from ar_classes where id = p_classe_cible;
  if not found then
    raise exception 'classe_cible_introuvable' using errcode = 'P0002';
  end if;

  if v_src.id = v_cib.id then
    raise exception 'meme_classe' using errcode = 'P0001';
  end if;
  if v_src.annee_id <> v_cib.annee_id then
    raise exception 'annee_differente' using errcode = 'P0001';
  end if;
  if not (ar_can_editer_structure_ecole(v_src.ecole_id) and ar_can_editer_structure_ecole(v_cib.ecole_id)) then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;

  select array_agg(c.titre) into v_conflits from ar_conflits_dispositif(p_eleve, p_classe_cible) as c(titre);
  if v_conflits is not null then
    raise exception 'dispositif_incompatible: %', array_to_string(v_conflits, ' | ') using errcode = 'P0001';
  end if;

  update ar_eleves
     set classe_id = p_classe_cible, classe_changee_le = now(), classe_precedente_nom = v_src.nom
   where id = p_eleve;
  update ar_selections          set a_confirmer = true where eleve_id = p_eleve;
  update ar_amenagements_libres set a_confirmer = true where eleve_id = p_eleve;
end $$;

-- ── 4. Reprise annuelle : cloner aussi le MODE des dispositifs (AR/AU) des classes créées ──
-- (remplace la version de 20261003_amenagactif_reprise_annee.sql : seule la 3e instruction est ajoutée)
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

  insert into ar_classe_dispositifs (classe_id, chapitre_id, pour_toute_la_classe)
  select cc.id, m.chapitre_id, m.pour_toute_la_classe
  from ar_classes cc
  join ar_classes cs on cs.ecole_id = cc.ecole_id and cs.annee_id = p_source and cs.nom = cc.nom
  join ar_classe_dispositifs m on m.classe_id = cs.id
  where cc.id = any(v_nouvelles)
  on conflict (classe_id, chapitre_id) do nothing;

  return coalesce(array_length(v_nouvelles, 1), 0);
end $$;

-- ── 5. Reprise annuelle : ne pas copier les AR / libres d'un dispositif que la classe cible applique à toute la classe ──
-- (ils y seraient invisibles ; l'AU de la classe couvre l'élève. Rien n'est supprimé dans l'année source.)
create or replace function ar_reprendre_eleve(p_source uuid, p_classe_cible uuid)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new uuid;
begin
  insert into ar_eleves (classe_id, prenom, initiale_nom, statut, commentaire, eleve_precedent_id)
  select p_classe_cible, prenom, initiale_nom, statut, '', id
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

revoke all on function ar_conflits_dispositif(uuid, uuid)    from public, anon;
revoke all on function ar_changer_classe_eleve(uuid, uuid)   from public, anon;
grant execute on function ar_conflits_dispositif(uuid, uuid)  to authenticated;
grant execute on function ar_changer_classe_eleve(uuid, uuid) to authenticated;
-- ar_cloner_classes / ar_reprendre_eleve : create or replace conserve les droits de 20261003 (revoke/grant déjà posés).

commit;

-- Vérifications (attendu : 2 lignes puis 2 lignes) :
--   select column_name from information_schema.columns where table_name = 'ar_eleves' and column_name in ('classe_changee_le', 'classe_precedente_nom');
--   select proname from pg_proc where proname in ('ar_conflits_dispositif', 'ar_changer_classe_eleve');
