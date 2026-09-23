import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Page publique et statique — aucune connexion requise, aucun lien vers le
 * reste de l'app (voir App.jsx : pas de Shell/Nav). Liste de référence des
 * AU/AR actifs, sans aucune donnée élève. Non indexée (robots ici +
 * en-tête X-Robots-Tag posé dans vercel.json).
 */
export default function CatalogueAmenagements() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['catalogue-public'],
    queryFn: async () => {
      const res = await fetch('/api/catalogue');
      if (!res.ok) throw new Error('Chargement impossible.');
      return res.json();
    },
  });

  if (isLoading) return <div className="plai-section max-w-3xl mx-auto">Chargement…</div>;
  if (error || !data) return <div className="plai-section max-w-3xl mx-auto"><p className="plai-error">{error?.message ?? 'Chargement impossible.'}</p></div>;

  const { chapitres, amenagements } = data;

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Aménagements universels et raisonnables — liste complète</h1>
          <p className="text-sm text-[color:var(--text3)]">
            Référence de tous les aménagements proposés par le Pôle Territorial de la Ville de Liège (PLAI) dans AménagActif —
            <strong> AU</strong> = universel (concerne toute une classe), <strong>AR</strong> = raisonnable (propre à un élève).
            Cette page ne montre aucune information sur un élève ou une classe en particulier.
          </p>
        </header>

        {chapitres.map((ch) => {
          const items = amenagements.filter((a) => a.chapitre_id === ch.id);
          if (items.length === 0) return null;
          return (
            <section key={ch.id} className="plai-card p-4 space-y-2">
              <h2 className="font-semibold">{ch.titre}</h2>
              <ul className="space-y-1.5">
                {items.map((a) => (
                  <li key={a.id} className="text-sm flex items-start gap-2">
                    <span className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${a.type === 'AU' ? 'bg-teal/10 text-teal' : 'bg-orange/10 text-orange'}`}>
                      {a.type}
                    </span>
                    <span>{a.libelle}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
