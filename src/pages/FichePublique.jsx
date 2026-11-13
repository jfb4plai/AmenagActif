import { useParams, Link } from 'react-router-dom';
import SommairePublic from '../components/SommairePublic.jsx';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';
import { useQuery } from '@tanstack/react-query';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche, piedFicheClasse } from '../lib/imprimerFiche.js';

export default function FichePublique() {
  const { token, classeId } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['fiche-publique', token, classeId ?? null],
    retry: false,
    queryFn: async () => {
      const suffixe = classeId ? `&classe=${encodeURIComponent(classeId)}` : '';
      const res = await fetch(`/api/fiche-token?token=${encodeURIComponent(token)}${suffixe}`);
      if (!res.ok) throw new Error(res.status >= 500 ? 'panne' : 'lien inactif');
      return res.json();
    },
  });

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error?.message === 'panne') {
    return <div className="plai-section text-base" role="alert"><p className="plai-error" style={{ fontSize: 16 }}>Le service est momentanément indisponible. Réessayez dans quelques minutes.</p></div>;
  }
  if (!error && data?.sommaire) return <SommairePublic sommaire={data.sommaire} token={token} />;
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
        {data.depuisSommaire && (
          <p style={{ fontSize: 16 }}>
            <Link to={`/fiche/${encodeURIComponent(token)}`} className={`text-teal underline no-print ${FOCUS}`}>Retour à mes classes</Link>
          </p>
        )}
        <p className="text-sm text-[color:var(--text3)]">Fiche en lecture seule — diffusion restreinte aux enseignants concernés.</p>
        <button className="plai-btn" onClick={() => imprimerFiche(piedFicheClasse(data.vm))}>Imprimer / Enregistrer en PDF</button>
        <p className="text-sm">
          <a className="text-teal underline" href="/catalogue-amenagements" target="_blank" rel="noopener noreferrer">
            Voir la liste complète des aménagements possibles (AU/AR)
          </a>
        </p>
        <p style={{ fontSize: 16 }}>
          <a className="text-teal underline" href="/modes-emploi/enseignants.html" target="_blank" rel="noopener noreferrer">
            Comment utiliser cette fiche (3 minutes)
          </a>
        </p>
      </div>
      <FicheClasseView vm={data.vm} lienEleve={false} />
    </div>
  );
}
