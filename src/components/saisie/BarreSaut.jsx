export default function BarreSaut({ chapitres }) {
  return (
    <nav aria-label="Aller au chapitre" className="flex flex-wrap gap-1 sticky top-0 bg-[color:var(--bg)] py-2 z-30">
      <span className="text-sm text-[color:var(--text3)] mr-2">Sauter à :</span>
      {chapitres.map((c) => (
        <a key={c.id} href={`#chap-${c.ordre}`}
          className="text-sm px-2 py-0.5 rounded border border-[color:var(--border)] hover:bg-white"
          title={c.titre}>{c.ordre}</a>
      ))}
    </nav>
  );
}
