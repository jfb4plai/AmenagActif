# Vue et édition admin des écoles/implantations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de voir et réactiver les écoles/implantations désactivées depuis `Administration.jsx`, au lieu qu'elles deviennent invisibles et irrécupérables sans SQL manuel.

**Architecture:** Un nouveau hook `useEcolesAdmin()` (sans filtre `actif`) réservé à l'écran admin ; tous les autres usages de `useEcoles()` (sélecteurs de saisie, fiches, invitation de membres) restent filtrés sur `actif = true`, inchangés. Aucune migration ni changement RLS : `ar_ecoles_write` est déjà `admin`-only sans filtre sur `actif`, et la mutation `majEcole` supporte déjà `actif: true` (réactivation) — seul un bouton manquait côté UI.

**Tech Stack:** React 18, `@tanstack/react-query` v5, Supabase.

**Référence :** [docs/superpowers/specs/2026-09-22-amenagactif-accompagnants-statut-design.md](../specs/2026-09-22-amenagactif-accompagnants-statut-design.md), section 2.

---

### Task 1: Hook `useEcolesAdmin`

**Files:**
- Modify: `src/hooks/useEcoleGrid.js:4-13`

- [ ] **Step 1: Ajouter le nouveau hook, juste après `useEcoles`**

Code actuel (`useEcoles`, lignes 4-13) :

```js
export function useEcoles() {
  return useQuery({
    queryKey: ['ecoles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_ecoles').select('id, nom, implantation').eq('actif', true).order('nom');
      if (error) throw error;
      return data;
    },
  });
}
```

Insérer juste après (ne pas modifier `useEcoles` lui-même) :

```js

/** Toutes les écoles, actives et désactivées — réservé à l'écran admin (SectionEcoles). */
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

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEcoleGrid.js
git commit -m "feat: ajoute useEcolesAdmin pour lister les écoles désactivées"
```

---

### Task 2: Invalider aussi `ecoles-admin` après une mutation école

**Files:**
- Modify: `src/hooks/useAdmin.js:13-18`

- [ ] **Step 1: Étendre l'invalidation**

Code actuel :

```js
export function useAdminMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['annees'] });
    qc.invalidateQueries({ queryKey: ['ecoles'] });
  };
```

Remplacer par :

```js
export function useAdminMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['annees'] });
    qc.invalidateQueries({ queryKey: ['ecoles'] });
    qc.invalidateQueries({ queryKey: ['ecoles-admin'] });
  };
```

- [ ] **Step 2: Ré-exporter `useEcolesAdmin` depuis `useAdmin.js`**

`Administration.jsx` importe tous ses hooks écoles depuis `../hooks/useAdmin.js` (pas directement depuis `useEcoleGrid.js`). Ligne actuelle :

```js
import { useAnnees, useEcoles } from './useEcoleGrid.js';

export { useAnnees, useEcoles };
```

Remplacer par :

```js
import { useAnnees, useEcoles, useEcolesAdmin } from './useEcoleGrid.js';

export { useAnnees, useEcoles, useEcolesAdmin };
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdmin.js
git commit -m "feat: invalide et ré-exporte useEcolesAdmin"
```

---

### Task 3: `SectionEcoles` — badge d'état + bouton réactiver

**Files:**
- Modify: `src/pages/Administration.jsx:1-6` (import), `src/pages/Administration.jsx:260-303` (`SectionEcoles`)

- [ ] **Step 1: Étendre l'import en haut du fichier**

Ligne actuelle (import des hooks admin) :

```js
import {
  useAnnees, useEcoles, useAdminMutations,
  useCatalogueAdmin, useCatalogueMutations,
} from '../hooks/useAdmin.js';
```

Remplacer par :

```js
import {
  useAnnees, useEcoles, useEcolesAdmin, useAdminMutations,
  useCatalogueAdmin, useCatalogueMutations,
} from '../hooks/useAdmin.js';
```

- [ ] **Step 2: Réécrire `SectionEcoles`**

Fichier actuel de la fonction (lignes 260-303) :

