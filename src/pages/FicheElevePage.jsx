import { useParams } from 'react-router-dom';
import { useFicheEleve } from '../hooks/useFicheEleve.js';
import FicheEleveView from '../components/fiche/FicheEleveView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';

export default function FicheElevePage() {
  const { eleveId } = useParams();
  const { data: vm, isLoading, error } = useFicheEleve(eleveId);
  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <button className="plai-btn no-print" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>
      <FicheEleveView vm={vm} />
    </div>
  );
}
