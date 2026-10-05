# Essai de pertinence : synthèse multi-classes (2026-10-05)

Question : la synthèse multi-classes (socle commun, compléments par classe, incompatibilités, liste de contrôle) améliore-t-elle le matériel produit par une IA pour un enseignant qui donne le même cours dans trois classes ?

Conditions, 2 exécutions à froid chacune, même séance (la ruche), même skill (`seance-differenciee`), trois classes fictives 3LA, 3LB, 3LC aux aménagements volontairement incompatibles (carte mentale, fluo, lecture à voix haute). Les deux entrées contiennent exactement les mêmes données (générées par `generer_entrees.py`) :
- **u** : trois profils séparés, un par classe (ce qu'un enseignant obtient aujourd'hui) : `entrees/A-trois-profils-separes.md`.
- **v** : la synthèse multi-classes de la spec v2 : `entrees/B-synthese-multi-classes.md`.

Rubrique et règle de décision fixées avant l'essai : `00-rubrique-fixee-avant.md`.

## Résultats

| Mesure | u-1 | u-2 | v-1 | v-2 |
|---|---|---|---|---|
| R1 : incompatibilités signalées (0 à 3, plus haut = mieux) | 3 | 2 | 3 | 3 |
| R2 : élément imposé à la classe qui l'exclut (0 à 3, plus bas = mieux) | 0 | 0 | 0 | 0 |
| R3 : codes du socle appliqués partout (0 à 5) | 5 | 5 | 5 | 5 |
| R4 : compléments attribués aux bonnes classes (sur 10) | 10 | 10 | 10 | 10 |

Règle de décision fixée : la synthèse est conservée si (R1 v moins R1 u) plus (R2 u moins R2 v) vaut au moins 2 en moyenne, sans recul sur R3 ni R4. Résultat : 0,5. **La synthèse n'atteint pas le seuil.**

Précision sur R1 (jugement, appliqué après coup à toutes les sorties) : une incompatibilité compte comme signalée si la sortie énonce au même endroit les deux traitements opposés pour les classes nommées. u-2 ne le fait pas pour le fluo (traité dans deux annexes séparées).

## Ce que l'essai montre

1. **Plafond atteint par la condition de base.** Avec trois profils séparés, l'IA a repéré seule les trois incompatibilités et ne les a violées dans aucun document. R2, R3 et R4 sont identiques partout. L'essai ne peut donc pas montrer d'avantage de la synthèse sur la justesse.
2. **La synthèse ne réduit pas le travail de l'enseignant.** Elle annonce « un support commun et des variantes ». En pratique : u-1 produit 9 documents (3 classes × 3 niveaux), v-1 aussi, 55 000 caractères. Seule u-2, qui avait les profils séparés, a construit l'économie attendue : 3 fiches de travail communes, une fiche texte commune et des annexes par classe (29 000 caractères).
3. **Risque de confusion entre « version » et « classe ».** Avec la synthèse, v-2 a lu « trois versions » comme « trois classes » : un document par classe, sans différenciation par niveau (le cœur de `seance-differenciee`). Une exécution sur deux, à surveiller.
4. **Ce que le profil apporte quand même** : la liste de contrôle code par code et les statuts (« appliqué », « non appliqué », « partiel ») sont présents dans les 4 sorties, avec ou sans synthèse.

## Limites

- Comptage fait par le même modèle que celui qui a lancé l'essai, non en aveugle.
- Un seul cas, trois classes fictives, deux exécutions par condition.
- Le test mesure le comportement de l'IA, pas la perception d'un enseignant (temps de lecture, nombre de pages à imprimer, confiance). Un essai avec un enseignant réel reste nécessaire.
- Les classes fictives sont conçues pour avoir des incompatibilités nettes. En réel, les profils peuvent être plus proches (moins de conflits) ou plus nombreux (plus d'erreurs possibles).

## Conséquence

La règle de décision fixée avant l'essai conduit à revoir la fonctionnalité : la synthèse multi-classes n'est pas justifiée par la justesse du résultat. L'avantage à rechercher ailleurs est l'**économie de documents** (un support commun plus des variantes minimales), que la synthèse seule ne produit pas. Décision à prendre par JF : voir la spec, section « Validation de la pertinence ».
