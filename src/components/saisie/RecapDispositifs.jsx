import { chapitreEnModeAU } from '../../domain/dispositifs.js';

/** Ligne de rappel en haut de la saisie : mode de chaque dispositif pour la classe courante. */
export default function RecapDispositifs({ dispositifs, modes }) {
  if (!dispositifs.length) return null;
  return (
    <div className="plai-card p-3 text-sm">
      <div className="font-medium mb-1">Dispositifs de cette classe</div>
      <ul className="space-y-0.5">
        {dispositifs.map((ch) => (
          <li key={ch.id}>
            <a href={`#chap-${ch.ordre}`} className="underline text-teal">{ch.titre}</a>
            {' : '}
            <strong>{chapitreEnModeAU(ch, modes) ? 'AU (toute la classe)' : 'AR (par élève)'}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
