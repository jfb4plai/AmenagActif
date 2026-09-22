# Référent PLAI / Direction multi-écoles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un compte `referent_plai` ou `direction` d'être rattaché à **plusieurs** écoles/implantations (cas réel : Olga N., référente sur 3 implantations, aujourd'hui bloquée à la première), sans casser le modèle existant pour `agent_plai` (toujours une seule `ecole_id`, chantier séparé non fusionné).

**Architecture:** Nouvelle table de liaison `ar_profils_acces_ecoles` (many-to-many), qui devient la source de vérité pour `referent_plai`/`direction`. `ar_profils_acces.ecole_id` reste en base (aucune suppression, migration à faible risque) et continue de servir pour `agent_plai`. Les fonctions RLS `ar_can_read_ecole`/`ar_can_edit_ecole` sont étendues en `OR` (l'ancien chemin `ecole_id` reste valide, le nouveau chemin multi-écoles s'y ajoute) — même méthode additive que le chantier accompagnants. `SaisieEcole.jsx` et les pages Fiches n'ont besoin d'aucun changement : elles gèrent déjà nativement le cas où `useEcoles()` renvoie plusieurs lignes.

**Tech Stack:** React 18, `@tanstack/react-query` v5, Supabase (Postgres + RLS), Vercel Serverless Functions.

**Décisions validées avec JF :** s'applique à `referent_plai` **et** `direction` (même modèle) ; le champ "Niveaux" (Direction) reste un seul champ par compte, pas par école — pas de complexité ajoutée là-dessus.

---

### Task 1: Migration — table `ar_profils_acces_ecoles` + RLS

**Files:**
- Create: `supabase/migrations/20260922d_amenagactif_referent_multi_ecoles.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- AménagActif — référent PLAI / direction rattachés à plusieurs écoles.
-- ar_profils_acces.ecole_id reste en base (compat historique, toujours
-- utilisé par agent_plai) mais n'est plus la seule source de vérité pour
-- referent_plai/direction : nouvelle relation many-to-many, backfillée
-- depuis les données existantes. Méthode additive (OR sur les deux
-- chemins) : rien de ce qui marchait avant ne casse.

begin;

create table ar_profils_acces_ecoles (
  user_id  uuid not null references auth.users(id) on delete cascade,
  ecole_id uuid not null references ar_ecoles(id) on delete cascade,
  cree_le  timestamptz not null default now(),
  primary key (user_id, ecole_id)
);

alter table ar_profils_acces_ecoles enable row level security;

-- Backfill : chaque referent_plai/direction avec un ecole_id garde cette
-- école comme première entrée de la nouvelle table.
insert into ar_profils_acces_ecoles (user_id, ecole_id)
select user_id, ecole_id from ar_profils_acces
where role in ('referent_plai', 'direction') and ecole_id is not null
on conflict do nothing;

-- ── Helpers étendus (additif : l'ancien chemin ecole_id reste valide) ──
create or replace function ar_can_read_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces where user_id = auth.uid() and ecole_id = target
  ) or exists (
    select 1 from ar_profils_acces_ecoles where user_id = auth.uid() and ecole_id = target
  );
$$;

create or replace function ar_can_edit_ecole(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select ar_is_admin() or exists (
    select 1 from ar_profils_acces
    where user_id = auth.uid() and ecole_id = target and role in ('referent_plai', 'direction')
  ) or exists (
    select 1 from ar_profils_acces p
    join ar_profils_acces_ecoles pe on pe.user_id = p.user_id
    where p.user_id = auth.uid() and pe.ecole_id = target and p.role in ('referent_plai', 'direction')
  );
$$;

-- Lecture des profils : « mon école » (legacy, inchangé) OU tout collègue
-- partageant au moins une école avec moi via la nouvelle table.
drop policy if exists ar_acces_read on ar_profils_acces;
create policy ar_acces_read on ar_profils_acces for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or (ecole_id is not null and ecole_id = ar_mon_ecole())
    or exists (
      select 1 from ar_profils_acces_ecoles mine
      join ar_profils_acces_ecoles theirs on theirs.ecole_id = mine.ecole_id
      where mine.user_id = auth.uid() and theirs.user_id = ar_profils_acces.user_id
    )
  );

-- ── ar_profils_acces_ecoles elle-même ──
-- Lecture : l'intéressé, tout collègue de la même école, ou l'admin.
-- Écriture : admin uniquement (gestion centralisée des comptes, comme le
-- reste de ar_profils_acces).
create policy ar_pae_read on ar_profils_acces_ecoles for select to authenticated
  using (
    user_id = auth.uid()
    or ar_is_admin()
    or exists (
      select 1 from ar_profils_acces_ecoles mine
      where mine.user_id = auth.uid() and mine.ecole_id = ar_profils_acces_ecoles.ecole_id
    )
  );
create policy ar_pae_write on ar_profils_acces_ecoles for all to authenticated
  using (ar_is_admin()) with check (ar_is_admin());

commit;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260922d_amenagactif_referent_multi_ecoles.sql
git commit -m "feat(db): table ar_profils_acces_ecoles pour référent/direction multi-écoles"
```

