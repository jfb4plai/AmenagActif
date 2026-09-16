-- AménagActif — le référent PLAI passe de « par élève » à « par classe ».
-- Décision JF (2026-09-16) : un enseignant doit pouvoir contacter le·s
-- référent·e·s PLAI de sa classe sans devoir identifier qui suit quel élève.
-- Remplace ar_eleves.referent_plai_nom (texte libre, un ou plusieurs noms
-- séparés par une virgule) par le même champ sur ar_classes.
-- ATTENTION : supprime définitivement les valeurs déjà saisies par élève
-- (accepté par JF — données de test uniquement à ce stade).
-- À exécuter après 20260916_amenagactif_commentaires_niveaux.sql.

begin;

alter table ar_classes add column if not exists referent_plai_nom text not null default '';

alter table ar_eleves drop column if exists referent_plai_nom;

commit;
