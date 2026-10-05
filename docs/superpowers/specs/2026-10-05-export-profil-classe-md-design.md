# Export du profil de classes en Markdown : synthèse multi-classes pour l'enseignant

Date : 2026-10-05. Statut : version 2, **à revoir** : l'essai de pertinence du 2026-10-05 n'a pas atteint le seuil de décision fixé pour la synthèse multi-classes (voir « Validation de la pertinence »). Décision de JF requise avant tout plan d'implémentation.

## Problème réel

En secondaire, tout enseignant est multi-classes : 22 périodes par semaine en classe, au plus 9 périodes par matière, donc au moins 3 classes. Un lien enseignant couvre 1 à 10 classes de la même école et de la même année (`MAX_CLASSES_PAR_LIEN`).

Pour préparer un support (seul ou avec une IA), l'enseignant doit aujourd'hui lire plusieurs fiches et faire de tête la synthèse : qu'est-ce qui vaut pour toutes mes classes, qu'est-ce qui ne vaut que pour l'une d'elles, qu'est-ce qui est incompatible entre deux classes. Ce calcul est la valeur ajoutée à apporter. Un simple rendu du profil d'une classe en .md n'apporte presque rien (essai du 2026-10-05).

## Objectif

Pour un ensemble de classes d'un même enseignant, produire un fichier `.md` qui donne :
1. le **socle commun** : aménagements présents dans toutes les classes, à appliquer d'office à un support unique ;
2. les **compléments par classe** : aménagements présents dans certaines classes seulement, à prévoir en option ou en variante ;
3. les **incompatibilités entre classes** : deux aménagements qui ne peuvent pas être satisfaits par un seul support (exemple : carte mentale en 3B, pas de carte mentale en 3C) ;
4. la **liste de contrôle** pour vérifier un support code par code.

Le fichier est utilisable tel quel dans Claude, ChatGPT ou un skill PLAI. La même synthèse sert aussi aux apps (sortie JSON), pour que chaque usage en profite.

Aucun nom, prénom, initiale, surnom, pseudo, commentaire ni texte libre d'élève ne figure dans le fichier.

## Décisions

- **Profil collectif par classe, jamais par élève** (décision JF, 2026-10-05). Risque de ré-identification en classe, et commentaires susceptibles de contenir des noms.
- **Entrée principale : la fiche enseignant** (`/fiche/:token`), car c'est là qu'arrive l'enseignant. L'export couvre toutes les classes de son lien. Les référents ont le même export sur leurs pages (une classe, ou un groupe validé).
- **Pas de nouvelle logique de données.** On réutilise `computeProfilClasse` (contrat `plai.profil-classe` v1, `docs/contrat-profil-classe.md`) pour chaque classe, puis une synthèse pure par-dessus. Exclusions absolues, `partage_profil`, seuil `k` = 1 et tranches d'effectif (`1-2`, `3-5`, `6+`) s'appliquent tels quels.
- **Aucun effectif cumulé.** Les tranches restent par classe ; on n'additionne jamais (pas d'effectif exact déductible).
- **Nom de l'école omis.** Libellé de classe et niveau conservés.
- **En-tête de lecture minimal** (texte figé, voulu : instruction technique). Les deux consignes testées en plus ont été écartées (voir « Historique »).
- **Format des supports** : l'aide indique qu'Arial 14, interligne et A4 ne se vérifient pas dans un .md.

## Composants

### 1. Synthèse : `src/domain/projections/synthesePourClasses.js`

`synthesePourClasses(profils) -> synthèse`. Fonction pure, déterministe. `profils` = tableau de sorties de `computeProfilClasse` (1 à 10).

Contenu de la synthèse :
- `classes` : pour chaque classe `{ libelle, niveau, elements_non_transmis_present, libres_present }`.
- `socle` : éléments (AU et AR) dont le `code` figure dans **toutes** les classes. Pour un AR : tranche par classe `{ code, chapitre, libelle, type, parClasse: { <libellé>: tranche } }`.
- `complements` : éléments présents dans certaines classes seulement : `{ code, chapitre, libelle, type, classes: [{ libelle, effectif? }] }`.
- `incompatibilites` :
  - `intra` : paires de `conflits` d'une même classe (reprises du profil) ;
  - `inter` : paires de `REGLES_CONFLIT` dont un code est publié dans une classe et l'autre dans une autre classe, avec les classes concernées.
- `sans_code` : éléments sans code, par classe.
- Avec une seule classe, `socle` = tout le profil, `complements` et `inter` sont vides.

Tri déterministe (chapitre, puis code). Les libellés de classe sont désambiguïsés s'ils sont identiques (suffixe « (2) »).

### 2. Rendu Markdown : `src/domain/projections/syntheseMarkdown.js`

`syntheseEnMarkdown(synthese, { emisLe, expireLe }) -> string` et `nomFichierSynthese(synthese, emisLe) -> string` (`profil-classes-<libellés assainis>-<AAAA-MM-JJ>.md`, tronqué à 80 caractères).

