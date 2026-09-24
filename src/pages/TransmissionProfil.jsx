import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogueAdmin, useCatalogueMutations } from '../hooks/useAdmin.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';
const T16 = { fontSize: 16 };

/** Boîte de dialogue accessible (<dialog> natif : focus piégé, Échap, retour du focus). */
function DialogueLot({ lot, enCours, erreur, onConfirmer, onAnnuler }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && typeof d.showModal === 'function' && !d.open) d.showModal();
  }, []);
  const n = lot.nb;
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!enCours) onAnnuler(); }}
      aria-labelledby="lot-titre"
      aria-describedby="lot-desc"
      className="rounded border border-[color:var(--border)] p-5 max-w-lg text-base"
    >
      <h2 id="lot-titre" className="text-lg font-semibold mb-2">
        {lot.valeur ? 'Tout transmettre ?' : 'Tout ne pas transmettre ?'}
      </h2>
      <p id="lot-desc" className="mb-4">
        {lot.valeur
          ? `Les ${n} aménagements du chapitre « ${lot.titre} » passeront à « Transmis » : ils seront envoyés aux autres apps.`
          : `Les ${n} aménagements du chapitre « ${lot.titre} » passeront à « Non transmis » : ils ne seront plus envoyés aux autres apps (ils restent visibles dans AménagActif).`}
        {' '}Les aménagements désactivés du chapitre sont inclus.
      </p>
      {erreur && <p role="alert" className="plai-error mb-3" style={T16}>{erreur}</p>}
      <div className="flex gap-3 justify-end">
        <button type="button" autoFocus className={`plai-btn-ghost px-4 py-2 border rounded ${FOCUS}`} style={T16} onClick={onAnnuler} disabled={enCours}>Annuler</button>
        <button type="button" className={`plai-btn ${FOCUS}`} style={T16} onClick={onConfirmer} disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Confirmer'}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Écran de revue « Transmission aux autres apps » (admin). Polarité positive : statut « Transmis ».
 * Le formulaire d'édition du catalogue garde la case d'exception « Ne pas transmettre aux autres apps ».
 */
