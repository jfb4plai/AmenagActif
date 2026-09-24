import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useFicheClasse, useFicheGroupe } from '../hooks/useFicheClasse.js';
import { useEcoles, useAnnees, useEcoleGrid } from '../hooks/useEcoleGrid.js';
import FicheClasseView from '../components/fiche/FicheClasseView.jsx';
import { imprimerFiche } from '../lib/imprimerFiche.js';
import { useRole } from '../lib/auth.jsx';
import GenerateurLien from '../components/GenerateurLien.jsx';

function Picker() {
  const { data: ecoles = [] } = useEcoles();
  const { data: annees = [] } = useAnnees();
  const { isAdmin, role } = useRole();
  const ecoleUnique = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const [ecoleId, setEcoleId] = useState('');
  const [anneeId, setAnneeId] = useState('');
  const [selection, setSelection] = useState(new Set());
  const [nomGroupe, setNomGroupe] = useState('');
  const [valide, setValide] = useState(null); // { classeIds, nomGroupe } une fois "Valider" cliqué
  const peutGrouper = role === 'admin' || role === 'referent_plai' || role === 'direction';
  const apercu = useFicheGroupe(valide?.classeIds, valide?.nomGroupe);

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

  function basculer(classeId) {
    setSelection((s) => {
      const n = new Set(s);
      n.has(classeId) ? n.delete(classeId) : n.add(classeId);
      return n;
    });
    setValide(null); // toute modification de la sélection invalide l'aperçu déjà confirmé
  }

  function changerNomGroupe(v) {
    setNomGroupe(v);
    setValide(null);
  }

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
      <ul className="space-y-1">
        {(grid?.classes ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            {peutGrouper && (
              <input type="checkbox" checked={selection.has(c.id)} onChange={() => basculer(c.id)}
                aria-label={`Sélectionner ${c.nom} pour un regroupement`} />
            )}
            <Link className="text-teal underline" to={`/classe/${c.id}/fiche`}>{c.nom}</Link>
          </li>
        ))}
      </ul>

      {peutGrouper && selection.size >= 2 && (
        <div className="plai-card p-3 space-y-2 max-w-md">
          <p className="font-medium text-sm">Fiche groupée — {selection.size} classes sélectionnées</p>
          <p className="text-xs text-[color:var(--text3)]">
            Pour un cours pratique réunissant plusieurs classes (atelier, groupe transversal…) : une seule fiche,
            AU et AR fusionnés, sans doublon. L'envoi du lien à l'enseignant reste à faire vous-même, comme pour une classe seule.
          </p>
          <label className="text-sm block">Nom du groupe (optionnel)
            <input className="plai-input w-full" placeholder="Atelier cuisine 3e" value={nomGroupe} onChange={(e) => changerNomGroupe(e.target.value)} />
            <span className="block text-xs text-[color:var(--text3)] font-normal">Affiché en titre de la fiche. Vide : les noms des classes sont concatenés (« 3LA + 3LB »).</span>
          </label>
          <button className="plai-btn" onClick={() => setValide({ classeIds: [...selection], nomGroupe: nomGroupe.trim() })}>
            Valider la sélection — voir la fiche
          </button>
        </div>
      )}

      {valide && (
        <div className="space-y-2 max-w-3xl">
          {apercu.isLoading && <p className="text-sm">Chargement de l'aperçu…</p>}
          {apercu.error && <p className="plai-error text-sm">{apercu.error.message}</p>}
          {apercu.data && (
            <>
              <p className="text-base">
                Aperçu confirmé pour <strong>{apercu.data.classeNom}</strong> : vérifiez le contenu ci-dessous avant de générer le lien à envoyer.
              </p>
              <GenerateurLien
                classeIds={valide.classeIds}
                nomGroupe={valide.nomGroupe}
                libelle={`Aménagements à mettre en place — ${apercu.data.classeNom}`}
              />
              <div className="border border-[color:var(--border)] rounded overflow-auto max-h-[70vh]">
                <FicheClasseView vm={apercu.data} />
              </div>
            </>
          )}
        </div>
      )}
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
  const { role } = useRole();

  const [lienOuvert, setLienOuvert] = useState(false);

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">{error.message}</p></div>;
  return (
    <div className="plai-section space-y-3">
      <div className="flex gap-3 no-print">
        <button className="plai-btn" onClick={imprimerFiche}>Imprimer / Enregistrer en PDF</button>
        {role !== 'agent_plai' && (
          <button className="plai-btn" style={{ fontSize: 16 }} aria-expanded={lienOuvert} onClick={() => setLienOuvert((o) => !o)}>
            Copier le lien enseignant
          </button>
        )}
      </div>
      {role !== 'agent_plai' && lienOuvert && (
        <GenerateurLien classeIds={[classeId]} libelle={`Aménagements à mettre en place — ${vm.classeNom} (${vm.ecoleNom})`} />
      )}
      <FicheClasseView vm={vm} />
    </div>
  );
}
