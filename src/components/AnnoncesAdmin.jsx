import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAnnonces, useEnvoyerAnnonce } from '../hooks/useAnnonces.js';
import { MODELES_ANNONCES } from '../domain/modelesAnnonces.js';
import { texteVersHtml, appliquerGras, appliquerTitre, appliquerPuce, insererLien } from '../domain/texteMessage.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';
const ROLES = [
  ['admin', 'Administrateurs'],
  ['referent_plai', 'Référents PLAI'],
  ['direction', 'Directions'],
  ['agent_plai', 'Agents accompagnants'],
];
const MAX_SUJET = 120;
const MAX_CORPS = 5000;
const dateFR = (iso) => new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Messages aux utilisateurs (administrateur) : « Nouveautés », points d'attention.
 * Texte simple : le serveur le met en forme et l'envoie par e-mail, un message par personne.
 */
export default function AnnoncesAdmin() {
  const id = useId();
  const { data, isLoading, error } = useAnnonces();
  const envoi = useEnvoyerAnnonce();
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [roles, setRoles] = useState(new Set(ROLES.map(([r]) => r)));
  const zone = useRef(null);
  const selectionSuivante = useRef(null);
  const [retour, setRetour] = useState(null); // { type: 'ok'|'erreur', texte, detail?, sansAdresse? }

  const effectifs = data?.effectifs ?? {};
  const nbCibles = ROLES.filter(([r]) => roles.has(r)).reduce((n, [r]) => n + (effectifs[r] ?? 0), 0);
  const complet = sujet.trim().length > 0 && corps.trim().length > 0 && roles.size > 0;

  // Bouton de mise en forme : transforme le texte autour de la sélection, puis rend le curseur à la zone de saisie.
  function appliquer(fn) {
    const el = zone.current;
    const r = fn(corps, el?.selectionStart ?? corps.length, el?.selectionEnd ?? corps.length);
    if (r.texte.length > MAX_CORPS) return;
    selectionSuivante.current = r;
    setCorps(r.texte);
    setRetour(null);
  }
  useLayoutEffect(() => {
    const r = selectionSuivante.current;
    if (r && zone.current) {
      zone.current.focus();
      zone.current.setSelectionRange(r.debut, r.fin);
      selectionSuivante.current = null;
    }
  }, [corps]);
  const apercu = useMemo(() => texteVersHtml(corps), [corps]);

  const basculer = (r) => setRoles((prev) => { const s = new Set(prev); if (s.has(r)) s.delete(r); else s.add(r); return s; });

  async function lancer(action) {
    setRetour(null);
    if (action === 'envoyer' && !confirm(`Envoyer ce message à ${nbCibles} compte${nbCibles > 1 ? 's' : ''} (au plus : une adresse partagée compte une fois) ? L'envoi ne peut pas être annulé.`)) return;
    try {
      const r = await envoi.mutateAsync({ action, sujet, corps, roles: [...roles] });
      setRetour({
        type: r.echecs > 0 ? 'erreur' : 'ok',
        detail: action === 'test' ? r.detail : undefined,
        sansAdresse: action === 'test' ? r.sansAdresse : undefined,
        texte: action === 'test'
          ? `Exemplaire de test envoyé à ${r.envoyes} administrateur${r.envoyes > 1 ? 's' : ''}${r.echecs ? ` (${r.echecs} échec${r.echecs > 1 ? 's' : ''})` : ''}. Vérifiez votre boîte de réception, puis les indésirables.`
          : `Message envoyé à ${r.envoyes} personne${r.envoyes > 1 ? 's' : ''}${r.echecs ? `, ${r.echecs} échec${r.echecs > 1 ? 's' : ''} : ces personnes n'ont pas reçu le message` : ''}.`,
      });
    } catch (e) {
      setRetour({ type: 'erreur', texte: e.message });
    }
  }

  return (
    <section className="space-y-3" aria-labelledby={`${id}-titre`}>
      <h2 id={`${id}-titre`} className="font-semibold">Messages aux utilisateurs</h2>
      <p className="text-[color:var(--text2)]" style={{ fontSize: 16 }}>
        Pour annoncer une nouveauté ou un point d'attention aux personnes qui ont un compte. Chaque personne reçoit son propre e-mail, sans voir les autres destinataires.
        Les enseignants n'ont pas de compte : ils ne reçoivent rien.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-modele`} className="font-medium" style={{ fontSize: 16 }}>Partir d'un modèle</label>
        <select
          id={`${id}-modele`} className="plai-input" style={{ fontSize: 16 }} value=""
          onChange={(e) => {
            const m = MODELES_ANNONCES.find((x) => x.id === e.target.value);
            if (m) { setSujet(m.sujet); setCorps(m.corps); setRetour(null); }
          }}
        >
          <option value="">Choisir…</option>
          {MODELES_ANNONCES.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-sujet`} className="block font-medium" style={{ fontSize: 16 }}>Objet de l'e-mail</label>
        <input
          id={`${id}-sujet`} className="plai-input w-full" style={{ fontSize: 16 }} value={sujet} maxLength={MAX_SUJET}
          onChange={(e) => setSujet(e.target.value)} aria-describedby={`${id}-sujet-aide`}
          placeholder="AménagActif : trois nouveautés"
        />
        <p id={`${id}-sujet-aide`} className="mt-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>
          Ce que la personne lit avant d'ouvrir le message. Court et précis ; « Nouveautés » ou « Point d'attention » en début aide à trier.
        </p>
      </div>

      {/* Saisie à gauche, aperçu à droite dès 1024 px ; l'un sous l'autre sur écran étroit. */}
      <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div>
        <label htmlFor={`${id}-corps`} className="block font-medium" style={{ fontSize: 16 }}>Message</label>
        <div role="toolbar" aria-label="Mise en forme du message" aria-controls={`${id}-corps`} className="flex flex-wrap gap-2 my-1">
          {[
            ['Gras', 'Mettre la sélection en gras', appliquerGras, { fontWeight: 700 }],
            ['Titre', 'Faire de la ligne un intertitre', appliquerTitre, {}],
            ['Puce', 'Transformer les lignes en puces', appliquerPuce, {}],
            ['Lien', 'Insérer une adresse https://', insererLien, {}],
          ].map(([nom, aide, fn, style]) => (
            <button key={nom} type="button" title={aide} aria-label={aide} className={`plai-btn-ghost px-3 py-1 border rounded ${FOCUS}`} style={{ fontSize: 16, ...style }} onClick={() => appliquer(fn)}>
              {nom}
            </button>
          ))}
        </div>
        <textarea
          ref={zone} id={`${id}-corps`} className="plai-input w-full" style={{ fontSize: 16, minHeight: 280 }} value={corps} maxLength={MAX_CORPS}
          onChange={(e) => setCorps(e.target.value)} aria-describedby={`${id}-corps-aide`}
          placeholder={'Bonjour,\n\n## Ce qui change\n\n- Première information\n- Deuxième information\n\nUne question : jeanfrancois.beguin@ens.ecl.be'}
        />
        <p id={`${id}-corps-aide`} className="mt-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>
          Écrivez simplement : une ligne vide sépare les paragraphes. Pour une mise en forme, sélectionnez du texte puis cliquez sur Gras, Titre, Puce ou Lien ;
          l'aperçu à côté (ou en dessous sur un écran étroit) montre le résultat tel qu'il sera lu. Une adresse commençant par https:// devient cliquable d'elle-même.
          Ajoutez ce que vous seul savez (une école, une date, une consigne) : un message générique est ignoré. {corps.length}/{MAX_CORPS} caractères.
        </p>
      </div>

      <div className="lg:sticky lg:top-4">
        <h3 className="font-medium" style={{ fontSize: 16 }}>Aperçu (tel que l'e-mail sera lu)</h3>
        {corps.trim() === ''
          ? <p className="plai-empty" style={{ fontSize: 16 }}>L'aperçu apparaît ici dès que vous écrivez.</p>
          : (
            <div
              data-testid="apercu-annonce"
              className="border border-[color:var(--border)] rounded p-3 bg-white overflow-auto lg:max-h-[70vh]"
              style={{ fontSize: 16, lineHeight: 1.5, fontFamily: 'Arial, Helvetica, sans-serif' }}
              // Sûr : texteVersHtml échappe tout le texte saisi avant de produire ses propres balises.
              dangerouslySetInnerHTML={{ __html: apercu }}
            />
          )}
      </div>
      </div>

      <fieldset>
        <legend className="font-medium" style={{ fontSize: 16 }}>Destinataires</legend>
        <p className="mb-1 text-[color:var(--text2)]" style={{ fontSize: 16 }}>
          Décochez un type de compte pour ne pas lui écrire (ex. un point d'attention qui ne concerne que les agents accompagnants).
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {ROLES.map(([r, libelle]) => (
            <li key={r} className="flex items-center gap-2" style={{ fontSize: 16 }}>
              <input id={`${id}-${r}`} type="checkbox" className="w-5 h-5" checked={roles.has(r)} onChange={() => basculer(r)} />
              <label htmlFor={`${id}-${r}`}>{libelle} ({effectifs[r] ?? 0})</label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={`plai-btn-ghost px-4 py-2 border rounded ${FOCUS}`} style={{ fontSize: 16 }} disabled={!complet || envoi.isPending} onClick={() => lancer('test')}>
          Envoyer un exemplaire de test aux administrateurs
        </button>
        <button type="button" className={`plai-btn ${FOCUS}`} style={{ fontSize: 16 }} disabled={!complet || envoi.isPending || nbCibles === 0} onClick={() => lancer('envoyer')}>
          {envoi.isPending ? 'Envoi en cours…' : `Envoyer à ${nbCibles} compte${nbCibles > 1 ? 's' : ''}`}
        </button>
      </div>
      <p className="text-[color:var(--text2)]" style={{ fontSize: 16 }}>
        Envoyez toujours d'abord l'exemplaire de test, relisez-le dans votre boîte, puis lancez l'envoi réel. Le même message n'est pas renvoyé deux fois en 10 minutes.
      </p>
      <div role="status" aria-live="polite">
        {retour && <p className={retour.type === 'ok' ? 'plai-success' : 'plai-error'} style={{ fontSize: 16 }}>{retour.texte}</p>}
        {retour?.detail && (
          <div style={{ fontSize: 16 }}>
            <p className="font-medium">Administrateurs visés par le test :</p>
            <ul className="list-disc pl-5">
              {retour.detail.map((d) => (
                <li key={d.adresse}>{d.adresse} : {d.ok ? 'accepté par Brevo (à vérifier dans la boîte de réception et les indésirables)' : 'refusé, non envoyé'}</li>
              ))}
            </ul>
            {retour.sansAdresse > 0 && (
              <p className="plai-error">{retour.sansAdresse} compte{retour.sansAdresse > 1 ? 's' : ''} administrateur{retour.sansAdresse > 1 ? 's' : ''} sans adresse lisible : non joint{retour.sansAdresse > 1 ? 's' : ''}.</p>
            )}
            <p className="text-[color:var(--text2)]">« Accepté » signifie que Brevo a pris le message en charge ; la remise dans la boîte de la personne se vérifie dans Brevo, Transactional, Logs. Un administrateur absent de cette liste n'est pas dans Membres avec le rôle Administrateur, ou partage l'adresse d'un autre.</p>
          </div>
        )}
      </div>

      <h3 className="font-medium">Messages déjà envoyés</h3>
      {isLoading && <p style={{ fontSize: 16 }}>Chargement…</p>}
      {error && <p role="alert" className="plai-error" style={{ fontSize: 16 }}>Impossible de charger l'historique : {error.message}</p>}
      {data && data.annonces.length === 0 && <p className="plai-empty">Aucun message envoyé pour l'instant.</p>}
      {data && data.annonces.length > 0 && (
        <ul className="space-y-1" style={{ fontSize: 16 }}>
          {data.annonces.map((a) => (
            <li key={a.id}>
              <strong>{a.sujet}</strong> — {dateFR(a.envoye_le)} — {a.nb_destinataires} destinataire{a.nb_destinataires > 1 ? 's' : ''}
              {a.nb_echecs > 0 ? `, ${a.nb_echecs} échec${a.nb_echecs > 1 ? 's' : ''}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
