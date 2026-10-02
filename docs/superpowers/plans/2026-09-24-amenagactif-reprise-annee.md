# AménagActif — Reprise des élèves d'une année à l'autre — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Permettre au référent (et à l'admin) de reprendre en quelques minutes les élèves de l'année N vers les classes de N+1, sans tout réencoder, avec AR/AU copiés « à confirmer ».

**Architecture :** Un assistant en 3 étapes (`/reprise`) : (1) cloner les classes N → N+1 et cartographier chaque **groupe** de N vers une classe N+1 ; (2) corriger les exceptions élève par élève (chaque élève peut aller dans n'importe quelle classe, ou « autre implantation », ou « fin de parcours ») ; (3) synthèse puis application. La logique de décision est du JS pur testé (`src/domain/reprise.js`) ; les écritures passent par 3 fonctions SQL (`ar_cloner_classes`, `ar_reprendre_eleve` en `security invoker`, donc soumises à la RLS existante ; `ar_eleves_deja_repris` en `security definer`, ids seulement). Le changement d'implantation est traité par l'admin dans une file « à réaffecter ».

**Tech Stack :** React 18 + Vite 5 + Tailwind 3, Supabase v2 (RPC + RLS), TanStack Query, Vitest + Testing Library. Aucune fonction `/api/*` : `vite dev` suffit pour tester.

---

## Décisions prises (à corriger si désaccord avant exécution)

1. **Pas de champ `filiere`** en v1 et **pas de suggestion automatique** de classe par lettre/niveau : la correspondance groupe → classe est toujours un choix explicite du référent (une mauvaise suggestion est pire que pas de suggestion).
2. **`a_confirmer` = marqueur de saisie uniquement.** Les fiches, snapshots, liens enseignants et le profil DiffActif continuent d'inclure les AR/AU repris (meilleure connaissance disponible à la rentrée). Alternative écartée : les exclure des fiches tant qu'ils ne sont pas confirmés (risque : un élève sans aménagement pendant les premières semaines).
3. **Non repris** : le `commentaire` élève (contextuel, ex. « décès de la grand-mère »). **Repris** : prénom, initiale, statut IPT/PAR, AR, aménagements libres (le référent PLAI est porté par la classe, pas par l'élève).
4. **AU** : cloner une classe copie ses AU (marqués `a_confirmer`) uniquement pour les classes **nouvellement créées** (relancer le clonage ne ré-ajoute jamais un AU décoché).
5. **Un élève ne peut être repris qu'une fois** (index unique sur `eleve_precedent_id`). Un élève déjà repris ailleurs (ex. par l'admin dans une autre implantation) disparaît de la liste du référent.
6. **Changement d'implantation = admin.** Le référent marque « Autre implantation » (`devenir='transfert'`) ; l'admin voit la file et affecte. L'admin peut aussi choisir directement une classe d'une autre implantation à l'étape 2.
7. Rôles autorisés : `admin`, `referent_plai`, `direction`. Pas `agent_plai` (il ne crée pas de classes).
8. Aucune référence scientifique dans cette fonctionnalité : pas de vérification RISS requise.
9. **Hors périmètre v1** : signalement « à revoir en priorité » selon changement de niveau/filière, report des assignations enseignants (déjà exclu par le plan du 22/09), clôture de l'année N en lecture seule, purge RGPD, nouvel élève absent des listes (reste dans la Saisie, `AjoutEleve`).

## Prérequis d'exécution

- Partir de `main` (pas de `feature/commentaire-classe`, en attente de JF).
- **Ordre de déploiement obligatoire : migration SQL appliquée AVANT le déploiement du front** — `useEcoleGrid` sélectionnera `a_confirmer` ; sans la colonne, toute la grille de saisie tombe en erreur.
- Build check local avant tout push : `npx vite build` (règle absolue). Ne pas pousser sans accord de JF (chaque push sur `main` redéploie Vercel).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261003_amenagactif_reprise_annee.sql` (créer) | Colonnes `a_confirmer`, `devenir`, index unique, politique UPDATE AU, 3 fonctions RPC |
| `src/domain/reprise.js` (créer) | Logique pure : groupes, choix effectifs, exceptions, synthèse, opérations, comptage « à confirmer », année source par défaut |
| `tests/domain/reprise.test.js` (créer) | Tests de la logique pure |
| `src/hooks/useReprise.js` (créer) | Lectures (données de l'assistant, file de transferts) + mutations (cloner, niveau, appliquer, reprendre un) |
| `src/components/reprise/EtapeClasses.jsx` (créer) | Étape 1 : clonage, niveaux, correspondance groupes → classes |
| `src/components/reprise/EtapeEleves.jsx` (créer) | Étape 2 : exceptions par élève |
| `src/components/reprise/EtapeSynthese.jsx` (créer) | Étape 3 : synthèse + application + rapport |
| `src/components/reprise/FileTransferts.jsx` (créer) | Admin : élèves « autre implantation » à réaffecter |
| `src/pages/Reprise.jsx` (créer) | Page assistant (sélecteurs, étapes) |
| `src/components/saisie/BandeauAConfirmer.jsx` (créer) | Saisie : bandeau « X AR repris à confirmer » |
| `src/App.jsx`, `src/components/Nav.jsx`, `src/pages/Administration.jsx` (modifier) | Route, lien nav, lien depuis la section Années |
| `src/hooks/useEcoleGrid.js`, `src/hooks/useGridMutations.js`, `src/components/saisie/ChapitreAR.jsx`, `src/components/saisie/BandeauAU.jsx`, `src/pages/SaisieEcole.jsx` (modifier) | Affichage et confirmation des AR/AU repris |
| `README.md` (modifier) | Mise à jour de la ligne « À venir » |

---

### Task 0 : Worktree

- [ ] **Step 1 : Créer le worktree depuis main**

```bash
cd /c/Users/jfbeg/OneDrive/claude-workspace/AmenagActif
git fetch origin
git worktree add .claude/worktrees/amenagactif-reprise-annee -b feature/reprise-annee origin/main
cd .claude/worktrees/amenagactif-reprise-annee
npm install
```

- [ ] **Step 2 : Vérifier la base de tests**

Run : `npm test`
Expected : PASS (tests existants de `main`).

Toutes les commandes suivantes s'exécutent dans ce worktree. Copier `.env.local` du dossier principal vers le worktree pour les tests manuels (Task 8).

---

### Task 1 : Migration SQL

**Files:**
- Create: `supabase/migrations/20261003_amenagactif_reprise_annee.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- AménagActif — reprise des élèves d'une année à l'autre.
-- À exécuter APRÈS 20261002_amenagactif_dispositifs.sql, AVANT le déploiement du front.
-- ar_cloner_classes et ar_reprendre_eleve sont SECURITY INVOKER (RLS de l'appelant).

begin;

-- ── Marqueur « repris de l'année précédente, à confirmer » ──
alter table ar_selections          add column if not exists a_confirmer boolean not null default false;
alter table ar_amenagements_libres add column if not exists a_confirmer boolean not null default false;
alter table ar_amenagements_classe add column if not exists a_confirmer boolean not null default false;

-- ── Devenir d'un élève non repris dans la même implantation ──
-- transfert : change d'implantation (file « à réaffecter » de l'admin)
-- termine   : fin de parcours / quitte le réseau (rien à faire)
alter table ar_eleves add column if not exists devenir text
  check (devenir in ('transfert', 'termine'));

-- ── Un élève N ne peut avoir qu'un successeur ──
create unique index if not exists ar_eleves_precedent_uniq
  on ar_eleves (eleve_precedent_id) where eleve_precedent_id is not null;

-- ── ar_amenagements_classe n'a plus de politique UPDATE (20260924) : nécessaire pour « confirmer » ──
create policy ar_amgt_classe_update on ar_amenagements_classe for update to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)));

-- ── 1. Cloner les classes d'une année vers une autre (idempotent) ──
-- Copie nom, niveau, référent PLAI. Copie les AU (a_confirmer) uniquement des classes créées ici.
-- Deux instructions séparées : la 2e doit « voir » les classes insérées par la 1re (RLS).
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

  return coalesce(array_length(v_nouvelles, 1), 0);
end $$;

