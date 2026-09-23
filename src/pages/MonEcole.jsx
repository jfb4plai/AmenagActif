import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useEquipeEcole } from '../hooks/useAdmin.js';
import { useRole } from '../lib/auth.jsx';

const LABEL = { referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };

export default function MonEcole() {
  const { isAdmin } = useRole();
  const { data: ecoles = [], isLoading } = useEcoles();

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  if (isAdmin) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-empty">En tant qu'administrateur, gérez les écoles et les membres dans « Administration ».</p>
      </div>
    );
  }

  if (ecoles.length === 0) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-error">Aucune école n'est rattachée à votre compte. Contactez l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="plai-section space-y-8 max-w-3xl px-4">
      <h1 className="text-xl font-semibold">{ecoles.length > 1 ? 'Mes écoles' : 'Mon école'}</h1>
      {ecoles.map((ecole) => <SectionEcole key={ecole.id} ecole={ecole} />)}

      {/* À venir (Plan 2) : gestion des enseignants par classe. */}
    </div>
  );
}

function SectionEcole({ ecole }) {
  const { data: equipe = [] } = useEquipeEcole(ecole.id);

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{ecole.nom}</h2>
      <h3 className="font-semibold text-sm">Équipe de l'implantation</h3>
      <p className="text-sm text-[color:var(--text3)]">
        Les noms Référent PLAI et Direction alimentent les colonnes « Référent(s) PLAI » et « PAR (Direction) » des fiches.
        Les agents accompagnants sont listés ici pour information. Pour ajouter, retirer une personne, ou corriger un nom,
        signalez le changement à l'administrateur — c'est lui qui édite ces listes, école par école.
      </p>
      <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
        {equipe.length === 0 && <li className="px-3 py-2 text-sm text-[color:var(--text3)]">Aucun membre enregistré.</li>}
        {equipe.map((m) => (
          <li key={m.user_id} className="px-3 py-2 flex justify-between">
            <span>{m.nom || <span className="text-[color:var(--text3)]">(nom non renseigné)</span>}</span>
            <span className="text-sm text-[color:var(--text3)]">{LABEL[m.role] ?? m.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
