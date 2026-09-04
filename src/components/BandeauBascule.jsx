import { Link } from 'react-router-dom';
import { useAnneeActive, besoinBasculeAnnee } from '../hooks/useAdmin.js';
import { useRole } from '../lib/auth.jsx';

/** Rappel de bascule d'année (référent PLAI uniquement). */
export default function BandeauBascule() {
  const { role } = useRole();
  const active = useAnneeActive();
  if (role !== 'plai') return null;
  if (!besoinBasculeAnnee(active)) return null;

  return (
    <div className="no-print px-4 py-2 text-sm" style={{ background: '#fff3e6', borderBottom: '1px solid #f97316', color: '#9a3412' }}>
      {active
        ? <>L'année active est <strong>{active.libelle}</strong>. Créez et activez l'année suivante dans </>
        : <>Aucune année scolaire active. Créez-en une dans </>}
      <Link to="/administration" className="underline font-semibold">Administration</Link>.
    </div>
  );
}
