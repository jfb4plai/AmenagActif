# Numéro FASE sur les fiches, statut IPT/PAR affiché Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le nom d'école + numéro FASE en en-tête de la fiche élève et de la fiche école complète, afficher le statut IPT/PAR à côté du nom de l'élève sur ces deux fiches (jamais sur la fiche classe/enseignant ni la fiche publique), et permettre à l'admin d'éditer un nom d'implantation FASE distinct du nom d'école.

**Architecture:** `FicheClasseView` (composant partagé entre fiche classe/enseignant et fiche école) reçoit une nouvelle prop optionnelle `showStatutEleve` (défaut `false`) — seule `FicheEcolePage` l'active. Le statut est toujours calculé dans les projections (`computeFicheClasse`/`computeFicheEleve`), c'est l'affichage qui est conditionnel. `ar_ecoles.implantation` devient sémantiquement le numéro FASE (aucun changement de schéma) ; nouvelle colonne `implantation_nom` pour son nom.

**Tech Stack:** React 18, `@tanstack/react-query` v5, Supabase, Vitest.

**Référence :** [docs/superpowers/specs/2026-09-22-amenagactif-fase-ipt-fiches-design.md](../specs/2026-09-22-amenagactif-fase-ipt-fiches-design.md)

---

### Task 1: Migration — colonne `implantation_nom`

**Files:**
- Create: `supabase/migrations/20260922e_amenagactif_implantation_nom.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- AménagActif — nom de l'implantation FASE (distinct du nom d'école/établissement).
-- ar_ecoles.implantation (déjà existant) devient sémantiquement le numéro FASE ;
-- aucun changement de type ni de contrainte sur cette colonne.

begin;

alter table ar_ecoles add column if not exists implantation_nom text;

commit;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260922e_amenagactif_implantation_nom.sql
git commit -m "feat(db): ajoute ar_ecoles.implantation_nom"
```

Note : comme les autres migrations de ce projet, JF doit l'exécuter manuellement dans le SQL Editor Supabase (projet `dfoaumjleqtxjeaplnna`) — aucune exécution automatique.

---

### Task 2: Fixtures — statut IPT/PAR par élève

**Files:**
- Modify: `src/test/fixtures/sample.js:16-20`

- [ ] **Step 1: Ajouter `statut` aux 3 élèves de test**

Code actuel :

```js
export const eleves = [
  { id: 'e1', classe_id: 'cl-5la', prenom: 'Emilie', initiale_nom: 'D', commentaire: '', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e2', classe_id: 'cl-5la', prenom: 'Karim', initiale_nom: 'B', commentaire: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e3', classe_id: 'cl-5la', prenom: 'Lea', initiale_nom: 'M', commentaire: '', created_at: '2026-08-21T08:00:00Z' },
];
```

Remplacer par :

```js
export const eleves = [
  { id: 'e1', classe_id: 'cl-5la', prenom: 'Emilie', initiale_nom: 'D', commentaire: '', statut: 'PAR', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e2', classe_id: 'cl-5la', prenom: 'Karim', initiale_nom: 'B', commentaire: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle', statut: 'IPT', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e3', classe_id: 'cl-5la', prenom: 'Lea', initiale_nom: 'M', commentaire: '', statut: 'PAR', created_at: '2026-08-21T08:00:00Z' },
];
```

- [ ] **Step 2: Ajouter numéro FASE au contexte de test**

Code actuel (dernière ligne du fichier) :

```js
export const contexte = { classeNom: '5LA', ecoleNom: 'Athénée X', anneeLibelle: '2025-2026' };
```

Remplacer par :

```js
export const contexte = { classeNom: '5LA', ecoleNom: 'Athénée X', anneeLibelle: '2025-2026', ecoleFase: '482' };
```

- [ ] **Step 3: Lancer la suite de tests pour confirmer la casse attendue**

Run: `npm test`
Expected: FAIL — `computeFicheClasse` : les tests `commentaires` et `parAmenagement` échouent (comparaison stricte `toEqual`, le nouveau champ `statut` n'est pas encore produit par la fonction, donc les fixtures elles-mêmes n'introduisent pas encore d'écart à ce stade ; l'échec apparaîtra au Task 3 une fois la fonction modifiée). Pour l'instant cette étape doit rester **PASS** (les fixtures ajoutent seulement des champs que les fonctions actuelles ignorent).

- [ ] **Step 4: Commit**