Structure, dans cet ordre :
1. **En-tête YAML** : `schema: plai.profil-classes`, `version: 1`, `emis_le`, `expire_le`, `classes` (libellés), `niveaux`. Pas d'école.
2. **`# Profil d'aménagements de mes classes : <libellés>`**
3. **`## Comment lire ce fichier`** : décrit des classes entières, sans donnée d'élève ; effectifs en tranches par classe, jamais cumulés ; ne pas identifier ni deviner d'élève, ne rien attribuer à une personne ; un code désigne un aménagement du catalogue AménagActif, et un code qui n'est pas appliqué est signalé avec son libellé, jamais ignoré en silence ; règle de rédaction des consignes destinées aux élèves (voir ci-dessous) ; valable jusqu'à `expire_le`.
4. **`## À appliquer à toutes les classes`** (socle) : par chapitre, `- <libellé> (`code`)` ; pour un AR, effectif par classe.
5. **`## À prévoir pour certaines classes`** (compléments) : par classe, avec effectif.
6. **`## Incompatibilités`** :
   - entre classes : « Un seul support ne peut pas satisfaire <code A> (3B) et <code B> (3C) : prévoir deux variantes » ;
   - dans une même classe : « Incompatibles dans <classe> : <code A> et <code B> ».
   Section omise s'il n'y a rien.
7. **`## Points d'attention`** : classes dont `elements_non_transmis_present` (« profil incomplet ») ; classes dont `libres_present` (« aménagements individuels libres, contenu non transmis ») ; éléments sans code. Omise si rien.
8. **`## Liste de contrôle`** : `- [ ] <code> : <libellé>` pour le socle, puis pour chaque complément avec ses classes (« 3B uniquement »).
9. **`## Rappel`** : l'IA propose, l'enseignant décide et personnalise ; aucune décision automatique sur un élève.

**Règle de rédaction des consignes** (décision JF, 2026-10-05), reprise telle quelle dans « Comment lire ce fichier » : chaque consigne destinée aux élèves est une puce qui commence par un verbe d'action à l'infinitif (« Lire », « Surligner », pas « Lis », « Surligne »), avec un seul verbe d'action par puce. Une consigne qui demande trois actions s'écrit sur trois puces. Elle s'applique à toutes les classes : c'est le socle AU2, qui précède les AR (`ar_supports_consignes_epurees`).

Statut : règle imposée et vérifiée par essai à froid le 2026-10-05 (2 exécutions avec, 2 sans). Sans la règle : 0 % de consignes à l'infinitif et 63 % à un seul verbe. Avec la règle : 100 % et 99 %. Elle reste dans l'en-tête. Détail : `docs/essais/2026-10-05-chaine-profil-md/ab-test-consignes/`.

Neutralisation : les libellés viennent du catalogue (saisie admin) et des noms de classe. Retours à la ligne et caractères Markdown de début de ligne sont neutralisés pour qu'un libellé ne casse pas la structure.

### 3. Export JSON pour les apps : même synthèse

Les apps reçoivent la synthèse en JSON (`schema: plai.profil-classes`, `version: 1`), même contenu que le .md. Le contrat est documenté dans `docs/contrat-profil-classe.md` (nouvelle section). Aucune app cible ne le consomme pour l'instant : pas d'engagement de compatibilité hors version 1.

### 4. Serveur : `api/profil-export.js`

`GET /api/profil-export?token=<secret du lien>&format=md|json` (défaut `md`).

