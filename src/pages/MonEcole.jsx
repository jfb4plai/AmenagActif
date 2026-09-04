import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useRole } from '../lib/auth.jsx';
import GestionReferentsEcole from '../components/GestionReferentsEcole.jsx';

export default function MonEcole() {
  const { isAdmin } = useRole();
  const { data: ecoles = [], isLoading } = useEcoles();

  // Non-admin : RLS ne renvoie que son école.
  const ecole = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  if (isAdmin) {
    return (
      <div className="plai-section max-w-4xl px-4">
        <p className="plai-empty">En tant qu'administrateur, la gestion des écoles se fait dans « Administration ».</p>
      </div>
    );
  }

  if (!ecole) {
    return (
      <div className="plai-section max-w-4xl px-4">
        <p className="plai-error">Aucune école n'est rattachée à votre compte. Contactez l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="plai-section space-y-8 max-w-4xl px-4">
      <h1 className="text-xl font-semibold">Mon école — {ecole.nom}</h1>
      <GestionReferentsEcole ecoleFixe={ecole} />
      {/* À venir : gestion des enseignants par classe (Plan 2). */}
    </div>
  );
}
