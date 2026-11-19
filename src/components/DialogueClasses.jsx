import { useEffect, useMemo, useRef, useState } from 'react';
import { trierClasses } from '../domain/liens.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';
const SANS_NIVEAU = 'Sans niveau';
export const MESSAGE_AU_MOINS_UNE = 'Un sommaire doit garder au moins une classe. Pour le supprimer, révoquez-le.';
export const MESSAGE_AU_MOINS_UN_ELEMENT = 'Un sommaire doit garder au moins une classe ou une fiche groupée. Pour le supprimer, révoquez-le.';

/**
 * Modification des classes d'un sommaire. <dialog> natif : focus piégé, Échap annule.
 * classeIdsInitiales : liste de référence lue en base à l'ouverture ; à défaut, lien.classe_ids (peut être incomplet).
 * fichesGroupees : fiches groupées enregistrées de l'école et de l'année ; fgIdsInitiales : celles que le sommaire contient.
 * Sans fiche groupée à gérer, onEnregistrer(ids) ; sinon onEnregistrer(ids, fgIds).
 */
export default function DialogueClasses({ lien, classes, classeIdsInitiales, fichesGroupees = [], fgIdsInitiales = [], enCours, erreur, onEnregistrer, onAnnuler }) {
  const gereFg = fichesGroupees.length > 0 || fgIdsInitiales.length > 0;
  const [cochesFg, setCochesFg] = useState(() => new Set(fgIdsInitiales));
  const basculerFg = (id) => setCochesFg((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const ref = useRef(null);
  const [initiales] = useState(() => classeIdsInitiales ?? lien.classe_ids ?? []);
  const [coches, setCoches] = useState(() => new Set(initiales));
  useEffect(() => {
    const d = ref.current;
    if (d && typeof d.showModal === 'function' && !d.open) d.showModal();
  }, []);

  const groupes = useMemo(() => {
    const m = new Map();
    for (const c of trierClasses(classes)) {
      const cle = c.niveau || SANS_NIVEAU;
      if (!m.has(cle)) m.set(cle, []);
      m.get(cle).push(c);
    }
    return [...m.entries()];
  }, [classes]);

  const basculer = (id) => setCoches((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const definirGroupe = (liste, valeur) => setCoches((prev) => {
    const s = new Set(prev);
    for (const c of liste) { if (valeur) s.add(c.id); else s.delete(c.id); }
    return s;
  });

  const vide = coches.size === 0 && (!gereFg || cochesFg.size === 0);
  const fgIds = fichesGroupees.filter((f) => cochesFg.has(f.id)).map((f) => f.id);
  // Ordre d'affichage conservé pour l'envoi
  // Ids du lien absents de la liste affichée : jamais retirés (le serveur remplace l'ensemble).
  const visibles = new Set(classes.map((c) => c.id));
  const conservees = initiales.filter((id) => !visibles.has(id));
  const ids = [...trierClasses(classes).filter((c) => coches.has(c.id)).map((c) => c.id), ...conservees];

  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!enCours) onAnnuler(); }}
      aria-labelledby="dlgc-titre"
      aria-describedby="dlgc-desc"
      className="rounded border border-[color:var(--border)] p-5 max-w-2xl w-full text-base"
    >
      <h2 id="dlgc-titre" className="text-lg font-semibold mb-2">{gereFg ? 'Modifier le contenu du sommaire' : 'Modifier les classes du sommaire'}</h2>
      <p id="dlgc-desc" className="mb-3 text-[color:var(--text2)]">
        Cochez les classes{gereFg ? ' et les fiches groupées' : ''} dont l'enseignant ({lien.destinataire}) voit la fiche. Le changement s'applique à son prochain accès au lien, sans nouveau lien à transmettre.
      </p>
      <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-3 pr-1">
        {groupes.map(([niveau, liste]) => (
          <fieldset key={niveau} className="border border-[color:var(--border)] rounded p-3">
            <legend className="px-1 font-medium">{niveau}</legend>
            <div className="flex flex-wrap gap-2 mb-2">
              <button type="button" className={`plai-btn-ghost px-3 py-1 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={() => definirGroupe(liste, true)}>
                Tout cocher {niveau}
              </button>
              <button type="button" className={`plai-btn-ghost px-3 py-1 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={() => definirGroupe(liste, false)}>
                Tout décocher {niveau}
              </button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {liste.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <input id={`dlgc-${c.id}`} type="checkbox" className="w-5 h-5" checked={coches.has(c.id)} onChange={() => basculer(c.id)} />
                  <label htmlFor={`dlgc-${c.id}`}>{c.nom}</label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
        {fichesGroupees.length > 0 && (
          <fieldset className="border border-[color:var(--border)] rounded p-3">
            <legend className="px-1 font-medium">Fiches groupées</legend>
            <ul className="space-y-2">
              {fichesGroupees.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <input id={`dlgc-fg-${f.id}`} type="checkbox" className="w-5 h-5" checked={cochesFg.has(f.id)} onChange={() => basculerFg(f.id)} />
                  <label htmlFor={`dlgc-fg-${f.id}`}>{f.nom}<span className="text-[color:var(--text2)]"> ({f.classeIds.map((id) => classes.find((c) => c.id === id)?.nom).filter(Boolean).join(' + ')})</span></label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>
      {conservees.length > 0 && (
        <p className="mb-3" style={{ fontSize: 16 }}>
          {conservees.length} {conservees.length > 1 ? "classes de ce sommaire n'apparaissent pas dans la liste ci-dessus ; elles sont conservées." : "classe de ce sommaire n'apparaît pas dans la liste ci-dessus ; elle est conservée."}
        </p>
      )}
      {vide && <p role="alert" className="plai-error mb-3" style={{ fontSize: 16 }}>{gereFg ? MESSAGE_AU_MOINS_UN_ELEMENT : MESSAGE_AU_MOINS_UNE}</p>}
      {erreur && <p role="alert" className="plai-error mb-3" style={{ fontSize: 16 }}>{erreur}</p>}
      <div className="flex gap-3 justify-end">
        <button type="button" autoFocus className={`plai-btn-ghost px-4 py-2 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={onAnnuler} disabled={enCours}>Annuler</button>
        <button type="button" className={`plai-btn ${FOCUS}`} style={{ fontSize: 16 }} onClick={() => (gereFg ? onEnregistrer(ids, fgIds) : onEnregistrer(ids))} disabled={vide || enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </dialog>
  );
}
