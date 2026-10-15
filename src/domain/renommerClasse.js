const cle = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').toLowerCase();

/**
 * Valide le nouveau nom d'une classe avant envoi.
 * autresNoms : noms des AUTRES classes de la même école et de la même année.
 * La base refuse seulement le doublon exact ; ici « 5 LA » et « 5la » sont aussi traités comme doublons de « 5LA ».
 */
export function validerNomClasse({ nom, ancien, autresNoms = [] }) {
  const propre = String(nom ?? '').trim().replace(/\s+/g, ' ');
  if (!propre) return { ok: false, message: 'Le nom de la classe ne peut pas être vide.' };
  if (propre === ancien) return { ok: false, message: 'Le nom est inchangé.' };
  if (autresNoms.some((n) => cle(n) === cle(propre))) {
    return { ok: false, message: `Une classe nommée « ${propre} » (ou très proche) existe déjà dans cette école pour cette année.` };
  }
  return { ok: true, nom: propre };
}

/** Message lisible pour une erreur Supabase de renommage. */
export function messageErreurRenommage(err) {
  if (err?.code === '23505') return 'Une classe porte déjà ce nom dans cette école pour cette année.';
  if (err?.code === '42501') return 'Droits insuffisants : seuls un référent PLAI, une direction ou un administrateur peuvent renommer une classe.';
  return 'Renommage impossible, réessayez.';
}
