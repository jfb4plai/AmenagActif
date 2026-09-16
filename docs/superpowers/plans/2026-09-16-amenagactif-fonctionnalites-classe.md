# AménagActif — Fonctionnalités classe (commentaire, direction par niveau, flux de saisie, fiche inversée)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémente les 7 demandes validées avec Jean-François (2026-09-16) : grammaire des compteurs, commentaire libre par élève, comptes direction scopés par niveau, libellé/aide du champ référent PLAI, restructuration de la saisie en flux séquentiel par classe, et inversion du tableau AR sur la fiche enseignant.

**Architecture:** Deux colonnes ajoutées (`ar_eleves.commentaire`, `ar_profils_acces.niveaux`) via une migration SQL. Logique métier dans les projections pures existantes (`src/domain/projections/ficheClasse.js`, `ficheEleve.js`), testées comme aujourd'hui avec Vitest sur des fixtures. Les composants de saisie (`SaisieEcole.jsx` et enfants) passent d'une vue « toute l'école » à une vue scopée à une classe sélectionnée ; la vue « toute l'école » devient une fiche de lecture séparée.

**Tech Stack:** React 18 + Vite, Supabase (Postgres + RLS), Vitest. **Convention de test du repo :** seule la logique pure de `src/domain/projections/` est couverte par des tests Vitest (`tests/domain/*.test.js`) — il n'y a pas de tests de composants React dans ce projet (pas de React Testing Library installée), donc les tâches purement UI sont vérifiées par build + relecture manuelle en navigateur, pas par un test automatisé fictif.

---

## Fichiers touchés (vue d'ensemble)

- Créer : `supabase/migrations/20260916_amenagactif_commentaires_niveaux.sql`
- Créer : `src/components/saisie/SelecteurClasse.jsx`
- Créer : `src/pages/FicheEcolePage.jsx`
- Modifier : `src/domain/projections/ficheClasse.js`, `src/domain/projections/ficheEleve.js`
- Modifier : `src/components/saisie/BandeauAU.jsx`, `ChapitreAR.jsx`, `EnTeteEleves.jsx`, `AjoutEleve.jsx`, `EleveEditor.jsx`
- Modifier : `src/components/fiche/FicheClasseView.jsx`, `FicheEleveView.jsx`
- Modifier : `src/hooks/useEcoleGrid.js`, `useGridMutations.js`, `useFicheClasse.js`, `useFicheEleve.js`
- Modifier : `src/pages/SaisieEcole.jsx`, `src/pages/Administration.jsx`, `src/App.jsx`
- Modifier : `api/_lib/ficheData.js`, `api/membres.js`
- Modifier : `src/test/fixtures/sample.js`, `src/plai-style.css`

---

## Task 1: Migration SQL — commentaire élève + niveaux direction

**Files:**
- Create: `supabase/migrations/20260916_amenagactif_commentaires_niveaux.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- AménagActif — commentaire libre par élève (temporalité différente des AR/AU,
-- ex. "décès de la grand-mère") + niveaux ciblés pour les comptes direction
-- (une école peut avoir plusieurs directions, une par groupe de niveaux).
-- À exécuter après 20260904b_amenagactif_referents.sql.

begin;

alter table ar_eleves add column if not exists commentaire text not null default '';

-- null/vide = visible sur toutes les classes de l'école (comportement actuel,
-- rétrocompatible pour les écoles à direction unique).
alter table ar_profils_acces add column if not exists niveaux text[];

commit;
```

- [ ] **Step 2: Exécuter dans le SQL Editor Supabase (projet partagé dfoaumjleqtxjeaplnna)**

Aucune commande CLI — coller le contenu du fichier dans le SQL Editor Supabase et exécuter (convention du projet, cf. `README.md`). Vérifier ensuite :

```sql
select column_name from information_schema.columns where table_name = 'ar_eleves' and column_name = 'commentaire';
select column_name from information_schema.columns where table_name = 'ar_profils_acces' and column_name = 'niveaux';
```

Les deux requêtes doivent renvoyer une ligne.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260916_amenagactif_commentaires_niveaux.sql
git commit -m "feat(db): ajoute ar_eleves.commentaire et ar_profils_acces.niveaux"
```

---

## Task 2: Grammaire uniforme « coché(s) »

**Files:**
- Modify: `src/components/saisie/BandeauAU.jsx:31`
- Modify: `src/components/saisie/ChapitreAR.jsx:22`

- [ ] **Step 1: Corriger BandeauAU.jsx**

Remplacer la ligne 31 :

```jsx
              {classe.nom} <span className="text-[color:var(--text3)] font-normal">— {nbCoches(classe.id)} AU coché{nbCoches(classe.id) > 1 ? 's' : ''}</span>
```

par :

```jsx
              {classe.nom} <span className="text-[color:var(--text3)] font-normal">— {nbCoches(classe.id)} AU coché(s)</span>
```

- [ ] **Step 2: Corriger ChapitreAR.jsx**

Remplacer la ligne 22 :

```jsx
            <span className="text-sm text-[color:var(--text3)]">({nbCoches} AR cochés)</span>
```

par :

```jsx
            <span className="text-sm text-[color:var(--text3)]">({nbCoches} AR coché(s))</span>
```

- [ ] **Step 3: Vérifier visuellement**

`npm run dev`, ouvrir `/saisie`, cocher/décocher un AU et un AR : le texte doit toujours afficher « coché(s) » sans jamais fléchir.

- [ ] **Step 4: Commit**

```bash
git add src/components/saisie/BandeauAU.jsx src/components/saisie/ChapitreAR.jsx
git commit -m "fix: uniformise le compteur AU/AR en « coché(s) » (évite l'accord fautif au singulier)"
```

---

## Task 3: Projection — commentaire dans la fiche classe

**Files:**
- Modify: `src/domain/projections/ficheClasse.js`
- Modify: `src/test/fixtures/sample.js`
- Test: `tests/domain/ficheClasse.test.js`

- [ ] **Step 1: Étendre la fixture**

Dans `src/test/fixtures/sample.js`, remplacer le tableau `eleves` (lignes 16-20) par :

```js
export const eleves = [
  { id: 'e1', classe_id: 'cl-5la', prenom: 'Emilie', initiale_nom: 'D', referent_plai_nom: 'Mona', commentaire: '', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e2', classe_id: 'cl-5la', prenom: 'Karim', initiale_nom: 'B', referent_plai_nom: 'Mona', commentaire: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle', created_at: '2026-08-21T08:00:00Z' },
  { id: 'e3', classe_id: 'cl-5la', prenom: 'Lea', initiale_nom: 'M', referent_plai_nom: 'Carole', commentaire: '', created_at: '2026-08-21T08:00:00Z' },
];
```

- [ ] **Step 2: Écrire le test (échoue)**

Dans `tests/domain/ficheClasse.test.js`, ajouter avant la dernière accolade fermante du `describe` :

```js
  it('commentaires : un élève avec commentaire non vide, les autres omis', () => {
    const vm = computeFicheClasse(args());
    expect(vm.commentaires).toEqual([
      { eleve: 'Karim B.', texte: 'Décès de la grand-mère mi-septembre, vigilance émotionnelle' },
    ]);
  });
