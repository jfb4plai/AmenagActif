# Accompagnants (agent_plai) par élève Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le rôle `agent_plai` (aujourd'hui lecture seule sur toute une école fixe) par un modèle d'assignation par élève, multi-écoles : le référent/la direction de l'école d'un élève assigne un ou plusieurs comptes `agent_plai` du pôle à cet élève, qui peut alors saisir ses AR, les AU de sa classe, et corriger son statut IPT/PAR — dans un nouvel écran dédié (`/mes-eleves`), pas dans la grille école complète.

**Architecture:** Une table de liaison `ar_accompagnants_eleve` (élève ↔ compte), deux fonctions RLS (`ar_is_accompagnant_eleve`, `ar_is_accompagnant_classe`) qui étendent les politiques d'écriture existantes, et une extension de `ar_can_read_ecole()` (déjà utilisée par la quasi-totalité des politiques de lecture) qui propage automatiquement l'accès en lecture sans toucher à une seule autre politique. Côté app : un endpoint serverless pour lister les comptes `agent_plai` du pôle (RLS ne le permet pas directement à un référent), une section d'assignation dans `/mon-ecole`, et un nouvel écran `/mes-eleves` qui réutilise tels quels les composants de saisie existants (`BandeauAU`, `EnTeteEleves`, `ChapitreAR`) au lieu d'en recréer.

**Tech Stack:** React 18, `@tanstack/react-query` v5, Supabase (Postgres + RLS), Vercel Serverless Functions.

**Référence :** [docs/superpowers/specs/2026-09-22-amenagactif-accompagnants-statut-design.md](../specs/2026-09-22-amenagactif-accompagnants-statut-design.md), section 3.

**Dépendance déjà résolue** : ce plan suppose la colonne `ar_eleves.statut` (IPT/PAR) présente — la migration correspondante est sur `main` depuis le 2026-09-22 (fusion de la branche statut IPT/PAR).

---

### Task 1: Migration — table `ar_accompagnants_eleve` + RLS

**Files:**
- Create: `supabase/migrations/20260922c_amenagactif_accompagnants_eleve.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- AménagActif — accompagnants (agent_plai) assignés par élève, multi-écoles.
-- Remplace le modèle "agent_plai rattaché à une seule ecole_id" par une
-- assignation élève par élève, gérée par le référent/la direction de
-- l'école de l'élève. Voir spec 2026-09-22, section 3.

begin;

create table ar_accompagnants_eleve (
  eleve_id uuid not null references ar_eleves(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  cree_le  timestamptz not null default now(),
  cree_par uuid references auth.users(id),
  primary key (eleve_id, user_id)
);

alter table ar_accompagnants_eleve enable row level security;

-- Les comptes agent_plai existants perdent leur rattachement d'école fixe :
-- leur périmètre devient entièrement déterminé par les assignations ci-dessus.
update ar_profils_acces set ecole_id = null where role = 'agent_plai';

-- ── Helpers ──
create or replace function ar_is_accompagnant_eleve(target_eleve uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_accompagnants_eleve
    where eleve_id = target_eleve and user_id = auth.uid()
  );
$$;

create or replace function ar_is_accompagnant_classe(target_classe uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ar_accompagnants_eleve ae
    join ar_eleves e on e.id = ae.eleve_id
    where e.classe_id = target_classe and ae.user_id = auth.uid()
  );
$$;

-- ar_can_read_ecole étend la lecture : un agent avec au moins un élève
-- assigné dans une école lit toute cette école (même logique de périmètre
-- que le modèle précédent, déclenchée par l'assignation plutôt que par un
-- rattachement fixe). Toutes les politiques de lecture existantes qui
-- appellent déjà ar_can_read_ecole(...) (écoles, classes, élèves,
-- enseignants, AU/AR/libres/snapshots) en bénéficient automatiquement,
-- sans toucher à une seule autre politique.
create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces where user_id = auth.uid() and ecole_id = target
  ) or exists (
    select 1 from ar_accompagnants_eleve ae
    join ar_eleves e on e.id = ae.eleve_id
    join ar_classes c on c.id = e.classe_id
    where ae.user_id = auth.uid() and c.ecole_id = target
  );
$$;

-- ── Écriture élargie pour l'accompagnant assigné ──
drop policy if exists ar_eleves_write on ar_eleves;
create policy ar_eleves_write on ar_eleves for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_eleve(id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_eleve(id));

drop policy if exists ar_selections_write on ar_selections;
create policy ar_selections_write on ar_selections for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id));

drop policy if exists ar_libres_write on ar_amenagements_libres;
create policy ar_libres_write on ar_amenagements_libres for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)) or ar_is_accompagnant_eleve(eleve_id));

drop policy if exists ar_amgt_classe_write on ar_amenagements_classe;
create policy ar_amgt_classe_write on ar_amenagements_classe for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_classe(classe_id))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c where c.id = classe_id)) or ar_is_accompagnant_classe(classe_id));

-- ── ar_accompagnants_eleve : lecture par l'agent concerné ou par
-- référent/direction/admin de l'école de l'élève ; écriture réservée à
-- référent/direction/admin (les agents ne s'auto-assignent pas).
create policy ar_accomp_read on ar_accompagnants_eleve for select to authenticated
  using (
    user_id = auth.uid()
    or ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id))
  );
create policy ar_accomp_write on ar_accompagnants_eleve for all to authenticated
  using (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)))
  with check (ar_can_edit_ecole((select c.ecole_id from ar_classes c join ar_eleves e on e.classe_id = c.id where e.id = eleve_id)));

commit;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260922c_amenagactif_accompagnants_eleve.sql
git commit -m "feat(db): table accompagnants_eleve + RLS multi-écoles pour agent_plai"
```

