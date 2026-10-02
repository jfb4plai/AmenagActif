# AménagActif — Changement de classe ou d'implantation en cours d'année — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Permettre au référent (ou à l'admin) de faire changer un élève de classe, voire d'implantation, en cours d'année, sans perdre ses aménagements, avec un avertissement clair tant que ses aménagements n'ont pas été relus, et un garde-fou sur les dispositifs.

**Architecture :** On **déplace la même ligne élève** (`ar_eleves.classe_id`) : l'identifiant reste stable, les AR (`ar_selections`) et aménagements libres suivent l'élève, et les AU de la nouvelle classe s'appliquent d'eux-mêmes (ils sont portés par la classe). Une fonction SQL atomique `ar_changer_classe_eleve` (`security invoker`, donc soumise à la RLS) contrôle les droits, la même année scolaire et la compatibilité des dispositifs, déplace l'élève et marque ses AR/libres « à confirmer » (**même marqueur que la reprise annuelle**). Côté app : bouton « Changer de classe » dans la fiche de l'élève, avertissement quand on édite un élève à relire, avertissement avant de générer un lien enseignant. La même migration aligne la reprise annuelle sur les dispositifs (modes copiés au clonage, AR de dispositif non copiés vers une classe qui l'applique à toute la classe).

**Tech Stack :** React 18 + Vite 5 + Tailwind 3, Supabase v2 (RPC + RLS), TanStack Query, Vitest + Testing Library. Aucune fonction `/api/*` : `vite dev` suffit.

---

## Lien avec la reprise annuelle (à lire d'abord)

Ce plan **dépend** du plan [2026-09-24-amenagactif-reprise-annee.md](2026-09-24-amenagactif-reprise-annee.md) et réutilise sa mécanique « à confirmer ». Ce qui est partagé :

| Brique | Définie par la reprise | Utilisée ici |
|---|---|---|
| Colonnes `a_confirmer` (`ar_selections`, `ar_amenagements_libres`, `ar_amenagements_classe`) | Task 1 | La fonction de changement de classe les met à `true` |
| `aConfirmerParClasse` (`src/domain/reprise.js`) | Task 2 | Comptage pour l'avertissement d'édition et l'avertissement avant envoi du lien |
| Lecture de `a_confirmer` dans `useEcoleGrid` + `BandeauAConfirmer` + « Confirmer » | Task 6 | Le même bandeau et les mêmes boutons confirment les AR d'un élève changé de classe |
| `ar_eleves.eleve_precedent_id` | schéma existant | **Non utilisé ici** : changer de classe en cours d'année ne crée pas de nouvelle ligne (sinon l'élève apparaîtrait deux fois à la reprise annuelle) |

Deux différences à garder en tête :
- **Reprise annuelle = nouvelle ligne** (année N → N+1, `ar_reprendre_eleve`). **Changement en cours d'année = même ligne** (`ar_changer_classe_eleve`, même année scolaire obligatoire). Les deux ne se chevauchent pas : à la reprise annuelle, chaque élève est lu une seule fois, dans sa classe actuelle.
- Le plan de reprise a été corrigé le 2026-10-03 (migration renumérotée `20261003_…` car `20260924d` était déjà prise par les liens ; colonne `ar_eleves.referent_plai_nom` retirée de `ar_reprendre_eleve` car supprimée par `20260916b`).

## Décisions prises (à corriger si désaccord avant exécution)

1. **Même ligne, pas « clôturer + recréer »** : plus simple, identifiant stable (continuité DiffActif), pas de doublon à la reprise annuelle. L'historique de l'ancienne classe reste dans les snapshots (`ar_fiche_snapshots`). Deux colonnes gardent la trace : `classe_changee_le`, `classe_precedente_nom`.
2. **Dispositifs : jamais de conversion automatique** (retour de JF : « repasser en manuel »).
   - Classe d'arrivée applique le dispositif à **toute la classe (AU)** et l'élève a des cases (ou aménagements libres) dans ce dispositif : le changement est **refusé** avec un message (décocher d'abord). Raison : ces cases deviendraient invisibles, état que `selectionsActives` considère comme anormal.
   - Classe de départ en AU et classe d'arrivée en AR : le changement est permis, avec une **note** (« cochez-le pour l'élève si nécessaire »).
3. **Avertissements** (retour de JF : « idéalement un avertissement quand l'élève est édité ») :
   - À l'**édition de l'élève** : encadré orange si ses AR sont « à confirmer » ou s'il a changé de classe depuis moins de 30 jours.
   - Avant de **générer un lien enseignant** : encadré orange (non bloquant) avec le nombre d'aménagements « à confirmer » de la fiche.
4. **Les liens enseignants sont vivants** (la fiche est lue à l'ouverture, pas figée) : un lien déjà envoyé pour la classe d'arrivée montrera l'élève et ses AR dès le changement, même non relus. On l'accepte (même raisonnement que la décision 2 du plan de reprise : meilleure connaissance disponible, sinon l'élève n'a rien affiché). **À valider par JF** : l'alternative (masquer sur les liens tant que « à confirmer ») est écartée car elle laisserait un élève sans aménagement visible.
5. **Droits** : admin, référent PLAI, direction (`ar_can_editer_structure_ecole`), pas `agent_plai`. Le droit est exigé sur **les deux** implantations : un référent d'une seule école ne peut pas déplacer vers une autre école (l'admin, ou un référent rattaché aux deux écoles, le peut). **Pas besoin de fonction `security definer`** : la politique `ar_eleves_write` laisse déjà l'admin écrire dans n'importe quelle école.
6. **Même année scolaire obligatoire** ; le passage à l'année suivante passe par la Reprise d'année.
7. **Hors périmètre** : notification automatique des enseignants de la classe d'arrivée ; signalement par un référent d'un départ vers une autre implantation en cours d'année (l'admin est prévenu hors app) ; étiquette « arrivé le… » sur la fiche enseignant ; annulation en un clic (on refait un changement inverse) ; question RGPD de la visibilité des AR par la nouvelle implantation (à confirmer par JF, le Pôle couvre les deux écoles).
8. Aucune référence scientifique dans cette fonctionnalité : pas de vérification RISS requise.

## Prérequis d'exécution

- **Reprise annuelle : Tasks 0 à 2 et 6 exécutées et fusionnées dans `main`, migration `20261003_amenagactif_reprise_annee.sql` appliquée.** Sans cela : `a_confirmer` n'existe pas, `reprise.js` non plus.
- Avant d'exécuter la Task 6 du plan de reprise, la relire contre le code actuel : elle date d'avant les dispositifs (`CarteDispositif.jsx`, `ar_classe_dispositifs`). Vérifier que les AU de dispositif repris (en mode AU) affichent bien « à confirmer » dans `CarteDispositif`, sinon ajouter le badge comme dans `BandeauAU`.
- Partir de `main`. **Ordre de déploiement : migration `20261003b` appliquée AVANT le déploiement du front** (`useEcoleGrid` sélectionnera les nouvelles colonnes).
- Build check local avant tout push : `npx vite build`. Ne pas pousser sans accord de JF.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261003b_amenagactif_changement_classe.sql` (créer) | Colonnes `classe_changee_le`/`classe_precedente_nom`, `ar_conflits_dispositif`, `ar_changer_classe_eleve`, alignement `ar_cloner_classes` / `ar_reprendre_eleve` |
| `src/domain/changementClasse.js` (créer) | Logique pure : dispositifs bloquants/perdus, messages, avertissement d'édition, avertissement avant envoi, traduction des erreurs |
| `tests/domain/changementClasse.test.js` (créer) | Tests de la logique pure |
| `src/hooks/useClassesCibles.js` (créer) | Classes de l'année lisibles par l'utilisateur + modes de dispositif (AU) |
| `src/hooks/useAConfirmer.js` (créer) | Comptage « à confirmer » de classes (avertissement avant envoi) |
| `src/hooks/useGridMutations.js` (modifier) | Mutation `changerClasse` |
| `src/hooks/useEcoleGrid.js` (modifier) | Lire `classe_changee_le`, `classe_precedente_nom` |
| `src/components/saisie/ChangerClasse.jsx` (créer) | Bloc « Changer de classe » (choix, blocage, note, confirmation) |
| `src/components/saisie/EleveEditor.jsx`, `EnTeteEleves.jsx` (modifier) | Emplacements `avertissements` et `extra` |
| `src/pages/SaisieEcole.jsx` (modifier) | Câblage |
| `src/components/GenerateurLien.jsx`, `src/pages/FicheClassePage.jsx` (modifier) | Avertissement avant envoi |
| `tests/domain/changerClasse.test.jsx`, `eleveEditorAvertissements.test.jsx`, `generateurLienAvertissement.test.jsx` (créer) ; `tests/domain/saisieEcoleDispositifs.test.jsx` (modifier) | Tests de composants |
| `docs/modes-emploi/referents-plai.html`, `public/modes-emploi/referents-plai.html` (modifier) | Mode d'emploi |

---

### Task 0 : Worktree

- [ ] **Step 1 : Créer le worktree depuis main (reprise déjà fusionnée)**

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif
git fetch origin
git worktree add .claude/worktrees/amenagactif-changement-classe -b feature/changement-classe origin/main
cd .claude/worktrees/amenagactif-changement-classe
npm install
```

- [ ] **Step 2 : Vérifier les prérequis dans le code**

