import EnTeteDispositif from './EnTeteDispositif.jsx';
import { messageConfirmationRetraitAU } from '../../domain/dispositifs.js';

function normaliser(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Dispositif en mode AU pour la classe : coché une seule fois (table ar_amenagements_classe),
 * comme le bloc AU. Même règle de retrait que les AU (agent accompagnant : ajout seulement).
 * `entete` = props d'EnTeteDispositif (mode, peutBasculer, blocage, onBascule).
 */
export default function CarteDispositif({ classe, chapitre, items, auClasse, onToggle, peutRetirer = true, filtre, entete }) {
  const estCoche = (id) => auClasse.some((x) => x.amenagement_id === id);
  const tries = [...items].sort((a, b) => a.ordre - b.ordre);
  const recherche = normaliser(filtre ?? '').trim();
  const enRecherche = recherche.length > 0;
  const affiches = enRecherche ? tries.filter((a) => normaliser(a.libelle).includes(recherche)) : tries;
  const nbCoches = tries.filter((a) => estCoche(a.id)).length;

  return (
    <section id={`chap-${chapitre.ordre}`} className="plai-card p-0 overflow-hidden" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal px-3 pt-3">{chapitre.titre}</h2>
      <EnTeteDispositif chapitre={chapitre} {...entete} />
      <div className="p-3">
        <div className="font-medium mb-1">
          {classe.nom} <span className="text-[color:var(--text3)] font-normal">
            — {enRecherche ? `${affiches.length} résultat(s)` : `${nbCoches} coché(s) pour toute la classe`}
          </span>
        </div>
        {tries.length === 0 && <p className="text-base text-[color:var(--text3)]">Aucun aménagement dans ce dispositif pour l'instant.</p>}
        {enRecherche && tries.length > 0 && affiches.length === 0 && <p className="text-base text-[color:var(--text3)]">Aucun aménagement ne correspond.</p>}
        <ul className="space-y-1">
          {affiches.map((a) => (
            <li key={a.id}>
              <label className="flex items-start gap-2 text-base">
                <input type="checkbox" className="mt-0.5" checked={estCoche(a.id)}
                  disabled={!peutRetirer && estCoche(a.id)}
                  title={!peutRetirer && estCoche(a.id) ? "Retrait réservé au référent PLAI, à la direction ou à l'administrateur" : undefined}
                  onChange={(e) => {
                    const actif = e.target.checked;
                    if (!actif && !window.confirm(messageConfirmationRetraitAU(a.libelle))) return;
                    onToggle({ classeId: classe.id, amenagementId: a.id, actif });
                  }} />
                <span>
                  {a.libelle}
                  {auClasse.find((x) => x.amenagement_id === a.id)?.a_confirmer && <span className="text-xs text-[#9a3412] font-medium"> · à confirmer</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
