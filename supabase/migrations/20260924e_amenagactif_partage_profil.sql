-- AménagActif : codes automatiques (chapitres et aménagements) + drapeau partage_profil.
--
-- À EXÉCUTER APRÈS 20260924b, 20260924c et 20260924d, ET AVANT la fusion du code applicatif
-- (le code applicatif sélectionne la colonne partage_profil : sans elle, les écrans échouent).
-- Idempotente : peut être rejouée sans écraser les choix faits ensuite par l'administrateur.
--
-- Règles :
--  1. Tout nouvel élément du catalogue (AR ou AU) et tout nouveau chapitre reçoivent un code
--     automatique par déclencheur BEFORE INSERT, quel que soit l'écran ou l'import utilisé.
--  2. Un code déjà posé n'est JAMAIS modifié (trigger ar_code_immuable de la migration c).
--  3. Le périmètre transmis aux autres apps n'est plus défini par un numéro de chapitre mais par
--     le drapeau ar_amenagements.partage_profil (défaut true : un nouvel élément est transmis).
--     Le drapeau peut être décoché (« Ne pas transmettre aux autres apps »), exception rare.
--
-- Aucune nouvelle table : pas de GRANT à ajouter. La colonne partage_profil est couverte par la
-- politique d'écriture existante ar_ref_write_amgt (migration 20260903, ligne 167 : for all,
-- using/with check ar_is_plai(), qui délègue à ar_is_admin() depuis 20260904_amenagactif_roles.sql
-- lignes 24-27). Une politique de ligne s'applique à toutes les colonnes, présentes ou futures.

begin;