-- ── 2. Reprendre un élève dans une classe de l'année suivante ──
-- Lève 23505 (index unique) si l'élève a déjà un successeur.
create or replace function ar_reprendre_eleve(p_source uuid, p_classe_cible uuid)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_new uuid;
begin
  -- referent_plai_nom n'existe plus sur ar_eleves (supprimée par 20260916b : il vit sur ar_classes).
  insert into ar_eleves (classe_id, prenom, initiale_nom, statut, commentaire, eleve_precedent_id)
  select p_classe_cible, prenom, initiale_nom, statut, '', id
  from ar_eleves where id = p_source
  returning id into v_new;

  if v_new is null then
    raise exception 'eleve_source_introuvable' using errcode = 'P0002';
  end if;

  insert into ar_selections (eleve_id, amenagement_id, cree_par, a_confirmer)
  select v_new, amenagement_id, auth.uid(), true
  from ar_selections where eleve_id = p_source;

  insert into ar_amenagements_libres (eleve_id, chapitre_id, texte, cree_par, a_confirmer)
  select v_new, chapitre_id, texte, auth.uid(), true
  from ar_amenagements_libres where eleve_id = p_source;

  return v_new;
end $$;

-- ── 3. Quels élèves ont déjà un successeur (même dans une implantation que l'appelant ne lit pas) ──
-- SECURITY DEFINER : ne renvoie que des ids parmi ceux passés en argument, aucune donnée d'élève.
create or replace function ar_eleves_deja_repris(p_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = public as $$
  select eleve_precedent_id from ar_eleves where eleve_precedent_id = any(p_ids);
$$;

revoke all on function ar_cloner_classes(uuid, uuid, uuid) from public, anon;
revoke all on function ar_reprendre_eleve(uuid, uuid)      from public, anon;
revoke all on function ar_eleves_deja_repris(uuid[])       from public, anon;
grant execute on function ar_cloner_classes(uuid, uuid, uuid) to authenticated;
grant execute on function ar_reprendre_eleve(uuid, uuid)      to authenticated;
grant execute on function ar_eleves_deja_repris(uuid[])       to authenticated;

commit;
```

- [ ] **Step 2 : Vérifier qu'aucune politique UPDATE n'existait déjà sur `ar_amenagements_classe`**

Run : `grep -rn "on ar_amenagements_classe" supabase/migrations`
Expected : après `20260924_...`, seulement `insert`, `delete` et `read` (aucun `for update` ni `for all` actif). Si un `for all` existe encore, supprimer la création de `ar_amgt_classe_update` de la migration.

- [ ] **Step 3 : Appliquer la migration sur Supabase (projet partagé dfoaumjleqtxjeaplnna)**

Demander confirmation à JF avant d'exécuter (projet partagé). Coller le fichier dans le SQL Editor (ou `npx supabase db push` si le lien CLI est déjà configuré, cf. `supabase/.temp`).
Expected : `Success. No rows returned`.

- [ ] **Step 4 : Vérifier le schéma**

```sql
select table_name from information_schema.columns
where table_name in ('ar_selections','ar_amenagements_libres','ar_amenagements_classe') and column_name = 'a_confirmer';
-- Expected : 3 lignes
select column_name from information_schema.columns where table_name = 'ar_eleves' and column_name = 'devenir';
-- Expected : 1 ligne
select proname from pg_proc where proname in ('ar_cloner_classes','ar_reprendre_eleve','ar_eleves_deja_repris');
-- Expected : 3 lignes
```

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20261003_amenagactif_reprise_annee.sql
git commit -m "feat(reprise): migration a_confirmer, devenir, RPC clonage et reprise d'élèves"
```

---

### Task 2 : Logique pure (TDD)

**Files:**
- Create: `src/domain/reprise.js`
- Test: `tests/domain/reprise.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

```js
import { describe, it, expect } from 'vitest';
import {
  groupesSource, choixDeBase, choixEffectifs, poserException, versChoix, versValeur,
  synthese, operations, marquages, aConfirmerParClasse, anneeSourceParDefaut,
} from '../../src/domain/reprise.js';

const classes = [{ id: 'c3b', nom: '3B' }, { id: 'c3a', nom: '3A' }];
const eleves = [
  { id: 'e1', classe_id: 'c3a', prenom: 'Zoé', initiale_nom: 'D', devenir: null },
  { id: 'e2', classe_id: 'c3a', prenom: 'Amir', initiale_nom: 'K', devenir: null },
  { id: 'e3', classe_id: 'c3b', prenom: 'Lina', initiale_nom: 'M', devenir: null },
];

describe('groupesSource', () => {
  it('trie les classes puis les élèves par prénom', () => {
    const g = groupesSource(classes, eleves);
    expect(g.map((x) => x.classe.nom)).toEqual(['3A', '3B']);
    expect(g[0].eleves.map((e) => e.prenom)).toEqual(['Amir', 'Zoé']);
  });
});

describe('versChoix / versValeur', () => {
  it('aller-retour pour chaque type', () => {
    for (const v of ['none', 'transfert', 'termine', 'classe:abc']) {
      expect(versValeur(versChoix(v))).toBe(v);
    }
  });
  it('valeur inconnue → none', () => {
    expect(versChoix('n-importe-quoi')).toEqual({ type: 'none' });
  });
});

describe('choixDeBase / choixEffectifs', () => {
  const mapping = { c3a: 'n4a', c3b: '' };

  it('le mapping du groupe fournit la classe par défaut', () => {
    expect(choixDeBase(eleves[0], mapping)).toEqual({ type: 'classe', classeId: 'n4a' });
  });
  it('groupe sans correspondance → none (non traité)', () => {
    expect(choixDeBase(eleves[2], mapping)).toEqual({ type: 'none' });
  });
  it('un devenir déjà enregistré prime sur le mapping', () => {
    expect(choixDeBase({ ...eleves[0], devenir: 'transfert' }, mapping)).toEqual({ type: 'transfert' });
  });
  it('exception > base ; élèves déjà repris exclus', () => {
    const c = choixEffectifs({
      eleves, mapping, dejaRepris: ['e2'],
      exceptions: { e1: { type: 'classe', classeId: 'n4b' } },
    });
    expect(c.e1).toEqual({ type: 'classe', classeId: 'n4b' });
    expect(c.e2).toBeUndefined();
    expect(c.e3).toEqual({ type: 'none' });
  });
});

describe('poserException', () => {
  const mapping = { c3a: 'n4a' };
  it('ajoute une exception quand le choix diffère de la base', () => {
    const r = poserException({}, eleves[0], { type: 'classe', classeId: 'n4b' }, mapping);
    expect(r.e1).toEqual({ type: 'classe', classeId: 'n4b' });
  });
  it('retire l\'exception quand le choix redevient la base', () => {
    const r = poserException({ e1: { type: 'termine' } }, eleves[0], { type: 'classe', classeId: 'n4a' }, mapping);
    expect(r.e1).toBeUndefined();
  });
  it('ne mute pas l\'objet d\'origine', () => {
    const avant = { e1: { type: 'termine' } };
    poserException(avant, eleves[0], { type: 'none' }, mapping);
    expect(avant).toEqual({ e1: { type: 'termine' } });
  });
});

describe('synthese / operations / marquages', () => {
  const choix = {
    e1: { type: 'classe', classeId: 'n4a' },
    e2: { type: 'transfert' },
    e3: { type: 'none' },
  };
  it('compte chaque type + les déjà repris', () => {
    expect(synthese(choix, ['x', 'y'])).toEqual({ classe: 1, transfert: 1, termine: 0, none: 1, dejaRepris: 2 });
  });
  it('operations : uniquement les reprises en classe', () => {
    expect(operations(choix)).toEqual([{ sourceId: 'e1', classeId: 'n4a' }]);
  });
  it('marquages : écrit le devenir voulu quand il diffère de la base', () => {
    expect(marquages(choix, eleves)).toEqual([{ id: 'e2', devenir: 'transfert' }]);
  });
  it('marquages : repasser un élève en « non traité » efface son devenir', () => {
    const els = [{ ...eleves[0], devenir: 'transfert' }];
    expect(marquages({ e1: { type: 'none' } }, els)).toEqual([{ id: 'e1', devenir: null }]);
  });
  it('marquages : rien si déjà à jour', () => {
    const els = [{ ...eleves[1], devenir: 'transfert' }];
    expect(marquages({ e2: { type: 'transfert' } }, els)).toEqual([]);
  });
});

describe('aConfirmerParClasse', () => {
  const els = [
    { id: 'e1', prenom: 'Zoé', initiale_nom: 'D' },
    { id: 'e2', prenom: 'Amir', initiale_nom: 'K' },
  ];
  it('compte AR, aménagements libres et AU à confirmer, par élève', () => {
    const r = aConfirmerParClasse({
      eleves: els,
      selectionsAR: [
        { eleve_id: 'e1', a_confirmer: true }, { eleve_id: 'e1', a_confirmer: true },
        { eleve_id: 'e2', a_confirmer: false }, { eleve_id: 'zz', a_confirmer: true },
      ],
      libres: [{ eleve_id: 'e1', a_confirmer: true }],
      auClasse: [{ a_confirmer: true }, { a_confirmer: false }],
    });
    expect(r.parEleve).toEqual([{ eleve: els[0], n: 3 }]);
    expect(r.nAU).toBe(1);
    expect(r.total).toBe(4);
  });
  it('rien à confirmer → total 0', () => {
    const r = aConfirmerParClasse({ eleves: els, selectionsAR: [], libres: [], auClasse: [] });
    expect(r).toEqual({ parEleve: [], nAU: 0, total: 0 });
  });
});

describe('anneeSourceParDefaut', () => {
  const annees = [
    { id: 'a27', libelle: '2027-2028' }, { id: 'a26', libelle: '2026-2027' }, { id: 'a25', libelle: '2025-2026' },
  ];
  it('prend l\'année juste avant la cible', () => {
    expect(anneeSourceParDefaut(annees, 'a27').id).toBe('a26');
  });
  it('null s\'il n\'y a pas d\'année antérieure ou si la cible est inconnue', () => {
    expect(anneeSourceParDefaut(annees, 'a25')).toBeNull();
    expect(anneeSourceParDefaut(annees, 'nope')).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run : `npx vitest run tests/domain/reprise.test.js`
Expected : FAIL (`Failed to resolve import "../../src/domain/reprise.js"`).

- [ ] **Step 3 : Implémenter**

```js
// Logique pure de la reprise d'année. Aucune dépendance React/Supabase.

const cmp = (a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true });

/** Regroupe les élèves de l'année source par classe (classes et élèves triés). */
export function groupesSource(classes, eleves) {
  return [...classes].sort((a, b) => cmp(a.nom, b.nom)).map((classe) => ({
    classe,
    eleves: eleves.filter((e) => e.classe_id === classe.id).sort((a, b) => cmp(a.prenom, b.prenom)),
  }));
}

/** Valeur d'un <select> → choix. Valeurs : 'none' | 'transfert' | 'termine' | 'classe:<id>'. */
export function versChoix(valeur) {
  if (valeur === 'transfert' || valeur === 'termine') return { type: valeur };
  if (typeof valeur === 'string' && valeur.startsWith('classe:')) return { type: 'classe', classeId: valeur.slice(7) };
  return { type: 'none' };
}

export function versValeur(choix) {
  return choix.type === 'classe' ? `classe:${choix.classeId}` : choix.type;
}

/** Choix par défaut d'un élève : devenir déjà enregistré, sinon classe principale de son groupe, sinon non traité. */
export function choixDeBase(eleve, mapping) {
  if (eleve.devenir) return { type: eleve.devenir };
  const cible = mapping[eleve.classe_id];
  return cible ? { type: 'classe', classeId: cible } : { type: 'none' };
}

const memeChoix = (a, b) => a.type === b.type && (a.classeId ?? null) === (b.classeId ?? null);

/** Choix effectif de chaque élève pas encore repris : exception > base. */
export function choixEffectifs({ eleves, mapping, exceptions, dejaRepris }) {
  const deja = new Set(dejaRepris);
  const out = {};
  for (const e of eleves) {
    if (deja.has(e.id)) continue;
    out[e.id] = exceptions[e.id] ?? choixDeBase(e, mapping);
  }
  return out;
}

/** Nouvel objet d'exceptions ; l'exception disparaît si le choix redevient celui de la base. */
export function poserException(exceptions, eleve, choix, mapping) {
  const suivant = { ...exceptions };
  if (memeChoix(choix, choixDeBase(eleve, mapping))) delete suivant[eleve.id];
  else suivant[eleve.id] = choix;
  return suivant;
}

export function synthese(choix, dejaRepris = []) {
  const s = { classe: 0, transfert: 0, termine: 0, none: 0, dejaRepris: dejaRepris.length };
  for (const c of Object.values(choix)) s[c.type] += 1;
  return s;
}

/** Reprises à exécuter (une RPC par élève). */
export function operations(choix) {
  return Object.entries(choix)
    .filter(([, c]) => c.type === 'classe')
    .map(([sourceId, c]) => ({ sourceId, classeId: c.classeId }));
}

/** Écritures de `devenir` nécessaires (uniquement ce qui diffère de la base de données). */
export function marquages(choix, eleves) {
  const out = [];
  for (const e of eleves) {
    const c = choix[e.id];
    if (!c || c.type === 'classe') continue;
    const voulu = c.type === 'transfert' || c.type === 'termine' ? c.type : null;
    if ((e.devenir ?? null) !== voulu) out.push({ id: e.id, devenir: voulu });
  }
  return out;
}

/** Ce qui reste à confirmer dans une classe (AR, aménagements libres, AU). */
export function aConfirmerParClasse({ eleves, selectionsAR, libres, auClasse }) {
  const ids = new Set(eleves.map((e) => e.id));
  const compte = new Map();
  for (const ligne of [...selectionsAR, ...libres]) {
    if (ligne.a_confirmer && ids.has(ligne.eleve_id)) compte.set(ligne.eleve_id, (compte.get(ligne.eleve_id) ?? 0) + 1);
  }
  const parEleve = eleves.filter((e) => compte.has(e.id)).map((e) => ({ eleve: e, n: compte.get(e.id) }));
  const nAU = auClasse.filter((x) => x.a_confirmer).length;
  return { parEleve, nAU, total: parEleve.reduce((t, x) => t + x.n, 0) + nAU };
}

/** Année juste avant la cible (libellés '2026-2027' comparés lexicographiquement). */
export function anneeSourceParDefaut(annees, cibleId) {
  const cible = annees.find((a) => a.id === cibleId);
  if (!cible) return null;
  return annees
    .filter((a) => a.libelle < cible.libelle)
    .sort((a, b) => b.libelle.localeCompare(a.libelle))[0] ?? null;
}
```

- [ ] **Step 4 : Lancer les tests**

Run : `npx vitest run tests/domain/reprise.test.js`
Expected : PASS (tous les tests).

- [ ] **Step 5 : Commit**

```bash
git add src/domain/reprise.js tests/domain/reprise.test.js
git commit -m "feat(reprise): logique pure de reprise d'année (groupes, exceptions, synthèse)"
```

---

### Task 3 : Hooks de données

**Files:**
- Create: `src/hooks/useReprise.js`

- [ ] **Step 1 : Écrire le hook**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Données de l'assistant pour UNE implantation : classes/élèves de N, classes de N+1 (toutes implantations lisibles), élèves déjà repris. */
export function useReprise(ecoleId, srcAnneeId, cibleAnneeId) {
  return useQuery({
    queryKey: ['reprise', ecoleId, srcAnneeId, cibleAnneeId],
    enabled: !!ecoleId && !!srcAnneeId && !!cibleAnneeId && srcAnneeId !== cibleAnneeId,
    queryFn: async () => {
      const [src, cible] = await Promise.all([
        supabase.from('ar_classes').select('id, nom, niveau, ecole_id').eq('ecole_id', ecoleId).eq('annee_id', srcAnneeId).order('nom'),
        supabase.from('ar_classes').select('id, nom, niveau, ecole_id').eq('annee_id', cibleAnneeId).order('nom'),
      ]);
      if (src.error) throw src.error;
      if (cible.error) throw cible.error;

      const classeIds = src.data.map((c) => c.id);
      let eleves = [];
      if (classeIds.length) {
        const { data, error } = await supabase
          .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, devenir').in('classe_id', classeIds).order('prenom');
        if (error) throw error;
        eleves = data;
      }

      let dejaRepris = [];
      if (eleves.length) {
        const { data, error } = await supabase.rpc('ar_eleves_deja_repris', { p_ids: eleves.map((e) => e.id) });
        if (error) throw error;
        dejaRepris = data ?? [];
      }
      return { classesSource: src.data, classesCible: cible.data, eleves, dejaRepris };
    },
  });
}

/** File admin : élèves marqués « autre implantation » et pas encore repris (toutes implantations). */
export function useTransferts(srcAnneeId, cibleAnneeId, enabled) {
  return useQuery({
    queryKey: ['transferts', srcAnneeId, cibleAnneeId],
    enabled: !!enabled && !!srcAnneeId && !!cibleAnneeId,
    queryFn: async () => {
      const [el, cl] = await Promise.all([
        supabase.from('ar_eleves')
          .select('id, prenom, initiale_nom, ar_classes!inner(nom, ecole_id, annee_id)')
          .eq('devenir', 'transfert').eq('ar_classes.annee_id', srcAnneeId),
        supabase.from('ar_classes').select('id, nom, niveau, ecole_id').eq('annee_id', cibleAnneeId).order('nom'),
      ]);
      if (el.error) throw el.error;
      if (cl.error) throw cl.error;

      let eleves = el.data;
      if (eleves.length) {
        const { data, error } = await supabase.rpc('ar_eleves_deja_repris', { p_ids: eleves.map((e) => e.id) });
        if (error) throw error;
        const deja = new Set(data ?? []);
        eleves = eleves.filter((e) => !deja.has(e.id));
      }
      return { eleves, classesCible: cl.data };
    },
  });
}

export function useRepriseMutations(ecoleId, srcAnneeId, cibleAnneeId) {
  const qc = useQueryClient();
  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['reprise'] });
    qc.invalidateQueries({ queryKey: ['transferts'] });
    qc.invalidateQueries({ queryKey: ['grille'] });
  };

  const cloner = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ar_cloner_classes', {
        p_ecole: ecoleId, p_source: srcAnneeId, p_cible: cibleAnneeId,
      });
      if (error) throw error;
      return data; // nombre de classes créées
    },
    onSuccess: invalider,
  });

  const majNiveau = useMutation({
    mutationFn: async ({ classeId, niveau }) => {
      const { error } = await supabase.from('ar_classes').update({ niveau: niveau.trim() || null }).eq('id', classeId);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  /** Exécute les reprises une à une (chaque RPC est atomique) puis écrit les devenirs. Un élève déjà repris (23505) n'est pas une erreur. */
  const appliquer = useMutation({
    mutationFn: async ({ operations, marquages }) => {
      const echecs = [];
      let repris = 0;
      for (const op of operations) {
        const { error } = await supabase.rpc('ar_reprendre_eleve', { p_source: op.sourceId, p_classe_cible: op.classeId });
        if (!error) repris += 1;
        else if (error.code !== '23505') echecs.push({ sourceId: op.sourceId, message: error.message });
      }
      for (const m of marquages) {
        const { error } = await supabase.from('ar_eleves').update({ devenir: m.devenir }).eq('id', m.id);
        if (error) echecs.push({ sourceId: m.id, message: error.message });
      }
      return { repris, echecs };
    },
    onSuccess: invalider,
  });

  const reprendreUn = useMutation({
    mutationFn: async ({ sourceId, classeId }) => {
      const { error } = await supabase.rpc('ar_reprendre_eleve', { p_source: sourceId, p_classe_cible: classeId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: invalider,
  });

  return { cloner, majNiveau, appliquer, reprendreUn };
}
```

- [ ] **Step 2 : Vérifier que le module se charge (build)**

Run : `npx vite build`
Expected : build OK (le fichier n'est pas encore importé, donc ce contrôle sert surtout de garde avant les tâches suivantes ; le comportement est vérifié à la Task 8).

- [ ] **Step 3 : Commit**

```bash
git add src/hooks/useReprise.js
git commit -m "feat(reprise): hooks de lecture et mutations de l'assistant de reprise"
```

---

### Task 4 : Composants de l'assistant

**Files:**
- Create: `src/components/reprise/EtapeClasses.jsx`
- Create: `src/components/reprise/EtapeEleves.jsx`
- Create: `src/components/reprise/EtapeSynthese.jsx`
- Create: `src/components/reprise/FileTransferts.jsx`

Convention du projet : classes `plai-card`, `plai-btn`, `plai-input`, `plai-error`, `plai-empty` ; chaque champ a un label, un exemple et un texte d'aide sous le champ.

- [ ] **Step 1 : `EtapeClasses.jsx`**

```jsx
import { groupesSource } from '../../domain/reprise.js';

export default function EtapeClasses({ d, ecoleId, srcLibelle, cibleLibelle, mapping, setMapping, mut }) {
  const classesCible = d.classesCible.filter((c) => c.ecole_id === ecoleId);
  const groupes = groupesSource(d.classesSource, d.eleves);

  return (
    <section className="space-y-4">
      <div className="plai-card p-3 space-y-2">
        <h2 className="font-semibold">1. Classes de {cibleLibelle}</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Reprend les classes de {srcLibelle} : nom, niveau, référent(s) PLAI et aménagements universels (ces derniers sont marqués « à confirmer »).
          Les classes déjà créées ne sont pas modifiées : vous pouvez relancer sans risque après avoir ajouté une classe à la main.
        </p>
        <button className="plai-btn" disabled={mut.cloner.isPending || d.classesSource.length === 0} onClick={() => mut.cloner.mutate()}>
          {mut.cloner.isPending ? 'Création…' : classesCible.length === 0 ? `Reprendre les classes de ${srcLibelle}` : 'Compléter avec les classes manquantes'}
        </button>
        {d.classesSource.length === 0 && <p className="text-sm">Aucune classe en {srcLibelle} pour cette implantation.</p>}
        {mut.cloner.isSuccess && <p className="text-sm text-teal">{mut.cloner.data} classe(s) créée(s).</p>}
        {mut.cloner.isError && <p className="plai-error text-sm">Échec du clonage : {mut.cloner.error.message}</p>}

        {classesCible.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Niveau de chaque classe en {cibleLibelle}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {classesCible.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <label htmlFor={`niv-${c.id}`} className="w-20 shrink-0">{c.nom}</label>
                  <input id={`niv-${c.id}`} className="plai-input w-full" defaultValue={c.niveau ?? ''} placeholder="4e"
                    onBlur={(e) => { if (e.target.value.trim() !== (c.niveau ?? '')) mut.majNiveau.mutate({ classeId: c.id, niveau: e.target.value }); }} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-[color:var(--text3)]">
              Les niveaux repris de l'an dernier sont à mettre à jour (ex. « 3e » devient « 4e »). Ce niveau s'affiche dans la saisie et sur les fiches.
            </p>
            {mut.majNiveau.isError && <p className="plai-error text-sm">Enregistrement du niveau impossible, réessayez.</p>}
          </div>
        )}
      </div>

      <div className="plai-card p-3 space-y-2">
        <h2 className="font-semibold">2. Où va la majorité de chaque groupe ?</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Pour chaque classe de {srcLibelle}, choisissez la classe de {cibleLibelle} où va la majorité de ses élèves.
          Tous les élèves du groupe y seront proposés par défaut ; vous corrigerez les exceptions à l'étape suivante.
          Laissez vide un groupe qui n'a pas de destination principale (chaque élève sera alors à placer un par un).
        </p>
        {groupes.length === 0 ? (
          <p className="plai-empty">Aucun élève encodé en {srcLibelle} pour cette implantation.</p>
        ) : (
          <ul className="space-y-2">
            {groupes.map(({ classe, eleves }) => (
              <li key={classe.id} className="flex flex-wrap items-center gap-2">
                <label htmlFor={`map-${classe.id}`} className="w-56">
                  {classe.nom}{classe.niveau ? ` (${classe.niveau})` : ''} <span className="text-[color:var(--text3)]">— {eleves.length} élève(s)</span>
                </label>
                <span aria-hidden="true">→</span>
                <select id={`map-${classe.id}`} className="plai-input" value={mapping[classe.id] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [classe.id]: e.target.value })}>
                  <option value="">— pas de classe principale —</option>
                  {classesCible.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.niveau ? ` (${c.niveau})` : ''}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : `EtapeEleves.jsx`**

```jsx
import { useState } from 'react';
import { groupesSource, poserException, versChoix, versValeur } from '../../domain/reprise.js';

const libelleClasse = (c) => `${c.nom}${c.niveau ? ` (${c.niveau})` : ''}`;

export default function EtapeEleves({ d, ecoleId, ecoles, isAdmin, mapping, exceptions, setExceptions, choix }) {
  const [filtre, setFiltre] = useState('');
  const groupes = groupesSource(d.classesSource, d.eleves);
  const repris = new Set(d.dejaRepris);
  const q = filtre.trim().toLowerCase();

  const propres = d.classesCible.filter((c) => c.ecole_id === ecoleId);
  // Seul l'admin peut placer directement un élève dans une autre implantation (RLS).
  const autres = isAdmin
    ? ecoles.filter((e) => e.id !== ecoleId)
        .map((e) => ({ ecole: e, classes: d.classesCible.filter((c) => c.ecole_id === e.id) }))
        .filter((x) => x.classes.length > 0)
    : [];

  return (
    <section className="space-y-3">
      <div className="plai-card p-3 space-y-1">
        <label htmlFor="filtre-eleve" className="font-semibold block">3. Corriger les exceptions</label>
        <input id="filtre-eleve" type="search" className="plai-input w-full max-w-sm" placeholder="Chercher un prénom (ex : Amir)"
          value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <p className="text-sm text-[color:var(--text3)]">
          Chaque élève est déjà placé dans la classe principale de son groupe. Changez uniquement ceux qui vont ailleurs : une autre classe de cette implantation,
          « Autre implantation » (l'administrateur l'affectera), ou « Fin de parcours ». Un élève « non traité » n'est pas repris pour l'instant.
          Un élève absent de ces listes (nouvel élève) s'ajoute depuis la Saisie.
        </p>
      </div>

      {groupes.map(({ classe, eleves }) => {
        const visibles = eleves.filter((e) => !q || `${e.prenom} ${e.initiale_nom}`.toLowerCase().includes(q));
        if (visibles.length === 0) return null;
        return (
          <details key={classe.id} open className="plai-card p-3">
            <summary className="font-medium cursor-pointer">
              {libelleClasse(classe)} — {eleves.length} élève(s)
            </summary>
            <ul className="mt-2 divide-y divide-[color:var(--border)]">
              {visibles.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-1">
                  <span className="w-48">{e.prenom} {e.initiale_nom}</span>
                  {repris.has(e.id) ? (
                    <span className="text-sm text-[color:var(--text3)]">déjà repris</span>
                  ) : (
                    <>
                      <select className="plai-input" aria-label={`Destination de ${e.prenom} ${e.initiale_nom}`}
                        value={versValeur(choix[e.id])}
                        onChange={(ev) => setExceptions(poserException(exceptions, e, versChoix(ev.target.value), mapping))}>
                        <option value="none">— non traité —</option>
                        <optgroup label="Cette implantation">
                          {propres.map((c) => <option key={c.id} value={`classe:${c.id}`}>{libelleClasse(c)}</option>)}
                        </optgroup>
                        {autres.map(({ ecole, classes }) => (
                          <optgroup key={ecole.id} label={ecole.nom}>
                            {classes.map((c) => <option key={c.id} value={`classe:${c.id}`}>{libelleClasse(c)}</option>)}
                          </optgroup>
                        ))}
                        <option value="transfert">Autre implantation (à réaffecter par l'administrateur)</option>
                        <option value="termine">Fin de parcours / quitte le réseau</option>
                      </select>
                      {exceptions[e.id] && <span className="text-xs text-orange font-medium">modifié</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 3 : `EtapeSynthese.jsx`**

```jsx
function messageErreur(m) {
  if (/row-level security|permission denied/i.test(m)) {
    return "droit insuffisant pour écrire dans cette implantation (demandez à l'administrateur)";
  }
  return m;
}

export default function EtapeSynthese({ s, onAppliquer, enCours, rapport, nomEleve }) {
  return (
    <section className="plai-card p-3 space-y-3">
      <h2 className="font-semibold">4. Synthèse</h2>
      <ul className="text-sm space-y-1">
        <li><strong>{s.classe}</strong> élève(s) seront repris dans une classe (AR et aménagements libres copiés « à confirmer »).</li>
        <li><strong>{s.transfert}</strong> changent d'implantation (file de l'administrateur).</li>
        <li><strong>{s.termine}</strong> en fin de parcours (rien à faire).</li>
        <li><strong>{s.none}</strong> non traité(s){s.none > 0 ? ' : ils ne seront pas repris maintenant, mais resteront dans cette liste pour plus tard.' : '.'}</li>
        {s.dejaRepris > 0 && <li>{s.dejaRepris} élève(s) déjà repris précédemment.</li>}
      </ul>
      <button className="plai-btn" disabled={enCours || (s.classe === 0 && s.transfert === 0 && s.termine === 0)} onClick={onAppliquer}>
        {enCours ? 'Reprise en cours…' : `Appliquer (${s.classe} reprise(s))`}
      </button>
      <p className="text-xs text-[color:var(--text3)]">
        Rien n'est supprimé de l'année précédente : la reprise crée de nouvelles fiches et laisse les anciennes intactes. Vous pouvez relancer l'assistant : un élève déjà repris ne l'est jamais deux fois.
      </p>
      {rapport && (
        <div className={rapport.echecs.length ? 'plai-error' : 'plai-success'}>
          <p>{rapport.repris} élève(s) repris.</p>
          {rapport.echecs.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {rapport.echecs.map((x) => <li key={x.sourceId}>{nomEleve(x.sourceId)} : {messageErreur(x.message)}</li>)}
            </ul>
          )}
          {rapport.echecs.length === 0 && <p className="text-sm">Ouvrez la Saisie de l'année cible : le bandeau orange indique les AR à confirmer.</p>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4 : `FileTransferts.jsx`**

```jsx
import { useState } from 'react';
import { useTransferts } from '../../hooks/useReprise.js';

export default function FileTransferts({ srcId, cibleId, ecoles, mut }) {
  const { data, isLoading, error } = useTransferts(srcId, cibleId, true);
  const [choisi, setChoisi] = useState({});
  const nomEcole = (id) => ecoles.find((e) => e.id === id)?.nom ?? '—';

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <p className="plai-error">Erreur : {error.message}</p>;

  return (
    <section className="plai-card p-3 space-y-2">
      <h2 className="font-semibold">Élèves à réaffecter (changement d'implantation)</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Élèves marqués « Autre implantation » par un référent. Choisissez l'implantation et la classe d'arrivée : l'élève est repris avec ses AR « à confirmer ».
        Si la classe attendue n'apparaît pas, ouvrez d'abord l'assistant de cette implantation d'arrivée pour créer ses classes.
      </p>
      {data.eleves.length === 0 ? (
        <p className="plai-empty">Aucun élève en attente.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]">
          {data.eleves.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-1">
              <span className="w-48">{e.prenom} {e.initiale_nom}</span>
              <span className="text-sm text-[color:var(--text3)] w-56">de {e.ar_classes.nom} — {nomEcole(e.ar_classes.ecole_id)}</span>
              <select className="plai-input" aria-label={`Classe d'arrivée de ${e.prenom} ${e.initiale_nom}`}
                value={choisi[e.id] ?? ''} onChange={(ev) => setChoisi({ ...choisi, [e.id]: ev.target.value })}>
                <option value="">— choisir —</option>
                {ecoles.map((ec) => {
                  const cl = data.classesCible.filter((c) => c.ecole_id === ec.id);
                  return cl.length === 0 ? null : (
                    <optgroup key={ec.id} label={ec.nom}>
                      {cl.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.niveau ? ` (${c.niveau})` : ''}</option>)}
                    </optgroup>
                  );
                })}
              </select>
              <button className="plai-btn" disabled={!choisi[e.id] || mut.reprendreUn.isPending}
                onClick={() => mut.reprendreUn.mutate({ sourceId: e.id, classeId: choisi[e.id] })}>
                Affecter
              </button>
            </li>
          ))}
        </ul>
      )}
      {mut.reprendreUn.isError && <p className="plai-error text-sm">Affectation impossible : {mut.reprendreUn.error.message}</p>}
    </section>
  );
}
```

- [ ] **Step 5 : Build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 6 : Commit**

```bash
git add src/components/reprise
git commit -m "feat(reprise): composants de l'assistant (classes, exceptions, synthèse, file admin)"
```

---

### Task 5 : Page, route et navigation

**Files:**
- Create: `src/pages/Reprise.jsx`
- Modify: `src/App.jsx` (imports + routes)
- Modify: `src/components/Nav.jsx:23-31`
- Modify: `src/pages/Administration.jsx` (imports + `SectionAnnees`)

- [ ] **Step 1 : Écrire `src/pages/Reprise.jsx`**

```jsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAnnees, useEcoles } from '../hooks/useEcoleGrid.js';
import { useReprise, useRepriseMutations } from '../hooks/useReprise.js';
import { useRole } from '../lib/auth.jsx';
import { anneeSourceParDefaut, choixEffectifs, synthese, operations, marquages } from '../domain/reprise.js';
import EtapeClasses from '../components/reprise/EtapeClasses.jsx';
import EtapeEleves from '../components/reprise/EtapeEleves.jsx';
import EtapeSynthese from '../components/reprise/EtapeSynthese.jsx';
import FileTransferts from '../components/reprise/FileTransferts.jsx';

export default function Reprise() {
  const { isAdmin } = useRole();
  const { data: annees = [] } = useAnnees();
  const { data: ecoles = [] } = useEcoles();
  const [ecoleId, setEcoleId] = useState(null);
  const [cibleId, setCibleId] = useState(null);
  const [srcId, setSrcId] = useState(null);
  const [etape, setEtape] = useState(1);
  const [mapping, setMapping] = useState({});
  const [exceptions, setExceptions] = useState({});
  const [rapport, setRapport] = useState(null);

  // Défauts : cible = année active, source = année juste avant, école unique verrouillée.
  useEffect(() => {
    if (cibleId) return;
    const active = annees.find((a) => a.active);
    if (active) setCibleId(active.id);
  }, [annees, cibleId]);
  useEffect(() => {
    if (cibleId && !srcId) setSrcId(anneeSourceParDefaut(annees, cibleId)?.id ?? null);
  }, [annees, cibleId, srcId]);
  useEffect(() => {
    if (!ecoleId && ecoles.length === 1) setEcoleId(ecoles[0].id);
  }, [ecoles, ecoleId]);

  const reinit = () => { setMapping({}); setExceptions({}); setRapport(null); setEtape(1); };
  const libelle = (id) => annees.find((a) => a.id === id)?.libelle ?? '';

  const { data: d, isLoading, error } = useReprise(ecoleId, srcId, cibleId);
  const mut = useRepriseMutations(ecoleId, srcId, cibleId);

  const choix = useMemo(
    () => choixEffectifs({ eleves: d?.eleves ?? [], mapping, exceptions, dejaRepris: d?.dejaRepris ?? [] }),
    [d, mapping, exceptions],
  );
  const s = synthese(choix, d?.dejaRepris);
  const nomEleve = (id) => { const e = d?.eleves.find((x) => x.id === id); return e ? `${e.prenom} ${e.initiale_nom}` : id; };
  const classesCibleEcole = (d?.classesCible ?? []).filter((c) => c.ecole_id === ecoleId);

  const appliquer = async () => {
    const r = await mut.appliquer.mutateAsync({ operations: operations(choix), marquages: marquages(choix, d.eleves) });
    setRapport(r);
    setExceptions({});
  };

  const contexteOk = ecoleId && srcId && cibleId && srcId !== cibleId;

  return (
    <div className="plai-section space-y-4 px-4">
      <h1 className="text-xl font-semibold">Reprise des élèves d'une année à l'autre</h1>
      <p className="text-sm text-[color:var(--text3)]">
        Les fiches de l'année précédente restent intactes. Les élèves repris arrivent avec leurs aménagements marqués « à confirmer » :
        c'est à vous de les revoir (progrès de l'élève, niveau, changement de filière) avant de les considérer comme acquis.
      </p>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="rep-ecole" className="block font-medium">Implantation</label>
          {!isAdmin && ecoles.length === 1 ? (
            <p className="plai-input inline-block bg-[color:var(--bg)]">{ecoles[0].nom}{ecoles[0].implantation ? ` (${ecoles[0].implantation})` : ''}</p>
          ) : (
            <select id="rep-ecole" className="plai-input" value={ecoleId ?? ''} onChange={(e) => { setEcoleId(e.target.value || null); reinit(); }}>
              <option value="">— choisir —</option>
              {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.implantation ? ` (${e.implantation})` : ''}</option>)}
            </select>
          )}
          <p className="text-xs text-[color:var(--text3)]">Une implantation à la fois.</p>
        </div>
        <div>
          <label htmlFor="rep-src" className="block font-medium">Reprendre depuis</label>
          <select id="rep-src" className="plai-input" value={srcId ?? ''} onChange={(e) => { setSrcId(e.target.value || null); reinit(); }}>
            <option value="">— choisir —</option>
            {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
          <p className="text-xs text-[color:var(--text3)]">L'année scolaire qui vient de se terminer.</p>
        </div>
        <div>
          <label htmlFor="rep-cible" className="block font-medium">Vers</label>
          <select id="rep-cible" className="plai-input" value={cibleId ?? ''} onChange={(e) => { setCibleId(e.target.value || null); reinit(); }}>
            <option value="">— choisir —</option>
            {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
          <p className="text-xs text-[color:var(--text3)]">La nouvelle année (créez-la d'abord dans Administration si elle manque).</p>
        </div>
      </div>

      {srcId && cibleId && srcId === cibleId && <p className="plai-error">L'année de départ et d'arrivée doivent être différentes.</p>}
      {!contexteOk ? (
        <p className="plai-empty">Choisissez l'implantation et les deux années pour commencer.</p>
      ) : isLoading || !d ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="plai-error">Erreur de chargement : {error.message}</p>
      ) : (
        <>
          <nav aria-label="Étapes" className="flex gap-2 text-sm">
            {['Classes', 'Exceptions', 'Synthèse'].map((t, i) => (
              <button key={t} className={`plai-btn ${etape === i + 1 ? '' : 'opacity-60'}`} aria-current={etape === i + 1 ? 'step' : undefined}
                disabled={i > 0 && classesCibleEcole.length === 0} onClick={() => setEtape(i + 1)}>
                {i + 1}. {t}
              </button>
            ))}
          </nav>

          {etape === 1 && (
            <EtapeClasses d={d} ecoleId={ecoleId} srcLibelle={libelle(srcId)} cibleLibelle={libelle(cibleId)}
              mapping={mapping} setMapping={setMapping} mut={mut} />
          )}
          {etape === 2 && (
            <EtapeEleves d={d} ecoleId={ecoleId} ecoles={ecoles} isAdmin={isAdmin}
              mapping={mapping} exceptions={exceptions} setExceptions={setExceptions} choix={choix} />
          )}
          {etape === 3 && (
            <EtapeSynthese s={s} onAppliquer={appliquer} enCours={mut.appliquer.isPending} rapport={rapport} nomEleve={nomEleve} />
          )}

          <div className="flex justify-between">
            <button className="plai-btn" disabled={etape === 1} onClick={() => setEtape(etape - 1)}>← Précédent</button>
            {etape < 3 && <button className="plai-btn" disabled={classesCibleEcole.length === 0} onClick={() => setEtape(etape + 1)}>Suivant →</button>}
          </div>
          {classesCibleEcole.length === 0 && etape === 1 && (
            <p className="text-sm text-[color:var(--text3)]">Créez d'abord les classes de {libelle(cibleId)} pour passer à l'étape suivante.</p>
          )}
        </>
      )}

      {isAdmin && srcId && cibleId && srcId !== cibleId && (
        <FileTransferts srcId={srcId} cibleId={cibleId} ecoles={ecoles} mut={mut} />
      )}

      <p className="text-sm">Nouvel élève, absent de l'année précédente ? <Link to="/saisie" className="underline text-teal">Ajoutez-le depuis la Saisie</Link>.</p>
    </div>
  );
}
```

- [ ] **Step 2 : Ajouter la route dans `src/App.jsx`**

Après la ligne `import Administration from './pages/Administration.jsx';` ajouter :

```jsx
import Reprise from './pages/Reprise.jsx';
```

Après la route `/administration` (ligne `<Route path="/administration" ...`), ajouter :

```jsx
      <Route path="/reprise" element={<RequireAuth><Shell><RequireRole roles={['admin', 'referent_plai', 'direction']}><Reprise /></RequireRole></Shell></RequireAuth>} />
```

- [ ] **Step 3 : Lien dans `src/components/Nav.jsx`**

Après la ligne `{editeurEcole && <NavLink to="/saisie" className={lien}>Saisie</NavLink>}` ajouter :

```jsx
        {editeurEcole && role !== 'agent_plai' && <NavLink to="/reprise" className={lien}>Reprise d'année</NavLink>}
```

- [ ] **Step 4 : Lien dans `SectionAnnees` (`src/pages/Administration.jsx`)**

Ajouter l'import en haut, après `import { useState, useEffect } from 'react';` :

```jsx
import { Link } from 'react-router-dom';
```

Dans `SectionAnnees`, remplacer le paragraphe `L'année « active » est celle présélectionnée…` : ajouter à la suite (dans le même `<p>`, avant `</p>`) :

```jsx
 Une fois la nouvelle année créée, <Link to="/reprise" className="underline text-teal">reprenez les élèves de l'année précédente</Link>.
```

- [ ] **Step 5 : Build**

Run : `npx vite build`
Expected : build OK.

- [ ] **Step 6 : Commit**

```bash
git add src/pages/Reprise.jsx src/App.jsx src/components/Nav.jsx src/pages/Administration.jsx
git commit -m "feat(reprise): page assistant, route /reprise et liens de navigation"
```

---

### Task 6 : Confirmer les AR/AU repris dans la saisie

**Files:**
- Modify: `src/hooks/useEcoleGrid.js` (3 sélections)
- Modify: `src/hooks/useGridMutations.js` (2 mutations + return)
- Create: `src/components/saisie/BandeauAConfirmer.jsx`
- Modify: `src/components/saisie/ChapitreAR.jsx`
- Modify: `src/components/saisie/BandeauAU.jsx`
- Modify: `src/pages/SaisieEcole.jsx`

- [ ] **Step 1 : `useEcoleGrid.js` — lire `a_confirmer`**

Trois remplacements exacts :

`.select('classe_id, amenagement_id, cree_le')` → `.select('classe_id, amenagement_id, cree_le, a_confirmer')`

`.select('eleve_id, amenagement_id, cree_le')` → `.select('eleve_id, amenagement_id, cree_le, a_confirmer')`

`.select('id, eleve_id, chapitre_id, texte')` → `.select('id, eleve_id, chapitre_id, texte, a_confirmer')`

(Attention : la migration de la Task 1 doit déjà être appliquée.)

- [ ] **Step 2 : `useGridMutations.js` — mutations de confirmation**

Juste avant la ligne `return { toggleAR, ...` ajouter :

```js
  /** Confirme (retire le marqueur « à confirmer ») les AR et aménagements libres d'un élève. */
  const confirmerEleve = useMutation({
    mutationFn: async ({ eleveId }) => {
      const a = await supabase.from('ar_selections').update({ a_confirmer: false }).eq('eleve_id', eleveId);
      if (a.error) throw a.error;
      const b = await supabase.from('ar_amenagements_libres').update({ a_confirmer: false }).eq('eleve_id', eleveId);
      if (b.error) throw b.error;
    },
    onSuccess: invalider,
  });

  /** Confirme tout ce qui a été repris dans une classe : AR/libres de ses élèves + ses AU. */
  const confirmerClasse = useMutation({
    mutationFn: async ({ classeId, eleveIds }) => {
      if (eleveIds.length) {
        const a = await supabase.from('ar_selections').update({ a_confirmer: false }).in('eleve_id', eleveIds);
        if (a.error) throw a.error;
        const b = await supabase.from('ar_amenagements_libres').update({ a_confirmer: false }).in('eleve_id', eleveIds);
        if (b.error) throw b.error;
      }
      const c = await supabase.from('ar_amenagements_classe').update({ a_confirmer: false }).eq('classe_id', classeId);
      if (c.error) throw c.error;
    },
    onSuccess: invalider,
  });
```

et remplacer la ligne `return { toggleAR, ..., removeLibre };` par :

```js
  return { toggleAR, toggleAU, upsertEleve, deleteEleve, ensureClasse, deleteClasse, majReferentPlaiClasse, majCommentaireClasse, addLibre, removeLibre, confirmerEleve, confirmerClasse };
```

- [ ] **Step 3 : Créer `BandeauAConfirmer.jsx`**

```jsx
import { aConfirmerParClasse } from '../../domain/reprise.js';

/** Bandeau de la saisie : ce qui a été repris de l'année précédente et n'a pas encore été relu. */
export default function BandeauAConfirmer({ eleves, grid, classeId, onConfirmerEleve, onConfirmerClasse, enCours }) {
  const r = aConfirmerParClasse({
    eleves,
    selectionsAR: grid.selectionsAR,
    libres: grid.libres,
    auClasse: grid.auClasse.filter((x) => x.classe_id === classeId),
  });
  if (r.total === 0) return null;

  return (
    <section className="p-3 text-sm space-y-2 rounded" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p><strong>{r.total} aménagement(s) repris de l'année précédente, à confirmer.</strong> Relisez-les : le niveau, la filière ou les progrès de l'élève ont pu changer.</p>
        <button className="plai-btn" disabled={enCours} onClick={onConfirmerClasse}>Tout confirmer</button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {r.parEleve.map(({ eleve, n }) => (
          <li key={eleve.id}>
            <button className="plai-input !w-auto !py-1" disabled={enCours} onClick={() => onConfirmerEleve(eleve.id)}
              title="Confirmer les aménagements repris de cet élève">
              Confirmer {eleve.prenom} {eleve.initiale_nom} ({n})
            </button>
          </li>
        ))}
        {r.nAU > 0 && <li className="self-center">{r.nAU} AU de la classe à confirmer (voir ci-dessus)</li>}
      </ul>
      <p className="text-xs">Décochez un aménagement qui ne convient plus ; cochez-en un nouveau : il est enregistré comme confirmé.</p>
    </section>
  );
}
```

- [ ] **Step 4 : `ChapitreAR.jsx` — repérer les cases à confirmer**

Après la ligne `const estCoche = (eleveId, amId) => ...` ajouter :

```jsx
  const estAConfirmer = (eleveId, amId) => selectionsAR.some((s) => s.eleve_id === eleveId && s.amenagement_id === amId && s.a_confirmer);
```

Remplacer la ligne `<td key={e.id} className={`cell-eleve text-center border-l border-[color:var(--border)] ${e.id === eleveSurvole ? 'bg-[color:var(--teal-bg)]' : ''}`}` par :

```jsx
            <td key={e.id} className={`cell-eleve text-center border-l border-[color:var(--border)] ${e.id === eleveSurvole ? 'bg-[color:var(--teal-bg)]' : estAConfirmer(e.id, a.id) ? 'bg-orange/10' : ''}`}
              title={estAConfirmer(e.id, a.id) ? "Repris de l'année précédente : à confirmer" : undefined}
```

(la ligne suivante `data-eleve=...` reste inchangée) et remplacer `aria-label={`${a.libelle} — ${e.prenom} ${e.initiale_nom}`}` par :

```jsx
                aria-label={`${a.libelle} — ${e.prenom} ${e.initiale_nom}${estAConfirmer(e.id, a.id) ? ' — à confirmer' : ''}`}
```

Dans la liste des aménagements libres, après `<span>{el ? `${el.prenom} ${el.initiale_nom}` : '—'} : {l.texte}</span>` ajouter :

```jsx
                  {l.a_confirmer && <span className="text-xs text-orange font-medium">à confirmer</span>}
```

- [ ] **Step 5 : `BandeauAU.jsx` — badge**

Dans le `<span>` de chaque AU, après `{a.libelle}` ajouter :

```jsx
                {auClasse.find((x) => x.amenagement_id === a.id)?.a_confirmer && <span className="text-xs text-orange font-medium"> · à confirmer</span>}
```

- [ ] **Step 6 : `SaisieEcole.jsx` — brancher le bandeau**

Ajouter l'import après `import AjoutEleve from ...` :

```jsx
import BandeauAConfirmer from '../components/saisie/BandeauAConfirmer.jsx';
```

Après le bloc `<BandeauAU ... peutRetirer={peutEditerStructure} />` (repère : la ligne `peutRetirer={peutEditerStructure} />`), ajouter :

```jsx
          <BandeauAConfirmer eleves={eleves} grid={grid} classeId={classeId}
            enCours={mut.confirmerEleve.isPending || mut.confirmerClasse.isPending}
            onConfirmerEleve={(eleveId) => mut.confirmerEleve.mutate({ eleveId })}
            onConfirmerClasse={() => mut.confirmerClasse.mutate({ classeId, eleveIds: eleves.map((e) => e.id) })} />
          {(mut.confirmerEleve.isError || mut.confirmerClasse.isError) && <p className="plai-error text-sm">Confirmation impossible, réessayez.</p>}
```

- [ ] **Step 7 : Tests + build**

Run : `npm test && npx vite build`
Expected : tous les tests PASS ; build OK.

- [ ] **Step 8 : Commit**

```bash
git add src/hooks/useEcoleGrid.js src/hooks/useGridMutations.js src/components/saisie src/pages/SaisieEcole.jsx
git commit -m "feat(reprise): repérer et confirmer les AR/AU repris dans la saisie"
```

---

### Task 7 : README

**Files:**
- Modify: `README.md:59`

- [ ] **Step 1 : Mettre à jour la ligne « À venir (Plan 2) »**

Remplacer `clôture d'année + report des élèves montants.` par `clôture d'année (lecture seule de l'année N).` et ajouter juste dessous :

```markdown
**Reprise d'année** : `/reprise` (admin, référent PLAI, direction) reprend les élèves de l'année N vers N+1 (classes clonées, groupes → classes, exceptions par élève, changement d'implantation via l'admin). AR/AU repris = « à confirmer » dans la saisie.
```

- [ ] **Step 2 : Commit**

```bash
git add README.md
git commit -m "docs: reprise d'année dans le README"
```

---

### Task 8 : Vérification bout en bout (navigateur)

Pas de fonction `/api/*` ici : `npm run dev` suffit. Utiliser l'« École test » (données de test uniquement, jamais des données réelles).

- [ ] **Step 1 : Préparer les données de test**

Dans Supabase (SQL Editor), sur l'école de test : une année `2026-2027` (active) avec 2 classes (`3A`, `3B`), 4 élèves fictifs (codes/prénoms inventés), quelques AR cochés, un aménagement libre, un AU sur `3A`. Créer l'année `2027-2028` via Administration (non active ou active, peu importe).

- [ ] **Step 2 : Lancer l'app**

Run : `npm run dev` (via `preview_start`) puis se connecter en admin.

- [ ] **Step 3 : Parcours à vérifier (cocher chaque point)**

1. `/reprise` : sélecteurs par défaut = année active (cible) et année précédente (source) ; sélection de « École test ».
2. Étape 1 : « Reprendre les classes de 2026-2027 » crée `3A`, `3B` ; relancer → « 0 classe(s) créée(s) » ; l'AU de `3A` est présent en `2027-2028` avec « à confirmer » (vérifier dans Saisie).
3. Modifier le niveau d'une classe : persiste après rechargement.
4. Mapping `3A → 3A`, `3B → 3B`. Étape 2 : tous les élèves pré-placés ; changer un élève de groupe → mention « modifié » ; le remettre → la mention disparaît.
5. Marquer un élève « Autre implantation », un autre « Fin de parcours », un « non traité ». Étape 3 : les compteurs correspondent.
6. Appliquer : rapport « N élève(s) repris » sans échec. Relancer l'assistant : les élèves repris affichent « déjà repris » et n'ont plus de menu ; les autres restent.
7. Saisie 2027-2028 : les élèves repris sont là, sans commentaire ; cases AR orangées (« à confirmer » dans l'aria-label) ; le bandeau orange compte juste ; « Confirmer <élève> » retire le marquage de cet élève seulement ; « Tout confirmer » retire le reste, AU compris ; décocher puis recocher un AR le crée confirmé.
8. Admin : la file « Élèves à réaffecter » liste l'élève « Autre implantation » ; l'affecter à une classe d'une autre implantation ayant des classes en 2027-2028 ; il disparaît de la file ; le double-clic sur « Affecter » ne crée pas de doublon.
9. Compte référent (non admin) : `/reprise` accessible, pas de file admin, pas d'optgroup d'autres implantations ; un compte `agent_plai` est refusé par la route.
10. Les fiches de l'année source sont inchangées (comparer une fiche classe 2026-2027 avant/après).

- [ ] **Step 4 : Console et réseau**

`read_console_messages` (aucune erreur) et `read_network_requests` : les 3 RPC répondent 200/204 ; aucune requête `ar_selections`/`ar_amenagements_*` en 400 (colonne `a_confirmer` bien présente).

- [ ] **Step 5 : Captures** — écrans étapes 1, 2, 3 et bandeau « à confirmer » de la saisie, à joindre au compte rendu à JF.

- [ ] **Step 6 : Suite complète + build**

Run : `npm test && npx vite build`
Expected : PASS + build OK.

---

### Task 9 : Revue finale et remise

- [ ] **Step 1 : Revue globale du diff**

Dispatcher `superpowers:requesting-code-review` sur `git diff origin/main...HEAD` (revue globale, pas seulement par tâche). Points d'attention : RLS des 3 fonctions, absence de fuite via `ar_eleves_deja_repris`, cohérence des noms (`a_confirmer`, `devenir`, `classesCible`, `dejaRepris`), aucun `console.log`.

- [ ] **Step 2 : Décision de livraison avec JF**

Ne pas pousser sans accord. Rappeler l'ordre : migration appliquée (Task 1 Step 3) → push `feature/reprise-annee` → PR/merge sur `main` (Vercel redéploie). Suite de mise à jour à proposer : vignette AménagActif dans `portail-plai/src/data/apps.ts` (repo séparé), aucune référence RISS à vérifier.

---

## Auto-revue (couverture par rapport à la demande)

| Exigence | Où |
|---|---|
| Ne pas tout réencoder | Tasks 1-2, RPC `ar_reprendre_eleve` |
| Cohortes qui changent, élèves de provenances différentes | Étape 2 (destination libre par élève), Task 4 Step 2 |
| Lettres de classes non constantes | Correspondance de groupes explicite, aucune déduction par lettre (décision 1) |
| Implantation par défaut = même, changement géré par l'admin | Menu « cette implantation », option « Autre implantation », `FileTransferts`, optgroups admin |
| AR/AU à confirmer | Colonnes `a_confirmer`, `BandeauAConfirmer`, marquage des cases/AU |
| Fluide, facile | 3 étapes, pré-remplissage par groupe, exceptions seulement, un seul clic pour cloner |
| Même logique pour un élève non référencé | Saisie existante (`AjoutEleve`) ; lien sur la page (décision 9) |
| Multi-implantations | RLS conservée, RPC `security invoker` ; `ar_eleves_deja_repris` definer (ids seulement) |
| Guidage contextuel des champs | Labels, placeholders, textes d'aide sous chaque champ |
| Accessibilité | Labels associés, `aria-label`, statut « à confirmer » aussi textuel (pas seulement par la couleur) |

Points d'incertitude : (1) les noms exacts des colonnes de `ar_classes` (`referent_plai_nom`) sont déduits de `useEcoleGrid`, à confirmer à l'exécution de la migration ; (2) l'embed PostgREST `ar_classes!inner(...)` de `useTransferts` suppose la FK `ar_eleves.classe_id → ar_classes` (présente dans le schéma) ; (3) le comportement de RLS sur les RPC `security invoker` est vérifié à la Task 8 (points 6, 8, 9), pas par test automatisé (pas d'infrastructure de test SQL dans le repo).
