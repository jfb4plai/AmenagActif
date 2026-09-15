import { useState } from 'react';

export default function EleveEditor({ eleve, onSave, onDelete, onClose }) {
  const [prenom, setPrenom] = useState(eleve?.prenom ?? '');
  const [initiale, setInitiale] = useState(eleve?.initiale_nom ?? '');
  const [ref, setRef] = useState(eleve?.referent_plai_nom ?? '');
  const [etat, setEtat] = useState('idle'); // idle | enregistrement | enregistre | suppression | erreur
  const [erreur, setErreur] = useState('');

  const enCours = etat === 'enregistrement' || etat === 'suppression';

  const enregistrer = async () => {
    setEtat('enregistrement');
    setErreur('');
    try {
      await onSave({ prenom, initialeNom: initiale, referentPlaiNom: ref });
      setEtat('enregistre');
      setTimeout(onClose, 600);
    } catch (e) {
      setEtat('erreur');
      setErreur(e.message || "Échec de l'enregistrement, réessayez.");
    }
  };

  const supprimer = async () => {
    if (!confirm(`Supprimer la fiche de ${eleve.prenom} ${eleve.initiale_nom} ? Tous ses aménagements cochés seront retirés. Cette action est irréversible.`)) return;
    setEtat('suppression');
    setErreur('');
    try {
      await onDelete(eleve.id);
      onClose();
    } catch (e) {
      setEtat('erreur');
      setErreur(e.message || 'Échec de la suppression, réessayez.');
    }
  };

  return (
    <div className="plai-card p-3 space-y-2 w-72">
      <div>
        <label className="block text-sm font-medium">Prénom</label>
        <input className="plai-input w-full" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Emilie" disabled={enCours} />
      </div>
      <div>
        <label className="block text-sm font-medium">Initiale du nom</label>
        <input className="plai-input w-full" maxLength={2} value={initiale} onChange={(e) => setInitiale(e.target.value)} placeholder="D" disabled={enCours} />
        <p className="text-xs text-[color:var(--text3)]">Affichée « Emilie D. » sur la fiche. Pas de nom complet.</p>
      </div>
      <div>
        <label className="block text-sm font-medium">Référent PLAI (accompagnateur)</label>
        <input className="plai-input w-full" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Mona" disabled={enCours} />
        <p className="text-xs text-[color:var(--text3)]">Nom de l'accompagnateur·ice qui suit cet élève. Apparaît dans le tableau PIA de la fiche.</p>
      </div>

      {etat === 'erreur' && <p className="plai-error text-xs">{erreur}</p>}
      {etat === 'enregistre' && <p className="plai-success text-xs">Enregistré ✓</p>}

      <div className="flex items-center gap-2">
        <button className="plai-btn" onClick={enregistrer} disabled={!prenom.trim() || enCours}>
          {etat === 'enregistrement' ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button className="text-sm underline" onClick={onClose} disabled={enCours}>Annuler</button>
      </div>

      {eleve?.id && onDelete && (
        <div className="pt-2 border-t border-[color:var(--border)]">
          <button className="text-xs underline text-red-600" onClick={supprimer} disabled={enCours}>
            {etat === 'suppression' ? 'Suppression…' : "Supprimer l'élève (ex. départ)"}
          </button>
        </div>
      )}
    </div>
  );
}
