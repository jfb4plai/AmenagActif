import { useAnneeActive } from '../../hooks/useAdmin.js';
import { useNiveauxEcoles } from '../../hooks/useNiveauxEcoles.js';
import { optionsNiveaux, basculerNiveau, messageNiveaux } from '../../domain/niveauxDirection.js';

/**
 * Niveaux d'une direction : limite les fiches où son NOM apparaît dans la colonne « PAR ».
 * Ce n'est pas un droit d'accès.
 */
export default function NiveauxDirection({ membre, onChange, enregistrement }) {
  const anneeActive = useAnneeActive();
  const ecoleIds = [...new Set([membre.ecoleId, ...(membre.ecoleIds ?? [])].filter(Boolean))];
  const anneeId = anneeActive?.id ?? null;
  const { data: niveauxClasses = [], isLoading, isError } = useNiveauxEcoles(ecoleIds, anneeId);
  const enregistres = membre.niveaux ?? [];
  const sansContexte = ecoleIds.length === 0 || !anneeId;

  // Requête désactivée (sans école ni année) : ne jamais l'afficher comme « en chargement ».
  const chargement = !sansContexte && isLoading;
  const erreur = !sansContexte && isError;
  const enCours = enregistrement === 'enCours';

  const { options, sansNiveau } = optionsNiveaux({ niveauxClasses: sansContexte ? [] : niveauxClasses, enregistres });
  const message = messageNiveaux({ nbCoches: enregistres.length, sansNiveau });

  return (
    <fieldset disabled={enCours} className="text-base border border-[color:var(--border)] rounded px-3 py-2 min-w-[16rem]">
      <legend className="px-1 font-medium">Apparaît sur les fiches des classes de niveau</legend>
      {chargement ? (
        <p role="status">Chargement des niveaux…</p>
      ) : erreur ? (
        <p role="alert" className="plai-error">
          Impossible de charger les classes. Les niveaux déjà enregistrés sont conservés : {enregistres.length ? enregistres.join(', ') : 'aucun'}.
        </p>
      ) : (
        <>
          {options.length === 0 && <p className="text-[color:var(--text3)]">Aucune classe à proposer pour le moment.</p>}
          {options.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {options.map(({ valeur, coche, absent }) => (
                <li key={valeur}>
                  <label className="flex items-center gap-2 min-h-[2rem] cursor-pointer">
                    <input type="checkbox" className="w-6 h-6" checked={coche} disabled={enCours}
                      onChange={(e) => { if (!enCours) onChange(basculerNiveau(enregistres, valeur, e.target.checked)); }} />
                    <span>{valeur}</span>
                    {absent && <span className="text-[color:var(--text3)]">(absent des classes actuelles)</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="text-[color:var(--text3)] mt-1">
        Exemple : cocher 5e et 6e pour une direction du 2e degré. Cela limite seulement les fiches où son nom apparaît dans la colonne « PAR » ; ce n'est pas un droit d'accès.
      </p>
      {!chargement && !erreur && <p>{message.texte}</p>}
      {!chargement && !erreur && message.avertissement && <p className="text-amber-700 font-semibold">{message.avertissement}</p>}
      {enCours && <p role="status">Enregistrement…</p>}
      {enregistrement === 'ok' && <p role="status" className="plai-success">Enregistré</p>}
      {enregistrement === 'erreur' && <p role="alert" className="plai-error">Enregistrement impossible, réessayez.</p>}
    </fieldset>
  );
}
