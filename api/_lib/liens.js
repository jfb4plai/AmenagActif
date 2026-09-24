// Logique PURE des liens enseignants (aucun accès base) : testable sans Supabase.
import { randomBytes, createHash } from 'node:crypto';

export const MAX_CLASSES_PAR_LIEN = 10;
export const MAX_DESTINATAIRE = 80;
export const MAX_NOM_GROUPE = 60;
export const ROLES_GESTION_LIENS = ['admin', 'referent_plai', 'direction']; // PAS agent_plai
export const MESSAGE_LIEN_INACTIF = "Ce lien n'est plus actif. Demandez un nouveau lien à votre référent.";

/** Secret aléatoire de 32 octets, base64url (43 caractères, jamais de point). */
export function genererSecret() {
  return randomBytes(32).toString('base64url');
}

/** Empreinte SHA-256 hexadécimale : seule valeur stockée en base. */
export function hasherSecret(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

export const formeSecretValide = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s);

/** Un JWT (jose) contient toujours des points ; un secret opaque jamais. */
export const estFormeJwt = (s) => typeof s === 'string' && s.includes('.');

/**
 * Fin d'année scolaire : ar_annees n'a pas de colonne de date de fin. Hypothèse : libellé « AAAA-AAAA »
 * (ex. « 2026-2027 »), fin = 31 août de la seconde année. Retourne 'AAAA-08-31', ou null si libellé illisible.
 */
export function finAnneeScolaire(libelle) {
  const m = /^\s*(\d{4})\s*[-–/]\s*(\d{4})\s*$/.exec(String(libelle ?? ''));
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b !== a + 1) return null;
  return `${b}-08-31`;
}

/** Date du jour (AAAA-MM-JJ) à Bruxelles : un lien reste actif toute la journée d'expire_le. */
export function aujourdhui(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(now);
}

/** Révocation prioritaire ; sinon expiré dès le lendemain de expire_le. @returns {'actif'|'expire'|'revoque'} */
export function statutLien(lien, now = new Date()) {
  if (lien.revoque_le) return 'revoque';
  if (aujourdhui(now) > String(lien.expire_le).slice(0, 10)) return 'expire';
  return 'actif';
}

export const peutGererLiens = (role) => ROLES_GESTION_LIENS.includes(role);

/**
 * Décision d'autorisation sur une école. profil = { role, ecole_id }, ecolesLiees = ids (ar_profils_acces_ecoles).
 * Admin : toutes les écoles ; referent_plai / direction : leurs écoles ; agent_plai et le reste : jamais.
 */
export function peutGererEcole(profil, ecolesLiees, ecoleId) {
  if (!profil || !peutGererLiens(profil.role)) return false;
  if (profil.role === 'admin') return true;
  return [profil.ecole_id, ...(ecolesLiees ?? [])].filter(Boolean).includes(ecoleId);
}

/** Ids d'écoles gérables : null = toutes (admin), sinon liste. */
export function ecolesGerables(profil, ecolesLiees) {
  if (!profil || !peutGererLiens(profil.role)) return [];
  if (profil.role === 'admin') return null;
  return [...new Set([profil.ecole_id, ...(ecolesLiees ?? [])].filter(Boolean))];
}

/** Expiration (secondes epoch) d'un jeton de profil : min(now + jours, fin de journée UTC de expire_le). */
export function plafonnerExpirationProfil(nowMs, jours, expireLe) {
  const naturelle = Math.floor(nowMs / 1000) + jours * 86400;
  if (!expireLe) return naturelle;
  const limite = Math.floor(Date.parse(`${String(expireLe).slice(0, 10)}T23:59:59Z`) / 1000);
  return Math.min(naturelle, limite);
}

/** Projection publique d'un lien : liste blanche de champs, token_hash n'en fait JAMAIS partie. */
export function versLienPublic(row, { classes = [], creePar = null, now = new Date() } = {}) {
  return {
    id: row.id,
    ecole_id: row.ecole_id,
    destinataire: row.destinataire,
    nom_groupe: row.nom_groupe ?? null,
    classes,
    cree_le: row.cree_le,
    cree_par: creePar,
    expire_le: row.expire_le,
    revoque_le: row.revoque_le ?? null,
    derniere_ouverture: row.derniere_ouverture ?? null,
    nb_ouvertures: row.nb_ouvertures ?? 0,
    statut: statutLien(row, now),
  };
}
