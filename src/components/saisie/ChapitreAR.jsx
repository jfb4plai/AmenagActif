import { useState } from 'react';
import AmenagementLibreForm from './AmenagementLibreForm.jsx';

function normaliser(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function ChapitreAR({ chapitre, amenagements, eleves, selectionsAR, libres, filtre, onToggle, onAddLibre, onRemoveLibre }) {
  const [ouvert, setOuvert] = useState(false);
  const [libreOuvert, setLibreOuvert] = useState(false);

  const cols = eleves;
  const totalCols = cols.length;
  const estCoche = (eleveId, amId) => selectionsAR.some((s) => s.eleve_id === eleveId && s.amenagement_id === amId);
  // selectionsAR est passé pour toute l'école (useEcoleGrid) : ne compter que les élèves de cette classe.
  const nbCoches = selectionsAR.filter((s) => amenagements.some((a) => a.id === s.amenagement_id) && cols.some((c) => c.id === s.eleve_id)).length;
  // libres est passé pour toute l'école (useEcoleGrid) : ne garder que les élèves de cette classe.
  const libresChap = libres.filter((l) => l.chapitre_id === chapitre.id && cols.some((c) => c.id === l.eleve_id));

  // Recherche par mots-clés (suggestion Hélène) : filtre les AR du chapitre,
  // masque le chapitre entier s'il n'a aucun résultat, et force l'affichage
  // (sans devoir déplier manuellement) pendant qu'une recherche est active.
  const recherche = normaliser(filtre ?? '').trim();
  const enRecherche = recherche.length > 0;
  const amenagementsAffiches = enRecherche
    ? amenagements.filter((a) => normaliser(a.libelle).includes(recherche))
    : amenagements;

  if (enRecherche && amenagementsAffiches.length === 0) return null;

  const affiche = ouvert || enRecherche;

  return (
    <>
      <tr id={`chap-${chapitre.ordre}`}>
        <td colSpan={totalCols + 1} className="p-0">
          <button className="w-full text-left px-2 py-2 bg-white border-y border-[color:var(--border)] flex items-center gap-2"
            aria-expanded={affiche} onClick={() => setOuvert((v) => !v)}>
            <span>{affiche ? '▼' : '▶'}</span>
            <span className="font-semibold">{chapitre.titre}</span>
            <span className="text-sm text-[color:var(--text3)]">
              {enRecherche ? `(${amenagementsAffiches.length} résultat(s))` : `(${nbCoches} AR coché(s))`}
            </span>
          </button>
        </td>
      </tr>

      {affiche && amenagementsAffiches.map((a) => (
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

      {affiche && (
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
