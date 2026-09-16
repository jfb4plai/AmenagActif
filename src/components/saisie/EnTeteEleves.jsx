import { useState } from 'react';
import EleveEditor from './EleveEditor.jsx';

export default function EnTeteEleves({ eleves, onSaveEleve, onDeleteEleve }) {
  const [editId, setEditId] = useState(null);

  return (
    <thead className="sticky top-0 z-20 bg-[color:var(--bg)]">
      <tr>
        <th className="text-left align-bottom p-1 min-w-[16rem]"></th>
        {eleves.map((e) => (
          <th key={e.id} className="relative p-1 align-bottom min-w-[3rem] border-l border-[color:var(--border)]">
            <button className="text-xs hover:underline" onClick={() => setEditId(editId === e.id ? null : e.id)}
              style={{ writingMode: 'vertical-rl' }} title="Modifier l'élève">
              {e.prenom} {e.initiale_nom}
            </button>
            {editId === e.id && (
              <div className="absolute mt-1 z-40">
                <EleveEditor eleve={e} onClose={() => setEditId(null)}
                  onSave={(v) => onSaveEleve({ id: e.id, classeId: e.classe_id, ...v })}
                  onDelete={onDeleteEleve ? () => onDeleteEleve({ id: e.id }) : undefined} />
              </div>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}
