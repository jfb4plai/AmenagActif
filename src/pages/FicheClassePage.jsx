import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useFicheClasse } from '../hooks/useFicheClasse.js';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { telechargerPdf } from '../lib/telechargerPdf.js';

function Picker() {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');
  const { data: grid } = useEcoleGrid(ecoleId || null, anneeId || null);
  return (
    <div className="plai-section space-y-3">
      <h1 className="text-xl font-semibold">Fiches par classe</h1>
      <div className="flex gap-3">
        <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
          <option value="">École…</option>
          {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select className="plai-input" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
          <option value="">Année…</option>
          {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
        </select>
      </div>
      <ul className="list-disc pl-6">
        {(grid?.classes ?? []).map((c) => (
          <li key={c.id}><Link className="text-teal underline" to={`/classe/${c.id}/fiche`}>{c.nom}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export default function FicheClassePage({ picker }) {
  const { classeId } = useParams();
  if (picker || !classeId) return <Picker />;
  return <FicheClasseContenu classeId={classeId} />;
}

function FicheClasseContenu({ classeId }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <div className="flex gap-3">
        <button className="plai-btn" onClick={() => telechargerPdf('classe', classeId)}>Télécharger le PDF</button>
      </div>
      <FicheClasseView vm={vm} />
    </div>
  );
}
