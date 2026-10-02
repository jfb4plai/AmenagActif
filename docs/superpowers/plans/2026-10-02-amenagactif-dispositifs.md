# AménagActif — Dispositifs (AR ou AU selon la classe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Travailler dans un worktree dédié (superpowers:using-git-worktrees), branche issue de `main`.

**Goal:** Ajouter des groupes d'aménagements « dispositifs » dont les items sont des AR par élève par défaut et deviennent des AU de classe quand on coche la case du dispositif pour une classe.

**Architecture:** Le type stocké des items reste `AR`. Une table `ar_classe_dispositifs` porte le mode par (classe, dispositif). Un module de domaine pur `src/domain/dispositifs.js` calcule le type effectif ; les projections (fiche classe, fiche élève, fusion, snapshot, profils DiffActif) l'appellent, donc toutes lisent la même vérité. Les cochages restent dans `ar_selections` (AR) et `ar_amenagements_classe` (AU), sans migration de données.

**Tech Stack:** React 18 + Vite 5 + Tailwind v3, Supabase (tables `ar_`), Vitest, TanStack Query.

Spec : `docs/superpowers/specs/2026-10-02-amenagactif-dispositifs-design.md`.

**Écarts assumés par rapport à la spec (à valider par JF) :**
1. Fiche élève : la spec disait « comme les AU actuels », or la fiche élève n'affichait aucun AU de classe. Décision de JF (2026-10-02) : la fiche élève affiche désormais TOUS les AU de la classe (bloc « AU applicable(s) à toute la classe », comme la fiche classe, avec la surbrillance de « Mise en page ») puis les blocs des dispositifs en mode AU.
2. Administration : option (a) choisie par JF. La case « dispositif » est posée à la création d'un chapitre (et par le seed du premier dispositif), pas modifiable après coup (évite chapitres mixtes AU/AR et cochages orphelins).
3. Blocage de bascule : appliqué côté interface uniquement (les projections ignorent de toute façon une ligne stockée dans le mauvais mode). Pas de déclencheur SQL.

**Ordre de mise en production obligatoire :** la migration doit être exécutée par JF AVANT de pousser le code. Le chargeur sélectionne `ar_chapitres.est_dispositif` et lit `ar_classe_dispositifs` : sans migration, toutes les fiches lèvent une erreur.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261002_amenagactif_dispositifs.sql` (créer) | colonne, table, RLS, grants, seed du premier dispositif |
| `src/domain/dispositifs.js` (créer) | logique pure : mode, type effectif, blocs AU, blocage de bascule, message de confirmation |
| `src/domain/chargeurFiche.js` (modifier) | colonnes chapitres + chargement des modes |
| `src/domain/projections/ficheClasse.js`, `fusionClasses.js`, `ficheEleve.js` (modifier) | blocs dispositifs, sélections du mauvais mode ignorées |
| `src/domain/projections/snapshot.js`, `profilDiffActif.js`, `profilClasse.js` (modifier) | types effectifs |
| `src/domain/types.js` (modifier) | JSDoc |
| `src/components/fiche/FicheClasseView.jsx`, `FicheEleveView.jsx` (modifier) | rendu |
| `src/hooks/useEcoleGrid.js`, `useGridMutations.js`, `useCatalogue.js`, `useFicheEleve.js`, `useAdmin.js` (modifier) | données et mutation de bascule |
| `src/components/saisie/EnTeteDispositif.jsx`, `CarteDispositif.jsx`, `RecapDispositifs.jsx` (créer) | saisie |
| `src/components/saisie/ChapitreAR.jsx`, `BandeauAU.jsx`, `src/pages/SaisieEcole.jsx` (modifier) | câblage |
| `src/pages/Administration.jsx`, `CatalogueAmenagements.jsx`, `api/catalogue.js` (modifier) | admin + catalogue public |
| `tests/domain/dispositifs.test.js`, `dispositifsFiches.test.js`, `dispositifsProfils.test.js` (créer) ; `tests/domain/chargeurFiche.test.js` (modifier) | tests |

Commande de test : `npx vitest run` (cible un fichier : `npx vitest run tests/domain/dispositifs.test.js`).

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20261002_amenagactif_dispositifs.sql`

- [ ] **Step 1: Écrire la migration**

```sql
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
-- Garde hors de l'agrégat : un SELECT agrégé sans GROUP BY renvoie toujours une ligne, même filtré.
insert into ar_chapitres (ordre, titre, est_dispositif)
select (select coalesce(max(ordre), 0) + 1 from ar_chapitres), 'Dispositif de régulation des comportements', true
where not exists (select 1 from ar_chapitres where titre = 'Dispositif de régulation des comportements');

commit;

-- Vérification (attendu : 1 ligne, est_dispositif = true) :
--   select ordre, titre, est_dispositif from ar_chapitres where est_dispositif;
```

- [ ] **Step 2: Contrôle de non-collision de nom**

Run: `grep -rn "ar_classe_dispositifs" supabase/migrations/`
Expected: seules les occurrences du fichier créé (aucune table du même nom ailleurs).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261002_amenagactif_dispositifs.sql
git commit -m "feat(dispositifs): migration table ar_classe_dispositifs + chapitre est_dispositif"
```

(JF exécute le fichier dans le SQL Editor avant tout déploiement : voir Task 11.)

---

### Task 2: Module de domaine `dispositifs.js` (TDD)

**Files:**
- Create: `src/domain/dispositifs.js`
- Test: `tests/domain/dispositifs.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

```js
import { describe, it, expect } from 'vitest';
import {
  estModeAU, chapitreEnModeAU, typeEffectif, appliquerTypesEffectifs,
  selectionsActives, dispositifsAU, bloqueBasculeDispositif, messageConfirmationRetraitAU,
} from '../../src/domain/dispositifs.js';

const chapitres = [
  { id: 'c1', ordre: 1, titre: '1. SUPPORTS', est_dispositif: false },
  { id: 'd1', ordre: 13, titre: 'Dispositif de régulation des comportements', est_dispositif: true },
];
const amenagements = [
  { id: 'a1', chapitre_id: 'c1', ordre: 1, libelle: 'Mise en page', type: 'AU' },
  { id: 'a2', chapitre_id: 'c1', ordre: 2, libelle: 'Doubler les espaces', type: 'AR' },
  { id: 'x2', chapitre_id: 'd1', ordre: 2, libelle: 'Pictogramme de pause', type: 'AR' },
  { id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR' },
];
const modeAU = [{ chapitre_id: 'd1', pour_toute_la_classe: true }];
const modeAR = [{ chapitre_id: 'd1', pour_toute_la_classe: false }];

describe('estModeAU / chapitreEnModeAU', () => {
  it('vrai seulement pour une ligne pour_toute_la_classe = true', () => {
    expect(estModeAU('d1', modeAU)).toBe(true);
    expect(estModeAU('d1', modeAR)).toBe(false);
    expect(estModeAU('d1', [])).toBe(false);
    expect(estModeAU('d1')).toBe(false);
  });
  it("ignore une ligne de mode sur un chapitre qui n'est pas un dispositif", () => {
    expect(chapitreEnModeAU(chapitres[0], [{ chapitre_id: 'c1', pour_toute_la_classe: true }])).toBe(false);
    expect(chapitreEnModeAU(chapitres[1], modeAU)).toBe(true);
  });
});

describe('typeEffectif', () => {
  it('un item de dispositif est AU en mode AU, AR sinon', () => {
    expect(typeEffectif(amenagements[3], chapitres, modeAU)).toBe('AU');
    expect(typeEffectif(amenagements[3], chapitres, modeAR)).toBe('AR');
    expect(typeEffectif(amenagements[3], chapitres, [])).toBe('AR');
  });
  it('un item ordinaire garde son type', () => {
    expect(typeEffectif(amenagements[0], chapitres, modeAU)).toBe('AU');
    expect(typeEffectif(amenagements[1], chapitres, modeAU)).toBe('AR');
  });
});

describe('appliquerTypesEffectifs', () => {
  it("renvoie l'entrée telle quelle sans mode", () => {
    const input = { amenagements, chapitres };
    expect(appliquerTypesEffectifs(input)).toBe(input);
  });
  it('réécrit le type des items de dispositif en mode AU, sans muter la source', () => {
    const out = appliquerTypesEffectifs({ amenagements, chapitres, modesDispositifs: modeAU });
    expect(out.amenagements.find((a) => a.id === 'x1').type).toBe('AU');
    expect(out.amenagements.find((a) => a.id === 'a2').type).toBe('AR');
    expect(amenagements.find((a) => a.id === 'x1').type).toBe('AR');
  });
});

describe('selectionsActives', () => {
  const sels = [
    { eleve_id: 'e1', amenagement_id: 'x1' },
    { eleve_id: 'e1', amenagement_id: 'a2' },
  ];
  it('écarte les sélections élève sur un dispositif passé en AU', () => {
    expect(selectionsActives(sels, amenagements, chapitres, modeAU)).toEqual([{ eleve_id: 'e1', amenagement_id: 'a2' }]);
  });
  it('garde tout en mode AR ou sans mode', () => {
    expect(selectionsActives(sels, amenagements, chapitres, modeAR)).toHaveLength(2);
    expect(selectionsActives(sels, amenagements, chapitres)).toHaveLength(2);
  });
});

describe('dispositifsAU', () => {
  const auClasse = [{ amenagement_id: 'x2' }, { amenagement_id: 'x1' }, { amenagement_id: 'a1' }];
  it('un bloc par dispositif en mode AU, items triés par ordre, AU ordinaires exclus', () => {
    expect(dispositifsAU({ amenagements, chapitres, auClasse, modes: modeAU })).toEqual([
      { titre: 'Dispositif de régulation des comportements', items: ['Coin calme', 'Pictogramme de pause'] },
    ]);
  });
  it('rien en mode AR ou sans mode, ou sans item coché', () => {
    expect(dispositifsAU({ amenagements, chapitres, auClasse, modes: modeAR })).toEqual([]);
    expect(dispositifsAU({ amenagements, chapitres, auClasse, modes: [] })).toEqual([]);
    expect(dispositifsAU({ amenagements, chapitres, auClasse: [], modes: modeAU })).toEqual([]);
  });
});

describe('bloqueBasculeDispositif', () => {
  const eleveIds = new Set(['e1', 'e2']);
  it('vers AU : refuse si des élèves ont des items cochés, en comptant les élèves distincts', () => {
    const sels = [
      { eleve_id: 'e1', amenagement_id: 'x1' }, { eleve_id: 'e1', amenagement_id: 'x2' }, { eleve_id: 'e2', amenagement_id: 'x1' },
    ];
    const msg = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: sels, auClasse: [] });
    expect(msg).toMatch(/2 élèves ont déjà/);
  });
  it('vers AU : accord au singulier, et élèves hors classe ignorés', () => {
    const un = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }], auClasse: [] });
    expect(un).toMatch(/1 élève a déjà/);
    const horsClasse = bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [{ eleve_id: 'zz', amenagement_id: 'x1' }], auClasse: [] });
    expect(horsClasse).toBeNull();
  });
  it("vers AU : ignore les sélections d'un autre chapitre", () => {
    expect(bloqueBasculeDispositif({ vers: 'AU', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'a2' }], auClasse: [] })).toBeNull();
  });
  it('vers AR : refuse si des items sont cochés pour la classe', () => {
    const msg = bloqueBasculeDispositif({ vers: 'AR', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [], auClasse: [{ amenagement_id: 'x1' }, { amenagement_id: 'a1' }] });
    expect(msg).toMatch(/1 aménagement/);
  });
  it('vers AR : accord si rien de coché pour la classe sur ce dispositif', () => {
    expect(bloqueBasculeDispositif({ vers: 'AR', chapitreId: 'd1', amenagements, eleveIds, selectionsAR: [], auClasse: [{ amenagement_id: 'a1' }] })).toBeNull();
  });
});

describe('messageConfirmationRetraitAU', () => {
  it("nomme l'aménagement et explique les trois conséquences", () => {
    const m = messageConfirmationRetraitAU('Coin calme');
    expect(m).toContain('« Coin calme »');
    expect(m).toMatch(/fiche de la classe/);
    expect(m).not.toContain('prochain envoi');
    expect(m).toMatch(/DiffActif/);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/domain/dispositifs.test.js`