- Lien opaque uniquement. Lien inconnu, révoqué, expiré, ou ancien lien JWT : même réponse 410 et même message que `fiche-token` (pas d'oracle).
- Charge les classes du lien (`loadClassesData`), calcule `computeProfilClasse` par classe, puis `synthesePourClasses` et le rendu. Les données brutes (prénoms, commentaires, AR libres) ne quittent jamais le serveur.
- `expire_le` = 30 jours (`DUREE_JOURS_DEFAUT`) plafonné à l'expiration du lien (`plafonnerExpirationProfil`).
- Réponse : `{ markdown, nomFichier, expire_le }` ou la synthèse JSON. `Cache-Control: private, no-store`. Erreurs serveur loguées sans donnée.
- Un export n'est pas compté comme une ouverture du lien.

### 5. Interface

**Fiche enseignant** (`FichePublique.jsx`), à côté de « Imprimer / Enregistrer en PDF » :
- **« Exporter pour une IA (.md) »** : télécharge le fichier.
- **« Copier le profil »** : copie le texte, retour « Copié ».
- Aide sous les boutons : ce que contient le fichier (aménagements communs et propres à chaque classe, incompatibilités, liste de contrôle), ce qu'il ne contient pas (noms, prénoms, commentaires, aménagements individuels libres), où l'utiliser, durée de validité, et que ce sont des classes entières : l'IA ne sait pas qui a quoi, c'est à l'enseignant de décider.
- Si le lien ne permet pas l'export (ancien lien) : message invitant à demander un nouveau lien.

**Référents** (`FicheClassePage.jsx`) : mêmes deux boutons, masqués pour `agent_plai`. Une classe (`FicheClasseContenu`) ou un groupe validé (`Picker`). Calcul côté client à partir des données déjà chargées par RLS (`chargerDonneesClasse`), avec la même fonction pure.

Texte et aide en 16 px minimum, focus visible, `aria-live` pour « Copié ». Exemples FWB, pas de vocabulaire franco-français. Le code d'interface est dans `src/lib/exporterProfil.js` (téléchargement par Blob `text/markdown;charset=utf-8`, copie dans le presse-papiers).

## Gestion d'erreurs

- Lien inactif ou inconnu : 410, même message que la fiche.
- Échec de chargement ou de calcul : message visible (`role="alert"`), aucun fichier partiel.
- Échec de la copie : message invitant à utiliser le téléchargement.
- Plus de 10 classes : impossible par construction (limite du lien).

## Tests

- `tests/domain/synthesePourClasses.test.js` : socle et compléments sur 3 classes ; classe unique ; incompatibilité inter-classes (carte mentale oui/non) et intra-classe ; tranches par classe jamais cumulées ; libellés de classe en double ; éléments sans code ; `partage_profil` faux absent ; `k` appliqué via `computeProfilClasse`.
- `tests/domain/syntheseMarkdown.test.js` : l'en-tête contient la règle des consignes (infinitif, un verbe d'action par puce, trois actions sur trois puces) ; structure et ordre des sections ; sections omises ; liste de contrôle égale aux codes publiés ; neutralisation Markdown ; nom de fichier assaini.
- **Non-fuite** : sur la fixture de `profilClasse.test.js` enrichie de prénoms, initiales, commentaires, AR libres, nom de référent et nom d'école, aucune de ces chaînes n'apparaît dans le .md ni dans le JSON.
- `tests/api/profilExport.test.js` : lien actif OK ; lien inconnu, révoqué, expiré et JWT ancien donnent le même 410 ; `no-store` ; expiration plafonnée ; aucune donnée brute dans la réponse.
- `tests/domain/exportProfilBoutons.test.jsx` : boutons sur la fiche enseignant et la fiche de classe ; absents pour `agent_plai` ; téléchargement et copie ; message d'erreur.

## Validation de la pertinence (avant diffusion)

Critère de réussite : un enseignant réel à plusieurs classes obtient, en moins de 5 minutes, un support commun ou des variantes qu'il juge utilisables, plus vite et plus sûrement qu'à partir des fiches séparées.

Essai à froid sur un cas réel (3 classes, un support), comparé à la préparation à partir de 3 fiches : si la synthèse n'apporte pas de différence observable, la fonctionnalité est écartée. Essai de la règle des consignes : fait le 2026-10-05, règle conservée (voir ci-dessus).

**Résultat de l'essai de pertinence (2026-10-05) : seuil non atteint.** 4 exécutions à froid, 3 classes fictives aux aménagements incompatibles, trois profils séparés (u) contre synthèse (v). Écart mesuré sur la règle fixée avant l'essai : 0,5 pour un seuil de 2. Avec trois profils séparés, l'IA repère seule les incompatibilités et ne les viole nulle part ; la justesse ne distingue pas les deux conditions. La synthèse ne réduit pas non plus le nombre de documents (9 documents dans 2 des 4 sorties, une classe de variantes confondue avec des niveaux dans une 3e). Limites : comptage non en aveugle, un cas, mesure du comportement de l'IA et pas de l'enseignant. Détail : `docs/essais/2026-10-05-chaine-profil-md/ab-test-multi/01-resultats.md`.

Pistes à trancher par JF : (1) export par classe ou par lien sans synthèse, avec liste de contrôle (ce que les trois profils séparés ont déjà permis) ; (2) synthèse conservée mais avec une consigne de production « un support commun et des variantes minimales », à tester sur le nombre de documents ; (3) abandon.

## Historique : essai du 2026-10-05

- Chaîne `/seance-differenciee`, puis `/au-reformatage`, puis `/verif` sur un export fictif d'une seule classe : 74 %, « à retravailler ». Défauts venus de l'exécution de l'étape 2 (texte non recopié, correction mal formée), pas du profil. La liste de contrôle a servi à `/verif`.
- Deux consignes ajoutées à l'en-tête (AR dans toutes les versions ; statut par code) testées à froid, 2 exécutions par variante : aucun bénéfice mesurable, la liste de contrôle suffit. Non retenues. Détail : `docs/essais/2026-10-05-chaine-profil-md/ab-test/`.
- Limite des essais : ils mesuraient le comportement d'un agent sur une seule classe. Ils ne montraient pas de valeur pour l'enseignant, d'où la révision autour du cas multi-classes.

## Hors périmètre

- Profil par élève, même en codes neutres.
- Export de plusieurs liens à la fois (un enseignant avec plusieurs liens de plusieurs écoles).
- Références RISS : aucune référence scientifique n'est ajoutée au fichier.
- Vignette portail : aucune modification de `portail-plai/src/data/apps.ts` sans accord de JF.
