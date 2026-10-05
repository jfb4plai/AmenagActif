# Essai de la consigne de production (2026-10-05)

Question : une consigne dans l'en-tête du fichier (« un seul support pour toutes les classes, variantes seulement là où deux classes s'excluent ») réduit-elle le nombre de documents à préparer, sans abîmer le reste ?

Conditions : mêmes trois classes fictives, même séance, même skill, même prompt que l'essai précédent. Référence **u** (u-1 et u-2 de l'essai précédent) : trois profils sans la consigne. Variante **w** (w-1 et w-2) : les mêmes trois profils plus la consigne. Entrée : `entrees/C-trois-profils-plus-consigne-de-production.md`. Rubrique et seuils fixés avant l'essai : `00-rubrique-fixee-avant.md`.

## Résultats

| Mesure | Référence u-1 | Référence u-2 | w-1 | w-2 |
|---|---|---|---|---|
| D1 : documents élèves distincts à imprimer | 9 | 7 | 6 | 3 |
| N : trois niveaux de difficulté conservés | oui | oui | oui | non (un seul document, trois « chemins » intégrés) |
| R1 : incompatibilités signalées (sur 3) | 3 | 2 | 3 | 3 |
| R2 : élément imposé à la classe qui l'exclut (0 = mieux) | 0 | 0 | 0 | 0 |
| R3 : socle appliqué partout (sur 5) | 5 | 5 | 5 | 5 |
| R4 : compléments bien attribués (sur 10) | 10 | 10 | 10 | 10 |

D1 moyen : référence 8, avec la consigne 4,5. Seuil fixé : 5 ou moins. **Ce critère est atteint.**

Règle de décision complète fixée avant l'essai : D1 en baisse d'au moins 3, **et** niveaux conservés, **et** aucune violation, **et** socle 5 sur 5, **et** au moins 9 compléments sur 10. Tout est atteint sauf les niveaux : w-2 a fusionné les trois niveaux en une seule fiche (« coups de pouce » ouverts à tous, exercices 1 à 5, bloc « Pour aller plus loin »), en le signalant clairement dans son analyse. **Selon la règle fixée, la consigne n'est donc pas retenue telle qu'écrite.**

## Ce que l'essai montre

1. **La consigne fait baisser le nombre de documents**, de 8 à 4,5 en moyenne, sans erreur d'attribution ni violation d'une incompatibilité.
2. **Elle est ambiguë sur les niveaux.** « Un seul support » a été compris par w-2 comme « une seule fiche de travail », donc sans les trois niveaux de `seance-differenciee`. w-1 l'a comprise comme « une même fiche par niveau pour toutes les classes » : trois fiches, une feuille de texte, deux variantes. C'est ce que la consigne cherchait.
3. **Le choix de w-2 est défendable pédagogiquement** (un seul document, étayage ouvert à tous, aucune étiquette de niveau), mais il remplace la différenciation en trois fiches du skill par une conception à une fiche. C'est une décision pédagogique de JF, pas un détail de formulation.

## Limites

- Comptage des documents fait par le même modèle que celui qui lance l'essai, avec une règle écrite avant. Deux exécutions par condition, un seul cas fictif.
- La référence u vient d'un essai antérieur (même séance, même prompt, même skill, même modèle), pas d'exécutions simultanées.
- La conformité des consignes à la règle infinitif / un verbe par puce n'a pas été remesurée ici.
- Le test mesure l'IA, pas l'enseignant : pages à imprimer, temps de vérification et confiance restent à observer avec un enseignant réel.

## Conséquence

La consigne de production fonctionne sur le nombre de documents, mais sa formulation doit lever l'ambiguïté sur les niveaux. Reformulation proposée, à retester : « Produis un seul support pour toutes les classes. Garde les trois niveaux de difficulté de la séance : une même fiche par niveau sert toutes les classes. Ajoute une variante d'un document uniquement là où deux classes ont des aménagements qui s'excluent. La police et le format d'impression ne comptent pas comme des documents distincts. »
