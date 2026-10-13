/**
 * Traduit l'erreur Supabase de updateUser({ password }) en message utilisateur.
 * versConnexion : afficher un bouton vers la page de connexion.
 * @param {{ code?: string, name?: string } | null | undefined} err
 * @returns {{ message: string, versConnexion: boolean }}
 */
export function messageErreurMotDePasse(err) {
  const code = err?.code;
  if (code === 'same_password') {
    return {
      message: "Ce mot de passe est déjà le vôtre : votre compte est activé. Connectez-vous directement depuis la page de connexion.",
      versConnexion: true,
    };
  }
  if (code === 'weak_password') {
    return { message: 'Mot de passe trop faible. Choisissez-en un plus long ou moins courant.', versConnexion: false };
  }
  if (code === 'session_not_found' || code === 'session_expired' || err?.name === 'AuthSessionMissingError') {
    return {
      message: "Session perdue ou lien expiré. Redemandez un lien depuis la page de connexion (« Mot de passe oublié ? ») et ouvrez-le dans Safari ou Chrome plutôt que dans l'application de messagerie.",
      versConnexion: true,
    };
  }
  return {
    message: "Enregistrement impossible. Réessayez ; si le problème persiste, redemandez un lien depuis la page de connexion.",
    versConnexion: true,
  };
}
