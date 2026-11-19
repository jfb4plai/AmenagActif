import { useState } from 'react';
import { useEcoles } from '../../hooks/useAdmin.js';
import { useMembres, useMembresMutations } from '../../hooks/useMembres.js';
import { LIBELLE_ROLE } from '../../domain/droits.js';
import NiveauxDirection from './NiveauxDirection.jsx';
import { filtrerMembres, grouperMembres, compteurMembres } from '../../domain/membres.js';

const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai']; // rôles nécessitant une école à l'invitation
const ROLE_SCOPE_MULTI = ['referent_plai', 'direction', 'agent_plai', 'admin']; // rôles pouvant être rattachés à PLUSIEURS écoles ensuite (admin : rattachement facultatif, identification "Mon école" seulement — aucun droit supplémentaire)

export default function MembresTab() {
  const { data: membres = [], isLoading, error } = useMembres();
  const { data: ecoles = [] } = useEcoles();
  const mut = useMembresMutations();
  const { inviter } = mut;
  const [f, setF] = useState({ email: '', nom: '', role: 'referent_plai', ecoleId: '' });
  const besoinEcole = (r) => ROLE_SCOPE.includes(r);

  const [filtre, setFiltre] = useState({ texte: '', role: '' });

  // Le regroupement (admins, par école, sans école) se fait sur la liste FILTRÉE ;
  // l'alerte « sans école » se calcule sur la liste NON filtrée : un filtre ne doit pas la masquer.
  const filtres = filtrerMembres(membres, filtre);
  const { admins, parEcole, sansEcole } = grouperMembres(filtres, ecoles);
  const nbSansEcole = grouperMembres(membres, ecoles).sansEcole.length;
  const filtreActif = Boolean(filtre.texte.trim() || filtre.role);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Membres &amp; accès</h2>
      <p className="text-base text-[color:var(--text3)]">
        Chaque compte a un rôle qui détermine les écoles et les actions auxquelles il accède.
      </p>
      <details className="plai-card p-3">
        <summary className="cursor-pointer font-medium">Comprendre les rôles</summary>
      <p className="text-base text-[color:var(--text3)] mt-2">
        <strong>Administrateur</strong> : tout, toutes écoles. <strong>Référent PLAI</strong> et <strong>Direction</strong> : mêmes droits, sur une ou plusieurs écoles (classes, élèves, AR/AU, fiches).
        <strong>Agent accompagnant</strong> : sur une ou plusieurs écoles comme référent/direction, peut créer/modifier/supprimer des élèves et leurs AR, créer une classe, ajouter (pas retirer) un AU, et créer des liens enseignants (il ne révoque et ne modifie que les siens) — mais ne peut ni supprimer ni renommer une classe, ni changer un élève de classe, ni faire la reprise d'année.
        Le <strong>nom</strong> figure sur les fiches (colonnes « Référent(s) PLAI » / « PAR »). Inviter envoie un e-mail avec un lien pour définir le mot de passe.
        Une école peut avoir plusieurs comptes <strong>Direction</strong> (par exemple un par degré) : les cases <strong>Niveaux</strong> limitent l'apparition de chacun aux classes concernées — sans case cochée, il apparaît sur toutes.
        Ci-dessous, la liste est groupée par implantation — un référent, une direction ou un agent multi-écoles apparaît dans chacune des siennes.
        Un <strong>administrateur</strong> peut aussi être rattaché à une ou plusieurs écoles (chips ci-dessous) — uniquement pour apparaître dans « Mon école » comme personne de terrain, aucun droit supplémentaire (il a déjà accès à tout).
      </p>
      </details>

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

      {nbSansEcole > 0 && (
        <p role="status" className="text-base font-semibold text-amber-700">
          {nbSansEcole === 1 ? '1 compte sans école assignée (à corriger)' : `${nbSansEcole} comptes sans école assignée (à corriger)`}
        </p>
      )}
      <div className="plai-card p-3 flex flex-wrap gap-3 items-start">
        <div>
          <label htmlFor="membres-recherche" className="block text-base">Rechercher un compte</label>
          <input id="membres-recherche" className="plai-input block" type="search" placeholder="Adresse ou nom, ex. dubois"
            aria-describedby="membres-recherche-aide" value={filtre.texte} onChange={(e) => setFiltre({ ...filtre, texte: e.target.value })} />
          <p id="membres-recherche-aide" className="text-base text-[color:var(--text3)] max-w-xs">Tapez une partie de l'adresse ou du nom. Les groupes sans résultat disparaissent.</p>
        </div>
        <div>
          <label htmlFor="membres-filtre-role" className="block text-base">Filtrer par rôle</label>
          <select id="membres-filtre-role" className="plai-input block" aria-describedby="membres-filtre-role-aide"
            value={filtre.role} onChange={(e) => setFiltre({ ...filtre, role: e.target.value })}>
            <option value="">Tous les rôles</option>
            {Object.entries(LIBELLE_ROLE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <p id="membres-filtre-role-aide" className="text-base text-[color:var(--text3)] max-w-xs">Ne garde que les comptes ayant ce rôle.</p>
        </div>
        <p className="text-base self-center" aria-live="polite">{compteurMembres(filtres.length, membres.length)}</p>
      </div>

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
          {parEcole.filter(({ membres: g }) => !filtreActif || g.length > 0).map(({ ecole, membres: membresEcole }) => (
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
  // État de la dernière mutation, seulement si elle concerne ce membre.
  const concerne = changerRole.variables?.userId === m.userId;
  const etatNiveaux = !concerne ? 'idle' : changerRole.isPending ? 'enCours' : changerRole.isError ? 'erreur' : changerRole.isSuccess ? 'ok' : 'idle';
  return (
    <li className="px-3 py-2 flex flex-wrap items-center gap-3">
      <span className="min-w-[12rem]">{m.email}</span>
      <input className="plai-input !py-1 text-sm w-40" defaultValue={m.nom ?? ''} placeholder="Nom"
        onBlur={(e) => { if ((e.target.value || '') !== (m.nom || '')) changerRole.mutate({ userId: m.userId, role: m.role, nom: e.target.value }); }} />
      <select className="plai-input !w-auto !py-1 text-sm" value={m.role}
        onChange={(e) => changerRole.mutate({ userId: m.userId, role: e.target.value })}>
        <option value="admin">{LIBELLE_ROLE.admin}</option>
        <option value="referent_plai">{LIBELLE_ROLE.referent_plai}</option>
        <option value="direction">{LIBELLE_ROLE.direction}</option>
        <option value="agent_plai">{LIBELLE_ROLE.agent_plai}</option>
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
        <NiveauxDirection membre={m} enregistrement={etatNiveaux}
          onChange={(niveaux) => changerRole.mutate({ userId: m.userId, role: m.role, niveaux })} />
      )}
      <button className="text-sm underline" onClick={() => { if (confirm(`Retirer l'accès de ${m.email} ?`)) retirer.mutate(m.userId); }}>retirer</button>
    </li>
  );
}