- [ ] **Step 3: Note** — migration sur le projet Supabase partagé, à exécuter manuellement par JF comme les précédentes. Le code des tâches suivantes peut être écrit et testé (hors appels réseau réels) avant son exécution, mais la vérification finale (Task 15) l'exige.

---

### Task 2: `api/membres.js` — agent_plai n'exige plus d'école à l'invitation

**Files:**
- Modify: `api/membres.js:5`

- [ ] **Step 1: Retirer `agent_plai` de `ROLE_SCOPE`**

Ligne actuelle :

```js
const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai'];
```

Remplacer par :

```js
const ROLE_SCOPE = ['referent_plai', 'direction'];
```

Le reste du fichier n'a besoin d'aucun autre changement : `scoped = ROLE_SCOPE.includes(role)` devient `false` pour `agent_plai`, donc `ecolePour()` renvoie `null` et la validation `if (scoped && !ecoleId)` ne bloque plus une invitation `agent_plai` sans école — que ce soit à la création (`action: 'invite'`) ou au changement de rôle (`action: 'setProfil'`).

- [ ] **Step 2: Commit**

```bash
git add api/membres.js
git commit -m "feat: agent_plai n'est plus rattaché à une école à l'invitation"
```

---

### Task 3: `Administration.jsx` — synchroniser le `ROLE_SCOPE` local

**Files:**
- Modify: `src/pages/Administration.jsx:9`

- [ ] **Step 1: Retirer `agent_plai` du `ROLE_SCOPE` local**

Ligne actuelle :

```js
const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai']; // rôles rattachés à une école
```

Remplacer par :

```js
const ROLE_SCOPE = ['referent_plai', 'direction']; // rôles rattachés à une école
```

Ce fichier a son propre `ROLE_SCOPE` (dupliqué de celui d'`api/membres.js`, pattern déjà existant). `besoinEcole('agent_plai')` devient `false` : le sélecteur d'école disparaît automatiquement du formulaire d'invitation et de la ligne membre quand le rôle est `agent_plai` — aucun autre changement requis dans ce fichier pour ce point.

- [ ] **Step 2: Commit**

```bash
git add src/pages/Administration.jsx
git commit -m "feat: synchronise ROLE_SCOPE (agent_plai sans école) côté Administration"
```

---

### Task 4: Endpoint `api/agents-plai.js`

**Files:**
- Create: `api/agents-plai.js`

- [ ] **Step 1: Écrire l'endpoint**

```js
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/** Retourne l'utilisateur appelant s'il a un rôle d'édition d'école (admin/référent/direction), sinon null. */
async function exigerEditeur(req) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: acc } = await db
    .from('ar_profils_acces').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!acc || !['admin', 'referent_plai', 'direction'].includes(acc.role)) return null;
  return data.user;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Méthode non supportée.' }); return; }
    const moi = await exigerEditeur(req);
    if (!moi) { res.status(403).json({ error: 'Réservé aux référents PLAI, directions et administrateurs.' }); return; }
    const db = supabaseAdmin();
    const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, nom').eq('role', 'agent_plai');
    if (error) throw error;
    const agents = await Promise.all(
      rows.map(async (r) => {
        const { data } = await db.auth.admin.getUserById(r.user_id);
        return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '' };
      })
    );
    agents.sort((a, b) => (a.nom || a.email).localeCompare(b.nom || b.email));
    res.status(200).json({ agents });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
```

## Contexte

`ar_profils_acces` n'est lisible (RLS) que par soi-même, par un admin, ou par un membre de la même `ecole_id` ([20260904b_amenagactif_referents.sql](../../../supabase/migrations/20260904b_amenagactif_referents.sql)). Comme les comptes `agent_plai` ont désormais `ecole_id = null` (Task 1), aucun référent/direction ne peut les lister via le client Supabase direct — d'où cet endpoint à privilège élevé (`supabaseAdmin`, service role), sur le modèle exact d'`api/membres.js`, mais en lecture seule et ouvert aux référents/directions (pas admin-only).

- [ ] **Step 2: Commit**

```bash
git add api/agents-plai.js
git commit -m "feat: endpoint api/agents-plai pour lister les comptes agent_plai du pôle"
```

---

### Task 5: Hook `useAgentsPlai`

**Files:**
- Create: `src/hooks/useAgentsPlai.js`

- [ ] **Step 1: Écrire le hook**

```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Tous les comptes agent_plai du pôle (nom, email) — pour l'assignation d'accompagnants. */
export function useAgentsPlai() {
  return useQuery({
    queryKey: ['agents-plai'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/agents-plai', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
      return json.agents;
    },
  });
}
```

Suit exactement le pattern déjà utilisé par `apiMembres` dans [useMembres.js](../../../src/hooks/useMembres.js).

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAgentsPlai.js
git commit -m "feat: hook useAgentsPlai"
```

---

### Task 6: Hook `useAccompagnants` (lecture + assignation)

**Files:**
- Create: `src/hooks/useAccompagnants.js`

- [ ] **Step 1: Écrire le hook**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Accompagnants assignés à chaque élève d'un ensemble donné (eleveIds). */
export function useAccompagnantsEleves(eleveIds) {
  return useQuery({
    queryKey: ['accompagnants', [...eleveIds].sort()],
    enabled: eleveIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_accompagnants_eleve').select('eleve_id, user_id').in('eleve_id', eleveIds);
      if (error) throw error;
      return data;
    },
  });
}

export function useAccompagnantsMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['accompagnants'] });

  const assigner = useMutation({
    mutationFn: async ({ eleveId, userId }) => {
      const { error } = await supabase.from('ar_accompagnants_eleve').insert({ eleve_id: eleveId, user_id: userId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: inval,
  });

  const retirer = useMutation({
    mutationFn: async ({ eleveId, userId }) => {
      const { error } = await supabase.from('ar_accompagnants_eleve').delete().eq('eleve_id', eleveId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { assigner, retirer };
}
```

Pattern identique à `useGridMutations.js` (`toggleAR`/`toggleAU`) : `error.code !== '23505'` tolère une double-assignation (clé déjà présente) sans faire planter l'UI.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAccompagnants.js
git commit -m "feat: hook useAccompagnants (lecture + assignation)"
```

---

### Task 7: `MonEcole.jsx` — section « Accompagnants par élève »

**Files:**
- Modify: `src/pages/MonEcole.jsx`

- [ ] **Step 1: Remplacer le fichier complet**

Fichier actuel :

```jsx
import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useEquipeEcole } from '../hooks/useAdmin.js';
import { useRole } from '../lib/auth.jsx';

