function messageErreur(m) {
  if (/row-level security|permission denied/i.test(m)) {
    return "droit insuffisant pour écrire dans cette implantation (demandez à l'administrateur)";
  }
  return m;
}

export default function EtapeSynthese({ s, onAppliquer, enCours, rapport, nomEleve }) {
  return (
    <section className="plai-card p-3 space-y-3">
      <h2 className="font-semibold">Synthèse</h2>
      <ul className="text-sm space-y-1">
        <li><strong>{s.classe}</strong> élève(s) seront repris dans une classe (AR et aménagements libres copiés « à confirmer »).</li>
        <li><strong>{s.transfert}</strong> changent d'implantation (file de l'administrateur).</li>
        <li><strong>{s.termine}</strong> en fin de parcours (rien à faire).</li>
        <li><strong>{s.none}</strong> non traité(s){s.none > 0 ? ' : ils ne seront pas repris maintenant, mais resteront dans cette liste pour plus tard.' : '.'}</li>
        {s.dejaRepris > 0 && <li>{s.dejaRepris} élève(s) déjà repris précédemment.</li>}
      </ul>
      <button className="plai-btn" disabled={enCours || (s.classe === 0 && s.transfert === 0 && s.termine === 0)} onClick={onAppliquer}>
        {enCours ? 'Reprise en cours…' : `Appliquer (${s.classe} reprise(s))`}
      </button>
      <p className="text-xs text-[color:var(--text3)]">
        Rien n'est supprimé de l'année précédente : la reprise crée de nouvelles fiches et laisse les anciennes intactes. Vous pouvez relancer l'assistant : un élève déjà repris ne l'est jamais deux fois.
      </p>
      {rapport && (
        <div className={rapport.echecs.length ? 'plai-error' : 'plai-success'}>
          <p>{rapport.repris} élève(s) repris.</p>
          {rapport.echecs.length > 0 && (
            <ul className="list-disc pl-5 text-sm">
              {rapport.echecs.map((x) => <li key={x.sourceId}>{nomEleve(x.sourceId)} : {messageErreur(x.message)}</li>)}
            </ul>
          )}
          {rapport.echecs.length === 0 && <p className="text-sm">Ouvrez la Saisie de l'année cible : le bandeau orange indique les AR à confirmer.</p>}
        </div>
      )}
    </section>
  );
}
