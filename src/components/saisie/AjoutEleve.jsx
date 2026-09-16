import { useState, useEffect } from 'react';

export default function AjoutEleve({ onCreate, referentSuggere }) {
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ prenom: '', initiale: '', referent: '', commentaire: '' });
  const [etat, setEtat] = useState('idle'); // idle | creation | erreur
  const [erreur, setErreur] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (ouvert && !f.referent && referentSuggere) setF((prev) => ({ ...prev, referent: referentSuggere }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, referentSuggere]);

  if (!ouvert) return <button className="plai-btn" onClick={() => setOuvert(true)}>+ élève</button>;

  const soumettre = async (e) => {
    e.preventDefault();
    setEtat('creation');
    setErreur('');
    try {
      await onCreate(f);
      setOuvert(false);
      setEtat('idle');
      setF({ prenom: '', initiale: '', referent: '', commentaire: '' });
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
      <label className="text-sm">Référent(s) PLAI
        <input className="plai-input block" value={f.referent} onChange={set('referent')} placeholder="Mona, Julie" disabled={enCours} />
      </label>
      <label className="text-sm w-full">Commentaire (facultatif)
        <textarea className="plai-input block w-full" rows={2} value={f.commentaire} onChange={set('commentaire')}
          placeholder="Ex. : décès de la grand-mère mi-septembre, vigilance émotionnelle" disabled={enCours} />
        <span className="block text-xs text-[color:var(--text3)] font-normal">Information ponctuelle, modifiable ensuite en cliquant sur le nom de l'élève.</span>
      </label>
      <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Création…' : 'Créer'}</button>
      <button type="button" className="text-sm underline" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
      {etat === 'erreur' && <p className="plai-error text-xs w-full">{erreur}</p>}
    </form>
  );
}
