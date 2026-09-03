import { useState } from 'react';

export default function AjoutEleve({ onCreate }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ classeNom: '', niveau: '', prenom: '', initiale: '', referent: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!ouvert) return <button className="plai-btn" onClick={() => setOuvert(true)}>+ élève</button>;

  return (
    <form className="plai-card p-3 flex flex-wrap gap-2 items-end"
      onSubmit={(e) => { e.preventDefault(); onCreate(f); setOuvert(false); setF({ classeNom: '', niveau: '', prenom: '', initiale: '', referent: '' }); }}>
      <label className="text-sm">Classe
        <input className="plai-input block" required value={f.classeNom} onChange={set('classeNom')} placeholder="5LA" />
      </label>
      <label className="text-sm">Niveau
        <input className="plai-input block" value={f.niveau} onChange={set('niveau')} placeholder="5e" />
      </label>
      <label className="text-sm">Prénom
        <input className="plai-input block" required value={f.prenom} onChange={set('prenom')} placeholder="Emilie" />
      </label>
      <label className="text-sm">Initiale
        <input className="plai-input block" maxLength={2} value={f.initiale} onChange={set('initiale')} placeholder="D" />
      </label>
      <label className="text-sm">Référent PLAI
        <input className="plai-input block" value={f.referent} onChange={set('referent')} placeholder="Mona" />
      </label>
      <button type="submit" className="plai-btn">Créer</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)}>Annuler</button>
    </form>
  );
}
