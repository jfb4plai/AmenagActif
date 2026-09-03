import { useParams } from 'react-router-dom';
import { useFicheEleve } from '../hooks/useFicheEleve.js';
import FicheEleveView from '../components/fiche/FicheEleveView.jsx';
import { telechargerPdf } from '../lib/telechargerPdf.js';

export default function FicheElevePage() {
  const { eleveId } = useParams();
  const { data: vm, isLoading, error } = useFicheEleve(eleveId);
  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <button className="plai-btn" onClick={() => telechargerPdf('eleve', eleveId)}>Télécharger le PDF</button>
      <FicheEleveView vm={vm} />
    </div>
  );
}
