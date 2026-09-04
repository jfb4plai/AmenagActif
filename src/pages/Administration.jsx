import { useState, useEffect } from 'react';
import { useAnnees, useEcoles, useReferents, useAdminMutations } from '../hooks/useAdmin.js';

export default function Administration() {
  return (
    <div className="plai-section space-y-8 max-w-3xl">
      <h1 className="text-xl font-semibold">Administration</h1>
      <SectionAnnees />
      <SectionEcoles />
      <SectionReferents />
    </div>
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

/* ─────────────── Référents d'école ─────────────── */
function SectionReferents() {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');
  useEffect(() => {
    if (!anneeId && annees.length) {
      const active = annees.find((a) => a.active);
      if (active) setAnneeId(active.id);
    }
  }, [annees, anneeId]);

  const { data: referents = [] } = useReferents(ecoleId || null, anneeId || null);
  const { ajouterReferent, supprimerReferent } = useAdminMutations();
  const [f, setF] = useState({ nom: '', fonction: 'direction' });

  const LABEL = { direction: 'Direction', referent_ecole: "Référent·e d'école", plai: 'PLAI' };

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Référents d'école (colonne « PAR » de la fiche)</h2>
      <p className="text-sm text-[color:var(--text3)]">Désignés par année. Direction et référent·e d'école apparaissent dans le tableau « PAR (Direction) » des fiches classe.</p>
      <div className="flex gap-3">
        <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
          <option value="">École…</option>
          {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select className="plai-input" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
          <option value="">Année…</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.active ? ' (active)' : ''}</option>)}
        </select>
      </div>

      {ecoleId && anneeId && (
        <>
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={(e) => { e.preventDefault(); if (f.nom.trim()) { ajouterReferent.mutate({ ecoleId, anneeId, ...f }); setF({ nom: '', fonction: 'direction' }); } }}
          >
            <label className="text-sm">Nom
              <input className="plai-input block" placeholder="Julien Martin" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
            </label>
            <label className="text-sm">Fonction
              <select className="plai-input block" value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })}>
                <option value="direction">Direction</option>
                <option value="referent_ecole">Référent·e d'école</option>
                <option value="plai">PLAI</option>
              </select>
            </label>
            <button className="plai-btn" type="submit" disabled={!f.nom.trim()}>Ajouter</button>
          </form>
          <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
            {referents.length === 0 && <li className="px-3 py-2 text-[color:var(--text3)] text-sm">Aucun référent pour cette école et cette année.</li>}
            {referents.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2">
                <span>{r.nom} <span className="text-[color:var(--text3)]">— {LABEL[r.fonction] ?? r.fonction}</span></span>
                <button className="text-sm underline" onClick={() => supprimerReferent.mutate(r.id)}>retirer</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
