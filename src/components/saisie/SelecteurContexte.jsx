import { useEcoles, useAnnees } from '../../hooks/useEcoleGrid.js';

export default function SelecteurContexte({ ecoleId, anneeId, onChange }) {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div>
        <label htmlFor="sel-ecole" className="block font-medium">École / implantation</label>
        <select id="sel-ecole" className="plai-input" value={ecoleId ?? ''}
          onChange={(e) => onChange({ ecoleId: e.target.value || null, anneeId })}>
          <option value="">— choisir —</option>
          {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.implantation ? ` (${e.implantation})` : ''}</option>)}
        </select>
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
