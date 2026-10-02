-- AménagActif — Dispositifs : groupes d'aménagements AR (par élève) ou AU (toute la classe) selon la classe.
-- À exécuter à la main dans le SQL Editor Supabase AVANT de déployer le code. Idempotent.
--  * ar_chapitres.est_dispositif : marque un chapitre comme dispositif.
--  * ar_classe_dispositifs : mode par (classe, dispositif). Absence de ligne = mode AR.
--  * Les items d'un dispositif gardent type 'AR' ; le type effectif est calculé côté app.
--  * Aucune politique avec EXISTS auto-joint : fonctions security definer existantes uniquement.
--  * Écriture réservée à ar_can_editer_structure_ecole (admin, référent PLAI, direction ; pas agent_plai).

begin;

alter table ar_chapitres add column if not exists est_dispositif boolean not null default false;

create table if not exists ar_classe_dispositifs (
  classe_id uuid not null references ar_classes(id) on delete cascade,
  chapitre_id uuid not null references ar_chapitres(id) on delete cascade,
  pour_toute_la_classe boolean not null default false,
  modifie_le timestamptz not null default now(),
  primary key (classe_id, chapitre_id)
);

alter table ar_classe_dispositifs enable row level security;

drop policy if exists ar_classe_disp_read on ar_classe_dispositifs;
create policy ar_classe_disp_read on ar_classe_dispositifs for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

drop policy if exists ar_classe_disp_insert on ar_classe_dispositifs;
create policy ar_classe_disp_insert on ar_classe_dispositifs for insert to authenticated
  with check (ar_can_editer_structure_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

drop policy if exists ar_classe_disp_update on ar_classe_dispositifs;
create policy ar_classe_disp_update on ar_classe_dispositifs for update to authenticated
  using (ar_can_editer_structure_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_editer_structure_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

drop policy if exists ar_classe_disp_delete on ar_classe_dispositifs;
create policy ar_classe_disp_delete on ar_classe_dispositifs for delete to authenticated
  using (ar_can_editer_structure_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

grant select, insert, update, delete on ar_classe_dispositifs to authenticated;
grant select, insert, update, delete on ar_classe_dispositifs to service_role;

-- Premier dispositif, groupe vide (les items sont ajoutés ensuite par l'admin dans Administration).
insert into ar_chapitres (ordre, titre, est_dispositif)
select coalesce(max(ordre), 0) + 1, 'Dispositif de régulation des comportements', true
from ar_chapitres
where not exists (select 1 from ar_chapitres where titre = 'Dispositif de régulation des comportements');

commit;

-- Vérification (attendu : 1 ligne, est_dispositif = true) :
--   select ordre, titre, est_dispositif from ar_chapitres where est_dispositif;
