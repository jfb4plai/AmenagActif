-- AménagActif — statut IPT/PAR par élève (Intégration Permanente Totale /
-- Protocole d'Aménagements Raisonnables). Champ de tri, ne conditionne
-- aucun affichage de fiche (voir spec 2026-09-22, section 1).

begin;

-- Seules des données de test ("École test") existent à ce jour : on les
-- bascule sur 'PAR' avant de rendre la colonne obligatoire, pour que la
-- migration ne casse pas si des lignes de test subsistent à l'exécution.
alter table ar_eleves add column if not exists statut text;
update ar_eleves set statut = 'PAR' where statut is null;
alter table ar_eleves alter column statut set not null;
alter table ar_eleves add constraint ar_eleves_statut_check check (statut in ('IPT', 'PAR'));

commit;
