import { groupesSource } from '../../domain/reprise.js';

export default function EtapeClasses({ d, ecoleId, srcLibelle, cibleLibelle, mapping, setMapping, mut }) {
  const classesCible = d.classesCible.filter((c) => c.ecole_id === ecoleId);
  const groupes = groupesSource(d.classesSource, d.eleves);

  return (
    <section className="space-y-4">
      <div className="plai-card p-3 space-y-2">
        <h2 className="font-semibold">Classes de {cibleLibelle}</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Reprend les classes de {srcLibelle} : nom, niveau, référent(s) PLAI et aménagements universels (ces derniers sont marqués « à confirmer »).
          Les classes déjà créées ne sont pas modifiées : vous pouvez relancer sans risque après avoir ajouté une classe à la main.
        </p>
        <button className="plai-btn" disabled={mut.cloner.isPending || d.classesSource.length === 0} onClick={() => mut.cloner.mutate()}>
          {mut.cloner.isPending ? 'Création…' : classesCible.length === 0 ? `Reprendre les classes de ${srcLibelle}` : 'Compléter avec les classes manquantes'}
        </button>
        {d.classesSource.length === 0 && <p className="text-sm">Aucune classe en {srcLibelle} pour cette implantation.</p>}
        {mut.cloner.isSuccess && <p className="text-sm text-teal">{mut.cloner.data} classe(s) créée(s).</p>}
        {mut.cloner.isError && <p className="plai-error text-sm">Échec du clonage : {mut.cloner.error.message}</p>}

        {classesCible.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Niveau de chaque classe en {cibleLibelle}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {classesCible.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <label htmlFor={`niv-${c.id}`} className="w-20 shrink-0">{c.nom}</label>
                  <input id={`niv-${c.id}`} className="plai-input w-full" defaultValue={c.niveau ?? ''} placeholder="4e"
                    onBlur={(e) => { if (e.target.value.trim() !== (c.niveau ?? '')) mut.majNiveau.mutate({ classeId: c.id, niveau: e.target.value }); }} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-[color:var(--text3)]">
              Les niveaux repris de l'an dernier sont à mettre à jour (ex. « 3e » devient « 4e »). Ce niveau s'affiche dans la saisie et sur les fiches.
            </p>
            {mut.majNiveau.isError && <p className="plai-error text-sm">Enregistrement du niveau impossible, réessayez.</p>}
          </div>
        )}
      </div>

      <div className="plai-card p-3 space-y-2">
        <h2 className="font-semibold">Où va la majorité de chaque groupe ?</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Pour chaque classe de {srcLibelle}, choisissez la classe de {cibleLibelle} où va la majorité de ses élèves.
          Tous les élèves du groupe y seront proposés par défaut ; vous corrigerez les exceptions à l'étape suivante.
          Laissez vide un groupe qui n'a pas de destination principale (chaque élève sera alors à placer un par un).
        </p>
        {groupes.length === 0 ? (
          <p className="plai-empty">Aucun élève encodé en {srcLibelle} pour cette implantation.</p>
        ) : (
          <ul className="space-y-2">
            {groupes.map(({ classe, eleves }) => (
              <li key={classe.id} className="flex flex-wrap items-center gap-2">
                <label htmlFor={`map-${classe.id}`} className="w-56">
                  {classe.nom}{classe.niveau ? ` (${classe.niveau})` : ''} <span className="text-[color:var(--text3)]">— {eleves.length} élève(s)</span>
                </label>
                <span aria-hidden="true">→</span>
                <select id={`map-${classe.id}`} className="plai-input" value={mapping[classe.id] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [classe.id]: e.target.value })}>
                  <option value="">— pas de classe principale —</option>
                  {classesCible.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.niveau ? ` (${c.niveau})` : ''}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