Run : `ls src/domain/reprise.js && grep -n "a_confirmer" src/hooks/useEcoleGrid.js`
Expected : le fichier existe et `a_confirmer` apparaît dans `useEcoleGrid.js`. Sinon : STOP, la reprise (Tasks 1, 2, 6) n'est pas fusionnée.

- [ ] **Step 3 : Vérifier la base de tests**

Run : `npm test`
Expected : PASS.

Copier `.env.local` du dossier principal vers le worktree pour la Task 8. Toutes les commandes suivantes s'exécutent dans ce worktree.

---

### Task 1 : Migration SQL

**Files:**
- Create: `supabase/migrations/20261003b_amenagactif_changement_classe.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- AménagActif — changement de classe en cours d'année + alignement de la reprise annuelle sur les dispositifs.
-- À exécuter APRÈS 20261003_amenagactif_reprise_annee.sql, AVANT le déploiement du front. Idempotent.
--  * Même ligne élève (même id) : AR, libres, commentaire, identité suivent l'élève ; les AU de la nouvelle classe s'appliquent d'eux-mêmes.
--  * Fonctions SECURITY INVOKER : la RLS de l'appelant s'applique. Droit « structure » exigé sur les DEUX implantations.
--  * Aucune nouvelle table : pas de GRANT de table à ajouter. EXECUTE accordé aux fonctions (authenticated seulement).
--  * Les exceptions portent un message court : dispositif_incompatible: <titres>, droit_insuffisant, annee_differente,
--    classe_cible_introuvable, eleve_introuvable, meme_classe (traduits côté app par messageErreurChangement).

begin;

-- ── 1. Trace du dernier changement de classe ──
alter table ar_eleves add column if not exists classe_changee_le timestamptz;
alter table ar_eleves add column if not exists classe_precedente_nom text;

-- ── 2. Dispositifs de la classe d'arrivée qui rendraient les AR de l'élève invisibles ──
-- (dispositif appliqué à toute la classe ET élève avec des cases ou des aménagements libres dans ce dispositif).
create or replace function ar_conflits_dispositif(p_eleve uuid, p_classe_cible uuid)
returns setof text
language sql stable security invoker set search_path = public as $$
  select distinct ch.titre
  from ar_classe_dispositifs m
  join ar_chapitres ch on ch.id = m.chapitre_id and ch.est_dispositif
  where m.classe_id = p_classe_cible
    and m.pour_toute_la_classe
    and (
      exists (
        select 1 from ar_selections s
        join ar_amenagements a on a.id = s.amenagement_id
        where s.eleve_id = p_eleve and a.chapitre_id = m.chapitre_id
      )
      or exists (
        select 1 from ar_amenagements_libres l
        where l.eleve_id = p_eleve and l.chapitre_id = m.chapitre_id
      )
    );
$$;

-- ── 3. Changer un élève de classe (même année scolaire) ──
create or replace function ar_changer_classe_eleve(p_eleve uuid, p_classe_cible uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_src record;
  v_cib record;
  v_conflits text[];
begin
  select c.id, c.nom, c.ecole_id, c.annee_id into v_src
  from ar_eleves e join ar_classes c on c.id = e.classe_id
  where e.id = p_eleve;
  if not found then
    raise exception 'eleve_introuvable' using errcode = 'P0002';
  end if;

  select id, ecole_id, annee_id into v_cib from ar_classes where id = p_classe_cible;
  if not found then
    raise exception 'classe_cible_introuvable' using errcode = 'P0002';
  end if;

  if v_src.id = v_cib.id then
    raise exception 'meme_classe' using errcode = 'P0001';
  end if;
  if v_src.annee_id <> v_cib.annee_id then
    raise exception 'annee_differente' using errcode = 'P0001';
  end if;
  if not (ar_can_editer_structure_ecole(v_src.ecole_id) and ar_can_editer_structure_ecole(v_cib.ecole_id)) then
    raise exception 'droit_insuffisant' using errcode = '42501';
  end if;

  select array_agg(c.titre) into v_conflits from ar_conflits_dispositif(p_eleve, p_classe_cible) as c(titre);
  if v_conflits is not null then
    raise exception 'dispositif_incompatible: %', array_to_string(v_conflits, ' | ') using errcode = 'P0001';
  end if;

  update ar_eleves
     set classe_id = p_classe_cible, classe_changee_le = now(), classe_precedente_nom = v_src.nom
   where id = p_eleve;
  update ar_selections          set a_confirmer = true where eleve_id = p_eleve;
  update ar_amenagements_libres set a_confirmer = true where eleve_id = p_eleve;
end $$;

-- ── 4. Reprise annuelle : cloner aussi le MODE des dispositifs (AR/AU) des classes créées ──
-- (remplace la version de 20261003_amenagactif_reprise_annee.sql : seule la 3e instruction est ajoutée)
create or replace function ar_cloner_classes(p_ecole uuid, p_source uuid, p_cible uuid)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_nouvelles uuid[];
begin
  with ins as (
    insert into ar_classes (ecole_id, annee_id, nom, niveau, referent_plai_nom)
    select ecole_id, p_cible, nom, niveau, referent_plai_nom
    from ar_classes
    where ecole_id = p_ecole and annee_id = p_source
    on conflict (ecole_id, annee_id, nom) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_nouvelles from ins;

  insert into ar_amenagements_classe (classe_id, amenagement_id, cree_par, a_confirmer)
  select cc.id, ac.amenagement_id, auth.uid(), true
  from ar_classes cc
  join ar_classes cs on cs.ecole_id = cc.ecole_id and cs.annee_id = p_source and cs.nom = cc.nom
  join ar_amenagements_classe ac on ac.classe_id = cs.id
  where cc.id = any(v_nouvelles);

  insert into ar_classe_dispositifs (classe_id, chapitre_id, pour_toute_la_classe)
  select cc.id, m.chapitre_id, m.pour_toute_la_classe
  from ar_classes cc
  join ar_classes cs on cs.ecole_id = cc.ecole_id and cs.annee_id = p_source and cs.nom = cc.nom
  join ar_classe_dispositifs m on m.classe_id = cs.id
  where cc.id = any(v_nouvelles)
  on conflict (classe_id, chapitre_id) do nothing;

  return coalesce(array_length(v_nouvelles, 1), 0);
end $$;

-- ── 5. Reprise annuelle : ne pas copier les AR / libres d'un dispositif que la classe cible applique à toute la classe ──
-- (ils y seraient invisibles ; l'AU de la classe couvre l'élève. Rien n'est supprimé dans l'année source.)
create or replace function ar_reprendre_eleve(p_source uuid, p_classe_cible uuid)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new uuid;
begin
  insert into ar_eleves (classe_id, prenom, initiale_nom, statut, commentaire, eleve_precedent_id)
  select p_classe_cible, prenom, initiale_nom, statut, '', id
  from ar_eleves where id = p_source
  returning id into v_new;

  if v_new is null then
    raise exception 'eleve_source_introuvable' using errcode = 'P0002';
  end if;

  insert into ar_selections (eleve_id, amenagement_id, cree_par, a_confirmer)
  select v_new, s.amenagement_id, auth.uid(), true
  from ar_selections s
  join ar_amenagements a on a.id = s.amenagement_id
  where s.eleve_id = p_source
    and not exists (
      select 1 from ar_classe_dispositifs m
      where m.classe_id = p_classe_cible and m.chapitre_id = a.chapitre_id and m.pour_toute_la_classe
    );

  insert into ar_amenagements_libres (eleve_id, chapitre_id, texte, cree_par, a_confirmer)
  select v_new, l.chapitre_id, l.texte, auth.uid(), true
  from ar_amenagements_libres l
  where l.eleve_id = p_source
    and not exists (
      select 1 from ar_classe_dispositifs m
      where m.classe_id = p_classe_cible and m.chapitre_id = l.chapitre_id and m.pour_toute_la_classe
    );

  return v_new;
end $$;

revoke all on function ar_conflits_dispositif(uuid, uuid)    from public, anon;
revoke all on function ar_changer_classe_eleve(uuid, uuid)   from public, anon;
grant execute on function ar_conflits_dispositif(uuid, uuid)  to authenticated;
grant execute on function ar_changer_classe_eleve(uuid, uuid) to authenticated;
-- ar_cloner_classes / ar_reprendre_eleve : create or replace conserve les droits de 20261003 (revoke/grant déjà posés).

commit;

-- Vérifications (attendu : 2 lignes puis 2 lignes) :
--   select column_name from information_schema.columns where table_name = 'ar_eleves' and column_name in ('classe_changee_le', 'classe_precedente_nom');
--   select proname from pg_proc where proname in ('ar_conflits_dispositif', 'ar_changer_classe_eleve');
```

- [ ] **Step 2 : Vérifier la cohérence avec le schéma**