```

- [ ] **Step 3: Lancer le test, vérifier l'échec**

Run: `npm test -- ficheClasse`
Expected: FAIL — `expect(vm.commentaires).toEqual(...)` reçoit `undefined`.

- [ ] **Step 4: Implémenter dans ficheClasse.js**

Après la ligne `const nomEleve = (e) => ...;` (ligne 37), ajouter :

```js
  const commentaires = eleves
    .filter((e) => (e.commentaire ?? '').trim())
    .map((e) => ({ eleve: nomEleve(e), texte: e.commentaire.trim() }));
```

Dans l'objet retourné (ligne 90-99), ajouter `commentaires,` :

```js
  return {
    classeNom: contexte.classeNom,
    ecoleNom: contexte.ecoleNom,
    anneeLibelle: contexte.anneeLibelle,
    dateMaj,
    tableauReferents: { pia, par },
    pourTous,
    parEleve,
    commentaires,
    nbRecto,
  };
```

- [ ] **Step 5: Lancer le test, vérifier le succès**

Run: `npm test -- ficheClasse`
Expected: PASS (tous les tests du fichier, y compris le nouveau)

- [ ] **Step 6: Commit**

```bash
git add src/domain/projections/ficheClasse.js src/test/fixtures/sample.js tests/domain/ficheClasse.test.js
git commit -m "feat(fiche-classe): expose les commentaires libres par élève"
```

---

## Task 4: Projection — commentaire dans la fiche élève

**Files:**
- Modify: `src/domain/projections/ficheEleve.js`
- Test: `tests/domain/ficheEleve.test.js`

- [ ] **Step 1: Écrire le test (échoue)**

Dans `tests/domain/ficheEleve.test.js`, ajouter dans le `describe` :

```js
  it('expose le commentaire de l\'élève (chaîne vide si aucun)', () => {
    expect(computeFicheEleve(args('e2')).commentaire).toBe('Décès de la grand-mère mi-septembre, vigilance émotionnelle');
    expect(computeFicheEleve(args('e1')).commentaire).toBe('');
  });
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- ficheEleve`
Expected: FAIL — `commentaire` est `undefined`.

- [ ] **Step 3: Implémenter dans ficheEleve.js**

Remplacer la ligne de retour (ligne 45) :

```js
  return { eleve: nomEleve, classeNom, parChapitre };
```

par :

```js
  return { eleve: nomEleve, classeNom, parChapitre, commentaire: (eleve.commentaire ?? '').trim() };
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- ficheEleve`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/projections/ficheEleve.js tests/domain/ficheEleve.test.js
git commit -m "feat(fiche-eleve): expose le commentaire de l'élève"
```

---

## Task 5: Saisie du commentaire — EleveEditor + mutation

**Files:**
- Modify: `src/components/saisie/EleveEditor.jsx`
- Modify: `src/hooks/useGridMutations.js`

- [ ] **Step 1: Ajouter le champ dans EleveEditor.jsx**

Ajouter un state, en dessous de `const [ref, setRef] = useState(eleve?.referent_plai_nom ?? '');` :

```js
  const [commentaire, setCommentaire] = useState(eleve?.commentaire ?? '');
```

Ajouter le bloc de champ juste avant le bloc `{etat === 'erreur' && ...}` :

```jsx
      <div>
        <label className="block text-sm font-medium">Commentaire (facultatif)</label>
        <textarea className="plai-input w-full" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Ex. : décès de la grand-mère mi-septembre, vigilance émotionnelle" disabled={enCours} />
        <p className="text-xs text-[color:var(--text3)]">Information ponctuelle, à effacer quand elle n'est plus pertinente. Apparaît en bas de la fiche classe et de la fiche élève — pas dans le tableau des AR.</p>
      </div>
```

Modifier l'appel `onSave` dans `enregistrer` :

```js
      await onSave({ prenom, initialeNom: initiale, referentPlaiNom: ref, commentaire });
```

- [ ] **Step 2: Étendre la mutation dans useGridMutations.js**

Remplacer la `mutationFn` de `upsertEleve` (lignes 36-44) :

```js
  const upsertEleve = useMutation({
    mutationFn: async ({ id, classeId, prenom, initialeNom, referentPlaiNom, commentaire }) => {
      const row = { prenom, initiale_nom: initialeNom ?? '', referent_plai_nom: referentPlaiNom ?? '', commentaire: commentaire ?? '' };
      if (id) {
        const { error } = await supabase.from('ar_eleves').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ar_eleves').insert({ ...row, classe_id: classeId });
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });
```

- [ ] **Step 3: Vérifier en navigateur**

`npm run dev`, `/saisie`, ouvrir l'éditeur d'un élève existant, saisir un commentaire, « Enregistrer », rouvrir l'éditeur : le commentaire doit être conservé. La grille (`useEcoleGrid`) ne sélectionne pas encore `commentaire` — normal à ce stade, corrigé à la Task 6 ; la valeur est bien en base (vérifiable via Supabase Table Editor).

- [ ] **Step 4: Commit**

```bash
git add src/components/saisie/EleveEditor.jsx src/hooks/useGridMutations.js
git commit -m "feat(saisie): champ commentaire libre par élève"
```

---

## Task 6: Chargement du commentaire dans les données

**Files:**
- Modify: `src/hooks/useEcoleGrid.js:39`
- Modify: `src/hooks/useFicheClasse.js:13`
- Modify: `src/hooks/useFicheEleve.js:7,13`
- Modify: `api/_lib/ficheData.js:19`

- [ ] **Step 1: useEcoleGrid.js**

Ligne 39, remplacer :

```js
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom').in('classe_id', classeIds).order('prenom');
```

par :

```js
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom, commentaire').in('classe_id', classeIds).order('prenom');
```

- [ ] **Step 2: useFicheClasse.js**

Ligne 13, remplacer :

```js
    .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom, created_at').eq('classe_id', classeId).order('prenom');
```

par :

```js
    .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom, commentaire, created_at').eq('classe_id', classeId).order('prenom');
```

- [ ] **Step 3: useFicheEleve.js**

Ligne 7, remplacer :

```js
    .from('ar_eleves').select('id, prenom, initiale_nom, classe_id, ar_classes(nom)').eq('id', eleveId).single();
```

par :

