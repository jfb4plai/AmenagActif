import { useId, useMemo, useState } from 'react';
import { trierClasses } from '../domain/liens.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';

/**
 * Création / modification d'une fiche groupée enregistrée : un nom + 2 à 10 classes de l'école.
 * initial : { id, nom, classeIds } pour une modification ; absent pour une création.
 */
export default function FicheGroupeeForm({ classes, initial = null, classeIdsPreselection = [], enCours, erreur, onEnregistrer, onAnnuler }) {
  const id = useId();
  const [nom, setNom] = useState(initial?.nom ?? '');
  const [coches, setCoches] = useState(() => new Set(initial?.classeIds ?? classeIdsPreselection));
  const triees = useMemo(() => trierClasses(classes), [classes]);
  const basculer = (cid) => setCoches((prev) => {
    const s = new Set(prev);
    if (s.has(cid)) s.delete(cid); else s.add(cid);
    return s;
  });
  const nbOk = coches.size >= 2 && coches.size <= 10;
  const nomOk = nom.trim().length >= 1 && nom.trim().length <= 60;

  function soumettre(e) {
    e.preventDefault();
    if (!nbOk || !nomOk) return;
    onEnregistrer({ id: initial?.id ?? null, nom: nom.trim(), classeIds: triees.filter((c) => coches.has(c.id)).map((c) => c.id) });
  }

  return (
    <form onSubmit={soumettre} className="plai-card p-4 space-y-3 max-w-xl no-print" style={{ fontSize: 16 }}>
      <h2 className="font-semibold">{initial ? 'Modifier la fiche groupée' : 'Nouvelle fiche groupée'}</h2>
      <div>
        <label htmlFor={`${id}-nom`} className="block font-medium">Nom de la fiche groupée</label>
        <input
          id={`${id}-nom`} className="plai-input w-full" style={{ fontSize: 16 }} value={nom} maxLength={60} required
          onChange={(e) => setNom(e.target.value)} aria-describedby={`${id}-aide`}
          placeholder="Atelier cuisine 3TQB + 5PA"
        />
        <p id={`${id}-aide`} className="mt-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>
          Ce nom est le titre de la fiche et ce que l'enseignant lit dans son sommaire. Choisissez-le pour que l'enseignant reconnaisse le cours (activité, groupe), sans nom d'élève.
        </p>
      </div>
      <fieldset>
        <legend className="font-medium">Classes réunies (2 à 10)</legend>
        <p className="mb-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>
          La fiche fusionne les élèves et les aménagements de ces classes, sans doublon. Elle se met à jour toute seule quand les classes changent.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {triees.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input id={`${id}-${c.id}`} type="checkbox" className="w-5 h-5" checked={coches.has(c.id)} onChange={() => basculer(c.id)} />
              <label htmlFor={`${id}-${c.id}`}>{c.nom}</label>
            </li>
          ))}
        </ul>
        {!nbOk && <p className="mt-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>Cochez au moins 2 classes (10 au plus) : {coches.size} cochée{coches.size > 1 ? 's' : ''}.</p>}
      </fieldset>
      {erreur && <p role="alert" className="plai-error" style={{ fontSize: 16 }}>{erreur}</p>}
      <div className="flex gap-3">
        <button type="submit" className={`plai-btn ${FOCUS}`} style={{ fontSize: 16 }} disabled={enCours || !nbOk || !nomOk}>
          {enCours ? 'Enregistrement…' : 'Enregistrer la fiche groupée'}
        </button>
        <button type="button" className={`plai-btn-ghost px-4 py-2 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={onAnnuler} disabled={enCours}>Annuler</button>
      </div>
    </form>
  );
}
