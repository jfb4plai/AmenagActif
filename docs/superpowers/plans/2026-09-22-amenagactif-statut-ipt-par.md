# Statut IPT/PAR par élève — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un champ obligatoire `statut` (IPT / PAR) sur chaque élève, saisi à la création et modifiable ensuite, sans toucher à l'affichage des fiches.

**Architecture:** Une colonne `not null` sur `ar_eleves`, exposée dans la requête de grille existante, saisie dans les deux points d'entrée élève déjà en place (`EleveEditor.jsx` pour la modification, `AjoutEleve.jsx` pour la création). Aucun nouveau composant, aucune nouvelle route, aucun changement RLS (la colonne est couverte par les policies existantes sur `ar_eleves`).

**Tech Stack:** React 18, Supabase (Postgres + RLS), `@tanstack/react-query` v5. Pas de couche de test automatisé pour les mutations Supabase ni les composants de saisie dans ce projet (seules les fonctions pures de `src/domain` ont des tests Vitest) — vérification par navigateur (`vite dev`) en fin de plan, conformément à la convention du projet.

**Référence :** [docs/superpowers/specs/2026-09-22-amenagactif-accompagnants-statut-design.md](../specs/2026-09-22-amenagactif-accompagnants-statut-design.md), section 1.

---

### Task 1: Migration — colonne `statut` sur `ar_eleves`

**Files:**
- Create: `supabase/migrations/20260922_amenagactif_statut_eleve.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- AménagActif — statut IPT/PAR par élève (Intégration Permanente Totale /
-- Protocole d'Aménagements Raisonnables). Champ de tri, ne conditionne
-- aucun affichage de fiche (voir spec 2026-09-22, section 1).

begin;

-- Seules des données de test ("École test") existent à ce jour : on les
-- bascule sur 'PAR' avant de rendre la colonne obligatoire, pour que la
-- migration ne casse pas si des lignes de test subsistent à l'exécution.
alter table ar_eleves add column if not exists statut text;
update ar_eleves set statut = 'PAR' where statut is null;
alter table ar_eleves alter column statut set not null;
alter table ar_eleves add constraint ar_eleves_statut_check check (statut in ('IPT', 'PAR'));

commit;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260922_amenagactif_statut_eleve.sql
git commit -m "feat(db): ajoute le statut IPT/PAR obligatoire sur ar_eleves"
```

- [ ] **Step 3: Demander à JF d'exécuter la migration**

Cette migration touche le projet Supabase partagé `dfoaumjleqtxjeaplnna` — comme toutes les précédentes, elle doit être exécutée par JF (SQL editor Supabase), pas par l'agent. Signaler explicitement ce point avant de continuer aux tâches suivantes : les tâches 2 à 5 supposent la colonne `statut` déjà présente en base pour être testées en conditions réelles (`vite dev` contre la vraie base). Le code peut être écrit avant, mais la vérification finale (Task 5) attend l'exécution.

---

### Task 2: Exposer `statut` dans la requête de grille

**Files:**
- Modify: `src/hooks/useEcoleGrid.js:39`

- [ ] **Step 1: Ajouter la colonne au `select`**

Ligne actuelle :

```js
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, commentaire').in('classe_id', classeIds).order('prenom');
```

Remplacer par :

```js
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, commentaire, statut').in('classe_id', classeIds).order('prenom');
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useEcoleGrid.js
git commit -m "feat: expose le statut IPT/PAR dans la grille de saisie"
```

---

### Task 3: Accepter `statut` dans la mutation `upsertEleve`

**Files:**
- Modify: `src/hooks/useGridMutations.js:35-47`

- [ ] **Step 1: Étendre la mutation**

Code actuel :

