import { useRole } from '../lib/auth.jsx';

/** roles: tableau de rôles autorisés, ex. ['admin'] ou ['admin','referent_plai','direction'] */
export default function RequireRole({ roles, children }) {
  const { role, loading } = useRole();
  if (loading) return <div className="plai-section">Chargement…</div>;
  if (!role || !roles.includes(role)) {
    return <div className="plai-section"><p className="plai-error">Accès non autorisé pour votre profil.</p></div>;
  }
  return children;
}
