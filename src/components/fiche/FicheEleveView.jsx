/** @param {{ vm: import('../../domain/types.js').FicheEleveVM }} props */
export default function FicheEleveView({ vm }) {
  return (
    <article className="max-w-3xl mx-auto bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-4">
        <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 40, width: 'auto' }} />
      </header>
      <h1 className="text-center bg-gray-200 py-2 font-bold text-lg mb-4">
        Aménagements — {vm.eleve} ({vm.classeNom})
      </h1>
      {vm.parChapitre.length === 0 && <p className="text-gray-500">Aucun aménagement spécifique enregistré.</p>}
      {vm.parChapitre.map((ch) => (
        <section key={ch.chapitreTitre} className="mb-3">
          <h2 className="font-bold">{ch.chapitreTitre}</h2>
          <ul className="list-disc pl-6">{ch.amenagements.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </section>
      ))}
    </article>
  );
}
