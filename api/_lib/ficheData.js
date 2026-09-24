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
  const { data: profil } = await db.from('ar_profils_acces').select('role, ecole_id').eq('user_id', userId).maybeSingle();
  if (!profil) return false;
  if (profil.role === 'admin') return true;
  // Génération de lien enseignant réservée à referent_plai/direction (comme le
  // bouton "Copier le lien" côté écran, déjà masqué pour agent_plai).
  if (!['referent_plai', 'direction'].includes(profil.role)) return false;

  const { data: classes, error: ec } = await db.from('ar_classes').select('id, ecole_id').in('id', classeIds);
  if (ec || !classes || classes.length !== classeIds.length) return false;

  const { data: liens } = await db.from('ar_profils_acces_ecoles').select('ecole_id').eq('user_id', userId);
  const mesEcoles = new Set([profil.ecole_id, ...(liens ?? []).map((l) => l.ecole_id)].filter(Boolean));
  return classes.every((c) => mesEcoles.has(c.ecole_id));
}
