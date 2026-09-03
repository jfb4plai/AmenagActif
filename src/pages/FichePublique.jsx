import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';

export default function FichePublique() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['fiche-publique', token],
    queryFn: async () => {
      const res = await fetch(`/api/fiche-token?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error('lien invalide');
      return res.json();
    },
  });

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">Ce lien est invalide ou a expiré. Demandez un lien à jour à l'équipe PLAI.</p></div>;

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-6">
      <p className="text-center text-sm text-[color:var(--text3)] mb-3">Fiche en lecture seule — diffusion restreinte aux enseignants concernés.</p>
      <FicheClasseView vm={data.vm} />
    </div>
  );
}
