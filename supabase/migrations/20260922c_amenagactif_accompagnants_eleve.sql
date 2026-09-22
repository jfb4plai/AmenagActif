-- AménagActif — accompagnants (agent_plai) assignés par élève, multi-écoles.
-- Remplace le modèle "agent_plai rattaché à une seule ecole_id" par une
-- assignation élève par élève, gérée par le référent/la direction de
-- l'école de l'élève. Voir spec 2026-09-22, section 3.

begin;

create table ar_accompagnants_eleve (
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  cree_le  timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (eleve_id, user_id)
);

alter table ar_accompagnants_eleve enable row level security;

-- Les comptes agent_plai existants perdent leur rattachement d'école fixe :
-- leur périmètre devient entièrement déterminé par les assignations ci-dessus.
update ar_profils_acces set ecole_id = null where role = 'agent_plai';

-- ── Helpers ──
create or replace function ar_is_accompagnant_eleve(target_eleve uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_accompagnants_eleve
    where eleve_id = target_eleve and user_id = auth.uid()
  );
$$;

create or replace function ar_is_accompagnant_classe(target_classe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_accompagnants_eleve ae
    join ar_eleves e on e.id = ae.eleve_id
    where e.classe_id = target_classe and ae.user_id = auth.uid()
  );
$$;

-- ar_can_read_ecole étend la lecture : un agent avec au moins un élève
-- assigné dans une école lit toute cette école (même logique de périmètre
-- que le modèle précédent, déclenchée par l'assignation plutôt que par un
-- rattachement fixe). Toutes les politiques de lecture existantes qui
-- appellent déjà ar_can_read_ecole(...) (écoles, classes, élèves,
-- enseignants, AU/AR/libres/snapshots) en bénéficient automatiquement,
-- sans toucher à une seule autre politique.
create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces where user_id = auth.uid() and ecole_id = target
  ) or exists (
    select 1 from ar_accompagnants_eleve ae
    join ar_eleves e on e.id = ae.eleve_id
    join ar_classes c on c.id = e.classe_id
    where ae.user_id = auth.uid() and c.ecole_id = target
  );
$$;

-- ── Écriture élargie pour l'accompagnant assigné ──
drop policy if exists ar_eleves_write on ar_eleves;
create policy ar_eleves_write on ar_eleves for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_eleve(id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_eleve(id));

drop policy if exists ar_selections_write on ar_selections;
create policy ar_selections_write on ar_selections for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id));

drop policy if exists ar_libres_write on ar_amenagements_libres;
create policy ar_libres_write on ar_amenagements_libres for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id));

drop policy if exists ar_amgt_classe_write on ar_amenagements_classe;
create policy ar_amgt_classe_write on ar_amenagements_classe for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_classe(classe_id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_classe(classe_id));

-- ── ar_accompagnants_eleve : lecture par l'agent concerné ou par
-- référent/direction/admin de l'école de l'élève ; écriture réservée à
-- référent/direction/admin (les agents ne s'auto-assignent pas).
create policy ar_accomp_read on ar_accompagnants_eleve for select to authenticated
  using (
    user_id = auth.uid()
    or ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id))
  );
create policy ar_accomp_write on ar_accompagnants_eleve for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));

commit;
