import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import ChampMotDePasse from '../components/ChampMotDePasse.jsx';

/**
 * Cible des liens d'invitation et de « mot de passe oublié ».
 * Supabase traite le jeton présent dans l'URL au chargement et ouvre une
 * session de récupération ; il ne reste qu'à définir le mot de passe.
 */
export default function NouveauMotDePasse() {
  const [email, setEmail] = useState(null);
  const [statut, setStatut] = useState('chargement'); // chargement | pret | invalide | fait
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [emailSecours, setEmailSecours] = useState('');
  const [secoursInfo, setSecoursInfo] = useState(null);
  const [secoursEnvoi, setSecoursEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    const prendre = (session) => {
      if (!vivant || !session?.user) return;
      setEmail(session.user.email);
      setStatut('pret');
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => prendre(session));
    supabase.auth.getSession().then(({ data }) => prendre(data.session));
    const t = setTimeout(() => {
      if (vivant) setStatut((s) => (s === 'chargement' ? 'invalide' : s));
    }, 5000);
    return () => { vivant = false; sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    if (mdp.length < 8) { setErreur('8 caractères minimum.'); return; }
    if (mdp !== mdp2) { setErreur('Les deux mots de passe diffèrent.'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: mdp });
      if (error) throw error;
      setStatut('fait');
    } catch {
      setErreur("Lien expiré ou invalide. Redemandez un lien depuis la page de connexion.");
    } finally {
      setEnvoi(false);
    }
  }

  if (statut === 'chargement') {
    return <div className="plai-section max-w-md mx-auto">Vérification du lien…</div>;
  }

  if (statut === 'invalide') {
    async function renvoyer(e) {
      e.preventDefault();
      setSecoursInfo(null);
      if (!emailSecours.trim()) return;
      setSecoursEnvoi(true);
      const { error } = await supabase.auth.resetPasswordForEmail(emailSecours.trim(), {
        redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
      });
      setSecoursEnvoi(false);
      if (error) setSecoursInfo("Envoi impossible, réessayez plus tard.");
      else setSecoursInfo("Si un compte existe pour cette adresse, un nouveau lien vient d'être envoyé — pensez aux indésirables.");
    }

    return (
      <div className="plai-section max-w-md mx-auto space-y-4">
        <div>
          <p className="plai-error">Ce lien a expiré (il n'est valable que 24 heures) ou a déjà été utilisé.</p>
          <p className="text-sm text-[color:var(--text3)] mt-1">
            Rien n'est perdu : indiquez ci-dessous l'adresse e-mail exacte sur laquelle vous avez été invité·e, pour recevoir un nouveau lien.
          </p>
        </div>
        <form onSubmit={renvoyer} className="space-y-2">
          <label htmlFor="email-secours" className="block font-medium text-sm">Adresse e-mail</label>
          <input id="email-secours" type="email" required className="plai-input w-full"
            placeholder="prenom.nom@ecole.be" value={emailSecours} onChange={(e) => setEmailSecours(e.target.value)} />
          <button type="submit" className="plai-btn" disabled={secoursEnvoi}>{secoursEnvoi ? 'Envoi…' : 'Recevoir un nouveau lien'}</button>
          {secoursInfo && <p className="plai-success text-sm">{secoursInfo}</p>}
        </form>
        <p className="text-sm text-[color:var(--text3)]">
          Toujours bloqué·e ? Contactez l'administrateur PLAI qui a créé votre compte — il peut vérifier l'adresse exacte utilisée pour l'invitation.
        </p>
        <Link to="/connexion" className="text-sm underline text-teal inline-block">Retour à la connexion</Link>
      </div>
    );
  }

  if (statut === 'fait') {
    return (
      <div className="plai-section max-w-md mx-auto">
        <p className="plai-success">Mot de passe défini pour {email}.</p>
        <Link to="/connexion" className="plai-btn inline-block mt-3">Se connecter</Link>
      </div>
    );
  }

  return (
    <div className="plai-section max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-1">Définir un mot de passe</h1>
      <p className="text-sm text-[color:var(--text3)] mb-4">Compte : <strong>{email}</strong></p>
      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label htmlFor="mdp" className="block font-medium">Nouveau mot de passe</label>
          <ChampMotDePasse id="mdp" required minLength={8} autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} />
          <p className="text-sm text-[color:var(--text3)]">8 caractères minimum.</p>
        </div>
        <div>
          <label htmlFor="mdp2" className="block font-medium">Confirmer</label>
          <ChampMotDePasse id="mdp2" required autoComplete="new-password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} />
        </div>
        {erreur && <p className="plai-error">{erreur}</p>}
        <button type="submit" className="plai-btn" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
    </div>
  );
}
