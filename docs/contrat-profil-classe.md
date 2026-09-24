# Contrat `plai.profil-classe` v1

Produit par `computeProfilClasse` (`src/domain/projections/profilClasse.js`), servi par `api/profil-classe.js`. Fonction pure, sans donnée nominative. Version du schéma : 1 (aucune app cible ne le consomme encore : les noms de champs ont été révisés sans changer le numéro de version, le 2026-09-24).

## Périmètre : le drapeau `partage_profil`

Un aménagement du catalogue (AU ou AR) est publié si et seulement si `ar_amenagements.partage_profil` vaut `true`. Il vaut `true` par défaut : tout nouvel aménagement est transmis. Une exception se décoche dans l'Administration (« Ne pas transmettre aux autres apps »). Le périmètre ne dépend d'aucun numéro d'ordre de chapitre. Si la valeur est absente ou différente de `true`, l'élément n'est pas publié.

Chaque aménagement et chaque chapitre reçoivent un code automatique à la création (déclencheur SQL). Un code n'est jamais modifié. Un code ne dit pas que l'app cible sait appliquer l'aménagement : l'app cible décide, et présente un élément qu'elle ne sait pas appliquer comme « non appliqué automatiquement », avec son libellé.

## Schéma

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `schema` | string | oui | `"plai.profil-classe"` |
| `version` | number | oui | `1` |
| `emis_le` | string ISO 8601 | oui | date d'émission |
| `fiche_du` | string `AAAA-MM-JJ` | oui | date de la dernière saisie de la fiche |
| `expire_le` | string `AAAA-MM-JJ` | oui | fin de validité (30 jours, ou expiration du jeton) |
| `contexte` | objet | oui | `classe_libelle` (string), `niveau` (string ou null), `annee` (string), `ecole` (string) |
| `au` | tableau | oui | aménagements universels transmis, cochés pour la classe : `{ code, chapitre, libelle }` |
| `ar` | tableau | oui | aménagements raisonnables transmis : `{ code, chapitre, libelle, effectif }` ; `effectif` vaut `"1-2"`, `"3-5"` ou `"6+"` (jamais le nombre exact) |
| `non_codes` | tableau | oui | filet de sécurité : éléments transmis sans code (ne devrait plus arriver) : `{ chapitre, libelle }` |
| `elements_non_transmis_present` | booléen | oui | vrai si au moins un élément coché n'est pas transmis (drapeau décoché, ou AR porté par moins de `k` élèves, ou AR inclassable) |
| `libres_present` | booléen | oui | vrai si au moins un aménagement libre existe (texte jamais transmis) |
| `conflits` | tableau de paires de codes | oui | paires de codes publiés incompatibles (`REGLES_CONFLIT`) |

`chapitre` est le CODE du chapitre (par exemple `supports`), jamais son numéro d'ordre ; il vaut `null` si le chapitre n'a pas de code. Les tableaux sont triés de façon déterministe (chapitre, puis code).

Seuil `k` : option de la fonction, défaut 1 (aucune suppression). Un AR porté par moins de `k` élèves n'est pas détaillé et fait passer `elements_non_transmis_present` à vrai.

## Exclusions absolues

Jamais dans la sortie : prénom, initiale, commentaire, texte d'aménagement libre, nom du référent PLAI de la classe, statut IPT ou PAR, identifiant interne (UUID), effectif exact, libellé ou code d'un élément dont `partage_profil` est faux. Ces exclusions sont couvertes par `tests/domain/profilClasse.test.js` (groupes « NON-FUITE » et « partage_profil »).
