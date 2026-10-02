import { aConfirmerParClasse } from '../../domain/reprise.js';

/** Bandeau de la saisie : ce qui a été repris de l'année précédente ou d'une autre classe et n'a pas encore été relu. */
export default function BandeauAConfirmer({ eleves, grid, classeId, onConfirmerEleve, onConfirmerClasse, enCours }) {
  const r = aConfirmerParClasse({
    eleves,
    selectionsAR: grid.selectionsAR,
    libres: grid.libres,
    auClasse: grid.auClasse.filter((x) => x.classe_id === classeId),
  });
  if (r.total === 0) return null;

  return (
    <section className="p-3 text-sm space-y-2 rounded" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p><strong>{r.total} aménagement(s) repris de l'année précédente ou d'une autre classe, à confirmer.</strong> Relisez-les : le niveau, la filière ou les progrès de l'élève ont pu changer.</p>
        <button className="plai-btn" disabled={enCours} onClick={onConfirmerClasse}>Tout confirmer</button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {r.parEleve.map(({ eleve, n }) => (
          <li key={eleve.id}>
            <button className="plai-input !w-auto !py-1" disabled={enCours} onClick={() => onConfirmerEleve(eleve.id)}
              title="Confirmer les aménagements repris de cet élève">
              Confirmer {eleve.prenom} {eleve.initiale_nom} ({n})
            </button>
          </li>
        ))}
        {r.nAU > 0 && <li className="self-center">{r.nAU} AU de la classe à confirmer (voir ci-dessus)</li>}
      </ul>
      <p className="text-xs">Décochez un aménagement qui ne convient plus ; cochez-en un nouveau : il est enregistré comme confirmé.</p>
    </section>
  );
}
