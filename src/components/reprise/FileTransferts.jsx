import { useState } from 'react';
import { useTransferts } from '../../hooks/useReprise.js';

export default function FileTransferts({ srcId, cibleId, ecoles, mut }) {
  const { data, isLoading, error } = useTransferts(srcId, cibleId, true);
  const [choisi, setChoisi] = useState({});
  const nomEcole = (id) => ecoles.find((e) => e.id === id)?.nom ?? '—';

  if (isLoading) return <p>Chargement…</p>;
  if (error) return <p className="plai-error">Erreur : {error.message}</p>;

  return (
    <section className="plai-card p-3 space-y-2">
      <h2 className="font-semibold">Élèves à réaffecter (changement d'implantation)</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Élèves marqués « Autre implantation » par un référent. Choisissez l'implantation et la classe d'arrivée : l'élève est repris avec ses AR « à confirmer ».
        Si la classe attendue n'apparaît pas, ouvrez d'abord l'assistant de cette implantation d'arrivée pour créer ses classes.
      </p>
      {data.eleves.length === 0 ? (
        <p className="plai-empty">Aucun élève en attente.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]">
          {data.eleves.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-1">
              <span className="w-48">{e.prenom} {e.initiale_nom}</span>
              <span className="text-sm text-[color:var(--text3)] w-56">de {e.ar_classes.nom} — {nomEcole(e.ar_classes.ecole_id)}</span>
              <select className="plai-input" aria-label={`Classe d'arrivée de ${e.prenom} ${e.initiale_nom}`}
                value={choisi[e.id] ?? ''} onChange={(ev) => setChoisi({ ...choisi, [e.id]: ev.target.value })}>
                <option value="">— choisir —</option>
                {ecoles.map((ec) => {
                  const cl = data.classesCible.filter((c) => c.ecole_id === ec.id);
                  return cl.length === 0 ? null : (
                    <optgroup key={ec.id} label={ec.nom}>
                      {cl.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.niveau ? ` (${c.niveau})` : ''}</option>)}
                    </optgroup>
                  );
                })}
              </select>
              <button className="plai-btn" disabled={!choisi[e.id] || mut.reprendreUn.isPending}
                onClick={() => mut.reprendreUn.mutate({ sourceId: e.id, classeId: choisi[e.id] })}>
                Affecter
              </button>
            </li>
          ))}
        </ul>
      )}
      {mut.reprendreUn.isError && <p className="plai-error text-sm">Affectation impossible : {mut.reprendreUn.error.message}</p>}
    </section>
  );
}
