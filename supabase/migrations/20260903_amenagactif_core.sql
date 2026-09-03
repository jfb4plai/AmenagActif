-- AménagActif — schéma coeur. Projet partagé dfoaumjleqtxjeaplnna.
-- Toutes les tables préfixées ar_. NE PAS recréer profiles ni le trigger updated_at.

-- ============ Tables de référence ============
create table if not exists ar_annees (
  id uuid primary key default gen_random_uuid(),
  libelle text not null unique,               -- '2025-2026'
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ar_ecoles (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  implantation text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ar_chapitres (
  id uuid primary key default gen_random_uuid(),
  ordre int not null unique,
  titre text not null
);

create table if not exists ar_amenagements (
  id uuid primary key default gen_random_uuid(),
  chapitre_id uuid not null references ar_chapitres(id) on delete cascade,
  ordre int not null,
  libelle text not null,
  type text not null check (type in ('AU','AR')),
  actif boolean not null default true,
  unique (chapitre_id, ordre)
);

-- ============ Accès ============
create table if not exists ar_profils_acces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('plai','direction')),
  ecole_id uuid references ar_ecoles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists ar_referents_ecole (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null,
  fonction text not null check (fonction in ('direction','referent_ecole','plai')),
  created_at timestamptz not null default now()
);

-- ============ Métier ============
create table if not exists ar_classes (
  id uuid primary key default gen_random_uuid(),
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null,
  niveau text,
  created_at timestamptz not null default now(),
  unique (ecole_id, annee_id, nom)
);

create table if not exists ar_eleves (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references ar_classes(id) on delete cascade,
  prenom text not null,
  initiale_nom text not null default '',
  referent_plai_nom text not null default '',
  eleve_precedent_id uuid references ar_eleves(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists ar_amenagements_classe (
  classe_id uuid not null references ar_classes(id) on delete cascade,
  amenagement_id uuid not null references ar_amenagements(id) on delete cascade,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (classe_id, amenagement_id)
);

create table if not exists ar_selections (
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  amenagement_id uuid not null references ar_amenagements(id) on delete cascade,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (eleve_id, amenagement_id)
);

create table if not exists ar_amenagements_libres (
  id uuid primary key default gen_random_uuid(),
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  chapitre_id uuid references ar_chapitres(id) on delete set null,
  texte text not null,
  cree_le timestamptz not null default now(),
  cree_par uuid references auth.users(id)
);

create table if not exists ar_enseignants (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references ar_classes(id) on delete cascade,
  annee_id uuid not null references ar_annees(id) on delete cascade,
  nom text not null,
  email text not null,
  cours text,
  created_at timestamptz not null default now()
);

create table if not exists ar_fiche_snapshots (
  id uuid primary key default gen_random_uuid(),
  classe_id uuid not null references ar_classes(id) on delete cascade,
  fige_le timestamptz not null default now(),
  fige_par uuid references auth.users(id),
  contenu jsonb not null,
  envoi_le timestamptz
);

create table if not exists ar_envois (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references ar_fiche_snapshots(id) on delete cascade,
  enseignant_id uuid references ar_enseignants(id) on delete set null,
  destinataire_email text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente','simule','envoye','erreur')),
  erreur text,
  envoye_le timestamptz
);

-- ============ Helpers RLS ============
create or replace function ar_is_plai() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and role = 'plai' and ecole_id is null
  );
$$;

create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_plai() or exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and ecole_id = target
  );
$$;

-- ============ RLS ============
alter table ar_annees              enable row level security;
alter table ar_ecoles              enable row level security;
alter table ar_chapitres           enable row level security;
alter table ar_amenagements        enable row level security;
alter table ar_profils_acces       enable row level security;
alter table ar_referents_ecole     enable row level security;
alter table ar_classes             enable row level security;
alter table ar_eleves              enable row level security;
alter table ar_amenagements_classe enable row level security;
alter table ar_selections          enable row level security;
alter table ar_amenagements_libres enable row level security;
alter table ar_enseignants         enable row level security;
alter table ar_fiche_snapshots     enable row level security;
alter table ar_envois              enable row level security;

-- Référence : lecture pour tout authentifié, écriture PLAI
create policy ar_ref_read_annees   on ar_annees       for select to authenticated using (true);
create policy ar_ref_write_annees  on ar_annees       for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_ref_read_chap     on ar_chapitres    for select to authenticated using (true);
create policy ar_ref_write_chap    on ar_chapitres    for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_ref_read_amgt     on ar_amenagements for select to authenticated using (true);
create policy ar_ref_write_amgt    on ar_amenagements for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());

-- Accès
create policy ar_acces_self   on ar_profils_acces for select to authenticated using (user_id = auth.uid() or ar_is_plai());
create policy ar_acces_admin  on ar_profils_acces for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());

-- Écoles
create policy ar_ecoles_read  on ar_ecoles for select to authenticated using (ar_can_read_ecole(id));
create policy ar_ecoles_write on ar_ecoles for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());

-- Référents / classes (ecole_id direct)
create policy ar_ref_ecole_read  on ar_referents_ecole for select to authenticated using (ar_can_read_ecole(ecole_id));
create policy ar_ref_ecole_write on ar_referents_ecole for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_classes_read    on ar_classes for select to authenticated using (ar_can_read_ecole(ecole_id));
create policy ar_classes_write   on ar_classes for all    to authenticated using (ar_is_plai()) with check (ar_is_plai());
create policy ar_enseignants_read  on ar_enseignants for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_enseignants_write on ar_enseignants for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

-- Élèves & sélections (ecole via classe)
create policy ar_eleves_read  on ar_eleves for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_eleves_write on ar_eleves for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_amgt_classe_read  on ar_amenagements_classe for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_amgt_classe_write on ar_amenagements_classe for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_selections_read  on ar_selections for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));
create policy ar_selections_write on ar_selections for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_libres_read  on ar_amenagements_libres for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));
create policy ar_libres_write on ar_amenagements_libres for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_snap_read  on ar_fiche_snapshots for select to authenticated
  using (ar_can_read_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));
create policy ar_snap_write on ar_fiche_snapshots for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());

create policy ar_envois_read  on ar_envois for select to authenticated
  using (ar_is_plai());
create policy ar_envois_write on ar_envois for all to authenticated
  using (ar_is_plai()) with check (ar_is_plai());
