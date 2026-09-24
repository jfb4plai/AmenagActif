import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

// Insensible à la casse et aux accents.
const normaliser = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Page publique et statique — aucune connexion requise, aucun lien vers le
 * reste de l'app pour un visiteur anonyme (voir App.jsx : pas de Shell/Nav).
 * Liste de référence des AU/AR actifs, sans aucune donnée élève. Non indexée
 * (robots ici + en-tête X-Robots-Tag posé dans vercel.json).
 * Accessible aussi depuis le menu de l'app (utilisateur connecté) : dans ce
 * cas seulement, un lien de retour apparaît — rien de plus pour un visiteur
 * anonyme (enseignant sans compte via la fiche classe publique).
 */
export default function CatalogueAmenagements() {
  const { session } = useAuth();
  const [recherche, setRecherche] = useState('');
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

  const termes = useMemo(() => normaliser(recherche).split(/\s+/).filter(Boolean), [recherche]);

  if (isLoading) return <div className="plai-section max-w-3xl mx-auto">Chargement…</div>;
  if (error || !data) return <div className="plai-section max-w-3xl mx-auto"><p className="plai-error">{error?.message ?? 'Chargement impossible.'}</p></div>;

  const { chapitres, amenagements } = data;
  const correspond = (a) => termes.every((t) => normaliser(a.libelle).includes(t));
  const visibles = termes.length ? amenagements.filter(correspond) : amenagements;

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {session && <Link to="/" className="text-sm text-teal underline">← Retour à l'app</Link>}
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Aménagements universels et raisonnables — liste complète</h1>
          <p className="text-sm text-[color:var(--text3)]">
            Référence de tous les aménagements proposés par le Pôle Territorial de la Ville de Liège (PLAI) dans AménagActif —
            <strong> AU</strong> = universel (concerne toute une classe), <strong>AR</strong> = raisonnable (propre à un élève).
            Cette page ne montre aucune information sur un élève ou une classe en particulier.
          </p>
        </header>

        <div className="space-y-1">
          <label htmlFor="recherche-amenagement" className="block text-base font-medium">Rechercher un aménagement</label>
          <div className="flex gap-2">
            <input
              id="recherche-amenagement"
              type="search"
              className="plai-input block flex-1"
              placeholder="Ex. : espaces de réponse, police, consignes"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {recherche && (
              <button type="button" className="plai-btn" onClick={() => setRecherche('')}>Effacer</button>
            )}
          </div>
          <p className="text-sm text-[color:var(--text3)]" aria-live="polite">
            {termes.length
              ? `${visibles.length} aménagement${visibles.length > 1 ? 's' : ''} trouvé${visibles.length > 1 ? 's' : ''}. `
              : ''}
            Tapez un ou plusieurs mots : seuls les aménagements qui les contiennent tous restent affichés. Les accents et les majuscules sont ignorés.
          </p>
        </div>

        {termes.length > 0 && visibles.length === 0 && (
          <p className="plai-empty">Aucun aménagement ne correspond. Essayez un mot plus court ou un seul mot.</p>
        )}

        {chapitres.map((ch) => {
          const items = visibles.filter((a) => a.chapitre_id === ch.id);
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