Run : `grep -n "ar_classe_dispositifs\|referent_plai_nom\|a_confirmer" supabase/migrations/20261003_amenagactif_reprise_annee.sql supabase/migrations/20261002_amenagactif_dispositifs.sql | head -30`
Expected : `ar_classe_dispositifs` (clé primaire `classe_id, chapitre_id`) défini dans `20261002`, `a_confirmer` défini dans `20261003`. Les trois fonctions de `20261003` existent déjà (celles de la présente migration les remplacent à l'identique, sauf les ajouts commentés).

- [ ] **Step 3 : Appliquer la migration (projet partagé dfoaumjleqtxjeaplnna)**

Demander confirmation à JF avant d'exécuter (projet partagé), puis coller le fichier dans le SQL Editor.
Expected : `Success. No rows returned`.

- [ ] **Step 4 : Vérifier le schéma** — exécuter les deux requêtes de vérification en fin de fichier. Expected : 2 lignes chacune.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20261003b_amenagactif_changement_classe.sql
git commit -m "feat(changement-classe): migration, RPC de changement de classe, reprise alignée sur les dispositifs"
```

---

### Task 2 : Logique pure (TDD)

**Files:**
- Create: `src/domain/changementClasse.js`
- Test: `tests/domain/changementClasse.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
import { describe, it, expect } from 'vitest';
import {
  dispositifsBloquants, dispositifsPerdus, messageBlocageChangement, messagePerte,
  avertissementEleve, messageAvantEnvoi, messageErreurChangement,
} from '../../src/domain/changementClasse.js';

const TITRE = 'Dispositif de régulation des comportements';
const chapitres = [
  { id: 'c1', titre: '1. SUPPORTS', est_dispositif: false },
  { id: 'd1', titre: TITRE, est_dispositif: true },
];
const amenagements = [
  { id: 'a2', chapitre_id: 'c1', type: 'AR' },
  { id: 'x1', chapitre_id: 'd1', type: 'AR' },
];
const modes = [
  { classe_id: 'cAU', chapitre_id: 'd1', pour_toute_la_classe: true },
  { classe_id: 'cAR', chapitre_id: 'd1', pour_toute_la_classe: false },
];
const base = { eleveId: 'e1', modes, chapitres, amenagements, selectionsAR: [], libres: [] };

describe('dispositifsBloquants', () => {
  it("bloque si l'élève a une case du dispositif et que la classe d'arrivée l'applique à toute la classe", () => {
    const r = dispositifsBloquants({ ...base, classeCibleId: 'cAU', selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] });
    expect(r).toEqual([TITRE]);
  });
  it('bloque aussi pour un aménagement libre du chapitre du dispositif', () => {
    const r = dispositifsBloquants({ ...base, classeCibleId: 'cAU', libres: [{ eleve_id: 'e1', chapitre_id: 'd1', texte: 'x' }] });
    expect(r).toEqual([TITRE]);
  });
  it("ne bloque pas si la classe d'arrivée est en mode AR, ou sans ligne de mode", () => {
    const sel = [{ eleve_id: 'e1', amenagement_id: 'x1' }];
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cAR', selectionsAR: sel })).toEqual([]);
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cX', selectionsAR: sel })).toEqual([]);
  });
  it("ignore les cases d'un chapitre ordinaire et celles des autres élèves", () => {
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cAU', selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'a2' }] })).toEqual([]);
    expect(dispositifsBloquants({ ...base, classeCibleId: 'cAU', selectionsAR: [{ eleve_id: 'e2', amenagement_id: 'x1' }] })).toEqual([]);
  });
});

describe('dispositifsPerdus', () => {
  it("liste les dispositifs AU au départ qui deviennent AR à l'arrivée", () => {
    expect(dispositifsPerdus({ classeSourceId: 'cAU', classeCibleId: 'cAR', modes, chapitres })).toEqual([TITRE]);
    expect(dispositifsPerdus({ classeSourceId: 'cAU', classeCibleId: 'cX', modes, chapitres })).toEqual([TITRE]);
  });
  it('rien si le mode ne change pas ou si le départ est en AR', () => {
    expect(dispositifsPerdus({ classeSourceId: 'cAU', classeCibleId: 'cAU', modes, chapitres })).toEqual([]);
    expect(dispositifsPerdus({ classeSourceId: 'cAR', classeCibleId: 'cAU', modes, chapitres })).toEqual([]);
  });
});

describe('messages de dispositif', () => {
  it('le blocage nomme le dispositif et le prénom, demande de décocher, sans pronom genré', () => {
    const m = messageBlocageChangement([TITRE], 'Emilie');
    expect(m).toContain(TITRE);
    expect(m).toContain('Emilie');
    expect(m).toContain('Décochez');
    expect(m).not.toMatch(/\b(elle|il|lui)\b/i);
  });
  it('pluriel pour plusieurs dispositifs', () => {
    expect(messageBlocageChangement(['A', 'B'], 'Emilie')).toContain('les dispositifs');
  });
  it('la note de perte invite à cocher le dispositif pour l\'élève', () => {
    const m = messagePerte([TITRE]);
    expect(m).toContain(TITRE);
    expect(m).toContain('élève par élève');
  });
});

describe('avertissementEleve', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const sans = { classe_changee_le: null, classe_precedente_nom: null };

  it('aucun avertissement : liste vide', () => {
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 0, now })).toEqual([]);
  });
  it('singulier / pluriel pour les aménagements à confirmer', () => {
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 1, now })[0]).toContain('1 aménagement « à confirmer »');
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 3, now })[0]).toContain('3 aménagements « à confirmer »');
    expect(avertissementEleve({ eleve: sans, nAConfirmer: 3, now })[0]).toContain('avant d\'envoyer un lien enseignant');
  });
  it('changement de classe récent (moins de 30 jours) : mention de la date et de la classe de départ', () => {
    const l = avertissementEleve({ eleve: { classe_changee_le: '2026-10-03T12:00:00Z', classe_precedente_nom: '4A' }, nAConfirmer: 0, now });
    expect(l).toHaveLength(1);
    expect(l[0]).toContain('octobre 2026');
    expect(l[0]).toContain('depuis 4A');
  });
  it('changement ancien (plus de 30 jours) : pas de mention', () => {
    expect(avertissementEleve({ eleve: { classe_changee_le: '2026-08-01T12:00:00Z', classe_precedente_nom: '4A' }, nAConfirmer: 0, now })).toEqual([]);
  });
  it('les deux lignes quand les deux cas se présentent', () => {
    const l = avertissementEleve({ eleve: { classe_changee_le: '2026-10-03T12:00:00Z', classe_precedente_nom: null }, nAConfirmer: 2, now });
    expect(l).toHaveLength(2);
    expect(l[0]).not.toContain('depuis');
  });
});

describe('messageAvantEnvoi', () => {
  it('null quand il n\'y a rien à confirmer ou pas de donnée', () => {
    expect(messageAvantEnvoi(null)).toBeNull();
    expect(messageAvantEnvoi({ total: 0, parEleve: [], nAU: 0 })).toBeNull();
  });
  it('détaille élèves et AU, et rappelle que la fiche est lue à l\'ouverture', () => {
    const m = messageAvantEnvoi({ total: 3, parEleve: [{ n: 1 }, { n: 1 }], nAU: 1 });
    expect(m).toContain('3 aménagements « à confirmer »');
    expect(m).toContain('2 élèves, 1 AU de classe');
    expect(m).toContain('au moment où il l\'ouvre');
  });
  it('singulier', () => {
    expect(messageAvantEnvoi({ total: 1, parEleve: [{ n: 1 }], nAU: 0 })).toContain('1 aménagement « à confirmer » dans cette fiche (1 élève)');
  });
});

