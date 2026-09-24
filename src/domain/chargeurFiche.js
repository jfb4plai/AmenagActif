/**
 * Chargeur unique des données brutes d'une classe pour la fiche.
 * Utilisé par le client (useFicheClasse, client Supabase authentifié, RLS) ET par
 * le serveur (api/_lib/ficheData.js, service role). Une seule liste de colonnes et
 * une seule règle de référents : évite la divergence relevée à l'audit (I1, I2).
 * Toute erreur Supabase est levée : jamais de fiche partielle silencieuse (I3).
 */

export const COLONNES_CLASSE = 'id, nom, niveau, referent_plai_nom, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)';
export const COLONNES_ELEVES = 'id, classe_id, prenom, initiale_nom, commentaire, statut, created_at';
export const COLONNES_AMENAGEMENTS = 'id, chapitre_id, ordre, libelle, type, code, partage_profil';
export const COLONNES_CHAPITRES = 'id, ordre, titre, code';
export const COLONNES_AU_CLASSE = 'amenagement_id, cree_le';
export const COLONNES_SELECTIONS = 'eleve_id, amenagement_id, cree_le';
export const COLONNES_LIBRES = 'id, eleve_id, chapitre_id, texte, cree_le';
export const COLONNES_PROFILS = 'user_id, nom, role, niveaux, ecole_id';
export const ROLES_REFERENTS = ['direction', 'referent_plai'];

function verifier(resultat, contexte) {
  if (resultat.error) {
    const e = resultat.error;
    throw Object.assign(new Error(`Chargement de la fiche impossible (${contexte}) : ${e.message ?? e}`), { cause: e });
  }
  return resultat.data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} classeId
 */
export async function chargerDonneesClasseAvec(db, classeId) {
  const rClasse = await db.from('ar_classes').select(COLONNES_CLASSE).eq('id', classeId).single();
  if (rClasse.error) throw Object.assign(new Error(`Chargement de la fiche impossible (classe) : ${rClasse.error.message ?? rClasse.error}`), { cause: rClasse.error });
  const classe = rClasse.data;
  if (!classe) throw new Error('Chargement de la fiche impossible (classe) : introuvable.');

  const eleves = verifier(
    await db.from('ar_eleves').select(COLONNES_ELEVES).eq('classe_id', classeId).order('prenom'),
    'élèves',
  );
  const eleveIds = eleves.map((e) => e.id);
  const vide = Promise.resolve({ data: [], error: null });

  const [cat, chap, au, sel, lib, liensEcole, profils] = await Promise.all([
    db.from('ar_amenagements').select(COLONNES_AMENAGEMENTS),
    db.from('ar_chapitres').select(COLONNES_CHAPITRES).order('ordre'),
    db.from('ar_amenagements_classe').select(COLONNES_AU_CLASSE).eq('classe_id', classeId),
    eleveIds.length ? db.from('ar_selections').select(COLONNES_SELECTIONS).in('eleve_id', eleveIds) : vide,
    eleveIds.length ? db.from('ar_amenagements_libres').select(COLONNES_LIBRES).in('eleve_id', eleveIds) : vide,
    // Comptes multi-écoles rattachés à cette école via ar_profils_acces_ecoles.
    db.from('ar_profils_acces_ecoles').select('user_id').eq('ecole_id', classe.ecole_id),
    db.from('ar_profils_acces').select(COLONNES_PROFILS).in('role', ROLES_REFERENTS),
  ]);

  const userIdsMulti = new Set(verifier(liensEcole, 'rattachements écoles').map((l) => l.user_id));
  // Référent de la classe : ancienne colonne ecole_id OU ar_profils_acces_ecoles.
  const referents = verifier(profils, 'référents')
    .filter((r) => r.ecole_id === classe.ecole_id || userIdsMulti.has(r.user_id))
    .map((r) => ({ nom: r.nom, fonction: r.role, niveaux: r.niveaux ?? null }));

  return {
    classe,
    contexte: { classeNom: classe.nom, ecoleNom: classe.ar_ecoles?.nom ?? '', anneeLibelle: classe.ar_annees?.libelle ?? '' },
    eleves,
    amenagements: verifier(cat, 'catalogue'),
    chapitres: verifier(chap, 'chapitres'),
    auClasse: verifier(au, 'aménagements universels'),
    selectionsAR: verifier(sel, 'sélections'),
    libres: verifier(lib, 'aménagements libres'),
    referents,
  };
}
