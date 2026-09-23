import { useState } from 'react';

/**
 * Sélection explicite d'une classe existante, ou création d'une nouvelle —
 * remplace la saisie libre du nom de classe pour fiabiliser le flux
 * (plus de correspondance texte hasardeuse entre "5LA" et "5 LA").
 */
export default function SelecteurClasse({ classes = [], onSelect, onCreate, peutCreer = true }) {
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [niveau, setNiveau] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async (e) => {
    e.preventDefault();
    setEnCours(true);
    setErreur('');
    try {
      const classeId = await onCreate({ nom, niveau });
      setCreation(false);
      setNom('');
      setNiveau('');
      onSelect(classeId);
    } catch (err) {
      setErreur(err.message || 'Échec de la création, réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  if (creation) {
    return (
      <form className="plai-card p-3 flex flex-wrap gap-2 items-end" onSubmit={valider}>
        <label className="text-sm">Nom de la classe
          <input className="plai-input block" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="5LA" disabled={enCours} />
        </label>
        <label className="text-sm">Niveau
          <input className="plai-input block" value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="5e" disabled={enCours} />
        </label>
        <button type="submit" className="plai-btn" disabled={enCours || !nom.trim()}>{enCours ? 'Création…' : 'Créer et continuer'}</button>
        <button type="button" className="text-sm underline" onClick={() => setCreation(false)} disabled={enCours}>Annuler</button>
        {erreur && <p className="plai-error text-xs w-full">{erreur}</p>}
      </form>
    );
  }

  return (
    <div className="plai-card p-3 flex flex-wrap gap-2 items-end">
      <label className="text-sm">Classe
        <select className="plai-input block" value="" onChange={(e) => e.target.value && onSelect(e.target.value)}>
          <option value="">— choisir une classe —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.niveau ? ` — ${c.niveau}` : ''}</option>)}
        </select>
      </label>
      {peutCreer && <button type="button" className="plai-btn" onClick={() => setCreation(true)}>+ Nouvelle classe</button>}
      {!peutCreer && classes.length === 0 && (
        <p className="text-sm text-[color:var(--text3)]">Aucune classe créée pour l'instant dans cette école — demandez au référent PLAI, à la direction ou à l'administrateur d'en créer une.</p>
      )}
    </div>
  );
}