export default function TransmissionProfil() {
  const { data, isLoading, error } = useCatalogueAdmin();
  const { majPartageProfil } = useCatalogueMutations();
  const [seulementNonTransmis, setSeulementNonTransmis] = useState(false);
  const [ouverts, setOuverts] = useState(() => new Set());
  const [touches, setTouches] = useState(() => new Set()); // lignes modifiées : restent visibles sous le filtre (le focus ne disparaît pas)
  const [statuts, setStatuts] = useState({}); // id -> { etat: 'en_cours'|'ok'|'erreur', msg }
  const [annonce, setAnnonce] = useState('');
  const [lot, setLot] = useState(null); // { chapitreId, titre, valeur, nb }
  const [lotEnCours, setLotEnCours] = useState(false);
  const [lotErreur, setLotErreur] = useState('');

  const chapitres = useMemo(() => data?.chapitres ?? [], [data]);
  const amenagements = useMemo(() => data?.amenagements ?? [], [data]);
  const nbTransmis = amenagements.filter((a) => a.partage_profil).length;
  const nbNon = amenagements.length - nbTransmis;

  const basculer = async (a) => {
    const valeur = !a.partage_profil;
    setStatuts((s) => ({ ...s, [a.id]: { etat: 'en_cours', msg: 'Enregistrement…' } }));
    try {
      await majPartageProfil.mutateAsync({ id: a.id, valeur });
      setTouches((t) => new Set(t).add(a.id));
      setStatuts((s) => ({ ...s, [a.id]: { etat: 'ok', msg: 'Enregistré' } }));
      setAnnonce(`Enregistré : « ${a.libelle} » est ${valeur ? 'transmis' : 'non transmis'}.`);
    } catch (e) {
      const msg = `Échec de l'enregistrement : ${e?.message ?? 'erreur inconnue'}`;
      setStatuts((s) => ({ ...s, [a.id]: { etat: 'erreur', msg } }));
      setAnnonce(msg);
    }
  };

  const confirmerLot = async () => {
    setLotEnCours(true);
    setLotErreur('');
    try {
      await majPartageProfil.mutateAsync({ chapitreId: lot.chapitreId, valeur: lot.valeur });
      setAnnonce(`Enregistré : ${lot.nb} aménagements du chapitre « ${lot.titre} » sont ${lot.valeur ? 'transmis' : 'non transmis'}.`);
      setStatuts((s) => {
        const suite = { ...s };
        for (const a of amenagements) if (a.chapitre_id === lot.chapitreId) delete suite[a.id];
        return suite;
      });
      setLot(null);
    } catch (e) {
      setLotErreur(`Échec de l'enregistrement : ${e?.message ?? 'erreur inconnue'}`);
    } finally {
      setLotEnCours(false);
    }
  };

  const basculeChapitre = (id) => setOuverts((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="plai-section space-y-4 max-w-4xl px-4 text-base">
      <p><Link className="underline text-teal" to="/administration">Retour à l'Administration</Link></p>
      <h1 className="text-xl font-semibold">Transmission aux autres apps</h1>

      <p>
        <strong>Transmettre</strong> un aménagement, c'est l'inclure dans le profil d'une classe que AménagActif envoie aux autres apps PLAI
        (par exemple, pour qu'une app adapte un document). Un aménagement « Non transmis » reste visible dans AménagActif, mais n'est jamais envoyé.
        Le code de chaque aménagement est généré automatiquement. Un aménagement transmis que l'app cible ne sait pas appliquer sera simplement
        présenté comme « non appliqué automatiquement », avec son libellé. Les nouveaux aménagements sont transmis par défaut.
      </p>

      {isLoading && <p role="status">Chargement du catalogue…</p>}
      {error && <p role="alert" className="plai-error" style={T16}>Chargement impossible : {error.message ?? 'erreur inconnue'}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-4 border border-[color:var(--border)] rounded p-3">
            <p className="font-medium" data-testid="compteur">{nbTransmis} transmis, {nbNon} non transmis</p>
            <label htmlFor="filtre-non-transmis" className="flex items-center gap-2">
              <input id="filtre-non-transmis" type="checkbox" className="w-5 h-5" checked={seulementNonTransmis}
                onChange={(e) => { setSeulementNonTransmis(e.target.checked); setTouches(new Set()); }} />
              Non transmis seulement
            </label>
          </div>

          <div aria-live="polite" role="status" className="min-h-[1.5rem]" data-testid="annonce">{annonce}</div>

          <div className="border border-[color:var(--border)] rounded divide-y divide-[color:var(--border)]">
            {chapitres.map((ch) => {
              const tous = amenagements.filter((a) => a.chapitre_id === ch.id);
              const visibles = tous.filter((a) => !seulementNonTransmis || !a.partage_profil || touches.has(a.id));
              if (seulementNonTransmis && visibles.length === 0) return null;
              const estOuvert = ouverts.has(ch.id);
              const nT = tous.filter((a) => a.partage_profil).length;
              const idPanneau = `panneau-${ch.id}`;
              return (
                <section key={ch.id} aria-label={ch.titre}>
                  <h2 className="m-0">
                    <button type="button" aria-expanded={estOuvert} aria-controls={idPanneau}
                      className={`w-full text-left px-3 py-3 flex flex-wrap items-center gap-2 font-medium ${FOCUS}`} style={T16}
                      onClick={() => basculeChapitre(ch.id)}>
                      <span aria-hidden="true">{estOuvert ? '▼' : '▶'}</span>
                      <span>{ch.titre}</span>
                      <span className="font-normal text-[color:var(--text2)]">({nT} transmis sur {tous.length})</span>
                    </button>
                  </h2>
                  {estOuvert && (
                    <div id={idPanneau} className="px-3 pb-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={`plai-btn-ghost border rounded px-3 py-2 ${FOCUS}`} style={T16} disabled={tous.length === 0}
                          onClick={() => { setLotErreur(''); setLot({ chapitreId: ch.id, titre: ch.titre, valeur: true, nb: tous.length }); }}>
                          Tout transmettre
                        </button>
                        <button type="button" className={`plai-btn-ghost border rounded px-3 py-2 ${FOCUS}`} style={T16} disabled={tous.length === 0}
                          onClick={() => { setLotErreur(''); setLot({ chapitreId: ch.id, titre: ch.titre, valeur: false, nb: tous.length }); }}>
                          Tout ne pas transmettre
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse" style={T16}>
                          <caption className="sr-only">Aménagements du chapitre {ch.titre}</caption>
                          <thead>
                            <tr className="border-b border-[color:var(--border)]">
                              <th scope="col" className="py-2 pr-3">Aménagement</th>
                              <th scope="col" className="py-2 pr-3">Type</th>
                              <th scope="col" className="py-2">Transmission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibles.map((a) => {
                              const st = statuts[a.id];
                              return (
                                <tr key={a.id} className="border-b border-[color:var(--border)] align-top">
                                  <th scope="row" className="py-2 pr-3 font-normal">
                                    {a.libelle}
                                    {!a.actif && <span className="block text-[color:var(--text2)]">(désactivé)</span>}
                                  </th>
                                  <td className="py-2 pr-3">{a.type}</td>
                                  <td className="py-2">
                                    <button type="button" role="switch" aria-checked={!!a.partage_profil}
                                      aria-label={`${a.partage_profil ? 'Transmis' : 'Non transmis'} : ${a.libelle}`}
                                      disabled={st?.etat === 'en_cours'}
                                      className={`inline-flex items-center gap-2 border rounded px-3 py-2 font-medium ${FOCUS} ${a.partage_profil ? 'bg-[color:var(--teal-bg)] border-[color:var(--teal)]' : 'bg-white border-[color:var(--border2)]'}`}
                                      style={T16}
                                      onClick={() => basculer(a)}>
                                      <span aria-hidden="true">{a.partage_profil ? '✓' : '✕'}</span>
                                      {a.partage_profil ? 'Transmis' : 'Non transmis'}
                                    </button>
                                    {st && (
                                      <span role={st.etat === 'erreur' ? 'alert' : undefined}
                                        className={`block mt-1 ${st.etat === 'erreur' ? 'text-[#a32d2d] font-medium' : 'text-[color:var(--text2)]'}`}>
                                        {st.msg}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {lot && (
        <DialogueLot lot={lot} enCours={lotEnCours} erreur={lotErreur}
          onConfirmer={confirmerLot} onAnnuler={() => { setLot(null); setLotErreur(''); }} />
      )}
    </div>
  );
}
