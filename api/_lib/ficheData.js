import { supabaseAdmin } from './supabaseAdmin.js';
import { chargerDonneesClasseAvec } from '../../src/domain/chargeurFiche.js';

/**
 * Charge toutes les lignes nécessaires aux projections pour une classe.
 * Même chargeur que le client (src/domain/chargeurFiche.js), avec le client service role.
 * @param {string} classeId
 */
export function loadClasseData(classeId) {
  return chargerDonneesClasseAvec(supabaseAdmin(), classeId);
}

/** Charge les données de plusieurs classes en parallèle (regroupement "cours pratique"). */
export async function loadClassesData(classeIds) {
  return Promise.all(classeIds.map((id) => loadClasseData(id)));
}

/**
 * Vérifie que l'utilisateur peut lire/éditer ces classes : admin, ou profil
 * (referent_plai/direction/agent_plai) rattaché à l'école de CHAQUE classe
 * (legacy ecole_id ou table ar_profils_acces_ecoles). Appelé depuis du code
 * service role (contourne la RLS), donc vérifié ici à la main.
 * @returns {Promise<boolean>}
 */
export async function verifierAccesClasses(db, userId, classeIds) {
  const { data: profil, error: eProfil } = await db.from('ar_profils_acces').select('role, ecole_id').eq('user_id', userId).maybeSingle();
  if (eProfil) throw eProfil; // panne base : le handler répond 500, pas un faux refus
  if (!profil) return false;
  if (profil.role === 'admin') return true;
  if (!['referent_plai', 'direction', 'agent_plai'].includes(profil.role)) return false;

  const { data: classes, error: ec } = await db.from('ar_classes').select('id, ecole_id').in('id', classeIds);
  if (ec) throw ec;
  if (!classes || classes.length !== new Set(classeIds).size) return false;

  return ecolesAccessibles(db, userId, profil, classes.map((c) => c.ecole_id));
}

/**
 * Même contrôle pour des fiches groupées enregistrées (leur école doit être celle de l'utilisateur).
 * Liste vide : true (rien à vérifier).
 * @returns {Promise<boolean>}
 */
export async function verifierAccesFichesGroupees(db, userId, ficheGroupeeIds) {
  const ids = [...new Set(ficheGroupeeIds)];
  if (ids.length === 0) return true;
  const { data: profil, error: eProfil } = await db.from('ar_profils_acces').select('role, ecole_id').eq('user_id', userId).maybeSingle();
  if (eProfil) throw eProfil;
  if (!profil) return false;
  const { data: fgs, error } = await db.from('ar_fiches_groupees').select('id, ecole_id').in('id', ids);
  if (error) throw error;
  if (!fgs || fgs.length !== ids.length) return false;
  if (profil.role === 'admin') return true;
  if (!['referent_plai', 'direction', 'agent_plai'].includes(profil.role)) return false;
  return ecolesAccessibles(db, userId, profil, fgs.map((f) => f.ecole_id));
}

async function ecolesAccessibles(db, userId, profil, ecoleIds) {
  const { data: liens, error: eLiens } = await db.from('ar_profils_acces_ecoles').select('ecole_id').eq('user_id', userId);
  if (eLiens) throw eLiens;
  const mesEcoles = new Set([profil.ecole_id, ...(liens ?? []).map((l) => l.ecole_id)].filter(Boolean));
  return ecoleIds.every((id) => mesEcoles.has(id));
}
