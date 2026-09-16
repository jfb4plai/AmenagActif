/**
 * Aménagements universels : cochés UNE fois par classe (pas par élève).
 * Alimentent le bloc « Pour tous » de la fiche. Affiché en carte, au-dessus
 * de la grille des AR (qui, elle, est par élève). Scopé à la classe
 * sélectionnée dans le flux de saisie.
 */
export default function BandeauAU({ classe, auCatalogue, chapitres, auClasse, onToggle }) {
  const estCoche = (amId) => auClasse.some((x) => x.amenagement_id === amId);

  const chapOrdre = new Map(chapitres.map((c) => [c.id, c.ordre]));
  const chapCourt = (chapId) => {
    const t = chapitres.find((c) => c.id === chapId)?.titre ?? '';
    return t.replace(/^\d+\.\s*/, '').split(',')[0].trim();
  };
  const auTries = [...auCatalogue].sort(
    (a, b) => (chapOrdre.get(a.chapitre_id) ?? 99) - (chapOrdre.get(b.chapitre_id) ?? 99) || a.ordre - b.ordre
  );
  const nbCoches = auTries.filter((a) => estCoche(a.id)).length;

  return (
    <section className="plai-card p-4" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal">Aménagements universels de la classe</h2>
      <p className="text-sm text-[color:var(--text3)] mb-3">
        S'appliquent à <strong>tous les élèves</strong> de la classe. Cochés ici une seule fois — ils forment le bloc « Pour tous » de la fiche.
        Les aménagements <strong>par élève</strong> sont dans les 12 chapitres ci-dessous.
      </p>
      <div className="font-medium mb-1">
        {classe.nom} <span className="text-[color:var(--text3)] font-normal">— {nbCoches} AU coché(s)</span>
      </div>
      <ul className="space-y-1">
        {auTries.map((a) => (
          <li key={a.id}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={estCoche(a.id)}
                onChange={(e) => onToggle({ classeId: classe.id, amenagementId: a.id, actif: e.target.checked })}
              />
              <span>
                {a.libelle}
                <span className="text-xs text-[color:var(--text3)]"> · {chapCourt(a.chapitre_id)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
