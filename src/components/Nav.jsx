import { Link, NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useRole } from '../lib/auth.jsx';

const lien = ({ isActive }) => (isActive ? 'font-semibold text-teal' : 'text-[color:var(--text2)]');

export default function Nav() {
  const { role } = useRole();
  return (
    <header className="plai-nav flex items-center gap-6 px-4 py-2 border-b border-[color:var(--border)]">
      <Link to="/" className="flex items-center gap-2">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
        <span className="font-serif text-lg">AménagActif</span>
      </Link>
      <nav className="flex gap-4 text-sm">
        {role === 'plai' && <NavLink to="/saisie" className={lien}>Saisie</NavLink>}
        <NavLink to="/fiches" className={lien}>Fiches</NavLink>
        {role === 'plai' && <NavLink to="/administration" className={lien}>Administration</NavLink>}
      </nav>
      <div className="ml-auto text-sm flex items-center gap-3">
        {role && <span className="text-[color:var(--text3)]">{role === 'plai' ? 'Référent PLAI' : 'Direction'}</span>}
        <button className="plai-btn" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </div>
    </header>
  );
}
