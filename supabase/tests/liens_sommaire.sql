-- Test manuel du sommaire de classes (NON exécuté automatiquement ; transaction annulée à la fin).
-- À jouer dans le SQL Editor Supabase APRÈS la migration 20261113. Adapter la table _t.
-- Chaque cas affiche un NOTICE « OK » ou « ECHEC » (onglet Messages du SQL Editor), sauf (d) et (h) : SELECT à comparer.
-- Prérequis : l'école A a au moins 12 classes pour l'année donnée, plus une classe d'une autre école
-- et une classe d'une autre année (même école A). Créer ces lignes avant de lancer si besoin (tout est annulé à la fin).
-- Attention : une séquence n'est pas annulée par le rollback. Jouer ce test consomme quelques numéros SL
-- (colonne ar_liens.numero, identité) dans la base cible : des trous dans la numérotation sont attendus.
begin;

-- A ADAPTER : utilisateur existant dans auth.users, école A, année, classes de test.
create temp table _t as select
  '00000000-0000-0000-0000-000000000001'::uuid as usr,
  '00000000-0000-0000-0000-0000000000a1'::uuid as ecole_a,
  '00000000-0000-0000-0000-0000000000b1'::uuid as annee,
  '00000000-0000-0000-0000-0000000000c1'::uuid as classe_autre_ecole,
  '00000000-0000-0000-0000-0000000000c2'::uuid as classe_autre_annee;

-- Les 12 premières classes de l'école A / année (ordre stable).
create temp table _cl as
  select c.id, row_number() over (order by c.id) as n
    from ar_classes c, _t where c.ecole_id = _t.ecole_a and c.annee_id = _t.annee
   order by c.id limit 12;

do $$ begin
  if (select count(*) from _cl) < 12 then raise exception 'Prérequis : 12 classes dans l''école A / année (trouvé %).', (select count(*) from _cl); end if;
end $$;

-- Liens de test : un sommaire, un fusion, puis un 2e sommaire (pour la numérotation).
insert into ar_liens (token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le, mode)
select 'hash-test-sommaire-1', ecole_a, annee, 'Test sommaire 1', usr, current_date + 30, 'sommaire' from _t;
insert into ar_liens (token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le, mode)
select 'hash-test-fusion', ecole_a, annee, 'Test fusion', usr, current_date + 30, 'fusion' from _t;
insert into ar_liens (token_hash, ecole_id, annee_id, destinataire, cree_par, expire_le, mode)
select 'hash-test-sommaire-2', ecole_a, annee, 'Test sommaire 2', usr, current_date + 30, 'sommaire' from _t;

-- (a) sommaire : 11 classes passent.
insert into ar_liens_classes (lien_id, classe_id)
select (select id from ar_liens where token_hash = 'hash-test-sommaire-1'), id from _cl where n <= 11;
select count(*) as a_sommaire_11_classes__attendu_11
  from ar_liens_classes where lien_id = (select id from ar_liens where token_hash = 'hash-test-sommaire-1');

-- (b) fusion : la 11e insertion échoue (« au plus 10 classes »).
insert into ar_liens_classes (lien_id, classe_id)
select (select id from ar_liens where token_hash = 'hash-test-fusion'), id from _cl where n <= 10;
do $$ begin
  begin
    insert into ar_liens_classes (lien_id, classe_id)
    select (select id from ar_liens where token_hash = 'hash-test-fusion'), id from _cl where n = 11;
    raise notice 'b ECHEC : la 11e classe a été acceptée sur un lien fusion';
  exception when others then
    if sqlerrm like '%au plus 10 classes%' then raise notice 'b OK : %', sqlerrm;
    else raise notice 'b ECHEC (mauvais message) : %', sqlerrm; end if;
  end;
end $$;

-- (c) classe d'une autre école ou d'une autre année : échec pour les deux modes.
do $$
declare m text; k text; lid uuid; cid uuid;
begin
  foreach m in array array['sommaire','fusion'] loop
    foreach k in array array['ecole','annee'] loop
      select id into lid from ar_liens
       where token_hash = case m when 'sommaire' then 'hash-test-sommaire-2' else 'hash-test-fusion' end;
      select case k when 'ecole' then classe_autre_ecole else classe_autre_annee end into cid from _t;
      begin
        insert into ar_liens_classes (lien_id, classe_id) values (lid, cid);
        raise notice 'c ECHEC : % / % accepté', m, k;
      exception when others then
        if sqlerrm like '%même école et à la même année%' then raise notice 'c OK : % / %', m, k;
        else raise notice 'c ECHEC (mauvais message) % / % : %', m, k, sqlerrm; end if;
      end;
    end loop;
  end loop;
end $$;

