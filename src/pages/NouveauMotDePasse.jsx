import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

/**
 * Cible des liens d'invitation et de « mot de passe oublié ».
 * Supabase établit une session de récupération depuis l'URL au chargement ;
 * il ne reste qu'à définir le nouveau mot de passe.
 */
export default function NouveauMotDePasse() {
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    if (mdp.length < 8) { setErreur('8 caractères minimum.'); return; }
    if (mdp !== mdp2) { setErreur('Les deux mots de passe diffèrent.'); return; }
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setEnvoi(false);
    if (error) setErreur("Lien expiré ou invalide. Redemandez un lien depuis la page de connexion.");
    else setFait(true);
  }

  if (fait) {
    return (
      <div className="plai-section max-w-md mx-auto">
        <p className="plai-success">Mot de passe défini.</p>
        <Link to="/connexion" className="plai-btn inline-block mt-3">Se connecter</Link>
      </div>
    );
  }

  return (
    <div className="plai-section max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Définir un mot de passe</h1>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label htmlFor="mdp" className="block font-medium">Nouveau mot de passe</label>
          <input id="mdp" type="password" required minLength={8} className="plai-input w-full"
            value={mdp} onChange={(e) => setMdp(e.target.value)} />
          <p className="text-sm text-[color:var(--text3)]">8 caractères minimum.</p>
        </div>
        <div>
          <label htmlFor="mdp2" className="block font-medium">Confirmer</label>
          <input id="mdp2" type="password" required className="plai-input w-full"
            value={mdp2} onChange={(e) => setMdp2(e.target.value)} />
        </div>
        {erreur && <p className="plai-error">{erreur}</p>}
        <button type="submit" className="plai-btn" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </div>
  );
}
