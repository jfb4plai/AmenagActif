import { Link } from 'react-router-dom';
import { referenceLien } from '../domain/liens.js';

const FOCUS = 'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#f97316]';

// Page d'accueil d'un super lien : une entrée par classe rattachée.
export default function SommairePublic({ sommaire, token }) {
  const { numero, ecole, classes, fichesGroupees = [] } = sommaire;
  const nomEcole = ecole?.implantation_nom || ecole?.nom || '';
  const t = encodeURIComponent(token);

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-6 px-4">
      <div className="max-w-xl mx-auto space-y-4" style={{ fontSize: 16 }}>
        <h1 className="text-xl font-semibold">Vos classes — {nomEcole}</h1>
        <p style={{ fontSize: 16 }}>Référence : {referenceLien(numero)}</p>

        {classes.length === 0 && fichesGroupees.length === 0 ? (
          <p style={{ fontSize: 16 }}>Aucune classe n'est rattachée pour le moment. Contactez votre référent.</p>
        ) : (
          <ul className="space-y-2 list-none p-0">
            {fichesGroupees.map((f) => (
              <li key={`g-${f.id}`}>
                <Link
                  to={`/fiche/${t}/groupe/${encodeURIComponent(f.id)}`}
                  className={`plai-btn block w-full text-left ${FOCUS}`}
                  style={{ fontSize: 16 }}
                >
                  Fiche groupée : {f.nom}{f.classes?.length ? ` (${f.classes.join(' + ')})` : ''}
                </Link>
              </li>
            ))}
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/fiche/${t}/classe/${encodeURIComponent(c.id)}`}
                  className={`plai-btn block w-full text-left ${FOCUS}`}
                  style={{ fontSize: 16 }}
                >
                  {c.nom}{c.niveau ? ` — ${c.niveau}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p style={{ fontSize: 16 }}>
          <a className={`text-teal underline ${FOCUS}`} href="/catalogue-amenagements" target="_blank" rel="noopener noreferrer">
            Voir la liste complète des aménagements possibles (AU/AR)
          </a>
        </p>
        <p style={{ fontSize: 16 }}>
          <a className={`text-teal underline ${FOCUS}`} href="/modes-emploi/enseignants.html" target="_blank" rel="noopener noreferrer">
            Comment utiliser cette fiche (3 minutes)
          </a>
        </p>
      </div>
    </div>
  );
}
