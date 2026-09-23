import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheClasse } from '../domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../domain/projections/fusionClasses.js';

/** Charge les données brutes d'une classe (sans les projeter) — réutilisé par
 * chargerClasse() (fiche seule) et useFicheGroupe() (aperçu multi-classes). */
export async function chargerDonneesClasse(classeId) {
  const { data: classe, error } = await supabase
    .from('ar_classes')
    .select('id, nom, niveau, referent_plai_nom, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId).single();
  if (error) throw error;

  const { data: eleves } = await supabase
    .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, commentaire, statut, created_at').eq('classe_id', classeId).order('prenom');
  const eleveIds = eleves.map((e) => e.id);

  const [cat, chap, au, sel, lib, liensEcole] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_amenagements_classe').select('amenagement_id, cree_le').eq('classe_id', classeId),
    eleveIds.length ? supabase.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds) : { data: [] },
    eleveIds.length ? supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte, cree_le').in('eleve_id', eleveIds) : { data: [] },
    // Comptes referent_plai/direction multi-écoles rattachés à cette école via ar_profils_acces_ecoles.
    supabase.from('ar_profils_acces_ecoles').select('user_id').eq('ecole_id', classe.ecole_id),
  ]);

  const userIdsMultiEcoles = (liensEcole.data ?? []).map((l) => l.user_id);
  const { data: refRows } = await supabase
    .from('ar_profils_acces')
    .select('user_id, nom, role, niveaux, ecole_id')
    .in('role', ['direction', 'referent_plai']);
  // Un compte est référent de cette classe soit via l'ancienne colonne ecole_id
  // (une seule école), soit via ar_profils_acces_ecoles (multi-écoles).
  const referents = (refRows ?? [])
    .filter((r) => r.ecole_id === classe.ecole_id || userIdsMultiEcoles.includes(r.user_id))
    .map((r) => ({ nom: r.nom, fonction: r.role, niveaux: r.niveaux ?? null }));

  return {
    classe,
    contexte: { classeNom: classe.nom, ecoleNom: classe.ar_ecoles?.nom ?? '', anneeLibelle: classe.ar_annees?.libelle ?? '' },
    eleves,
    amenagements: cat.data,
    chapitres: chap.data,
    auClasse: au.data,
    selectionsAR: sel.data,
    libres: lib.data,
    referents,
  };
}

export function useFicheClasse(classeId) {
  return useQuery({
    queryKey: ['fiche-classe', classeId],
    enabled: !!classeId,
    queryFn: async () => computeFicheClasse(await chargerDonneesClasse(classeId)),
  });
}

/** Aperçu authentifié d'une fiche groupée (plusieurs classes fusionnées) —
 * avant de générer le lien public à envoyer. */
export function useFicheGroupe(classeIds, nomGroupe) {
  return useQuery({
    queryKey: ['fiche-groupe', classeIds, nomGroupe],
    enabled: Array.isArray(classeIds) && classeIds.length >= 2,
    queryFn: async () => {
      const parties = await Promise.all(classeIds.map(chargerDonneesClasse));
      const fusion = fusionnerDonneesClasses(parties, nomGroupe);
      const vm = computeFicheClasse(fusion);
      vm.classesSources = fusion.classesSources;
      return vm;
    },
  });
}
