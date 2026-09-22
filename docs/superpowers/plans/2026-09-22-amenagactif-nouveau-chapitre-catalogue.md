# Création de nouveaux chapitres du catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de créer un nouveau chapitre du catalogue (13e, 14e…) depuis `Administration.jsx`, puis d'y ajouter des AU/AR — aujourd'hui seule l'édition/l'ajout d'aménagements *dans* un chapitre existant est possible, aucun moyen de créer un nouveau chapitre sans SQL manuel.

**Architecture:** Une mutation `ajouterChapitre` symétrique de `ajouterAmenagement` (même pattern « prochain ordre » + insert), et un petit formulaire `AjoutChapitre` réutilisant le style de `AjoutAmenagement`, ajouté en bas de la liste des chapitres dans `SectionCatalogue`. Aucune migration ni changement RLS : la policy `ar_ref_write_chap` (`for all to authenticated using (ar_is_plai())`) couvre déjà l'insertion sur `ar_chapitres` pour l'admin.

**Tech Stack:** React 18, `@tanstack/react-query` v5, Supabase.

**Contexte :** demande de JF après la mise en place de la vue admin écoles/implantations, hors spec du 2026-09-22 (pas de section dédiée — fonctionnalité ponctuelle, documentée ici directement).

---

### Task 1: Mutation `ajouterChapitre`

**Files:**
- Modify: `src/hooks/useAdmin.js:96-138`

- [ ] **Step 1: Ajouter le helper et la mutation**

Code actuel de `useCatalogueMutations` (lignes 96-138) :

```js
export function useCatalogueMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['catalogue'] });
    qc.invalidateQueries({ queryKey: ['catalogue-admin'] });
  };

  const prochainOrdre = async (chapitreId) => {
    const { data } = await supabase
      .from('ar_amenagements').select('ordre').eq('chapitre_id', chapitreId)
      .order('ordre', { ascending: false }).limit(1);
    return (data?.[0]?.ordre ?? 0) + 1;
  };

  const majAmenagement = useMutation({
    mutationFn: async ({ id, libelle, type, actif, chapitreId }) => {
      const patch = {};
      if (libelle !== undefined) patch.libelle = libelle.trim();
      if (type !== undefined) patch.type = type;
      if (actif !== undefined) patch.actif = actif;
      if (chapitreId !== undefined) {
        patch.chapitre_id = chapitreId;
        patch.ordre = await prochainOrdre(chapitreId);
      }
      const { error } = await supabase.from('ar_amenagements').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const ajouterAmenagement = useMutation({
    mutationFn: async ({ chapitreId, libelle, type }) => {
      const ordre = await prochainOrdre(chapitreId);
      const { error } = await supabase.from('ar_amenagements').insert({
        chapitre_id: chapitreId, ordre, libelle: libelle.trim(), type, actif: true,
      });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { majAmenagement, ajouterAmenagement };
}
```

Remplacer par (ajout du helper `prochainOrdreChapitre`, de la mutation `ajouterChapitre`, et de son export — le reste de la fonction est inchangé) :

```js
export function useCatalogueMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['catalogue'] });
    qc.invalidateQueries({ queryKey: ['catalogue-admin'] });
  };

  const prochainOrdre = async (chapitreId) => {
    const { data } = await supabase
      .from('ar_amenagements').select('ordre').eq('chapitre_id', chapitreId)
      .order('ordre', { ascending: false }).limit(1);
    return (data?.[0]?.ordre ?? 0) + 1;
  };

  const prochainOrdreChapitre = async () => {
    const { data } = await supabase
      .from('ar_chapitres').select('ordre')
      .order('ordre', { ascending: false }).limit(1);
    return (data?.[0]?.ordre ?? 0) + 1;
  };

  const majAmenagement = useMutation({
    mutationFn: async ({ id, libelle, type, actif, chapitreId }) => {
      const patch = {};
      if (libelle !== undefined) patch.libelle = libelle.trim();
      if (type !== undefined) patch.type = type;
      if (actif !== undefined) patch.actif = actif;
      if (chapitreId !== undefined) {
        patch.chapitre_id = chapitreId;
        patch.ordre = await prochainOrdre(chapitreId);
      }
      const { error } = await supabase.from('ar_amenagements').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const ajouterAmenagement = useMutation({
    mutationFn: async ({ chapitreId, libelle, type }) => {
      const ordre = await prochainOrdre(chapitreId);
      const { error } = await supabase.from('ar_amenagements').insert({
        chapitre_id: chapitreId, ordre, libelle: libelle.trim(), type, actif: true,
      });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const ajouterChapitre = useMutation({
    mutationFn: async ({ titre }) => {
      const ordre = await prochainOrdreChapitre();
      const { error } = await supabase.from('ar_chapitres').insert({ ordre, titre: titre.trim() });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { majAmenagement, ajouterAmenagement, ajouterChapitre };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAdmin.js
git commit -m "feat: ajoute la mutation ajouterChapitre au catalogue"
```