describe('messageErreurChangement', () => {
  it('dispositif incompatible : reprend les titres renvoyés par la base', () => {
    expect(messageErreurChangement({ message: `dispositif_incompatible: ${TITRE}` })).toContain(TITRE);
  });
  it('droit insuffisant (code 42501 ou message)', () => {
    expect(messageErreurChangement({ code: '42501', message: 'x' })).toContain('administrateur');
    expect(messageErreurChangement({ message: 'droit_insuffisant' })).toContain('administrateur');
  });
  it('année différente, classe introuvable, même classe, défaut', () => {
    expect(messageErreurChangement({ message: 'annee_differente' })).toContain('même année');
    expect(messageErreurChangement({ message: 'classe_cible_introuvable' })).toContain('introuvable');
    expect(messageErreurChangement({ message: 'meme_classe' })).toContain('déjà');
    expect(messageErreurChangement({ message: 'autre chose' })).toContain('réessayez');
    expect(messageErreurChangement(undefined)).toContain('réessayez');
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run : `npx vitest run tests/domain/changementClasse.test.js`
Expected : FAIL (`Failed to resolve import "../../src/domain/changementClasse.js"`).

- [ ] **Step 3 : Implémenter**

```js
// Logique pure du changement de classe en cours d'année. Aucune dépendance React/Supabase.
import { estModeAU } from './dispositifs.js';
import { dateFR } from './liens.js';

const JOURS_CHANGEMENT_RECENT = 30;

const modesDe = (modes, classeId) => modes.filter((m) => m.classe_id === classeId);
const plur = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * Titres des dispositifs que la classe d'arrivée applique à toute la classe (AU) et dans lesquels
 * l'élève a des cases ou des aménagements libres : ils deviendraient invisibles. Même règle que
 * ar_conflits_dispositif côté SQL (le SQL fait foi, ceci sert à prévenir avant l'appel).
 */
export function dispositifsBloquants({ eleveId, classeCibleId, modes = [], chapitres = [], amenagements = [], selectionsAR = [], libres = [] }) {
  const modesCible = modesDe(modes, classeCibleId);
  const chapitreDe = new Map(amenagements.map((a) => [a.id, a.chapitre_id]));
  const touches = new Set([
    ...selectionsAR.filter((s) => s.eleve_id === eleveId).map((s) => chapitreDe.get(s.amenagement_id)),
    ...libres.filter((l) => l.eleve_id === eleveId).map((l) => l.chapitre_id),
  ]);
  return chapitres.filter((c) => c.est_dispositif && touches.has(c.id) && estModeAU(c.id, modesCible)).map((c) => c.titre);
}

/** Titres des dispositifs appliqués à toute la classe au départ mais pas à l'arrivée : l'élève perd cette couverture. */
export function dispositifsPerdus({ classeSourceId, classeCibleId, modes = [], chapitres = [] }) {
  const source = modesDe(modes, classeSourceId);
  const cible = modesDe(modes, classeCibleId);
  return chapitres.filter((c) => c.est_dispositif && estModeAU(c.id, source) && !estModeAU(c.id, cible)).map((c) => c.titre);
}

export function messageBlocageChangement(titres, prenom) {
  const pl = titres.length > 1;
  const liste = titres.map((t) => `« ${t} »`).join(', ');
  return `Impossible : dans la classe d'arrivée, ${pl ? 'les dispositifs' : 'le dispositif'} ${liste} ${pl ? "s'appliquent" : "s'applique"} à toute la classe, alors que ${prenom} a des aménagements cochés à titre individuel. Décochez-les d'abord dans la colonne de l'élève (et supprimez ses aménagements libres de ce chapitre), puis relancez le changement de classe.`;
}

export function messagePerte(titres) {
  const pl = titres.length > 1;
  const liste = titres.map((t) => `« ${t} »`).join(', ');
  return `Dans la classe de départ, ${pl ? 'les dispositifs' : 'le dispositif'} ${liste} ${pl ? "s'appliquaient" : "s'appliquait"} à toute la classe ; dans la classe d'arrivée, ${pl ? 'ils se cochent' : 'il se coche'} élève par élève. Après le changement, cochez-${pl ? 'les' : 'le'} pour cet élève si nécessaire.`;
}

/**
 * Lignes d'avertissement à afficher quand on édite un élève : changement de classe récent
 * et/ou aménagements « à confirmer » (repris de l'année précédente ou d'un changement de classe).
 * @returns {string[]} vide s'il n'y a rien à signaler
 */
export function avertissementEleve({ eleve, nAConfirmer = 0, now = new Date() }) {
  const lignes = [];
  if (eleve?.classe_changee_le) {
    const jours = (now - new Date(eleve.classe_changee_le)) / 86400000;
    if (jours >= 0 && jours <= JOURS_CHANGEMENT_RECENT) {
      const depuis = eleve.classe_precedente_nom ? ` (depuis ${eleve.classe_precedente_nom})` : '';
      lignes.push(`Changement de classe le ${dateFR(eleve.classe_changee_le)}${depuis}.`);
    }
  }
  if (nAConfirmer > 0) {
    lignes.push(`${plur(nAConfirmer, 'aménagement')} « à confirmer » (repris d'une autre classe ou de l'année précédente) : relisez-${nAConfirmer > 1 ? 'les' : 'le'} avant d'envoyer un lien enseignant.`);
  }
  return lignes;
}

/** Avertissement affiché avant de générer un lien. `r` = résultat de aConfirmerParClasse. null s'il n'y a rien à confirmer. */
export function messageAvantEnvoi(r) {
  if (!r || r.total === 0) return null;
  const detail = [];
  if (r.parEleve.length) detail.push(plur(r.parEleve.length, 'élève'));
  if (r.nAU) detail.push(`${r.nAU} AU de classe`);
  return `${plur(r.total, 'aménagement')} « à confirmer » dans cette fiche (${detail.join(', ')}). Relisez-les dans la Saisie avant d'envoyer le lien : l'enseignant voit la fiche telle qu'elle est au moment où il l'ouvre.`;
}

/** Traduit l'erreur d'ar_changer_classe_eleve en message pour la personne qui saisit. */
export function messageErreurChangement(err) {
  const m = err?.message ?? '';
  if (m.startsWith('dispositif_incompatible')) {
    const titres = m.split(':').slice(1).join(':').trim();
    return `Impossible : l'élève a des aménagements individuels dans ${titres}, appliqué à toute la classe d'arrivée. Décochez-les d'abord, puis relancez.`;
  }
  if (err?.code === '42501' || m.includes('droit_insuffisant')) {
    return "Droit insuffisant : un changement vers une autre implantation est réservé à l'administrateur (ou à un référent rattaché aux deux implantations).";
  }
  if (m.includes('annee_differente')) return "La classe d'arrivée doit être de la même année scolaire. Pour passer à l'année suivante, utilisez « Reprise d'année ».";
  if (m.includes('classe_cible_introuvable')) return "Classe d'arrivée introuvable, ou non accessible avec vos droits.";
  if (m.includes('meme_classe')) return "L'élève est déjà dans cette classe.";
  return 'Changement de classe impossible, réessayez.';
}
```

- [ ] **Step 4 : Lancer les tests**

Run : `npx vitest run tests/domain/changementClasse.test.js`
Expected : PASS (tous les tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/changementClasse.js tests/domain/changementClasse.test.js
git commit -m "feat(changement-classe): logique pure (dispositifs, avertissements, messages d'erreur)"
```

---

### Task 3 : Hooks de données et mutation

**Files:**
- Create: `src/hooks/useClassesCibles.js`
- Create: `src/hooks/useAConfirmer.js`
- Modify: `src/hooks/useGridMutations.js` (nouvelle mutation + return)
- Modify: `src/hooks/useEcoleGrid.js` (colonnes élève)

- [ ] **Step 1 : `useClassesCibles.js`**

```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/**
 * Classes de l'année que l'utilisateur peut LIRE (la RLS filtre : un référent d'une seule école ne voit que la sienne,
 * l'admin voit tout) et modes AU des dispositifs. Sert de liste de destinations pour « Changer de classe ».
 * Les modes sont filtrés sur pour_toute_la_classe = true (seuls ces modes comptent) et rattachés aux classes côté client :
 * un `.in('classe_id', …)` de plusieurs centaines d'identifiants dépasserait la longueur d'URL de PostgREST.
 */
export function useClassesCibles(anneeId) {
  return useQuery({
    queryKey: ['classes-cibles', anneeId],
    enabled: !!anneeId,
    queryFn: async () => {
      const { data: classes, error } = await supabase
        .from('ar_classes').select('id, nom, niveau, ecole_id').eq('annee_id', anneeId).order('nom');
      if (error) throw error;
      const { data: modes, error: em } = await supabase
        .from('ar_classe_dispositifs').select('classe_id, chapitre_id, pour_toute_la_classe').eq('pour_toute_la_classe', true);
      if (em) throw em;
      const ids = new Set(classes.map((c) => c.id));
      return { classes, modes: modes.filter((m) => ids.has(m.classe_id)) };
    },
  });
}
```

- [ ] **Step 2 : `useAConfirmer.js`**

```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { aConfirmerParClasse } from '../domain/reprise.js';

/**
 * Ce qui reste « à confirmer » dans une ou plusieurs classes (AR et libres des élèves, AU de classe).
 * Avertissement consultatif avant l'envoi d'un lien : en cas d'erreur, la requête échoue sans bloquer la page
 * (data reste undefined, aucun avertissement n'est affiché).
 */
export function useAConfirmerClasses(classeIds) {
  return useQuery({
    queryKey: ['a-confirmer-classes', classeIds],
    enabled: Array.isArray(classeIds) && classeIds.length > 0,
    retry: false,
    queryFn: async () => {
      const { data: eleves, error } = await supabase.from('ar_eleves').select('id, prenom, initiale_nom').in('classe_id', classeIds);
      if (error) throw error;
      const ids = eleves.map((e) => e.id);
      const vide = Promise.resolve({ data: [], error: null });
      const [sel, lib, au] = await Promise.all([
        ids.length ? supabase.from('ar_selections').select('eleve_id, a_confirmer').eq('a_confirmer', true).in('eleve_id', ids) : vide,
        ids.length ? supabase.from('ar_amenagements_libres').select('eleve_id, a_confirmer').eq('a_confirmer', true).in('eleve_id', ids) : vide,
        supabase.from('ar_amenagements_classe').select('classe_id, a_confirmer').eq('a_confirmer', true).in('classe_id', classeIds),
      ]);
      for (const r of [sel, lib, au]) if (r.error) throw r.error;
      return aConfirmerParClasse({ eleves, selectionsAR: sel.data, libres: lib.data, auClasse: au.data });
    },
  });
}
```

- [ ] **Step 3 : `useGridMutations.js` — mutation `changerClasse`**

Juste avant la ligne `return { toggleAR, ...` ajouter :

```js
  /** Change un élève de classe (même année). Atomique côté SQL ; invalide toutes les grilles et fiches (l'élève peut changer d'implantation). */
  const changerClasse = useMutation({
    mutationFn: async ({ eleveId, classeCibleId }) => {
      const { error } = await supabase.rpc('ar_changer_classe_eleve', { p_eleve: eleveId, p_classe_cible: classeCibleId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grille'] });
      qc.invalidateQueries({ queryKey: ['classes-cibles'] });
      qc.invalidateQueries({ queryKey: ['fiche-classe'] });
      qc.invalidateQueries({ queryKey: ['fiche-groupe'] });
      qc.invalidateQueries({ queryKey: ['a-confirmer-classes'] });
    },
  });
```

et ajouter `changerClasse` à la fin de l'objet retourné par `return { toggleAR, ..., removeLibre, ... };` (conserver les entrées existantes, y compris `confirmerEleve`, `confirmerClasse` ajoutées par la reprise).

- [ ] **Step 4 : `useEcoleGrid.js` — lire les nouvelles colonnes**

Dans la requête `ar_eleves` de `useEcoleGrid`, remplacer exactement la liste de colonnes :
`'id, classe_id, prenom, initiale_nom, commentaire, statut'`
par :
`'id, classe_id, prenom, initiale_nom, commentaire, statut, classe_changee_le, classe_precedente_nom'`

- [ ] **Step 5 : Build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 6 : Commit**

```bash
git add src/hooks
git commit -m "feat(changement-classe): hooks (classes cibles, à confirmer) et mutation changerClasse"
```

---

### Task 4 : Composants (bloc « Changer de classe », avertissements d'édition)

**Files:**
- Create: `src/components/saisie/ChangerClasse.jsx`
- Modify: `src/components/saisie/EleveEditor.jsx`
- Modify: `src/components/saisie/EnTeteEleves.jsx`
- Test: `tests/domain/changerClasse.test.jsx`, `tests/domain/eleveEditorAvertissements.test.jsx`

Convention du projet : classes `plai-card`, `plai-btn`, `plai-input`, `plai-error` ; chaque champ a un label, un texte d'aide sous le champ ; état jamais porté par la couleur seule.

- [ ] **Step 1 : Écrire les tests de `ChangerClasse` (échec attendu)**

```jsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ChangerClasse from '../../src/components/saisie/ChangerClasse.jsx';

const TITRE = 'Dispositif de régulation des comportements';
const eleve = { id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D' };
const cibles = {
  classes: [
    { id: 'c1', nom: '4A', niveau: '4e', ecole_id: 's1' },
    { id: 'c2', nom: '4B', niveau: '4e', ecole_id: 's1' },
    { id: 'c3', nom: '5C', niveau: '5e', ecole_id: 's2' },
  ],
  modes: [{ classe_id: 'c2', chapitre_id: 'd1', pour_toute_la_classe: true }],
};
const ecoles = [{ id: 's1', nom: 'Athénée A' }, { id: 's2', nom: 'Athénée B' }];
const donnees = {
  chapitres: [{ id: 'd1', titre: TITRE, est_dispositif: true }],
  amenagements: [{ id: 'x1', chapitre_id: 'd1', type: 'AR' }],
  selectionsAR: [], libres: [],
};

function rendre(props = {}) {
  const onChanger = props.onChanger ?? vi.fn().mockResolvedValue(undefined);
  render(<ChangerClasse eleve={eleve} cibles={cibles} ecoles={ecoles} ecoleId="s1" donnees={{ ...donnees, ...props.donnees }} onChanger={onChanger} onFait={props.onFait} />);
  return onChanger;
}
const choisir = (v) => fireEvent.change(screen.getByLabelText('Nouvelle classe'), { target: { value: v } });

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ChangerClasse', () => {
  it("propose les autres classes, celles de l'implantation d'abord, sans la classe actuelle", () => {
    rendre();
    const select = screen.getByLabelText('Nouvelle classe');
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
    expect(options.join('|')).toContain('4B (4e)');
    expect(options.join('|')).toContain('5C (5e)');
    expect(options.join('|')).not.toContain('4A');
    expect(select.querySelectorAll('optgroup')).toHaveLength(2);
  });

  it("refuse (message + bouton désactivé) si l'élève a des cases dans un dispositif appliqué à toute la classe d'arrivée", () => {
    const onChanger = rendre({ donnees: { selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] } });
    choisir('c2');
    expect(screen.getByRole('alert').textContent).toContain(TITRE);
    const bouton = screen.getByRole('button', { name: 'Changer de classe' });
    expect(bouton.disabled).toBe(true);
    fireEvent.click(bouton);
    expect(onChanger).not.toHaveBeenCalled();
  });

  it('affiche une note (non bloquante) quand un dispositif de classe devient individuel', () => {
    const cibles2 = { ...cibles, modes: [{ classe_id: 'c1', chapitre_id: 'd1', pour_toute_la_classe: true }] };
    render(<ChangerClasse eleve={eleve} cibles={cibles2} ecoles={ecoles} ecoleId="s1" donnees={donnees} onChanger={vi.fn()} />);
    choisir('c2');
    // seul c1 (classe de départ) est en AU : le dispositif devient individuel à l'arrivée
    expect(screen.getByRole('note').textContent).toContain('élève par élève');
    expect(screen.getByRole('button', { name: 'Changer de classe' }).disabled).toBe(false);
  });

  it('confirme puis appelle onChanger avec la classe choisie', async () => {
    const onFait = vi.fn();
    const onChanger = rendre({ onFait });
    choisir('c3');
    fireEvent.click(screen.getByRole('button', { name: 'Changer de classe' }));
    await waitFor(() => expect(onChanger).toHaveBeenCalledWith('c3'));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(onFait).toHaveBeenCalled());
  });

  it("n'appelle rien si la confirmation est refusée", () => {
    window.confirm.mockReturnValue(false);
    const onChanger = rendre();
    choisir('c3');
    fireEvent.click(screen.getByRole('button', { name: 'Changer de classe' }));
    expect(onChanger).not.toHaveBeenCalled();
  });

  it("affiche l'erreur traduite quand la base refuse", async () => {
    const onChanger = vi.fn().mockRejectedValue({ code: '42501', message: 'droit_insuffisant' });
    rendre({ onChanger });
    choisir('c3');
    fireEvent.click(screen.getByRole('button', { name: 'Changer de classe' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('administrateur'));
  });
});
```

Le bouton de validation s'appelle « Changer de classe » (nom accessible) ; le résumé du `<details>` s'intitule « Changer de classe en cours d'année » (pas de collision exacte avec `name: 'Changer de classe'`).

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run : `npx vitest run tests/domain/changerClasse.test.jsx`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : Créer `ChangerClasse.jsx`**

```jsx
import { useId, useMemo, useState } from 'react';
import {
  dispositifsBloquants, dispositifsPerdus, messageBlocageChangement, messagePerte, messageErreurChangement,
} from '../../domain/changementClasse.js';

const libelle = (c) => `${c.nom}${c.niveau ? ` (${c.niveau})` : ''}`;

/**
 * Bloc « Changer de classe en cours d'année », affiché dans la fiche d'un élève.
 * cibles : { classes, modes } de useClassesCibles ; donnees : { chapitres, amenagements, selectionsAR, libres } de l'école courante.
 * onChanger(classeCibleId) doit renvoyer une promesse (rejetée en cas d'erreur).
 */
export default function ChangerClasse({ eleve, cibles, ecoles = [], ecoleId, donnees, onChanger, onFait }) {
  const id = useId();
  const [cibleId, setCibleId] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const classes = (cibles?.classes ?? []).filter((c) => c.id !== eleve.classe_id);
  const propres = classes.filter((c) => c.ecole_id === ecoleId);
  const autres = ecoles
    .filter((e) => e.id !== ecoleId)
    .map((e) => ({ ecole: e, classes: classes.filter((c) => c.ecole_id === e.id) }))
    .filter((g) => g.classes.length > 0);

  const { bloquants, perdus } = useMemo(() => {
    if (!cibleId) return { bloquants: [], perdus: [] };
    const modes = cibles?.modes ?? [];
    return {
      bloquants: dispositifsBloquants({ eleveId: eleve.id, classeCibleId: cibleId, modes, ...donnees }),
      perdus: dispositifsPerdus({ classeSourceId: eleve.classe_id, classeCibleId: cibleId, modes, chapitres: donnees.chapitres }),
    };
  }, [cibleId, cibles, donnees, eleve.id, eleve.classe_id]);

  const changer = async () => {
    const cible = classes.find((c) => c.id === cibleId);
    if (!cible || bloquants.length > 0) return;
    if (!window.confirm(`Changer ${eleve.prenom} ${eleve.initiale_nom} vers la classe ${libelle(cible)} ?\n\nSes aménagements sont conservés et marqués « à confirmer ». Relisez-les avant d'envoyer un lien enseignant.`)) return;
    setEnCours(true);
    setErreur('');
    try {
      await onChanger(cibleId);
      onFait?.();
    } catch (e) {
      setErreur(messageErreurChangement(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <details className="pt-2 border-t border-[color:var(--border)]">
      <summary className="text-sm cursor-pointer">Changer de classe en cours d'année</summary>
      <div className="space-y-1 mt-2">
        {classes.length === 0 ? (
          <p className="text-xs text-[color:var(--text3)]">Aucune autre classe disponible pour cette année scolaire.</p>
        ) : (
          <>
            <label htmlFor={`${id}-cible`} className="block text-sm font-medium">Nouvelle classe</label>
            <select id={`${id}-cible`} className="plai-input w-full" value={cibleId} disabled={enCours}
              onChange={(e) => { setCibleId(e.target.value); setErreur(''); }}>
              <option value="">— choisir —</option>
              <optgroup label="Cette implantation">
                {propres.map((c) => <option key={c.id} value={c.id}>{libelle(c)}</option>)}
              </optgroup>
              {autres.map(({ ecole, classes: cl }) => (
                <optgroup key={ecole.id} label={ecole.nom}>
                  {cl.map((c) => <option key={c.id} value={c.id}>{libelle(c)}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-[color:var(--text3)]">
              L'élève garde ses aménagements, marqués « à confirmer » : relisez-les avant d'envoyer un lien enseignant. Les AU de la nouvelle classe s'appliquent d'eux-mêmes.
              Pour passer à l'année suivante, utilisez plutôt « Reprise d'année ».
            </p>
            {bloquants.length > 0 && <p role="alert" className="plai-error text-xs">{messageBlocageChangement(bloquants, eleve.prenom)}</p>}
            {bloquants.length === 0 && perdus.length > 0 && (
              <p role="note" className="text-xs p-2 rounded" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>{messagePerte(perdus)}</p>
            )}
            {erreur && <p role="alert" className="plai-error text-xs">{erreur}</p>}
            <button type="button" className="plai-btn" onClick={changer} disabled={!cibleId || bloquants.length > 0 || enCours}>
              {enCours ? 'Changement…' : 'Changer de classe'}
            </button>
          </>
        )}
      </div>
    </details>
  );
}
```

- [ ] **Step 4 : Lancer les tests de `ChangerClasse`**

Run : `npx vitest run tests/domain/changerClasse.test.jsx`
Expected : PASS (6 tests). Si le test « note » échoue : vérifier que `cibles2.modes` ne contient bien que la classe `c1` en AU.

- [ ] **Step 5 : Écrire le test de `EleveEditor` (échec attendu)**

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EleveEditor from '../../src/components/saisie/EleveEditor.jsx';

afterEach(cleanup);
const eleve = { id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D', commentaire: '', statut: 'PAR' };

describe('EleveEditor : avertissements et emplacement extra', () => {
  it("affiche chaque ligne d'avertissement dans un encadré identifié", () => {
    render(<EleveEditor eleve={eleve} onSave={vi.fn()} onClose={vi.fn()} avertissements={['Changement de classe le 3 octobre 2026.', '2 aménagements « à confirmer »']} />);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('Changement de classe');
    expect(note.textContent).toContain('2 aménagements « à confirmer »');
  });

  it("n'affiche aucun encadré sans avertissement", () => {
    render(<EleveEditor eleve={eleve} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('rend le contenu extra', () => {
    render(<EleveEditor eleve={eleve} onSave={vi.fn()} onClose={vi.fn()} extra={<p>bloc extra</p>} />);
    expect(screen.getByText('bloc extra')).toBeTruthy();
  });
});
```

Run : `npx vitest run tests/domain/eleveEditorAvertissements.test.jsx`
Expected : FAIL (pas de rôle `note`, pas de contenu extra).

- [ ] **Step 6 : Modifier `EleveEditor.jsx`**

Remplacer la signature :
`export default function EleveEditor({ eleve, onSave, onDelete, onClose }) {`
par :
`export default function EleveEditor({ eleve, onSave, onDelete, onClose, avertissements = [], extra = null }) {`

Remplacer :
```jsx
    <div className="plai-card p-3 space-y-2 w-72">
      <div>
        <label className="block text-sm font-medium">Prénom</label>
```
par :
```jsx
    <div className="plai-card p-3 space-y-2 w-72">
      {avertissements.length > 0 && (
        <div role="note" className="text-xs p-2 rounded space-y-1" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>
          {avertissements.map((l) => <p key={l}>{l}</p>)}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Prénom</label>
```

Remplacer :
```jsx
      {eleve?.id && onDelete && (
        <div className="pt-2 border-t border-[color:var(--border)]">
```
par :
```jsx
      {eleve?.id && extra}

      {eleve?.id && onDelete && (
        <div className="pt-2 border-t border-[color:var(--border)]">
```

Run : `npx vitest run tests/domain/eleveEditorAvertissements.test.jsx`
Expected : PASS.

- [ ] **Step 7 : Modifier `EnTeteEleves.jsx` (transmettre les deux emplacements)**

Remplacer la signature :
`export default function EnTeteEleves({ eleves, onSaveEleve, onDeleteEleve, eleveSurvole, onHoverEleve }) {`
par :
`export default function EnTeteEleves({ eleves, onSaveEleve, onDeleteEleve, eleveSurvole, onHoverEleve, avertissementsDe, extraDe }) {`

Remplacer :
```jsx
                <EleveEditor eleve={e} onClose={() => setEditId(null)}
```
par :
```jsx
                <EleveEditor eleve={e} onClose={() => setEditId(null)}
                  avertissements={avertissementsDe?.(e) ?? []} extra={extraDe?.(e)}
```

- [ ] **Step 8 : Suite complète + build**

Run : `npm test && npx vite build`
Expected : tout PASS (les tests existants ne passent pas ces props : valeurs par défaut) ; build OK.

- [ ] **Step 9 : Commit**

```bash
git add src/components/saisie tests/domain/changerClasse.test.jsx tests/domain/eleveEditorAvertissements.test.jsx
git commit -m "feat(changement-classe): bloc Changer de classe et avertissements dans la fiche élève"
```

---

### Task 5 : Câblage dans la Saisie

**Files:**
- Modify: `src/pages/SaisieEcole.jsx`
- Modify: `tests/domain/saisieEcoleDispositifs.test.jsx`

- [ ] **Step 1 : Adapter les mocks du test existant et ajouter les tests (échec attendu)**

Dans `tests/domain/saisieEcoleDispositifs.test.jsx`, après la ligne `vi.mock('../../src/hooks/useGridMutations.js', ...)`, ajouter :

```jsx
vi.mock('../../src/hooks/useClassesCibles.js', () => ({
  useClassesCibles: () => ({ data: { classes: [{ id: 'c1', nom: '5LA', niveau: '5e', ecole_id: 's1' }, { id: 'c2', nom: '5LB', niveau: '5e', ecole_id: 's1' }], modes: [] } }),
}));
```

Dans la fonction `installer`, remplacer la ligne `eleves: [{ id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D' }],` par :

```jsx
    eleves: [{ id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D', classe_changee_le: eleveChange ? '2026-10-03T12:00:00Z' : null, classe_precedente_nom: eleveChange ? '4A' : null }],
```

et la signature `function installer({ modes = [], selectionsAR = [], libres = [], role = 'referent_plai' } = {}) {` par :

```jsx
function installer({ modes = [], selectionsAR = [], libres = [], role = 'referent_plai', eleveChange = false } = {}) {
```

À la fin du fichier, ajouter un nouveau `describe` :

```jsx
describe('SaisieEcole : changement de classe', () => {
  it("avertit à l'édition d'un élève dont des aménagements sont « à confirmer »", () => {
    installer({ selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1', a_confirmer: true }] });
    ouvrirClasse();
    fireEvent.click(screen.getByTitle('Cliquer pour modifier'));
    expect(screen.getByRole('note').textContent).toContain('1 aménagement « à confirmer »');
  });

  it("n'avertit pas quand rien n'est à confirmer et que l'élève n'a pas changé de classe", () => {
    installer({ selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1', a_confirmer: false }] });
    ouvrirClasse();
    fireEvent.click(screen.getByTitle('Cliquer pour modifier'));
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('propose « Changer de classe en cours d\'année » aux référents, pas aux agents', () => {
    installer({ role: 'referent_plai' });
    ouvrirClasse();
    fireEvent.click(screen.getByTitle('Cliquer pour modifier'));
    expect(screen.getByText("Changer de classe en cours d'année")).toBeTruthy();
    cleanup();
    installer({ role: 'agent_plai' });
    ouvrirClasse();
    fireEvent.click(screen.getByTitle('Cliquer pour modifier'));
    expect(screen.queryByText("Changer de classe en cours d'année")).toBeNull();
  });
});
```

Run : `npx vitest run tests/domain/saisieEcoleDispositifs.test.jsx`
Expected : FAIL sur les 3 nouveaux tests (les anciens passent grâce au mock).

- [ ] **Step 2 : Modifier `SaisieEcole.jsx`**

Remplacer :
`import { useEcoleGrid } from '../hooks/useEcoleGrid.js';`
par :
```jsx
import { useEcoleGrid, useEcoles } from '../hooks/useEcoleGrid.js';
import { useClassesCibles } from '../hooks/useClassesCibles.js';
```

Après la ligne `import { chapitreEnModeAU, bloqueBasculeDispositif } from '../domain/dispositifs.js';` ajouter :

```jsx
import { aConfirmerParClasse } from '../domain/reprise.js';
import { avertissementEleve } from '../domain/changementClasse.js';
import ChangerClasse from '../components/saisie/ChangerClasse.jsx';
```

Après la ligne `const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);` ajouter :

```jsx
  const { data: ecoles = [] } = useEcoles();
  const { data: cibles } = useClassesCibles(ctx.anneeId);
```

Après le bloc `const eleves = useMemo(...)` (la ligne qui se termine par `.filter((e) => e.classe_id === classeId), [grid, classeId]);`) ajouter :

```jsx
  // Aménagements « à confirmer » par élève de la classe (repris de l'année précédente ou d'un changement de classe).
  const nAConfirmerParEleve = useMemo(() => {
    if (!grid) return new Map();
    const r = aConfirmerParClasse({ eleves, selectionsAR: grid.selectionsAR, libres: grid.libres, auClasse: [] });
    return new Map(r.parEleve.map((x) => [x.eleve.id, x.n]));
  }, [grid, eleves]);
  const avertissementsDe = (e) => avertissementEleve({ eleve: e, nAConfirmer: nAConfirmerParEleve.get(e.id) ?? 0 });
```

Après la définition de `enteteDe` (le bloc qui se termine par `onBascule: (vers) => tenterBascule(ch, vers),\n  });`) ajouter :

```jsx
  // « Changer de classe » : réservé à qui peut éditer la structure (pas l'agent accompagnant).
  const extraDe = (e) => (peutEditerStructure ? (
    <ChangerClasse eleve={e} cibles={cibles} ecoles={ecoles} ecoleId={ctx.ecoleId}
      donnees={{ chapitres, amenagements: cat?.amenagements ?? [], selectionsAR: grid?.selectionsAR ?? [], libres: grid?.libres ?? [] }}
      onChanger={(classeCibleId) => mut.changerClasse.mutateAsync({ eleveId: e.id, classeCibleId })}
      onFait={() => setEditId(null)} />
  ) : null);
```

Dans la liste des élèves, remplacer :
```jsx
                        <EleveEditor eleve={e} onClose={() => setEditId(null)}
```
par :
```jsx
                        <EleveEditor eleve={e} onClose={() => setEditId(null)}
                          avertissements={avertissementsDe(e)} extra={extraDe(e)}
```

Dans le tableau, remplacer :
```jsx
                eleveSurvole={eleveSurvole} onHoverEleve={setEleveSurvole} />
              <tbody>
```
par :
```jsx
                eleveSurvole={eleveSurvole} onHoverEleve={setEleveSurvole}
                avertissementsDe={avertissementsDe} extraDe={extraDe} />
              <tbody>
```

- [ ] **Step 3 : Lancer les tests de la page**

Run : `npx vitest run tests/domain/saisieEcoleDispositifs.test.jsx`
Expected : PASS (anciens et nouveaux).

- [ ] **Step 4 : Suite complète + build**

Run : `npm test && npx vite build`
Expected : PASS ; build OK.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/SaisieEcole.jsx tests/domain/saisieEcoleDispositifs.test.jsx
git commit -m "feat(changement-classe): câblage dans la saisie (avertissements et bouton Changer de classe)"
```

---

### Task 6 : Avertissement avant d'envoyer un lien enseignant

**Files:**
- Modify: `src/components/GenerateurLien.jsx`
- Modify: `src/pages/FicheClassePage.jsx`
- Test: `tests/domain/generateurLienAvertissement.test.jsx`

- [ ] **Step 1 : Écrire le test (échec attendu)**

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../src/lib/supabase.js', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('../../src/lib/copierLien.js', () => ({ copierLien: vi.fn() }));

const { default: GenerateurLien } = await import('../../src/components/GenerateurLien.jsx');

afterEach(cleanup);

describe('GenerateurLien : avertissement avant envoi', () => {
  it("affiche l'avertissement fourni, sans bloquer la génération", () => {
    render(<GenerateurLien classeIds={['c1']} libelle="x" avertissement="3 aménagements « à confirmer » dans cette fiche (2 élèves)." />);
    expect(screen.getByRole('note').textContent).toContain('3 aménagements « à confirmer »');
    expect(screen.getByRole('button', { name: /Générer et copier le lien/ }).disabled).toBe(false);
  });

  it("n'affiche rien sans avertissement", () => {
    render(<GenerateurLien classeIds={['c1']} libelle="x" />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
```

Run : `npx vitest run tests/domain/generateurLienAvertissement.test.jsx`
Expected : FAIL (pas de rôle `note`).

- [ ] **Step 2 : Modifier `GenerateurLien.jsx`**

Remplacer la ligne de documentation :
` * Props : classeIds (1 à 10), nomGroupe (fiche groupée), libelle (texte cliquable collé dans le courriel).`
par :
` * Props : classeIds (1 à 10), nomGroupe (fiche groupée), libelle (texte cliquable collé dans le courriel),
 * avertissement (texte facultatif affiché avant le bouton, ex. aménagements « à confirmer » : non bloquant).`

Remplacer la signature :
`export default function GenerateurLien({ classeIds, nomGroupe, libelle }) {`
par :
`export default function GenerateurLien({ classeIds, nomGroupe, libelle, avertissement = null }) {`

Remplacer :
```jsx
      <button type="submit" className="plai-btn" style={{ fontSize: 16 }} disabled={enCours}>
```
par :
```jsx
      {avertissement && (
        <p role="note" className="p-2 rounded" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412', fontSize: 16 }}>
          {avertissement}
        </p>
      )}
      <button type="submit" className="plai-btn" style={{ fontSize: 16 }} disabled={enCours}>
```

Run : `npx vitest run tests/domain/generateurLienAvertissement.test.jsx`
Expected : PASS.

- [ ] **Step 3 : Modifier `FicheClassePage.jsx`**

Après la ligne `import GenerateurLien from '../components/GenerateurLien.jsx';` ajouter :

```jsx
import { useAConfirmerClasses } from '../hooks/useAConfirmer.js';
import { messageAvantEnvoi } from '../domain/changementClasse.js';
```

Dans `Picker`, après la ligne `const apercu = useFicheGroupe(valide?.classeIds, valide?.nomGroupe);` ajouter :

```jsx
  const aConfirmer = useAConfirmerClasses(valide?.classeIds);
```

Dans `Picker`, remplacer :
```jsx
                    nomGroupe={valide.nomGroupe}
                    libelle={`Aménagements à mettre en place — ${apercu.data.classeNom}`}
```
par :
```jsx
                    nomGroupe={valide.nomGroupe}
                    libelle={`Aménagements à mettre en place — ${apercu.data.classeNom}`}
                    avertissement={messageAvantEnvoi(aConfirmer.data)}
```

Dans `FicheClasseContenu`, remplacer :
```jsx
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  const { role } = useRole();
```
par :
```jsx
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  const { role } = useRole();
  const aConfirmer = useAConfirmerClasses([classeId]);
```

et remplacer :
```jsx
        <GenerateurLien classeIds={[classeId]} libelle={`Aménagements à mettre en place — ${vm.classeNom} (${vm.ecoleNom})`} />
```
par :
```jsx
        <GenerateurLien classeIds={[classeId]} libelle={`Aménagements à mettre en place — ${vm.classeNom} (${vm.ecoleNom})`}
          avertissement={messageAvantEnvoi(aConfirmer.data)} />
```

(Le hook est placé avant les `return` conditionnels `if (isLoading)` / `if (error)`, comme l'exigent les règles des hooks.)

- [ ] **Step 4 : Suite complète + build**

Run : `npm test && npx vite build`
Expected : PASS ; build OK.

- [ ] **Step 5 : Commit**

```bash
git add src/components/GenerateurLien.jsx src/pages/FicheClassePage.jsx src/hooks/useAConfirmer.js tests/domain/generateurLienAvertissement.test.jsx
git commit -m "feat(changement-classe): avertissement des aménagements à confirmer avant de générer un lien enseignant"
```

---

### Task 7 : Mode d'emploi

**Files:**
- Modify: `docs/modes-emploi/referents-plai.html`
- Modify: `public/modes-emploi/referents-plai.html` (copie identique ; `dist/` est un résultat de build, ne pas l'éditer)

- [ ] **Step 1 : Ajouter l'item dans « Saisir les aménagements AU et AR »**

Dans `docs/modes-emploi/referents-plai.html`, remplacer :

```html
      <li><strong>Commentaire par élève</strong> : zone de texte libre, éditable depuis la liste des élèves.</li>
```
par :
```html
      <li><strong>Commentaire par élève</strong> : zone de texte libre, éditable depuis la liste des élèves.</li>
      <li><strong>Un élève change de classe en cours d'année</strong> : cliquez sur son nom, puis dépliez « Changer de classe en cours d'année » et choisissez la nouvelle classe (même année scolaire). L'élève garde ses aménagements, marqués <strong>« à confirmer »</strong> : relisez-les dans la Saisie avant d'envoyer un lien enseignant. Pourquoi : un aménagement choisi dans une classe ne vaut pas toujours dans l'autre (autres cours, autres enseignants). Les AU de la nouvelle classe s'appliquent d'eux-mêmes. Le changement est <strong>refusé</strong> si l'élève a des aménagements cochés individuellement dans un dispositif que la nouvelle classe applique à toute la classe : décochez-les d'abord. Dans le cas inverse (dispositif pour toute la classe au départ, élève par élève à l'arrivée), une note vous rappelle de le cocher pour l'élève. Changer d'implantation est réservé à l'administrateur (ou à un référent rattaché aux deux implantations). Un lien enseignant montre la fiche telle qu'elle est quand l'enseignant l'ouvre : l'élève y apparaît dès le changement.</li>
```

- [ ] **Step 2 : Ajouter l'avertissement dans « Générer, nommer et révoquer un lien enseignant »**

Lire d'abord la section (`grep -n "Créer un lien" -A12 docs/modes-emploi/referents-plai.html`) puis, à la fin de la liste d'étapes de « Créer un lien », ajouter un paragraphe :

```html
    <p>Si des aménagements de la fiche sont encore marqués « à confirmer » (élève changé de classe, ou repris de l'année précédente), un encadré orange l'indique avant le bouton « Générer et copier le lien ». Il ne bloque rien : relisez d'abord dans la Saisie si vous voulez envoyer une fiche relue.</p>
```

- [ ] **Step 3 : Synchroniser la copie publique et vérifier**

```bash
cp docs/modes-emploi/referents-plai.html public/modes-emploi/referents-plai.html
diff -q docs/modes-emploi/referents-plai.html public/modes-emploi/referents-plai.html && echo identiques
```
Expected : `identiques`.

- [ ] **Step 4 : Commit**

```bash
git add docs/modes-emploi/referents-plai.html public/modes-emploi/referents-plai.html
git commit -m "docs(modes-emploi): changement de classe en cours d'année et avertissement avant envoi du lien"
```

---

### Task 8 : Vérification bout en bout (navigateur)

Pas de fonction `/api/*` ici : `npm run dev` suffit. Données de test uniquement (École test + une 2e implantation de test), **jamais de données réelles**. Pas de test SQL direct : dans le SQL Editor `auth.uid()` est nul et la fonction refuserait (`droit_insuffisant`) ; tout se vérifie via l'app connectée.

- [ ] **Step 1 : Préparer les données de test**

Dans Supabase (SQL Editor), année active `2026-2027` : implantation « École test » avec classes `4A`, `4B`, `5C` ; une 2e implantation « École test 2 » avec une classe `4D`. Élèves fictifs : Alix (4A, quelques AR + 1 libre), Bao (4A, 1 case dans le dispositif), Cleo (4B). Dispositif « régulation » : `4B` en mode AU, `4A` en mode AR ; AU différents entre `4A` et `4B`.

- [ ] **Step 2 : Lancer l'app** — `npm run dev` (via `preview_start`), connexion en référent de « École test ».

- [ ] **Step 3 : Parcours à vérifier (cocher chaque point)**

1. Saisie, classe `4A`, clic sur Alix : « Changer de classe en cours d'année » propose `4B` et `5C` (groupe « Cette implantation »), pas `4A`, **pas** de groupe « École test 2 ».
2. Alix → `5C` : confirmation, puis Alix disparaît de `4A`, apparaît dans `5C` avec cases AR conservées et orangées, bandeau « à confirmer » (reprise Task 6) avec le bon compte. L'AU de `5C` s'affiche, ceux de `4A` n'apparaissent plus pour Alix (fiche élève).
3. Clic sur Alix dans `5C` : encadré orange « Changement de classe le … (depuis 4A) » + « N aménagements « à confirmer » ».
4. « Confirmer Alix » (bandeau) : ses cases ne sont plus orangées ; l'encadré d'édition ne garde que la ligne « Changement de classe » (30 jours) ; après 30 jours simulés (changer la date en base) plus aucun encadré.
5. Bao (case dans le dispositif) → `4B` (dispositif en AU) : message d'impossibilité nommant le dispositif, bouton désactivé, aucune requête RPC envoyée (onglet réseau). Décocher la case de Bao, relancer : changement accepté.
6. Cleo : `4B` (dispositif AU) → `4A` (dispositif AR) : note orange « s'appliquait à toute la classe… cochez-le pour cet élève », bouton actif, changement accepté, aucun AR créé.
7. Fiche classe `4A` (`/classe/:id/fiche`) → « Copier le lien enseignant » : l'encadré orange « N aménagements « à confirmer » dans cette fiche » apparaît ; le bouton reste actif ; après « Tout confirmer » dans la Saisie, l'encadré disparaît (recharger la page).
8. Fiche groupée (Picker, 2 classes, Valider) : même encadré avec le total des deux classes.
9. Compte `agent_plai` : pas de bloc « Changer de classe » ; encadré d'avertissement visible à l'édition (lecture seule des avertissements).
10. Compte admin : le sélecteur propose aussi `4D` (groupe « École test 2 ») ; Alix → `4D` accepté ; l'élève apparaît dans la Saisie de « École test 2 » ; son ancienne école ne le voit plus.
11. Compte référent d'une seule école, appel RPC forcé vers une classe d'une autre école (console navigateur : `supabase.rpc('ar_changer_classe_eleve', …)`) : erreur `classe_cible_introuvable` (RLS), jamais de déplacement.
12. Classe d'une autre année scolaire : non proposée dans le sélecteur ; appel RPC forcé : erreur `annee_differente`.
13. Fiches de l'ancienne classe : les snapshots déjà figés (`ar_fiche_snapshots`) sont inchangés.
14. **Alignement de la reprise** : lancer l'assistant `/reprise` 2026-2027 → 2027-2028 sur « École test » : les classes clonées gardent le mode du dispositif (`4B` en AU) ; un élève dont la case est dans le dispositif est repris vers `4B` **sans** cette case (les autres AR sont copiés « à confirmer »), sans erreur.
15. La mutation invalide bien : après un changement, la grille de l'implantation d'arrivée (changer de contexte dans le sélecteur) montre l'élève sans rechargement manuel.

- [ ] **Step 4 : Console et réseau**

`read_console_messages` (aucune erreur) et `read_network_requests` : `POST /rest/v1/rpc/ar_changer_classe_eleve` répond 204 en cas de succès et 400/403 avec le message court prévu en cas de refus ; aucun 400 sur `ar_eleves` (nouvelles colonnes présentes), `ar_selections`, `ar_amenagements_libres`.

- [ ] **Step 5 : Captures** — bloc « Changer de classe », message de blocage, note de perte, encadré d'édition, encadré avant envoi du lien, à joindre au compte rendu à JF.

- [ ] **Step 6 : Suite complète + build**

Run : `npm test && npx vite build`
Expected : PASS + build OK.

---

### Task 9 : Revue finale et remise

- [ ] **Step 1 : Revue globale du diff**

Dispatcher `superpowers:requesting-code-review` sur `git diff origin/main...HEAD` (revue globale, pas seulement par tâche). Points d'attention :
- `ar_changer_classe_eleve` et `ar_conflits_dispositif` : droits (les deux implantations), absence de fuite de données (messages d'erreur sans contenu d'élève), `security invoker`, pas d'`EXISTS` auto-joint dans une politique ;
- cohérence SQL / JS des règles de dispositif (`ar_conflits_dispositif` ↔ `dispositifsBloquants`) ;
- les trois fonctions de la migration `20261003b` qui remplacent celles de `20261003` : aucune régression de la reprise annuelle (relancer le parcours 14 de la Task 8) ;
- noms (`a_confirmer`, `classe_changee_le`, `classe_precedente_nom`, `changerClasse`, `useClassesCibles`) cohérents entre migration, hooks, composants ; aucun `console.log`.

- [ ] **Step 2 : Décision de livraison avec JF**

Ne pas pousser sans accord. Ordre : migration `20261003` (reprise) puis `20261003b` appliquées → push `feature/changement-classe` → merge sur `main` (Vercel redéploie). Questions à rappeler à JF : décision 4 (liens vivants), question RGPD de la visibilité des AR par la nouvelle implantation. Suite à proposer : vignette AménagActif dans `portail-plai/src/data/apps.ts` (repo séparé), mise à jour de la mémoire projet (`project_amenagactif_*`).

---

## Auto-revue (couverture par rapport à la demande)

| Exigence | Où |
|---|---|
| Élève qui change de classe en cours d'année | Task 1 (`ar_changer_classe_eleve`), Task 4-5 (bloc « Changer de classe ») |
| Élève qui change d'implantation | Même fonction ; droit sur les deux implantations (admin, ou référent des deux) ; liste de destinations filtrée par la RLS (Task 3 `useClassesCibles`), parcours 10-11 |
| Liée à la reprise annuelle | Section « Lien avec la reprise annuelle », marqueur `a_confirmer` partagé, `aConfirmerParClasse` réutilisée, migration alignant `ar_cloner_classes` / `ar_reprendre_eleve` (Task 1), parcours 14 |
| Point 4 : repasser en manuel avant l'envoi des liens | Blocage des dispositifs incompatibles (jamais de conversion), note pour le cas inverse (Task 2, 4), AR marqués « à confirmer » |
| Point 4 : avertissement quand l'élève est édité | `avertissementEleve` + `EleveEditor` (Task 2, 4, 5) |
| Point 4 : avant l'envoi des liens | `messageAvantEnvoi` + `GenerateurLien` (Task 2, 6) |
| Pas de doublon à la reprise annuelle | Décision 1 (même ligne), Task 8 point 14 |
| Guidage contextuel des champs | Label + texte d'aide sous le sélecteur (Task 4 Step 3) |
| Accessibilité | `label` associé, `role="alert"` / `role="note"`, état exprimé en texte (pas seulement par la couleur) |
| Mode d'emploi à jour | Task 7 |

Points d'incertitude :
1. La syntaxe `from ar_conflits_dispositif(...) as c(titre)` et `array_agg(c.titre)` suppose PostgreSQL ≥ 12 (Supabase actuel) ; à confirmer à l'application de la migration.
2. Le comportement des politiques RLS lors de l'`UPDATE ar_eleves SET classe_id` (clause `with check` sur la nouvelle école) est vérifié par les parcours 10-11 de la Task 8, pas par un test automatisé (pas d'infrastructure de test SQL dans le repo).
3. La Task 6 du plan de reprise (affichage « à confirmer ») n'a pas été relue contre `CarteDispositif.jsx` ; voir Prérequis.
4. Les tests de composants supposent qu'aucun autre élément de la page de saisie n'a `role="note"` ; si un test échoue pour cette raison, cibler l'encadré par son texte.
