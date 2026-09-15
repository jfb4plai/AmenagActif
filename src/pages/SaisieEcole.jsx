import { useState, useMemo } from 'react';
import SelecteurContexte from '../components/saisie/SelecteurContexte.jsx';
import BarreSaut from '../components/saisie/BarreSaut.jsx';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import AjoutEleve from '../components/saisie/AjoutEleve.jsx';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useGridMutations } from '../hooks/useGridMutations.js';

export default function SaisieEcole() {
  const [ctx, setCtx] = useState({ ecoleId: null, anneeId: null });
  const { data: cat } = useCatalogue();
  const { data: grid, isLoading, error } = useEcoleGrid(ctx.ecoleId, ctx.anneeId);
  const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);

  const classesAvecEleves = useMemo(() => {
    if (!grid) return [];
    return grid.classes.map((classe) => ({
      classe,
      eleves: grid.eleves.filter((e) => e.classe_id === classe.id),
    }));
  }, [grid]);

  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');

  return (
    <div className="plai-section space-y-4">
      <h1 className="text-xl font-semibold">Saisie des aménagements</h1>
      <SelecteurContexte ecoleId={ctx.ecoleId} anneeId={ctx.anneeId} onChange={setCtx} />

      {ctx.ecoleId && ctx.anneeId && (
        <AjoutEleve
          onCreate={async ({ classeNom, niveau, prenom, initiale, referent }) => {
            const classeId = await mut.ensureClasse.mutateAsync({ nom: classeNom, niveau });
            await mut.upsertEleve.mutateAsync({ classeId, prenom, initialeNom: initiale, referentPlaiNom: referent });
          }}
        />
      )}

      {!ctx.ecoleId || !ctx.anneeId ? (
        <p className="plai-empty">Choisir une école et une année pour afficher la grille.</p>
      ) : isLoading ? (
        <p>Chargement de la grille…</p>
      ) : error ? (
        <p className="plai-error">Erreur de chargement : {error.message}</p>
      ) : grid.classes.length === 0 ? (
        <p className="plai-empty">Aucune classe. Ajouter un élève créera sa classe.</p>
      ) : (
        <>
          <BandeauAU classesAvecEleves={classesAvecEleves} auCatalogue={auCat} chapitres={chapitres}
            auClasse={grid.auClasse} onToggle={(v) => mut.toggleAU.mutate(v)} />

          <div>
            <h2 className="font-semibold mb-1">Aménagements raisonnables — par élève</h2>
            <BarreSaut chapitres={chapitres} />
          </div>
          <div className="overflow-x-auto border border-[color:var(--border)] rounded">
            <table className="border-collapse text-sm">
              <EnTeteEleves classesAvecEleves={classesAvecEleves}
                onSaveEleve={(v) => mut.upsertEleve.mutateAsync(v)}
                onDeleteEleve={(v) => mut.deleteEleve.mutateAsync(v)} />
              <tbody>
                {chapitres.map((ch) => (
                  <ChapitreAR key={ch.id} chapitre={ch}
                    amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                    classesAvecEleves={classesAvecEleves}
                    selectionsAR={grid.selectionsAR}
                    libres={grid.libres}
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
