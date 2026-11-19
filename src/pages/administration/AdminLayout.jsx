import { NavLink, Outlet } from 'react-router-dom';
import { ONGLETS_ADMIN } from './onglets.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';

export default function AdminLayout() {
  return (
    <div className="plai-section space-y-4 max-w-4xl px-4">
      <h1 className="text-xl font-semibold">Administration</h1>
      <nav aria-label="Sections de l'administration" className="flex flex-wrap gap-x-2 gap-y-1 border-b border-[color:var(--border)]">
        {ONGLETS_ADMIN.map((o) => (
          <NavLink
            key={o.chemin}
            to={o.chemin}
            style={{ fontSize: 16 }}
            className={({ isActive }) =>
              `px-3 py-2 -mb-px border-b-[3px] ${FOCUS} ${isActive ? 'border-teal text-teal font-semibold' : 'border-transparent text-[color:var(--text2)] hover:text-teal'}`}
          >
            {o.libelle}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
