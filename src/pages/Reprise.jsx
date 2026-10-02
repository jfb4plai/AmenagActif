import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAnnees, useEcoles } from '../hooks/useEcoleGrid.js';
import { useReprise, useRepriseMutations } from '../hooks/useReprise.js';
import { useRole } from '../lib/auth.jsx';
import { anneeSourceParDefaut, choixEffectifs, synthese, operations, marquages } from '../domain/reprise.js';
import EtapeClasses from '../components/reprise/EtapeClasses.jsx';
import EtapeEleves from '../components/reprise/EtapeEleves.jsx';
import EtapeSynthese from '../components/reprise/EtapeSynthese.jsx';
import FileTransferts from '../components/reprise/FileTransferts.jsx';

export default function Reprise() {
  const { isAdmin } = useRole();
  const { data: annees = [] } = useAnnees();
  const { data: ecoles = [] } = useEcoles();
  const [ecoleId, setEcoleId] = useState(null);
  const [cibleId, setCibleId] = useState(null);
  const [srcId, setSrcId] = useState(null);
  const [etape, setEtape] = useState(1);
  const [mapping, setMapping] = useState({});
  const [exceptions, setExceptions] = useState({});
  const [rapport, setRapport] = useState(null);

  // Défauts : cible = année active, source = année juste avant, école unique verrouillée.
  useEffect(() => {
    if (cibleId) return;
    const active = annees.find((a) => a.active);
    if (active) setCibleId(active.id);
  }, [annees, cibleId]);
  useEffect(() => {
    if (cibleId && !srcId) setSrcId(anneeSourceParDefaut(annees, cibleId)?.id ?? null);
  }, [annees, cibleId, srcId]);
  useEffect(() => {
    if (!ecoleId && ecoles.length === 1) setEcoleId(ecoles[0].id);
  }, [ecoles, ecoleId]);

  const reinit = () => { setMapping({}); setExceptions({}); setRapport(null); setEtape(1); };
  const libelle = (id) => annees.find((a) => a.id === id)?.libelle ?? '';

  const { data: d, isLoading, error } = useReprise(ecoleId, srcId, cibleId);
  const mut = useRepriseMutations(ecoleId, srcId, cibleId);

  const choix = useMemo(
    () => choixEffectifs({ eleves: d?.eleves ?? [], mapping, exceptions, dejaRepris: d?.dejaRepris ?? [] }),
    [d, mapping, exceptions],
  );
  const s = synthese(choix, d?.dejaRepris);
  const nomEleve = (id) => { const e = d?.eleves.find((x) => x.id === id); return e ? `${e.prenom} ${e.initiale_nom}` : id; };
  const classesCibleEcole = (d?.classesCible ?? []).filter((c) => c.ecole_id === ecoleId);

  const appliquer = async () => {
    const r = await mut.appliquer.mutateAsync({ operations: operations(choix), marquages: marquages(choix, d.eleves) });
    setRapport(r);
    setExceptions({});
  };

  const contexteOk = ecoleId && srcId && cibleId && srcId !== cibleId;

  return (
    <div className="plai-section space-y-4 px-4">
      <h1 className="text-xl font-semibold">Reprise des élèves d'une année à l'autre</h1>
      <p className="text-sm text-[color:var(--text3)]">
        Les fiches de l'année précédente restent intactes. Les élèves repris arrivent avec leurs aménagements marqués « à confirmer » :
        c'est à vous de les revoir (progrès de l'élève, niveau, changement de filière) avant de les considérer comme acquis.
      </p>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="rep-ecole" className="block font-medium">Implantation</label>
          {!isAdmin && ecoles.length === 1 ? (
            <p className="plai-input inline-block bg-[color:var(--bg)]">{ecoles[0].nom}{ecoles[0].implantation ? ` (${ecoles[0].implantation})` : ''}</p>
          ) : (
            <select id="rep-ecole" className="plai-input" value={ecoleId ?? ''} onChange={(e) => { setEcoleId(e.target.value || null); reinit(); }}>
              <option value="">— choisir —</option>
              {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}{e.implantation ? ` (${e.implantation})` : ''}</option>)}
            </select>
          )}
          <p className="text-xs text-[color:var(--text3)]">Une implantation à la fois.</p>
        </div>
        <div>
          <label htmlFor="rep-src" className="block font-medium">Reprendre depuis</label>
          <select id="rep-src" className="plai-input" value={srcId ?? ''} onChange={(e) => { setSrcId(e.target.value || null); reinit(); }}>
            <option value="">— choisir —</option>
            {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
          <p className="text-xs text-[color:var(--text3)]">L'année scolaire qui vient de se terminer.</p>
        </div>
        <div>
          <label htmlFor="rep-cible" className="block font-medium">Vers</label>
          <select id="rep-cible" className="plai-input" value={cibleId ?? ''} onChange={(e) => { setCibleId(e.target.value || null); reinit(); }}>
            <option value="">— choisir —</option>
            {annees.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
          <p className="text-xs text-[color:var(--text3)]">La nouvelle année (créez-la d'abord dans Administration si elle manque).</p>
        </div>
      </div>

      {srcId && cibleId && srcId === cibleId && <p className="plai-error">L'année de départ et d'arrivée doivent être différentes.</p>}
      {!contexteOk ? (
        <p className="plai-empty">Choisissez l'implantation et les deux années pour commencer.</p>
      ) : isLoading || !d ? (
        <p>Chargement…</p>
      ) : error ? (
        <p className="plai-error">Erreur de chargement : {error.message}</p>
      ) : (
        <>
          <nav aria-label="Étapes" className="flex gap-2 text-sm">
            {['Classes', 'Exceptions', 'Synthèse'].map((t, i) => (
              <button key={t} className={`plai-btn ${etape === i + 1 ? '' : 'opacity-60'}`} aria-current={etape === i + 1 ? 'step' : undefined}
                disabled={i > 0 && classesCibleEcole.length === 0} onClick={() => setEtape(i + 1)}>
                {i + 1}. {t}
              </button>
            ))}
          </nav>

          {etape === 1 && (
            <EtapeClasses d={d} ecoleId={ecoleId} srcLibelle={libelle(srcId)} cibleLibelle={libelle(cibleId)}
              mapping={mapping} setMapping={setMapping} mut={mut} />
          )}
          {etape === 2 && (
            <EtapeEleves d={d} ecoleId={ecoleId} ecoles={ecoles} isAdmin={isAdmin}
              mapping={mapping} exceptions={exceptions} setExceptions={setExceptions} choix={choix} />
          )}
          {etape === 3 && (
            <EtapeSynthese s={s} onAppliquer={appliquer} enCours={mut.appliquer.isPending} rapport={rapport} nomEleve={nomEleve} />
          )}

          <div className="flex justify-between">
            <button className="plai-btn" disabled={etape === 1} onClick={() => setEtape(etape - 1)}>← Précédent</button>
            {etape < 3 && <button className="plai-btn" disabled={classesCibleEcole.length === 0} onClick={() => setEtape(etape + 1)}>Suivant →</button>}
          </div>
          {classesCibleEcole.length === 0 && etape === 1 && (
            <p className="text-sm text-[color:var(--text3)]">Créez d'abord les classes de {libelle(cibleId)} pour passer à l'étape suivante.</p>
          )}
        </>
      )}

      {isAdmin && srcId && cibleId && srcId !== cibleId && (
        <FileTransferts srcId={srcId} cibleId={cibleId} ecoles={ecoles} mut={mut} />
      )}

      <p className="text-sm">Nouvel élève, absent de l'année précédente ? <Link to="/saisie" className="underline text-teal">Ajoutez-le depuis la Saisie</Link>.</p>
    </div>
  );
}
