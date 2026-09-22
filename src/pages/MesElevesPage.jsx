import { useMemo } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useElevesAccompagnes } from '../hooks/useElevesAccompagnes.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useGridMutations } from '../hooks/useGridMutations.js';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';

export default function MesElevesPage() {
  const { session } = useAuth();
  const { data, isLoading, error } = useElevesAccompagnes(session?.user?.id);

  const groupes = useMemo(() => {
    if (!data || !data.eleves) return [];
    return data.classes
      .map((classe) => ({
        classe,
        ecole: data.ecoles.find((e) => e.id === classe.ecole_id),
        eleves: data.eleves.filter((e) => e.classe_id === classe.id),
      }))
      .filter((g) => g.eleves.length > 0);
  }, [data]);

  if (isLoading) return <div className="plai-section">Chargement…</div>;
  if (error) return <div className="plai-section"><p className="plai-error">Erreur de chargement : {error.message}</p></div>;

  return (
    <div className="plai-section space-y-6">
      <h1 className="text-xl font-semibold">Mes élèves accompagnés</h1>
      {groupes.length === 0 ? (
        <p className="plai-empty">Aucun élève ne vous est assigné pour l'instant. Contactez le référent PLAI ou la direction de l'école concernée.</p>
      ) : (
        groupes.map((g) => <ClasseAccompagnee key={g.classe.id} {...g} />)
      )}
    </div>
  );
}

function ClasseAccompagnee({ classe, ecole, eleves }) {
  const { data: cat, error: catError } = useCatalogue();
  const { data: grid, error: gridError } = useEcoleGrid(classe.ecole_id, classe.annee_id);
  const mut = useGridMutations(classe.ecole_id, classe.annee_id);
  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');

  if (catError || gridError) {
    return (
      <div className="plai-card p-4">
        <p className="plai-error">Erreur de chargement de {classe.nom} : {(gridError || catError).message}</p>
      </div>
    );
  }
  if (!grid || !cat) return <div className="plai-card p-4">Chargement de {classe.nom}…</div>;

  return (
    <div className="space-y-3 border-t border-[color:var(--border)] pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">
        {classe.nom} <span className="text-[color:var(--text3)] font-normal text-sm">— {ecole?.nom}</span>
      </h2>

      <BandeauAU classe={classe} auCatalogue={auCat} chapitres={chapitres}
        auClasse={grid.auClasse.filter((x) => x.classe_id === classe.id)} onToggle={(v) => mut.toggleAU.mutate(v)} />

      <div className="overflow-x-auto border border-[color:var(--border)] rounded">
        <table className="border-collapse text-sm">
          <EnTeteEleves eleves={eleves} identiteVerrouillee
            onSaveEleve={(v) => mut.upsertEleve.mutateAsync(v)} />
          <tbody>
            {chapitres.map((ch) => (
              <ChapitreAR key={ch.id} chapitre={ch}
                amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                eleves={eleves}
                selectionsAR={grid.selectionsAR}
                libres={grid.libres}
                filtre=""
                onToggle={(v) => mut.toggleAR.mutate(v)}
                onAddLibre={(v) => mut.addLibre.mutate(v)}
                onRemoveLibre={(v) => mut.removeLibre.mutate(v)} />
            ))}
          </tbody>
        </table>
      </div>
      {mut.toggleAR.isError && <p className="plai-error">Échec d'enregistrement, réessayez.</p>}
    </div>
  );
}
