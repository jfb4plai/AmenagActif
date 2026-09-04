/**
 * Aménagements universels : cochés UNE fois par classe (pas par élève).
 * Alimentent le bloc « Pour tous » de la fiche. Affiché en carte, au-dessus
 * de la grille des AR (qui, elle, est par élève).
 */
export default function BandeauAU({ classesAvecEleves, auCatalogue, chapitres, auClasse, onToggle }) {
  const estCoche = (classeId, amId) => auClasse.some((x) => x.classe_id === classeId && x.amenagement_id === amId);

  const chapOrdre = new Map(chapitres.map((c) => [c.id, c.ordre]));
  const chapCourt = (chapId) => {
    const t = chapitres.find((c) => c.id === chapId)?.titre ?? '';
    return t.replace(/^\d+\.\s*/, '').split(',')[0].trim();
  };
  const auTries = [...auCatalogue].sort(
    (a, b) => (chapOrdre.get(a.chapitre_id) ?? 99) - (chapOrdre.get(b.chapitre_id) ?? 99) || a.ordre - b.ordre
  );
  const nbCoches = (classeId) => auTries.filter((a) => estCoche(classeId, a.id)).length;

  return (
    <section className="plai-card p-4" style={{ borderColor: 'var(--teal)', background: 'rgba(10,147,112,0.05)' }}>
      <h2 className="font-semibold text-teal">Aménagements universels de la classe</h2>
      <p className="text-sm text-[color:var(--text3)] mb-3">
        S'appliquent à <strong>tous les élèves</strong> de la classe. Cochés ici une seule fois — ils forment le bloc « Pour tous » de la fiche.
        Les aménagements <strong>par élève</strong> sont dans les 12 chapitres ci-dessous.
      </p>

      <div className="flex flex-wrap gap-6">
        {classesAvecEleves.map(({ classe }) => (
          <div key={classe.id} className="min-w-[18rem] flex-1">
            <div className="font-medium mb-1">
              {classe.nom} <span className="text-[color:var(--text3)] font-normal">— {nbCoches(classe.id)} AU coché{nbCoches(classe.id) > 1 ? 's' : ''}</span>
            </div>
            <ul className="space-y-1">
              {auTries.map((a) => (
                <li key={a.id}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={estCoche(classe.id, a.id)}
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
          </div>
        ))}
      </div>
    </section>
  );
}
