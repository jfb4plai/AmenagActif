/** @param {{ vm: import('../../domain/types.js').FicheClasseVM, showStatutEleve?: boolean, lienEleve?: boolean }} props
 * lienEleve : false sur la fiche publique (FichePublique.jsx) — les enseignants qui la consultent
 * n'ont pas de compte et ne peuvent pas ouvrir /eleve/:id/fiche (page authentifiée). */
export default function FicheClasseView({ vm, showStatutEleve = false, lienEleve = true }) {
  const date = vm.dateMaj ? new Date(vm.dateMaj).toLocaleDateString('fr-BE') : '…';
  return (
    <article className="fiche max-w-3xl mx-auto bg-white p-8 text-[15px] leading-relaxed" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
        <span>Date de mise à jour : {date}</span>
      </header>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">Aménagements raisonnables — {vm.classeNom}</h1>
      <p className="text-sm text-gray-600 mb-4">
        {vm.ecoleNom} · {vm.anneeLibelle}
        {vm.classesSources && <> · Classes regroupées : {vm.classesSources.join(', ')}</>}
      </p>

      <table className="w-full border border-black mb-4 text-sm">
        <thead><tr>
          <th className="border border-black p-1 w-1/2">Référent(s) PLAI de votre classe</th>
          <th className="border border-black p-1 w-1/2">PAR (Direction)</th>
        </tr></thead>
        <tbody><tr>
          <td className="border border-black p-2 align-top">{vm.tableauReferents.pia.join(', ') || '—'}</td>
          <td className="border border-black p-2 align-top">{vm.tableauReferents.par.join(', ') || '—'}</td>
        </tr></tbody>
      </table>

      <h2 className="font-bold underline mb-1">AU applicables à toute la classe :</h2>
      <ul className="list-disc pl-6 mb-4">
        {vm.pourTous.length === 0 && <li className="list-none text-gray-500">Aucun aménagement universel retenu pour la classe.</li>}
        {vm.pourTous.map((x, i) => (
          <li key={i} className={x.surligne ? 'bg-yellow-200' : ''}>{x.libelle}</li>
        ))}
      </ul>

      <h2 className="font-bold underline mb-1">AR spécifiques à un élève :</h2>
      <table className="w-full border border-black mb-4 text-sm">
        <tbody>
          {vm.parAmenagement.length === 0 && <tr><td className="border border-black p-2 text-gray-500">Aucun.</td></tr>}
          {vm.parAmenagement.map((row) => (
            <tr key={row.libelle}>
              <td className="border border-black p-2 align-top w-3/4">{row.libelle}</td>
              <td className="border border-black p-2 w-1/4">
                <ul className="list-disc pl-5">
                  {row.eleves.map((e, i) => (
                    <li key={i}>
                      {lienEleve ? <a className="text-teal underline" href={`/eleve/${e.eleveId}/fiche`}>{e.nom}</a> : <span>{e.nom}</span>}
                      {showStatutEleve && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 ml-1">{e.statut}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="border border-black text-sm">
        <tbody><tr>
          <td className="border border-black p-2">Nombre de cours à imprimer en recto</td>
          <td className="border border-black p-2 text-center w-16">{vm.nbRecto}</td>
        </tr></tbody>
      </table>

      {vm.commentaires.length > 0 && (
        <>
          <h2 className="font-bold underline mb-1 mt-4">Commentaires :</h2>
          <table className="w-full border border-black text-sm">
            <tbody>
              {vm.commentaires.map((c, i) => (
                <tr key={i}>
                  <td className="border border-black p-2 align-top w-32 font-medium">
                    {c.eleve}
                    {showStatutEleve && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 ml-1">{c.statut}</span>
                    )}
                  </td>
                  <td className="border border-black p-2">{c.texte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}
