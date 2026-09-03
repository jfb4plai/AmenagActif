import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { session, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (ready && session) return <Navigate to="/" replace />;

  async function soumettre(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
    setEnvoi(false);
    if (error) setErreur("Connexion impossible. Vérifiez l'adresse et le mot de passe.");
  }

  return (
    <div className="plai-section max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Connexion — AménagActif</h1>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-medium">Adresse e-mail</label>
          <input id="email" type="email" required className="plai-input w-full"
            placeholder="prenom.nom@ecole.be" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <p className="text-sm text-[color:var(--text3)]">Votre adresse professionnelle. Le compte est créé par l'équipe PLAI.</p>
        </div>
        <div>
          <label htmlFor="mdp" className="block font-medium">Mot de passe</label>
          <input id="mdp" type="password" required className="plai-input w-full"
            value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </div>
        {erreur && <p className="plai-error">{erreur}</p>}
        <button type="submit" className="plai-btn" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