Expected: FAIL (module `src/domain/dispositifs.js` introuvable).

- [ ] **Step 3: Implémenter**

```js
/**
 * Dispositifs : chapitres marqués `est_dispositif`. Leurs items sont stockés en type 'AR' ;
 * pour une classe donnée, une ligne `ar_classe_dispositifs` avec pour_toute_la_classe = true
 * les fait lire comme des AU (cochés une fois pour la classe, table ar_amenagements_classe).
 * Sans ligne : mode AR (cochés par élève, table ar_selections).
 * Source de vérité UNIQUE du mode : toutes les projections passent par ici.
 *
 * @typedef {{ chapitre_id: string, pour_toute_la_classe: boolean }} ModeDispositif
 */

/** @param {string} chapitreId @param {ModeDispositif[]} [modes] */
export function estModeAU(chapitreId, modes = []) {
  return modes.some((m) => m.chapitre_id === chapitreId && m.pour_toute_la_classe === true);
}

/** Vrai si le chapitre est un dispositif ET passé en « pour toute la classe ». Une ligne de mode sur un chapitre ordinaire est ignorée. */
export function chapitreEnModeAU(chapitre, modes = []) {
  return chapitre?.est_dispositif === true && estModeAU(chapitre.id, modes);
}

export function typeEffectif(amenagement, chapitres, modes = []) {
  const ch = chapitres.find((c) => c.id === amenagement?.chapitre_id);
  return chapitreEnModeAU(ch, modes) ? 'AU' : amenagement.type;
}

/**
 * Pour les consommateurs qui raisonnent en AU/AR (snapshot, profils DiffActif) : réécrit le type
 * des items de dispositif passés en AU. Ne mute pas l'entrée ; sans mode, renvoie l'entrée telle quelle.
 * @template {{ amenagements: any[], chapitres?: any[], modesDispositifs?: ModeDispositif[] }} T
 * @param {T} input
 * @returns {T}
 */
export function appliquerTypesEffectifs(input) {
  const modes = input.modesDispositifs ?? [];
  if (modes.length === 0) return input;
  const chapById = new Map((input.chapitres ?? []).map((c) => [c.id, c]));
  return {
    ...input,
    amenagements: input.amenagements.map((a) => (chapitreEnModeAU(chapById.get(a.chapitre_id), modes) ? { ...a, type: 'AU' } : a)),
  };
}

/** Écarte les sélections par élève restées sur un dispositif désormais en mode AU (état qui ne devrait pas exister). */
export function selectionsActives(selectionsAR, amenagements, chapitres, modes = []) {
  if (modes.length === 0) return selectionsAR;
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  return selectionsAR.filter((s) => !chapitreEnModeAU(chapById.get(amgtById.get(s.amenagement_id)?.chapitre_id), modes));
}

/**
 * Blocs « dispositif pour toute la classe » de la fiche : un bloc par dispositif en mode AU
 * ayant au moins un item coché. Titre exact du chapitre ; items triés par ordre de catalogue.
 * @returns {{ titre: string, items: string[] }[]}
 */
export function dispositifsAU({ amenagements, chapitres, auClasse, modes = [] }) {
  const amgtById = new Map(amenagements.map((a) => [a.id, a]));
  const chapById = new Map(chapitres.map((c) => [c.id, c]));
  const parChap = new Map();
  for (const x of auClasse) {
    const a = amgtById.get(x.amenagement_id);
    const ch = a && chapById.get(a.chapitre_id);
    if (!ch || !chapitreEnModeAU(ch, modes)) continue;
    if (!parChap.has(ch.id)) parChap.set(ch.id, { titre: ch.titre, ordre: ch.ordre, items: [] });
    parChap.get(ch.id).items.push({ ordre: a.ordre, libelle: a.libelle });
  }
  return [...parChap.values()]
    .sort((a, b) => a.ordre - b.ordre)
    .map(({ titre, items }) => ({ titre, items: items.sort((a, b) => a.ordre - b.ordre).map((i) => i.libelle) }));
}

/**
 * Règle de blocage de la bascule : jamais de conversion automatique.
 * @param {{ vers: 'AU'|'AR', chapitreId: string, amenagements: any[], eleveIds: Set<string>,
 *           selectionsAR: any[], auClasse: any[] }} p  (auClasse : lignes de LA classe)
 * @returns {string|null} message d'erreur à afficher, ou null si la bascule est permise
 */
export function bloqueBasculeDispositif({ vers, chapitreId, amenagements, eleveIds, selectionsAR, auClasse }) {
  const ids = new Set(amenagements.filter((a) => a.chapitre_id === chapitreId).map((a) => a.id));
  if (vers === 'AU') {
    const eleves = new Set(selectionsAR.filter((s) => ids.has(s.amenagement_id) && eleveIds.has(s.eleve_id)).map((s) => s.eleve_id));
    const n = eleves.size;
    if (n > 0) {
      return `Impossible : ${n} élève${n > 1 ? 's ont' : ' a'} déjà des aménagements de ce dispositif cochés individuellement. Décochez-les d'abord dans la colonne de chaque élève, puis passez le dispositif à toute la classe.`;
    }
  } else {
    const n = auClasse.filter((x) => ids.has(x.amenagement_id)).length;
    if (n > 0) {
      return `Impossible : ${n} aménagement${n > 1 ? 's' : ''} de ce dispositif ${n > 1 ? 'sont cochés' : 'est coché'} pour toute la classe. Décochez-${n > 1 ? 'les' : 'le'} d'abord, puis repassez le dispositif en mode élève par élève.`;
    }
  }
  return null;
}

