# Export du profil de classes en Markdown (multi-classes)

Date : 2026-10-05. Statut : version 3, orientation validée par JF (multi-classes = chemin direct, synthèse précalculée retirée). Une ligne de l'en-tête (la consigne de production) reste à retester après reformulation. À relire par JF avant plan d'implémentation.

## Problème

En secondaire, tout enseignant est multi-classes : 22 périodes par semaine en classe, au plus 9 périodes par matière, donc au moins 3 classes. Un enseignant cherche la simplicité et la bonne démarche : un support qui rencontre les besoins de tous les profils concernés, sans multiplier les documents à préparer, à imprimer et à vérifier. Un lien enseignant couvre 1 à 10 classes de la même école et de la même année (`MAX_CLASSES_PAR_LIEN`).

## Objectif

Permettre à l'enseignant d'exporter, en un seul fichier `.md`, les profils d'aménagements de toutes les classes de son lien, pour le fournir à Claude, ChatGPT, un skill PLAI ou une app. Avec ce fichier, l'IA produit un matériel qui respecte les besoins de toutes ses classes, avec le moins de documents possible.

Le fichier ne contient aucun nom, prénom, initiale, surnom, pseudo, commentaire ni texte libre d'élève.

## Décisions

- **Multi-classes d'abord** (décision JF, 2026-10-05) : un export par lien enseignant, donc pour toutes ses classes, est le cas normal. Une classe seule est le cas particulier.
- **Profil collectif par classe, jamais par élève** (décision JF). Risque de ré-identification en classe, et commentaires susceptibles de contenir des noms.
- **Pas de synthèse précalculée.** Un essai à froid (2026-10-05) montre que l'IA repère seule les incompatibilités entre classes quand elle reçoit les profils séparés, et que la synthèse n'améliore pas le résultat. Le fichier contient donc un profil par classe, tel que le contrat actuel le produit, et une liste de contrôle.
- **Pas de nouvelle logique de données.** Chaque profil de classe est la sortie de `computeProfilClasse` (contrat `plai.profil-classe` v1, `docs/contrat-profil-classe.md`) : exclusions absolues, `partage_profil`, seuil `k` = 1, tranches d'effectif (`1-2`, `3-5`, `6+`). Les effectifs ne sont jamais additionnés entre classes.
- **Nom de l'école omis.** Libellé de classe et niveau conservés.
- **Entrée principale : la fiche enseignant** (`/fiche/:token`), car c'est là qu'arrive l'enseignant. Les référents ont le même export sur leurs pages.

## Limites à dire clairement à l'enseignant

1. Le profil dit ce qu'il y a dans la classe, pas qui en a besoin. Le matériel doit donc répondre aux besoins de toute la classe. L'IA ne sait pas qui a quoi : c'est à l'enseignant de décider.
2. Deux classes peuvent s'exclure (par exemple carte mentale souhaitée dans l'une, refusée dans l'autre). Un seul document ne peut pas satisfaire les deux : il faut une variante.
3. Le nombre de documents peut exploser (classes × niveaux de difficulté). C'est le point à maîtriser (voir « Consigne de production »).
4. Un lien couvre au plus 10 classes, d'une même école et d'une même année scolaire.

Ces limites figurent dans le texte d'aide de l'interface. Aucune raison avérée de renoncer au multi-classes n'a été trouvée.

## Composants

### 1. Rendu Markdown : `src/domain/projections/profilsClassesMarkdown.js`

`profilsEnMarkdown(profils, { emisLe, expireLe }) -> string` et `nomFichierProfils(profils, emisLe) -> string` (`profil-classes-<libellés assainis>-<AAAA-MM-JJ>.md`, tronqué à 80 caractères). Fonctions pures. `profils` est un tableau de sorties de `computeProfilClasse` (1 à 10). Aucune autre donnée n'entre dans le rendu : il ne peut rien ajouter au-delà du contrat.

Structure du fichier :
1. **Titre** : `# Profils d'aménagements de mes classes : <libellés>` (ou `de la classe <libellé>` pour une seule).
2. **`## Comment lire ce fichier`** (texte figé, voulu : instruction technique) :
   - il décrit des classes entières, sans donnée d'élève ;
   - les effectifs sont des tranches, jamais un nombre exact ni cumulé entre classes ;
   - ne pas identifier ni deviner d'élève, ne rien attribuer à une personne ;
   - un code désigne un aménagement du catalogue AménagActif ; un code non appliqué est signalé avec son libellé, jamais ignoré en silence ;
   - **règle de rédaction des consignes** (voir ci-dessous) ;
   - **consigne de production** (voir ci-dessous) ;
   - valable jusqu'à `expire_le` ; au-delà, redemander un export.