- [ ] **Step 3: Note** — migration sur le projet Supabase partagé, à exécuter manuellement par JF comme les précédentes. Le code des tâches suivantes peut être écrit avant son exécution, mais la vérification finale (Task 7) l'exige.

---

### Task 2: `useEquipeEcole` — lecture via la nouvelle table de liaison

**Files:**
- Modify: `src/hooks/useAdmin.js:62-78`

- [ ] **Step 1: Réécrire le hook**

Code actuel :

```js
/** Équipe d'une implantation : comptes référent PLAI + direction (lecture, via RLS). */
export function useEquipeEcole(ecoleId) {
  return useQuery({
    queryKey: ['equipe-ecole', ecoleId],
    enabled: !!ecoleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_profils_acces')
        .select('user_id, nom, role')
        .eq('ecole_id', ecoleId)
        .in('role', ['referent_plai', 'direction'])
        .order('role');
      if (error) throw error;
      return data;
    },
  });
}
```

Remplacer par :

```js
/** Équipe d'une implantation : comptes référent PLAI + direction (lecture, via RLS). */
export function useEquipeEcole(ecoleId) {
  return useQuery({
    queryKey: ['equipe-ecole', ecoleId],
    enabled: !!ecoleId,
    queryFn: async () => {
      const { data: liens, error: e1 } = await supabase
        .from('ar_profils_acces_ecoles').select('user_id').eq('ecole_id', ecoleId);
      if (e1) throw e1;
      const userIds = liens.map((l) => l.user_id);
      if (userIds.length === 0) return [];
      const { data, error: e2 } = await supabase
        .from('ar_profils_acces')
        .select('user_id, nom, role')
        .in('user_id', userIds)
        .in('role', ['referent_plai', 'direction'])
        .order('role');
      if (e2) throw e2;
      return data;
    },
  });
}
```

## Contexte

Cette fonction est utilisée par `MonEcole.jsx` (Task 6). Elle passait par l'ancienne colonne `ecole_id` — un compte multi-écoles ajouté uniquement via la nouvelle table de liaison n'y apparaîtrait pas. La migration (Task 1) backfille systématiquement la table de liaison pour tous les comptes existants, donc ce changement est sûr même pour les comptes qui n'ont jamais été touchés depuis.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAdmin.js
git commit -m "feat: useEquipeEcole lit la nouvelle table de liaison multi-écoles"
```

---

### Task 3: `api/membres.js` — API multi-écoles

**Files:**
- Modify: `api/membres.js`

- [ ] **Step 1: GET — attacher la liste des écoles de chaque membre**

Code actuel (`req.method === 'GET'`, lignes 28-40) :

```js
    if (req.method === 'GET') {
      const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, nom, role, ecole_id, niveaux');
      if (error) throw error;
      const membres = await Promise.all(
        rows.map(async (r) => {
          const { data } = await db.auth.admin.getUserById(r.user_id);
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '', role: r.role, ecoleId: r.ecole_id, niveaux: r.niveaux ?? [] };
        })
      );
      membres.sort((a, b) => a.email.localeCompare(b.email));
      res.status(200).json({ membres });
      return;
    }