/** Texte de la confirmation avant de décocher un AU de classe (ordinaire ou dispositif). */
export function messageConfirmationRetraitAU(libelle) {
  return `Décocher « ${libelle} » pour toute la classe ?\n\n- il disparaît de la fiche de la classe pour tous les enseignants qui la consultent ;\n- il ne figurera plus dans le profil transmis aux autres apps (DiffActif).\n\nÀ confirmer seulement si l'aménagement ne s'applique réellement plus.`;
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run tests/domain/dispositifs.test.js`
Expected: PASS (toutes les assertions).

- [ ] **Step 5: Commit**

```bash
git add src/domain/dispositifs.js tests/domain/dispositifs.test.js
git commit -m "feat(dispositifs): module de domaine (mode, type effectif, blocs AU, blocage, confirmation)"
```

---

### Task 3: Chargeur de fiche (colonnes + modes)

**Files:**
- Modify: `src/domain/chargeurFiche.js`
- Modify: `tests/domain/chargeurFiche.test.js`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tests/domain/chargeurFiche.test.js`, ajouter l'import `COLONNES_CHAPITRES`, la table de fixture, et deux tests ; compléter la liste de tables en erreur.

Remplacer la ligne d'import :
```js
import { chargerDonneesClasseAvec, COLONNES_ELEVES, COLONNES_AMENAGEMENTS, COLONNES_CHAPITRES } from '../../src/domain/chargeurFiche.js';
```

Ajouter dans l'objet `tables` (après `ar_eleves: [...]`) :
```js
  ar_classe_dispositifs: [{ chapitre_id: 'ch-d', pour_toute_la_classe: true }],
```

Ajouter dans le `describe` :
```js
  it('charge est_dispositif sur les chapitres et les modes de dispositifs de la classe', async () => {
    const db = fauxDb(tables);
    const d = await chargerDonneesClasseAvec(db, 'c1');
    expect(COLONNES_CHAPITRES).toContain('est_dispositif');
    expect(db.selects.find((s) => s.table === 'ar_chapitres').cols).toContain('est_dispositif');
    expect(d.modesDispositifs).toEqual([{ chapitre_id: 'ch-d', pour_toute_la_classe: true }]);
  });
```

Dans le test « lève l'erreur… », ajouter `'ar_classe_dispositifs'` à la liste `toutes`.

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/domain/chargeurFiche.test.js`
Expected: FAIL (`COLONNES_CHAPITRES` ne contient pas `est_dispositif`, `modesDispositifs` undefined).

- [ ] **Step 3: Implémenter**

Dans `src/domain/chargeurFiche.js` :

Remplacer `export const COLONNES_CHAPITRES = 'id, ordre, titre, code';` par :
```js
export const COLONNES_CHAPITRES = 'id, ordre, titre, code, est_dispositif';
export const COLONNES_MODES_DISPOSITIFS = 'chapitre_id, pour_toute_la_classe';
```

Remplacer la déstructuration et le `Promise.all` :
```js
  const [cat, chap, au, sel, lib, liensEcole, profils, modes] = await Promise.all([
    db.from('ar_amenagements').select(COLONNES_AMENAGEMENTS),
    db.from('ar_chapitres').select(COLONNES_CHAPITRES).order('ordre'),
    db.from('ar_amenagements_classe').select(COLONNES_AU_CLASSE).eq('classe_id', classeId),
    eleveIds.length ? db.from('ar_selections').select(COLONNES_SELECTIONS).in('eleve_id', eleveIds) : vide,
    eleveIds.length ? db.from('ar_amenagements_libres').select(COLONNES_LIBRES).in('eleve_id', eleveIds) : vide,
    // Comptes multi-écoles rattachés à cette école via ar_profils_acces_ecoles.
    db.from('ar_profils_acces_ecoles').select('user_id').eq('ecole_id', classe.ecole_id),
    db.from('ar_profils_acces').select(COLONNES_PROFILS).in('role', ROLES_REFERENTS),
    db.from('ar_classe_dispositifs').select(COLONNES_MODES_DISPOSITIFS).eq('classe_id', classeId),
  ]);
```

Ajouter dans l'objet retourné, après `libres: ...` :
```js
    modesDispositifs: verifier(modes, 'modes des dispositifs'),
```

- [ ] **Step 4: Vérifier le succès**

Run: `npx vitest run tests/domain/chargeurFiche.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/chargeurFiche.js tests/domain/chargeurFiche.test.js
git commit -m "feat(dispositifs): le chargeur de fiche lit est_dispositif et les modes par classe"
```

---

### Task 4: Fiche classe et fusion (TDD)

**Files:**
- Modify: `src/domain/projections/ficheClasse.js`
- Modify: `src/domain/projections/fusionClasses.js`
- Modify: `src/domain/types.js`
- Test: `tests/domain/dispositifsFiches.test.jsx` (créer ; complété en Task 6)

- [ ] **Step 1: Écrire les tests qui échouent**

```js
import { describe, it, expect } from 'vitest';
import { computeFicheClasse } from '../../src/domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../../src/domain/projections/fusionClasses.js';
import * as f from '../../src/test/fixtures/sample.js';

export const chapD = { id: 'd1', ordre: 13, titre: 'Dispositif de régulation des comportements', est_dispositif: true };
export const itemsD = [
  { id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR' },
  { id: 'x2', chapitre_id: 'd1', ordre: 2, libelle: 'Pictogramme de pause', type: 'AR' },
];
export const modeAU = [{ chapitre_id: 'd1', pour_toute_la_classe: true }];
export const modeAR = [{ chapitre_id: 'd1', pour_toute_la_classe: false }];

const base = (extra = {}) => ({
  classe: f.classe5LA,
  contexte: f.contexte,
  eleves: f.eleves,
  amenagements: [...f.amenagements, ...itemsD],
  chapitres: [...f.chapitres, chapD],
  auClasse: f.auClasse,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
  referents: f.referents,
  ...extra,
});

describe('computeFicheClasse — dispositifs', () => {
  it('mode AU : un bloc dispositif, absent de pourTous et du tableau AR', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([{ titre: chapD.titre, items: ['Coin calme'], classe: '5LA' }]);
    expect(vm.pourTous.map((x) => x.libelle)).toEqual(['Mise en page']);
    expect(vm.parAmenagement.map((r) => r.libelle)).not.toContain('Coin calme');
  });

  it('mode AR : les items vont dans le tableau AR avec leurs élèves, pas de bloc dispositif', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAR,
      selectionsAR: [...f.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([]);
    const row = vm.parAmenagement.find((r) => r.libelle === 'Coin calme');
    expect(row.eleves.map((e) => e.nom)).toEqual(['Karim B.']);
  });

  it('sans ligne de mode : défaut AR', () => {
    const vm = computeFicheClasse(base({
      selectionsAR: [...f.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([]);
    expect(vm.parAmenagement.map((r) => r.libelle)).toContain('Coin calme');
  });

  it('mode AU : une sélection élève restée sur le dispositif est ignorée', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      selectionsAR: [...f.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.parAmenagement.map((r) => r.libelle)).not.toContain('Coin calme');
    expect(vm.parEleve.map((x) => x.eleve)).not.toContain('Karim B.');
  });

  it('mode AR : une ligne AU de classe restée sur le dispositif est ignorée', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAR,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    expect(vm.dispositifsClasse).toEqual([]);
    expect(vm.pourTous.map((x) => x.libelle)).toEqual(['Mise en page']);
  });
});

describe('fusionnerDonneesClasses — dispositifs', () => {
  const partieA = () => base({
    modesDispositifs: modeAU,
    auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
  });
  const partieB = () => ({
    classe: { referent_plai_nom: 'Carole', niveau: '5e', created_at: '2026-08-19T08:00:00Z' },
    contexte: { classeNom: '5LB', ecoleNom: f.contexte.ecoleNom, anneeLibelle: f.contexte.anneeLibelle },
    eleves: [{ id: 'e4', classe_id: 'cl-5lb', prenom: 'Yasmine', initiale_nom: 'T', commentaire: '', statut: 'IPT', created_at: '2026-08-21T08:00:00Z' }],
    amenagements: [...f.amenagements, ...itemsD],
    chapitres: [...f.chapitres, chapD],
    auClasse: [],
    selectionsAR: [{ eleve_id: 'e4', amenagement_id: 'x1', cree_le: '2026-09-05T08:00:00Z' }],
    libres: [],
    referents: f.referents,
    modesDispositifs: modeAR,
  });

  it('un dispositif AU dans une classe et AR dans une autre : bloc étiqueté par classe + AR de la seconde', () => {
    const fusion = fusionnerDonneesClasses([partieA(), partieB()]);
    const vm = computeFicheClasse(fusion);
    expect(vm.dispositifsClasse).toEqual([{ titre: chapD.titre, items: ['Coin calme'], classe: '5LA' }]);
    const row = vm.parAmenagement.find((r) => r.libelle === 'Coin calme');
    expect(row.eleves.map((e) => e.nom)).toEqual(['Yasmine T.']);
  });

  it('écarte la sélection résiduelle de la classe en mode AU avant fusion', () => {
    const a = partieA();
    a.selectionsAR = [...a.selectionsAR, { eleve_id: 'e2', amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }];
    const fusion = fusionnerDonneesClasses([a, partieB()]);
    expect(fusion.selectionsAR.some((s) => s.eleve_id === 'e2' && s.amenagement_id === 'x1')).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/domain/dispositifsFiches.test.jsx`
Expected: FAIL (`vm.dispositifsClasse` undefined, etc.).

- [ ] **Step 3: Implémenter `ficheClasse.js`**

En tête du fichier, ajouter l'import :
```js
import { dispositifsAU, selectionsActives } from '../dispositifs.js';
```

Remplacer la ligne de déstructuration `const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres, referents } = input;` par :
```js
  const { contexte, eleves, amenagements, chapitres, auClasse, libres, referents } = input;
  const modes = input.modesDispositifs ?? [];
  // Une sélection par élève restée sur un dispositif passé en AU (état normalement impossible) est ignorée.
  const selectionsAR = selectionsActives(input.selectionsAR, amenagements, chapitres, modes);
  // Blocs « dispositif pour toute la classe » : fournis par fusionnerDonneesClasses pour une fiche groupée
  // (un par classe source), sinon calculés ici pour la classe unique.
  const dispositifsClasse = input.dispositifsClasse
    ?? dispositifsAU({ amenagements, chapitres, auClasse, modes }).map((b) => ({ ...b, classe: contexte.classeNom }));
```

Dans l'objet retourné, ajouter après `pourTous,` :
```js
    dispositifsClasse,
```

Mettre à jour la JSDoc `@param` de `computeFicheClasse` en ajoutant :
```js
 *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],
 *  dispositifsClasse?: { titre: string, items: string[], classe: string }[],
```
(juste avant la ligne ` * }} input`).

- [ ] **Step 4: Implémenter `fusionClasses.js`**

Ajouter l'import en tête :
```js
import { dispositifsAU, selectionsActives } from '../dispositifs.js';
```

Remplacer la ligne `const selectionsAR = parties.flatMap((p) => p.selectionsAR);` par :
```js
  // Le mode d'un dispositif est propre à chaque classe : on écarte avant fusion les sélections résiduelles
  // des classes où il est en mode AU, et on fige un bloc par classe (étiqueté de son nom).
  const selectionsAR = parties.flatMap((p) => selectionsActives(p.selectionsAR, p.amenagements, p.chapitres, p.modesDispositifs ?? []));
  const dispositifsClasse = parties.flatMap((p) => dispositifsAU({
    amenagements: p.amenagements, chapitres: p.chapitres, auClasse: p.auClasse, modes: p.modesDispositifs ?? [],
  }).map((b) => ({ ...b, classe: p.contexte.classeNom })));
```

Dans l'objet retourné, après `commentairesClasses,` ajouter :
```js
    dispositifsClasse,
    modesDispositifs: [],
```

Ajouter à la JSDoc `@param` de `parties` (avant la ligne ` * }>} parties`) :
```js
 *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],
