-- Seed des implantations + année active.
-- ⚠️ Remplacer les noms/implantations par les 11 implantations réelles avant exécution.

insert into ar_annees (libelle, active) values ('2025-2026', true)
on conflict (libelle) do update set active = true;

insert into ar_ecoles (nom, implantation) values
  ('Implantation 1', 'impl-1'),
  ('Implantation 2', 'impl-2'),
  ('Implantation 3', 'impl-3'),
  ('Implantation 4', 'impl-4'),
  ('Implantation 5', 'impl-5'),
  ('Implantation 6', 'impl-6'),
  ('Implantation 7', 'impl-7'),
  ('Implantation 8', 'impl-8'),
  ('Implantation 9', 'impl-9'),
  ('Implantation 10', 'impl-10'),
  ('Implantation 11', 'impl-11')
on conflict do nothing;
