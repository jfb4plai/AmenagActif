-- AménagActif — nom de l'implantation FASE (distinct du nom d'école/établissement).
-- ar_ecoles.implantation (déjà existant) devient sémantiquement le numéro FASE ;
-- aucun changement de type ni de contrainte sur cette colonne.

begin;

alter table ar_ecoles add column if not exists implantation_nom text;

commit;
