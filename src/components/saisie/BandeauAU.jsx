export default function BandeauAU({ classesAvecEleves, auCatalogue, auClasse, onToggle }) {
  const estCoche = (classeId, amId) => auClasse.some((x) => x.classe_id === classeId && x.amenagement_id === amId);
  const totalCols = classesAvecEleves.reduce((n, x) => n + x.eleves.length, 0);

  return (
    <>
      <tr style={{ background: 'rgba(10,147,112,0.08)' }}>
        <td colSpan={totalCols + 1} className="p-2 font-semibold text-teal">
          Aménagements universels — cochés pour toute la classe (bloc « Pour tous » de la fiche)
        </td>
      </tr>
      {classesAvecEleves.map(({ classe }) => (
        <tr key={classe.id} className="border-b border-[color:var(--border)]">
          <td className="p-1 align-top">
            <div className="font-medium">{classe.nom}</div>
            <div className="flex flex-col gap-1 mt-1">
              {auCatalogue.map((a) => (
                <label key={a.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={estCoche(classe.id, a.id)}
                    onChange={(e) => onToggle({ classeId: classe.id, amenagementId: a.id, actif: e.target.checked })} />
                  <span>{a.libelle}</span>
                </label>
              ))}
            </div>
          </td>
          <td colSpan={totalCols}></td>
        </tr>
      ))}
    </>
  );
}
