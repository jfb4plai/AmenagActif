-- AménagActif : codes stables du catalogue (chapitres 1, 5, 7, 9). Aucun élément n'est créé.
-- Généré par scripts/build-codes.mjs à partir de supabase/seed/codes_catalogue.json.
-- Les codes servent de clé de contrat vers d'autres apps : ils sont IMMUABLES (trigger)
-- même si le libellé est renommé dans l'écran Administration.
--
-- Appariement des lignes existantes : (ordre du chapitre, ordre de l'aménagement), pas le
-- libellé, car un libellé a pu être modifié via l'écran Administration depuis le seed.
-- Positions et libellés vérifiés contre la production le 2026-09-24 (export CSV de
-- ar_amenagements par JF) : ch.1 = 23 éléments, ch.5 = 13, ch.7 = 5, ch.9 = 4, soit 45.
-- Le bloc de garde en fin de transaction annule tout si ce total n'est pas atteint.
-- Après exécution, lancer les requêtes de contrôle en bas de fichier.
-- À exécuter à la main dans le SQL Editor Supabase, AVANT de fusionner le code applicatif
-- qui sélectionne la colonne code (sinon les écrans fiche et Administration échouent).

begin;

alter table ar_chapitres    add column if not exists code text;
alter table ar_amenagements add column if not exists code text;

create unique index if not exists ar_chapitres_code_uidx    on ar_chapitres (code)    where code is not null;
create unique index if not exists ar_amenagements_code_uidx on ar_amenagements (code) where code is not null;

alter table ar_chapitres    drop constraint if exists ar_chapitres_code_format;
alter table ar_chapitres    add constraint ar_chapitres_code_format check (code is null or code ~ '^[a-z0-9]+(_[a-z0-9]+)*$');
alter table ar_amenagements drop constraint if exists ar_amenagements_code_format;
alter table ar_amenagements add constraint ar_amenagements_code_format check (code is null or code ~ '^ar_[a-z0-9]+(_[a-z0-9]+)+$');

-- Immuabilité : un code posé ne change plus (le poser une première fois reste permis).
create or replace function ar_code_immuable() returns trigger
language plpgsql as $$
begin
  if old.code is not null and new.code is distinct from old.code then
    raise exception 'Le code % est immuable.', old.code using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists ar_chapitres_code_immuable on ar_chapitres;
create trigger ar_chapitres_code_immuable before update on ar_chapitres for each row execute function ar_code_immuable();
drop trigger if exists ar_amenagements_code_immuable on ar_amenagements;
create trigger ar_amenagements_code_immuable before update on ar_amenagements for each row execute function ar_code_immuable();

-- Codes des chapitres
update ar_chapitres c set code = v.code
from (values
  (1, 'supports'),
  (5, 'lecture'),
  (7, 'sciences'),
  (9, 'numerique')
) as v(ordre, code)
where c.ordre = v.ordre and c.code is null;

-- Codes des aménagements existants
update ar_amenagements a set code = v.code
from (values
  (1, 1, 'ar_supports_mise_en_page'),
  (1, 2, 'ar_supports_doubler_espaces_reponse'),
  (1, 3, 'ar_supports_carte_mentale_non'),
  (1, 4, 'ar_supports_carte_mentale_oui'),
  (1, 5, 'ar_supports_cours_jdc_temoins'),
  (1, 6, 'ar_supports_noter_tableau_tout'),
  (1, 7, 'ar_supports_photos_tableau'),
  (1, 8, 'ar_supports_consignes_epurees'),
  (1, 9, 'ar_supports_consignes_en_evidence'),
  (1, 10, 'ar_supports_consignes_sequencees'),
  (1, 11, 'ar_supports_consigne_avant_support'),
  (1, 12, 'ar_supports_verif_comprehension_consignes'),
  (1, 13, 'ar_supports_reformuler_consignes'),
  (1, 14, 'ar_supports_cours_a3'),
  (1, 15, 'ar_supports_tableaux_ligne_sur_deux'),
  (1, 16, 'ar_supports_dictionnaire_annote'),
  (1, 17, 'ar_supports_outils_personnels'),
  (1, 18, 'ar_supports_liste_materiel'),
  (1, 19, 'ar_supports_cours_recto_seul'),
  (1, 20, 'ar_supports_cours_braille'),
  (1, 21, 'ar_supports_arial_14'),
  (1, 22, 'ar_supports_codes_graphiques'),
  (1, 23, 'ar_supports_recto_verso_intelligent'),
  (5, 1, 'ar_lecture_livres_audio'),
  (5, 2, 'ar_lecture_stylo_lecture'),
  (5, 3, 'ar_lecture_preparer_textes_longs'),
  (5, 4, 'ar_lecture_cache_latte'),
  (5, 5, 'ar_lecture_chuchoteur'),
  (5, 6, 'ar_lecture_lire_voix_haute'),
  (5, 7, 'ar_lecture_fluorer_lignes'),
  (5, 8, 'ar_lecture_voix_haute_sans_preparation_non'),
  (5, 9, 'ar_lecture_voix_haute_jamais'),
  (5, 10, 'ar_lecture_numeroter_lignes'),
  (5, 11, 'ar_lecture_loupe'),
  (5, 12, 'ar_lecture_fluo_oui'),
  (5, 13, 'ar_lecture_fluo_non'),
  (7, 1, 'ar_sciences_calculatrice'),
  (7, 2, 'ar_sciences_calculs_colonnes'),
  (7, 3, 'ar_sciences_outils_geometrie'),
  (7, 4, 'ar_sciences_traces_non_evalues'),
  (7, 5, 'ar_sciences_problemes_epures'),
  (9, 1, 'ar_numerique_dictionnaire_image'),
  (9, 2, 'ar_numerique_filmer_ou_tutoriels'),
  (9, 3, 'ar_numerique_outil_informatise'),
  (9, 4, 'ar_numerique_cours_numerise_pdf')
) as v(chap_ordre, ordre, code)
join ar_chapitres c on c.ordre = v.chap_ordre
where a.chapitre_id = c.id and a.ordre = v.ordre and a.code is null;

-- Garde : les 45 positions attendues doivent toutes avoir reçu un code, sinon le catalogue de
-- cet environnement diffère de la production vérifiée : tout est annulé (aucune écriture).
do $$
begin
  if (select count(*) from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
        where c.ordre in (1, 5, 7, 9) and a.code is not null) <> 45 then
    raise exception 'Catalogue inattendu : 45 aménagements codés attendus (ch. 1, 5, 7, 9). Aucune modification appliquée.';
  end if;
end $$;

commit;

-- ===== Contrôles à lancer après exécution =====
-- 1) Aménagements des chapitres 1/5/7/9 SANS code (attendu : aucune ligne ; un élément ajouté plus
--    tard via l'Administration reste sans code : il sera « non appliqué automatiquement ») :
--   select c.ordre as chap, a.ordre, a.libelle from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
--   where c.ordre in (1,5,7,9) and a.code is null order by 1,2;
-- 2) Codes attribués, à relire contre le libellé (détecte un décalage d'ordre) :
--   select c.ordre as chap, a.ordre, a.code, a.libelle from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
--   where a.code is not null order by 1,2;
-- 3) Chapitres codés (attendu : 4 lignes) :
--   select ordre, code, titre from ar_chapitres where code is not null order by ordre;
