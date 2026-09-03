import { useState } from 'react';

export default function EleveEditor({ eleve, onSave, onClose }) {
  const [prenom, setPrenom] = useState(eleve?.prenom ?? '');
  const [initiale, setInitiale] = useState(eleve?.initiale_nom ?? '');
  const [ref, setRef] = useState(eleve?.referent_plai_nom ?? '');

  return (
    <div className="plai-card p-3 space-y-2 w-72">
      <div>
        <label className="block text-sm font-medium">Prénom</label>
        <input className="plai-input w-full" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Emilie" />
      </div>
      <div>
        <label className="block text-sm font-medium">Initiale du nom</label>
        <input className="plai-input w-full" maxLength={2} value={initiale} onChange={(e) => setInitiale(e.target.value)} placeholder="D" />
        <p className="text-xs text-[color:var(--text3)]">Affichée « Emilie D. » sur la fiche. Pas de nom complet.</p>
      </div>
      <div>
        <label className="block text-sm font-medium">Référent PLAI (accompagnateur)</label>
        <input className="plai-input w-full" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Mona" />
        <p className="text-xs text-[color:var(--text3)]">Nom de l'accompagnateur·ice qui suit cet élève. Apparaît dans le tableau PIA de la fiche.</p>
      </div>
      <div className="flex gap-2">
        <button className="plai-btn" onClick={() => onSave({ prenom, initialeNom: initiale, referentPlaiNom: ref })} disabled={!prenom.trim()}>Enregistrer</button>
        <button className="text-sm underline" onClick={onClose}>Annuler</button>
      </div>
    </div>
  );
}
