import { Link, NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRole, useAuth } from '../lib/auth.jsx';

const lien = ({ isActive }) => (isActive ? 'font-semibold text-teal' : 'text-[color:var(--text2)]');

const LABEL_ROLE = {
  admin: 'Administrateur',
  referent_plai: 'Référent PLAI',
  direction: 'Direction',
  agent_plai: 'Agent accompagnant',
};

export default function Nav() {
  const { role, isAdmin, editeurEcole } = useRole();
  const { session } = useAuth();
  return (
    <header className="plai-nav flex items-center gap-6 px-4 py-2 border-b border-[color:var(--border)]">
      <Link to="/" className="flex items-center gap-2">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
        <span className="font-serif text-lg">AménagActif</span>
      </Link>
      <nav className="flex gap-4 text-sm">
        {editeurEcole && <NavLink to="/saisie" className={lien}>Saisie</NavLink>}
        <NavLink to="/catalogue-amenagements" className={lien}>Catalogue</NavLink>
        <NavLink to="/fiches" className={lien}>Fiches</NavLink>
        {['admin', 'referent_plai', 'direction'].includes(role) && <NavLink to="/liens" className={lien}>Liens enseignants</NavLink>}
        {!isAdmin && role && <NavLink to="/mon-ecole" className={lien}>Mon école</NavLink>}
        {isAdmin && <NavLink to="/administration" className={lien}>Administration</NavLink>}
      </nav>
      <div className="ml-auto text-sm flex items-center gap-3">
        {session?.user?.email && (
          <span className="text-[color:var(--text3)]">
            {session.user.email}
            {role && <> · {LABEL_ROLE[role] ?? role}</>}
          </span>
        )}
        <button className="plai-btn" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </div>
    </header>
  );
}
