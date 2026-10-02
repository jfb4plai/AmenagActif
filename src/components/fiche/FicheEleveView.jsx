/** @param {{ vm: import('../../domain/types.js').FicheEleveVM }} props */
export default function FicheEleveView({ vm }) {
  return (
    <article className="max-w-3xl mx-auto bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
      </header>
      <p className="text-sm text-gray-600 mb-2">{vm.ecoleNom}</p>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">
        Aménagements — {vm.eleve}{' '}
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white border border-gray-400 align-middle">{vm.statut}</span>
        {' '}({vm.classeNom})
      </h1>
      <section className="mb-3">
        <h2 className="font-bold underline">AU applicable(s) à toute la classe :</h2>
        <ul className="list-disc pl-6">
          {(vm.pourTous?.length ?? 0) === 0 && <li className="list-none text-gray-500">Aucun aménagement universel retenu pour la classe.</li>}
          {vm.pourTous?.map((x, i) => (
            <li key={i} className={x.surligne ? 'bg-yellow-200' : ''}>{x.libelle}</li>
          ))}
        </ul>
      </section>
      {vm.dispositifsClasse?.map((d) => (
        <section key={d.titre} className="mb-3">
          <h2 className="font-bold underline">{d.titre} :</h2>
          <ul className="list-disc pl-6">{d.items.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      ))}
      <h2 className="font-bold underline mb-1">Aménagements de {vm.eleve} :</h2>
      {vm.parChapitre.length === 0 && <p className="text-gray-500">Aucun aménagement spécifique enregistré.</p>}
      {vm.parChapitre.map((ch) => (
        <section key={ch.chapitreTitre} className="mb-3">
          <h2 className="font-bold">{ch.chapitreTitre}</h2>
          <ul className="list-disc pl-6">{ch.amenagements.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      ))}
      {vm.commentaire && (
        <section className="mt-3">
          <h2 className="font-bold">Commentaire</h2>
          <p>{vm.commentaire}</p>
        </section>
      )}
    </article>
  );
}
