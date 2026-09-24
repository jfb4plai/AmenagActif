import { useState, useEffect } from 'react';
import {
  useAnnees, useEcoles, useEcolesAdmin, useAdminMutations,
  useCatalogueAdmin, useCatalogueMutations,
} from '../hooks/useAdmin.js';
import { useMembres, useMembresMutations } from '../hooks/useMembres.js';

const LABEL_ROLE = { admin: 'Administrateur', referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };
const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai']; // rôles nécessitant une école à l'invitation
const ROLE_SCOPE_MULTI = ['referent_plai', 'direction', 'agent_plai', 'admin']; // rôles pouvant être rattachés à PLUSIEURS écoles ensuite (admin : rattachement facultatif, identification "Mon école" seulement — aucun droit supplémentaire)

export default function Administration() {
  return (
    <div className="plai-section space-y-8 max-w-4xl px-4">
      <h1 className="text-xl font-semibold">Administration</h1>
      <SectionMembres />
      <SectionAnnees />
      <SectionEcoles />
      <SectionCatalogue />
    </div>
  );
}

/* ─────────────── Membres & accès ─────────────── */
function SectionMembres() {
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
        <strong>Agent accompagnant</strong> : sur une ou plusieurs écoles comme référent/direction, peut créer/modifier/supprimer des élèves et leurs AR, et ajouter (pas retirer) un AU — mais ne peut pas créer de classe.
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
          const items = amenagements.filter((a) => a.chapitre_id === ch.id);
          const estOuvert = ouvert === ch.id;
          return (
            <div key={ch.id}>
              <button className="w-full text-left px-3 py-2 flex items-center gap-2 font-medium"
                onClick={() => setOuvert(estOuvert ? null : ch.id)}>
                <span>{estOuvert ? '▼' : '▶'}</span>
                <span>{ch.titre}</span>
                <span className="text-sm text-[color:var(--text3)]">
                  ({items.filter((i) => i.type === 'AU').length} AU · {items.filter((i) => i.type === 'AR').length} AR)
                </span>
              </button>
              {estOuvert && (
                <div className="px-3 pb-3 space-y-3">
                  {items.map((a) => (
                    <div key={a.id} className={`border rounded p-2 space-y-2 ${a.actif ? 'border-[color:var(--border)]' : 'border-dashed border-[color:var(--border)] opacity-60'}`}>
                      <textarea
                        className="plai-input text-sm w-full"
                        rows={2}
                        defaultValue={a.libelle}
                        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.libelle) majAmenagement.mutate({ id: a.id, libelle: e.target.value }); }}
                      />
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-1">
                          Type
                          <select className="plai-input !w-auto !py-1" value={a.type}
                            onChange={(e) => majAmenagement.mutate({ id: a.id, type: e.target.value })}>
                            <option value="AU">AU — universel (classe)</option>
                            <option value="AR">AR — raisonnable (élève)</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">
                          Chapitre
                          <select className="plai-input !w-auto !py-1" value={a.chapitre_id}
                            onChange={(e) => majAmenagement.mutate({ id: a.id, chapitreId: e.target.value })}>
                            {chapitres.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
                          </select>
                        </label>
                        <span className="flex items-center gap-1" title="Code stable, non modifiable : il reste identique même si le libellé change.">
                          Code
                          <code className="px-1 rounded bg-[color:var(--bg)] border border-[color:var(--border)]">{a.code ?? 'aucun'}</code>
                        </span>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={a.actif}
                            onChange={(e) => majAmenagement.mutate({ id: a.id, actif: e.target.checked })} />
                          actif
                        </label>
                      </div>
                    </div>
                  ))}
                  <AjoutAmenagement chapitreId={ch.id} onAdd={ajouterAmenagement.mutate} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AjoutChapitre onAdd={ajouterChapitre.mutate} />
      {(majAmenagement.isError || ajouterAmenagement.isError || ajouterChapitre.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}

function AjoutAmenagement({ chapitreId, onAdd }) {
  const [libelle, setLibelle] = useState('');
  const [type, setType] = useState('AR');
  const [code, setCode] = useState('');
  const codeValide = code.trim() === '' || /^ar_[a-z0-9]+(_[a-z0-9]+)+$/.test(code.trim());
  return (
    <form className="border border-dashed border-teal rounded p-2 space-y-2"
      onSubmit={(e) => { e.preventDefault(); if (libelle.trim() && codeValide) { onAdd({ chapitreId, libelle, type, code: code.trim() || undefined }); setLibelle(''); setType('AR'); setCode(''); } }}>
      <textarea className="plai-input text-sm w-full" rows={2} placeholder="Nouvel aménagement pour ce chapitre"
        value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          Type
          <select className="plai-input !w-auto !py-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="AU">AU — universel</option>
            <option value="AR">AR — raisonnable</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          Code (optionnel)
          <input className="plai-input !w-56 !py-1" placeholder="ar_lecture_mon_amenagement" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button className="plai-btn" type="submit" disabled={!libelle.trim() || !codeValide}>Ajouter</button>
      </div>
      <p className="text-xs text-[color:var(--text3)]">
        Le code sert de repère stable pour d'autres outils PLAI (minuscules, chiffres et _ ; commence par ar_). Laissez vide si vous ne savez pas :
        il pourra être posé plus tard. <strong>Une fois posé, il ne peut plus être modifié.</strong>
        {!codeValide && <span className="plai-error block">Format attendu : ar_chapitre_mot (ex. ar_lecture_loupe).</span>}
      </p>
    </form>
  );
}

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

/* ─────────────── Années scolaires ─────────────── */
function SectionAnnees() {
  const { data: annees = [] } = useAnnees();
  const { ajouterAnnee, activerAnnee } = useAdminMutations();
  const [libelle, setLibelle] = useState('');

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Années scolaires</h2>
      <p className="text-sm text-[color:var(--text3)]">
        L'année « active » est celle présélectionnée dans la saisie et les fiches. Fin août, créez la nouvelle année et rendez-la active.
      </p>
      <form
        className="flex gap-2 items-end"
        onSubmit={(e) => { e.preventDefault(); if (/^\d{4}-\d{4}$/.test(libelle.trim())) { ajouterAnnee.mutate(libelle); setLibelle(''); } }}
      >
        <label className="text-sm">
          Nouvelle année
          <input className="plai-input block" placeholder="2027-2028" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        </label>
        <button className="plai-btn" type="submit" disabled={!/^\d{4}-\d{4}$/.test(libelle.trim())}>Ajouter</button>
      </form>
      <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
        {annees.map((a) => (
          <li key={a.id} className="flex items-center justify-between px-3 py-2">
            <span>{a.libelle} {a.active && <span className="text-teal font-semibold">· active</span>}</span>
            {!a.active && (
              <button className="text-sm underline text-teal" onClick={() => activerAnnee.mutate(a.id)}>Rendre active</button>
            )}
          </li>
        ))}
      </ul>
      {(ajouterAnnee.isError || activerAnnee.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}

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
