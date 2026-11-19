-- AménagActif — journal des messages aux utilisateurs (« Nouveautés », points d'attention) envoyés par un administrateur.
-- À exécuter à la main dans le SQL Editor Supabase AVANT le déploiement du code. Idempotent.
--
-- Une ligne = un envoi réel (pas les exemplaires de test). Sert à :
--  * afficher l'historique à l'administrateur ;
--  * refuser un double envoi accidentel (même sujet et même texte en moins de 10 minutes).
-- Table lue et écrite uniquement par /api/annonces (service role) : RLS actif, aucune politique,
-- aucun GRANT à anon ni authenticated. Le corps du message est conservé : il ne contient aucune adresse.

begin;

create table if not exists ar_annonces (
  id uuid primary key default gen_random_uuid(),
  sujet text not null check (char_length(sujet) between 1 and 120),
  corps text not null check (char_length(corps) between 1 and 5000),
  roles text[] not null,
  nb_destinataires integer not null check (nb_destinataires >= 0),
  nb_echecs integer not null default 0 check (nb_echecs >= 0),
  envoye_par uuid references auth.users(id) on delete set null,
  envoye_le timestamptz not null default now()
);
create index if not exists ar_annonces_envoye_le_idx on ar_annonces (envoye_le desc);

alter table ar_annonces enable row level security;

revoke all on ar_annonces from public, anon, authenticated;
grant select, insert on ar_annonces to service_role;

commit;

-- Vérifications :
-- 1) select has_table_privilege('authenticated','public.ar_annonces','select');   -- false
-- 2) select rowsecurity from pg_tables where tablename = 'ar_annonces';           -- true