```

Remplacer par :

```js
    if (req.method === 'GET') {
      const [{ data: rows, error }, { data: liens, error: eLiens }] = await Promise.all([
        db.from('ar_profils_acces').select('user_id, nom, role, ecole_id, niveaux'),
        db.from('ar_profils_acces_ecoles').select('user_id, ecole_id'),
      ]);
      if (error) throw error;
      if (eLiens) throw eLiens;
      const membres = await Promise.all(
        rows.map(async (r) => {
          const { data } = await db.auth.admin.getUserById(r.user_id);
          const ecoleIds = liens.filter((l) => l.user_id === r.user_id).map((l) => l.ecole_id);
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '', role: r.role, ecoleId: r.ecole_id, ecoleIds, niveaux: r.niveaux ?? [] };
        })
      );
      membres.sort((a, b) => a.email.localeCompare(b.email));
      res.status(200).json({ membres });
      return;
    }
```

- [ ] **Step 2: `invite` — insérer aussi dans la table de liaison**

Code actuel (dans le bloc `if (action === 'invite')`, juste après l'upsert `ar_profils_acces`) :

```js
        const { error: e2 } = await db.from('ar_profils_acces')
          .upsert({ user_id: data.user.id, nom: (nom || '').trim(), role, ecole_id: ecolePour() }, { onConflict: 'user_id' });
        if (e2) throw e2;

        const lien = data.properties.action_link;
```

Remplacer par :

```js
        const { error: e2 } = await db.from('ar_profils_acces')
          .upsert({ user_id: data.user.id, nom: (nom || '').trim(), role, ecole_id: ecolePour() }, { onConflict: 'user_id' });
        if (e2) throw e2;

        if (scoped && ecoleId) {
          const { error: e2b } = await db.from('ar_profils_acces_ecoles').insert({ user_id: data.user.id, ecole_id: ecoleId });
          if (e2b && e2b.code !== '23505') throw e2b;
        }

        const lien = data.properties.action_link;
```

- [ ] **Step 3: `setProfil` — ne plus exiger une école au changement de rôle**

Code actuel (dans le bloc `if (action === 'setProfil')`) :

```js
        const patch = {};
        if (role !== undefined) {
          if (!ROLES.includes(role)) { res.status(400).json({ error: 'Rôle invalide.' }); return; }
          patch.role = role;
          patch.ecole_id = ROLE_SCOPE.includes(role) ? (ecoleId || null) : null;
          if (ROLE_SCOPE.includes(role) && !patch.ecole_id) { res.status(400).json({ error: 'Ce rôle doit être rattaché à une école.' }); return; }
        } else if (ecoleId !== undefined) {
          patch.ecole_id = ecoleId || null;
        }
```

Remplacer par :

```js
        const patch = {};
        if (role !== undefined) {
          if (!ROLES.includes(role)) { res.status(400).json({ error: 'Rôle invalide.' }); return; }
          patch.role = role;
          patch.ecole_id = ROLE_SCOPE.includes(role) ? (ecoleId || null) : null;
        } else if (ecoleId !== undefined) {
          patch.ecole_id = ecoleId || null;
        }
