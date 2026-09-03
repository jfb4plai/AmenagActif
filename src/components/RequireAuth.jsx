import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function RequireAuth({ children }) {
  const { session, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="plai-section">Chargement…</div>;
  if (!session) return <Navigate to="/connexion" replace state={{ from: loc.pathname }} />;
  return children;
}
