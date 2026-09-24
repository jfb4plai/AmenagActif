/**
 * Identifie l'utilisateur connecté depuis l'en-tête Authorization.
 * Panne de l'auth (réseau, 5xx) : 500, jamais 401 (un 401 ferait croire à une session expirée).
 * @returns {Promise<{ user: object } | { statut: number, erreur: string }>}
 */
export async function authentifier(db, req, contexte) {
  const jwt = (req.headers?.authorization || '').replace('Bearer ', '');
  const { data, error } = await db.auth.getUser(jwt);
  if (error && (error.status === undefined || error.status === 0 || error.status >= 500)) {
    console.error(`${contexte} : auth indisponible`, error.name ?? '');
    return { statut: 500, erreur: 'Service momentanément indisponible.' };
  }
  if (error || !data?.user) return { statut: 401, erreur: 'non authentifie' };
  return { user: data.user };
}
