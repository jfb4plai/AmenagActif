# Export du profil de classe en Markdown (pour IA et autres apps)

Date : 2026-10-05. Statut : conception validée par JF (option 1, liste de contrôle incluse).

## Objectif

Permettre à un enseignant ou à un référent d'exporter le profil d'aménagements d'une classe en fichier `.md`, pour le fournir à un agent (Claude, skills PLAI) ou à une autre app. Le fichier ne contient aucun nom, prénom, initiale, surnom, pseudo, commentaire ni texte libre d'élève.

Le .md est lisible par une IA sans ambiguïté : structure fixe, codes stables, tranches d'effectif.

## Décisions

- **Profil collectif uniquement** (décision JF, 2026-10-05). Pas de profil par élève, même en codes neutres : risque de ré-identification en classe, et commentaires susceptibles de contenir des noms.
- **Pas de nouvelle logique de données.** Le .md est un rendu de `computeProfilClasse` (contrat `plai.profil-classe` v1, `docs/contrat-profil-classe.md`). Ses exclusions absolues, le drapeau `partage_profil`, le seuil `k` (1) et les tranches d'effectif (`1-2`, `3-5`, `6+`) s'appliquent tels quels.
- **Nom de l'école omis.** Seuls le libellé de classe et le niveau sont conservés.
- **Une classe à la fois.** Pas d'export des fiches groupées dans cette version.

## Composants

### 1. `src/domain/projections/profilClasseMarkdown.js`

`profilClasseEnMarkdown(profil) -> string`. Fonction pure, déterministe, sans accès aux données brutes : elle reçoit uniquement la sortie de `computeProfilClasse`. Elle ne peut donc rien ajouter au-delà du contrat.

Exporte aussi `nomFichierProfil(profil) -> string` : `profil-classe-<libellé assaini>-<AAAA-MM-JJ>.md` (libellé en minuscules, caractères non alphanumériques remplacés par `-`).

Structure du fichier, dans cet ordre :

1. **En-tête YAML** : `schema`, `version`, `emis_le`, `fiche_du`, `expire_le`, `classe`, `niveau`. Pas d'école.
2. **`# Profil d'aménagements de la classe <libellé>`**
3. **`## Comment lire ce fichier`** (texte figé, voulu : instruction technique, pas texte pédagogique) :
   - ce sont les aménagements d'une classe entière, sans donnée d'élève ;
   - les effectifs sont des tranches, jamais un nombre exact ;
   - ne pas chercher à identifier ni deviner d'élève ;
   - ne pas attribuer un aménagement à une personne précise ;
   - un code désigne un aménagement du catalogue AménagActif ; un code que l'agent ne sait pas appliquer est signalé comme « non appliqué », avec son libellé, jamais ignoré en silence ;
   - le fichier est valable jusqu'à `expire_le` ; au-delà, redemander un export.
4. **`## Aménagements universels (AU)`** : toute la classe. Une sous-section par chapitre (code du chapitre), puis `- <libellé> (`code`)`. Section vide : « Aucun ».
5. **`## Aménagements raisonnables (AR)`** : même présentation avec l'effectif : `- <libellé> (`code`), effectif : 3-5`. Section vide : « Aucun ».
6. **`## Éléments sans code`** : seulement si `non_codes` n'est pas vide (filet de sécurité), libellé et chapitre.
7. **`## Points d'attention`** :
   - chaque paire de `conflits` : `Incompatibles dans cette classe : <code A> et <code B>` ;
   - si `elements_non_transmis_present` : « Certains aménagements de la classe ne sont pas transmis. Le profil est incomplet. » ;
   - si `libres_present` : « Des aménagements individuels libres existent. Leur contenu n'est pas transmis. » ;
   - section omise s'il n'y a rien à signaler.
8. **`## Liste de contrôle`** : une ligne `- [ ] <code> : <libellé>` par AU, puis par AR (ordre du profil). Sert de consigne à `/au` (appliquer) et de grille à `/verif` (vérifier le support code par code). Ne contient aucune donnée absente du profil. Les éléments sans code sont listés `- [ ] (sans code) : <libellé>`.
9. **`## Rappel`** : l'IA propose, l'enseignant décide et personnalise ; aucune décision automatique sur un élève.

