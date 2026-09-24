// Accès base des liens enseignants. Toujours appelé avec le client service role : les contrôles
// d'autorisation sont faits par les appelants (api/*.js) avant d'arriver ici.
import { hasherSecret, finAnneeScolaire, statutLien, MAX_CLASSES_PAR_LIEN } from './liens.js';

/** Erreur métier : message affichable tel quel au client (aucune donnée personnelle). */
export class ErreurLien extends Error {
  constructor(statut, message) {
    super(message);
    this.name = 'ErreurLien';
    this.statut = statut;
  }
}

/**
 * Crée un lien pour des classes de la MÊME école et de la MÊME année. Ne stocke que le hash.
 * @returns {Promise<{ id: string, expire_le: string }>}
 */
export async function creerLien(db, { userId, classeIds, destinataire, nomGroupe, secret, now = new Date() }) {
  const ids = [...new Set(classeIds)];
  if (ids.length === 0 || ids.length > MAX_CLASSES_PAR_LIEN) throw new ErreurLien(400, `Un lien regroupe de 1 à ${MAX_CLASSES_PAR_LIEN} classes.`);

  const { data: classes, error } = await db.from('ar_classes').select('id, ecole_id, annee_id, ar_annees(libelle)').in('id', ids);
  if (error) throw error;
  if (!classes || classes.length !== ids.length) throw new ErreurLien(400, 'Classe introuvable.');
  const ecoles = new Set(classes.map((c) => c.ecole_id));
  const annees = new Set(classes.map((c) => c.annee_id));
  if (ecoles.size !== 1 || annees.size !== 1) throw new ErreurLien(400, "Toutes les classes d'un lien doivent appartenir à la même école et à la même année scolaire.");

  const expire_le = finAnneeScolaire(classes[0].ar_annees?.libelle);
  if (!expire_le) throw new ErreurLien(400, "Impossible de déterminer la fin de l'année scolaire de cette classe.");
  if (expire_le < now.toISOString().slice(0, 10)) throw new ErreurLien(400, 'Cette année scolaire est terminée : aucun lien ne peut être créé.');

  const { data: lien, error: eIns } = await db.from('ar_liens').insert({
    token_hash: hasherSecret(secret),
    ecole_id: classes[0].ecole_id,
    annee_id: classes[0].annee_id,
    destinataire,
    nom_groupe: nomGroupe || null,
    cree_par: userId,
    expire_le,
  }).select('id').single();
  if (eIns) throw eIns;

  const { error: eCl } = await db.from('ar_liens_classes').insert(ids.map((classe_id) => ({ lien_id: lien.id, classe_id })));
  if (eCl) {
    await db.from('ar_liens').delete().eq('id', lien.id); // pas de lien orphelin sans classes
    throw eCl;
  }
  return { id: lien.id, expire_le };
}

const COLONNES_LIEN = 'id, ecole_id, nom_groupe, expire_le, revoque_le';

async function classesDuLien(db, lienId) {
  const { data, error } = await db.from('ar_liens_classes').select('classe_id').eq('lien_id', lienId);
  if (error) throw error;
  return (data ?? []).map((r) => r.classe_id);
}

async function enrichir(db, lien) {
  return { ...lien, classeIds: await classesDuLien(db, lien.id) };
}

/** Retrouve un lien par son secret en clair (hash calculé ici). null si inconnu. */
export async function trouverLienParSecret(db, secret) {
  const { data, error } = await db.from('ar_liens').select(COLONNES_LIEN).eq('token_hash', hasherSecret(secret)).maybeSingle();
  if (error) throw error;
  return data ? enrichir(db, data) : null;
}

/** Retrouve un lien par id (revérification à chaque lecture d'un jeton de profil). */
export async function trouverLienParId(db, id) {
  const { data, error } = await db.from('ar_liens').select(COLONNES_LIEN).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? enrichir(db, data) : null;
}

/** Lien utilisable : existe, ni révoqué ni expiré. */
export const lienActif = (lien, now = new Date()) => !!lien && statutLien(lien, now) === 'actif';

/**
 * Compte une ouverture (RPC atomique : au plus une incrémentation par heure et par lien).
 * Un échec de comptage ne doit jamais empêcher l'affichage de la fiche.
 */
export async function compterOuverture(db, lienId) {
  try {
    const { error } = await db.rpc('ar_lien_compter_ouverture', { p_id: lienId });
    if (error) console.error('liens : compteur indisponible', error.code ?? '');
  } catch {
    console.error('liens : compteur indisponible');
  }
}

/** Révoque (idempotent, ne supprime jamais). @returns {Promise<'revoque'|'deja'>} */
export async function revoquerLien(db, lienId, userId) {
  const { data, error } = await db.from('ar_liens')
    .update({ revoque_le: new Date().toISOString(), revoque_par: userId })
    .eq('id', lienId).is('revoque_le', null).select('id');
  if (error) throw error;
  return data && data.length > 0 ? 'revoque' : 'deja';
}
