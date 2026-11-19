import { useState } from 'react';
import { useEcolesAdmin, useAdminMutations } from '../../hooks/useAdmin.js';

export default function EcolesTab() {
  const { data: ecoles = [] } = useEcolesAdmin();
  const { ajouterEcole, majEcole } = useAdminMutations();
  const [f, setF] = useState({ nom: '', implantation: '', implantationNom: '' });

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Écoles / implantations</h2>
      <p className="text-sm text-[color:var(--text3)]">Les implantations accompagnées. Désactiver une école la retire des sélecteurs (saisie, fiches) sans supprimer ses données ; réactivable à tout moment ci-dessous.</p>
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
