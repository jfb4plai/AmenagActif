import { useState, useMemo } from 'react';
import SelecteurContexte from '../components/saisie/SelecteurContexte.jsx';
import SelecteurClasse from '../components/saisie/SelecteurClasse.jsx';
import BarreSaut from '../components/saisie/BarreSaut.jsx';
import EnTeteEleves from '../components/saisie/EnTeteEleves.jsx';
import EleveEditor from '../components/saisie/EleveEditor.jsx';
import BandeauAU from '../components/saisie/BandeauAU.jsx';
import BandeauAvantages from '../components/BandeauAvantages.jsx';
import ChapitreAR from '../components/saisie/ChapitreAR.jsx';
import CarteDispositif from '../components/saisie/CarteDispositif.jsx';
import RecapDispositifs from '../components/saisie/RecapDispositifs.jsx';
import AjoutEleve from '../components/saisie/AjoutEleve.jsx';
import { useCatalogue } from '../hooks/useCatalogue.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useGridMutations } from '../hooks/useGridMutations.js';
import { useRole } from '../lib/auth.jsx';
import { chapitreEnModeAU, bloqueBasculeDispositif } from '../domain/dispositifs.js';

export default function SaisieEcole() {
  const { role } = useRole();
  const peutEditerStructure = role !== 'agent_plai';
  const [ctx, setCtx] = useState({ ecoleId: null, anneeId: null });
  const [classeId, setClasseId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [eleveSurvole, setEleveSurvole] = useState(null);
  const [blocages, setBlocages] = useState({});
  const { data: cat } = useCatalogue();
  const { data: grid, isLoading, error } = useEcoleGrid(ctx.ecoleId, ctx.anneeId);
  const mut = useGridMutations(ctx.ecoleId, ctx.anneeId);

  const classe = useMemo(() => grid?.classes.find((c) => c.id === classeId) ?? null, [grid, classeId]);
  const eleves = useMemo(() => (grid?.eleves ?? []).filter((e) => e.classe_id === classeId), [grid, classeId]);

  const chapitres = cat?.chapitres ?? [];
  const auCat = (cat?.amenagements ?? []).filter((a) => a.type === 'AU');
  const dispositifs = chapitres.filter((c) => c.est_dispositif);
  const modesClasse = (grid?.modesDispositifs ?? []).filter((m) => m.classe_id === classeId);
  const enModeAU = (ch) => chapitreEnModeAU(ch, modesClasse);
  const blocageDe = (ch) => blocages[`${classeId}:${ch.id}`] ?? null;
  // Bascule du mode d'un dispositif : refusée (message) si des cases de l'autre mode sont cochées.
  const tenterBascule = (ch, vers) => {
    const msg = bloqueBasculeDispositif({
      vers, chapitreId: ch.id, amenagements: cat?.amenagements ?? [],
      eleveIds: new Set(eleves.map((e) => e.id)),
      selectionsAR: grid.selectionsAR,
      auClasse: grid.auClasse.filter((x) => x.classe_id === classeId),
    });
    setBlocages((b) => ({ ...b, [`${classeId}:${ch.id}`]: msg }));
    if (!msg) mut.basculerDispositif.mutate({ classeId, chapitreId: ch.id, pourToute: vers === 'AU' });
  };
  const enteteDe = (ch) => ({
    mode: enModeAU(ch) ? 'AU' : 'AR',
    peutBasculer: peutEditerStructure,
    blocage: blocageDe(ch),
    onBascule: (vers) => tenterBascule(ch, vers),
  });

  return (
    <>
    <BandeauAvantages />
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
            peutCreer={peutEditerStructure}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{classe.nom}{classe.niveau ? <span className="text-[color:var(--text3)] font-normal"> — {classe.niveau}</span> : null}</h2>
            <div className="flex items-center gap-3 text-sm shrink-0">
              <button className="underline text-teal" onClick={() => { setClasseId(null); setEditId(null); }}>← Changer de classe</button>
              {peutEditerStructure && (
                <button className="underline text-red-600" onClick={() => {
                  const avertissement = eleves.length > 0
                    ? `Supprimer la classe ${classe.nom} ? Ses ${eleves.length} élève(s) et tous leurs aménagements cochés seront supprimés définitivement. Cette action est irréversible.`
                    : `Supprimer la classe ${classe.nom} ? Cette action est irréversible.`;
                  if (!confirm(avertissement)) return;
                  mut.deleteClasse.mutate({ id: classeId }, { onSuccess: () => { setClasseId(null); setEditId(null); } });
                }} disabled={mut.deleteClasse.isPending}>
                  {mut.deleteClasse.isPending ? 'Suppression…' : 'Supprimer la classe'}
                </button>
              )}
            </div>
          </div>
          {mut.deleteClasse.isError && <p className="plai-error text-sm">Échec de la suppression, réessayez.</p>}

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

          <div className="plai-card p-3 text-sm space-y-1">
            <label className="font-medium block" htmlFor="commentaire-classe">Commentaire de la classe (optionnel)</label>
            <textarea id="commentaire-classe" key={`${classe.id}-${classe.commentaire_modifie_le ?? ''}`}
              className="plai-input w-full" rows={3} maxLength={500}
              defaultValue={classe.commentaire ?? ''}
              placeholder="Ex. : classe en contrat discipline depuis septembre ; deux titulaires en alternance"
              onBlur={(e) => {
                const valeur = e.target.value.trim();
                if (valeur !== (classe.commentaire ?? '')) mut.majCommentaireClasse.mutate({ classeId, commentaire: valeur });
              }} />
            <p className="text-xs text-[color:var(--text3)]">
              Contexte de la classe utile à l'enseignant qui reçoit la fiche (500 caractères maximum) — comme le commentaire d'un élève, temporaire : pensez à le mettre à jour ou à le vider quand la situation change.
              Il apparaît en tête de la fiche classe, avec sa date de dernière modification. <strong>Jamais de nom d'élève ni de diagnostic</strong> : ce texte peut être lu par plusieurs enseignants.
              {classe.commentaire_modifie_le && <> Dernière modification : {new Date(classe.commentaire_modifie_le).toLocaleDateString('fr-BE')}.</>}
            </p>
            {mut.majCommentaireClasse.isError && <p className="plai-error text-sm">Enregistrement impossible, réessayez.</p>}
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
              onCreate={async ({ prenom, initiale, commentaire, statut }) => {
                await mut.upsertEleve.mutateAsync({ classeId, prenom, initialeNom: initiale, commentaire, statut });
              }}
            />
          </div>

          <RecapDispositifs dispositifs={dispositifs} modes={modesClasse} />

          <div className="mb-2">
            <input type="search" className="plai-input w-full max-w-sm" placeholder="Rechercher un AU ou un AR par mot-clé (ex : bruit, temps, oral)…"
              value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            <p className="text-xs text-[color:var(--text3)]">
              Filtre les aménagements universels ci-dessous et les aménagements raisonnables dans tous les chapitres, sans devoir les déplier un par un. Videz le champ pour revenir à la vue normale.
            </p>
          </div>

          <BandeauAU classe={classe} auCatalogue={auCat} chapitres={chapitres}
            auClasse={grid.auClasse.filter((x) => x.classe_id === classeId)} onToggle={(v) => mut.toggleAU.mutate(v)}
            peutRetirer={peutEditerStructure} filtre={recherche} />

          {dispositifs.filter(enModeAU).map((ch) => (
            <CarteDispositif key={ch.id} classe={classe} chapitre={ch}
              items={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id)}
              auClasse={grid.auClasse.filter((x) => x.classe_id === classeId)}
              onToggle={(v) => mut.toggleAU.mutate(v)}
              peutRetirer={peutEditerStructure} filtre={recherche} entete={enteteDe(ch)} />
          ))}

          <div>
            <h2 className="font-semibold mb-1">Aménagements raisonnables — {classe.nom}</h2>
            <BarreSaut chapitres={chapitres} />
          </div>
          <div className="overflow-x-auto border border-[color:var(--border)] rounded">
            <table className="border-collapse text-sm">
              <EnTeteEleves eleves={eleves}
                onSaveEleve={(v) => mut.upsertEleve.mutateAsync(v)}
                onDeleteEleve={(v) => mut.deleteEleve.mutateAsync(v)}
                eleveSurvole={eleveSurvole} onHoverEleve={setEleveSurvole} />
              <tbody>
                {chapitres.filter((ch) => !enModeAU(ch)).map((ch) => (
                  <ChapitreAR key={ch.id} chapitre={ch}
                    amenagements={(cat.amenagements ?? []).filter((a) => a.chapitre_id === ch.id && a.type === 'AR')}
                    eleves={eleves}
                    selectionsAR={grid.selectionsAR}
                    libres={grid.libres}
                    filtre={recherche}
                    onToggle={(v) => mut.toggleAR.mutate(v)}
                    onAddLibre={(v) => mut.addLibre.mutate(v)}
                    onRemoveLibre={(v) => mut.removeLibre.mutate(v)}
                    eleveSurvole={eleveSurvole} onHoverEleve={setEleveSurvole}
                    dispositif={ch.est_dispositif ? enteteDe(ch) : undefined} />
                ))}
              </tbody>
            </table>
          </div>
          {mut.toggleAR.isError && <p className="plai-error">Échec d'enregistrement, réessayez.</p>}
          {mut.basculerDispositif.isError && <p className="plai-error">Changement de mode refusé (droits insuffisants ?), réessayez.</p>}
        </>
      )}
    </div>
    </>
  );
}
