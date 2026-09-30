import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLiens, useRevoquerLien } from '../hooks/useLiens.js';
import { filtrerLiens, grouperParEcole, titreEcole, dateFR, LIBELLE_STATUT, JOURS_INACTIF_DEFAUT } from '../domain/liens.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';

/** Boîte de dialogue accessible (élément natif <dialog> : focus piégé, Échap, retour du focus). */
function DialogueRevocation({ lien, enCours, erreur, onConfirmer, onAnnuler }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && typeof d.showModal === 'function' && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!enCours) onAnnuler(); }}
      aria-labelledby="dlg-titre"
      aria-describedby="dlg-desc"
      className="rounded border border-[color:var(--border)] p-5 max-w-lg text-base"
    >
      <h2 id="dlg-titre" className="text-lg font-semibold mb-2">Révoquer ce lien ?</h2>
      <p id="dlg-desc" className="mb-2">
        Destinataire : <strong>{lien.destinataire}</strong> ({lien.classes.join(', ') || 'classes'}).
      </p>
      <p className="mb-4">
        L'enseignant ne pourra plus ouvrir la fiche et les accès de profil déjà émis depuis ce lien seront coupés. Cette action est définitive :
        pour rétablir l'accès, il faudra générer un nouveau lien.
      </p>
      {erreur && <p role="alert" className="plai-error mb-3" style={{ fontSize: 16 }}>{erreur}</p>}
      <div className="flex gap-3 justify-end">
        <button type="button" autoFocus className={`plai-btn-ghost px-4 py-2 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={onAnnuler} disabled={enCours}>Annuler</button>
        <button type="button" className={`plai-btn ${FOCUS}`} style={{ fontSize: 16 }} onClick={onConfirmer} disabled={enCours}>
          {enCours ? 'Révocation…' : 'Révoquer le lien'}
        </button>
      </div>
    </dialog>
  );
}

function TableLiens({ liens, onRevoquer, titre }) {
  // Infos d'usage (ouvertures) : masquées par défaut, affichées ligne par ligne sur demande.
  const [ouverts, setOuverts] = useState(() => new Set());
  const basculer = (id) => setOuverts((prev) => {
    const suivant = new Set(prev);
    if (suivant.has(id)) suivant.delete(id); else suivant.add(id);
    return suivant;
  });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-base">
        <caption className="sr-only">Liens enseignants : {titre}</caption>
        <thead>
          <tr className="border-b border-[color:var(--border)]">
            <th scope="col" className="py-2 pr-3">Destinataire</th>
            <th scope="col" className="py-2 pr-3">Classes</th>
            <th scope="col" className="py-2 pr-3">Créé le</th>
            <th scope="col" className="py-2 pr-3">Expire le</th>
            <th scope="col" className="py-2 pr-3">Statut</th>
            <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {liens.map((l) => {
            const ouvert = ouverts.has(l.id);
            const detailId = `detail-${l.id}`;
            return (
              <Fragment key={l.id}>
                <tr className="border-b border-[color:var(--border)] align-top">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {l.destinataire}
                    {l.cree_par && <span className="block font-normal text-[color:var(--text2)]">créé par {l.cree_par}</span>}
                  </th>
                  <td className="py-2 pr-3">{l.classes.join(', ') || 'Non disponible'}</td>
                  <td className="py-2 pr-3">{dateFR(l.cree_le)}</td>
                  <td className="py-2 pr-3">{dateFR(l.expire_le)}</td>
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{LIBELLE_STATUT[l.statut]}</span>
                    {l.statut === 'revoque' && l.revoque_le && <span className="block">le {dateFR(l.revoque_le)}</span>}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button" aria-expanded={ouvert} aria-controls={ouvert ? detailId : undefined}
                        className={`plai-btn-ghost px-3 py-1 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={() => basculer(l.id)}
                      >
                        Détails<span className="sr-only"> du lien de {l.destinataire}</span>
                      </button>
                      {l.statut !== 'revoque' && (
                        <button type="button" className={`plai-btn-ghost px-3 py-1 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={() => onRevoquer(l)}>
                          Révoquer<span className="sr-only"> le lien de {l.destinataire}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {ouvert && (
                  <tr id={detailId} className="border-b border-[color:var(--border)]">
                    <td colSpan={6} className="pb-3 pr-3 text-[color:var(--text2)]">
                      <p>
                        Dernière ouverture : <strong>{l.derniere_ouverture ? dateFR(l.derniere_ouverture) : 'jamais ouvert'}</strong>
                        {' · '}Ouvertures : <strong>{l.nb_ouvertures}</strong>
                      </p>
                      <p>
                        Repère pour dépanner (par exemple « je n'arrive pas à ouvrir mon lien »), pas un outil de contrôle. Au plus une ouverture est comptée par heure et par lien.
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LiensEnseignants() {
  const { data, isLoading, error } = useLiens();
  const revoquer = useRevoquerLien();
  const [statut, setStatut] = useState('actif'); // expirés et révoqués masqués par défaut
  const [inactifActif, setInactifActif] = useState(false);
  const [joursTxt, setJoursTxt] = useState(String(JOURS_INACTIF_DEFAUT));
  const jours = Number.parseInt(joursTxt, 10);
  const [aRevoquer, setARevoquer] = useState(null);
  const [relanceOuverte, setRelanceOuverte] = useState(false);

  const sections = useMemo(() => {
    if (!data) return [];
    const filtres = filtrerLiens(data.liens, { statut, inactifJours: inactifActif && Number.isFinite(jours) ? jours : null });
    return grouperParEcole(filtres, data.ecoles);
  }, [data, statut, inactifActif, jours]);

  // Le repérage des liens non ouverts est masqué par défaut ; le refermer désactive le filtre.
  function basculerRelance() {
    if (relanceOuverte) setInactifActif(false);
    setRelanceOuverte(!relanceOuverte);
  }

  async function confirmer() {
    try {
      await revoquer.mutateAsync(aRevoquer.id);
      setARevoquer(null);
    } catch {
      // l'erreur reste affichée dans la boîte de dialogue (revoquer.error)
    }
  }

  return (
    <div className="plai-section space-y-5 max-w-6xl px-4 text-base">
      <h1 className="text-xl font-semibold">Liens enseignants</h1>

      <div className="plai-card p-4 space-y-2">
        <p>
          Un lien donne accès à la fiche vivante d'une ou plusieurs classes, sans compte. Il prend fin de deux façons, la première atteinte l'emporte :
          <strong> à la fin de l'année scolaire</strong> de la classe (expiration automatique) ou <strong>par révocation</strong> de votre part (immédiate).
        </p>
        <p>
          Révoquer un lien coupe aussi l'accès des profils de classe déjà transmis à d'autres outils depuis ce lien. Les révocations servent aux cas exceptionnels en cours d'année (enseignant qui part, lien égaré).
        </p>
        <p>
          Seuls les liens actifs sont affichés par défaut. Les liens expirés ou révoqués restent consultables avec le filtre « Statut », puis sont supprimés définitivement à partir du 1er septembre qui suit la fin de l'année scolaire.
        </p>
        <p>
          <strong>Conseil pour la colonne « Destinataire » :</strong> évitez le nom complet de l'enseignant (données personnelles, RGPD). Préférez un repère sans équivoque mais sans nom complet : initiale du prénom, matière, classe et implantation (ex. « A., français 5PA, Pitteurs »).
        </p>
        <p>
          <strong>Un lien, un seul enseignant :</strong> la classe reste l'unité de tri d'un lien (un lien par classe, y compris pour un enseignant qui en a plusieurs). Mais s'il y a plusieurs enseignants sur une même classe, ne partagez jamais le même lien entre eux : générez-en un distinct pour chacun.
        </p>
      </div>

      <fieldset className="flex flex-wrap items-end gap-6">
        <legend className="sr-only">Filtres</legend>
        <div>
          <label htmlFor="filtre-statut" className="block font-medium">Statut</label>
          <select id="filtre-statut" className="plai-input" style={{ fontSize: 16 }} value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="actif">Actifs</option>
            <option value="expire">Expirés</option>
            <option value="revoque">Révoqués</option>
            <option value="tous">Tous</option>
          </select>
        </div>
        <button
          type="button" aria-expanded={relanceOuverte} aria-controls={relanceOuverte ? 'panneau-relance' : undefined}
          className={`plai-btn-ghost px-3 py-2 border rounded ${FOCUS}`} style={{ fontSize: 16 }} onClick={basculerRelance}
        >
          Relancer : repérer les liens non ouverts
        </button>
      </fieldset>

      {relanceOuverte && (
        <div id="panneau-relance" className="plai-card p-4 space-y-3">
          <p>
            Pour relancer, dans l'intérêt des élèves, un enseignant qui n'aurait pas encore ouvert son lien. Ce n'est pas un outil de contrôle.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <input id="filtre-inactif" type="checkbox" className="w-5 h-5" checked={inactifActif} onChange={(e) => setInactifActif(e.target.checked)} />
              <label htmlFor="filtre-inactif" className="font-medium">Inactifs depuis plus de</label>
            </div>
            <div>
              <label htmlFor="filtre-jours" className="sr-only">Nombre de jours d'inactivité</label>
              <input
                id="filtre-jours" type="number" min={1} max={730} className="plai-input" style={{ width: 90, fontSize: 16 }}
                value={joursTxt} disabled={!inactifActif}
                onChange={(e) => setJoursTxt(e.target.value)}
              />
            </div>
            <span>jours (dernière ouverture, à défaut date de création)</span>
          </div>
        </div>
      )}

      {isLoading && <p>Chargement…</p>}
      {error && <p role="alert" className="plai-error" style={{ fontSize: 16 }}>Impossible de charger les liens : {error.message}</p>}

      {data && sections.length === 0 && <p className="plai-empty">Aucune implantation accessible.</p>}
      {sections.map(({ ecole, liens }) => (
        <details key={ecole.id} open className="border border-[color:var(--border)] rounded">
          <summary className={`cursor-pointer px-4 py-3 font-semibold ${FOCUS}`}>
            {titreEcole(ecole)} <span className="font-normal">({liens.length} {liens.length > 1 ? 'liens' : 'lien'})</span>
          </summary>
          <div className="px-4 pb-4">
            {liens.length === 0
              ? <p className="plai-empty">Aucun lien ne correspond aux filtres.</p>
              : <TableLiens liens={liens} titre={titreEcole(ecole)} onRevoquer={(l) => { revoquer.reset(); setARevoquer(l); }} />}
          </div>
        </details>
      ))}

      {aRevoquer && (
        <DialogueRevocation
          lien={aRevoquer}
          enCours={revoquer.isPending}
          erreur={revoquer.error?.message}
          onConfirmer={confirmer}
          onAnnuler={() => setARevoquer(null)}
        />
      )}
    </div>
  );
}
