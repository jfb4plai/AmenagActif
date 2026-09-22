import { useState, useEffect } from 'react';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useFicheClasse } from '../hooks/useFicheClasse.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';
import { useRole } from '../lib/auth.jsx';

function FicheUneClasse({ classeId, showStatutEleve }) {
  const { data: vm, isLoading, error } = useFicheClasse(classeId);
  if (isLoading) return <p>Chargement de la classe…</p>;
  if (error) return <p className="plai-error">{error.message}</p>;
  return <FicheClasseView vm={vm} showStatutEleve={showStatutEleve} />;
}

export default function FicheEcolePage() {
  const { isAdmin } = useRole();
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');

  useEffect(() => {
    if (ecoleUnique && ecoleId !== ecoleUnique.id) setEcoleId(ecoleUnique.id);
  }, [ecoleUnique, ecoleId]);
  useEffect(() => {
    if (anneeId) return;
    const active = annees.find((a) => a.active);
    if (active) setAnneeId(active.id);
  }, [annees, anneeId]);

  const ecoleActive = ecoleUnique?.id || ecoleId;
  const anneeActive = anneeId;
  const { data: grid } = useEcoleGrid(ecoleActive || null, anneeActive || null);
  const classes = grid?.classes ?? [];
  const ecole = ecoleActive ? ecoles.find((x) => x.id === ecoleActive) : null;

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
      {ecoleActive && anneeActive && ecole && <p className="font-semibold mb-2">{ecole.nom} · FASE {ecole.implantation || '—'}</p>}
      {ecoleActive && anneeActive && classes.map((c) => <FicheUneClasse key={c.id} classeId={c.id} showStatutEleve />)}
    </div>
  );
}
