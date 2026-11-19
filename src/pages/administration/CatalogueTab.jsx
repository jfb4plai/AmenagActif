import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useCatalogueAdmin, useCatalogueMutations, useUsageCatalogue, chargerUsageCatalogue,
} from '../../hooks/useAdmin.js';
import { traverseDispositif } from '../../domain/dispositifs.js';
import RenommerChapitre from '../../components/RenommerChapitre.jsx';

export default function CatalogueTab() {
  const { data } = useCatalogueAdmin();
  const { majAmenagement, ajouterAmenagement, ajouterChapitre, supprimerAmenagement, supprimerChapitre, renommerChapitre } = useCatalogueMutations();
  const [ouvert, setOuvert] = useState(null);
  const [renomme, setRenomme] = useState(null); // id du chapitre dont le titre est en cours de modification
  const [usage, setUsage] = useState(null); // { type: 'amenagement' | 'chapitre', id, titre, refus? }
  const [verification, setVerification] = useState(false);
  const [erreurVerif, setErreurVerif] = useState('');

  // Vérifie d'abord si l'élément a déjà servi : si oui, la fenêtre explique le refus et dit qui contacter ;
  // sinon, une confirmation rassurante (rien n'est affecté) avant de supprimer.
  const demanderSuppression = async (cible, quoi, mutation) => {
    setVerification(true);
    setErreurVerif('');
    try {
      const u = await chargerUsageCatalogue(cible);
      if (!u.vide) { setUsage({ ...cible, refus: true }); return; }
      if (confirm(`Ce n'a jamais été coché : aucune fiche n'est concernée.

Supprimer définitivement ${quoi} ?`)) mutation.mutate({ id: cible.id });
    } catch (e) {
      setErreurVerif(e.message || 'Vérification impossible, réessayez.');
    } finally {
      setVerification(false);
    }
  };
  const chapitres = data?.chapitres ?? [];
  const amenagements = data?.amenagements ?? [];

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Catalogue des aménagements</h2>
      <p className="text-base text-[color:var(--text2)]">
        Repris du classeur source. <strong>AU</strong> = universel (coché par classe, bloc « AU applicable(s) à toute la classe »). <strong>AR</strong> = raisonnable (coché par élève).
        Changer un type ne touche pas aux cases déjà cochées, mais celles-ci peuvent devenir sans effet sur la fiche — vérifiez ensuite les classes concernées.
        Désactiver retire l'aménagement des écrans sans le supprimer. Supprimer n'est possible que pour un aménagement ou un chapitre jamais coché (sinon la base refuse et indique combien d'élèves et de classes sont concernés).
        Le code de chaque aménagement est généré automatiquement à la création et ne change plus.
      </p>
      <p className="text-base">
        <Link className="underline text-teal font-medium" to="/administration/transmission">
          Revoir la transmission aux autres apps (tout le catalogue, chapitre par chapitre)
        </Link>
      </p>
      <div className="border border-[color:var(--border)] rounded divide-y divide-[color:var(--border)]">
        {chapitres.map((ch) => {
          const items = amenagements.filter((a) => a.chapitre_id === ch.id);
          const estOuvert = ouvert === ch.id;
          return (
            <div key={ch.id}>
              <div className="flex items-center gap-2 pr-3">
              <button className="flex-1 text-left px-3 py-2 flex items-center gap-2 font-medium"
                onClick={() => setOuvert(estOuvert ? null : ch.id)}>
                <span>{estOuvert ? '▼' : '▶'}</span>
                <span>{ch.titre}</span>
                <span className="text-sm text-[color:var(--text3)]">
                  {ch.est_dispositif
                    ? `(dispositif : ${items.length} aménagement(s), AR ou AU selon la classe)`
                    : `(${items.filter((i) => i.type === 'AU').length} AU · ${items.filter((i) => i.type === 'AR').length} AR)`}
                </span>
              </button>
              <button type="button" className="underline text-teal text-sm shrink-0"
                onClick={() => setRenomme(renomme === ch.id ? null : ch.id)}>
                Renommer
              </button>
              <button type="button" className="underline text-teal text-sm shrink-0"
                onClick={() => setUsage({ type: 'chapitre', id: ch.id, titre: ch.titre })}>
                Voir où c'est utilisé
              </button>
              <button type="button" className="underline text-red-600 text-sm shrink-0"
                onClick={() => demanderSuppression({ type: 'chapitre', id: ch.id, titre: ch.titre }, `le chapitre « ${ch.titre} » et ses ${items.length} aménagement(s)`, supprimerChapitre)}
                disabled={supprimerChapitre.isPending || verification}>
                Supprimer ce chapitre
              </button>
              </div>
              {renomme === ch.id && (
                <RenommerChapitre key={ch.id} chapitre={ch}
                  autresTitres={chapitres.filter((c) => c.id !== ch.id).map((c) => c.titre)}
                  onRenommer={(titre) => renommerChapitre.mutateAsync({ id: ch.id, titre })}
                  onFermer={() => setRenomme(null)} />
              )}
              {estOuvert && (
                <div className="px-3 pb-3 space-y-3">
                  {items.map((a) => (
                    <div key={a.id} className={`border rounded p-2 space-y-2 ${a.actif ? 'border-[color:var(--border)]' : 'border-dashed border-[color:var(--border)] opacity-60'}`}>
                      <textarea
                        className="plai-input w-full"
                        style={{ fontSize: 16 }}
                        rows={2}
                        defaultValue={a.libelle}
                        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== a.libelle) majAmenagement.mutate({ id: a.id, libelle: e.target.value }); }}
                      />
                      <div className="flex flex-wrap items-center gap-3 text-base">
                        {ch.est_dispositif ? (
                          <span className="flex items-center gap-1" title="Le type dépend de la classe : AR par élève, ou AU si le dispositif est passé à toute la classe.">
                            Type <strong>selon la classe (AR ou AU)</strong>
                          </span>
                        ) : (
                          <label className="flex items-center gap-1">
                            Type
                            <select className="plai-input !w-auto !py-1" value={a.type}
                              onChange={(e) => majAmenagement.mutate({ id: a.id, type: e.target.value })}>
                              <option value="AU">AU — universel (classe)</option>
                              <option value="AR">AR — raisonnable (élève)</option>
                            </select>
                          </label>
                        )}
                        <label className="flex items-center gap-1">
                          Chapitre
                          <select className="plai-input !w-auto !py-1" value={a.chapitre_id}
                            onChange={(e) => {
                              const cible = chapitres.find((c) => c.id === e.target.value);
                              majAmenagement.mutate({
                                id: a.id, chapitreId: e.target.value,
                                ...(cible?.est_dispositif ? { type: 'AR' } : {}),
                                // Entrer/sortir d'un dispositif : refusé si l'item est déjà coché (cochages invisibles sinon).
                                ...(traverseDispositif(ch, cible) ? { verifierCochages: true } : {}),
                              });
                            }}>
                            {chapitres.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
                          </select>
                        </label>
                        <span className="flex items-center gap-1" title="Code stable, non modifiable : il reste identique même si le libellé change.">
                          Code
                          <code className="px-1 rounded bg-[color:var(--bg)] border border-[color:var(--border)]">{a.code ?? 'en cours de génération'}</code>
                        </span>
                        <label className="flex items-center gap-1">
                          <input type="checkbox" checked={a.actif}
                            onChange={(e) => majAmenagement.mutate({ id: a.id, actif: e.target.checked })} />
                          actif
                        </label>
                        <button type="button" className="underline text-teal"
                          onClick={() => setUsage({ type: 'amenagement', id: a.id, titre: a.libelle })}>
                          Voir où c'est utilisé
                        </button>
                        <button type="button" className="underline text-red-600"
                          onClick={() => demanderSuppression({ type: 'amenagement', id: a.id, titre: a.libelle }, `« ${a.libelle} »`, supprimerAmenagement)}
                          disabled={supprimerAmenagement.isPending || verification}>
                          Supprimer
                        </button>
                      </div>
                      <div>
                        <label htmlFor={`np-${a.id}`} className="flex items-center gap-2 font-medium">
                          <input id={`np-${a.id}`} type="checkbox" className="w-5 h-5" checked={!a.partage_profil}
                            aria-describedby={`np-aide-${a.id}`}
                            onChange={(e) => majAmenagement.mutate({ id: a.id, partageProfil: !e.target.checked })} />
                          Ne pas transmettre aux autres apps
                        </label>
                        <p id={`np-aide-${a.id}`} className="text-base text-[color:var(--text2)] mt-1">{AIDE_NE_PAS_TRANSMETTRE}</p>
                      </div>
                    </div>
                  ))}
                  <AjoutAmenagement chapitreId={ch.id} estDispositif={ch.est_dispositif === true} onAdd={ajouterAmenagement.mutate} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AjoutChapitre onAdd={ajouterChapitre.mutate} />
      {[majAmenagement, ajouterAmenagement, ajouterChapitre].filter((m) => m.isError).map((m, i) => (
        <p key={i} role="alert" className="plai-error" style={{ fontSize: 16 }}>Action impossible : {m.error?.message ?? 'erreur inconnue'}. Réessayez.</p>
      ))}
      {[supprimerAmenagement, supprimerChapitre].filter((m) => m.isError).map((m, i) => (
        <p key={`s${i}`} role="alert" className="plai-error" style={{ fontSize: 16 }}>
          {m.error?.message ?? 'Suppression impossible.'} Cliquez sur « Voir où c'est utilisé » pour savoir qui contacter.
        </p>
      ))}
      {verification && <p role="status" className="text-base">Vérification de l'utilisation en cours…</p>}
      {erreurVerif && <p role="alert" className="plai-error" style={{ fontSize: 16 }}>{erreurVerif}</p>}
      {usage && <FenetreUsage cible={usage} onClose={() => setUsage(null)} />}
    </section>
  );
}

/** Fenêtre : où un aménagement / un chapitre est coché (implantations, classes, élèves) et qui contacter. */
function FenetreUsage({ cible, onClose }) {
  const { data, isLoading, error } = useUsageCatalogue(cible);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const resume = data && !data.vide
    ? `${data.nbEleves} élève(s) et ${data.nbClassesAU} classe(s) (AU) dans ${data.nbEcoles} implantation(s)`
    : '';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 no-print" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="usage-titre"
        className="bg-white rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5 space-y-3" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="usage-titre" className="font-semibold text-lg">
            Où {cible.type === 'chapitre' ? 'ce chapitre est-il utilisé' : 'cet aménagement est-il utilisé'} ?
          </h2>
          <button type="button" className="plai-btn shrink-0" onClick={onClose}>Fermer</button>
        </div>
        <p className="text-base text-[color:var(--text2)]">{cible.titre}</p>
        {isLoading && <p>Chargement…</p>}
        {error && <p role="alert" className="plai-error">{error.message}</p>}
        {cible.refus && data && !data.vide && (
          <p role="alert" className="rounded p-2 font-medium" style={{ background: '#fff3e6', border: '1px solid #f97316', color: '#9a3412' }}>
            Suppression impossible pour l'instant : {cible.type === 'chapitre' ? 'des aménagements de ce chapitre sont' : 'cet aménagement est'} coché(s) dans des fiches.
            Rien n'a été supprimé et aucune fiche n'a été modifiée.
          </p>
        )}
        {data?.vide && <p className="plai-empty">Jamais coché : il peut être supprimé sans conséquence.</p>}
        {data && !data.vide && (
          <>
            <p className="text-base font-medium">{resume}. Pour le supprimer, les référents concernés doivent d'abord le décocher ; ou désactivez-le : il disparaît des écrans sans toucher aux fiches existantes.</p>
            {data.ecoles.map((e) => (
              <section key={e.ecoleId} className="border border-[color:var(--border)] rounded p-3 space-y-2">
                <h3 className="font-semibold">{e.ecole}</h3>
                <p className="text-sm text-[color:var(--text2)]">
                  À contacter : {e.referents.length ? e.referents.join(', ') : 'aucun référent ni direction rattaché à cette implantation'}
                </p>
                {e.classes.map((c) => (
                  <div key={`${c.annee}|${c.classe}`} className="text-base">
                    <p className="font-medium">Classe {c.classe} <span className="text-[color:var(--text3)] font-normal">({c.annee})</span></p>
                    {c.au.length > 0 && (
                      <p className="text-sm">AU pour toute la classe : {c.au.join(' · ')}</p>
                    )}
                    {c.eleves.length > 0 && (
                      <ul className="list-disc pl-6 text-sm">
                        {c.eleves.map((el) => (
                          <li key={el.nom}>{el.nom}{cible.type === 'chapitre' || el.libelles.length > 1 ? <span className="text-[color:var(--text3)]"> : {el.libelles.join(' · ')}</span> : null}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const AIDE_NE_PAS_TRANSMETTRE = "Par défaut, un aménagement est transmis aux autres apps PLAI qui reçoivent le profil d'une classe. Cochez pour que celui-ci ne soit pas envoyé ; il reste visible dans la fiche AménagActif. Exemple : « Rédiger le cours en braille » révèle une déficience visuelle ; cochez pour ne pas l'envoyer aux autres apps. Dans l'écran « Transmission aux autres apps », cette même exception apparaît comme « Non transmis ».";

function AjoutAmenagement({ chapitreId, estDispositif = false, onAdd }) {
  const [libelle, setLibelle] = useState('');
  const [type, setType] = useState('AR');
  const [nePasTransmettre, setNePasTransmettre] = useState(false);
  const idp = `ajout-${chapitreId}`;
  return (
    <form className="border border-dashed border-teal rounded p-2 space-y-2 text-base"
      onSubmit={(e) => { e.preventDefault(); if (libelle.trim()) { onAdd({ chapitreId, libelle, type, partageProfil: !nePasTransmettre }); setLibelle(''); setType('AR'); setNePasTransmettre(false); } }}>
      <label htmlFor={`${idp}-libelle`} className="block font-medium">Nouvel aménagement pour ce chapitre</label>
      <textarea id={`${idp}-libelle`} className="plai-input w-full" style={{ fontSize: 16 }} rows={2}
        placeholder="Ex. : Rédiger le cours en Arial 14"
        aria-describedby={`${idp}-libelle-aide`}
        value={libelle} onChange={(e) => setLibelle(e.target.value)} />
      <p id={`${idp}-libelle-aide`} className="text-base text-[color:var(--text2)]">
        Ce texte s'affiche tel quel sur les fiches et dans les autres apps. Son code est généré automatiquement et ne changera plus, même si vous reformulez le libellé.
      </p>
      {estDispositif ? (
        <p className="text-base text-[color:var(--text2)]">Type : <strong>selon la classe</strong> (AR par élève, ou AU si le dispositif est passé à toute la classe pour une classe donnée).</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={`${idp}-type`} className="flex items-center gap-2">
            Type
            <select id={`${idp}-type`} className="plai-input !w-auto !py-1" style={{ fontSize: 16 }} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="AU">AU — universel</option>
              <option value="AR">AR — raisonnable</option>
            </select>
          </label>
        </div>
      )}
      <div>
        <label htmlFor={`${idp}-np`} className="flex items-center gap-2 font-medium">
          <input id={`${idp}-np`} type="checkbox" className="w-5 h-5" checked={nePasTransmettre}
            aria-describedby={`${idp}-np-aide`} onChange={(e) => setNePasTransmettre(e.target.checked)} />
          Ne pas transmettre aux autres apps
        </label>
        <p id={`${idp}-np-aide`} className="text-base text-[color:var(--text2)] mt-1">{AIDE_NE_PAS_TRANSMETTRE}</p>
      </div>
      <button className="plai-btn" style={{ fontSize: 16 }} type="submit" disabled={!libelle.trim()}>Ajouter</button>
    </form>
  );
}

function AjoutChapitre({ onAdd }) {
  const [titre, setTitre] = useState('');
  const [estDispositif, setEstDispositif] = useState(false);
  return (
    <form className="border border-dashed border-teal rounded p-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => { e.preventDefault(); if (titre.trim()) { onAdd({ titre, estDispositif }); setTitre(''); setEstDispositif(false); } }}>
      <label className="text-sm flex-1 min-w-[12rem]">Nouveau chapitre
        <input className="plai-input block w-full" placeholder="Ex. : Dispositif de régulation des comportements"
          value={titre} onChange={(e) => setTitre(e.target.value)} />
        <span className="block text-xs text-[color:var(--text3)] font-normal">
          Ajouté à la fin de la liste (13e chapitre, 14e…). Une fois créé, dépliez-le ci-dessus pour y ajouter des aménagements.
        </span>
      </label>
      <label className="text-sm flex items-start gap-2 w-full">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={estDispositif} onChange={(e) => setEstDispositif(e.target.checked)} />
        <span>
          Ce chapitre est un <strong>dispositif</strong>
          <span className="block text-base text-[color:var(--text3)] font-normal">
            Ses aménagements sont des AR (par élève) par défaut ; pour chaque classe, une case permet de les passer en AU (toute la classe). Non modifiable après la création.
          </span>
        </span>
      </label>
      <button className="plai-btn" type="submit" disabled={!titre.trim()}>Ajouter le chapitre</button>
    </form>
  );
}
