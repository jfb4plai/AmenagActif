import { useId, useMemo, useState } from 'react';
import {
  dispositifsBloquants, dispositifsPerdus, messageBlocageChangement, messagePerte, messageErreurChangement,
} from '../../domain/changementClasse.js';

const libelle = (c) => `${c.nom}${c.niveau ? ` (${c.niveau})` : ''}`;

/**
 * Bloc « Changer de classe en cours d'année », affiché dans la fiche d'un élève.
 * cibles : { classes, modes } de useClassesCibles ; donnees : { chapitres, amenagements, selectionsAR, libres } de l'école courante.
 * onChanger(classeCibleId) doit renvoyer une promesse (rejetée en cas d'erreur).
 */
export default function ChangerClasse({ eleve, cibles, ecoles = [], ecoleId, donnees, onChanger, onFait }) {
  const id = useId();
  const [cibleId, setCibleId] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const classes = (cibles?.classes ?? []).filter((c) => c.id !== eleve.classe_id);
  const propres = classes.filter((c) => c.ecole_id === ecoleId);
  const autres = ecoles
    .filter((e) => e.id !== ecoleId)
    .map((e) => ({ ecole: e, classes: classes.filter((c) => c.ecole_id === e.id) }))
    .filter((g) => g.classes.length > 0);

  const { bloquants, perdus } = useMemo(() => {
    if (!cibleId) return { bloquants: [], perdus: [] };
    const modes = cibles?.modes ?? [];
    return {
      bloquants: dispositifsBloquants({ eleveId: eleve.id, classeCibleId: cibleId, modes, ...donnees }),
      perdus: dispositifsPerdus({ classeSourceId: eleve.classe_id, classeCibleId: cibleId, modes, chapitres: donnees.chapitres }),
    };
  }, [cibleId, cibles, donnees, eleve.id, eleve.classe_id]);

  const changer = async () => {
    const cible = classes.find((c) => c.id === cibleId);
    if (!cible || bloquants.length > 0) return;
    if (!window.confirm(`Changer ${eleve.prenom} ${eleve.initiale_nom} vers la classe ${libelle(cible)} ?\n\nSes aménagements sont conservés et marqués « à confirmer ». Relisez-les avant d'envoyer un lien enseignant.`)) return;
    setEnCours(true);
    setErreur('');
    try {
      await onChanger(cibleId);
      onFait?.();
    } catch (e) {
      setErreur(messageErreurChangement(e));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <details className="pt-2 border-t border-[color:var(--border)]">
      <summary className="text-sm cursor-pointer">Changer de classe en cours d'année</summary>
      <div className="space-y-1 mt-2">
        <p style={{ fontSize: 16 }}>
          <a href="/modes-emploi/transfert-en-cours-d-annee.html" target="_blank" rel="noopener noreferrer" className="underline text-[color:var(--teal)]">
            Mode d'emploi du changement de classe (nouvel onglet)
          </a>
        </p>
        {classes.length === 0 ? (
          <p className="text-xs text-[color:var(--text3)]">Aucune autre classe disponible pour cette année scolaire.</p>
        ) : (
          <>
            <label htmlFor={`${id}-cible`} className="block text-sm font-medium">Nouvelle classe</label>
            <select id={`${id}-cible`} className="plai-input w-full" value={cibleId} disabled={enCours}
              onChange={(e) => { setCibleId(e.target.value); setErreur(''); }}>
              <option value="">— choisir —</option>
              <optgroup label="Cette implantation">
                {propres.map((c) => <option key={c.id} value={c.id}>{libelle(c)}</option>)}
              </optgroup>
              {autres.map(({ ecole, classes: cl }) => (
                <optgroup key={ecole.id} label={ecole.implantation_nom || ecole.nom}>
                  {cl.map((c) => <option key={c.id} value={c.id}>{libelle(c)}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-[color:var(--text3)]">
              L'élève garde ses aménagements, marqués « à confirmer » : relisez-les avant d'envoyer un lien enseignant. Les AU de la nouvelle classe s'appliquent d'eux-mêmes.
              Pour passer à l'année suivante, utilisez plutôt « Reprise d'année ».
            </p>
            {bloquants.length > 0 && <p role="alert" className="plai-error text-xs">{messageBlocageChangement(bloquants, eleve.prenom)}</p>}
            {bloquants.length === 0 && perdus.length > 0 && (
              <p role="note" className="text-xs p-2 rounded" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>{messagePerte(perdus)}</p>
            )}
            {erreur && <p role="alert" className="plai-error text-xs">{erreur}</p>}
            <button type="button" className="plai-btn" onClick={changer} disabled={!cibleId || bloquants.length > 0 || enCours}>
              {enCours ? 'Changement…' : 'Changer de classe'}
            </button>
          </>
        )}
      </div>
    </details>
  );
}
