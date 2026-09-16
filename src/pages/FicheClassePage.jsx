import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useFicheClasse } from '../hooks/useFicheClasse.js';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';
import { useRole } from '../lib/auth.jsx';
import { supabase } from '../lib/supabase.js';

function Picker() {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const { isAdmin } = useRole();
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');
  useEffect(() => {
    if (ecoleUnique && ecoleId !== ecoleUnique.id) setEcoleId(ecoleUnique.id);
  }, [ecoleUnique, ecoleId]);
  useEffect(() => {
    if (!anneeId && annees.length) {
      const active = annees.find((a) => a.active);
      if (active) setAnneeId(active.id);
    }
  }, [annees, anneeId]);
  const { data: grid } = useEcoleGrid(ecoleId || null, anneeId || null);
  return (
    <div className="plai-section space-y-3">
      <h1 className="text-xl font-semibold">Fiches par classe</h1>
      <Link className="text-sm text-teal underline" to="/fiches/ecole">Voir la fiche « vue école complète »</Link>
      <div className="flex gap-3">
        {ecoleUnique ? (
          <span className="plai-input inline-block bg-[color:var(--bg)]">{ecoleUnique.nom}</span>
        ) : (
          <select className="plai-input" value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
            <option value="">École…</option>
            {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
          </select>
        )}
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

  async function copierLien() {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/fiche-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ classeId }),
    });
    if (!res.ok) { alert('Impossible de générer le lien.'); return; }
    const { url } = await res.json();
    const libelle = `Aménagements à mettre en place — ${vm.classeNom} (${vm.ecoleNom})`;

    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([`<a href="${url}">${libelle}</a>`], { type: 'text/html' }),
            'text/plain': new Blob([`${libelle} : ${url}`], { type: 'text/plain' }),
          }),
        ]);
        alert('Lien enseignant copié — collez-le dans votre e-mail, il apparaîtra sous forme de texte cliquable (« Aménagements à mettre en place… ») plutôt que l\'adresse brute.');
        return;
      } catch {
        // navigateur sans support du presse-papier riche : repli plein texte
      }
    }
    await navigator.clipboard.writeText(`${libelle} : ${url}`);
    alert('Lien enseignant copié dans le presse-papier.');
  }

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <div className="flex gap-3 no-print">
        <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>
        <button className="plai-btn" onClick={copierLien}>Copier le lien enseignant</button>
      </div>
      <FicheClasseView vm={vm} />
    </div>
  );
}
