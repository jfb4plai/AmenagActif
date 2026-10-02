import { useState } from 'react';
import { groupesSource, poserException, versChoix, versValeur } from '../../domain/reprise.js';

const libelleClasse = (c) => `${c.nom}${c.niveau ? ` (${c.niveau})` : ''}`;

export default function EtapeEleves({ d, ecoleId, ecoles, isAdmin, mapping, exceptions, setExceptions, choix }) {
  const [filtre, setFiltre] = useState('');
  const groupes = groupesSource(d.classesSource, d.eleves);
  const repris = new Set(d.dejaRepris);
  const q = filtre.trim().toLowerCase();

  const propres = d.classesCible.filter((c) => c.ecole_id === ecoleId);
  // Seul l'admin peut placer directement un élève dans une autre implantation (RLS).
  const autres = isAdmin
    ? ecoles.filter((e) => e.id !== ecoleId)
        .map((e) => ({ ecole: e, classes: d.classesCible.filter((c) => c.ecole_id === e.id) }))
        .filter((x) => x.classes.length > 0)
    : [];

  return (
    <section className="space-y-3">
      <div className="plai-card p-3 space-y-1">
        <label htmlFor="filtre-eleve" className="font-semibold block">Corriger les exceptions</label>
        <input id="filtre-eleve" type="search" className="plai-input w-full max-w-sm" placeholder="Chercher un prénom (ex : Amir)"
          value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <p className="text-sm text-[color:var(--text3)]">
          Chaque élève est déjà placé dans la classe principale de son groupe. Changez uniquement ceux qui vont ailleurs : une autre classe de cette implantation,
          « Autre implantation » (l'administrateur l'affectera), ou « Fin de parcours ». Un élève « non traité » n'est pas repris pour l'instant.
          Un élève absent de ces listes (nouvel élève) s'ajoute depuis la Saisie.
        </p>
      </div>

      {groupes.map(({ classe, eleves }) => {
        const visibles = eleves.filter((e) => !q || `${e.prenom} ${e.initiale_nom}`.toLowerCase().includes(q));
        if (visibles.length === 0) return null;
        return (
          <details key={classe.id} open className="plai-card p-3">
            <summary className="font-medium cursor-pointer">
              {libelleClasse(classe)} — {eleves.length} élève(s)
            </summary>
            <ul className="mt-2 divide-y divide-[color:var(--border)]">
              {visibles.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-1">
                  <span className="w-48">{e.prenom} {e.initiale_nom}</span>
                  {repris.has(e.id) ? (
                    <span className="text-sm text-[color:var(--text3)]">déjà repris</span>
                  ) : (
                    <>
                      <select className="plai-input" aria-label={`Destination de ${e.prenom} ${e.initiale_nom}`}
                        value={versValeur(choix[e.id])}
                        onChange={(ev) => setExceptions(poserException(exceptions, e, versChoix(ev.target.value), mapping))}>
                        <option value="none">— non traité —</option>
                        <optgroup label="Cette implantation">
                          {propres.map((c) => <option key={c.id} value={`classe:${c.id}`}>{libelleClasse(c)}</option>)}
                        </optgroup>
                        {autres.map(({ ecole, classes }) => (
                          <optgroup key={ecole.id} label={ecole.nom}>
                            {classes.map((c) => <option key={c.id} value={`classe:${c.id}`}>{libelleClasse(c)}</option>)}
                          </optgroup>
                        ))}
                        <option value="transfert">Autre implantation (à réaffecter par l'administrateur)</option>
                        <option value="termine">Fin de parcours / quitte le réseau</option>
                      </select>
                      {exceptions[e.id] && <span className="text-xs text-[#9a3412] font-medium">modifié</span>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