```jsx
/* ─────────────── Écoles / implantations ─────────────── */
function SectionEcoles() {
  const { data: ecoles = [] } = useEcoles();
  const { ajouterEcole, majEcole } = useAdminMutations();
  const [f, setF] = useState({ nom: '', implantation: '' });

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Écoles / implantations</h2>
      <p className="text-sm text-[color:var(--text3)]">Les 11 implantations secondaires accompagnées. Désactiver une école la retire des sélecteurs sans supprimer ses données.</p>
      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(e) => { e.preventDefault(); if (f.nom.trim()) { ajouterEcole.mutate(f); setF({ nom: '', implantation: '' }); } }}
      >
        <label className="text-sm">Nom
          <input className="plai-input block" placeholder="Athénée Léonie de Waha" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </label>
        <label className="text-sm">Implantation (code court)
          <input className="plai-input block" placeholder="waha" value={f.implantation} onChange={(e) => setF({ ...f, implantation: e.target.value })} />
        </label>
        <button className="plai-btn" type="submit" disabled={!f.nom.trim()}>Ajouter</button>
      </form>
      <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
        {ecoles.map((e) => (
          <li key={e.id} className="flex items-center justify-between px-3 py-2 gap-3">
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
            <button className="text-sm underline" onClick={() => majEcole.mutate({ id: e.id, actif: false })}>désactiver</button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[color:var(--text3)]">La liste ci-dessus ne montre que les écoles actives. Réactivation : contacter la maintenance (SQL).</p>
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
          <input className="plai-input block" placeholder="Athénée Léonie de Waha" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </label>
        <label className="text-sm">Implantation (code court)
          <input className="plai-input block" placeholder="waha" value={f.implantation} onChange={(e) => setF({ ...f, implantation: e.target.value })} />
        </label>
        <button className="plai-btn" type="submit" disabled={!f.nom.trim()}>Ajouter</button>
      </form>
      <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
        {ecoles.map((e) => (
          <li key={e.id} className={`flex items-center justify-between px-3 py-2 gap-3 ${e.actif ? '' : 'opacity-60'}`}>
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

- [ ] **Step 3: Commit**

```bash
git add src/pages/Administration.jsx
git commit -m "feat: vue admin complète des écoles avec réactivation"
```

---

### Task 4: Vérification navigateur

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Lancer le serveur de dev et se connecter en admin**

Utiliser le serveur de dev du projet (config `amenagactif` dans `.claude/launch.json`, ou `npm run dev`). Se rendre sur `/administration`.

- [ ] **Step 2: Vérifier l'affichage**

Confirmer que la section "Écoles / implantations" affiche un badge "active"/"désactivée" par ligne, et que le texte en bas de section ne mentionne plus "contacter la maintenance".

- [ ] **Step 3: Tester le cycle désactiver → réactiver**

Sur une école de test (pas une des 11 vraies implantations), cliquer "désactiver" : la ligne passe en opacité réduite avec badge "désactivée" et le bouton devient "réactiver" — la ligne doit rester visible (contrairement au comportement actuel où elle disparaîtrait). Cliquer "réactiver" : la ligne revient à l'état normal, badge "active".

- [ ] **Step 4: Vérifier que le reste de l'app n'est pas affecté**

Aller sur `/saisie` (ou tout autre écran avec un sélecteur d'école) et confirmer qu'une école désactivée n'y apparaît toujours pas — seul l'écran admin doit désormais montrer les écoles inactives.

---

## Self-Review

- **Couverture spec** : section 2 entièrement couverte — nouveau hook non filtré réservé à l'admin, badge d'état, bouton réactiver symétrique de désactiver, aucun changement RLS/migration (confirmé inutile : `majEcole` supportait déjà `actif: true`, seul le hook de lecture et l'UI manquaient).
- **Pas de placeholder** : code exact à chaque étape.
- **Cohérence des types** : `useEcolesAdmin()` retourne la même forme que `useEcoles()` plus le champ `actif` ; `majEcole.mutate({ id, actif })` déjà supporté sans changement de signature. `SectionEcoles` est la seule consommatrice du nouveau hook — tous les autres appelants de `useEcoles()` (`SaisieEcole.jsx` via `SelecteurContexte.jsx`, `FicheClassePage.jsx`, `FicheEcolePage.jsx`, `MonEcole.jsx`, `Administration.jsx` → `SectionMembres`) restent inchangés et continuent de filtrer sur `actif = true`, ce qui est le comportement voulu (une école désactivée ne doit pas réapparaître dans les sélecteurs métier, seulement dans l'écran admin dédié).
