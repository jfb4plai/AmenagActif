const collator = new Intl.Collator('fr', { numeric: true });
const trier = (valeurs) => [...valeurs].sort(collator.compare);

export function optionsNiveaux({ niveauxClasses, enregistres }) {
  const vus = new Set();
  let sansNiveau = 0;
  for (const n of niveauxClasses) {
    const v = typeof n === 'string' ? n.trim() : '';
    if (v) vus.add(v); else sansNiveau += 1;
  }
  const options = trier(vus).map((valeur) => ({ valeur, coche: enregistres.includes(valeur), absent: false }));
  for (const valeur of enregistres) {
    if (!vus.has(valeur)) options.push({ valeur, coche: true, absent: true });
  }
  return { options, sansNiveau };
}

export function basculerNiveau(enregistres, valeur, coche) {
  const autres = enregistres.filter((v) => v !== valeur);
  return trier(coche ? [...autres, valeur] : autres);
}

export function messageNiveaux({ nbCoches, sansNiveau }) {
  if (nbCoches === 0) return { texte: 'Aucun niveau coché : apparaît sur toutes les classes.', avertissement: null };
  const texte = 'Apparaît seulement sur les classes des niveaux cochés.';
  if (sansNiveau <= 0) return { texte, avertissement: null };
  const classes = sansNiveau === 1 ? '1 classe sans niveau' : `${sansNiveau} classes sans niveau`;
  return { texte, avertissement: `${classes} : cette direction n'y apparaît pas.` };
}
