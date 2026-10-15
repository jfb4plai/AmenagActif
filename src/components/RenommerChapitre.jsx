import { useId, useState } from 'react';
import { validerTitreChapitre } from '../domain/renommerChapitre.js';

/**
 * Formulaire de renommage d'un chapitre du catalogue (admin). onRenommer(titre) renvoie une promesse
 * (rejetée en cas d'erreur) ; onFermer referme le formulaire.
 */
export default function RenommerChapitre({ chapitre, autresTitres, onRenommer, onFermer }) {
  const id = useId();
  const [titre, setTitre] = useState(chapitre.titre);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const valider = async (e) => {
    e.preventDefault();
    const v = validerTitreChapitre({ titre, ancien: chapitre.titre, autresTitres });
    if (!v.ok) { setErreur(v.message); return; }
    setEnCours(true);
    setErreur('');
    try {
      await onRenommer(v.titre);
      onFermer();
    } catch (err) {
      setErreur(err?.message || 'Renommage impossible, réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form className="px-3 py-2 space-y-2 text-sm bg-[color:var(--bg)]" onSubmit={valider}>
      <label className="font-medium block" htmlFor={id}>Nouveau titre du chapitre</label>
      <input id={id} className="plai-input w-full" required autoFocus value={titre} maxLength={200}
        onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : Supports et documents" disabled={enCours} />
      <p className="text-xs text-[color:var(--text3)]">
        Corrige l'intitulé sans toucher aux aménagements : ils restent dans ce chapitre, avec leurs cases cochées. Le nouveau titre apparaît tout de suite sur les fiches, les grilles de saisie et les impressions.
        Le code interne du chapitre ne change pas, donc les autres apps qui reçoivent le profil de classe ne sont pas perturbées.
      </p>
      <div className="flex gap-3 items-center">
        <button type="submit" className="plai-btn" disabled={enCours || !titre.trim()}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="underline" onClick={onFermer} disabled={enCours}>Annuler</button>
      </div>
      {erreur && <p className="plai-error text-sm" role="alert">{erreur}</p>}
    </form>
  );
}
