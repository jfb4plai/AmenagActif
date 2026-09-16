import { useState, useMemo } from 'react';
import SelecteurContexte from '../components/saisie/SelecteurContexte.jsx';
import SelecteurClasse from '../components/saisie/SelecteurClasse.jsx';
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
  const [classeId, setClasseId] = useState(null);
  const { data: cat } = useCatalogue();
  const { data: grid, isLoading, error } = useEcoleGrid(ctx.ecoleId, ctx.anneeId);
  const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);

  const classe = useMemo(() => grid?.classes.find((c) => c.id === classeId) ?? null, [grid, classeId]);
  const eleves = useMemo(() => (grid?.eleves ?? []).filter((e) => e.classe_id === classeId), [grid, classeId]);
  const referentSuggere = useMemo(() => {
    const valeurs = [...new Set(eleves.map((e) => e.referent_plai_nom).filter(Boolean))];
    return valeurs.length === 1 ? valeurs[0] : '';
  }, [eleves]);

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
        <SelecteurClasse
          classes={grid.classes}
          onSelect={setClasseId}
          onCreate={({ nom, niveau }) => mut.ensureClasse.mutateAsync({ nom, niveau })}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <button className="underline text-teal" onClick={() => setClasseId(null)}>← Changer de classe</button>
            </p>
          </div>

          <BandeauAU classe={classe} auCatalogue={auCat} chapitres={chapitres}
            auClasse={grid.auClasse.filter((x) => x.classe_id === classeId)} onToggle={(v) => mut.toggleAU.mutate(v)} />

          <AjoutEleve
            referentSuggere={referentSuggere}
            onCreate={async ({ prenom, initiale, referent }) => {
              await mut.upsertEleve.mutateAsync({ classeId, prenom, initialeNom: initiale, referentPlaiNom: referent });
            }}
          />

          <div>
            <h2 className="font-semibold mb-1">Aménagements raisonnables — {classe.nom}</h2>
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