```js
    .from('ar_eleves').select('id, prenom, initiale_nom, commentaire, classe_id, ar_classes(nom)').eq('id', eleveId).single();
```

Ligne 15-22, ajouter `eleve` complet est déjà passé tel quel à `computeFicheEleve({ eleve, ... })` — aucun changement supplémentaire nécessaire ici, `eleve.commentaire` sera déjà présent.

- [ ] **Step 4: api/_lib/ficheData.js**

Ligne 19, remplacer :

```js
    .select('id, classe_id, prenom, initiale_nom, referent_plai_nom, created_at')
```

par :

```js
    .select('id, classe_id, prenom, initiale_nom, referent_plai_nom, commentaire, created_at')
```

- [ ] **Step 5: Vérifier**

Run: `npm test` → 34/34 (les nouveaux tests des Tasks 3-4 comptent déjà). Puis `npm run dev`, `/saisie` : le commentaire saisi à la Task 5 doit maintenant persister visuellement lors du rechargement de la page.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEcoleGrid.js src/hooks/useFicheClasse.js src/hooks/useFicheEleve.js api/_lib/ficheData.js
git commit -m "feat: propage ar_eleves.commentaire dans les chargeurs de données"
```

---

## Task 7: Affichage du commentaire — fiche classe

**Files:**
- Modify: `src/components/fiche/FicheClasseView.jsx`

- [ ] **Step 1: Ajouter la section en bas de la fiche**

Insérer juste avant la dernière `</article>` (après le tableau « Nombre de cours à imprimer en recto », ligne 49-54) :

```jsx
      {vm.commentaires.length > 0 && (
        <>
          <h2 className="font-bold underline mb-1 mt-4">Commentaires :</h2>
          <table className="w-full border border-black text-sm">
            <tbody>
              {vm.commentaires.map((c, i) => (
                <tr key={i}>
                  <td className="border border-black p-2 align-top w-32 font-medium">{c.eleve}</td>
                  <td className="border border-black p-2">{c.texte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
```

- [ ] **Step 2: Vérifier en navigateur**

`/classe/:id/fiche` pour une classe avec un élève commenté : la section « Commentaires » apparaît en bas, hors du tableau des AR.

- [ ] **Step 3: Commit**

```bash
git add src/components/fiche/FicheClasseView.jsx
git commit -m "feat(fiche-classe): affiche les commentaires en bas de fiche"
```

---

## Task 8: Affichage du commentaire — fiche élève

**Files:**
- Modify: `src/components/fiche/FicheEleveView.jsx`

- [ ] **Step 1: Ajouter la section**

Insérer juste avant la dernière `</article>` :

```jsx
      {vm.commentaire && (
        <section className="mt-3">
          <h2 className="font-bold">Commentaire</h2>
          <p>{vm.commentaire}</p>
        </section>
      )}
```

- [ ] **Step 2: Vérifier en navigateur**

`/eleve/:id/fiche` pour un élève commenté : le commentaire apparaît en bas.

- [ ] **Step 3: Commit**

```bash
git add src/components/fiche/FicheEleveView.jsx
git commit -m "feat(fiche-eleve): affiche le commentaire de l'élève"
```

---

## Task 9: Projection — direction filtrée par niveau

**Files:**
- Modify: `src/domain/projections/ficheClasse.js`
- Modify: `src/test/fixtures/sample.js`
- Test: `tests/domain/ficheClasse.test.js`

- [ ] **Step 1: Étendre les fixtures**

Dans `src/test/fixtures/sample.js`, ajouter `niveau: '5e'` à `classe5LA` (ligne 14) :

```js
export const classe5LA = { id: 'cl-5la', nom: '5LA', niveau: '5e', ecole_id: 'ec1', annee_id: 'an1', created_at: '2026-08-20T08:00:00Z' };
```

Remplacer `referents` (lignes 35-38) :

```js
export const referents = [
  { nom: 'Julien', fonction: 'direction', niveaux: null },
  { nom: 'Sophie', fonction: 'direction', niveaux: ['1e', '2e'] },
  { nom: 'Mona', fonction: 'referent_plai', niveaux: null },
];
```

- [ ] **Step 2: Écrire le test (échoue)**

Dans `tests/domain/ficheClasse.test.js`, ajouter :

```js
  it('PAR : une direction sans niveaux assignés apparaît sur toutes les classes ; une direction restreinte à d\'autres niveaux est exclue', () => {
    const vm = computeFicheClasse(args());
    expect(vm.tableauReferents.par).toEqual(['Julien']);
  });

  it('PAR : une direction dont les niveaux incluent celui de la classe apparaît', () => {
    const referents = [...args().referents, { nom: 'Karim', fonction: 'direction', niveaux: ['5e', '6e'] }];
    const vm = computeFicheClasse({ ...args(), referents });
    expect(vm.tableauReferents.par.sort()).toEqual(['Julien', 'Karim']);
  });
```

- [ ] **Step 3: Lancer le test, vérifier l'échec**

Run: `npm test -- ficheClasse`
Expected: FAIL sur le 2e test ci-dessus — `par` contient aussi `'Sophie'` (pas encore filtré par niveau).

- [ ] **Step 4: Implémenter le filtre dans ficheClasse.js**

Remplacer la ligne 77 :

```js
  const par = referents.filter((r) => r.fonction === 'direction').map((r) => r.nom).filter(Boolean);
```

par :

```js
  const niveauClasse = input.classe?.niveau ?? null;
  const par = referents
    .filter((r) => r.fonction === 'direction')
    .filter((r) => !r.niveaux || r.niveaux.length === 0 || (niveauClasse && r.niveaux.includes(niveauClasse)))
    .map((r) => r.nom)
    .filter(Boolean);
```

- [ ] **Step 5: Lancer le test, vérifier le succès**

Run: `npm test -- ficheClasse`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/projections/ficheClasse.js src/test/fixtures/sample.js tests/domain/ficheClasse.test.js
git commit -m "feat(fiche-classe): filtre la colonne PAR par niveau de la direction"
```

---

## Task 10: Charger niveau de classe + niveaux des comptes direction

**Files:**
- Modify: `src/hooks/useFicheClasse.js:7-9,22`
- Modify: `api/_lib/ficheData.js:11-14,35`

- [ ] **Step 1: useFicheClasse.js — select classe**

Lignes 6-9, remplacer :

```js
  const { data: classe, error } = await supabase
    .from('ar_classes')
    .select('id, nom, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId).single();
```

par :

```js
  const { data: classe, error } = await supabase
    .from('ar_classes')
    .select('id, nom, niveau, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId).single();
```

- [ ] **Step 2: useFicheClasse.js — select + map referents**

Ligne 22, remplacer :

```js
    supabase.from('ar_profils_acces').select('nom, role').eq('ecole_id', classe.ecole_id).in('role', ['direction', 'referent_plai']),
```

par :

```js
    supabase.from('ar_profils_acces').select('nom, role, niveaux').eq('ecole_id', classe.ecole_id).in('role', ['direction', 'referent_plai']),
```

Ligne 25, remplacer :

```js
  const referents = (ref.data ?? []).map((r) => ({ nom: r.nom, fonction: r.role }));
```

par :

```js
  const referents = (ref.data ?? []).map((r) => ({ nom: r.nom, fonction: r.role, niveaux: r.niveaux ?? null }));
```

- [ ] **Step 3: api/_lib/ficheData.js — mêmes changements côté serveur**

Lignes 11-14, remplacer :

```js
    .from('ar_classes')
    .select('id, nom, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId)
    .single();
```

par :

```js
    .from('ar_classes')
    .select('id, nom, niveau, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId)
    .single();
```

Ligne 35, remplacer :

```js
    db.from('ar_profils_acces').select('nom, role').eq('ecole_id', classe.ecole_id).in('role', ['direction', 'referent_plai']),
```

par :

```js
    db.from('ar_profils_acces').select('nom, role, niveaux').eq('ecole_id', classe.ecole_id).in('role', ['direction', 'referent_plai']),
```

Ligne 52, remplacer :

```js
    referents: (ref.data ?? []).map((r) => ({ nom: r.nom, fonction: r.role })),
```

par :

```js
    referents: (ref.data ?? []).map((r) => ({ nom: r.nom, fonction: r.role, niveaux: r.niveaux ?? null })),
```

- [ ] **Step 4: Vérifier**

Run: `npm test` → toujours au vert. `npm run dev`, `/classe/:id/fiche` : la colonne PAR reste correcte tant qu'aucun `niveaux` n'est configuré en base (tous `null` → comportement identique à avant).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFicheClasse.js api/_lib/ficheData.js
git commit -m "feat: propage niveau de classe et niveaux des comptes direction vers la fiche"
```

---

## Task 11: Administration — niveaux des comptes direction

**Files:**
- Modify: `api/membres.js`
- Modify: `src/pages/Administration.jsx`

- [ ] **Step 1: api/membres.js — GET renvoie niveaux**

Ligne 27, remplacer :

```js
      const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, nom, role, ecole_id');
```

par :

```js
      const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, nom, role, ecole_id, niveaux');
```

Ligne 32, remplacer :

```js
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '', role: r.role, ecoleId: r.ecole_id };
```

par :

```js
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '', role: r.role, ecoleId: r.ecole_id, niveaux: r.niveaux ?? [] };
```

- [ ] **Step 2: api/membres.js — setProfil accepte niveaux**

Ligne 39, remplacer :

```js
      const { action, email, userId, nom, role, ecoleId } = req.body || {};
```

par :

```js
      const { action, email, userId, nom, role, ecoleId, niveaux } = req.body || {};
```

Dans le bloc `if (action === 'setProfil')` (lignes 63-73), après `if (nom !== undefined) patch.nom = (nom || '').trim();` ajouter :

```js
        if (niveaux !== undefined) patch.niveaux = Array.isArray(niveaux) && niveaux.length ? niveaux : null;
```

- [ ] **Step 3: Administration.jsx — champ niveaux pour le rôle direction**

Dans `SectionMembres`, remplacer la constante `ROLE_SCOPE` (ligne 9, dans `Administration.jsx` — attention, ne pas confondre avec la même constante côté `api/membres.js`) : aucun changement nécessaire ici, elle reste identique.

Repérer la ligne (dans la liste des membres, après le `<select>` d'école, vers la ligne 92-98) :

```jsx
              {besoinEcole(m.role) && <span className="text-xs text-[color:var(--text3)]">{nomEcole(m.ecoleId)}</span>}
```

Juste après, ajouter (uniquement visible pour le rôle `direction`) :

```jsx
              {m.role === 'direction' && (
                <input className="plai-input !py-1 text-sm w-48" defaultValue={(m.niveaux ?? []).join(',')}
                  placeholder="Niveaux (ex: 3e,4e,5e,6e), vide=tous"
                  onBlur={(e) => {
                    const niveaux = e.target.value.split(',').map((n) => n.trim()).filter(Boolean);
                    const actuel = (m.niveaux ?? []).join(',');
                    if (e.target.value.trim() !== actuel) changerRole.mutate({ userId: m.userId, role: m.role, ecoleId: m.ecoleId, niveaux });
                  }} />
              )}
```

Ajouter une phrase d'aide dans le paragraphe d'introduction de `SectionMembres` (ligne 35-38), après la phrase sur le rôle : remplacer

```jsx
      <p className="text-sm text-[color:var(--text3)]">
        <strong>Administrateur</strong> : tout, toutes écoles. <strong>Référent PLAI</strong> et <strong>Direction</strong> : mêmes droits, limités à une école (classes, élèves, AR/AU, fiches).
        Le <strong>nom</strong> figure sur les fiches (colonnes « référent·e PIA » / « PAR »). Inviter envoie un e-mail avec un lien pour définir le mot de passe.
      </p>
```

par

```jsx
      <p className="text-sm text-[color:var(--text3)]">
        <strong>Administrateur</strong> : tout, toutes écoles. <strong>Référent PLAI</strong> et <strong>Direction</strong> : mêmes droits, limités à une école (classes, élèves, AR/AU, fiches).
        Le <strong>nom</strong> figure sur les fiches (colonnes « référent·e PIA » / « PAR »). Inviter envoie un e-mail avec un lien pour définir le mot de passe.
        Une école peut avoir plusieurs comptes <strong>Direction</strong> (par exemple un par degré) : le champ <strong>Niveaux</strong> limite l'apparition de chacun aux classes concernées — vide, il apparaît sur toutes.
      </p>
```

- [ ] **Step 4: Vérifier en navigateur**

`npm run dev`, `/administration`, saisir « 5e,6e » dans le champ Niveaux d'un compte direction, quitter le champ (blur) : pas d'erreur, revenir sur la page confirme la persistance.

- [ ] **Step 5: Commit**

```bash
git add api/membres.js src/pages/Administration.jsx
git commit -m "feat(admin): niveaux ciblés pour les comptes direction"
```

---

## Task 12: Libellé et aide du champ référent PLAI

**Files:**
- Modify: `src/components/fiche/FicheClasseView.jsx:15`
- Modify: `src/components/saisie/EleveEditor.jsx`
- Modify: `src/components/saisie/AjoutEleve.jsx`

- [ ] **Step 1: Renommer le libellé sur la fiche**

Dans `FicheClasseView.jsx` ligne 15, remplacer :

```jsx
          <th className="border border-black p-1">Intégrations (référent·e PIA)</th>
```

par :

```jsx
          <th className="border border-black p-1">Référent(s) PLAI de votre classe</th>
```

- [ ] **Step 2: Aide contextuelle dans EleveEditor.jsx**

Ligne 22, remplacer :

```jsx
        <p className="text-xs text-[color:var(--text3)]">Nom de l'accompagnateur·ice qui suit cet élève. Apparaît dans le tableau PIA de la fiche.</p>
```

par :

```jsx
        <p className="text-xs text-[color:var(--text3)]">Nom de l'accompagnateur·ice qui suit cet élève. Plusieurs noms : séparez-les par une virgule (ex. « Mona, Julie »). Apparaît dans le tableau « Référent(s) PLAI » de la fiche.</p>
```

- [ ] **Step 3: Aide contextuelle dans AjoutEleve.jsx**

Repérer le label `Référent PLAI` (ligne 25-27) et le placeholder `Mona` — remplacer par un placeholder illustrant plusieurs noms :

```jsx
      <label className="text-sm">Référent(s) PLAI
        <input className="plai-input block" value={f.referent} onChange={set('referent')} placeholder="Mona, Julie" disabled={enCours} />
      </label>
```

- [ ] **Step 4: Vérifier en navigateur**

`/classe/:id/fiche` affiche le nouveau libellé ; `/saisie`, ouvrir l'éditeur d'un élève, le texte d'aide mentionne la virgule.

- [ ] **Step 5: Commit**

```bash
git add src/components/fiche/FicheClasseView.jsx src/components/saisie/EleveEditor.jsx src/components/saisie/AjoutEleve.jsx
git commit -m "feat: renomme la colonne référent PLAI et documente le séparateur virgule"
```

---

## Task 13: Projection — tableau AR inversé (fiche classe)

**Files:**
- Modify: `src/domain/projections/ficheClasse.js`
- Test: `tests/domain/ficheClasse.test.js`

- [ ] **Step 1: Écrire le test (échoue)**

Ajouter dans `tests/domain/ficheClasse.test.js` :

```js
  it('parAmenagement : une ligne par AR/libre, triée par ordre de chapitre, avec la liste des élèves concernés', () => {
    const vm = computeFicheClasse(args());
    expect(vm.parAmenagement.map((x) => x.libelle)).toEqual([
      'Doubler les espaces de réponse',
      'Utiliser les livres audio pour la lecture',
      'Vérifier oralement la consigne avant de commencer',
    ]);
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual(['Emilie D.']);
  });

  it('parAmenagement : ne contient pas l\'AR recto ni les commentaires', () => {
    const vm = computeFicheClasse(args());
    expect(vm.parAmenagement.some((x) => x.libelle === 'Cours uniquement en recto')).toBe(false);
    expect(vm.parAmenagement.some((x) => x.libelle.includes('grand-mère'))).toBe(false);
  });

  it('parAmenagement : un même AR partagé par deux élèves liste les deux noms', () => {
    const selectionsAR = [...args().selectionsAR, { eleve_id: 'e3', amenagement_id: 'a-ar1', cree_le: '2026-09-03T08:00:00Z' }];
    const vm = computeFicheClasse({ ...args(), selectionsAR });
    const doubler = vm.parAmenagement.find((x) => x.libelle === 'Doubler les espaces de réponse');
    expect(doubler.eleves).toEqual(['Emilie D.', 'Lea M.']);
  });
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `npm test -- ficheClasse`
Expected: FAIL — `vm.parAmenagement` est `undefined`.

- [ ] **Step 3: Implémenter dans ficheClasse.js**

Après le bloc `const parEleve = eleves.map(...)` (lignes 52-60), ajouter :

```js
  const parAmenagementMap = new Map();
  const ajouterEleveAAmenagement = (libelle, chapOrdreVal, ordreVal, nom) => {
    if (!parAmenagementMap.has(libelle)) parAmenagementMap.set(libelle, { chapOrdreVal, ordreVal, eleves: [] });
    parAmenagementMap.get(libelle).eleves.push(nom);
  };
  for (const [eleveId, amgts] of arParEleveId.entries()) {
    const e = eleves.find((x) => x.id === eleveId);
    if (!e) continue;
    // arParEleveId exclut déjà l'AR recto (filtré plus haut à sa construction).
    for (const a of amgts) ajouterEleveAAmenagement(a.libelle, chapOrdre(a), a.ordre, nomEleve(e));
  }
  const parAmenagement = [...parAmenagementMap.entries()]
    .sort(([, a], [, b]) => a.chapOrdreVal - b.chapOrdreVal || a.ordreVal - b.ordreVal)
    .map(([libelle, { eleves: es }]) => ({ libelle, eleves: es }));
```

Dans l'objet retourné, ajouter `parAmenagement,` juste après `parEleve,` et avant `commentaires,` (celui ajouté à la Task 3).

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `npm test -- ficheClasse`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/projections/ficheClasse.js tests/domain/ficheClasse.test.js
git commit -m "feat(fiche-classe): projection parAmenagement (AR → liste d'élèves)"
```

---

## Task 14: Vue inversée du tableau AR sur la fiche classe

**Files:**
- Modify: `src/components/fiche/FicheClasseView.jsx`

- [ ] **Step 1: Remplacer le tableau « AR spécifiques à un élève »**

Remplacer le bloc (lignes 32-47) :

```jsx
      <h2 className="font-bold underline mb-1">AR spécifiques à un élève :</h2>
      <table className="w-full border border-black mb-4 text-sm">
        <tbody>
          {vm.parEleve.length === 0 && <tr><td className="border border-black p-2 text-gray-500">Aucun.</td></tr>}
          {vm.parEleve.map((row) => (
            <tr key={row.eleve}>
              <td className="border border-black p-2 align-top w-32 font-medium">
                {row.eleveId ? <a className="text-teal underline" href={`/eleve/${row.eleveId}/fiche`}>{row.eleve}</a> : row.eleve}
              </td>
              <td className="border border-black p-2">
                <ul className="list-disc pl-5">{row.amenagements.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
```

par :

```jsx
      <h2 className="font-bold underline mb-1">AR spécifiques à un élève :</h2>
      <table className="w-full border border-black mb-4 text-sm">
        <tbody>
          {vm.parAmenagement.length === 0 && <tr><td className="border border-black p-2 text-gray-500">Aucun.</td></tr>}
          {vm.parAmenagement.map((row) => (
            <tr key={row.libelle}>
              <td className="border border-black p-2 align-top w-64">{row.libelle}</td>
              <td className="border border-black p-2">
                <ul className="list-disc pl-5">{row.eleves.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
```

Note : le lien vers `/eleve/:id/fiche` disparaît de ce tableau (il n'y a plus de ligne par élève) — il reste accessible depuis `/fiches` (picker) ou la fiche école complète (Task 19).

- [ ] **Step 2: Vérifier en navigateur**

`/classe/:id/fiche` : le tableau affiche une ligne par AR (dans l'ordre des chapitres), chaque ligne listant les élèves concernés. `FicheEleveView.jsx` (fiche élève) reste inchangée — vérifier `/eleve/:id/fiche` toujours centrée sur un seul élève.

- [ ] **Step 3: Commit**

```bash
git add src/components/fiche/FicheClasseView.jsx
git commit -m "feat(fiche-classe): inverse le tableau AR (ligne = aménagement, colonne = élèves concernés)"
```

---

## Task 15: Composant SelecteurClasse

**Files:**
- Create: `src/components/saisie/SelecteurClasse.jsx`

- [ ] **Step 1: Écrire le composant**

```jsx
import { useState } from 'react';

/**
 * Sélection explicite d'une classe existante, ou création d'une nouvelle —
 * remplace la saisie libre du nom de classe pour fiabiliser le flux
 * (plus de correspondance texte hasardeuse entre "5LA" et "5 LA").
 */
export default function SelecteurClasse({ classes, onSelect, onCreate }) {
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [niveau, setNiveau] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const classeId = await onCreate({ nom, niveau });
      setCreation(false);
      setNom('');
      setNiveau('');
      onSelect(classeId);
    } catch (err) {
      setErreur(err.message || 'Échec de la création, réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  if (creation) {
    return (
      <form className="plai-card p-3 flex flex-wrap gap-2 items-end" onSubmit={valider}>
        <label className="text-sm">Nom de la classe
          <input className="plai-input block" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="5LA" disabled={enCours} />
        </label>
        <label className="text-sm">Niveau
          <input className="plai-input block" value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="5e" disabled={enCours} />
        </label>
        <button type="submit" className="plai-btn" disabled={enCours || !nom.trim()}>{enCours ? 'Création…' : 'Créer et continuer'}</button>
        <button type="button" className="text-sm underline" onClick={() => setCreation(false)} disabled={enCours}>Annuler</button>
        {erreur && <p className="plai-error text-xs w-full">{erreur}</p>}
      </form>
    );
  }

  return (
    <div className="plai-card p-3 flex flex-wrap gap-2 items-end">
      <label className="text-sm">Classe
        <select className="plai-input block" value="" onChange={(e) => e.target.value && onSelect(e.target.value)}>
          <option value="">— choisir une classe —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.niveau ? ` — ${c.niveau}` : ''}</option>)}
        </select>
      </label>
      <button type="button" className="plai-btn" onClick={() => setCreation(true)}>+ Nouvelle classe</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/saisie/SelecteurClasse.jsx
git commit -m "feat(saisie): composant SelecteurClasse (existante ou nouvelle)"
```

---

## Task 16: Simplifier BandeauAU, ChapitreAR, EnTeteEleves à une seule classe

**Files:**
- Modify: `src/components/saisie/BandeauAU.jsx`
- Modify: `src/components/saisie/ChapitreAR.jsx`
- Modify: `src/components/saisie/EnTeteEleves.jsx`

- [ ] **Step 1: BandeauAU.jsx — une seule classe**

Remplacer tout le fichier :

```jsx
/**
 * Aménagements universels : cochés UNE fois par classe (pas par élève).
 * Alimentent le bloc « Pour tous » de la fiche. Affiché en carte, au-dessus
 * de la grille des AR (qui, elle, est par élève). Scopé à la classe
 * sélectionnée dans le flux de saisie.
 */
export default function BandeauAU({ classe, auCatalogue, chapitres, auClasse, onToggle }) {
  const estCoche = (amId) => auClasse.some((x) => x.amenagement_id === amId);

  const chapOrdre = new Map(chapitres.map((c) => [c.id, c.ordre]));
  const chapCourt = (chapId) => {
    const t = chapitres.find((c) => c.id === chapId)?.titre ?? '';
    return t.replace(/^\d+\.\s*/, '').split(',')[0].trim();
  };
  const auTries = [...auCatalogue].sort(
    (a, b) => (chapOrdre.get(a.chapitre_id) ?? 99) - (chapOrdre.get(b.chapitre_id) ?? 99) || a.ordre - b.ordre
  );
  const nbCoches = auTries.filter((a) => estCoche(a.id)).length;

  return (
    <section className="plai-card p-4" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal">Aménagements universels de la classe</h2>
      <p className="text-sm text-[color:var(--text3)] mb-3">
        S'appliquent à <strong>tous les élèves</strong> de la classe. Cochés ici une seule fois — ils forment le bloc « Pour tous » de la fiche.
        Les aménagements <strong>par élève</strong> sont dans les 12 chapitres ci-dessous.
      </p>
      <div className="font-medium mb-1">
        {classe.nom} <span className="text-[color:var(--text3)] font-normal">— {nbCoches} AU coché(s)</span>
      </div>
      <ul className="space-y-1">
        {auTries.map((a) => (
          <li key={a.id}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={estCoche(a.id)}
                onChange={(e) => onToggle({ classeId: classe.id, amenagementId: a.id, actif: e.target.checked })}
              />
              <span>
                {a.libelle}
                <span className="text-xs text-[color:var(--text3)]"> · {chapCourt(a.chapitre_id)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: ChapitreAR.jsx — accepte `eleves` directement**

Remplacer les lignes 1-13 (jusqu'à la fin de la destructuration des props et du calcul de `cols`) :

```jsx
import { useState } from 'react';
import AmenagementLibreForm from './AmenagementLibreForm.jsx';

export default function ChapitreAR({ chapitre, amenagements, eleves, selectionsAR, libres, onToggle, onAddLibre, onRemoveLibre }) {
  const [ouvert, setOuvert] = useState(false);
  const [libreOuvert, setLibreOuvert] = useState(false);

  const cols = eleves;
  const totalCols = cols.length;
```

Le reste du fichier (lignes 14 à la fin, à partir de `const estCoche = ...`) reste identique — `cols` est maintenant directement le tableau `eleves` reçu en prop, plus besoin de `flatMap`.

- [ ] **Step 3: EnTeteEleves.jsx — accepte `eleves` directement**

Remplacer tout le fichier :

```jsx
import { useState } from 'react';
import EleveEditor from './EleveEditor.jsx';

export default function EnTeteEleves({ eleves, onSaveEleve, onDeleteEleve }) {
  const [editId, setEditId] = useState(null);

  return (
    <thead className="sticky top-0 z-20 bg-[color:var(--bg)]">
      <tr>
        <th className="text-left align-bottom p-1 min-w-[16rem]"></th>
        {eleves.map((e) => (
          <th key={e.id} className="relative p-1 align-bottom min-w-[3rem] border-l border-[color:var(--border)]">
            <button className="text-xs hover:underline" onClick={() => setEditId(editId === e.id ? null : e.id)}
              style={{ writingMode: 'vertical-rl' }} title="Modifier l'élève">
              {e.prenom} {e.initiale_nom}
            </button>
            {editId === e.id && (
              <div className="absolute mt-1 z-40">
                <EleveEditor eleve={e} onClose={() => setEditId(null)}
                  onSave={(v) => onSaveEleve({ id: e.id, classeId: e.classe_id, ...v })}
                  onDelete={onDeleteEleve ? () => onDeleteEleve({ id: e.id }) : undefined} />
              </div>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}
```

- [ ] **Step 4: Vérifier**

Ces trois composants ont maintenant des props différentes — la compilation via `npm run build` échouera tant que `SaisieEcole.jsx` (Task 17) ne les appelle pas avec les nouvelles props. C'est attendu à ce stade ; ne pas lancer le build isolément ici.

- [ ] **Step 5: Commit**

```bash
git add src/components/saisie/BandeauAU.jsx src/components/saisie/ChapitreAR.jsx src/components/saisie/EnTeteEleves.jsx
git commit -m "refactor(saisie): BandeauAU/ChapitreAR/EnTeteEleves scopés à une seule classe"
```

---

## Task 17: Restructurer SaisieEcole.jsx en flux séquentiel + préremplissage référent

**Files:**
- Modify: `src/pages/SaisieEcole.jsx`
- Modify: `src/components/saisie/AjoutEleve.jsx`

- [ ] **Step 1: AjoutEleve.jsx — retire classe/niveau, ajoute préremplissage**

Remplacer tout le fichier :

```jsx
import { useState, useEffect } from 'react';

export default function AjoutEleve({ onCreate, referentSuggere }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ prenom: '', initiale: '', referent: '' });
  const [etat, setEtat] = useState('idle'); // idle | creation | erreur
  const [erreur, setErreur] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (ouvert && !f.referent && referentSuggere) setF((prev) => ({ ...prev, referent: referentSuggere }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, referentSuggere]);

  if (!ouvert) return <button className="plai-btn" onClick={() => setOuvert(true)}>+ élève</button>;

  const soumettre = async (e) => {
    e.preventDefault();
    setEtat('creation');
    setErreur('');
    try {
      await onCreate(f);
      setOuvert(false);
      setEtat('idle');
      setF({ prenom: '', initiale: '', referent: '' });
    } catch (err) {
      setEtat('erreur');
      setErreur(err.message || "Échec de la création, réessayez.");
    }
  };

  const enCours = etat === 'creation';

  return (
    <form className="plai-card p-3 flex flex-wrap gap-2 items-end" onSubmit={soumettre}>
      <label className="text-sm">Prénom
        <input className="plai-input block" required value={f.prenom} onChange={set('prenom')} placeholder="Emilie" disabled={enCours} />
      </label>
      <label className="text-sm">Initiale
        <input className="plai-input block" maxLength={2} value={f.initiale} onChange={set('initiale')} placeholder="D" disabled={enCours} />
      </label>
      <label className="text-sm">Référent(s) PLAI
        <input className="plai-input block" value={f.referent} onChange={set('referent')} placeholder="Mona, Julie" disabled={enCours} />
      </label>
      <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Création…' : 'Créer'}</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
      {etat === 'erreur' && <p className="plai-error text-xs w-full">{erreur}</p>}
    </form>
  );
}
```

- [ ] **Step 2: SaisieEcole.jsx — flux séquentiel**

Remplacer tout le fichier :

```jsx
import { useState, useMemo } from 'react';
import SelecteurContexte from '../components/saisie/SelecteurContexte.jsx';
import SelecteurClasse from '../components/saisie/SelecteurClasse.jsx';
import BarreSaut from '../components/saisie/BarreSaut.jsx';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import AjoutEleve from '../components/saisie/AjoutEleve.jsx';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useGridMutations } from '../hooks/useGridMutations.js';

export default function SaisieEcole() {
  const [ctx, setCtx] = useState({ ecoleId: null, anneeId: null });
  const [classeId, setClasseId] = useState(null);
  const { data: cat } = useCatalogue();
  const { data: grid, isLoading, error } = useEcoleGrid(ctx.ecoleId, ctx.anneeId);
  const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);

  const classe = useMemo(() => grid?.classes.find((c) => c.id === classeId) ?? null, [grid, classeId]);
  const eleves = useMemo(() => (grid?.eleves ?? []).filter((e) => e.classe_id === classeId), [grid, classeId]);
  const referentSuggere = useMemo(() => {
    const valeurs = [...new Set(eleves.map((e) => e.referent_plai_nom).filter(Boolean))];
    return valeurs.length === 1 ? valeurs[0] : '';
  }, [eleves]);

  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');

  return (
    <div className="plai-section space-y-4">
      <h1 className="text-xl font-semibold">Saisie des aménagements</h1>
      <SelecteurContexte ecoleId={ctx.ecoleId} anneeId={ctx.anneeId} onChange={(v) => { setCtx(v); setClasseId(null); }} />

      {!ctx.ecoleId || !ctx.anneeId ? (
        <p className="plai-empty">Choisir une école et une année pour commencer.</p>
      ) : isLoading ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="plai-error">Erreur de chargement : {error.message}</p>
      ) : !classe ? (
        <SelecteurClasse
          classes={grid.classes}
          onSelect={setClasseId}
          onCreate={({ nom, niveau }) => mut.ensureClasse.mutateAsync({ nom, niveau })}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <button className="underline text-teal" onClick={() => setClasseId(null)}>← Changer de classe</button>
            </p>
          </div>

          <BandeauAU classe={classe} auCatalogue={auCat} chapitres={chapitres}
            auClasse={grid.auClasse.filter((x) => x.classe_id === classeId)} onToggle={(v) => mut.toggleAU.mutate(v)} />

          <AjoutEleve
            referentSuggere={referentSuggere}
            onCreate={async ({ prenom, initiale, referent }) => {
              await mut.upsertEleve.mutateAsync({ classeId, prenom, initialeNom: initiale, referentPlaiNom: referent });
            }}
          />

          <div>
            <h2 className="font-semibold mb-1">Aménagements raisonnables — {classe.nom}</h2>
            <BarreSaut chapitres={chapitres} />
          </div>
          <div className="overflow-x-auto border border-[color:var(--border)] rounded">
            <table className="border-collapse text-sm">
              <EnTeteEleves eleves={eleves}
                onSaveEleve={(v) => mut.upsertEleve.mutateAsync(v)}
                onDeleteEleve={(v) => mut.deleteEleve.mutateAsync(v)} />
              <tbody>
                {chapitres.map((ch) => (
                  <ChapitreAR key={ch.id} chapitre={ch}
                    amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                    eleves={eleves}
                    selectionsAR={grid.selectionsAR}
                    libres={grid.libres}
                    onToggle={(v) => mut.toggleAR.mutate(v)}
                    onAddLibre={(v) => mut.addLibre.mutate(v)}
                    onRemoveLibre={(v) => mut.removeLibre.mutate(v)} />
                ))}
              </tbody>
            </table>
          </div>
          {mut.toggleAR.isError && <p className="plai-error">Échec d'enregistrement, réessayez.</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2 bis: SelecteurContexte.jsx — signature `onChange` déjà compatible**

Vérifier que `SelecteurContexte` appelle bien `onChange({ ecoleId, anneeId })` (c'est le cas, ligne 14 et 21 de `SelecteurContexte.jsx`) — le nouveau wrapper `(v) => { setCtx(v); setClasseId(null); }` fonctionne sans modification de ce composant.

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: succès sans erreur (les props de `BandeauAU`/`ChapitreAR`/`EnTeteEleves` correspondent maintenant à celles attendues par `SaisieEcole.jsx`).

- [ ] **Step 4: Vérifier en navigateur**

`npm run dev`, `/saisie` : choisir école + année → sélecteur de classe apparaît → choisir une classe existante ou en créer une → seule cette classe s'affiche (AU + AR + élèves) → « + élève » prérempli si un seul référent existe déjà sur la classe → « ← Changer de classe » revient au sélecteur.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SaisieEcole.jsx src/components/saisie/AjoutEleve.jsx
git commit -m "feat(saisie): flux séquentiel par classe + préremplissage du référent PLAI"
```

---

## Task 18: Fiche école complète

**Files:**
- Create: `src/pages/FicheEcolePage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/plai-style.css`

- [ ] **Step 1: Créer FicheEcolePage.jsx**

Reprend la logique de sélection école/année et enchaîne une `FicheClasseView` par classe, en lecture seule — équivalent imprimable de l'ancienne vue « toute l'école » de la saisie. Les classes viennent de `useEcoleGrid`, déjà utilisé par la page de saisie pour la même liste.

```jsx
import { useState } from 'react';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useFicheClasse } from '../hooks/useFicheClasse.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';
import { useRole } from '../lib/auth.jsx';

function FicheUneClasse({ classeId }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <p>Chargement de la classe…</p>;
  if (error) return <p className="plai-error">{error.message}</p>;
  return <FicheClasseView vm={vm} />;
}

export default function FicheEcolePage() {
  const { isAdmin } = useRole();
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');

  const ecoleActive = ecoleUnique?.id || ecoleId;
  const anneeActive = anneeId || annees.find((a) => a.active)?.id || '';
  const { data: grid } = useEcoleGrid(ecoleActive || null, anneeActive || null);
  const classes = grid?.classes ?? [];

  return (
    <div className="plai-section space-y-3">
      <h1 className="text-xl font-semibold no-print">Fiche — vue école complète</h1>
      <div className="flex gap-3 no-print">
        {!ecoleUnique && (
          <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
            <option value="">École…</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        )}
        <select className="plai-input" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
          <option value="">Année…</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
        </select>
        {ecoleActive && anneeActive && <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>}
      </div>
      {ecoleActive && anneeActive && classes.map((c) => <FicheUneClasse key={c.id} classeId={c.id} />)}
    </div>
  );
}
```

- [ ] **Step 2: Route dans App.jsx**

Ajouter l'import (après `import FicheClassePage from './pages/FicheClassePage.jsx';`) :

```js
import FicheEcolePage from './pages/FicheEcolePage.jsx';
```

Ajouter la route (après la route `/fiches`) :

```jsx
      <Route path="/fiches/ecole" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><FicheEcolePage /></RequireRole></Shell></RequireAuth>} />
```

Ajouter un lien vers cette page dans `FicheClassePage.jsx`, dans le composant `Picker` (juste après `<h1>Fiches par classe</h1>`, ligne 29) :

```jsx
      <Link className="text-sm text-teal underline" to="/fiches/ecole">Voir la fiche « vue école complète »</Link>
```

(`Link` est déjà importé dans `FicheClassePage.jsx`, ligne 1.)

- [ ] **Step 3: Saut de page à l'impression**

Dans `src/plai-style.css`, dans le bloc `@media print` (ligne 167-179), ajouter avant la ligne `@page { size: A4; margin: 14mm; }` :

```css
  .fiche + .fiche { page-break-before: always; }
```

- [ ] **Step 4: Vérifier**

Run: `npx vite build` → succès.
`npm run dev`, `/fiches`, cliquer « Voir la fiche « vue école complète » », choisir école + année : toutes les classes s'affichent à la suite, chacune avec son propre tableau AR inversé (Task 14) et ses commentaires (Task 7). Aperçu avant impression (Ctrl+P) : chaque classe démarre sur une nouvelle page.

- [ ] **Step 5: Commit**

```bash
git add src/pages/FicheEcolePage.jsx src/App.jsx src/pages/FicheClassePage.jsx src/plai-style.css
git commit -m "feat: nouvelle fiche « vue école complète » (lecture seule, remplace l'ancienne vue de saisie)"
```

---

## Task 19: Vérification finale

**Files:** aucun

- [ ] **Step 1: Suite complète**

Run: `npm test`
Expected: tous les tests passent (comptage attendu : 29 initiaux + 2 commentaires ficheClasse + 1 ficheEleve + 2 niveaux direction + 3 parAmenagement = 37).

- [ ] **Step 2: Build**

Run: `npx vite build`
Expected: succès sans erreur ni warning bloquant.

- [ ] **Step 3: Parcours manuel complet en navigateur**

`npm run dev`, en tant qu'admin :
1. `/saisie` → choisir école/année → créer une nouvelle classe → ajouter 2 élèves, dont un avec un commentaire → cocher un AU, deux AR (dont un partagé par les deux élèves) → « ← Changer de classe » → re-sélectionner la classe créée : tout est conservé.
2. `/administration` → attribuer un niveau à un compte direction.
3. `/classe/:id/fiche` → vérifier : libellé « Référent(s) PLAI de votre classe », tableau AR inversé (ligne = AR, colonne = élèves), section Commentaires en bas, colonne PAR filtrée par niveau.
4. `/eleve/:id/fiche` → inchangée dans sa structure, commentaire affiché en bas.
5. `/fiches/ecole` → toutes les classes de l'école à la suite, saut de page correct à l'impression.

- [ ] **Step 4: Commit final si ajustements**

```bash
git add -A
git commit -m "fix: ajustements suite à la vérification manuelle"
```

(Uniquement si des corrections ont été nécessaires à l'étape 3.)
