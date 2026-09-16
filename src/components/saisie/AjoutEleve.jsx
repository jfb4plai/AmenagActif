import { useState } from 'react';

export default function AjoutEleve({ onCreate }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ classeNom: '', niveau: '', prenom: '', initiale: '', referent: '' });
  const [etat, setEtat] = useState('idle'); // idle | creation | erreur
  const [erreur, setErreur] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!ouvert) return <button className="plai-btn" onClick={() => setOuvert(true)}>+ élève</button>;

  const soumettre = async (e) => {
    e.preventDefault();
    setEtat('creation');
    setErreur('');
    try {
      await onCreate(f);
      setOuvert(false);
      setEtat('idle');
      setF({ classeNom: '', niveau: '', prenom: '', initiale: '', referent: '' });
    } catch (err) {
      setEtat('erreur');
      setErreur(err.message || "Échec de la création, réessayez.");
    }
  };

  const enCours = etat === 'creation';

  return (
    <form className="plai-card p-3 flex flex-wrap gap-2 items-end" onSubmit={soumettre}>
      <label className="text-sm">Classe
        <input className="plai-input block" required value={f.classeNom} onChange={set('classeNom')} placeholder="5LA" disabled={enCours} />
      </label>
      <label className="text-sm">Niveau
        <input className="plai-input block" value={f.niveau} onChange={set('niveau')} placeholder="5e" disabled={enCours} />
      </label>
      <label className="text-sm">Prénom
        <input className="plai-input block" required value={f.prenom} onChange={set('prenom')} placeholder="Emilie" disabled={enCours} />
      </label>
      <label className="text-sm">Initiale
        <input className="plai-input block" maxLength={2} value={f.initiale} onChange={set('initiale')} placeholder="D" disabled={enCours} />
      </label>
      <label className="text-sm">Référent(s) PLAI
        <input className="plai-input block" value={f.referent} onChange={set('referent')} placeholder="Mona, Julie" disabled={enCours} />
      </label>
      <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Création…' : 'Créer'}</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
      {etat === 'erreur' && <p className="plai-error text-xs w-full">{erreur}</p>}
    </form>
  );
}