-- ===== 1. Fonction pure ar_slug =====
create or replace function ar_slug(t text) returns text
language plpgsql immutable as $$
declare s text;
begin
  s := lower(coalesce(t, ''));
  s := replace(replace(s, 'œ', 'oe'), 'æ', 'ae');
  s := translate(s, 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
  s := regexp_replace(s, '[^a-z0-9]+', '_', 'g');   -- tout hors [a-z0-9] -> _, multiples réduits
  s := regexp_replace(s, '^_+|_+$', '', 'g');       -- _ de tête et de queue
  s := left(s, 40);
  s := regexp_replace(s, '^_+|_+$', '', 'g');       -- re-nettoyage après troncature
  if s = '' then return 'element'; end if;
  return s;
end;
$$;

-- ===== 2. Générateur de code de chapitre (unique) =====
create or replace function ar_code_chapitre_auto(p_titre text) returns text
language plpgsql as $$
declare base text; cand text; n int := 1;
begin
  base := ar_slug(regexp_replace(coalesce(p_titre, ''), '^\s*\d+\s*[.\-)]\s*', ''));
  cand := base;
  while exists (select 1 from ar_chapitres where code = cand) and n < 1000 loop
    n := n + 1;
    cand := base || '_' || n;
  end loop;
  return cand;
end;
$$;

create or replace function ar_chapitres_code_auto() returns trigger
language plpgsql as $$
begin
  if new.code is null then
    new.code := ar_code_chapitre_auto(new.titre);
  end if;
  return new;
end;
$$;
drop trigger if exists ar_chapitres_code_auto on ar_chapitres;
create trigger ar_chapitres_code_auto before insert on ar_chapitres
  for each row execute function ar_chapitres_code_auto();

-- ===== 3. Générateur de code d'aménagement (unique) =====
-- security definer : lit (et, en dernier recours, complète) ar_chapitres quel que soit l'appelant.
create or replace function ar_code_amenagement_auto(p_chapitre_id uuid, p_libelle text) returns text
language plpgsql security definer set search_path = public as $$
declare chap text; base text; cand text; n int := 1;
begin
  select code into chap from ar_chapitres where id = p_chapitre_id;
  if chap is null then
    select ar_code_chapitre_auto(titre) into chap from ar_chapitres where id = p_chapitre_id;
    if chap is not null then
      update ar_chapitres set code = chap where id = p_chapitre_id and code is null;
    else
      chap := 'element'; -- chapitre introuvable : la clé étrangère refusera de toute façon l'insertion
    end if;
  end if;
  base := 'ar_' || chap || '_' || ar_slug(p_libelle);
  cand := base;
  while exists (select 1 from ar_amenagements where code = cand) and n < 1000 loop
    n := n + 1;
    cand := base || '_' || n;
  end loop;
  return cand;
end;
$$;

create or replace function ar_amenagements_code_auto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.code is null then
    new.code := ar_code_amenagement_auto(new.chapitre_id, new.libelle);
  end if;
  return new;
end;
$$;
drop trigger if exists ar_amenagements_code_auto on ar_amenagements;
create trigger ar_amenagements_code_auto before insert on ar_amenagements
  for each row execute function ar_amenagements_code_auto();

-- ===== 4. Rattrapage des codes manquants (ne touche jamais un code déjà posé) =====
do $$
declare r record;
begin
  for r in select id, titre from ar_chapitres where code is null order by ordre loop
    update ar_chapitres set code = ar_code_chapitre_auto(r.titre) where id = r.id and code is null;
  end loop;
  for r in
    select a.id, a.chapitre_id, a.libelle
    from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
    where a.code is null order by c.ordre, a.ordre
  loop
    update ar_amenagements set code = ar_code_amenagement_auto(r.chapitre_id, r.libelle)
    where id = r.id and code is null;
  end loop;
end $$;

-- ===== 5. Drapeau partage_profil =====
-- RÈGLE DE REJEU : le rattrapage (false hors chapitres d'ordre 1, 5, 7, 9) n'est exécuté QUE si la
-- colonne vient d'être créée par ce bloc. Une seconde exécution ne touche donc à rien et n'écrase
-- JAMAIS les choix faits ensuite par l'administrateur. Le numéro d'ordre n'est utilisé qu'ici, une
-- seule fois, pour initialiser l'état existant ; il ne définit plus aucun périmètre ensuite.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ar_amenagements' and column_name = 'partage_profil'
  ) then
    alter table ar_amenagements add column partage_profil boolean not null default true;
    update ar_amenagements a set partage_profil = false
    from ar_chapitres c
    where c.id = a.chapitre_id and c.ordre not in (1, 5, 7, 9);
  end if;
end $$;

commit;

-- ===== Contrôles (lecture seule) : UNE SEULE table controle | resultat | attendu =====
select 'aménagements sans code' as controle,
       (select count(*) from ar_amenagements where code is null)::text as resultat, '0' as attendu
union all
select 'chapitres sans code',
       (select count(*) from ar_chapitres where code is null)::text, '0'
union all
select 'partage_profil = true dans les chapitres d''ordre 1/5/7/9',
       (select count(*) from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
         where c.ordre in (1,5,7,9) and a.partage_profil)::text, '45 (catalogue de production)'
union all
select 'partage_profil = true hors chapitres 1/5/7/9 (avant revue)',
       (select count(*) from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
         where c.ordre not in (1,5,7,9) and a.partage_profil)::text, '0 (à la première exécution ; augmente après la revue)'
union all
select 'trigger ar_chapitres_code_auto',
       (select count(*) from pg_trigger where tgname = 'ar_chapitres_code_auto' and not tgisinternal)::text, '1'
union all
select 'trigger ar_amenagements_code_auto',
       (select count(*) from pg_trigger where tgname = 'ar_amenagements_code_auto' and not tgisinternal)::text, '1'
union all
select 'colonne partage_profil',
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'ar_amenagements' and column_name = 'partage_profil')::text, '1'
union all
select 'ar_slug(''Rédiger le cours en Arial 14'')',
       ar_slug('Rédiger le cours en Arial 14'), 'rediger_le_cours_en_arial_14';

-- Test d'insertion : NON exécuté automatiquement. Mode d'emploi : lancer supabase/tests/partage_profil.sql
-- (transaction annulée par un rollback final ; le NOTICE final prouve le comportement).
