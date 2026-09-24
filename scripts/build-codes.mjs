// Génère supabase/seed/codes_catalogue.json (source de vérité des codes stables)
// puis la migration 20260924c. Usage : node scripts/build-codes.mjs
// Les codes sont IMMUABLES : ne jamais en changer un après mise en production.
import { writeFileSync, readFileSync } from 'fs';

const slugs = {
  1: ['supports', [
    'mise_en_page', 'doubler_espaces_reponse', 'carte_mentale_non', 'carte_mentale_oui',
    'cours_jdc_temoins', 'noter_tableau_tout', 'photos_tableau', 'consignes_epurees',
    'consignes_en_evidence', 'consignes_sequencees', 'consigne_avant_support',
    'verif_comprehension_consignes', 'reformuler_consignes', 'cours_a3',
    'tableaux_ligne_sur_deux', 'dictionnaire_annote', 'outils_personnels',
    'liste_materiel', 'cours_recto_seul', 'arial_14']],
  5: ['lecture', [
    'livres_audio', 'stylo_lecture', 'preparer_textes_longs', 'cache_latte',
    'chuchoteur', 'lire_voix_haute', 'fluorer_lignes', 'voix_haute_sans_preparation_non',
    'voix_haute_jamais', 'numeroter_lignes', 'loupe', 'fluo_oui', 'fluo_non']],
  7: ['sciences', [
    'calculatrice', 'calculs_colonnes', 'outils_geometrie', 'traces_non_evalues', 'problemes_epures']],
  9: ['numerique', [
    'dictionnaire_image', 'filmer_ou_tutoriels', 'outil_informatise', 'cours_numerise_pdf']],
};

const cat = JSON.parse(readFileSync('supabase/seed/catalogue.json', 'utf8'));
const sortie = { version: 1, chapitres: [] };
for (const [ordre, [chap, liste]] of Object.entries(slugs)) {
  const items = liste.map((slug, i) => ({ ordre: i + 1, code: `ar_${chap}_${slug}` }));
  sortie.chapitres.push({ ordre: Number(ordre), code: chap, items });
}
writeFileSync('supabase/seed/codes_catalogue.json', JSON.stringify(sortie, null, 2) + '\n');

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const lignesChap = sortie.chapitres.map((c) => `  (${c.ordre}, ${q(c.code)})`).join(',\n');
const lignesItems = sortie.chapitres.flatMap((c) => c.items.filter((i) => i.code !== 'ar_supports_arial_14')
  .map((i) => `  (${c.ordre}, ${i.ordre}, ${q(i.code)})`)).join(',\n');

const sql = `-- AménagActif : codes stables du catalogue (chapitres 1, 5, 7, 9) + AR « Arial 14 ».
-- Généré par scripts/build-codes.mjs à partir de supabase/seed/codes_catalogue.json.
-- Les codes servent de clé de contrat vers d'autres apps : ils sont IMMUABLES (trigger)
-- même si le libellé est renommé dans l'écran Administration.
--
-- Appariement des lignes existantes : (ordre du chapitre, ordre de l'aménagement), pas le
-- libellé, car un libellé a pu être modifié via l'écran Administration depuis le seed.
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
${lignesChap}
) as v(ordre, code)
where c.ordre = v.ordre and c.code is null;

-- Codes des aménagements existants
update ar_amenagements a set code = v.code
from (values
${lignesItems}
) as v(chap_ordre, ordre, code)
join ar_chapitres c on c.ordre = v.chap_ordre
where a.chapitre_id = c.id and a.ordre = v.ordre and a.code is null;

-- Nouvel AR « Arial 14 » (chapitre 1). Arial 12 = AU par défaut (bloc « Mise en page »),
-- Arial 14 = AR, l'AR l'emporte. Ajouté seulement s'il n'existe pas déjà.
insert into ar_amenagements (chapitre_id, ordre, libelle, type, actif, code)
select c.id,
       coalesce((select max(a.ordre) from ar_amenagements a where a.chapitre_id = c.id), 0) + 1,
       'Imprimer les documents en police Arial 14 (à la place de l''Arial 12 par défaut)',
       'AR', true, 'ar_supports_arial_14'
from ar_chapitres c
where c.ordre = 1
  and not exists (select 1 from ar_amenagements where code = 'ar_supports_arial_14');

commit;

-- ===== Contrôles à lancer après exécution =====
-- 1) Aménagements des chapitres 1/5/7/9 SANS code (attendu : aucune ligne ; sinon corriger à la main
--    ou décider du code, jamais par renommage) :
--   select c.ordre as chap, a.ordre, a.libelle from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
--   where c.ordre in (1,5,7,9) and a.code is null order by 1,2;
-- 2) Codes attribués, à relire contre le libellé (détecte un décalage d'ordre) :
--   select c.ordre as chap, a.ordre, a.code, a.libelle from ar_amenagements a join ar_chapitres c on c.id = a.chapitre_id
--   where a.code is not null order by 1,2;
-- 3) Chapitres codés (attendu : 4 lignes) :
--   select ordre, code, titre from ar_chapitres where code is not null order by ordre;
`;
writeFileSync('supabase/migrations/20260924c_amenagactif_codes_catalogue.sql', sql);
