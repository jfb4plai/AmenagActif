---
schema: plai.profil-classe
version: 1
emis_le: 2026-10-05T09:00:00.000Z
fiche_du: 2026-10-01
expire_le: 2026-11-04
classe: "3B (classe fictive)"
niveau: "3e secondaire"
---

# Profil d'aménagements de la classe 3B (classe fictive)

## Comment lire ce fichier

- Ce fichier décrit les aménagements d'une classe entière. Il ne contient aucune donnée d'élève.
- Les effectifs sont des tranches (`1-2`, `3-5`, `6+`), jamais un nombre exact.
- Ne cherche pas à identifier ni à deviner d'élève. N'attribue un aménagement à personne en particulier.
- Un code désigne un aménagement du catalogue AménagActif. Un code que tu ne sais pas appliquer est signalé « non appliqué », avec son libellé. Il n'est jamais ignoré en silence.
- Ce fichier est valable jusqu'au 2026-11-04. Au-delà, demande un nouvel export.

## Aménagements universels (AU)

Pour toute la classe.

### supports

- Mise en page (`ar_supports_mise_en_page`)
- Reformuler et clarifier les consignes ; proposer des exemples concrets (`ar_supports_reformuler_consignes`)

## Aménagements raisonnables (AR)

### supports

- Rédiger le cours en Arial 14 (`ar_supports_arial_14`), effectif : 1-2
- Rédiger des consignes, sans élément distracteur, comprenant uniquement les éléments essentiels à sa résolution (verbes d'actions) (`ar_supports_consignes_epurees`), effectif : 3-5
- Donner la consigne AVANT de distribuer le support (`ar_supports_consigne_avant_support`), effectif : 3-5
- Utiliser des cartes mentales (`ar_supports_carte_mentale_oui`), effectif : 3-5

### lecture

- Préparer les textes longs, à domicile, avant la leçon (`ar_lecture_preparer_textes_longs`), effectif : 1-2
- Lire à voix haute (`ar_lecture_lire_voix_haute`), effectif : 1-2
- Ne jamais faire lire à voix haute (`ar_lecture_voix_haute_jamais`), effectif : 1-2
- Numéroter les lignes dans les textes (`ar_lecture_numeroter_lignes`), effectif : 3-5
- Utiliser du fluo pour mettre en évidence les éléments essentiels, les consignes et les mots clés (`ar_lecture_fluo_oui`), effectif : 3-5

## Points d'attention

- Incompatibles dans cette classe : `ar_lecture_lire_voix_haute` et `ar_lecture_voix_haute_jamais`
- Certains aménagements de la classe ne sont pas transmis. Le profil est incomplet.
- Des aménagements individuels libres existent. Leur contenu n'est pas transmis.

## Liste de contrôle

- [ ] `ar_supports_mise_en_page` : Mise en page
- [ ] `ar_supports_reformuler_consignes` : Reformuler et clarifier les consignes ; proposer des exemples concrets
- [ ] `ar_supports_arial_14` : Rédiger le cours en Arial 14
- [ ] `ar_supports_consignes_epurees` : Rédiger des consignes, sans élément distracteur, comprenant uniquement les éléments essentiels à sa résolution (verbes d'actions)
- [ ] `ar_supports_consigne_avant_support` : Donner la consigne AVANT de distribuer le support
- [ ] `ar_supports_carte_mentale_oui` : Utiliser des cartes mentales
- [ ] `ar_lecture_preparer_textes_longs` : Préparer les textes longs, à domicile, avant la leçon
- [ ] `ar_lecture_lire_voix_haute` : Lire à voix haute
- [ ] `ar_lecture_voix_haute_jamais` : Ne jamais faire lire à voix haute
- [ ] `ar_lecture_numeroter_lignes` : Numéroter les lignes dans les textes
- [ ] `ar_lecture_fluo_oui` : Utiliser du fluo pour mettre en évidence les éléments essentiels, les consignes et les mots clés

## Rappel

L'IA propose, l'enseignant décide et personnalise. Aucune décision automatique sur un élève.
