/**
 * Vrai si un rappel de bascule d'année doit s'afficher :
 * entre le 15 août et le 31 décembre, et l'année active se termine
 * au plus tard l'année civile en cours (ou aucune année active).
 * Module pur : aucun import Supabase (testable sans variables d'environnement).
 */
export function besoinBasculeAnnee(anneeActive, now = new Date()) {
  const mois = now.getMonth(); // 0 = janvier
  const enPeriode = (mois === 7 && now.getDate() >= 15) || mois >= 8;
  if (!enPeriode) return false;
  if (!anneeActive) return true;
  const finAnnee = Number(String(anneeActive.libelle).split('-')[1]);
  if (!Number.isFinite(finAnnee)) return false;
  return finAnnee <= now.getFullYear();
}
