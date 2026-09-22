import { useEcoles } from '../hooks/useEcoleGrid.js';
import { useEquipeEcole, useAnneeActive } from '../hooks/useAdmin.js';
import { useEcoleGrid } from '../hooks/useEcoleGrid.js';
import { useAgentsPlai } from '../hooks/useAgentsPlai.js';
import { useAccompagnantsEleves, useAccompagnantsMutations } from '../hooks/useAccompagnants.js';
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
          Ces noms alimentent les colonnes « Référent(s) PLAI » et « PAR (Direction) » des fiches.
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

      <SectionAccompagnants ecoleId={ecole.id} />

      {/* À venir (Plan 2) : gestion des enseignants par classe. */}
    </div>
  );
}

function SectionAccompagnants({ ecoleId }) {
  const anneeActive = useAnneeActive();
  const { data: grid, isLoading } = useEcoleGrid(ecoleId, anneeActive?.id ?? null);
  const { data: agents = [] } = useAgentsPlai();
  const eleves = grid?.eleves ?? [];
  const eleveIds = eleves.map((e) => e.id);
  const { data: assignations = [] } = useAccompagnantsEleves(eleveIds);
  const { assigner, retirer } = useAccompagnantsMutations();
  const classes = grid?.classes ?? [];
  const nomClasse = (classeId) => classes.find((c) => c.id === classeId)?.nom ?? '';
  const agentsDe = (eleveId) => assignations.filter((a) => a.eleve_id === eleveId).map((a) => a.user_id);
  const nomAgent = (userId) => { const a = agents.find((x) => x.userId === userId); return a ? (a.nom || a.email) : userId; };

  if (!anneeActive) return null;

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">Accompagnants par élève</h2>
      <p className="text-sm text-[color:var(--text3)]">
        Un accompagnant assigné à un élève peut saisir ses AR, les AU de sa classe, et corriger son statut IPT/PAR — vérifiez la liste des comptes agent PLAI du pôle avant d'en ajouter un.
      </p>
      {isLoading ? <p>Chargement…</p> : eleves.length === 0 ? (
        <p className="plai-empty">Aucun élève encodé pour l'année active.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded">
          {eleves.map((e) => (
            <li key={e.id} className="px-3 py-2 space-y-1">
              <div className="text-sm font-medium">
                {e.prenom} {e.initiale_nom} <span className="text-[color:var(--text3)] font-normal">— {nomClasse(e.classe_id)}</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {agentsDe(e.id).map((userId) => (
                  <span key={userId} className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full flex items-center gap-1">
                    {nomAgent(userId)}
                    <button type="button" className="underline" onClick={() => retirer.mutate({ eleveId: e.id, userId })}>retirer</button>
                  </span>
                ))}
                <select className="plai-input !w-auto !py-1 text-xs" value=""
                  onChange={(ev) => { if (ev.target.value) assigner.mutate({ eleveId: e.id, userId: ev.target.value }); }}>
                  <option value="">+ assigner un accompagnant…</option>
                  {agents.filter((a) => !agentsDe(e.id).includes(a.userId)).map((a) => (
                    <option key={a.userId} value={a.userId}>{a.nom || a.email}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(assigner.isError || retirer.isError) && <p className="plai-error">Action impossible, réessayez.</p>}
    </section>
  );
}
