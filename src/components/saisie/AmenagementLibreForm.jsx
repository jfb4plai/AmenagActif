import { useState } from 'react';

export default function AmenagementLibreForm({ chapitre, eleves, onAdd, onClose }) {
  const [eleveId, setEleveId] = useState('');
  const [texte, setTexte] = useState('');

  return (
    <div className="plai-card p-3 space-y-2 max-w-lg">
      <p className="font-medium">Aménagement libre — {chapitre.titre}</p>
      <div>
        <label className="block text-sm font-medium">Élève concerné</label>
        <select className="plai-input w-full" value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
          <option value="">— choisir —</option>
          {eleves.map((e) => <option key={e.id} value={e.id}>{e.prenom} {e.initiale_nom}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Aménagement</label>
        <textarea className="plai-input w-full" rows={2} value={texte} onChange={(e) => setTexte(e.target.value)}
          placeholder="Ex. : En TP, vérifier que l'élève a compris la démarche avant de le laisser avancer" />
        <p className="text-xs text-[color:var(--text3)]">Formulez une action concrète et observable pour l'enseignant. Apparaît dans la fiche de cet élève.</p>
      </div>
      <div className="flex gap-2">
        <button className="plai-btn" disabled={!eleveId || !texte.trim()}
          onClick={() => { onAdd({ eleveId, chapitreId: chapitre.id, texte: texte.trim() }); onClose(); }}>Ajouter</button>
        <button className="text-sm underline" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