-- (d) numéros strictement croissants dans l'ordre de création : attendu ok = true.
select (s2.numero > f.numero and f.numero > s1.numero) as d_numeros_croissants__attendu_true,
       s1.numero as n1, f.numero as n2, s2.numero as n3
  from ar_liens s1, ar_liens f, ar_liens s2
 where s1.token_hash = 'hash-test-sommaire-1' and f.token_hash = 'hash-test-fusion' and s2.token_hash = 'hash-test-sommaire-2';

-- (e) tableau vide : échec « au moins une classe ».
do $$ begin
  begin
    perform ar_lien_definir_classes((select id from ar_liens where token_hash = 'hash-test-sommaire-2'), '{}');
    raise notice 'e ECHEC : tableau vide accepté';
  exception when others then
    if sqlerrm like '%au moins une classe%' then raise notice 'e OK : %', sqlerrm;
    else raise notice 'e ECHEC (mauvais message) : %', sqlerrm; end if;
  end;
end $$;

-- (f) 3 classes dont une déjà présente et un doublon : exactement 3 classes, retour 3.
insert into ar_liens_classes (lien_id, classe_id)
select (select id from ar_liens where token_hash = 'hash-test-sommaire-2'), id from _cl where n = 1;
do $$
declare r integer; lid uuid; nb integer;
begin
  select id into lid from ar_liens where token_hash = 'hash-test-sommaire-2';
  r := ar_lien_definir_classes(lid, array(select id from _cl where n in (1, 2, 3) union all select id from _cl where n = 2));
  select count(*) into nb from ar_liens_classes where lien_id = lid;
  if r = 3 and nb = 3 then raise notice 'f OK : retour %, lignes %', r, nb;
  else raise notice 'f ECHEC : retour %, lignes %', r, nb; end if;
  -- remplacement : les classes hors tableau sont retirées.
  r := ar_lien_definir_classes(lid, array(select id from _cl where n in (3, 4)));
  select count(*) into nb from ar_liens_classes where lien_id = lid;
  if r = 2 and nb = 2 and not exists (select 1 from ar_liens_classes l join _cl c on c.id = l.classe_id where l.lien_id = lid and c.n in (1, 2))
    then raise notice 'f2 OK : remplacement, retour %', r;
  else raise notice 'f2 ECHEC : retour %, lignes %', r, nb; end if;
end $$;

-- (g) lien fusion : échec « seulement les liens de type sommaire ».
do $$ begin
  begin
    perform ar_lien_definir_classes((select id from ar_liens where token_hash = 'hash-test-fusion'), array(select id from _cl where n = 1));
    raise notice 'g ECHEC : lien fusion accepté';
  exception when others then
    if sqlerrm like '%type sommaire%' then raise notice 'g OK : %', sqlerrm;
    else raise notice 'g ECHEC (mauvais message) : %', sqlerrm; end if;
  end;
end $$;

-- (j) atomicité : une classe valide + une classe d'une autre école => erreur, et l'ensemble précédent
--     (classes n = 3 et 4 après f2) reste intact (même nombre, mêmes ids).
do $$
declare lid uuid; nb integer; avant uuid[]; apres uuid[];
begin
  select id into lid from ar_liens where token_hash = 'hash-test-sommaire-2';
  select array_agg(classe_id order by classe_id) into avant from ar_liens_classes where lien_id = lid;
  begin
    perform ar_lien_definir_classes(lid, array[(select id from _cl where n = 5), (select classe_autre_ecole from _t)]);
    raise notice 'j ECHEC : classe d''une autre école acceptée';
  exception when others then
    select count(*), array_agg(classe_id order by classe_id) into nb, apres from ar_liens_classes where lien_id = lid;
    if nb = 2 and apres = avant then raise notice 'j OK : erreur « % », ensemble précédent intact (% lignes)', sqlerrm, nb;
    else raise notice 'j ECHEC : ensemble modifié (% lignes)', nb; end if;
  end;
end $$;

-- (h) privilèges de colonnes : true, true, false.
select has_column_privilege('authenticated', 'public.ar_liens', 'mode', 'select')       as h_mode__attendu_true,
       has_column_privilege('authenticated', 'public.ar_liens', 'numero', 'select')     as h_numero__attendu_true,
       has_column_privilege('authenticated', 'public.ar_liens', 'token_hash', 'select') as h_token_hash__attendu_false;

-- (i) authenticated ne peut pas exécuter la fonction : « permission denied for function ».
set local role authenticated;
do $$ begin
  begin
    perform ar_lien_definir_classes((select id from ar_liens limit 1), '{}');
    raise notice 'i ECHEC : authenticated a pu appeler la fonction';
  exception when insufficient_privilege then raise notice 'i OK : %', sqlerrm;
            when others then raise notice 'i ECHEC (autre erreur) : %', sqlerrm;
  end;
end $$;
reset role;

rollback;