3. **Un profil par classe**, séparés par une ligne horizontale. Pour chaque classe :
   - en-tête YAML : `schema: plai.profil-classe`, `version: 1`, `emis_le`, `expire_le`, `classe`, `niveau` ;
   - `## Aménagements universels (AU)` : `- <libellé> (`code`)` ;
   - `## Aménagements raisonnables (AR)` : `- <libellé> (`code`), effectif : <tranche>` ;
   - points d'attention de la classe, seulement s'il y en a : conflits internes à la classe (`conflits`), profil incomplet (`elements_non_transmis_present`), aménagements individuels libres (`libres_present`, contenu non transmis), éléments sans code ;
   - `## Liste de contrôle` : `- [ ] <code> : <libellé>`.
4. **`## Rappel`** : l'IA propose, l'enseignant décide et personnalise ; aucune décision automatique sur un élève.

Neutralisation : les libellés viennent du catalogue (saisie admin) et des noms de classe, jamais des élèves. Retours à la ligne et caractères Markdown de début de ligne sont neutralisés pour qu'un libellé ne casse pas la structure.

### 2. Règle de rédaction des consignes

Décision JF (2026-10-05), vérifiée par essai à froid. Chaque consigne destinée aux élèves est une puce qui commence par un verbe d'action à l'infinitif (« Lire », « Surligner », pas « Lis », « Surligne »), avec un seul verbe d'action par puce. Une consigne qui demande trois actions s'écrit sur trois puces. Elle s'applique à toutes les classes : c'est le socle AU2, qui précède les AR (`ar_supports_consignes_epurees`).

Essai (2 exécutions avec la règle, 2 sans) : sans la règle, 0 % de consignes à l'infinitif et 63 % à un seul verbe ; avec la règle, 100 % et 99 %. Elle reste dans l'en-tête. Détail : `docs/essais/2026-10-05-chaine-profil-md/ab-test-consignes/`.

### 3. Consigne de production : un seul support, variantes minimales

Texte proposé pour l'en-tête : « Produis un seul support pour toutes les classes. Ajoute une variante d'un document uniquement là où deux classes ont des aménagements qui s'excluent. Ne multiplie pas les documents : une même fiche de travail sert toutes les classes ; la police et le format d'impression se règlent à l'impression et ne comptent pas comme des documents distincts. »