```

- [ ] **Step 5: Mettre à jour `types.js`**

Dans `Chapitre`, ajouter après `@property {string} titre` :
```js
 * @property {boolean} [est_dispositif]   // groupe « dispositif » : items AR par élève ou AU de classe selon la classe
```
Dans `FicheClasseVM`, après la ligne `pourTous` :
```js
 * @property {{ titre: string, items: string[], classe: string }[]} dispositifsClasse
```
Dans `FicheEleveVM`, après `parChapitre` :
```js
 * @property {{ libelle: string, chapitreTitre: string, surligne: boolean }[]} pourTous
 * @property {{ titre: string, items: string[] }[]} dispositifsClasse
```

- [ ] **Step 6: Vérifier le succès (nouveaux tests + non-régression)**

Run: `npx vitest run tests/domain/dispositifsFiches.test.jsx tests/domain/ficheClasse.test.js tests/domain/fusionClasses.test.js`
Expected: PASS, aucun test existant cassé.

- [ ] **Step 7: Commit**

```bash
git add src/domain/projections/ficheClasse.js src/domain/projections/fusionClasses.js src/domain/types.js tests/domain/dispositifsFiches.test.jsx
git commit -m "feat(dispositifs): fiche classe et fiche groupée lisent le mode par classe"
```

---

### Task 5: Rendu de la fiche classe

**Files:**
- Modify: `src/components/fiche/FicheClasseView.jsx`

- [ ] **Step 1: Ajouter le rendu des blocs**

Après la fermeture du bloc AU (le `</ul>` qui suit `vm.pourTous.map(...)`) et avant `<h2 className="font-bold underline mb-1">AR spécifiques à un élève :</h2>`, insérer :

```jsx
      {vm.dispositifsClasse?.map((d, i) => (
        <section key={i} className="mb-4">
          {/* Titre exact du dispositif ; en fiche groupée, la classe précise de quelle classe il s'agit. */}
          <h2 className="font-bold underline mb-1">{d.titre}{vm.classesSources ? ` (${d.classe})` : ''} :</h2>
          <ul className="list-disc pl-6">
            {d.items.map((libelle, j) => <li key={j}>{libelle}</li>)}
          </ul>
        </section>
      ))}
