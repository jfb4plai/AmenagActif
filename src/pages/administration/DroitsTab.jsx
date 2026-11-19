import { ROLES, LIBELLE_ROLE, CAPACITES } from '../../domain/droits.js';

const MOT = (v) => (v === true ? 'Oui' : v === false ? 'Non' : 'À confirmer');
const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';

// Lecture seule : la matrice vient de src/domain/droits.js (la même qui pilote routes et menu). `preuve` reste réservée aux développeurs.
export default function DroitsTab() {
  return (
    <section className="space-y-4" style={{ fontSize: 16 }}>
      <h2 className="text-lg font-semibold">Droits</h2>
      <p className="plai-banner">
        <span>Ce tableau décrit les droits actuels. Il n'est pas encore modifiable ici.</span>
        {' '}<span>Document de référence : docs/permissions-roles.md.</span>
      </p>
      <div
        role="region"
        tabIndex={0}
        aria-label="Tableau des droits, défilable horizontalement"
        className={`overflow-x-auto border border-[color:var(--border)] rounded ${FOCUS}`}
      >
        <table className="w-full border-collapse text-left" style={{ minWidth: 640, fontSize: 16 }}>
          <caption className="sr-only">Droits de chaque rôle, capacité par capacité</caption>
          <thead>
            <tr className="border-b border-[color:var(--border)]">
              <th scope="col" className="p-2 font-semibold">Capacité</th>
              {ROLES.map((r) => <th key={r} scope="col" className="p-2 font-semibold">{LIBELLE_ROLE[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {CAPACITES.map((c) => (
              <tr key={c.id} className="border-b border-[color:var(--border)] align-top">
                <th scope="row" className="p-2 font-normal">
                  <span className="font-semibold">{c.libelle}</span>
                  <span className="block text-[color:var(--text2)]">{c.effet}</span>
                </th>
                {ROLES.map((r) => <td key={r} className="p-2">{MOT(c.roles[r])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
