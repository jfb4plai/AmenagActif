import { useId } from 'react';

const OPTIONS = [
  { valeur: 'fusion', libelle: 'Une seule fiche fusionnée', aide: 'Cours pratique réunissant plusieurs classes : AU et AR fusionnés, sans doublon.' },
  { valeur: 'sommaire', libelle: 'Un sommaire : une fiche par classe', aide: "L'enseignant ouvre une liste et choisit la fiche de chacune de ses classes." },
];

/** Choix du type de lien pour une sélection de plusieurs classes. */
export default function ChoixModeLien({ mode, onChange, nbClasses }) {
  const nom = useId();
  return (
    <fieldset className="space-y-1">
      <legend className="font-medium" style={{ fontSize: 16 }}>Type de lien pour ces {nbClasses} classes</legend>
      {OPTIONS.map((o) => (
        <label key={o.valeur} className="flex items-start gap-2" style={{ fontSize: 16 }}>
          <input type="radio" name={nom} value={o.valeur} checked={mode === o.valeur} onChange={() => onChange(o.valeur)} className="mt-1" />
          <span>
            {o.libelle}
            <span className="block text-[color:var(--text2)]" style={{ fontSize: 16 }}>{o.aide}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