---

### Task 2: Formulaire `AjoutChapitre` et intégration dans `SectionCatalogue`

**Files:**
- Modify: `src/pages/Administration.jsx:126-199` (`SectionCatalogue`), ajout d'un nouveau composant `AjoutChapitre` juste après `AjoutAmenagement`

- [ ] **Step 1: Étendre `SectionCatalogue`**

Code actuel (lignes 126-199, montré en entier pour repère — seules les lignes marquées changent) :

```jsx
/* ─────────────── Catalogue des aménagements ─────────────── */
function SectionCatalogue() {
  const { data } = useCatalogueAdmin();
  const { majAmenagement, ajouterAmenagement } = useCatalogueMutations();
  const [ouvert, setOuvert] = useState(null);
  const chapitres = data?.chapitres ?? [];
  const amenagements = data?.amenagements ?? [];

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Catalogue des aménagements</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Repris du classeur source. <strong>AU</strong> = universel (coché par classe, bloc « Pour tous »). <strong>AR</strong> = raisonnable (coché par élève).
        Changer un type ne touche pas aux cases déjà cochées, mais celles-ci peuvent devenir sans effet sur la fiche — vérifiez ensuite les classes concernées.
        Désactiver retire l'aménagement des écrans sans le supprimer.
      </p>
      <div className="border border-[color:var(--border)] rounded divide-y divide-[color:var(--border)]">
        {chapitres.map((ch) => {
          /* ... inchangé ... */
        })}
      </div>
      {(majAmenagement.isError || ajouterAmenagement.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}
```