```bash
git add src/test/fixtures/sample.js
git commit -m "test: ajoute statut IPT/PAR et numéro FASE aux fixtures"
```

---

### Task 3: `computeFicheClasse` — propager le statut IPT/PAR

**Files:**
- Modify: `src/domain/projections/ficheClasse.js:38-40,66-82`
- Modify: `tests/domain/ficheClasse.test.js:91-123`

- [ ] **Step 1: Mettre à jour les tests existants qui vérifient la forme exacte des objets élève**

Dans `tests/domain/ficheClasse.test.js`, remplacer le test `commentaires` (lignes 91-96) :

```js
  it('commentaires : un élève avec commentaire non vide, les autres omis', () => {
    const vm = computeFicheClasse(args());
    expect(vm.commentaires).toEqual([
      { eleve: 'Karim B.', texte: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle' },
    ]);
  });
```

par :

```js
  it('commentaires : un élève avec commentaire non vide, les autres omis', () => {
    const vm = computeFicheClasse(args());
    expect(vm.commentaires).toEqual([
      { eleve: 'Karim B.', statut: 'IPT', texte: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle' },
    ]);
  });
```

Remplacer le test `parAmenagement : une ligne par AR/libre...` (lignes 98-107), l'assertion `doubler.eleves` :

```js
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual([{ nom: 'Emilie D.', eleveId: 'e1' }]);
```

par :

```js
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual([{ nom: 'Emilie D.', eleveId: 'e1', statut: 'PAR' }]);
```

Remplacer le test `parAmenagement : un même AR partagé par deux élèves...` (lignes 115-123) :

```js
  it('parAmenagement : un même AR partagé par deux élèves liste les deux noms', () => {
    const selectionsAR = [...args().selectionsAR, { eleve_id: 'e3', amenagement_id: 'a-ar1', cree_le: '2026-09-03T08:00:00Z' }];
    const vm = computeFicheClasse({ ...args(), selectionsAR });
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual([
      { nom: 'Emilie D.', eleveId: 'e1' },
      { nom: 'Lea M.', eleveId: 'e3' },
    ]);
  });
```

par :

```js
  it('parAmenagement : un même AR partagé par deux élèves liste les deux noms', () => {
    const selectionsAR = [...args().selectionsAR, { eleve_id: 'e3', amenagement_id: 'a-ar1', cree_le: '2026-09-03T08:00:00Z' }];
    const vm = computeFicheClasse({ ...args(), selectionsAR });
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual([
      { nom: 'Emilie D.', eleveId: 'e1', statut: 'PAR' },
      { nom: 'Lea M.', eleveId: 'e3', statut: 'PAR' },
    ]);
  });
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent désormais**

Run: `npm test`
Expected: FAIL — les 3 assertions ci-dessus échouent (`computeFicheClasse` ne produit pas encore `statut`).

- [ ] **Step 3: Propager `statut` dans `computeFicheClasse`**

Dans `src/domain/projections/ficheClasse.js`, remplacer (lignes 38-40) :

```js
  const commentaires = eleves
    .filter((e) => (e.commentaire ?? '').trim())
    .map((e) => ({ eleve: nomEleve(e), texte: e.commentaire.trim() }));
```

par :

```js
  const commentaires = eleves
    .filter((e) => (e.commentaire ?? '').trim())
    .map((e) => ({ eleve: nomEleve(e), statut: e.statut, texte: e.commentaire.trim() }));
```

Remplacer (lignes 66-69) :

```js
  const parAmenagementMap = new Map();
  const ajouterEleveAAmenagement = (libelle, chapOrdreVal, ordreVal, nom, eleveId) => {
    if (!parAmenagementMap.has(libelle)) parAmenagementMap.set(libelle, { chapOrdreVal, ordreVal, eleves: [] });
    parAmenagementMap.get(libelle).eleves.push({ nom, eleveId });
  };
```

par :

```js
  const parAmenagementMap = new Map();
  const ajouterEleveAAmenagement = (libelle, chapOrdreVal, ordreVal, nom, eleveId, statut) => {
    if (!parAmenagementMap.has(libelle)) parAmenagementMap.set(libelle, { chapOrdreVal, ordreVal, eleves: [] });
    parAmenagementMap.get(libelle).eleves.push({ nom, eleveId, statut });
  };
```

Remplacer (ligne 74) :

```js
    for (const a of amgts) ajouterEleveAAmenagement(a.libelle, chapOrdre(a), a.ordre, nomEleve(e), e.id);
