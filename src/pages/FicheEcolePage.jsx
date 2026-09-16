import { useState } from 'react';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useFicheClasse } from '../hooks/useFicheClasse.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';
import { useRole } from '../lib/auth.jsx';

function FicheUneClasse({ classeId }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <p>Chargement de la classe…</p>;
  if (error) return <p className="plai-error">{error.message}</p>;
  return <FicheClasseView vm={vm} />;
}

export default function FicheEcolePage() {
  const { isAdmin } = useRole();
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');

  const ecoleActive = ecoleUnique?.id || ecoleId;
  const anneeActive = anneeId || annees.find((a) => a.active)?.id || '';
  const { data: grid } = useEcoleGrid(ecoleActive || null, anneeActive || null);
  const classes = grid?.classes ?? [];

  return (
    <div className="plai-section space-y-3">
      <h1 className="text-xl font-semibold no-print">Fiche — vue école complète</h1>
      <div className="flex gap-3 no-print">
        {!ecoleUnique && (
          <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
            <option value="">École…</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        )}
        <select className="plai-input" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
          <option value="">Année…</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
        </select>
        {ecoleActive && anneeActive && <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>}
      </div>
      {ecoleActive && anneeActive && classes.map((c) => <FicheUneClasse key={c.id} classeId={c.id} />)}
    </div>
  );
}
