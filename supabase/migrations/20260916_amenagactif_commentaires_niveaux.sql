-- AménagActif — commentaire libre par élève (temporalité différente des AR/AU,
-- ex. "décès de la grand-mère") + niveaux ciblés pour les comptes direction
-- (une école peut avoir plusieurs directions, une par groupe de niveaux).
-- À exécuter après 20260904b_amenagactif_referents.sql.

begin;

alter table ar_eleves add column if not exists commentaire text not null default '';

-- null/vide = visible sur toutes les classes de l'école (comportement actuel,
-- rétrocompatible pour les écoles à direction unique).
alter table ar_profils_acces add column if not exists niveaux text[];

commit;