```

## Contexte

Avec le modèle multi-écoles, une école n'est plus choisie *au moment* du changement de rôle — l'admin bascule d'abord le rôle, puis ajoute une ou plusieurs écoles via les nouvelles actions `addEcole` (Step 4) depuis l'écran Administration. Exiger une école bloquante ici casserait ce flux en deux temps. `invite` garde sa propre validation (une école initiale reste obligatoire à la création, inchangé).

- [ ] **Step 4: Nouvelles actions `addEcole` / `removeEcole`**

Insérer juste avant le bloc `if (action === 'revoke') {` :

```js
      if (action === 'addEcole') {
        if (!userId || !ecoleId) { res.status(400).json({ error: 'userId et ecoleId requis.' }); return; }
        const { error } = await db.from('ar_profils_acces_ecoles').insert({ user_id: userId, ecole_id: ecoleId });
        if (error && error.code !== '23505') throw error;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'removeEcole') {
        if (!userId || !ecoleId) { res.status(400).json({ error: 'userId et ecoleId requis.' }); return; }
        const { error } = await db.from('ar_profils_acces_ecoles').delete().eq('user_id', userId).eq('ecole_id', ecoleId);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

```

- [ ] **Step 5: Commit**

```bash
git add api/membres.js
git commit -m "feat: api/membres gère les écoles multiples (addEcole/removeEcole)"
```

---

### Task 4: `useMembres.js` — mutations `assignerEcole` / `retirerEcole`

**Files:**
- Modify: `src/hooks/useMembres.js`

- [ ] **Step 1: Ajouter les deux mutations**

Fichier complet actuel :

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

async function apiMembres(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/membres', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
  return json;
}

export function useMembres() {
  return useQuery({ queryKey: ['membres'], queryFn: () => apiMembres().then((j) => j.membres) });
}

export function useMembresMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['membres'] });
  return {
    inviter: useMutation({ mutationFn: (p) => apiMembres({ action: 'invite', ...p }), onSuccess: inval }),
    changerRole: useMutation({ mutationFn: (p) => apiMembres({ action: 'setProfil', ...p }), onSuccess: inval }),
    retirer: useMutation({ mutationFn: (userId) => apiMembres({ action: 'revoke', userId }), onSuccess: inval }),
  };
}
```

Remplacer par :

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

async function apiMembres(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/membres', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
  return json;
}

export function useMembres() {
  return useQuery({ queryKey: ['membres'], queryFn: () => apiMembres().then((j) => j.membres) });
}

export function useMembresMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['membres'] });
  return {
    inviter: useMutation({ mutationFn: (p) => apiMembres({ action: 'invite', ...p }), onSuccess: inval }),
    changerRole: useMutation({ mutationFn: (p) => apiMembres({ action: 'setProfil', ...p }), onSuccess: inval }),
    retirer: useMutation({ mutationFn: (userId) => apiMembres({ action: 'revoke', userId }), onSuccess: inval }),
    assignerEcole: useMutation({ mutationFn: (p) => apiMembres({ action: 'addEcole', ...p }), onSuccess: inval }),
    retirerEcole: useMutation({ mutationFn: (p) => apiMembres({ action: 'removeEcole', ...p }), onSuccess: inval }),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useMembres.js
git commit -m "feat: mutations assignerEcole/retirerEcole pour les membres"
```

---

### Task 5: `Administration.jsx` — écoles multiples par membre (badges + ajout)

**Files:**
- Modify: `src/pages/Administration.jsx:24-123` (`SectionMembres`)

- [ ] **Step 1: Réécrire `SectionMembres`**

Code actuel (lignes 24-123) :

```jsx
/* ─────────────── Membres & accès ─────────────── */
function SectionMembres() {
  const { data: membres = [], isLoading, error } = useMembres();
  const { data: ecoles = [] } = useEcoles();
  const { inviter, changerRole, retirer } = useMembresMutations();
  const [f, setF] = useState({ email: '', nom: '', role: 'referent_plai', ecoleId: '' });
  const nomEcole = (id) => ecoles.find((e) => e.id === id)?.nom ?? '—';
  const besoinEcole = (r) => ROLE_SCOPE.includes(r);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Membres &amp; accès</h2>
      <p className="text-sm text-[color:var(--text3)]">
        <strong>Administrateur</strong> : tout, toutes écoles. <strong>Référent PLAI</strong> et <strong>Direction</strong> : mêmes droits, limités à une école (classes, élèves, AR/AU, fiches).
        Le <strong>nom</strong> figure sur les fiches (colonnes « Référent(s) PLAI » / « PAR »). Inviter envoie un e-mail avec un lien pour définir le mot de passe.
        Une école peut avoir plusieurs comptes <strong>Direction</strong> (par exemple un par degré) : le champ <strong>Niveaux</strong> limite l'apparition de chacun aux classes concernées — vide, il apparaît sur toutes.
      </p>

      <form
        className="plai-card p-3 flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.email.trim()) return;
          if (besoinEcole(f.role) && !f.ecoleId) return;
          inviter.mutate({ email: f.email.trim(), nom: f.nom.trim(), role: f.role, ecoleId: f.ecoleId || null }, { onSuccess: () => setF({ email: '', nom: '', role: 'referent_plai', ecoleId: '' }) });
        }}
      >
        <label className="text-sm">Adresse e-mail
          <input className="plai-input block" type="email" placeholder="prenom.nom@ecole.be" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="text-sm">Nom (affiché sur la fiche)
          <input className="plai-input block" placeholder="Hélène Dubois" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </label>
        <label className="text-sm">Rôle
          <select className="plai-input block" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="referent_plai">Référent PLAI</option>
            <option value="direction">Direction</option>
            <option value="agent_plai">Agent accompagnant</option>
            <option value="admin">Administrateur</option>
          </select>
        </label>
        {besoinEcole(f.role) && (
          <label className="text-sm">École
            <select className="plai-input block" value={f.ecoleId} onChange={(e) => setF({ ...f, ecoleId: e.target.value })}>
              <option value="">— choisir —</option>
              {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
          </label>
        )}
        <button className="plai-btn" type="submit" disabled={inviter.isPending}>{inviter.isPending ? 'Envoi…' : 'Inviter'}</button>
        <p className="text-xs text-[color:var(--text3)] max-w-xs">
          Le domaine d'envoi est récent : le mail peut atterrir dans les indésirables (surtout sur Outlook). Prévenez la personne invitée par un autre canal si elle ne reçoit rien.
        </p>
      </form>
      {inviter.isError && <p className="plai-error">{inviter.error.message}</p>}
      {inviter.isSuccess && <p className="plai-success">Invitation envoyée.</p>}

      {isLoading ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="plai-error">{error.message}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
          {membres.map((m) => (
            <li key={m.userId} className="px-3 py-2 flex flex-wrap items-center gap-3">
              <span className="min-w-[12rem]">{m.email}</span>
              <input className="plai-input !py-1 text-sm w-40" defaultValue={m.nom ?? ''} placeholder="Nom"
                onBlur={(e) => { if ((e.target.value || '') !== (m.nom || '')) changerRole.mutate({ userId: m.userId, role: m.role, ecoleId: m.ecoleId, nom: e.target.value }); }} />
              <select className="plai-input !w-auto !py-1 text-sm" value={m.role}
                onChange={(e) => changerRole.mutate({ userId: m.userId, role: e.target.value, ecoleId: besoinEcole(e.target.value) ? (m.ecoleId || ecoles[0]?.id || null) : null })}>
                <option value="admin">{LABEL_ROLE.admin}</option>
                <option value="referent_plai">{LABEL_ROLE.referent_plai}</option>
                <option value="direction">{LABEL_ROLE.direction}</option>
                <option value="agent_plai">{LABEL_ROLE.agent_plai}</option>
              </select>
              {besoinEcole(m.role) && (
                <select className="plai-input !w-auto !py-1 text-sm" value={m.ecoleId ?? ''}
                  onChange={(e) => changerRole.mutate({ userId: m.userId, role: m.role, ecoleId: e.target.value })}>
                  <option value="">— école —</option>
                  {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              )}
              {besoinEcole(m.role) && <span className="text-xs text-[color:var(--text3)]">{nomEcole(m.ecoleId)}</span>}
              {m.role === 'direction' && (
                <input className="plai-input !py-1 text-sm w-48" defaultValue={(m.niveaux ?? []).join(',')}
                  placeholder="Niveaux (ex: 3e,4e,5e,6e), vide=tous"
                  onBlur={(e) => {
                    const niveaux = e.target.value.split(',').map((n) => n.trim()).filter(Boolean);
                    const actuel = (m.niveaux ?? []).join(',');
                    if (e.target.value.trim() !== actuel) changerRole.mutate({ userId: m.userId, role: m.role, ecoleId: m.ecoleId, niveaux });
                  }} />
              )}
              <button className="text-sm underline" onClick={() => { if (confirm(`Retirer l'accès de ${m.email} ?`)) retirer.mutate(m.userId); }}>retirer</button>
            </li>
          ))}
        </ul>
      )}
      {(changerRole.isError || retirer.isError) && <p className="plai-error">{(changerRole.error || retirer.error)?.message}</p>}
    </section>
  );
}
```

Remplacer par :

```jsx
/* ─────────────── Membres & accès ─────────────── */
function SectionMembres() {
  const { data: membres = [], isLoading, error } = useMembres();
  const { data: ecoles = [] } = useEcoles();
  const { inviter, changerRole, retirer, assignerEcole, retirerEcole } = useMembresMutations();
  const [f, setF] = useState({ email: '', nom: '', role: 'referent_plai', ecoleId: '' });
  const nomEcole = (id) => ecoles.find((e) => e.id === id)?.nom ?? '—';
  const besoinEcole = (r) => ROLE_SCOPE.includes(r);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Membres &amp; accès</h2>
      <p className="text-sm text-[color:var(--text3)]">
        <strong>Administrateur</strong> : tout, toutes écoles. <strong>Référent PLAI</strong> et <strong>Direction</strong> : mêmes droits, sur une ou plusieurs écoles (classes, élèves, AR/AU, fiches).
        Le <strong>nom</strong> figure sur les fiches (colonnes « Référent(s) PLAI » / « PAR »). Inviter envoie un e-mail avec un lien pour définir le mot de passe.
        Une école peut avoir plusieurs comptes <strong>Direction</strong> (par exemple un par degré) : le champ <strong>Niveaux</strong> limite l'apparition de chacun aux classes concernées — vide, il apparaît sur toutes.
      </p>

      <form
        className="plai-card p-3 flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.email.trim()) return;
          if (besoinEcole(f.role) && !f.ecoleId) return;
          inviter.mutate({ email: f.email.trim(), nom: f.nom.trim(), role: f.role, ecoleId: f.ecoleId || null }, { onSuccess: () => setF({ email: '', nom: '', role: 'referent_plai', ecoleId: '' }) });
        }}
      >
        <label className="text-sm">Adresse e-mail
          <input className="plai-input block" type="email" placeholder="prenom.nom@ecole.be" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
        <label className="text-sm">Nom (affiché sur la fiche)
          <input className="plai-input block" placeholder="Hélène Dubois" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </label>
        <label className="text-sm">Rôle
          <select className="plai-input block" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="referent_plai">Référent PLAI</option>
            <option value="direction">Direction</option>
            <option value="agent_plai">Agent accompagnant</option>
            <option value="admin">Administrateur</option>
          </select>
        </label>
        {besoinEcole(f.role) && (
          <label className="text-sm">École
            <select className="plai-input block" value={f.ecoleId} onChange={(e) => setF({ ...f, ecoleId: e.target.value })}>
              <option value="">— choisir —</option>
              {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
            <span className="block text-xs text-[color:var(--text3)] font-normal">École de départ — d'autres écoles pourront être ajoutées ensuite ci-dessous.</span>
          </label>
        )}
        <button className="plai-btn" type="submit" disabled={inviter.isPending}>{inviter.isPending ? 'Envoi…' : 'Inviter'}</button>
        <p className="text-xs text-[color:var(--text3)] max-w-xs">
          Le domaine d'envoi est récent : le mail peut atterrir dans les indésirables (surtout sur Outlook). Prévenez la personne invitée par un autre canal si elle ne reçoit rien.
        </p>
      </form>
      {inviter.isError && <p className="plai-error">{inviter.error.message}</p>}
      {inviter.isSuccess && <p className="plai-success">Invitation envoyée.</p>}

      {isLoading ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="plai-error">{error.message}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
          {membres.map((m) => (
            <li key={m.userId} className="px-3 py-2 flex flex-wrap items-center gap-3">
              <span className="min-w-[12rem]">{m.email}</span>
              <input className="plai-input !py-1 text-sm w-40" defaultValue={m.nom ?? ''} placeholder="Nom"
                onBlur={(e) => { if ((e.target.value || '') !== (m.nom || '')) changerRole.mutate({ userId: m.userId, role: m.role, nom: e.target.value }); }} />
              <select className="plai-input !w-auto !py-1 text-sm" value={m.role}
                onChange={(e) => changerRole.mutate({ userId: m.userId, role: e.target.value })}>
                <option value="admin">{LABEL_ROLE.admin}</option>
                <option value="referent_plai">{LABEL_ROLE.referent_plai}</option>
                <option value="direction">{LABEL_ROLE.direction}</option>
                <option value="agent_plai">{LABEL_ROLE.agent_plai}</option>
              </select>
              {besoinEcole(m.role) && (
                <div className="flex flex-wrap gap-2 items-center">
                  {(m.ecoleIds ?? []).map((ecoleId) => (
                    <span key={ecoleId} className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full flex items-center gap-1">
                      {nomEcole(ecoleId)}
                      <button type="button" className="underline" onClick={() => retirerEcole.mutate({ userId: m.userId, ecoleId })}>retirer</button>
                    </span>
                  ))}
                  <select className="plai-input !w-auto !py-1 text-xs" value=""
                    onChange={(e) => { if (e.target.value) assignerEcole.mutate({ userId: m.userId, ecoleId: e.target.value }); }}>
                    <option value="">+ ajouter une école…</option>
                    {ecoles.filter((e) => !(m.ecoleIds ?? []).includes(e.id)).map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                  </select>
                </div>
              )}
              {m.role === 'direction' && (
                <input className="plai-input !py-1 text-sm w-48" defaultValue={(m.niveaux ?? []).join(',')}
                  placeholder="Niveaux (ex: 3e,4e,5e,6e), vide=tous"
                  onBlur={(e) => {
                    const niveaux = e.target.value.split(',').map((n) => n.trim()).filter(Boolean);
                    const actuel = (m.niveaux ?? []).join(',');
                    if (e.target.value.trim() !== actuel) changerRole.mutate({ userId: m.userId, role: m.role, niveaux });
                  }} />
              )}
              <button className="text-sm underline" onClick={() => { if (confirm(`Retirer l'accès de ${m.email} ?`)) retirer.mutate(m.userId); }}>retirer</button>
            </li>
          ))}
        </ul>
      )}
      {(changerRole.isError || retirer.isError || assignerEcole.isError || retirerEcole.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}
```

## Contexte

Trois changements de comportement à noter :
1. Le sélecteur d'école unique par membre est remplacé par des badges (une par école assignée, chacun avec un bouton « retirer ») + un menu déroulant « + ajouter une école » — même pattern que l'assignation d'accompagnants du chantier précédent (non fusionné, mais le style est repris ici indépendamment).
2. Le changement de rôle (`<select>` Rôle) ne transmet plus `ecoleId` — il ne fait que changer le rôle. Si le nouveau rôle est `referent_plai`/`direction` et que le compte n'a encore aucune école (cas d'un compte tout juste rebasculé), les badges sont simplement vides et le menu « + ajouter une école » permet d'en assigner une immédiatement.
3. Le champ Niveaux ne transmet plus non plus `ecoleId` (il n'a jamais eu besoin d'agir dessus, c'était un vestige de la mutation partagée `setProfil`).

- [ ] **Step 2: Commit**

```bash
git add src/pages/Administration.jsx
git commit -m "feat: gestion des écoles multiples par membre dans Administration"
```

---

### Task 6: `MonEcole.jsx` — boucle sur toutes les écoles visibles

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
import { useEquipeEcole } from '../hooks/useAdmin.js';
import { useRole } from '../lib/auth.jsx';

const LABEL = { referent_plai: 'Référent PLAI', direction: 'Direction' };

export default function MonEcole() {
  const { isAdmin } = useRole();
  const { data: ecoles = [], isLoading } = useEcoles();

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  if (isAdmin) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-empty">En tant qu'administrateur, gérez les écoles et les membres dans « Administration ».</p>
      </div>
    );
  }

  if (ecoles.length === 0) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-error">Aucune école n'est rattachée à votre compte. Contactez l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="plai-section space-y-8 max-w-3xl px-4">
      <h1 className="text-xl font-semibold">{ecoles.length > 1 ? 'Mes écoles' : 'Mon école'}</h1>
      {ecoles.map((ecole) => <SectionEcole key={ecole.id} ecole={ecole} />)}

      {/* À venir (Plan 2) : gestion des enseignants par classe. */}
    </div>
  );
}

function SectionEcole({ ecole }) {
  const { data: equipe = [] } = useEquipeEcole(ecole.id);

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{ecole.nom}</h2>
      <h3 className="font-semibold text-sm">Équipe de l'implantation</h3>
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
  );
}
```

## Contexte

`useEcoles()` est déjà filtrée par RLS (`ar_can_read_ecole`, étendue à la Task 1) — un référent multi-écoles la verra naturellement renvoyer plusieurs lignes, sans changement côté hook. `ecoleId` (singulier) n'est plus utilisé par cette page : `useRole()` lui-même n'a pas besoin d'être modifié, sa valeur `ecoleId` legacy reste disponible pour d'éventuels autres usages mais n'est plus la source de vérité ici.

- [ ] **Step 2: Commit**

```bash
git add src/pages/MonEcole.jsx
git commit -m "feat: Mon école boucle sur toutes les écoles visibles (multi-écoles)"
```

---

### Task 7: Vérification navigateur

**Files:** aucun (vérification uniquement)

- [ ] **Step 1: Se connecter en admin, créer une deuxième école de test**

Sur `/administration`, créer une "École test 2" (en plus de l'"École test" existante) si nécessaire pour le test.

- [ ] **Step 2: Assigner un référent existant à une deuxième école**

Sur `/administration`, section Membres, trouver un compte `referent_plai` ou `direction` existant. Vérifier que ses écoles actuelles apparaissent en badges. Utiliser "+ ajouter une école" pour lui assigner l'école de test 2. Vérifier que le badge apparaît immédiatement.

- [ ] **Step 3: Vérifier `/saisie` et les fiches en tant que ce référent**

Se connecter avec ce compte (ou demander à son titulaire) : sur `/saisie` et `/fiches`, le sélecteur d'école doit maintenant proposer les deux écoles (plus de verrouillage sur une seule).

- [ ] **Step 4: Vérifier `/mon-ecole`**

Toujours avec ce compte : `/mon-ecole` doit afficher les deux écoles, chacune avec sa propre section "Équipe de l'implantation".

- [ ] **Step 5: Retirer une école et vérifier la révocation**

Depuis `/administration`, retirer l'école de test 2 de ce compte. Reconnecté avec ce compte (ou après rechargement), vérifier qu'elle disparaît de `/saisie`, `/fiches` et `/mon-ecole`.

- [ ] **Step 6: Vérifier qu'`agent_plai` n'est pas affecté**

Si un compte `agent_plai` de test existe encore, vérifier que son accès en lecture fonctionne toujours comme avant (aucun changement de ce chantier ne devait le toucher).

---

## Self-Review

- **Couverture de la demande** : référent PLAI **et** direction multi-écoles, niveaux non décomposé par école (conforme aux réponses de JF).
- **Pas de placeholder** : code exact à chaque étape.
- **Cohérence des types** : `ecoleIds` (tableau) circule de manière cohérente entre `api/membres.js` (GET), `Administration.jsx` (affichage badges) et les mutations `assignerEcole`/`retirerEcole` (`{userId, ecoleId}` singulier, cohérent avec le pattern déjà utilisé pour `ar_accompagnants_eleve` dans le chantier précédent).
- **Non-régression `agent_plai`** : `ar_can_read_ecole`/`ar_can_edit_ecole` gardent leur ancien chemin `ecole_id` en `OR` — un compte `agent_plai` (jamais dans `ar_profils_acces_ecoles`) continue de fonctionner exactement comme avant.
- **`SaisieEcole.jsx` et pages Fiches** : aucune tâche ne les touche, confirmé par lecture de `SelecteurContexte.jsx` — elles gèrent déjà nativement `ecoles.length !== 1`.