```

- [ ] **Step 2: Vérifier le rendu avec un test composant**

Ajouter à `tests/domain/dispositifsFiches.test.jsx` (import en tête : `import { render, screen } from '@testing-library/react'; import FicheClasseView from '../../src/components/fiche/FicheClasseView.jsx';`) :

```js
describe('FicheClasseView — bloc dispositif', () => {
  it('affiche le titre exact du dispositif et ses items sous les AU', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    render(<FicheClasseView vm={vm} />);
    expect(screen.getByText(`${chapD.titre} :`)).toBeTruthy();
    expect(screen.getByText('Coin calme')).toBeTruthy();
  });
  it('ajoute le nom de la classe en fiche groupée', () => {
    const vm = computeFicheClasse(base({
      modesDispositifs: modeAU,
      auClasse: [...f.auClasse, { amenagement_id: 'x1', cree_le: '2026-09-10T08:00:00Z' }],
    }));
    vm.classesSources = ['5LA', '5LB'];
    render(<FicheClasseView vm={vm} />);
    expect(screen.getByText(`${chapD.titre} (5LA) :`)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Lancer**

Run: `npx vitest run tests/domain/dispositifsFiches.test.jsx`
Expected: PASS. Si `FicheClasseView` exige des props supplémentaires (ex. `lienEleve`), les passer à `undefined`/`false` : le composant les lit avec des valeurs par défaut.

- [ ] **Step 4: Commit**

```bash
git add src/components/fiche/FicheClasseView.jsx tests/domain/
git commit -m "feat(dispositifs): bloc dispositif sous les AU sur la fiche classe"
```

---

### Task 6: Fiche élève (AU de la classe + dispositifs ; projection, hook, vue)

**Files:**
- Modify: `src/domain/projections/ficheEleve.js`
- Modify: `src/hooks/useFicheEleve.js`
- Modify: `src/components/fiche/FicheEleveView.jsx`
- Test: `tests/domain/dispositifsFiches.test.jsx`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter (import : `import { computeFicheEleve } from '../../src/domain/projections/ficheEleve.js';`) :

```js
describe('computeFicheEleve — dispositifs', () => {
  const entree = (extra = {}) => ({
    eleve: f.eleves[0], classeNom: '5LA', ecoleNom: 'Athénée X',
    amenagements: [...f.amenagements, ...itemsD], chapitres: [...f.chapitres, chapD],
    selectionsAR: [], libres: [], auClasse: [], modesDispositifs: [], ...extra,
  });

  it('mode AU : le bloc du dispositif apparaît sur la fiche de chaque élève de la classe', () => {
    const vm = computeFicheEleve(entree({ modesDispositifs: modeAU, auClasse: [{ amenagement_id: 'x1' }] }));
    expect(vm.dispositifsClasse).toEqual([{ titre: chapD.titre, items: ['Coin calme'] }]);
  });

  it('mode AR : les items cochés pour cet élève sont listés sous le titre du dispositif', () => {
    const vm = computeFicheEleve(entree({ modesDispositifs: modeAR, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] }));
    expect(vm.dispositifsClasse).toEqual([]);
    expect(vm.parChapitre).toEqual([{ chapitreTitre: chapD.titre, amenagements: ['Coin calme'] }]);
  });

  it('mode AU : une sélection élève résiduelle sur le dispositif est ignorée', () => {
    const vm = computeFicheEleve(entree({ modesDispositifs: modeAU, selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }] }));
    expect(vm.parChapitre).toEqual([]);
  });
});

describe('computeFicheEleve — AU de la classe (pourTous)', () => {
  const entree = (extra = {}) => ({
    eleve: f.eleves[0], classeNom: '5LA', ecoleNom: 'Athénée X',
    amenagements: [...f.amenagements, ...itemsD], chapitres: [...f.chapitres, chapD],
    selectionsAR: [], libres: [], auClasse: [], modesDispositifs: [], ...extra,
  });

  it('liste les AU ordinaires de la classe, avec chapitre et surbrillance de « Mise en page »', () => {
    const vm = computeFicheEleve(entree({ auClasse: [{ amenagement_id: 'a-au1' }] }));
    expect(vm.pourTous).toEqual([{ libelle: 'Mise en page', chapitreTitre: f.chapitres[0].titre, surligne: true }]);
  });

  it('exclut les items de dispositif (ils ont leur propre bloc) et reste vide sans AU', () => {
    const vm = computeFicheEleve(entree({ modesDispositifs: modeAU, auClasse: [{ amenagement_id: 'x1' }] }));
    expect(vm.pourTous).toEqual([]);
    expect(vm.dispositifsClasse).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/domain/dispositifsFiches.test.jsx`
Expected: FAIL (`vm.dispositifsClasse` undefined).

- [ ] **Step 3: Implémenter `ficheEleve.js`**

Ajouter les imports en tête :
```js
import { dispositifsAU, selectionsActives } from '../dispositifs.js';
import { normaliseLibelle } from '../normalise.js';

const LIBELLE_MISE_EN_PAGE = normaliseLibelle('Mise en page');
```
Remplacer `const { eleve, classeNom, ecoleNom, amenagements, chapitres, selectionsAR, libres } = input;` par :
```js
  const { eleve, classeNom, ecoleNom, amenagements, chapitres, libres } = input;
  const modes = input.modesDispositifs ?? [];
  const selectionsAR = selectionsActives(input.selectionsAR, amenagements, chapitres, modes);
  // Dispositifs passés en AU pour la classe : valent pour chaque élève de la classe.
  const dispositifsClasse = dispositifsAU({ amenagements, chapitres, auClasse: input.auClasse ?? [], modes })
    .map(({ titre, items }) => ({ titre, items }));
  // AU ordinaires de la classe (même règle que la fiche classe : type AU stocké, triés par chapitre puis ordre).
  // Les items de dispositif ont un type de base AR : ils n'entrent jamais ici (voir dispositifsClasse).
  const chapOrdre = (a) => chapitres.find((c) => c.id === a.chapitre_id)?.ordre ?? 999;
  const pourTous = (input.auClasse ?? [])
    .map((x) => amenagements.find((a) => a.id === x.amenagement_id))
    .filter((a) => a && a.type === 'AU')
    .sort((a, b) => chapOrdre(a) - chapOrdre(b) || a.ordre - b.ordre)
    .map((a) => ({
      libelle: a.libelle,
      chapitreTitre: chapitres.find((c) => c.id === a.chapitre_id)?.titre ?? '',
      surligne: normaliseLibelle(a.libelle) === LIBELLE_MISE_EN_PAGE,
    }));
```
Remplacer le `return` final par :
```js
  return { eleve: nomEleve, classeNom, ecoleNom, statut: eleve.statut, parChapitre, pourTous, dispositifsClasse, commentaire: (eleve.commentaire ?? '').trim() };
```
Ajouter à la JSDoc `@param` : ` *  auClasse?: { amenagement_id: string }[],` et ` *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],`.

- [ ] **Step 4: Implémenter `useFicheEleve.js`**

Remplacer le corps de `charger` après la requête `eleve` par :
```js
  const [cat, chap, sel, lib, auc, modes] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre, est_dispositif').order('ordre'),
    supabase.from('ar_selections').select('eleve_id, amenagement_id').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_classe').select('amenagement_id').eq('classe_id', eleve.classe_id),
    supabase.from('ar_classe_dispositifs').select('chapitre_id, pour_toute_la_classe').eq('classe_id', eleve.classe_id),
  ]);
  // Jamais de fiche partielle silencieuse : les deux nouvelles lectures décident de ce qui s'affiche.
  if (auc.error) throw auc.error;
  if (modes.error) throw modes.error;
  return computeFicheEleve({
    eleve,
    classeNom: eleve.ar_classes?.nom ?? '',
    ecoleNom: eleve.ar_classes?.ar_ecoles?.implantation_nom || eleve.ar_classes?.ar_ecoles?.nom || '',
    amenagements: cat.data,
    chapitres: chap.data,
    selectionsAR: sel.data,
    libres: lib.data,
    auClasse: auc.data,
    modesDispositifs: modes.data,
  });
```

- [ ] **Step 5: Implémenter `FicheEleveView.jsx`**

Remplacer la ligne `{vm.parChapitre.length === 0 && <p className="text-gray-500">Aucun aménagement spécifique enregistré.</p>}` par :
```jsx
      <section className="mb-3">
        <h2 className="font-bold underline">AU applicable(s) à toute la classe :</h2>
        <ul className="list-disc pl-6">
          {(vm.pourTous?.length ?? 0) === 0 && <li className="list-none text-gray-500">Aucun aménagement universel retenu pour la classe.</li>}
          {vm.pourTous?.map((x, i) => (
            <li key={i} className={x.surligne ? 'bg-yellow-200' : ''}>{x.libelle}</li>
          ))}
        </ul>
      </section>
      {vm.dispositifsClasse?.map((d) => (
        <section key={d.titre} className="mb-3">
          <h2 className="font-bold underline">{d.titre} :</h2>
          <ul className="list-disc pl-6">{d.items.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      ))}
      <h2 className="font-bold underline mb-1">Aménagements de {vm.eleve} :</h2>
      {vm.parChapitre.length === 0 && <p className="text-gray-500">Aucun aménagement spécifique enregistré.</p>}
```

- [ ] **Step 6: Lancer**

Run: `npx vitest run tests/domain/dispositifsFiches.test.jsx tests/domain/ficheEleve.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/projections/ficheEleve.js src/hooks/useFicheEleve.js src/components/fiche/FicheEleveView.jsx tests/domain/
git commit -m "feat(dispositifs): la fiche élève affiche les AU de la classe et les dispositifs en mode AU"
```

---

### Task 7: Snapshot et profils DiffActif lisent le type effectif (TDD)

**Files:**
- Modify: `src/domain/projections/snapshot.js`, `profilDiffActif.js`, `profilClasse.js`
- Test: `tests/domain/dispositifsProfils.test.js` (créer)

- [ ] **Step 1: Écrire les tests qui échouent**

```js
import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../../src/domain/projections/snapshot.js';
import { computeProfilDiffActif } from '../../src/domain/projections/profilDiffActif.js';
import { computeProfilClasse } from '../../src/domain/projections/profilClasse.js';

const chapitres = [{ id: 'd1', ordre: 13, titre: 'Dispositif de régulation des comportements', code: 'dispositif_regulation', est_dispositif: true }];
const amenagements = [{ id: 'x1', chapitre_id: 'd1', ordre: 1, libelle: 'Coin calme', type: 'AR', code: 'ar_coin_calme', partage_profil: true }];
const eleves = [{ id: 'e1', classe_id: 'c1', prenom: 'Emilie', initiale_nom: 'D', statut: 'PAR' }];
const contexte = { classeNom: '5LA', ecoleNom: 'Athénée X', anneeLibelle: '2026-2027' };
const modeAU = [{ chapitre_id: 'd1', pour_toute_la_classe: true }];
const modeAR = [{ chapitre_id: 'd1', pour_toute_la_classe: false }];

const auInput = { contexte, eleves, amenagements, chapitres, auClasse: [{ amenagement_id: 'x1' }], selectionsAR: [], libres: [], modesDispositifs: modeAU };
const arInput = { contexte, eleves, amenagements, chapitres, auClasse: [], selectionsAR: [{ eleve_id: 'e1', amenagement_id: 'x1' }], libres: [], modesDispositifs: modeAR };

describe('snapshot — dispositifs', () => {
  it('mode AU : item dans au', () => {
    const s = buildSnapshot(auInput);
    expect(s.au).toEqual(['Coin calme']);
    expect(s.parEleve['Emilie D.']).toEqual([]);
  });
  it('mode AR : item dans les AR de l’élève', () => {
    const s = buildSnapshot(arInput);
    expect(s.au).toEqual([]);
    expect(s.parEleve['Emilie D.']).toEqual(['Coin calme']);
  });
});

describe('profilDiffActif — dispositifs', () => {
  it('mode AU : auCommuns', () => {
    const p = computeProfilDiffActif(auInput);
    expect(p.auCommuns.map((a) => a.libelle)).toEqual(['Coin calme']);
    expect(p.arParEleve).toEqual([]);
  });
  it('mode AR : arParEleve', () => {
    const p = computeProfilDiffActif(arInput);
    expect(p.auCommuns).toEqual([]);
    expect(p.arParEleve).toEqual([{ eleve: 'Emilie D.', amenagements: ['Coin calme'] }]);
  });
});

describe('profilClasse (contrat DiffActif) — dispositifs', () => {
  const classe = { niveau: '5e', created_at: '2026-08-20T08:00:00Z' };
  it('mode AU : transmis comme AU avec son code', () => {
    const p = computeProfilClasse({ ...auInput, classe }, { now: new Date('2026-10-02T08:00:00Z') });
    expect(p.au.map((x) => x.code)).toEqual(['ar_coin_calme']);
    expect(p.ar).toEqual([]);
  });
  it('mode AR : transmis comme AR avec sa tranche d’effectif', () => {
    const p = computeProfilClasse({ ...arInput, classe }, { now: new Date('2026-10-02T08:00:00Z') });
    expect(p.au).toEqual([]);
    expect(p.ar.map((x) => [x.code, x.effectif])).toEqual([['ar_coin_calme', '1-2']]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run tests/domain/dispositifsProfils.test.js`
Expected: FAIL sur les cas « mode AU » (l'item est ignoré car de type AR).

- [ ] **Step 3: Implémenter**

`src/domain/projections/snapshot.js` — ajouter en tête `import { appliquerTypesEffectifs } from '../dispositifs.js';`, remplacer `const { eleves, amenagements, auClasse, selectionsAR, libres } = input;` par :
```js
  const { eleves, amenagements, auClasse, selectionsAR, libres } = appliquerTypesEffectifs(input);
```
et ajouter dans la JSDoc de `buildSnapshot` : ` *  chapitres?: import('../types.js').Chapitre[],` et ` *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],`.

`src/domain/projections/profilDiffActif.js` — ajouter l'import `import { appliquerTypesEffectifs } from '../dispositifs.js';` et remplacer `const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = input;` par :
```js
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = appliquerTypesEffectifs(input);
```
Ajouter à la JSDoc : ` *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],`.

`src/domain/projections/profilClasse.js` — ajouter l'import (en tête, avec les imports existants) `import { appliquerTypesEffectifs } from '../dispositifs.js';` et remplacer `const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = input;` par :
```js
  const { contexte, eleves, amenagements, chapitres, auClasse, selectionsAR, libres } = appliquerTypesEffectifs(input);
```
Ajouter à la JSDoc : ` *  modesDispositifs?: { chapitre_id: string, pour_toute_la_classe: boolean }[],`.

Note de comportement : en mode AU, une sélection élève résiduelle sur ces items est traitée par `profilClasse` comme « inclassable » (`elements_non_transmis_present = true`), jamais comme AR. Comportement défensif voulu.

- [ ] **Step 4: Lancer (nouveaux tests + non-régression)**

Run: `npx vitest run tests/domain/dispositifsProfils.test.js tests/domain/snapshot.test.js tests/domain/profilDiffActif.test.js tests/domain/profilClasse.test.js tests/domain/profilClasseApi.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/projections/ tests/domain/dispositifsProfils.test.js
git commit -m "feat(dispositifs): snapshot et profils DiffActif lisent le type effectif"
```

---

### Task 8: Données de la grille de saisie

**Files:**
- Modify: `src/hooks/useEcoleGrid.js`, `src/hooks/useGridMutations.js`, `src/hooks/useCatalogue.js`

- [ ] **Step 1: `useEcoleGrid.js`**

Dans l'early return des classes vides, remplacer par :
```js
      if (classeIds.length === 0) return { classes, eleves: [], selectionsAR: [], auClasse: [], libres: [], modesDispositifs: [] };
```
Remplacer le `Promise.all` et ce qui suit par :
```js
      const [{ data: auClasse, error: e1 }, sel, lib, modes] = await Promise.all([
        supabase.from('ar_amenagements_classe').select('classe_id, amenagement_id, cree_le').in('classe_id', classeIds),
        eleveIds.length
          ? supabase.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds)
          : Promise.resolve({ data: [], error: null }),
        eleveIds.length
          ? supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').in('eleve_id', eleveIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('ar_classe_dispositifs').select('classe_id, chapitre_id, pour_toute_la_classe').in('classe_id', classeIds),
      ]);
      if (e1) throw e1;
      if (sel.error) throw sel.error;
      if (lib.error) throw lib.error;
      if (modes.error) throw modes.error;

      return { classes, eleves, selectionsAR: sel.data, auClasse, libres: lib.data, modesDispositifs: modes.data };
```

- [ ] **Step 2: `useGridMutations.js`**

Ajouter avant `const upsertEleve` :
```js
  // Mode d'un dispositif pour une classe (AR par élève / AU pour toute la classe). L'écran vérifie
  // d'abord bloqueBasculeDispositif ; les droits sont imposés par la RLS (ar_can_editer_structure_ecole).
  const basculerDispositif = useMutation({
    mutationFn: async ({ classeId, chapitreId, pourToute }) => {
      const { error } = await supabase.from('ar_classe_dispositifs').upsert(
        { classe_id: classeId, chapitre_id: chapitreId, pour_toute_la_classe: pourToute, modifie_le: new Date().toISOString() },
        { onConflict: 'classe_id,chapitre_id' },
      );
      if (error) throw error;
    },
    onSuccess: invalider,
  });
```
et ajouter `basculerDispositif` au `return { ... }` final.

- [ ] **Step 3: `useCatalogue.js`**

Remplacer `.select('id, ordre, titre')` par `.select('id, ordre, titre, est_dispositif')`.

- [ ] **Step 4: Vérifier le build**

Run: `npx vite build`
Expected: build sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat(dispositifs): grille de saisie charge les modes ; mutation de bascule"
```

---

### Task 9: Interface de saisie

**Files:**
- Create: `src/components/saisie/EnTeteDispositif.jsx`, `CarteDispositif.jsx`, `RecapDispositifs.jsx`
- Modify: `src/components/saisie/ChapitreAR.jsx`, `BandeauAU.jsx`, `src/pages/SaisieEcole.jsx`

- [ ] **Step 1: `EnTeteDispositif.jsx`**

```jsx
/**
 * En-tête commun d'un dispositif (dans la grille en mode AR, dans la carte en mode AU) :
 * badge de mode + choix du mode. Présentationnel : le parent calcule le blocage et déclenche la mutation.
 */
export default function EnTeteDispositif({ chapitre, mode, peutBasculer, blocage, onBascule }) {
  const nom = `mode-${chapitre.id}`;
  return (
    <div className="px-2 py-2 border-b border-[color:var(--border)] text-sm space-y-1" role="group" aria-label={`Mode du dispositif ${chapitre.titre}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${mode === 'AU' ? 'bg-teal/10 text-teal' : 'bg-orange/10 text-orange'}`}>
          {mode === 'AU' ? 'AU · toute la classe' : 'AR · par élève'}
        </span>
        <label className="flex items-center gap-1">
          <input type="radio" name={nom} checked={mode === 'AR'} disabled={!peutBasculer} onChange={() => onBascule('AR')} />
          élève par élève (AR)
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name={nom} checked={mode === 'AU'} disabled={!peutBasculer} onChange={() => onBascule('AU')} />
          à toute la classe (AU)
        </label>
      </div>
      <p className="text-xs text-[color:var(--text3)]">
        Choisissez comment ce dispositif s'applique à cette classe. <strong>AR</strong> : coché pour chaque élève concerné, dans sa colonne.
        <strong> AU</strong> : coché une seule fois pour toute la classe ; il apparaît alors sur la fiche classe, sous le titre du dispositif, et sur la fiche de chaque élève.
        Le changement est refusé tant que des cases de l'autre mode sont cochées.
      </p>
      {!peutBasculer && (
        <p className="text-xs text-[color:var(--text3)]">Le mode est modifiable par le référent PLAI, la direction ou l'administrateur.</p>
      )}
      {blocage && <p role="alert" className="plai-error text-sm">{blocage}</p>}
    </div>
  );
}
```

- [ ] **Step 2: `CarteDispositif.jsx`**

```jsx
import EnTeteDispositif from './EnTeteDispositif.jsx';
import { messageConfirmationRetraitAU } from '../../domain/dispositifs.js';

function normaliser(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Dispositif en mode AU pour la classe : coché une seule fois (table ar_amenagements_classe),
 * comme le bloc AU. Même règle de retrait que les AU (agent accompagnant : ajout seulement).
 * `entete` = props d'EnTeteDispositif (mode, peutBasculer, blocage, onBascule).
 */
export default function CarteDispositif({ classe, chapitre, items, auClasse, onToggle, peutRetirer = true, filtre, entete }) {
  const estCoche = (id) => auClasse.some((x) => x.amenagement_id === id);
  const tries = [...items].sort((a, b) => a.ordre - b.ordre);
  const recherche = normaliser(filtre ?? '').trim();
  const enRecherche = recherche.length > 0;
  const affiches = enRecherche ? tries.filter((a) => normaliser(a.libelle).includes(recherche)) : tries;
  const nbCoches = tries.filter((a) => estCoche(a.id)).length;

  return (
    <section id={`chap-${chapitre.ordre}`} className="plai-card p-0 overflow-hidden" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal px-3 pt-3">{chapitre.titre}</h2>
      <EnTeteDispositif chapitre={chapitre} {...entete} />
      <div className="p-3">
        <div className="font-medium mb-1">
          {classe.nom} <span className="text-[color:var(--text3)] font-normal">
            — {enRecherche ? `${affiches.length} résultat(s)` : `${nbCoches} coché(s) pour toute la classe`}
          </span>
        </div>
        {tries.length === 0 && <p className="text-sm text-[color:var(--text3)]">Aucun aménagement dans ce dispositif pour l'instant.</p>}
        {enRecherche && tries.length > 0 && affiches.length === 0 && <p className="text-sm text-[color:var(--text3)]">Aucun aménagement ne correspond.</p>}
        <ul className="space-y-1">
          {affiches.map((a) => (
            <li key={a.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={estCoche(a.id)}
                  disabled={!peutRetirer && estCoche(a.id)}
                  title={!peutRetirer && estCoche(a.id) ? "Retrait réservé au référent PLAI, à la direction ou à l'administrateur" : undefined}
                  onChange={(e) => {
                    const actif = e.target.checked;
                    if (!actif && !window.confirm(messageConfirmationRetraitAU(a.libelle))) return;
                    onToggle({ classeId: classe.id, amenagementId: a.id, actif });
                  }} />
                <span>{a.libelle}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `RecapDispositifs.jsx`**

```jsx
import { chapitreEnModeAU } from '../../domain/dispositifs.js';

/** Ligne de rappel en haut de la saisie : mode de chaque dispositif pour la classe courante. */
export default function RecapDispositifs({ dispositifs, modes }) {
  if (!dispositifs.length) return null;
  return (
    <div className="plai-card p-3 text-sm">
      <div className="font-medium mb-1">Dispositifs de cette classe</div>
      <ul className="space-y-0.5">
        {dispositifs.map((ch) => (
          <li key={ch.id}>
            <a href={`#chap-${ch.ordre}`} className="underline text-teal">{ch.titre}</a>
            {' : '}
            <strong>{chapitreEnModeAU(ch, modes) ? 'AU (toute la classe)' : 'AR (par élève)'}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: `ChapitreAR.jsx`**

Ajouter l'import `import EnTeteDispositif from './EnTeteDispositif.jsx';`. Ajouter `dispositif` à la liste des props (`... eleveSurvole, onHoverEleve, dispositif }`). Juste après la fermeture du premier `</tr>` (celui de l'en-tête de chapitre) et avant `{affiche && amenagementsAffiches.map(...)`, insérer :

```jsx
      {dispositif && (
        <tr>
          <td colSpan={totalCols + 1} className="p-0">
            <EnTeteDispositif chapitre={chapitre} {...dispositif} />
          </td>
        </tr>
      )}
```

- [ ] **Step 5: `BandeauAU.jsx` — confirmation au décochage**

Ajouter `import { messageConfirmationRetraitAU } from '../../domain/dispositifs.js';` en tête et remplacer la ligne `onChange={(e) => onToggle({ classeId: classe.id, amenagementId: a.id, actif: e.target.checked })}` par :
```jsx
                onChange={(e) => {
                  const actif = e.target.checked;
                  // Décocher un AU de classe touche tous les enseignants : confirmation expliquant les conséquences.
                  if (!actif && !window.confirm(messageConfirmationRetraitAU(a.libelle))) return;
                  onToggle({ classeId: classe.id, amenagementId: a.id, actif });
                }}
```

- [ ] **Step 6: `SaisieEcole.jsx` — câblage**

Imports à ajouter :
```jsx
import CarteDispositif from '../components/saisie/CarteDispositif.jsx';
import RecapDispositifs from '../components/saisie/RecapDispositifs.jsx';
import { chapitreEnModeAU, bloqueBasculeDispositif } from '../domain/dispositifs.js';
```

Ajouter l'état avec les autres `useState` :
```jsx
  const [blocages, setBlocages] = useState({});
```

Après `const auCat = ...` ajouter :
```jsx
  const dispositifs = chapitres.filter((c) => c.est_dispositif);
  const modesClasse = (grid?.modesDispositifs ?? []).filter((m) => m.classe_id === classeId);
  const enModeAU = (ch) => chapitreEnModeAU(ch, modesClasse);
  const blocageDe = (ch) => blocages[`${classeId}:${ch.id}`] ?? null;
  // Bascule du mode d'un dispositif : refusée (message) si des cases de l'autre mode sont cochées.
  const tenterBascule = (ch, vers) => {
    const msg = bloqueBasculeDispositif({
      vers, chapitreId: ch.id, amenagements: cat?.amenagements ?? [],
      eleveIds: new Set(eleves.map((e) => e.id)),
      selectionsAR: grid.selectionsAR,
      auClasse: grid.auClasse.filter((x) => x.classe_id === classeId),
    });
    setBlocages((b) => ({ ...b, [`${classeId}:${ch.id}`]: msg }));
    if (!msg) mut.basculerDispositif.mutate({ classeId, chapitreId: ch.id, pourToute: vers === 'AU' });
  };
  const enteteDe = (ch) => ({
    mode: enModeAU(ch) ? 'AU' : 'AR',
    peutBasculer: peutEditerStructure,
    blocage: blocageDe(ch),
    onBascule: (vers) => tenterBascule(ch, vers),
  });
```

Insérer le récapitulatif juste avant le bloc `<div className="mb-2">` (champ de recherche) :
```jsx
          <RecapDispositifs dispositifs={dispositifs} modes={modesClasse} />
```

Après `<BandeauAU ... />`, insérer :
```jsx
          {dispositifs.filter(enModeAU).map((ch) => (
            <CarteDispositif key={ch.id} classe={classe} chapitre={ch}
              items={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id)}
              auClasse={grid.auClasse.filter((x) => x.classe_id === classeId)}
              onToggle={(v) => mut.toggleAU.mutate(v)}
              peutRetirer={peutEditerStructure} filtre={recherche} entete={enteteDe(ch)} />
          ))}
```

Dans la grille, remplacer `{chapitres.map((ch) => (` par `{chapitres.filter((ch) => !enModeAU(ch)).map((ch) => (` et ajouter la prop au `<ChapitreAR` (à côté de `eleveSurvole`) :
```jsx
                    dispositif={ch.est_dispositif ? enteteDe(ch) : undefined}
```

Après la ligne d'erreur existante `{mut.toggleAR.isError && ...}`, ajouter :
```jsx
          {mut.basculerDispositif.isError && <p className="plai-error">Changement de mode refusé (droits insuffisants ?), réessayez.</p>}
```

- [ ] **Step 7: Build + tests**

Run: `npx vite build` puis `npx vitest run`
Expected: build OK, tous les tests PASS.

- [ ] **Step 8: Vérification navigateur (flux complet)**

Run: `npm run dev`, ouvrir `http://localhost:5173`, se connecter avec un compte de test référent/admin (JF doit avoir exécuté la migration sur la base ; Claude ne tape pas de mot de passe, JF se connecte). Vérifier :
1. Une classe avec un dispositif ajouté (au moins 2 items créés via Administration) : en-tête du dispositif visible dans la grille, badge « AR · par élève », ligne récapitulative en haut.
2. Cocher un item pour un élève, puis tenter « à toute la classe (AU) » : message de blocage nommant « 1 élève a déjà ».
3. Décocher, basculer en AU : le dispositif quitte la grille, la carte apparaît sous le bloc AU, badge « AU · toute la classe », le lien de la barre de saut (numéro du chapitre) y mène.
4. Cocher un item, ouvrir la fiche classe : bloc au titre exact du dispositif sous les AU. Ouvrir la fiche d'un élève de la classe : bloc présent.
5. Décocher un AU ordinaire puis un item de dispositif : la confirmation s'affiche avec les trois conséquences.
6. Repasser en AR avec un item coché : message de blocage « 1 aménagement … coché ».
7. Compte agent accompagnant : radios désactivées avec la phrase d'explication ; il peut cocher un item AU mais pas le décocher.

- [ ] **Step 9: Commit**

```bash
git add src/components/saisie/ src/pages/SaisieEcole.jsx
git commit -m "feat(dispositifs): saisie par classe (en-tête, carte AU, récap, confirmation de retrait)"
```

---

### Task 10: Administration et catalogue public

**Files:**
- Modify: `src/hooks/useAdmin.js`, `src/pages/Administration.jsx`, `src/pages/CatalogueAmenagements.jsx`, `api/catalogue.js`

- [ ] **Step 1: `useAdmin.js`**

Dans `useCatalogueAdmin`, remplacer `.select('id, ordre, titre, code')` par `.select('id, ordre, titre, code, est_dispositif')`.

Dans `ajouterChapitre`, remplacer la mutation par :
```js
  const ajouterChapitre = useMutation({
    mutationFn: async ({ titre, estDispositif = false }) => {
      const ordre = await prochainOrdreChapitre();
      const { error } = await supabase.from('ar_chapitres').insert({ ordre, titre: titre.trim(), ...(estDispositif ? { est_dispositif: true } : {}) });
      if (error) throw error;
    },
    onSuccess: inval,
  });
```

- [ ] **Step 2: `Administration.jsx` — compte par chapitre**

Remplacer :
```jsx
                <span className="text-sm text-[color:var(--text3)]">
                  ({items.filter((i) => i.type === 'AU').length} AU · {items.filter((i) => i.type === 'AR').length} AR)
                </span>
```
par :
```jsx
                <span className="text-sm text-[color:var(--text3)]">
                  {ch.est_dispositif
                    ? `(dispositif : ${items.length} aménagement(s), AR ou AU selon la classe)`
                    : `(${items.filter((i) => i.type === 'AU').length} AU · ${items.filter((i) => i.type === 'AR').length} AR)`}
                </span>
```

- [ ] **Step 3: `Administration.jsx` — type forcé dans un dispositif**

Remplacer le bloc `<label className="flex items-center gap-1">Type <select ...>...</select></label>` de l'éditeur d'item par :
```jsx
                        {ch.est_dispositif ? (
                          <span className="flex items-center gap-1" title="Le type dépend de la classe : AR par élève, ou AU si le dispositif est passé à toute la classe.">
                            Type <strong>selon la classe (AR ou AU)</strong>
                          </span>
                        ) : (
                          <label className="flex items-center gap-1">
                            Type
                            <select className="plai-input !w-auto !py-1" value={a.type}
                              onChange={(e) => majAmenagement.mutate({ id: a.id, type: e.target.value })}>
                              <option value="AU">AU — universel (classe)</option>
                              <option value="AR">AR — raisonnable (élève)</option>
                            </select>
                          </label>
                        )}
```
Remplacer le `onChange` du select de chapitre de l'item par (déplacer un item vers un dispositif le remet en type AR de base) :
```jsx
                            onChange={(e) => {
                              const cible = chapitres.find((c) => c.id === e.target.value);
                              majAmenagement.mutate({ id: a.id, chapitreId: e.target.value, ...(cible?.est_dispositif ? { type: 'AR' } : {}) });
                            }}>
```
Passer `estDispositif` à l'ajout d'item : remplacer `<AjoutAmenagement chapitreId={ch.id} onAdd={ajouterAmenagement.mutate} />` par :
```jsx
                  <AjoutAmenagement chapitreId={ch.id} estDispositif={ch.est_dispositif === true} onAdd={ajouterAmenagement.mutate} />
```
Dans `AjoutAmenagement`, changer la signature en `function AjoutAmenagement({ chapitreId, estDispositif = false, onAdd })` ; remplacer le bloc `<div className="flex flex-wrap items-center gap-3"> <label htmlFor={`${idp}-type`} ...>...</label> </div>` par :
```jsx
      {estDispositif ? (
        <p className="text-base text-[color:var(--text2)]">Type : <strong>selon la classe</strong> (AR par élève, ou AU si le dispositif est passé à toute la classe pour une classe donnée).</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${idp}-type`} className="flex items-center gap-2">
            Type
            <select id={`${idp}-type`} className="plai-input !w-auto !py-1" style={{ fontSize: 16 }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="AU">AU — universel</option>
              <option value="AR">AR — raisonnable</option>
            </select>
          </label>
        </div>
      )}
```
(`type` reste `'AR'` par défaut dans l'état : un item de dispositif est donc toujours créé en AR.)

- [ ] **Step 4: `Administration.jsx` — création de chapitre dispositif**

Remplacer `AjoutChapitre` par :
```jsx
function AjoutChapitre({ onAdd }) {
  const [titre, setTitre] = useState('');
  const [estDispositif, setEstDispositif] = useState(false);
  return (
    <form className="border border-dashed border-teal rounded p-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); if (titre.trim()) { onAdd({ titre, estDispositif }); setTitre(''); setEstDispositif(false); } }}>
      <label className="text-sm flex-1 min-w-[12rem]">Nouveau chapitre
        <input className="plai-input block w-full" placeholder="Ex. : Dispositif de régulation des comportements"
          value={titre} onChange={(e) => setTitre(e.target.value)} />
        <span className="block text-xs text-[color:var(--text3)] font-normal">
          Ajouté à la fin de la liste (13e chapitre, 14e…). Une fois créé, dépliez-le ci-dessus pour y ajouter des aménagements.
        </span>
      </label>
      <label className="text-sm flex items-start gap-2 w-full">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={estDispositif} onChange={(e) => setEstDispositif(e.target.checked)} />
        <span>
          Ce chapitre est un <strong>dispositif</strong>
          <span className="block text-xs text-[color:var(--text3)] font-normal">
            Ses aménagements sont des AR (par élève) par défaut ; pour chaque classe, une case permet de les passer en AU (toute la classe). Non modifiable après la création.
          </span>
        </span>
      </label>
      <button className="plai-btn" type="submit" disabled={!titre.trim()}>Ajouter le chapitre</button>
    </form>
  );
}
```

- [ ] **Step 5: Catalogue public**

`api/catalogue.js` : remplacer `db.from('ar_chapitres').select('id, ordre, titre')` par `db.from('ar_chapitres').select('id, ordre, titre, est_dispositif')`.

`src/pages/CatalogueAmenagements.jsx` : dans le `chapitres.map`, remplacer le bloc `<section ...>` par :
```jsx
            <section key={ch.id} className="plai-card p-4 space-y-2">
              <h2 className="font-semibold">{ch.titre}</h2>
              {ch.est_dispositif && (
                <p className="text-sm text-[color:var(--text3)]">AU ou AR selon la classe : coché élève par élève, ou une seule fois pour toute la classe.</p>
              )}
              <ul className="space-y-1.5">
                {items.map((a) => (
                  <li key={a.id} className="text-sm flex items-start gap-2">
                    <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${ch.est_dispositif ? 'bg-gray-200 text-gray-700' : a.type === 'AU' ? 'bg-teal/10 text-teal' : 'bg-orange/10 text-orange'}`}>
                      {ch.est_dispositif ? 'Dispositif' : a.type}
                    </span>
                    <span>{a.libelle}</span>
                  </li>
                ))}
              </ul>
            </section>
```

- [ ] **Step 6: Build + tests**

Run: `npx vite build` puis `npx vitest run`
Expected: build OK, tous les tests PASS.

- [ ] **Step 7: Vérification navigateur**

Avec `npm run dev` (admin connecté par JF) : `/administration` → le chapitre « Dispositif de régulation des comportements » indique « dispositif : N aménagement(s) » ; l'ajout d'item n'affiche pas de choix de type ; créer 2 items de test, noter si un code stable est généré (colonne Code). `/catalogue-amenagements` : badge « Dispositif » et phrase d'explication.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAdmin.js src/pages/Administration.jsx src/pages/CatalogueAmenagements.jsx api/catalogue.js
git commit -m "feat(dispositifs): administration (création/type forcé) et badge du catalogue public"
```

---

### Task 11: Vérification globale et mise en production

- [ ] **Step 1: Suite complète et build**

Run: `npx vitest run` puis `npx vite build`
Expected: tous les tests PASS ; build sans erreur (règle absolue avant tout push).

- [ ] **Step 2: Revue finale holistique**

Dispatcher une revue globale du diff complet (superpowers:requesting-code-review), pas seulement tâche par tâche. Points à vérifier explicitement :
1. Tout chargeur ou hook qui lit `ar_chapitres` pour une projection inclut `est_dispositif` (sinon un dispositif reste en mode AR silencieusement).
2. Tout endroit qui appelle `computeFicheClasse`, `computeFicheEleve`, `buildSnapshot`, `computeProfilDiffActif`, `computeProfilClasse` reçoit `modesDispositifs` (chargeur, `useFicheEleve`, API de liens et de profil).
3. Les consommateurs de `type === 'AU'/'AR'` restants (`SaisieEcole`, `BandeauAU`, `Administration`, `CatalogueAmenagements`, `TransmissionProfil`) se comportent bien avec un chapitre dispositif.
4. Cohérence des noms : `modesDispositifs` (entrées des projections), `dispositifsClasse` (VM), `pour_toute_la_classe` (colonne).

- [ ] **Step 3: Actions de JF avant le push**

1. Exécuter `supabase/migrations/20261002_amenagactif_dispositifs.sql` dans le SQL Editor Supabase, puis la requête de vérification en pied de fichier.
2. Après le merge dans `main` et le déploiement : ajouter les items du premier dispositif via `/administration`, vérifier la présence d'un code stable pour chaque item (nécessaire à la transmission DiffActif ; les items sans code apparaissent dans `non_codes`), tester sur une classe réelle.

- [ ] **Step 4: Merge et push (seulement sur accord explicite de JF, migration exécutée)**

```bash
git push origin main
```
Branche Vercel = `main`. Vérifier ensuite le déploiement et une fiche enseignante par lien.
