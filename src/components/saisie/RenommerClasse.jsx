import { useId, useState } from 'react';
import { validerNomClasse, messageErreurRenommage } from '../../domain/renommerClasse.js';

/**
 * Renommage d'une classe sans la recréer : élèves, aménagements et liens suivent (ils pointent vers l'identifiant, pas le nom).
 * autresNoms : noms des autres classes de l'école et de l'année. onRenommer(nom) renvoie une promesse (rejetée en cas d'erreur).
 */
export default function RenommerClasse({ classe, autresNoms, onRenommer }) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const ouvrir = () => { setNom(classe.nom); setErreur(''); setOuvert(true); };

  const valider = async (e) => {
    e.preventDefault();
    const v = validerNomClasse({ nom, ancien: classe.nom, autresNoms });
    if (!v.ok) { setErreur(v.message); return; }
    setEnCours(true);
    setErreur('');
    try {
      await onRenommer(v.nom);
      setOuvert(false);
    } catch (err) {
      setErreur(messageErreurRenommage(err));
    } finally {
      setEnCours(false);
    }
  };

  if (!ouvert) return <button type="button" className="underline text-teal" onClick={ouvrir}>Renommer la classe</button>;

  return (
    <form className="plai-card p-3 text-sm space-y-2 w-full" onSubmit={valider}>
      <label className="font-medium block" htmlFor={id}>Nouveau nom de la classe</label>
      <input id={id} className="plai-input w-full max-w-xs" required autoFocus value={nom} maxLength={40}
        onChange={(e) => setNom(e.target.value)} placeholder="5LA" disabled={enCours} />
      <p className="text-xs text-[color:var(--text3)]">
        Corrige le nom sans rien perdre : les élèves, les aménagements cochés, le commentaire et les liens enseignants restent attachés à la classe.
        Le nom apparaît sur les fiches et dans les sélecteurs. Il doit rester unique dans l'école pour cette année.
      </p>
      <div className="flex gap-3 items-center">
        <button type="submit" className="plai-btn" disabled={enCours || !nom.trim()}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="underline" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
      </div>
      {erreur && <p className="plai-error text-sm" role="alert">{erreur}</p>}
    </form>
  );
}
