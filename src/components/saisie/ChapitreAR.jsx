import { useState } from 'react';
import AmenagementLibreForm from './AmenagementLibreForm.jsx';

export default function ChapitreAR({ chapitre, amenagements, eleves, selectionsAR, libres, onToggle, onAddLibre, onRemoveLibre }) {
  const [ouvert, setOuvert] = useState(false);
  const [libreOuvert, setLibreOuvert] = useState(false);

  const cols = eleves;
  const totalCols = cols.length;
  const estCoche = (eleveId, amId) => selectionsAR.some((s) => s.eleve_id === eleveId && s.amenagement_id === amId);
  const nbCoches = selectionsAR.filter((s) => amenagements.some((a) => a.id === s.amenagement_id)).length;
  const libresChap = libres.filter((l) => l.chapitre_id === chapitre.id);

  return (
    <>
      <tr id={`chap-${chapitre.ordre}`}>
        <td colSpan={totalCols + 1} className="p-0">
          <button className="w-full text-left px-2 py-2 bg-white border-y border-[color:var(--border)] flex items-center gap-2"
            aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
            <span>{ouvert ? '▼' : '▶'}</span>
            <span className="font-semibold">{chapitre.titre}</span>
            <span className="text-sm text-[color:var(--text3)]">({nbCoches} AR coché(s))</span>
          </button>
        </td>
      </tr>

      {ouvert && amenagements.map((a) => (
        <tr key={a.id} className="border-b border-[color:var(--border)] hover:bg-white/60">
          <td className="p-1 align-top">{a.libelle}</td>
          {cols.map((e) => (
            <td key={e.id} className="text-center border-l border-[color:var(--border)]">
              <input type="checkbox" checked={estCoche(e.id, a.id)}
                aria-label={`${a.libelle} — ${e.prenom} ${e.initiale_nom}`}
                onChange={(ev) => onToggle({ eleveId: e.id, amenagementId: a.id, actif: ev.target.checked })} />
            </td>
          ))}
        </tr>
      ))}

      {ouvert && (
        <tr>
          <td colSpan={totalCols + 1} className="p-2">
            {libresChap.map((l) => {
              const el = cols.find((c) => c.id === l.eleve_id);
              return (
                <div key={l.id} className="text-sm flex items-center gap-2">
                  <span className="text-teal">+</span>
                  <span>{el ? `${el.prenom} ${el.initiale_nom}` : '—'} : {l.texte}</span>
                  <button className="text-xs underline" onClick={() => onRemoveLibre({ id: l.id })}>retirer</button>
                </div>
              );
            })}
            {libreOuvert
              ? <AmenagementLibreForm chapitre={chapitre} eleves={cols} onAdd={onAddLibre} onClose={() => setLibreOuvert(false)} />
              : <button className="text-sm underline text-teal" onClick={() => setLibreOuvert(true)}>+ ajouter un aménagement libre pour un élève</button>}
          </td>
        </tr>
      )}
    </>
  );
}