Remplacer par (3 changements : déstructuration de `ajouterChapitre`, ajout de `<AjoutChapitre>` après le `<div>` des chapitres, extension de la condition d'erreur — le `.map` interne des chapitres reste identique) :

```jsx
/* ─────────────── Catalogue des aménagements ─────────────── */
function SectionCatalogue() {
  const { data } = useCatalogueAdmin();
  const { majAmenagement, ajouterAmenagement, ajouterChapitre } = useCatalogueMutations();
  const [ouvert, setOuvert] = useState(null);
  const chapitres = data?.chapitres ?? [];
  const amenagements = data?.amenagements ?? [];

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Catalogue des aménagements</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Repris du classeur source. <strong>AU</strong> = universel (coché par classe, bloc « Pour tous »). <strong>AR</strong> = raisonnable (coché par élève).
        Changer un type ne touche pas aux cases déjà cochées, mais celles-ci peuvent devenir sans effet sur la fiche — vérifiez ensuite les classes concernées.
        Désactiver retire l'aménagement des écrans sans le supprimer.
      </p>
      <div className="border border-[color:var(--border)] rounded divide-y divide-[color:var(--border)]">
        {chapitres.map((ch) => {
          /* ... inchangé, ne pas toucher ... */
        })}
      </div>
      <AjoutChapitre onAdd={ajouterChapitre.mutate} />
      {(majAmenagement.isError || ajouterAmenagement.isError || ajouterChapitre.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}
```

**Important** : le `.map((ch) => { ... })` interne (le rendu de chaque chapitre existant, avec ses aménagements et son `<AjoutAmenagement>`) ne change pas du tout — ne le retape pas, laisse-le tel quel dans le fichier réel. Seules les 3 lignes indiquées ci-dessus bougent.

- [ ] **Step 2: Ajouter le composant `AjoutChapitre`, juste après `AjoutAmenagement`**

`AjoutAmenagement` se termine par (vérifier l'emplacement exact dans le fichier réel, autour de la ligne 201-220) :

```jsx
function AjoutAmenagement({ chapitreId, onAdd }) {
  /* ... */
}
```

Ajouter juste après cette fonction (avant toute autre fonction qui suit dans le fichier) :

```jsx

function AjoutChapitre({ onAdd }) {
  const [titre, setTitre] = useState('');
  return (
    <form className="border border-dashed border-teal rounded p-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); if (titre.trim()) { onAdd({ titre }); setTitre(''); } }}>
      <label className="text-sm flex-1 min-w-[12rem]">Nouveau chapitre
        <input className="plai-input block w-full" placeholder="Ex. : Accompagnement numérique"
          value={titre} onChange={(e) => setTitre(e.target.value)} />
        <span className="block text-xs text-[color:var(--text3)] font-normal">
          Ajouté à la fin de la liste (13e chapitre, 14e…). Une fois créé, dépliez-le ci-dessus pour y ajouter des AU/AR.
        </span>
      </label>
      <button className="plai-btn" type="submit" disabled={!titre.trim()}>Ajouter le chapitre</button>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Administration.jsx
git commit -m "feat: formulaire de création d'un nouveau chapitre de catalogue"
```

---

### Task 3: Vérification navigateur

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Lancer le serveur de dev et se connecter en admin**

Se rendre sur `/administration`, section "Catalogue des aménagements".

- [ ] **Step 2: Créer un nouveau chapitre**

En bas de la liste des chapitres, remplir "Nouveau chapitre" avec un titre de test (ex. « Chapitre test »), cliquer "Ajouter le chapitre". Vérifier qu'il apparaît en dernière position de la liste (après le 12e chapitre existant), replié par défaut.

- [ ] **Step 3: Ajouter un AR dans ce nouveau chapitre**

Déplier le chapitre créé, utiliser le formulaire "+ aménagement" déjà existant (`AjoutAmenagement`, inchangé) pour y ajouter un AR de test. Vérifier qu'il apparaît bien dans ce chapitre, et qu'il est disponible côté saisie (`/saisie`, sélectionner une classe, vérifier que le chapitre et l'aménagement apparaissent dans la grille).

- [ ] **Step 4: Nettoyer**

Pas de suppression de chapitre possible dans cette itération (hors périmètre — cohérent avec le catalogue existant où les aménagements se désactivent mais les chapitres ne se suppriment pas). Si un chapitre de test a été créé, laisser une note à JF pour qu'il le renomme en un chapitre réel utile, ou qu'il demande une extension future (suppression/désactivation de chapitre) si le besoin se confirme.

---

## Self-Review

- **Couverture de la demande** : création de chapitre (le manque identifié) + réutilisation telle quelle du mécanisme d'ajout de contenu déjà existant (`AjoutAmenagement`, déjà capable d'ajouter des AU et des AR dans n'importe quel chapitre, y compris nouveau) — couvre "chapitre ET son contenu" sans dupliquer de logique.
- **Pas de placeholder** : code exact à chaque étape (sauf le `.map` interne explicitement signalé comme non modifié, pour éviter qu'un exécutant ne le retape par erreur et introduise une divergence).
- **Cohérence des types** : `ajouterChapitre({ titre })` suit exactement le même pattern que `ajouterAmenagement({ chapitreId, libelle, type })` (calcul du prochain `ordre`, insert, invalidation via `inval()` partagé) — pas de nouvelle convention introduite.
- **Hors périmètre explicitement noté** : pas de suppression/désactivation de chapitre (pas demandé ; les items eux-mêmes restent désactivables individuellement, ce qui couvre déjà le cas d'un chapitre créé par erreur — on désactive son contenu plutôt que de le supprimer).
