import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheClasse } from '../domain/projections/ficheClasse.js';
import { chargerDonneesClasseAvec } from '../domain/chargeurFiche.js';
import { fusionnerDonneesClasses } from '../domain/projections/fusionClasses.js';

/** Charge les données brutes d'une classe (sans les projeter) - réutilisé par
 * useFicheClasse() (fiche seule) et useFicheGroupe() (aperçu multi-classes).
 * Logique partagée avec le serveur : src/domain/chargeurFiche.js. Lève en cas d'erreur. */
export function chargerDonneesClasse(classeId) {
  return chargerDonneesClasseAvec(supabase, classeId);
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