Échappement : les libellés viennent du catalogue (saisie admin), jamais des élèves. Le rendu neutralise tout de même les retours à la ligne et les caractères Markdown de début de ligne dans un libellé, pour qu'un libellé ne puisse pas casser la structure.

### 2. Interface : `src/pages/FicheClassePage.jsx` (`FicheClasseContenu`)

À côté de « Imprimer / Enregistrer en PDF », deux boutons, masqués pour `agent_plai` (comme le lien enseignant) :

- **« Exporter pour une IA (.md) »** : télécharge le fichier (Blob + lien temporaire, type `text/markdown;charset=utf-8`).
- **« Copier le profil »** : copie le texte dans le presse-papiers, avec retour visuel « Copié ».

Texte d'aide sous les boutons (guidage contextuel PLAI) : ce que le fichier contient (aménagements de la classe, effectifs en tranches), ce qu'il ne contient pas (noms, prénoms, commentaires, aménagements individuels libres), où l'utiliser (Claude, skills PLAI, autre app), et sa durée de validité.

Texte des boutons et de l'aide en 16 px minimum, focus visible, `aria-live` pour « Copié ». Exemples FWB, pas de vocabulaire franco-français.

Un petit module `src/lib/exporterProfil.js` porte le téléchargement et la copie (comme `imprimerFiche.js`), pour garder la page mince.

### 3. Données et accès

Le profil est calculé côté client : `chargerDonneesClasse(classeId)` (données déjà chargées par la fiche via RLS) puis `computeProfilClasse`. Le calcul se fait au clic, pour que `emis_le` et `expire_le` soient ceux du moment de l'export. Aucune nouvelle API, aucune nouvelle table, aucune migration. L'accès reste celui de la fiche.

L'export client n'émet pas de jeton : le fichier est une copie statique. La révocation d'un lien enseignant ne l'affecte pas ; c'est dit dans le texte d'aide (valable jusqu'à `expire_le`, copie à usage de l'enseignant).

## Essai comparatif du 2026-10-05

Deux consignes supplémentaires (AR dans toutes les versions ; statut obligatoire par code) ont été testées à froid, 2 exécutions par variante, et n'ont montré aucun bénéfice mesurable : la liste de contrôle suffit à produire les deux comportements. Elles ne sont pas retenues. Détail : `docs/essais/2026-10-05-chaine-profil-md/ab-test/`.

## Gestion d'erreurs

- Échec du chargement ou du calcul : message d'erreur visible (`role="alert"`), aucun fichier partiel.
- Échec de la copie (presse-papiers refusé) : message invitant à utiliser le téléchargement.

## Tests

- `tests/domain/profilClasseMarkdown.test.js` :
  - structure complète et ordre des sections ;
  - sections vides (« Aucun »), points d'attention conditionnels ;
  - liste de contrôle identique aux codes publiés (AU puis AR), sans code manquant ni en trop ;
  - **non-fuite** : sur la fixture de `profilClasse.test.js` enrichie de prénoms, initiales, commentaires, AR libres et nom de référent, aucune de ces chaînes n'apparaît dans le .md ; aménagements à `partage_profil` faux absents ;
  - le nom de l'école n'apparaît pas ;
  - neutralisation des retours à la ligne et du Markdown dans un libellé ;
  - `nomFichierProfil` : caractères spéciaux assainis.
- `tests/domain/exportProfilBoutons.test.jsx` : boutons présents pour un référent, absents pour `agent_plai` ; clic « Exporter » déclenche le téléchargement ; clic « Copier » écrit dans le presse-papiers et affiche « Copié » ; erreur de copie affichée.

## Hors périmètre

- Profil par élève, même en codes neutres.
- Export des fiches groupées.
- API d'export par jeton au format Markdown (le JSON de `api/profil-classe.js` reste la voie pour une app qui appelle le serveur).
- Références RISS : aucune référence scientifique n'est ajoutée dans le fichier.
- Vignette portail : aucune modification de `portail-plai/src/data/apps.ts` sans accord de JF.
