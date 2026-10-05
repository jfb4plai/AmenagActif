# Profil d'aménagements de mes classes : 3LA, 3LB, 3LC

```yaml
schema: plai.profil-classes
version: 1
emis_le: 2026-10-05
expire_le: 2026-11-04
classes: [3LA, 3LB, 3LC]
niveaux: [3e secondaire]
```

## Comment lire ce fichier

- Ce fichier décrit les aménagements de classes entières. Il ne contient aucune donnée d'élève.
- Les effectifs sont des tranches (`1-2`, `3-5`, `6+`), jamais un nombre exact, jamais cumulés entre classes.
- Ne cherche pas à identifier ni à deviner d'élève. N'attribue un aménagement à personne en particulier.
- Un code désigne un aménagement du catalogue AménagActif. Un code que tu ne sais pas appliquer est signalé « non appliqué », avec son libellé. Il n'est jamais ignoré en silence.
- Rédige chaque consigne destinée aux élèves ainsi : une puce par consigne, qui commence par un verbe d'action à l'infinitif (« Lire », « Surligner », pas « Lis », « Surligne »), avec un seul verbe d'action par puce. Une consigne qui demande trois actions s'écrit sur trois puces.
- Ce fichier est valable jusqu'au 2026-11-04. Au-delà, demande un nouvel export.

## À appliquer à toutes les classes

Aménagements présents dans les 3 classes : à appliquer d'office à un support unique.

### supports

- Donner la consigne AVANT de distribuer le support (`ar_supports_consigne_avant_support`), effectif par classe : 3LA 3-5, 3LB 3-5, 3LC 1-2
- Rédiger des consignes, sans élément distracteur, comprenant uniquement les éléments essentiels à sa résolution (verbes d'actions) (`ar_supports_consignes_epurees`), effectif par classe : 3LA 3-5, 3LB 1-2, 3LC 3-5
- Mise en page (`ar_supports_mise_en_page`)
- Reformuler et clarifier les consignes ; proposer des exemples concrets (`ar_supports_reformuler_consignes`)

### lecture

- Numéroter les lignes dans les textes (`ar_lecture_numeroter_lignes`), effectif par classe : 3LA 3-5, 3LB 1-2, 3LC 3-5

## À prévoir pour certaines classes

- Ne pas utiliser de fluo (`ar_lecture_fluo_non`) : 3LB (1-2)
- Utiliser du fluo pour mettre en évidence les éléments essentiels, les consignes et les mots clés (`ar_lecture_fluo_oui`) : 3LA (1-2)
- Lire à voix haute (`ar_lecture_lire_voix_haute`) : 3LA (1-2)
- Préparer les textes longs, à domicile, avant la leçon (`ar_lecture_preparer_textes_longs`) : 3LB (1-2)
- Ne jamais faire lire l’élève à voix haute (`ar_lecture_voix_haute_jamais`) : 3LB (1-2)
- Rédiger le cours en Arial 14 (`ar_supports_arial_14`) : 3LA (1-2), 3LC (3-5)
- Ne pas utiliser de carte mentale (`ar_supports_carte_mentale_non`) : 3LB (1-2)
- Utiliser des cartes mentales (`ar_supports_carte_mentale_oui`) : 3LA (1-2), 3LC (3-5)
- Fournir le cours en A3 (`ar_supports_cours_a3`) : 3LC (1-2)
- Utiliser des annotations et vignettes dans le dictionnaire (`ar_supports_dictionnaire_annote`) : 3LC (1-2)

## Incompatibilités

- Entre classes : un seul support ne peut pas satisfaire `ar_supports_carte_mentale_oui` (3LA, 3LC) et `ar_supports_carte_mentale_non` (3LB). Prévoir deux variantes.
- Entre classes : un seul support ne peut pas satisfaire `ar_lecture_lire_voix_haute` (3LA) et `ar_lecture_voix_haute_jamais` (3LB). Prévoir deux variantes.
- Entre classes : un seul support ne peut pas satisfaire `ar_lecture_fluo_oui` (3LA) et `ar_lecture_fluo_non` (3LB). Prévoir deux variantes.

## Liste de contrôle

Appliquer à toutes les classes :

- [ ] `ar_lecture_numeroter_lignes` : Numéroter les lignes dans les textes
- [ ] `ar_supports_consigne_avant_support` : Donner la consigne AVANT de distribuer le support
- [ ] `ar_supports_consignes_epurees` : Rédiger des consignes, sans élément distracteur, comprenant uniquement les éléments essentiels à sa résolution (verbes d'actions)
- [ ] `ar_supports_mise_en_page` : Mise en page
- [ ] `ar_supports_reformuler_consignes` : Reformuler et clarifier les consignes ; proposer des exemples concrets

Appliquer à certaines classes seulement :

- [ ] `ar_lecture_fluo_non` : Ne pas utiliser de fluo (3LB uniquement)
- [ ] `ar_lecture_fluo_oui` : Utiliser du fluo pour mettre en évidence les éléments essentiels, les consignes et les mots clés (3LA uniquement)
- [ ] `ar_lecture_lire_voix_haute` : Lire à voix haute (3LA uniquement)
- [ ] `ar_lecture_preparer_textes_longs` : Préparer les textes longs, à domicile, avant la leçon (3LB uniquement)
- [ ] `ar_lecture_voix_haute_jamais` : Ne jamais faire lire l’élève à voix haute (3LB uniquement)
- [ ] `ar_supports_arial_14` : Rédiger le cours en Arial 14 (3LA, 3LC uniquement)
- [ ] `ar_supports_carte_mentale_non` : Ne pas utiliser de carte mentale (3LB uniquement)
- [ ] `ar_supports_carte_mentale_oui` : Utiliser des cartes mentales (3LA, 3LC uniquement)
- [ ] `ar_supports_cours_a3` : Fournir le cours en A3 (3LC uniquement)
- [ ] `ar_supports_dictionnaire_annote` : Utiliser des annotations et vignettes dans le dictionnaire (3LC uniquement)

## Rappel

L'IA propose, l'enseignant décide et personnalise. Aucune décision automatique sur un élève.
