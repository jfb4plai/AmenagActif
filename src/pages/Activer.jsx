import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

/**
 * Cible du courriel d'invitation. Le jeton (7 jours) est échangé, au clic, contre un lien Supabase neuf.
 * Un bouton plutôt qu'une redirection automatique : un scanner de courriels qui précharge la page
 * ne doit pas consommer le lien.
 */
export default function Activer() {
  const [params] = useSearchParams();
  const t = params.get('t');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [dejaActive, setDejaActive] = useState(false);

  async function activer() {
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await fetch('/api/activer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.code === 'deja_active') { setDejaActive(true); setEnvoi(false); return; }
      if (!r.ok || !j.url) { setErreur(j.error || 'Activation impossible, réessayez.'); setEnvoi(false); return; }
      window.location.assign(j.url);
    } catch {
      setErreur('Connexion impossible, réessayez.');
      setEnvoi(false);
    }
  }

  if (!t) {
    return (
      <div className="plai-section max-w-md mx-auto space-y-3">
        <p className="plai-error">Lien incomplet. Rouvrez le lien depuis votre courriel d'invitation.</p>
        <Link to="/connexion" className="text-sm underline text-teal">Retour à la connexion</Link>
      </div>
    );
  }

  if (dejaActive) {
    return (
      <div className="plai-section max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Votre compte est déjà activé</h1>
        <p>Ce lien d'invitation a déjà servi à créer votre mot de passe. Il ne fonctionne qu'une fois.</p>
        <p>Connectez-vous désormais avec votre adresse e-mail et votre mot de passe.</p>
        <Link to="/connexion" className="plai-btn inline-block">Aller à la page de connexion</Link>
        <p className="text-sm text-[color:var(--text3)]">
          Mot de passe oublié ? Sur la page de connexion, entrez votre adresse e-mail puis cliquez « Mot de passe oublié ? ».
        </p>
      </div>
    );
  }

  return (
    <div className="plai-section max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Activer mon compte AménagActif</h1>
      <p className="text-sm text-[color:var(--text3)]">
        Vous avez été invité·e par le Pôle Territorial de la Ville de Liège (PLAI). Cliquez ci-dessous pour définir votre mot de passe.
      </p>
      <button className="plai-btn" onClick={activer} disabled={envoi}>{envoi ? 'Ouverture…' : 'Définir mon mot de passe'}</button>
      {erreur && (
        <div className="space-y-2">
          <p className="plai-error">{erreur}</p>
          <p className="text-sm text-[color:var(--text3)]">
            Si le lien a expiré, <Link to="/nouveau-mot-de-passe" className="underline text-teal">demandez-en un nouveau ici</Link> avec l'adresse e-mail de l'invitation.
          </p>
        </div>
      )}
    </div>
  );
}
