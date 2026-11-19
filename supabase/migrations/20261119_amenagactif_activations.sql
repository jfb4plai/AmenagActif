-- AménagActif — mémoire des comptes dont le mot de passe a été créé ou modifié (notification aux administrateurs).
-- À exécuter à la main dans le SQL Editor Supabase AVANT le déploiement du code. Idempotent.
--
-- Une ligne = un compte dont l'activation a été notifiée ; sa présence distingue « première activation » de
-- « mot de passe modifié ou réinitialisé » (notifié aussi, avec un libellé différent). derniere_notif sert
-- d'anti-répétition : au plus un courriel par compte et par intervalle (voir api/_lib/activation.js).
-- Table lue et écrite uniquement par les fonctions serveur /api (service role) : RLS actif, aucune politique,
-- aucun GRANT à anon ni authenticated.

begin;

create table if not exists ar_activations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notifie_le timestamptz not null default now(),
  derniere_notif timestamptz not null default now()
);

-- Si la table existait déjà (première version de ce fichier exécutée) : ajoute la colonne.
alter table ar_activations add column if not exists derniere_notif timestamptz not null default now();

alter table ar_activations enable row level security;

revoke all on ar_activations from anon, authenticated;
grant select, insert, update, delete on ar_activations to service_role;

-- Comptes qui ont déjà un mot de passe : repris pour que leur prochain changement soit annoncé comme
-- « modifié » et non comme « première activation ». Les invités pas encore activés n'ont pas de mot de passe
-- (encrypted_password vide) : non repris, leur activation sera annoncée comme telle.
insert into ar_activations (user_id)
select u.id from auth.users u
 where coalesce(u.encrypted_password, '') <> ''
   and exists (select 1 from ar_profils_acces p where p.user_id = u.id)
on conflict do nothing;

commit;

-- Vérifications :
-- 1) select count(*) from ar_activations;   -- = nombre de membres ayant déjà un mot de passe
-- 2) select has_table_privilege('authenticated','public.ar_activations','select');   -- false
