export default function BarreSaut({ chapitres }) {
  return (
    <nav aria-label="Aller au chapitre" className="flex flex-wrap items-center gap-1">
      <span className="text-sm text-[color:var(--text3)] mr-2">Sauter à :</span>
      {chapitres.map((c) => (
        <a key={c.id} href={`#chap-${c.ordre}`}
          className="text-sm px-2 py-0.5 rounded border border-[color:var(--border)] hover:bg-white"
          title={c.titre}>{c.ordre}</a>
      ))}
    </nav>
  );
}