const LABEL = { referent_plai: 'Référent PLAI', direction: 'Direction' };

export default function MonEcole() {
  const { isAdmin, ecoleId } = useRole();
  const { data: ecoles = [], isLoading } = useEcoles();

  // Non-admin : RLS ne renvoie que son école.
  const ecole = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const { data: equipe = [] } = useEquipeEcole(ecole?.id ?? ecoleId ?? null);

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  if (isAdmin) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-empty">En tant qu'administrateur, gérez les écoles et les membres dans « Administration ».</p>
      </div>
    );
  }

  if (!ecole) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-error">Aucune école n'est rattachée à votre compte. Contactez l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="plai-section space-y-6 max-w-3xl px-4">
      <h1 className="text-xl font-semibold">Mon école — {ecole.nom}</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Équipe de l'implantation</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Ces noms alimentent les colonnes « Référent(s) PLAI » et « PAR (Direction) » des fiches.
          Pour ajouter ou retirer une personne, ou corriger un nom, contactez l'administrateur.
        </p>
        <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
          {equipe.length === 0 && <li className="px-3 py-2 text-sm text-[color:var(--text3)]">Aucun membre enregistré.</li>}
          {equipe.map((m) => (
            <li key={m.user_id} className="px-3 py-2 flex justify-between">
              <span>{m.nom || <span className="text-[color:var(--text3)]">(nom non renseigné)</span>}</span>
              <span className="text-sm text-[color:var(--text3)]">{LABEL[m.role] ?? m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* À venir (Plan 2) : gestion des enseignants par classe. */}
    </div>
  );
}
```

Remplacer par :

```jsx
import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useEquipeEcole, useAnneeActive } from '../hooks/useAdmin.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useAgentsPlai } from '../hooks/useAgentsPlai.js';
import { useAccompagnantsEleves, useAccompagnantsMutations } from '../hooks/useAccompagnants.js';
import { useRole } from '../lib/auth.jsx';

const LABEL = { referent_plai: 'Référent PLAI', direction: 'Direction' };

