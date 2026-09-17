import { useState, useMemo } from 'react';
import SelecteurContexte from '../components/saisie/SelecteurContexte.jsx';
import SelecteurClasse from '../components/saisie/SelecteurClasse.jsx';
import BarreSaut from '../components/saisie/BarreSaut.jsx';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import EleveEditor from '../components/saisie/EleveEditor.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import AjoutEleve from '../components/saisie/AjoutEleve.jsx';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useGridMutations } from '../hooks/useGridMutations.js';

export default function SaisieEcole() {
  const [ctx, setCtx] = useState({ ecoleId: null, anneeId: null });
  const [classeId, setClasseId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const { data: cat } = useCatalogue();
  const { data: grid, isLoading, error } = useEcoleGrid(ctx.ecoleId, ctx.anneeId);
  const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);

  const classe = useMemo(() => grid?.classes.find((c) => c.id === classeId) ?? null, [grid, classeId]);
  const eleves = useMemo(() => (grid?.eleves ?? []).filter((e) => e.classe_id === classeId), [grid, classeId]);

  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');

  return (
    <div className="plai-section space-y-4">
      <h1 className="text-xl font-semibold">Saisie des aménagements</h1>
      <SelecteurContexte ecoleId={ctx.ecoleId} anneeId={ctx.anneeId} onChange={(v) => { setCtx(v); setClasseId(null); }} />

      {!ctx.ecoleId || !ctx.anneeId ? (
        <p className="plai-empty">Choisir une école et une année pour commencer.</p>
      ) : isLoading ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="plai-error">Erreur de chargement : {error.message}</p>
      ) : !grid ? (
        <p>Chargement…</p>
      ) : !classe ? (
        <>
          <p className="text-sm text-[color:var(--text3)]">Pour saisir les informations d'un élève, il faut d'abord choisir sa classe ci-dessous — ou en créer une nouvelle.</p>
          <SelecteurClasse
            classes={grid.classes}
            onSelect={setClasseId}
            onCreate={({ nom, niveau }) => mut.ensureClasse.mutateAsync({ nom, niveau })}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <button className="underline text-teal" onClick={() => { setClasseId(null); setEditId(null); }}>← Changer de classe</button>
            </p>
          </div>

          <div className="plai-card p-3 text-sm space-y-1">
            <label className="font-medium block" htmlFor="referent-plai-classe">Référent(s) PLAI de la classe</label>
            <input id="referent-plai-classe" key={classe.id} className="plai-input w-full"
              defaultValue={classe.referent_plai_nom ?? ''} placeholder="Mona, Julie"
              onBlur={(e) => {
                const valeur = e.target.value.trim();
                if (valeur !== (classe.referent_plai_nom ?? '')) {
                  mut.majReferentPlaiClasse.mutate({ classeId, referentPlaiNom: valeur });
                }
              }} />
            <p className="text-xs text-[color:var(--text3)]">
              Nom(s) de la ou des personnes à contacter pour l'accompagnement PLAI de cette classe. Plusieurs noms : séparez-les par une virgule (ex. « Mona, Julie »). Modifiable à tout moment si la situation change en cours d'année — c'est ce qui apparaît sur la fiche classe.
            </p>
          </div>

          <div className="plai-card p-3 space-y-2">
            <div className="text-sm font-medium">Élèves de la classe ({eleves.length})</div>
            {eleves.length === 0 ? (
              <p className="text-sm text-[color:var(--text3)]">Aucun élève encodé pour l'instant.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {eleves.map((e) => (
                  <div key={e.id} className="relative">
                    <button type="button"
                      className={`plai-input !w-auto !py-1 text-sm ${e.commentaire ? 'border-teal text-teal font-medium' : ''}`}
                      title={e.commentaire ? `Commentaire : ${e.commentaire}` : 'Cliquer pour modifier'}
                      onClick={() => setEditId(editId === e.id ? null : e.id)}>
                      {e.prenom} {e.initiale_nom}{e.commentaire ? ' · commentaire' : ''}
                    </button>
                    {editId === e.id && (
                      <div className="absolute z-40 mt-1">
                        <EleveEditor eleve={e} onClose={() => setEditId(null)}
                          onSave={(v) => mut.upsertEleve.mutateAsync({ id: e.id, classeId: e.classe_id, ...v })}
                          onDelete={() => mut.deleteEleve.mutateAsync({ id: e.id })} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-[color:var(--text3)]">Cliquez sur un nom pour voir ou modifier ses informations, dont son commentaire.</p>
            <AjoutEleve
              onCreate={async ({ prenom, initiale, commentaire }) => {
                await mut.upsertEleve.mutateAsync({ classeId, prenom, initialeNom: initiale, commentaire });
              }}
            />
          </div>

          <BandeauAU classe={classe} auCatalogue={auCat} chapitres={chapitres}
            auClasse={grid.auClasse.filter((x) => x.classe_id === classeId)} onToggle={(v) => mut.toggleAU.mutate(v)} />

          <div>
            <h2 className="font-semibold mb-1">Aménagements raisonnables — {classe.nom}</h2>
            <div className="mb-2">
              <input type="search" className="plai-input w-full max-w-sm" placeholder="Rechercher un AR par mot-clé (ex : bruit, temps, oral)…"
                value={recherche} onChange={(e) => setRecherche(e.target.value)} />
              <p className="text-xs text-[color:var(--text3)]">
                Filtre les aménagements dans tous les chapitres, sans devoir les déplier un par un. Videz le champ pour revenir à la vue normale.
              </p>
            </div>
            <BarreSaut chapitres={chapitres} />
          </div>
          <div className="overflow-x-auto border border-[color:var(--border)] rounded">
            <table className="border-collapse text-sm">
              <EnTeteEleves eleves={eleves}
                onSaveEleve={(v) => mut.upsertEleve.mutateAsync(v)}
                onDeleteEleve={(v) => mut.deleteEleve.mutateAsync(v)} />
              <tbody>
                {chapitres.map((ch) => (
                  <ChapitreAR key={ch.id} chapitre={ch}
                    amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                    eleves={eleves}
                    selectionsAR={grid.selectionsAR}
                    libres={grid.libres}
                    filtre={recherche}
                    onToggle={(v) => mut.toggleAR.mutate(v)}
                    onAddLibre={(v) => mut.addLibre.mutate(v)}
                    onRemoveLibre={(v) => mut.removeLibre.mutate(v)} />
                ))}
              </tbody>
            </table>
          </div>
          {mut.toggleAR.isError && <p className="plai-error">Échec d'enregistrement, réessayez.</p>}
        </>
      )}
    </div>
  );
}