```

par :

```js
    for (const a of amgts) ajouterEleveAAmenagement(a.libelle, chapOrdre(a), a.ordre, nomEleve(e), e.id, e.statut);
```

Remplacer (ligne 82) :

```js
    ajouterEleveAAmenagement(l.texte, Infinity, Infinity, nomEleve(e), e.id);
```

par :

```js
    ajouterEleveAAmenagement(l.texte, Infinity, Infinity, nomEleve(e), e.id, e.statut);
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS — tous les tests de `ficheClasse.test.js` passent.

- [ ] **Step 5: Commit**

```bash
git add src/domain/projections/ficheClasse.js tests/domain/ficheClasse.test.js
git commit -m "feat: propage le statut IPT/PAR dans computeFicheClasse"
```

---

### Task 4: `computeFicheEleve` — école, numéro FASE, statut

**Files:**
- Modify: `src/domain/projections/ficheEleve.js:12-17,45`
- Modify: `tests/domain/ficheEleve.test.js:5-12`

- [ ] **Step 1: Étendre `args()` dans le test et ajouter une assertion (échoue pour l'instant)**

Dans `tests/domain/ficheEleve.test.js`, remplacer (lignes 5-12) :

```js
const args = (eleveId) => ({
  eleve: f.eleves.find((e) => e.id === eleveId),
  classeNom: '5LA',
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
});
```

par :

```js
const args = (eleveId) => ({
  eleve: f.eleves.find((e) => e.id === eleveId),
  classeNom: '5LA',
  ecoleNom: f.contexte.ecoleNom,
  ecoleFase: f.contexte.ecoleFase,
  amenagements: f.amenagements,
  chapitres: f.chapitres,
  selectionsAR: f.selectionsAR,
  libres: f.libres,
});
```

Ajouter un nouveau test juste avant la fermeture du `describe` (après le test `expose le commentaire`, ligne 39) :

```js

  it('expose le nom de l\'école, le numéro FASE et le statut IPT/PAR de l\'élève', () => {
    const vm = computeFicheEleve(args('e1'));
    expect(vm.ecoleNom).toBe('Athénée X');
    expect(vm.ecoleFase).toBe('482');
    expect(vm.statut).toBe('PAR');
  });
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npm test`
Expected: FAIL — `vm.ecoleNom`/`vm.ecoleFase`/`vm.statut` sont `undefined`.

- [ ] **Step 3: Implémenter dans `computeFicheEleve`**

Dans `src/domain/projections/ficheEleve.js`, remplacer (lignes 12-13) :

```js
export function computeFicheEleve(input) {
  const { eleve, classeNom, amenagements, chapitres, selectionsAR, libres } = input;
```

par :

```js
export function computeFicheEleve(input) {
  const { eleve, classeNom, ecoleNom, ecoleFase, amenagements, chapitres, selectionsAR, libres } = input;
```

Remplacer la ligne de retour (ligne 45) :

```js
  return { eleve: nomEleve, classeNom, parChapitre, commentaire: (eleve.commentaire ?? '').trim() };
```

par :

```js
  return { eleve: nomEleve, classeNom, ecoleNom, ecoleFase, statut: eleve.statut, parChapitre, commentaire: (eleve.commentaire ?? '').trim() };
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test`
Expected: PASS — tous les tests de `ficheEleve.test.js` passent.

- [ ] **Step 5: Commit**

```bash
git add src/domain/projections/ficheEleve.js tests/domain/ficheEleve.test.js
git commit -m "feat: expose école, numéro FASE et statut dans computeFicheEleve"
```

---

### Task 5: `useFicheEleve` — charger école, FASE et statut depuis Supabase

**Files:**
- Modify: `src/hooks/useFicheEleve.js:6-22`

- [ ] **Step 1: Étendre la requête et le mapping vers `computeFicheEleve`**

Code actuel :

```js
async function charger(eleveId) {
  const { data: eleve, error } = await supabase
    .from('ar_eleves').select('id, prenom, initiale_nom, commentaire, classe_id, ar_classes(nom)').eq('id', eleveId).single();
  if (error) throw error;
  const [cat, chap, sel, lib] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_selections').select('eleve_id, amenagement_id').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').eq('eleve_id', eleveId),
  ]);
  return computeFicheEleve({
    eleve,
    classeNom: eleve.ar_classes?.nom ?? '',
    amenagements: cat.data,
    chapitres: chap.data,
    selectionsAR: sel.data,
    libres: lib.data,
  });
}
```

Remplacer par :

```js
async function charger(eleveId) {
  const { data: eleve, error } = await supabase
    .from('ar_eleves')
    .select('id, prenom, initiale_nom, commentaire, statut, classe_id, ar_classes(nom, ar_ecoles(nom, implantation))')
    .eq('id', eleveId).single();
  if (error) throw error;
  const [cat, chap, sel, lib] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_selections').select('eleve_id, amenagement_id').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').eq('eleve_id', eleveId),
  ]);
  return computeFicheEleve({
    eleve,
    classeNom: eleve.ar_classes?.nom ?? '',
    ecoleNom: eleve.ar_classes?.ar_ecoles?.nom ?? '',
    ecoleFase: eleve.ar_classes?.ar_ecoles?.implantation ?? '',
    amenagements: cat.data,
    chapitres: chap.data,
    selectionsAR: sel.data,
    libres: lib.data,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFicheEleve.js
git commit -m "feat: useFicheEleve charge école, numéro FASE et statut"
```

---

### Task 6: `FicheEleveView` — en-tête école/FASE + badge statut

**Files:**
- Modify: `src/components/fiche/FicheEleveView.jsx`

- [ ] **Step 1: Ajouter l'en-tête et le badge**

Code actuel :

```jsx
/** @param {{ vm: import('../../domain/types.js').FicheEleveVM }} props */
export default function FicheEleveView({ vm }) {
  return (
    <article className="max-w-3xl mx-auto bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
      </header>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">
        Aménagements — {vm.eleve} ({vm.classeNom})
      </h1>
```

Remplacer par :

```jsx
/** @param {{ vm: import('../../domain/types.js').FicheEleveVM }} props */
export default function FicheEleveView({ vm }) {
  return (
    <article className="max-w-3xl mx-auto bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
      </header>
      <p className="text-sm text-gray-600 mb-2">{vm.ecoleNom} · FASE {vm.ecoleFase || '—'}</p>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">
        Aménagements — {vm.eleve}{' '}
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white border border-gray-400 align-middle">{vm.statut}</span>
        {' '}({vm.classeNom})
      </h1>
```

(Le reste du fichier, à partir de `{vm.parChapitre.length === 0 && ...}`, est inchangé.)

- [ ] **Step 2: Commit**

```bash
git add src/components/fiche/FicheEleveView.jsx
git commit -m "feat: en-tête école/FASE + badge statut sur la fiche élève"
```

---

### Task 7: `FicheClasseView` — prop `showStatutEleve`

**Files:**
- Modify: `src/components/fiche/FicheClasseView.jsx`

- [ ] **Step 1: Ajouter la prop et le badge conditionnel dans les deux tableaux concernés**

Code actuel (signature, ligne 1-2) :

```jsx
/** @param {{ vm: import('../../domain/types.js').FicheClasseVM }} props */
export default function FicheClasseView({ vm }) {
```

Remplacer par :

```jsx
/** @param {{ vm: import('../../domain/types.js').FicheClasseVM, showStatutEleve?: boolean }} props */
export default function FicheClasseView({ vm, showStatutEleve = false }) {
```

Code actuel (tableau "AR spécifiques à un élève", lignes 39-44) :

```jsx
              <td className="border border-black p-2">
                <ul className="list-disc pl-5">
                  {row.eleves.map((e, i) => (
                    <li key={i}><a className="text-teal underline" href={`/eleve/${e.eleveId}/fiche`}>{e.nom}</a></li>
                  ))}
                </ul>
              </td>
```

Remplacer par :

```jsx
              <td className="border border-black p-2">
                <ul className="list-disc pl-5">
                  {row.eleves.map((e, i) => (
                    <li key={i}>
                      <a className="text-teal underline" href={`/eleve/${e.eleveId}/fiche`}>{e.nom}</a>
                      {showStatutEleve && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 ml-1">{e.statut}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </td>
```

Code actuel (tableau "Commentaires", lignes 63-67) :

```jsx
                <tr key={i}>
                  <td className="border border-black p-2 align-top w-32 font-medium">{c.eleve}</td>
                  <td className="border border-black p-2">{c.texte}</td>
                </tr>
```

Remplacer par :

```jsx
                <tr key={i}>
                  <td className="border border-black p-2 align-top w-32 font-medium">
                    {c.eleve}
                    {showStatutEleve && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 ml-1">{c.statut}</span>
                    )}
                  </td>
                  <td className="border border-black p-2">{c.texte}</td>
                </tr>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/fiche/FicheClasseView.jsx
git commit -m "feat: FicheClasseView accepte showStatutEleve (badge IPT/PAR optionnel)"
```

---

### Task 8: `FicheEcolePage` — en-tête école/FASE + activer le badge statut

**Files:**
- Modify: `src/pages/FicheEcolePage.jsx`

- [ ] **Step 1: Passer `showStatutEleve` à `FicheUneClasse`/`FicheClasseView` et ajouter l'en-tête**

Code actuel (lignes 8-13) :

```jsx
function FicheUneClasse({ classeId }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <p>Chargement de la classe…</p>;
  if (error) return <p className="plai-error">{error.message}</p>;
  return <FicheClasseView vm={vm} />;
}
```

Remplacer par :

```jsx
function FicheUneClasse({ classeId, showStatutEleve }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <p>Chargement de la classe…</p>;
  if (error) return <p className="plai-error">{error.message}</p>;
  return <FicheClasseView vm={vm} showStatutEleve={showStatutEleve} />;
}
```

Code actuel (dernière ligne du rendu, ligne 53) :

```jsx
      {ecoleActive && anneeActive && classes.map((c) => <FicheUneClasse key={c.id} classeId={c.id} />)}
```

Remplacer par :

```jsx
      {ecoleActive && anneeActive && (() => {
        const ecole = ecoles.find((x) => x.id === ecoleActive);
        return ecole ? <p className="font-semibold mb-2">{ecole.nom} · FASE {ecole.implantation || '—'}</p> : null;
      })()}
      {ecoleActive && anneeActive && classes.map((c) => <FicheUneClasse key={c.id} classeId={c.id} showStatutEleve />)}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/FicheEcolePage.jsx
git commit -m "feat: en-tête école/FASE et badge statut sur la fiche école complète"
```

---

### Task 9: JSDoc — `types.js`

**Files:**
- Modify: `src/domain/types.js`

- [ ] **Step 1: Mettre à jour les typedefs touchés**

Code actuel (Eleve, lignes 14-19) :

```js
 * @typedef {Object} Eleve
 * @property {string} id
 * @property {string} classe_id
 * @property {string} prenom
 * @property {string} initiale_nom
 * @property {string} [commentaire]
```

Remplacer par :

```js
 * @typedef {Object} Eleve
 * @property {string} id
 * @property {string} classe_id
 * @property {string} prenom
 * @property {string} initiale_nom
 * @property {string} [commentaire]
 * @property {'IPT'|'PAR'} statut
```

Code actuel (FicheClasseVM, lignes 51-53) :

```js
 * @property {{ eleve: string, eleveId: string, amenagements: string[] }[]} parEleve
 * @property {{ libelle: string, eleves: { nom: string, eleveId: string }[] }[]} parAmenagement
 * @property {{ eleve: string, texte: string }[]} commentaires
```

Remplacer par :

```js
 * @property {{ eleve: string, eleveId: string, amenagements: string[] }[]} parEleve
 * @property {{ libelle: string, eleves: { nom: string, eleveId: string, statut: string }[] }[]} parAmenagement
 * @property {{ eleve: string, statut: string, texte: string }[]} commentaires
```

Code actuel (FicheEleveVM, lignes 56-60) :

```js
 * @typedef {Object} FicheEleveVM
 * @property {string} eleve
 * @property {string} classeNom
 * @property {{ chapitreTitre: string, amenagements: string[] }[]} parChapitre
 * @property {string} commentaire
```

Remplacer par :

```js
 * @typedef {Object} FicheEleveVM
 * @property {string} eleve
 * @property {string} classeNom
 * @property {string} ecoleNom
 * @property {string} ecoleFase
 * @property {string} statut
 * @property {{ chapitreTitre: string, amenagements: string[] }[]} parChapitre
 * @property {string} commentaire
```

- [ ] **Step 2: Commit**

```bash
git add src/domain/types.js
git commit -m "docs: met à jour les typedefs FASE/statut"
```

---

### Task 10: Admin — champ "Nom de l'implantation (FASE)"

**Files:**
- Modify: `src/hooks/useEcoleGrid.js:16-25`
- Modify: `src/hooks/useAdmin.js:39-57`
- Modify: `src/pages/Administration.jsx:294-352`

- [ ] **Step 1: `useEcolesAdmin` sélectionne `implantation_nom`**

Code actuel :

```js
export function useEcolesAdmin() {
  return useQuery({
    queryKey: ['ecoles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_ecoles').select('id, nom, implantation, actif').order('nom');
      if (error) throw error;
      return data;
    },
  });
}
```

Remplacer par :

```js
export function useEcolesAdmin() {
  return useQuery({
    queryKey: ['ecoles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_ecoles').select('id, nom, implantation, implantation_nom, actif').order('nom');
      if (error) throw error;
      return data;
    },
  });
}
```

- [ ] **Step 2: `ajouterEcole` et `majEcole` acceptent `implantationNom`**

Code actuel (`useAdmin.js`, lignes 39-57) :

```js
  const ajouterEcole = useMutation({
    mutationFn: async ({ nom, implantation }) => {
      const { error } = await supabase.from('ar_ecoles').insert({ nom: nom.trim(), implantation: implantation?.trim() || null });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const majEcole = useMutation({
    mutationFn: async ({ id, nom, implantation, actif }) => {
      const patch = {};
      if (nom !== undefined) patch.nom = nom.trim();
      if (implantation !== undefined) patch.implantation = implantation?.trim() || null;
      if (actif !== undefined) patch.actif = actif;
      const { error } = await supabase.from('ar_ecoles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });
```

Remplacer par :

```js
  const ajouterEcole = useMutation({
    mutationFn: async ({ nom, implantation, implantationNom }) => {
      const { error } = await supabase.from('ar_ecoles').insert({
        nom: nom.trim(),
        implantation: implantation?.trim() || null,
        implantation_nom: implantationNom?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const majEcole = useMutation({
    mutationFn: async ({ id, nom, implantation, implantationNom, actif }) => {
      const patch = {};
      if (nom !== undefined) patch.nom = nom.trim();
      if (implantation !== undefined) patch.implantation = implantation?.trim() || null;
      if (implantationNom !== undefined) patch.implantation_nom = implantationNom?.trim() || null;
      if (actif !== undefined) patch.actif = actif;
      const { error } = await supabase.from('ar_ecoles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });
```

- [ ] **Step 3: `SectionEcoles` — relabel + nouveau champ**

Code actuel (`Administration.jsx`, lignes 294-352) :

```jsx
/* ─────────────── Écoles / implantations ─────────────── */
function SectionEcoles() {
  const { data: ecoles = [] } = useEcolesAdmin();
  const { ajouterEcole, majEcole } = useAdminMutations();
  const [f, setF] = useState({ nom: '', implantation: '' });

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Écoles / implantations</h2>
      <p className="text-sm text-[color:var(--text3)]">Les 11 implantations secondaires accompagnées. Désactiver une école la retire des sélecteurs (saisie, fiches) sans supprimer ses données ; réactivable à tout moment ci-dessous.</p>
      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(e) => { e.preventDefault(); if (f.nom.trim()) { ajouterEcole.mutate(f); setF({ nom: '', implantation: '' }); } }}
      >
        <label className="text-sm">Nom
          <input className="plai-input block" placeholder="Athénée Léonie de Waha" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })}
            list="ecoles-existantes" autoComplete="off" />
          <datalist id="ecoles-existantes">
            {ecoles.map((e) => <option key={e.id} value={e.nom} />)}
          </datalist>
        </label>
        <label className="text-sm">Implantation (code court)
          <input className="plai-input block" placeholder="waha" value={f.implantation} onChange={(e) => setF({ ...f, implantation: e.target.value })} />
        </label>
        <button className="plai-btn" type="submit" disabled={!f.nom.trim()}>Ajouter</button>
        {f.nom.trim().length >= 3 && ecoles.some((e) => e.nom.toLowerCase().includes(f.nom.trim().toLowerCase())) && (
          <p className="text-xs text-amber-700 w-full">
            Attention : une école au nom proche existe peut-être déjà dans la liste ci-dessous — vérifiez avant d'ajouter un doublon.
          </p>
        )}
      </form>
      <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
        {ecoles.map((e) => (
          <li key={e.id} className={`flex items-center justify-between px-3 py-2 gap-3 ${e.actif ? '' : 'bg-[color:var(--border)]/30'}`}>
            <input
              className="plai-input flex-1"
              defaultValue={e.nom}
              onBlur={(ev) => { if (ev.target.value.trim() && ev.target.value !== e.nom) majEcole.mutate({ id: e.id, nom: ev.target.value }); }}
            />
            <input
              className="plai-input w-32"
              defaultValue={e.implantation ?? ''}
              placeholder="code"
              onBlur={(ev) => { if ((ev.target.value || null) !== (e.implantation ?? null)) majEcole.mutate({ id: e.id, implantation: ev.target.value }); }}
            />
            <span className={`text-xs px-2 py-0.5 rounded-full ${e.actif ? 'bg-teal/10 text-teal' : 'bg-[color:var(--border)] text-[color:var(--text3)]'}`}>
              {e.actif ? 'active' : 'désactivée'}
            </span>
            {e.actif ? (
              <button className="text-sm underline" onClick={() => majEcole.mutate({ id: e.id, actif: false })}>désactiver</button>
            ) : (
              <button className="text-sm underline text-teal" onClick={() => majEcole.mutate({ id: e.id, actif: true })}>réactiver</button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[color:var(--text3)]">Cette liste montre toutes les écoles, actives et désactivées.</p>
    </section>
  );
}
```

Remplacer par :

```jsx
/* ─────────────── Écoles / implantations ─────────────── */
function SectionEcoles() {
  const { data: ecoles = [] } = useEcolesAdmin();
  const { ajouterEcole, majEcole } = useAdminMutations();
  const [f, setF] = useState({ nom: '', implantation: '', implantationNom: '' });

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Écoles / implantations</h2>
      <p className="text-sm text-[color:var(--text3)]">Les 11 implantations secondaires accompagnées. Désactiver une école la retire des sélecteurs (saisie, fiches) sans supprimer ses données ; réactivable à tout moment ci-dessous.</p>
      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(e) => { e.preventDefault(); if (f.nom.trim()) { ajouterEcole.mutate(f); setF({ nom: '', implantation: '', implantationNom: '' }); } }}
      >
        <label className="text-sm">Nom
          <input className="plai-input block" placeholder="Athénée Léonie de Waha" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })}
            list="ecoles-existantes" autoComplete="off" />
          <datalist id="ecoles-existantes">
            {ecoles.map((e) => <option key={e.id} value={e.nom} />)}
          </datalist>
        </label>
        <label className="text-sm">Numéro FASE
          <input className="plai-input block" placeholder="12345" value={f.implantation} onChange={(e) => setF({ ...f, implantation: e.target.value })} />
        </label>
        <label className="text-sm">Nom de l'implantation (FASE)
          <input className="plai-input block" placeholder="Waha - secondaire" value={f.implantationNom} onChange={(e) => setF({ ...f, implantationNom: e.target.value })} />
        </label>
        <button className="plai-btn" type="submit" disabled={!f.nom.trim()}>Ajouter</button>
        {f.nom.trim().length >= 3 && ecoles.some((e) => e.nom.toLowerCase().includes(f.nom.trim().toLowerCase())) && (
          <p className="text-xs text-amber-700 w-full">
            Attention : une école au nom proche existe peut-être déjà dans la liste ci-dessous — vérifiez avant d'ajouter un doublon.
          </p>
        )}
      </form>
      <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
        {ecoles.map((e) => (
          <li key={e.id} className={`flex items-center justify-between px-3 py-2 gap-3 ${e.actif ? '' : 'bg-[color:var(--border)]/30'}`}>
            <input
              className="plai-input flex-1"
              defaultValue={e.nom}
              onBlur={(ev) => { if (ev.target.value.trim() && ev.target.value !== e.nom) majEcole.mutate({ id: e.id, nom: ev.target.value }); }}
            />
            <input
              className="plai-input w-28"
              defaultValue={e.implantation ?? ''}
              placeholder="Numéro FASE"
              onBlur={(ev) => { if ((ev.target.value || null) !== (e.implantation ?? null)) majEcole.mutate({ id: e.id, implantation: ev.target.value }); }}
            />
            <input
              className="plai-input w-44"
              defaultValue={e.implantation_nom ?? ''}
              placeholder="Nom implantation"
              onBlur={(ev) => { if ((ev.target.value || null) !== (e.implantation_nom ?? null)) majEcole.mutate({ id: e.id, implantationNom: ev.target.value }); }}
            />
            <span className={`text-xs px-2 py-0.5 rounded-full ${e.actif ? 'bg-teal/10 text-teal' : 'bg-[color:var(--border)] text-[color:var(--text3)]'}`}>
              {e.actif ? 'active' : 'désactivée'}
            </span>
            {e.actif ? (
              <button className="text-sm underline" onClick={() => majEcole.mutate({ id: e.id, actif: false })}>désactiver</button>
            ) : (
              <button className="text-sm underline text-teal" onClick={() => majEcole.mutate({ id: e.id, actif: true })}>réactiver</button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-[color:var(--text3)]">Cette liste montre toutes les écoles, actives et désactivées.</p>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useEcoleGrid.js src/hooks/useAdmin.js src/pages/Administration.jsx
git commit -m "feat: champ nom de l'implantation FASE, éditable en admin"
```

---

### Task 11: Vérification finale

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Suite de tests complète**

Run: `npm test`
Expected: tous les tests passent (aucune régression sur `ficheClasse.test.js`, `ficheEleve.test.js`, et le reste de la suite).

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: build sans erreur (règle absolue du projet avant tout push).

- [ ] **Step 3: Vérification manuelle par JF (Claude ne peut pas se connecter avec un mot de passe)**

Lancer le serveur de dev (`npm run dev`, ou la config `amenagactif` de `.claude/launch.json`), se connecter en tant qu'admin/référent, et vérifier :
1. `/administration` → section "Écoles / implantations" : le champ "Implantation (code court)" s'appelle maintenant "Numéro FASE", et un nouveau champ "Nom de l'implantation (FASE)" apparaît sur chaque ligne et dans le formulaire d'ajout — saisir une valeur, quitter le champ, recharger la page, vérifier qu'elle est conservée.
2. Ouvrir la fiche d'un élève (`/eleve/:id/fiche`) : une ligne "École · FASE ..." apparaît sous le logo, et un badge IPT ou PAR apparaît à côté du nom de l'élève dans le titre.
3. Ouvrir la fiche école complète (`/fiches/ecole`) : une ligne "École · FASE ..." apparaît une seule fois en haut de page (pas répétée par classe), et un badge IPT/PAR apparaît à côté de chaque nom d'élève dans les tableaux "AR spécifiques à un élève" et "Commentaires".
4. Ouvrir la fiche classe/enseignant (`/classe/:id/fiche`, ou le lien enseignant `/fiche/:token`) : **aucun** changement — pas de ligne FASE, pas de badge de statut.

---

## Note opérationnelle (JF) — correctif accès admin

Hors code, à exécuter par JF dans le SQL Editor Supabase (projet `dfoaumjleqtxjeaplnna`), indépendamment des tâches ci-dessus.

Diagnostic :

```sql
select u.id, u.email, p.role, p.ecole_id
from auth.users u
left join ar_profils_acces p on p.user_id = u.id
where u.email in ('jeanfrancois.beguin@ens.ecl.be', 'jf.beguin@outlook.com');
```

Selon le résultat :
- `jeanfrancois.beguin@ens.ecl.be` a un `id` dans `auth.users` mais aucune ligne `ar_profils_acces` (role `null`) → exécuter :
  ```sql
  insert into ar_profils_acces (user_id, role, ecole_id) values ('<uuid ci-dessus>', 'admin', null);
  ```
- `jeanfrancois.beguin@ens.ecl.be` n'existe pas du tout dans `auth.users` → JF doit d'abord créer ce compte (inscription normale sur `/connexion` ou invitation depuis `/administration` avec un autre compte admin), puis relancer le diagnostic.

## Self-Review

- **Couverture spec** : les 4 points de la spec sont couverts — Task 1/10 (modèle FASE + admin), Task 2-6 (fiche élève), Task 2-3,7-8 (fiche école + statut, composant partagé non modifié pour la fiche classe/publique), note opérationnelle (accès admin).
- **Pas de placeholder** : code exact à chaque étape, y compris les tests mis à jour/ajoutés.
- **Cohérence des types** : `showStatutEleve` (booléen, même nom) utilisé de façon identique dans `FicheClasseView` (Task 7) et `FicheEcolePage` (Task 8) ; `implantationNom` (camelCase, mutation) mappé vers `implantation_nom` (colonne) de façon cohérente dans `useAdmin.js` (Task 10) ; `ecoleFase`/`ecoleNom` introduits par Task 4 (projection) et consommés tels quels par Task 5 (hook) et Task 6 (vue) sans renommage.
- **Ordre TDD respecté** : Task 3 et Task 4 modifient les tests puis vérifient l'échec avant d'implémenter ; les tâches purement UI (5, 6, 7, 8, 10) n'ont pas de test automatisé dans ce projet (aucun test de composant existant) — vérification manuelle en Task 11, conforme au pattern déjà établi dans ce dépôt.