export default function MonEcole() {
  const { isAdmin, ecoleId } = useRole();
  const { data: ecoles = [], isLoading } = useEcoles();

  // Non-admin : RLS ne renvoie que son école.
  const ecole = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const { data: equipe = [] } = useEquipeEcole(ecole?.id ?? ecoleId ?? null);

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  if (isAdmin) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-empty">En tant qu'administrateur, gérez les écoles et les membres dans « Administration ».</p>
      </div>
    );
  }

  if (!ecole) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-error">Aucune école n'est rattachée à votre compte. Contactez l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="plai-section space-y-6 max-w-3xl px-4">
      <h1 className="text-xl font-semibold">Mon école — {ecole.nom}</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Équipe de l'implantation</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Ces noms alimentent les colonnes « Référent(s) PLAI » et « PAR (Direction) » des fiches.
          Pour ajouter ou retirer une personne, ou corriger un nom, contactez l'administrateur.
        </p>
        <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
          {equipe.length === 0 && <li className="px-3 py-2 text-sm text-[color:var(--text3)]">Aucun membre enregistré.</li>}
          {equipe.map((m) => (
            <li key={m.user_id} className="px-3 py-2 flex justify-between">
              <span>{m.nom || <span className="text-[color:var(--text3)]">(nom non renseigné)</span>}</span>
              <span className="text-sm text-[color:var(--text3)]">{LABEL[m.role] ?? m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <SectionAccompagnants ecoleId={ecole.id} />

      {/* À venir (Plan 2) : gestion des enseignants par classe. */}
    </div>
  );
}

function SectionAccompagnants({ ecoleId }) {
  const anneeActive = useAnneeActive();
  const { data: grid, isLoading } = useEcoleGrid(ecoleId, anneeActive?.id ?? null);
  const { data: agents = [] } = useAgentsPlai();
  const eleves = grid?.eleves ?? [];
  const eleveIds = eleves.map((e) => e.id);
  const { data: assignations = [] } = useAccompagnantsEleves(eleveIds);
  const { assigner, retirer } = useAccompagnantsMutations();
  const classes = grid?.classes ?? [];
  const nomClasse = (classeId) => classes.find((c) => c.id === classeId)?.nom ?? '';
  const agentsDe = (eleveId) => assignations.filter((a) => a.eleve_id === eleveId).map((a) => a.user_id);
  const nomAgent = (userId) => { const a = agents.find((x) => x.userId === userId); return a ? (a.nom || a.email) : userId; };

  if (!anneeActive) return null;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Accompagnants par élève</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Un accompagnant assigné à un élève peut saisir ses AR, les AU de sa classe, et corriger son statut IPT/PAR — vérifiez la liste des comptes agent PLAI du pôle avant d'en ajouter un.
      </p>
      {isLoading ? <p>Chargement…</p> : eleves.length === 0 ? (
        <p className="plai-empty">Aucun élève encodé pour l'année active.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
          {eleves.map((e) => (
            <li key={e.id} className="px-3 py-2 space-y-1">
              <div className="text-sm font-medium">
                {e.prenom} {e.initiale_nom} <span className="text-[color:var(--text3)] font-normal">— {nomClasse(e.classe_id)}</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {agentsDe(e.id).map((userId) => (
                  <span key={userId} className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full flex items-center gap-1">
                    {nomAgent(userId)}
                    <button type="button" className="underline" onClick={() => retirer.mutate({ eleveId: e.id, userId })}>retirer</button>
                  </span>
                ))}
                <select className="plai-input !w-auto !py-1 text-xs" value=""
                  onChange={(ev) => { if (ev.target.value) assigner.mutate({ eleveId: e.id, userId: ev.target.value }); }}>
                  <option value="">+ assigner un accompagnant…</option>
                  {agents.filter((a) => !agentsDe(e.id).includes(a.userId)).map((a) => (
                    <option key={a.userId} value={a.userId}>{a.nom || a.email}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(assigner.isError || retirer.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/MonEcole.jsx
git commit -m "feat: section Accompagnants par élève dans Mon école"
```

---

### Task 8: `EleveEditor.jsx` — mode identité verrouillée (pour l'écran agent)

**Files:**
- Modify: `src/components/saisie/EleveEditor.jsx`

- [ ] **Step 1: Ajouter la prop `identiteVerrouillee`**

Fichier complet actuel :

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

  const supprimer = async () => {
    if (!confirm(`Supprimer la fiche de ${eleve.prenom} ${eleve.initiale_nom} ? Tous ses aménagements cochés seront retirés. Cette action est irréversible.`)) return;
    setEtat('suppression');
    setErreur('');
    try {
      await onDelete(eleve.id);
      onClose();
    } catch (e) {
      setEtat('erreur');
      setErreur(e.message || 'Échec de la suppression, réessayez.');
    }
  };

  return (
    <div className="plai-card p-3 space-y-2 w-72">
      <div>
        <label className="block text-sm font-medium">Prénom</label>
        <input className="plai-input w-full" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Emilie" disabled={enCours} />
      </div>
      <div>
        <label className="block text-sm font-medium">Initiale du nom</label>
        <input className="plai-input w-full" maxLength={2} value={initiale} onChange={(e) => setInitiale(e.target.value)} placeholder="D" disabled={enCours} />
        <p className="text-xs text-[color:var(--text3)]">Affichée « Emilie D. » sur la fiche. Pas de nom complet.</p>
      </div>
      <div>
        <label className="block text-sm font-medium">Statut administratif</label>
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
          IPT (Intégration Permanente Totale) ou PAR (Protocole d'Aménagements Raisonnables) — ne change rien à l'affichage de cette fiche, sert à trier les élèves plus tard.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium">Commentaire (facultatif)</label>
        <textarea className="plai-input w-full" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
          placeholder="Ex. : décès de la grand-mère mi-septembre, vigilance émotionnelle" disabled={enCours} />
        <p className="text-xs text-[color:var(--text3)]">Information ponctuelle, à effacer quand elle n'est plus pertinente. Apparaît en bas de la fiche classe et de la fiche élève — pas dans le tableau des AR.</p>
      </div>

      {etat === 'erreur' && <p className="plai-error text-xs">{erreur}</p>}
      {etat === 'enregistre' && <p className="plai-success text-xs">Enregistré ✓</p>}

      <div className="flex items-center gap-2">
        <button className="plai-btn" onClick={enregistrer} disabled={!prenom.trim() || !statut || enCours}>
          {etat === 'enregistrement' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button className="text-sm underline" onClick={onClose} disabled={enCours}>Annuler</button>
      </div>

      {eleve?.id && onDelete && (
        <div className="pt-2 border-t border-[color:var(--border)]">
          <button className="text-xs underline text-red-600" onClick={supprimer} disabled={enCours}>
            {etat === 'suppression' ? 'Suppression…' : "Supprimer l'élève (ex. départ)"}
          </button>
        </div>
      )}
    </div>
  );
}
```

Remplacer par (4 changements : nouvelle prop, prénom/initiale en lecture seule si verrouillé, commentaire masqué si verrouillé, bouton supprimer jamais affiché si verrouillé — le reste est inchangé) :

```jsx
import { useState } from 'react';

export default function EleveEditor({ eleve, onSave, onDelete, onClose, identiteVerrouillee }) {
  const [prenom, setPrenom] = useState(eleve?.prenom ?? '');
  const [initiale, setInitiale] = useState(eleve?.initiale_nom ?? '');
  const [commentaire, setCommentaire] = useState(eleve?.commentaire ?? '');
  const [statut, setStatut] = useState(eleve?.statut ?? '');
  const [etat, setEtat] = useState('idle'); // idle | enregistrement | enregistre | suppression | erreur
  const [erreur, setErreur] = useState('');

  const enCours = etat === 'enregistrement' || etat === 'suppression';

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

  const supprimer = async () => {
    if (!confirm(`Supprimer la fiche de ${eleve.prenom} ${eleve.initiale_nom} ? Tous ses aménagements cochés seront retirés. Cette action est irréversible.`)) return;
    setEtat('suppression');
    setErreur('');
    try {
      await onDelete(eleve.id);
      onClose();
    } catch (e) {
      setEtat('erreur');
      setErreur(e.message || 'Échec de la suppression, réessayez.');
    }
  };

  return (
    <div className="plai-card p-3 space-y-2 w-72">
      <div>
        <label className="block text-sm font-medium">Prénom</label>
        {identiteVerrouillee ? (
          <p className="plai-input w-full bg-[color:var(--border)]/30">{prenom}</p>
        ) : (
          <input className="plai-input w-full" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Emilie" disabled={enCours} />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">Initiale du nom</label>
        {identiteVerrouillee ? (
          <p className="plai-input w-full bg-[color:var(--border)]/30">{initiale}</p>
        ) : (
          <>
            <input className="plai-input w-full" maxLength={2} value={initiale} onChange={(e) => setInitiale(e.target.value)} placeholder="D" disabled={enCours} />
            <p className="text-xs text-[color:var(--text3)]">Affichée « Emilie D. » sur la fiche. Pas de nom complet.</p>
          </>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium">Statut administratif</label>
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
          IPT (Intégration Permanente Totale) ou PAR (Protocole d'Aménagements Raisonnables) — ne change rien à l'affichage de cette fiche, sert à trier les élèves plus tard.
        </p>
      </div>
      {!identiteVerrouillee && (
        <div>
          <label className="block text-sm font-medium">Commentaire (facultatif)</label>
          <textarea className="plai-input w-full" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ex. : décès de la grand-mère mi-septembre, vigilance émotionnelle" disabled={enCours} />
          <p className="text-xs text-[color:var(--text3)]">Information ponctuelle, à effacer quand elle n'est plus pertinente. Apparaît en bas de la fiche classe et de la fiche élève — pas dans le tableau des AR.</p>
        </div>
      )}

      {etat === 'erreur' && <p className="plai-error text-xs">{erreur}</p>}
      {etat === 'enregistre' && <p className="plai-success text-xs">Enregistré ✓</p>}

      <div className="flex items-center gap-2">
        <button className="plai-btn" onClick={enregistrer} disabled={!prenom.trim() || !statut || enCours}>
          {etat === 'enregistrement' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button className="text-sm underline" onClick={onClose} disabled={enCours}>Annuler</button>
      </div>

      {!identiteVerrouillee && eleve?.id && onDelete && (
        <div className="pt-2 border-t border-[color:var(--border)]">
          <button className="text-xs underline text-red-600" onClick={supprimer} disabled={enCours}>
            {etat === 'suppression' ? 'Suppression…' : "Supprimer l'élève (ex. départ)"}
          </button>
        </div>
      )}
    </div>
  );
}
```

Notes : `enregistrer()` continue d'envoyer `prenom`/`commentaire` tels quels (jamais modifiés en mode verrouillé puisqu'aucun input ne les édite) — cohérent avec la décision de la spec de ne pas verrouiller l'écriture `ar_eleves` au niveau colonne (RLS), seule l'UI restreint. La suppression est masquée pour un agent, même si la RLS `ar_eleves_write` la permettrait techniquement — un accompagnant n'a aucune raison de supprimer un élève.

- [ ] **Step 2: Commit**

```bash
git add src/components/saisie/EleveEditor.jsx
git commit -m "feat: mode identité verrouillée dans EleveEditor (statut seul éditable)"
```

---

### Task 9: `EnTeteEleves.jsx` — propager `identiteVerrouillee`

**Files:**
- Modify: `src/components/saisie/EnTeteEleves.jsx`

- [ ] **Step 1: Ajouter et transmettre la prop**

Fichier complet actuel :

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

Remplacer par :

```jsx
import { useState } from 'react';
import EleveEditor from './EleveEditor.jsx';

export default function EnTeteEleves({ eleves, onSaveEleve, onDeleteEleve, identiteVerrouillee }) {
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
                <EleveEditor eleve={e} onClose={() => setEditId(null)} identiteVerrouillee={identiteVerrouillee}
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

`identiteVerrouillee` est `undefined` (donc falsy) pour tous les appels existants (`SaisieEcole.jsx`) — comportement inchangé pour référent/direction/admin. Seul le futur écran agent (Task 12) passera `identiteVerrouillee={true}`.

- [ ] **Step 2: Commit**

```bash
git add src/components/saisie/EnTeteEleves.jsx
git commit -m "feat: EnTeteEleves transmet identiteVerrouillee à EleveEditor"
```

---

### Task 10: `BandeauAU.jsx` — encart d'avertissement

**Files:**
- Modify: `src/components/saisie/BandeauAU.jsx:20-26`

- [ ] **Step 1: Ajouter l'avertissement**

Lignes actuelles :

```jsx
  return (
    <section className="plai-card p-4" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal">Aménagements universels de la classe</h2>
      <p className="text-sm text-[color:var(--text3)] mb-3">
        S'appliquent à <strong>tous les élèves</strong> de la classe. Cochés ici une seule fois — ils forment le bloc « Pour tous » de la fiche.
        Les aménagements <strong>par élève</strong> sont dans les chapitres ci-dessous.
      </p>
```

Remplacer par :

```jsx
  return (
    <section className="plai-card p-4" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal">Aménagements universels de la classe</h2>
      <p className="text-sm text-[color:var(--text3)] mb-3">
        S'appliquent à <strong>tous les élèves</strong> de la classe. Cochés ici une seule fois — ils forment le bloc « Pour tous » de la fiche.
        Les aménagements <strong>par élève</strong> sont dans les chapitres ci-dessous.
      </p>
      <p className="text-sm text-amber-700 mb-3">
        Ne décochez jamais un AU sans certitude — il a probablement été coché par un·e collègue pour un autre élève de cette classe.
      </p>
```

Cet encart apparaît pour tout éditeur d'AU (référent, direction, admin, et désormais agent via l'écran `/mes-eleves` puisque ce composant y est réutilisé tel quel) — mesure sociale/UX, pas une restriction technique, cohérente avec la décision de ne pas verrouiller l'écriture des AU par accompagnant.

- [ ] **Step 2: Commit**

```bash
git add src/components/saisie/BandeauAU.jsx
git commit -m "feat: avertissement contre le décochage accidentel d'un AU partagé"
```

---

### Task 11: Hook `useElevesAccompagnes`

**Files:**
- Create: `src/hooks/useElevesAccompagnes.js`

- [ ] **Step 1: Écrire le hook**

```js
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Élèves assignés à l'agent connecté, toutes écoles confondues, avec contexte classe/école. */
export function useElevesAccompagnes(userId) {
  return useQuery({
    queryKey: ['eleves-accompagnes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: assignations, error: e1 } = await supabase
        .from('ar_accompagnants_eleve').select('eleve_id').eq('user_id', userId);
      if (e1) throw e1;
      const eleveIds = assignations.map((a) => a.eleve_id);
      if (eleveIds.length === 0) return { eleves: [], classes: [], ecoles: [] };

      const { data: eleves, error: e2 } = await supabase
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, commentaire, statut').in('id', eleveIds).order('prenom');
      if (e2) throw e2;

      const classeIds = [...new Set(eleves.map((e) => e.classe_id))];
      const { data: classes, error: e3 } = await supabase
        .from('ar_classes').select('id, nom, niveau, ecole_id, annee_id').in('id', classeIds);
      if (e3) throw e3;

      const ecoleIds = [...new Set(classes.map((c) => c.ecole_id))];
      const { data: ecoles, error: e4 } = await supabase
        .from('ar_ecoles').select('id, nom').in('id', ecoleIds);
      if (e4) throw e4;

      return { eleves, classes, ecoles };
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useElevesAccompagnes.js
git commit -m "feat: hook useElevesAccompagnes"
```

---

### Task 12: Page `MesElevesPage.jsx`

**Files:**
- Create: `src/pages/MesElevesPage.jsx`

- [ ] **Step 1: Écrire la page**

```jsx
import { useMemo } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useElevesAccompagnes } from '../hooks/useElevesAccompagnes.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useGridMutations } from '../hooks/useGridMutations.js';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';

export default function MesElevesPage() {
  const { session } = useAuth();
  const { data, isLoading, error } = useElevesAccompagnes(session?.user?.id);

  const groupes = useMemo(() => {
    if (!data || !data.eleves) return [];
    return data.classes
      .map((classe) => ({
        classe,
        ecole: data.ecoles.find((e) => e.id === classe.ecole_id),
        eleves: data.eleves.filter((e) => e.classe_id === classe.id),
      }))
      .filter((g) => g.eleves.length > 0);
  }, [data]);

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">Erreur de chargement : {error.message}</p></div>;

  return (
    <div className="plai-section space-y-6">
      <h1 className="text-xl font-semibold">Mes élèves accompagnés</h1>
      {groupes.length === 0 ? (
        <p className="plai-empty">Aucun élève ne vous est assigné pour l'instant. Contactez le référent PLAI ou la direction de l'école concernée.</p>
      ) : (
        groupes.map((g) => <ClasseAccompagnee key={g.classe.id} {...g} />)
      )}
    </div>
  );
}

function ClasseAccompagnee({ classe, ecole, eleves }) {
  const { data: cat } = useCatalogue();
  const { data: grid } = useEcoleGrid(classe.ecole_id, classe.annee_id);
  const mut = useGridMutations(classe.ecole_id, classe.annee_id);
  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');

  if (!grid || !cat) return <div className="plai-card p-4">Chargement de {classe.nom}…</div>;

  return (
    <div className="space-y-3 border-t border-[color:var(--border)] pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">
        {classe.nom} <span className="text-[color:var(--text3)] font-normal text-sm">— {ecole?.nom}</span>
      </h2>

      <BandeauAU classe={classe} auCatalogue={auCat} chapitres={chapitres}
        auClasse={grid.auClasse.filter((x) => x.classe_id === classe.id)} onToggle={(v) => mut.toggleAU.mutate(v)} />

      <div className="overflow-x-auto border border-[color:var(--border)] rounded">
        <table className="border-collapse text-sm">
          <EnTeteEleves eleves={eleves} identiteVerrouillee
            onSaveEleve={(v) => mut.upsertEleve.mutateAsync(v)} />
          <tbody>
            {chapitres.map((ch) => (
              <ChapitreAR key={ch.id} chapitre={ch}
                amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                eleves={eleves}
                selectionsAR={grid.selectionsAR}
                libres={grid.libres}
                filtre=""
                onToggle={(v) => mut.toggleAR.mutate(v)}
                onAddLibre={(v) => mut.addLibre.mutate(v)}
                onRemoveLibre={(v) => mut.removeLibre.mutate(v)} />
            ))}
          </tbody>
        </table>
      </div>
      {mut.toggleAR.isError && <p className="plai-error">Échec d'enregistrement, réessayez.</p>}
    </div>
  );
}
```

## Contexte

`ClasseAccompagnee` réutilise `useEcoleGrid(ecoleId, anneeId)` et `useGridMutations(ecoleId, anneeId)` — exactement les hooks déjà utilisés par `SaisieEcole.jsx` — mais filtre l'affichage aux seuls élèves assignés à l'agent (`eleves` reçu en prop, sous-ensemble de `grid.eleves`). Les mutations invalident donc la même clé de cache `['grille', ecoleId, anneeId]` que celle utilisée par la grille référent/direction : pas besoin de logique d'invalidation séparée. `EnTeteEleves` reçoit `identiteVerrouillee` (Task 9) pour que l'agent ne puisse éditer que le statut IPT/PAR, pas prénom/initiale/commentaire, ni supprimer l'élève. `AjoutEleve` n'est délibérément pas utilisé ici — un agent ne crée pas d'élève.

- [ ] **Step 2: Commit**

```bash
git add src/pages/MesElevesPage.jsx
git commit -m "feat: écran Mes élèves accompagnés pour le rôle agent_plai"
```

---

### Task 13: `App.jsx` — route `/mes-eleves`, redirection, restriction `/mon-ecole`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Remplacer le fichier complet**

Fichier actuel :

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import BandeauBascule from './components/BandeauBascule.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireRole from './components/RequireRole.jsx';
import { useRole } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import NouveauMotDePasse from './pages/NouveauMotDePasse.jsx';
import SaisieEcole from './pages/SaisieEcole.jsx';
import FicheClassePage from './pages/FicheClassePage.jsx';
import FicheEcolePage from './pages/FicheEcolePage.jsx';
import FicheElevePage from './pages/FicheElevePage.jsx';
import FichePublique from './pages/FichePublique.jsx';
import Administration from './pages/Administration.jsx';
import MonEcole from './pages/MonEcole.jsx';
import NotFound from './pages/NotFound.jsx';

const EDITEURS = ['admin', 'referent_plai', 'direction'];
const LECTEURS = [...EDITEURS, 'agent_plai']; // + accès lecture seule (fiches, mon école)

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <BandeauBascule />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Racine : les éditeurs (admin/référent/direction) vont vers la saisie, les rôles
 * lecture seule (agent accompagnant) vers la fiche vue école. */
function Accueil() {
  const { loading, editeurEcole } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  return <Navigate to={editeurEcole ? '/saisie' : '/fiches/ecole'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/nouveau-mot-de-passe" element={<NouveauMotDePasse />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Accueil /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/mon-ecole" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><MonEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/administration" element={<RequireAuth><Shell><RequireRole roles={['admin']}><Administration /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches/ecole" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheEcolePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
```

Remplacer par :

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import BandeauBascule from './components/BandeauBascule.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import RequireRole from './components/RequireRole.jsx';
import { useRole } from './lib/auth.jsx';
import Login from './pages/Login.jsx';
import NouveauMotDePasse from './pages/NouveauMotDePasse.jsx';
import SaisieEcole from './pages/SaisieEcole.jsx';
import FicheClassePage from './pages/FicheClassePage.jsx';
import FicheEcolePage from './pages/FicheEcolePage.jsx';
import FicheElevePage from './pages/FicheElevePage.jsx';
import FichePublique from './pages/FichePublique.jsx';
import Administration from './pages/Administration.jsx';
import MonEcole from './pages/MonEcole.jsx';
import MesElevesPage from './pages/MesElevesPage.jsx';
import NotFound from './pages/NotFound.jsx';

const EDITEURS = ['admin', 'referent_plai', 'direction'];
const LECTEURS = [...EDITEURS, 'agent_plai']; // + accès lecture seule (fiches)

function Shell({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <BandeauBascule />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Racine : les éditeurs (admin/référent/direction) vont vers la saisie, les
 * agents accompagnants vers leurs élèves assignés, les autres vers la fiche vue école. */
function Accueil() {
  const { loading, role, editeurEcole } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  if (editeurEcole) return <Navigate to="/saisie" replace />;
  if (role === 'agent_plai') return <Navigate to="/mes-eleves" replace />;
  return <Navigate to="/fiches/ecole" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Login />} />
      <Route path="/nouveau-mot-de-passe" element={<NouveauMotDePasse />} />
      <Route path="/fiche/:token" element={<FichePublique />} />
      <Route path="/" element={<RequireAuth><Shell><Accueil /></Shell></RequireAuth>} />
      <Route path="/saisie" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><SaisieEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/mon-ecole" element={<RequireAuth><Shell><RequireRole roles={EDITEURS}><MonEcole /></RequireRole></Shell></RequireAuth>} />
      <Route path="/mes-eleves" element={<RequireAuth><Shell><RequireRole roles={['agent_plai']}><MesElevesPage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/administration" element={<RequireAuth><Shell><RequireRole roles={['admin']}><Administration /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage picker /></RequireRole></Shell></RequireAuth>} />
      <Route path="/fiches/ecole" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheEcolePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/classe/:classeId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheClassePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="/eleve/:eleveId/fiche" element={<RequireAuth><Shell><RequireRole roles={LECTEURS}><FicheElevePage /></RequireRole></Shell></RequireAuth>} />
      <Route path="*" element={<Shell><NotFound /></Shell>} />
    </Routes>
  );
}
```

## Contexte

`/mon-ecole` passe de `LECTEURS` à `EDITEURS` : ce n'est plus pertinent pour un agent depuis que son périmètre n'est plus une école unique (la page suppose `ecoles.length === 1`, ce qui devient ambigu pour un agent assigné dans 0, 1 ou plusieurs écoles) — remplacé par `/mes-eleves`, dédié. Les routes `/fiches*` restent `LECTEURS` (agent compris) : la lecture des fiches profite automatiquement de l'élargissement RLS (Task 1) sans changement de code ici.

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: route /mes-eleves, /mon-ecole restreint aux éditeurs"
```

---

### Task 14: `Nav.jsx` — liens « Mon école » / « Mes élèves »

**Files:**
- Modify: `src/components/Nav.jsx:23-28`

- [ ] **Step 1: Ajuster les liens de navigation**

Lignes actuelles :

```jsx
      <nav className="flex gap-4 text-sm">
        {editeurEcole && <NavLink to="/saisie" className={lien}>Saisie</NavLink>}
        <NavLink to="/fiches" className={lien}>Fiches</NavLink>
        {!isAdmin && role && <NavLink to="/mon-ecole" className={lien}>Mon école</NavLink>}
        {isAdmin && <NavLink to="/administration" className={lien}>Administration</NavLink>}
      </nav>
```

Remplacer par :

```jsx
      <nav className="flex gap-4 text-sm">
        {editeurEcole && <NavLink to="/saisie" className={lien}>Saisie</NavLink>}
        <NavLink to="/fiches" className={lien}>Fiches</NavLink>
        {(role === 'referent_plai' || role === 'direction') && <NavLink to="/mon-ecole" className={lien}>Mon école</NavLink>}
        {role === 'agent_plai' && <NavLink to="/mes-eleves" className={lien}>Mes élèves</NavLink>}
        {isAdmin && <NavLink to="/administration" className={lien}>Administration</NavLink>}
      </nav>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Nav.jsx
git commit -m "feat: navigation Mon école/Mes élèves selon le rôle"
```

---

### Task 15: Vérification navigateur

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Créer un compte agent_plai de test et l'assigner**

En tant qu'admin : inviter un compte `agent_plai` de test depuis `/administration` (vérifier que le sélecteur d'école a bien disparu du formulaire). En tant que référent/direction de l'école de test : sur `/mon-ecole`, section « Accompagnants par élève », assigner ce compte à un élève de test.

- [ ] **Step 2: Se connecter avec le compte agent de test**

Vérifier la redirection automatique vers `/mes-eleves`, le lien « Mes élèves » dans la nav (et l'absence du lien « Mon école »), et que l'élève assigné apparaît dans sa classe.

- [ ] **Step 3: Tester les droits d'édition**

Cocher/décocher un AR de l'élève assigné, cocher un AU de sa classe (vérifier l'encart d'avertissement), cliquer sur son nom et vérifier que seul le statut IPT/PAR est modifiable (prénom/initiale en lecture seule, pas de bouton supprimer, pas de champ commentaire). Changer son statut, vérifier la persistance après rechargement.

- [ ] **Step 4: Vérifier l'absence de fuite vers d'autres élèves**

Confirmer qu'aucun autre élève de la même classe (non assigné à cet agent) n'apparaît dans `/mes-eleves`, alors que l'AU coché s'applique bien à toute la classe (comportement attendu, documenté par l'encart).

- [ ] **Step 5: Retirer l'assignation et vérifier la révocation**

Depuis `/mon-ecole` (référent/direction), cliquer « retirer » sur l'accompagnant assigné. Se reconnecter avec le compte agent : l'élève ne doit plus apparaître sur `/mes-eleves`.

- [ ] **Step 6: Nettoyer**

Retirer le compte agent de test créé (`/administration` → « retirer »), sauf si JF préfère le garder pour des tests futurs.

---

## Self-Review

- **Couverture spec** : section 3 entièrement couverte — table d'assignation, RLS lecture (via extension d'`ar_can_read_ecole`, propagée automatiquement) et écriture (AR/AU/statut), agent sans école fixe à l'invitation, endpoint de liste pool-wide, UI d'assignation dans `/mon-ecole`, écran `/mes-eleves` dédié, encart AU.
- **Pas de placeholder** : code exact à chaque étape.
- **Cohérence des types** : `ar_accompagnants_eleve.{eleve_id,user_id}` circule identiquement à travers `useAccompagnants.js` (lecture/écriture) et `MonEcole.jsx` (affichage) ; `agents-plai` retourne `{userId, email, nom}` cohérent entre `api/agents-plai.js` et `useAgentsPlai.js` et son usage dans `MonEcole.jsx`. `identiteVerrouillee` circule de `MesElevesPage.jsx` → `EnTeteEleves.jsx` → `EleveEditor.jsx` sans rupture de nom.
- **Décision documentée** : `/mon-ecole` restreint aux éditeurs (retiré pour `agent_plai`, remplacé par `/mes-eleves`) — écart volontaire par rapport au strict statu quo, justifié dans la tâche 13 (la page suppose une école unique, incompatible avec le modèle multi-écoles de l'agent).
- **Hors périmètre** (déjà noté dans la spec, rappelé ici) : pas de report des assignations au passage d'année, pas de chantier « coordination » multi-écoles en lecture seule.
