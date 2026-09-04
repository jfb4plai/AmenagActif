import { useState, useEffect } from 'react';
import { useAnnees, useReferents, useAdminMutations } from '../hooks/useAdmin.js';
import { useEcoles } from '../hooks/useEcoleGrid.js';

const LABEL = { direction: 'Direction', referent_ecole: "Référent·e d'école", plai: 'PLAI' };

/**
 * Gestion des référents d'école (colonne « PAR » des fiches).
 * @param {{ ecoleFixe?: { id: string, nom: string } }} props
 *   ecoleFixe : quand fourni (référent/direction), l'école est verrouillée.
 */
export default function GestionReferentsEcole({ ecoleFixe }) {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const [ecoleId, setEcoleId] = useState(ecoleFixe?.id ?? '');
  const [anneeId, setAnneeId] = useState('');

  useEffect(() => { if (ecoleFixe && ecoleId !== ecoleFixe.id) setEcoleId(ecoleFixe.id); }, [ecoleFixe, ecoleId]);
  useEffect(() => {
    if (!anneeId && annees.length) {
      const active = annees.find((a) => a.active);
      if (active) setAnneeId(active.id);
    }
  }, [annees, anneeId]);

  const { data: referents = [] } = useReferents(ecoleId || null, anneeId || null);
  const { ajouterReferent, supprimerReferent } = useAdminMutations();
  const [f, setF] = useState({ nom: '', fonction: 'direction' });

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Référents d'école (colonne « PAR » de la fiche)</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Désignés par année. Direction et référent·e d'école apparaissent dans le tableau « PAR (Direction) » des fiches classe.
      </p>
      <div className="flex gap-3">
        {ecoleFixe ? (
          <span className="plai-input inline-block bg-[color:var(--bg)]">{ecoleFixe.nom}</span>
        ) : (
          <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
            <option value="">École…</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        )}
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
      {(ajouterReferent.isError || supprimerReferent.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}