```js
  const upsertEleve = useMutation({
    mutationFn: async ({ id, classeId, prenom, initialeNom, commentaire }) => {
      const row = { prenom, initiale_nom: initialeNom ?? '', commentaire: commentaire ?? '' };
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

Remplacer par :

```js
  const upsertEleve = useMutation({
    mutationFn: async ({ id, classeId, prenom, initialeNom, commentaire, statut }) => {
      const row = { prenom, initiale_nom: initialeNom ?? '', commentaire: commentaire ?? '', statut };
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

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useGridMutations.js
git commit -m "feat: upsertEleve transmet le statut IPT/PAR"
```

---

### Task 4: Champ statut dans l'édition d'un élève existant

**Files:**
- Modify: `src/components/saisie/EleveEditor.jsx`

- [ ] **Step 1: Ajouter l'état et le champ**

Remplacer le début du composant (imports + déclarations d'état, lignes 1-8) :

```jsx
import { useState } from 'react';

export default function EleveEditor({ eleve, onSave, onDelete, onClose }) {
  const [prenom, setPrenom] = useState(eleve?.prenom ?? '');
  const [initiale, setInitiale] = useState(eleve?.initiale_nom ?? '');
  const [commentaire, setCommentaire] = useState(eleve?.commentaire ?? '');
  const [statut, setStatut] = useState(eleve?.statut ?? '');
  const [etat, setEtat] = useState('idle'); // idle | enregistrement | enregistre | suppression | erreur
  const [erreur, setErreur] = useState('');

  const enCours = etat === 'enregistrement' || etat === 'suppression';
```

Modifier `enregistrer` (ligne 12-23 actuelle) pour transmettre `statut` :

```jsx
  const enregistrer = async () => {
    setEtat('enregistrement');
    setErreur('');
    try {
      await onSave({ prenom, initialeNom: initiale, commentaire, statut });
      setEtat('enregistre');
      setTimeout(onClose, 600);
    } catch (e) {
      setEtat('erreur');
      setErreur(e.message || "Échec de l'enregistrement, réessayez.");
    }
  };
```

Insérer le champ statut juste après le bloc "Initiale du nom" (après la ligne `</div>` qui suit `initiale_nom`, avant le bloc "Commentaire") :

```jsx
      <div>
        <label className="block text-sm font-medium">Statut</label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" name={`statut-${eleve?.id ?? 'nouveau'}`} value="IPT" checked={statut === 'IPT'}
              onChange={() => setStatut('IPT')} disabled={enCours} />
            IPT
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name={`statut-${eleve?.id ?? 'nouveau'}`} value="PAR" checked={statut === 'PAR'}
              onChange={() => setStatut('PAR')} disabled={enCours} />
            PAR
          </label>
        </div>
        <p className="text-xs text-[color:var(--text3)]">
          IPT (Intégration Permanente Totale) : pas de protocole formel. PAR (Protocole d'Aménagements Raisonnables) :
          élève suivi par un protocole officiel — les AR/AU cochés ci-dessous devront y être reportés. Ne change rien
          à l'affichage de cette fiche, sert uniquement à trier les élèves plus tard.
        </p>
      </div>
```

- [ ] **Step 2: Rendre "Enregistrer" indisponible tant que le statut n'est pas choisi**

Ligne actuelle (bouton Enregistrer) :

```jsx
        <button className="plai-btn" onClick={enregistrer} disabled={!prenom.trim() || enCours}>
```

Remplacer par :

```jsx
        <button className="plai-btn" onClick={enregistrer} disabled={!prenom.trim() || !statut || enCours}>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/saisie/EleveEditor.jsx
git commit -m "feat: champ statut IPT/PAR obligatoire dans EleveEditor"
```

---

### Task 5: Champ statut à la création d'un élève

**Files:**
- Modify: `src/components/saisie/AjoutEleve.jsx`

- [ ] **Step 1: Ajouter le champ au formulaire de création**

Fichier complet remplacé :

```jsx
import { useState } from 'react';

export default function AjoutEleve({ onCreate }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ prenom: '', initiale: '', commentaire: '', statut: '' });
  const [etat, setEtat] = useState('idle'); // idle | creation | erreur
  const [erreur, setErreur] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!ouvert) return <button className="plai-btn" onClick={() => setOuvert(true)}>+ élève</button>;

  const soumettre = async (e) => {
    e.preventDefault();
    setEtat('creation');
    setErreur('');
    try {
      await onCreate(f);
      setOuvert(false);
      setEtat('idle');
      setF({ prenom: '', initiale: '', commentaire: '', statut: '' });
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
      <div className="text-sm">
        <span className="block font-medium">Statut</span>
        <div className="flex gap-3">
          <label className="flex items-center gap-1">
            <input type="radio" name="statut-nouvel-eleve" value="IPT" checked={f.statut === 'IPT'}
              onChange={() => setF({ ...f, statut: 'IPT' })} disabled={enCours} />
            IPT
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="statut-nouvel-eleve" value="PAR" checked={f.statut === 'PAR'}
              onChange={() => setF({ ...f, statut: 'PAR' })} disabled={enCours} />
            PAR
          </label>
        </div>
        <span className="block text-xs text-[color:var(--text3)] font-normal">
          IPT (Intégration Permanente Totale) ou PAR (Protocole d'Aménagements Raisonnables) — modifiable ensuite en cliquant sur le nom de l'élève.
        </span>
      </div>
      <label className="text-sm w-full">Commentaire (facultatif)
        <textarea className="plai-input block w-full" rows={2} value={f.commentaire} onChange={set('commentaire')}
          placeholder="Ex. : décès de la grand-mère mi-septembre, vigilance émotionnelle" disabled={enCours} />
        <span className="block text-xs text-[color:var(--text3)] font-normal">Information ponctuelle, modifiable ensuite en cliquant sur le nom de l'élève.</span>
      </label>
      <button type="submit" className="plai-btn" disabled={enCours || !f.prenom.trim() || !f.statut}>{enCours ? 'Création…' : 'Créer'}</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
      {etat === 'erreur' && <p className="plai-error text-xs w-full">{erreur}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/saisie/AjoutEleve.jsx
git commit -m "feat: statut IPT/PAR obligatoire à la création d'un élève"
```

---

### Task 6: Vérification navigateur

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Lancer le serveur de dev**

Utiliser l'outil de preview du projet (`preview_start` avec la config `vite dev` de `.claude/launch.json` si présente, sinon `npm run dev`). Pas besoin de `vercel dev` ici : aucune fonction serverless n'est concernée par ce changement.

- [ ] **Step 2: Se connecter en admin et ouvrir Saisie**

Se rendre sur `/saisie`, choisir l'école de test et une classe.

- [ ] **Step 3: Vérifier la création**

Cliquer "+ élève", vérifier que le bouton "Créer" reste désactivé tant qu'aucun statut n'est choisi, choisir "PAR", créer un élève de test. Vérifier via `read_page` ou capture d'écran que l'élève apparaît dans la liste.

- [ ] **Step 4: Vérifier la modification**

Cliquer sur le nom de l'élève créé, vérifier que le radio "PAR" est bien pré-coché (valeur lue en base), basculer sur "IPT", cliquer "Enregistrer", rouvrir l'éditeur et vérifier que "IPT" est resté sélectionné après rechargement de la page (confirme la persistance en base, pas juste l'état local React).

- [ ] **Step 5: Vérifier qu'aucune fiche n'a changé**

Ouvrir la fiche classe (`/classe/:id/fiche`) pour la classe testée, confirmer qu'aucune section n'apparaît/disparaît selon le statut de l'élève de test (conforme à la spec : le statut ne pilote aucun affichage de fiche dans cette itération).

- [ ] **Step 6: Nettoyer les données de test**

Supprimer l'élève de test créé (bouton "Supprimer l'élève" dans l'éditeur), pour ne pas polluer l'école de test au-delà de ce qui existait déjà.

---

## Self-Review

- **Couverture spec** : section 1 de la spec entièrement couverte (colonne obligatoire, saisie création + édition, pas de filtre, pas de changement de fiche, éditable par tout profil ayant accès à `upsertEleve` — les profils `referent_plai`/`direction`/`admin` aujourd'hui ; l'extension à `agent_plai` fait partie du plan séparé sur les accompagnants, hors périmètre ici).
- **Pas de placeholder** : chaque étape contient le code exact, pas de "TODO".
- **Cohérence des types** : `statut` circule identiquement à travers `EleveEditor.jsx` → `SaisieEcole.jsx`/`EnTeteEleves.jsx` (déjà génériques, aucun changement requis dans ces deux fichiers car ils passent `{...v}` tel quel) → `useGridMutations.js` → `ar_eleves.statut`. Vérifié que `EnTeteEleves.jsx` et `SaisieEcole.jsx` n'ont pas besoin de modification : ils transmettent déjà l'objet complet retourné par `EleveEditor` sans en extraire les champs un par un.
