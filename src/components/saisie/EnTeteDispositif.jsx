/**
 * En-tête commun d'un dispositif (dans la grille en mode AR, dans la carte en mode AU) :
 * badge de mode + choix du mode. Présentationnel : le parent calcule le blocage et déclenche la mutation.
 */
export default function EnTeteDispositif({ chapitre, mode, peutBasculer, blocage, onBascule }) {
  const nom = `mode-${chapitre.id}`;
  return (
    <div className="px-2 py-2 border-b border-[color:var(--border)] text-sm space-y-1" role="group" aria-label={`Mode du dispositif ${chapitre.titre}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${mode === 'AU' ? 'bg-teal/10 text-teal' : 'bg-orange/10 text-orange'}`}>
          {mode === 'AU' ? 'AU · toute la classe' : 'AR · par élève'}
        </span>
        <label className="flex items-center gap-1">
          <input type="radio" name={nom} checked={mode === 'AR'} disabled={!peutBasculer} onChange={() => onBascule('AR')} />
          élève par élève (AR)
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name={nom} checked={mode === 'AU'} disabled={!peutBasculer} onChange={() => onBascule('AU')} />
          à toute la classe (AU)
        </label>
      </div>
      <p className="text-xs text-[color:var(--text3)]">
        Choisissez comment ce dispositif s'applique à cette classe. <strong>AR</strong> : coché pour chaque élève concerné, dans sa colonne.
        <strong> AU</strong> : coché une seule fois pour toute la classe ; il apparaît alors sur la fiche classe, sous le titre du dispositif, et sur la fiche de chaque élève.
        Le changement est refusé tant que des cases de l'autre mode sont cochées.
      </p>
      {!peutBasculer && (
        <p className="text-xs text-[color:var(--text3)]">Le mode est modifiable par le référent PLAI, la direction ou l'administrateur.</p>
      )}
      {blocage && <p role="alert" className="plai-error text-sm">{blocage}</p>}
    </div>
  );
}
