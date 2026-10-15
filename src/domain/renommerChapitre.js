const cle = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Valide le nouveau titre d'un chapitre du catalogue avant envoi.
 * autresTitres : titres des AUTRES chapitres (la base n'impose pas l'unicité, l'app la garde pour éviter deux chapitres indiscernables).
 */
export function validerTitreChapitre({ titre, ancien, autresTitres = [] }) {
  const propre = String(titre ?? '').trim().replace(/\s+/g, ' ');
  if (!propre) return { ok: false, message: 'Le titre du chapitre ne peut pas être vide.' };
  if (propre === ancien) return { ok: false, message: 'Le titre est inchangé.' };
  if (autresTitres.some((t) => cle(t) === cle(propre))) {
    return { ok: false, message: `Un autre chapitre s'intitule déjà « ${propre} » (ou presque).` };
  }
  return { ok: true, titre: propre };
}
