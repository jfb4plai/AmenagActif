# Étape 3 : /verif, Mode Skill (entrées : sortie de l'étape 2 + guide de l'étape 1 + profil 01)

Skill source identifié : /seance-differenciee (3 niveaux) passé par /au-reformatage. Critères spécifiques : C6 à C9 de /seance-differenciee, C8 appliqué à la conformité AU.

Limite à garder en tête : cette vérification est faite par le même modèle que celui qui a produit les étapes 1 et 2. Elle repère les oublis de forme et de cohérence, pas les erreurs de fond. Votre relecture reste nécessaire.

```
RUBRIQUE QUALITÉ OUTPUT : /seance-differenciee + /au-reformatage
« La vie dans une ruche », 3e secondaire, français, lecture

CRITÈRES COMMUNS                          Score /3
C1 Utilisabilité immédiate                2/3
C2 Alignement référentiel FWB             2/3
C3 Qualité pédagogique                    2/3
C4 Contexte FWB et PLAI                   3/3
C5 Absence d'erreurs factuelles           3/3

CRITÈRES SPÉCIFIQUES                      Score /3
C6 Objectif identique dans les 3 niveaux  2/3
C7 Niveau A alternatif, Niveau C qualitatif  2/3
C8 AU présentes dans le niveau A          2/3
C9 Guide enseignant complet               2/3

TOTAL : 20 / 27   →   74 %

VERDICT : 🟠 À RETRAVAILLER (60-79 %, aucun critère à 0)
```

## Contrôle code par code (liste de contrôle du profil)

| Code | Résultat | Où / pourquoi |
|---|---|---|
| `ar_supports_mise_en_page` | ⚠️ partiel | Structure AU appliquée. Arial 14, interligne 1,5 et A4 ne sont pas vérifiables dans un .md : ils dépendent de l'export (voir correction 5). |
| `ar_supports_reformuler_consignes` | ⚠️ partiel | Exemples concrets présents dans Forêt (ex. 1, 2) et Prairie (ex. 1, 2). Absents dans Montagne. |
| `ar_supports_arial_14` | ⚠️ non vérifiable | Même raison. |
| `ar_supports_consignes_epurees` | ⚠️ partiel | Une action par puce partout sauf Montagne ex. 2 (deux verbes : « Dis… Justifie ») et Défi. |
| `ar_supports_consigne_avant_support` | ✓ | Guide enseignant, phase « 5 min : consignes orales avant distribution ». |
| `ar_supports_carte_mentale_oui` | ✓ | Exercice 4 des trois versions. |
| `ar_lecture_preparer_textes_longs` | ✓ | Marqué « non appliqué » avec raison (texte court), comme le prévoit l'en-tête de lecture du profil. |
| `ar_lecture_lire_voix_haute` / `ar_lecture_voix_haute_jamais` | ✓ | Conflit traité dans le guide : volontaires seulement, jamais à tour de rôle. |
| `ar_lecture_numeroter_lignes` | ❌ | Seul le document Forêt contient le texte numéroté. Prairie et Montagne renvoient à Forêt : un élève de ces versions n'a pas le texte sous les yeux. |
| `ar_lecture_fluo_oui` | ✓ | « Surligne » dans les trois versions, surligneur dans le matériel. |

## Points forts

- L'objectif de compétence et le texte sont les mêmes pour tous. Le Niveau A (Forêt) est un chemin alternatif (lexique, modèle, choix guidés), pas un texte appauvri.
- Les AR du profil sont appliqués aux trois versions, pas seulement à Forêt : un aménagement ne dépend pas du niveau de difficulté.
- Le conflit voix haute / jamais est traité par une règle utilisable en classe, sans désigner d'élève.
- Étape 2 : trois items défectueux de l'étape 1 ont été détectés et corrigés (banque de mots ambiguë, bonus sans solution, formulation floue).

## Points faibles

- Prairie et Montagne ne contiennent pas le texte (« identique, voir document Forêt »). Contraire à AU2 (consignes et tâches sur une même page) et au critère « un remplaçant peut l'utiliser sans explication ». Ce défaut a aussi fait tomber `ar_lecture_numeroter_lignes`.
- Le « Défi » de Montagne, tel que réécrit à l'étape 2, est lui-même mal formé : demander de relever « une information qui ne dit pas pourquoi les mâles ne piquent pas » est confus. La correction de l'étape 2 a introduit un nouveau défaut.
- Les trois « But » ne sont pas formulés de la même façon (« trouver de quoi parle un texte » / « justifier avec trois informations » / « puis transférer »). L'objectif commun doit figurer mot pour mot, formulé au niveau de langue de chacun.
- Guide enseignant : tableau « ce qui diffère » remplacé par une phrase, pas de nombre d'élèves par version (le profil collectif n'en donne pas : à compléter par l'enseignant).
- Référentiel : « compétences terminales, 2e degré » non confirmé. À vérifier.

## Corrections prioritaires

1. Recopier le texte numéroté L1 à L12 en entier dans Prairie et Montagne.
2. Remplacer le Défi de Montagne par : « **Cherche** dans le texte pourquoi les mâles ne piquent pas. **Écris** ce que le texte dit et ce qu'il ne dit pas. »
3. Scinder Montagne ex. 2 en deux puces (une action chacune) et ajouter un exemple concret aux ex. 1 et 2.
4. Écrire le même objectif commun dans les trois « But », avec la formulation de Forêt adaptée à chaque niveau de langue.
5. Produire la version imprimable en .docx (Arial 14, interligne 1,5, A4, numéros de page) : les aménagements de mise en page ne se vérifient pas dans un .md.
6. Confirmer l'intitulé du référentiel FWB avant diffusion.

## Recommandation

🟠 Modifier avant impression : corrections 1 à 4. Ensuite, relancer /verif sur la version corrigée.

---

# Ce que cet essai dit de l'export .md

À reprendre dans la spec avant de planifier l'implémentation :

1. **La liste de contrôle a servi.** Elle a permis de contrôler code par code, et a fait ressortir le défaut le plus concret (numérotation des lignes absente). À conserver telle quelle.
2. **Les AR traversent les niveaux.** L'agent a dû le deviner. Ajouter au « Comment lire ce fichier » : « Les aménagements raisonnables ne dépendent pas du niveau de difficulté des élèves : applique-les à toutes les versions d'un support ».
3. **Il faut un statut « non applicable » explicite.** `ar_lecture_preparer_textes_longs` ne s'appliquait pas (texte court). Ajouter : « Pour chaque code de la liste de contrôle, indique : appliqué, non applicable (avec la raison), ou non appliqué (avec la raison) ».
4. **Le conflit est utile.** La section « Points d'attention » a forcé une règle de classe concrète. À conserver.
5. **Le format de sortie compte.** Arial 14 et la mise en page ne se contrôlent pas dans un .md. Les skills de la chaîne devraient produire un .docx pour les supports imprimés, ou le .md doit dire quel contrôle est impossible.
6. **Le profil collectif suffit pour cet usage.** L'enseignant doit répartir les versions lui-même. Aucune information individuelle n'a manqué à la chaîne, ce qui confirme l'option 1.

---

# Suite (même jour) : points 2 et 3 testés, non retenus

Les points 2 et 3 ci-dessus (deux consignes ajoutées à l'en-tête de lecture) ont été testés à froid : 4 exécutions de `/seance-differenciee`, 2 avec le profil sans ces consignes, 2 avec. Aucun bénéfice mesurable. Résultats et sorties : `ab-test/`. La liste de contrôle seule suffit.