Statut : **testée, non retenue telle qu'écrite** (essai du 2026-10-05, 2 exécutions avec la consigne contre 2 de référence sans). Elle réduit le nombre de documents de 8 à 4,5 en moyenne, mais l'une des deux sorties a supprimé les trois niveaux de difficulté (voir « Résultat de l'essai 5 »). La formulation corrigée est à retester avant de l'inscrire dans l'en-tête.

### 4. Serveur : `api/profil-export.js`

`GET /api/profil-export?token=<secret du lien>&format=md|json` (défaut `md`).

- Lien opaque uniquement. Lien inconnu, révoqué, expiré, ou ancien lien JWT : même réponse 410 et même message que `fiche-token` (pas d'oracle).
- Charge les classes du lien (`loadClassesData`), calcule `computeProfilClasse` par classe, puis le rendu. Les données brutes (prénoms, commentaires, AR libres) ne quittent jamais le serveur.
- `expire_le` = 30 jours (`DUREE_JOURS_DEFAUT`) plafonné à l'expiration du lien (`plafonnerExpirationProfil`).
- Réponse : `{ markdown, nomFichier, expire_le }` en `md`, ou le tableau des profils `plai.profil-classe` v1 en `json` (pour les apps : aucun nouveau contrat).
- `Cache-Control: private, no-store`. Erreurs serveur loguées sans donnée. Un export n'est pas compté comme une ouverture du lien.

### 5. Interface

**Fiche enseignant** (`FichePublique.jsx`), à côté de « Imprimer / Enregistrer en PDF » :
- **« Exporter pour une IA (.md) »** : télécharge le fichier.
- **« Copier le profil »** : copie le texte, retour « Copié ».
- Aide sous les boutons : ce que contient le fichier (profil de chaque classe, liste de contrôle), ce qu'il ne contient pas (noms, prénoms, commentaires, aménagements individuels libres), où l'utiliser, durée de validité, et les limites du paragraphe « Limites à dire clairement ».
- Si le lien ne permet pas l'export (ancien lien) : message invitant à demander un nouveau lien.

**Référents** (`FicheClassePage.jsx`) : mêmes deux boutons, masqués pour `agent_plai`. Une classe (`FicheClasseContenu`) ou un groupe validé (`Picker`). Calcul côté client à partir des données déjà chargées par RLS (`chargerDonneesClasse`), avec la même fonction pure.

Texte et aide en 16 px minimum, focus visible, `aria-live` pour « Copié ». Exemples FWB, pas de vocabulaire franco-français. Code d'interface dans `src/lib/exporterProfil.js` (téléchargement par Blob `text/markdown;charset=utf-8`, copie dans le presse-papiers).

## Gestion d'erreurs

- Lien inactif ou inconnu : 410, même message que la fiche.
- Échec de chargement ou de calcul : message visible (`role="alert"`), aucun fichier partiel.
- Échec de la copie : message invitant à utiliser le téléchargement.

## Tests

- `tests/domain/profilsClassesMarkdown.test.js` : un profil par classe dans l'ordre ; classe unique ; en-tête contenant la règle des consignes et la consigne de production (si retenue) ; liste de contrôle égale aux codes publiés ; points d'attention conditionnels ; neutralisation Markdown ; nom de fichier assaini ; libellés de classe en double désambiguïsés.
- **Non-fuite** : sur la fixture de `profilClasse.test.js` enrichie de prénoms, initiales, commentaires, AR libres, nom de référent et nom d'école, aucune de ces chaînes n'apparaît dans le .md ni dans le JSON ; élément à `partage_profil` faux absent.
- `tests/api/profilExport.test.js` : lien actif OK ; lien inconnu, révoqué, expiré et JWT ancien donnent le même 410 ; `no-store` ; expiration plafonnée ; aucune donnée brute dans la réponse.
- `tests/domain/exportProfilBoutons.test.jsx` : boutons sur la fiche enseignant et la fiche de classe ; absents pour `agent_plai` ; téléchargement et copie ; message d'erreur.

## Validation de la pertinence avant diffusion

Critère de réussite : un enseignant réel à plusieurs classes obtient, en moins de 5 minutes, un support commun ou des variantes qu'il juge utilisables, plus vite et plus sûrement qu'en lisant ses fiches une à une. À vérifier avec un enseignant réel : les essais ci-dessous mesurent l'IA, pas la perception de l'enseignant (temps de lecture, nombre de pages à imprimer, confiance).

## Historique des essais (2026-10-05)

Documents et sorties : `docs/essais/2026-10-05-chaine-profil-md/`, consultables dans le dossier publié.

1. **Une classe, trois skills enchaînés** : 74 %, à retravailler. Défauts venus de l'exécution de l'étape 2 (texte non recopié, correction mal formée). La liste de contrôle a servi à `/verif`.
2. **Deux consignes d'en-tête** (AR dans toutes les versions ; statut par code), 2 exécutions avec, 2 sans : aucun bénéfice mesurable. Non retenues. Dossier `ab-test/`.
3. **Règle des consignes** : retenue (voir plus haut). Dossier `ab-test-consignes/`.
4. **Synthèse multi-classes précalculée contre trois profils séparés** (3 classes fictives aux aménagements incompatibles, 4 exécutions) : écart 0,5 pour un seuil de 2. Avec trois profils séparés, l'IA repère seule les incompatibilités et ne les viole nulle part ; la synthèse ne réduit pas le nombre de documents (9 documents dans 2 sorties sur 4) et une des deux sorties avec synthèse a lu « trois versions » comme « trois classes » en supprimant les niveaux. Synthèse retirée. Dossier `ab-test-multi/`. Limites : comptage non en aveugle, un cas fictif, 2 exécutions par condition.
5. **Consigne de production** (un seul support, variantes minimales) : documents 8 → 4,5, mais niveaux supprimés dans une sortie sur deux, donc non retenue telle qu'écrite (résultat ci-dessous). Dossier `ab-test-production/`.

### Résultat de l'essai 5

Nombre de documents élèves distincts : 8 en moyenne sans la consigne (9 et 7), 4,5 avec (6 et 3). Aucune violation d'incompatibilité, socle appliqué 5 sur 5, 10 compléments sur 10 bien attribués dans les quatre sorties. Mais l'une des deux sorties avec la consigne (w-2) a fusionné les trois niveaux de difficulté en une seule fiche, ce qui ne respecte pas la condition « niveaux conservés » fixée avant l'essai. **Selon la règle fixée, la consigne n'est pas retenue telle qu'écrite.** Cause : « un seul support » est ambigu sur les niveaux. Détail : `docs/essais/2026-10-05-chaine-profil-md/ab-test-production/01-resultats.md`.

Reformulation à retester : « Produis un seul support pour toutes les classes. Garde les trois niveaux de difficulté de la séance : une même fiche par niveau sert toutes les classes. Ajoute une variante d'un document uniquement là où deux classes ont des aménagements qui s'excluent. La police et le format d'impression ne comptent pas comme des documents distincts. »

Décision pédagogique de JF à prendre : la fiche unique de w-2 (étayage ouvert à tous, un seul document, aucune étiquette de niveau) est défendable, mais remplace les trois fiches de `seance-differenciee` par une conception à une fiche.

## Hors périmètre

- Profil par élève, même en codes neutres.
- Synthèse précalculée (socle, compléments, incompatibilités), retirée après l'essai 4. À reconsidérer seulement si un essai avec des enseignants réels en montre le besoin.
- Export de plusieurs liens à la fois (un enseignant avec plusieurs liens de plusieurs écoles).
- Références RISS : aucune référence scientifique n'est ajoutée au fichier.
- Vignette portail : aucune modification de `portail-plai/src/data/apps.ts` sans accord de JF.
