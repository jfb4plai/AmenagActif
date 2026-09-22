import { useState } from 'react';

export default function AjoutEleve({ onCreate }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ prenom: '', initiale: '', commentaire: '', statut: '' });
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
      setF({ prenom: '', initiale: '', commentaire: '', statut: '' });
    } catch (err) {
      setEtat('erreur');
      setErreur(err.message || "Échec de la création, réessayez.");
    }
  };

  const enCours = etat === 'creation';

  return (
    <form className="plai-card p-3 flex flex-wrap gap-2 items-end" onSubmit={soumettre}>
      <label className="text-sm">Prénom
        <input className="plai-input block" required value={f.prenom} onChange={set('prenom')} placeholder="Emilie" disabled={enCours} />
      </label>
      <label className="text-sm">Initiale
        <input className="plai-input block" maxLength={2} value={f.initiale} onChange={set('initiale')} placeholder="D" disabled={enCours} />
      </label>
      <div className="text-sm">
        <span className="block font-medium">Statut administratif</span>
        <div className="flex gap-3">
          <label className="flex items-center gap-1">
            <input type="radio" name="statut-nouvel-eleve" value="IPT" checked={f.statut === 'IPT'}
              onChange={() => setF({ ...f, statut: 'IPT' })} disabled={enCours} />
            IPT
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="statut-nouvel-eleve" value="PAR" checked={f.statut === 'PAR'}
              onChange={() => setF({ ...f, statut: 'PAR' })} disabled={enCours} />
            PAR
          </label>
        </div>
        <span className="block text-xs text-[color:var(--text3)] font-normal">
          IPT (Intégration Permanente Totale) ou PAR (Protocole d'Aménagements Raisonnables) — modifiable ensuite en cliquant sur le nom de l'élève.
        </span>
      </div>
      <label className="text-sm w-full">Commentaire (facultatif)
        <textarea className="plai-input block w-full" rows={2} value={f.commentaire} onChange={set('commentaire')}
          placeholder="Ex. : décès de la grand-mère mi-septembre, vigilance émotionnelle" disabled={enCours} />
        <span className="block text-xs text-[color:var(--text3)] font-normal">Information ponctuelle, modifiable ensuite en cliquant sur le nom de l'élève.</span>
      </label>
      <button type="submit" className="plai-btn" disabled={enCours || !f.prenom.trim() || !f.statut}>{enCours ? 'Création…' : 'Créer'}</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
      {etat === 'erreur' && <p className="plai-error text-xs w-full">{erreur}</p>}
    </form>
  );
}
