import { useEffect } from 'react';
import { useEcoles, useAnnees } from '../../hooks/useEcoleGrid.js';
import { useRole } from '../../lib/auth.jsx';

export default function SelecteurContexte({ ecoleId, anneeId, onChange }) {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const { isAdmin } = useRole();

  // Non-admin : une seule école visible (RLS) → verrouillée sur celle-ci.
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;

  useEffect(() => {
    if (ecoleUnique && ecoleId !== ecoleUnique.id) onChange({ ecoleId: ecoleUnique.id, anneeId });
  }, [ecoleUnique, ecoleId, anneeId, onChange]);

  // Présélectionne l'année active tant qu'aucune année n'est choisie.
  useEffect(() => {
    if (anneeId) return;
    const active = annees.find((a) => a.active);
    if (active) onChange({ ecoleId, anneeId: active.id });
  }, [annees, anneeId, ecoleId, onChange]);

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label htmlFor="sel-ecole" className="block font-medium">École / implantation</label>
        {ecoleUnique ? (
          <p className="plai-input inline-block bg-[color:var(--bg)]">{ecoleUnique.nom}{ecoleUnique.implantation ? ` (${ecoleUnique.implantation})` : ''}</p>
        ) : (
          <select id="sel-ecole" className="plai-input" value={ecoleId ?? ''}
            onChange={(e) => onChange({ ecoleId: e.target.value || null, anneeId })}>
            <option value="">— choisir —</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.implantation ? ` (${e.implantation})` : ''}</option>)}
          </select>
        )}
        <p className="text-sm text-[color:var(--text3)]">Une école = une grille. Les colonnes sont les élèves de ses classes.</p>
      </div>
      <div>
        <label htmlFor="sel-annee" className="block font-medium">Année scolaire</label>
        <select id="sel-annee" className="plai-input" value={anneeId ?? ''}
          onChange={(e) => onChange({ ecoleId, anneeId: e.target.value || null })}>
          <option value="">— choisir —</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}{a.active ? ' (active)' : ''}</option>)}
        </select>
      </div>
    </div>
  );
}
