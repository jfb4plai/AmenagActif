import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';

export default function FichePublique() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['fiche-publique', token],
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/fiche-token?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error(res.status >= 500 ? 'panne' : 'lien inactif');
      return res.json();
    },
  });

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error?.message === 'panne') {
    return <div className="plai-section text-base" role="alert"><p className="plai-error" style={{ fontSize: 16 }}>Le service est momentanément indisponible. Réessayez dans quelques minutes.</p></div>;
  }
  if (error || !data?.vm) {
    return (
      <div className="plai-section text-base" role="alert">
        <h1 className="text-lg font-semibold mb-2">Ce lien n'est plus actif</h1>
        <p style={{ fontSize: 16 }}>Le lien a été désactivé, il est arrivé à échéance ou il est incorrect. Demandez un nouveau lien à votre référent PLAI ou à la direction de votre école.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-6">
      <div className="text-center mb-3 no-print space-y-2">
        <p className="text-sm text-[color:var(--text3)]">Fiche en lecture seule — diffusion restreinte aux enseignants concernés.</p>
        <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>
        <p className="text-sm">
          <a className="text-teal underline" href="/catalogue-amenagements" target="_blank" rel="noopener noreferrer">
            Voir la liste complète des aménagements possibles (AU/AR)
          </a>
        </p>
      </div>
      <FicheClasseView vm={data.vm} lienEleve={false} />
    </div>
  );
}
