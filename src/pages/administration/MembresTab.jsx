import { useState } from 'react';
import { useEcoles } from '../../hooks/useAdmin.js';
import { useMembres, useMembresMutations } from '../../hooks/useMembres.js';

const LABEL_ROLE = { admin: 'Administrateur', referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };
const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai']; // rôles nécessitant une école à l'invitation
const ROLE_SCOPE_MULTI = ['referent_plai', 'direction', 'agent_plai', 'admin']; // rôles pouvant être rattachés à PLUSIEURS écoles ensuite (admin : rattachement facultatif, identification "Mon école" seulement — aucun droit supplémentaire)

export default function MembresTab() {
  const { data: membres = [], isLoading, error } = useMembres();
  const { data: ecoles = [] } = useEcoles();
  const mut = useMembresMutations();
  const { inviter } = mut;
  const [f, setF] = useState({ email: '', nom: '', role: 'referent_plai', ecoleId: '' });
  const besoinEcole = (r) => ROLE_SCOPE.includes(r);

  const admins = membres.filter((m) => m.role === 'admin');
  const dansEcole = (m, ecoleId) => m.ecoleId === ecoleId || (m.ecoleIds ?? []).includes(ecoleId);
  // Un admin rattaché (facultatif) à une école apparaît aussi dans son groupe — identification
  // "personne de terrain" seulement, aucun droit supplémentaire (déjà global via ar_is_admin()).
  const parEcole = ecoles.map((ecole) => ({ ecole, membres: membres.filter((m) => dansEcole(m, ecole.id)) }));
  // Un admin sans école n'est pas une anomalie (c'est le cas normal) : on ne le signale pas ici.
  const sansEcole = membres.filter((m) => m.role !== 'admin' && !m.ecoleId && (m.ecoleIds ?? []).length === 0);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Membres &amp; accès</h2>
      <p className="text-sm text-[color:var(--text3)]">
        <strong>Administrateur</strong> : tout, toutes écoles. <strong>Référent PLAI</strong> et <strong>Direction</strong> : mêmes droits, sur une ou plusieurs écoles (classes, élèves, AR/AU, fiches).
        <strong>Agent accompagnant</strong> : sur une ou plusieurs écoles comme référent/direction, peut créer/modifier/supprimer des élèves et leurs AR, créer une classe, ajouter (pas retirer) un AU, et créer des liens enseignants (il ne révoque et ne modifie que les siens) — mais ne peut ni supprimer ni renommer une classe, ni changer un élève de classe, ni faire la reprise d'année.
        Le <strong>nom</strong> figure sur les fiches (colonnes « Référent(s) PLAI » / « PAR »). Inviter envoie un e-mail avec un lien pour définir le mot de passe.
        Une école peut avoir plusieurs comptes <strong>Direction</strong> (par exemple un par degré) : le champ <strong>Niveaux</strong> limite l'apparition de chacun aux classes concernées — vide, il apparaît sur toutes.
        Ci-dessous, la liste est groupée par implantation — un référent, une direction ou un agent multi-écoles apparaît dans chacune des siennes.
        Un <strong>administrateur</strong> peut aussi être rattaché à une ou plusieurs écoles (chips ci-dessous) — uniquement pour apparaître dans « Mon école » comme personne de terrain, aucun droit supplémentaire (il a déjà accès à tout).
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
        <div className="space-y-5">
          {admins.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[color:var(--text3)]">Administrateurs (toutes écoles)</h3>
              <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
                {admins.map((m) => <MembreRow key={m.userId} m={m} ecoles={ecoles} besoinEcole={besoinEcole} mut={mut} />)}
              </ul>
            </div>
          )}
          {parEcole.map(({ ecole, membres: membresEcole }) => (
            <div key={ecole.id} className="space-y-1">
              <h3 className="text-sm font-semibold text-[color:var(--text3)]">{ecole.nom}</h3>
              {membresEcole.length === 0 ? (
                <p className="text-sm text-[color:var(--text3)] italic px-1">Aucun membre rattaché.</p>
              ) : (
                <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
                  {membresEcole.map((m) => <MembreRow key={m.userId} m={m} ecoles={ecoles} besoinEcole={besoinEcole} mut={mut} />)}
                </ul>
              )}
            </div>
          ))}
          {sansEcole.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-700">Sans école assignée (à corriger)</h3>
              <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
                {sansEcole.map((m) => <MembreRow key={m.userId} m={m} ecoles={ecoles} besoinEcole={besoinEcole} mut={mut} />)}
              </ul>
            </div>
          )}
        </div>
      )}
      {(mut.changerRole.isError || mut.retirer.isError || mut.assignerEcole.isError || mut.retirerEcole.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}

function MembreRow({ m, ecoles, besoinEcole, mut }) {
  const { changerRole, retirer, assignerEcole, retirerEcole } = mut;
  const nomEcole = (id) => ecoles.find((e) => e.id === id)?.nom ?? '—';
  return (
    <li className="px-3 py-2 flex flex-wrap items-center gap-3">
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
      {ROLE_SCOPE_MULTI.includes(m.role) ? (
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
      ) : besoinEcole(m.role) ? (
        <select className="plai-input !w-auto !py-1 text-sm" value={m.ecoleId ?? ''}
          onChange={(e) => changerRole.mutate({ userId: m.userId, role: m.role, ecoleId: e.target.value })}>
          <option value="">— école —</option>
          {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      ) : null}
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
  );
}
