import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useEquipeEcole } from '../hooks/useAdmin.js';
import { useRole } from '../lib/auth.jsx';

const LABEL = { referent_plai: 'Référent PLAI', direction: 'Direction' };

export default function MonEcole() {
  const { isAdmin, ecoleId } = useRole();
  const { data: ecoles = [], isLoading } = useEcoles();

  // Non-admin : RLS ne renvoie que son école.
  const ecole = !isAdmin && ecoles.length === 1 ? ecoles[0] : null;
  const { data: equipe = [] } = useEquipeEcole(ecole?.id ?? ecoleId ?? null);

  if (isLoading) return <div className="plai-section">Chargement…</div>;

  if (isAdmin) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-empty">En tant qu'administrateur, gérez les écoles et les membres dans « Administration ».</p>
      </div>
    );
  }

  if (!ecole) {
    return (
      <div className="plai-section max-w-3xl px-4">
        <p className="plai-error">Aucune école n'est rattachée à votre compte. Contactez l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="plai-section space-y-6 max-w-3xl px-4">
      <h1 className="text-xl font-semibold">Mon école — {ecole.nom}</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Équipe de l'implantation</h2>
        <p className="text-sm text-[color:var(--text3)]">
          Ces noms alimentent les colonnes « référent·e PIA » et « PAR (Direction) » des fiches.
          Pour ajouter ou retirer une personne, ou corriger un nom, contactez l'administrateur.
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

      {/* À venir (Plan 2) : gestion des enseignants par classe. */}
    </div>
  );
}
