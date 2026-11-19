# Administration en onglets — spécification (étape 1)

Date : 2026-11-13. Statut : brouillon à valider par JF. Aucun code écrit.

## Intention

`src/pages/Administration.jsx` (603 lignes) empile quatre sections (Membres & accès, Années, Écoles, Catalogue) et devient ingérable. L'administrateur doit retrouver en un clic la tâche qu'il cherche. La page est aussi le futur point d'entrée de deux chantiers déjà décidés, dans cet ordre : droits modifiables par type d'utilisateur, puis plusieurs Pôles (16 Pôles intéressés via le CECP). Cette étape ne les construit pas, mais ne doit rien faire qui les gêne.

## Objectifs

1. Six onglets, chacun avec sa propre adresse (URL) : Membres & accès, Droits, Écoles, Années, Catalogue, Transmission.
2. Un fichier par onglet : plus de fichier unique de 600 lignes.
3. Onglet Membres : filtre de recherche, et remplacement du champ texte « Niveaux » de la direction par des cases à cocher.
4. Onglet Droits en lecture seule : tableau « qui peut faire quoi » par type d'utilisateur.
5. Aucun changement de comportement des fonctions existantes (membres, écoles, années, catalogue, transmission).

## Non-objectifs

- Aucune migration SQL, aucune modification de `api/*`, aucune règle RLS touchée.
- Pas de droits modifiables (étape 2), pas de Pôles, pas de second niveau d'administrateur, pas de nouveau rôle.
- Pas de journal des actions d'administration (étape 2).
- Pas de pastille d'anomalie sur l'onglet (voir « Choix écartés »).
- (Correction du 2026-11-14) La convention « pas de test de composant React » est fausse : le dépôt en contient (constaté : `tests/domain/liensPage.test.jsx`, `ficheClassePicker.test.jsx`, `transmissionPage.test.jsx`). Les composants de cette étape sont testés avec Testing Library, comme eux.

## Anti-objectifs (échec même si « ça marche »)

- Une action d'admin qui se comporte différemment après le déplacement.
- Un onglet « Droits » qui affiche autre chose que ce que le code applique réellement (la matrice doit être vérifiée cellule par cellule, voir plus bas).
- Une URL existante qui casse : `/administration` et `/administration/transmission` doivent continuer à fonctionner.
- Un défilement horizontal de la page à 375 px de large.

## Approches envisagées

| | Principe | Verdict |
|---|---|---|
| A | Onglets par état local (`useState`) dans la page unique | Écartée : pas d'adresse par onglet, donc pas de signet, pas de retour arrière, pas de lien direct depuis un guide ou le bandeau. |
| **B** | **Routes imbriquées : `/administration/<onglet>`, un fichier par onglet, barre d'onglets en liens de navigation** | **Retenue.** |
| C | Une entrée de menu par section dans la barre principale | Écartée : surcharge la navigation de tous. |

Choix connexe : « Années » reste un onglet à part (et non fusionné avec Écoles) parce que deux modes d'emploi et le bandeau de bascule d'année parlent déjà de la « rubrique Années » et doivent pouvoir y renvoyer directement.

## Conception

### Routage (modifie `src/App.jsx`)

- `/administration` redirige (remplacement d'historique) vers `/administration/membres`.
- Sous-routes : `membres`, `droits`, `ecoles`, `annees`, `catalogue`, `transmission`.
- `transmission` garde exactement l'adresse actuelle `/administration/transmission` ; la page `TransmissionProfil.jsx` est rendue dans la mise en page de l'administration. Dans la mise en page à onglets, son lien « Retour à l'Administration » (`TransmissionProfil.jsx:103`) est supprimé (les onglets le remplacent) et son `h1` devient un `h2` (un seul `h1` par page). Décision du 2026-11-14.
- Le contrôle d'accès `RequireRole roles={['admin']}` s'applique une seule fois, sur la route parente. Une personne non administratrice qui ouvre n'importe quelle sous-adresse est refusée comme aujourd'hui.
- Une adresse inconnue sous `/administration/` affiche la page « introuvable » existante.

### Mise en page (`src/pages/administration/AdminLayout.jsx`)

- Titre `h1` « Administration », puis `<nav aria-label="Sections de l'administration">` avec six liens `NavLink` (`aria-current="page"` sur l'actif), puis la zone de contenu (`Outlet`).
- Les onglets sont des liens de navigation, pas un `role="tablist"` : chaque onglet est une adresse distincte.
- Texte 16 px minimum, contour de focus visible (la constante `FOCUS` existe déjà dans `TransmissionProfil.jsx`), retour à la ligne des onglets plutôt que défilement horizontal.
- Chaque onglet a un `h2` (le titre actuel de sa section).
- La liste des onglets est une donnée (tableau `{ chemin, libelle, roles }`), pas du JSX en dur, pour pouvoir ajouter plus tard un onglet « Pôles » réservé au super-administrateur sans restructurer.

### Découpage des fichiers

Déplacement à l'identique d'abord (un premier commit sans aucun changement fonctionnel), puis les ajouts.

| Fichier | Contenu actuel déplacé |
|---|---|
| `src/pages/administration/MembresTab.jsx` | `SectionMembres`, `MembreRow` (lignes 28–186) |
| `src/pages/administration/EcolesTab.jsx` | `SectionEcoles` (536–603) |
| `src/pages/administration/AnneesTab.jsx` | `SectionAnnees` (499–534) |
| `src/pages/administration/CatalogueTab.jsx` | `SectionCatalogue`, `FenetreUsage`, `AjoutAmenagement`, `AjoutChapitre`, `AIDE_NE_PAS_TRANSMETTRE` (188–498) |
| `src/pages/administration/DroitsTab.jsx` | nouveau |
| `src/pages/Administration.jsx` | supprimé ou réduit à un réexport de `AdminLayout` |

Les constantes `LABEL_ROLE`, `ROLE_SCOPE`, `ROLE_SCOPE_MULTI` (lignes 11–13) vont dans `MembresTab.jsx`, leur seul utilisateur.

### Onglet Membres & accès

Comportement existant conservé tel quel : invitation, changement de rôle, rattachement à plusieurs écoles, retrait, regroupement par implantation, section « Sans école assignée (à corriger) ».

Ajouts :

1. **Recherche** : un champ texte (adresse ou nom) et une liste « Rôle » (tous / administrateur / référent / direction / agent). Filtrage dans le navigateur sur la liste déjà chargée. Quand un filtre est actif, les écoles sans résultat sont masquées et un compteur indique « X comptes affichés sur Y ». Aide sous le champ : « Tapez une partie de l'adresse ou du nom. Les groupes sans résultat disparaissent. »
2. **Niveaux de la direction en cases à cocher** (remplace le champ texte, `Administration.jsx:173–181`) :
   - Libellé : « Apparaît sur les fiches des classes de niveau ». Ce que fait vraiment le champ (constaté, `ficheClasse.js:109–112`) : il limite les fiches sur lesquelles le nom de cette direction apparaît dans la colonne « PAR ». Ce n'est pas un droit d'accès.
   - Source des cases : les valeurs de `niveau` distinctes des classes de l'année active, dans la ou les écoles de cette direction. Le champ `niveau` des classes est un texte libre (`SelecteurClasse.jsx:39`), donc la liste reflète ce qui a été saisi, y compris d'éventuelles variantes (« 5e » et « 5E » deux cases).
   - Aucune case cochée : message explicite « Aucun niveau coché : apparaît sur toutes les classes » (comportement actuel du champ vide).
   - Une valeur déjà enregistrée qui n'existe plus dans les classes actuelles reste affichée, cochée, avec la mention « (absent des classes actuelles) » : elle n'est jamais supprimée en silence.
   - Avertissement chiffré : si l'école a des classes sans niveau renseigné et que la direction a des niveaux cochés, afficher « N classes sans niveau : cette direction n'y apparaît pas » (constaté : `niveauClasse && …`, ligne 112).
   - Enregistrement : même appel qu'aujourd'hui (`changerRole.mutate({ userId, role, niveaux })`), à chaque case cochée ou décochée, avec confirmation visuelle brève.
   - Nouvelle lecture : une requête sur `ar_classes (niveau, ecole_id)` pour l'année active (l'admin a déjà le droit de lecture via la RLS).
3. Le texte d'aide (paragraphe de 6 phrases, lignes 48–56) est découpé en une aide courte visible et le détail dans un bloc repliable « Comprendre les rôles ».

### Onglet Droits (lecture seule)

- Source unique : un nouveau module pur `src/domain/droits.js` qui exporte la liste des capacités, la matrice rôle × capacité, et les tableaux de rôles déjà utilisés par l'interface (`EDITEURS`, `GESTIONNAIRES_LIENS`, `LECTEURS`, aujourd'hui définis dans `App.jsx:25–27`, et la liste de `Nav.jsx`). `App.jsx` et `Nav.jsx` importent ces tableaux depuis ce module : un seul endroit à modifier, aucun changement de comportement. Les fonctions SQL et `api/*` ne changent pas dans cette étape.
- Affichage : un tableau, une ligne par capacité (libellé en français clair + une phrase sur l'effet), une colonne par type d'utilisateur, « Oui » / « Non » en texte (pas seulement une couleur). Bandeau : « Ce tableau décrit les droits actuels. Il n'est pas encore modifiable ici. » Le document de référence `docs/permissions-roles.md` est cité en texte simple, sans lien : `docs/` n'est pas servi par le site (décision du 2026-11-14).
- Matrice de départ (à **vérifier cellule par cellule** contre `App.jsx`, `Nav.jsx`, `api/*` et les fonctions SQL `ar_can_edit_ecole`, `ar_can_editer_structure_ecole`, `ar_can_read_ecole` avant affichage ; tout écart est signalé à JF, pas corrigé en silence) :

| Capacité | Administrateur | Référent PLAI | Direction | Agent accompagnant |
|---|---|---|---|---|
| Consulter les fiches de ses écoles | oui | oui | oui | oui |
| Saisir élèves et AR (créer, modifier, supprimer) | oui | oui | oui | oui |
| Ajouter un AU à une classe | oui | oui | oui | oui |
| Retirer un AU déjà coché | oui | oui | oui | non |
| Créer une classe (mise à jour 2026-11-19 : l'agent le peut depuis `20261119b`) | oui | oui | oui | oui |
| Supprimer ou renommer une classe | oui | oui | oui | non |
| Reprise d'année | oui | oui | oui | non |
| Créer des liens enseignants (mise à jour 2026-11-19) | oui | oui | oui | oui |
| Révoquer ou modifier les liens créés par d'autres | oui | oui | oui | non |
| Voir « Mon école » | non (a « Administration ») | oui | oui | oui |
| Administration (membres, écoles, années, catalogue, transmission) | oui | non | non | non |
| Renommer une classe ; changer un élève de classe ; archives et restauration | ? à relever | ? | ? | ? |

- Test Vitest (`tests/domain/droits.test.js`) : chaque tableau exporté (`EDITEURS`, etc.) est cohérent avec la matrice ; chaque capacité a une valeur pour chacun des quatre rôles ; le rôle administrateur a toujours « oui » partout sauf « Mon école ».

### Onglet Écoles et onglet Années

Déplacement à l'identique. Seule modification de texte : « Les 11 implantations secondaires accompagnées » devient « Les implantations accompagnées » (le chiffre serait faux dès qu'un autre Pôle utilise l'outil).

### Onglet Catalogue et onglet Transmission

Déplacement à l'identique. Le lien « Revoir la transmission… » (`Administration.jsx:~225`) continue de fonctionner (même adresse).

### Liens entrants à mettre à jour

- `BandeauBascule.jsx:17` : le lien « Administration » mène à `/administration/annees`.
- `Reprise.jsx:99` : le renvoi « créez-la d'abord dans Administration » devient un lien vers `/administration/annees`.
- `MonEcole.jsx:23–24` : « Administration → Membres & accès » reste exact (le nom de l'onglet est conservé).
- Modes d'emploi `public/modes-emploi/reprise-nouvelle-annee.html:109` et `docs/modes-emploi/reprise-nouvelle-annee.html:93,104` : « rubrique / section Années » devient « onglet Années ». Les deux copies sont à garder identiques.
- `docs/permissions-roles.md` : sections Administration mises à jour (six onglets, onglet Droits, niveaux en cases à cocher).

## Contraintes

- Aucune sortie de page horizontale à 375 px ; texte 16 px ; contraste conforme à la charte (teal `#0f6e56`, orange `#f97316`).
- Branche `main`. `npx vite build` doit passer avant tout `git push` (règle du projet).
- Essais de l'interface connectée : `npm run dev` ne lance pas `/api/*` ; l'onglet Membres appelle `/api/membres`, donc `vercel dev` (config `amenagactif-vercel` de `.claude/launch.json`, avec `NODE_OPTIONS=--use-system-ca`).

## Garde-fous pour ne pas entraver les autres Pôles

1. Les onglets sont des données (tableau avec `roles`), pour accueillir un onglet « Pôles » et des droits par niveau d'administrateur plus tard.
2. Les droits sont centralisés dans `droits.js` : la future matrice modifiable remplacera ce module, pas 38 occurrences dispersées dans 12 fichiers.
3. Aucune nouvelle table, aucun nouveau nom de rôle en dur, aucun chiffre propre à Liège dans les textes.
4. Le Pôle d'une donnée se déduit toujours de l'école (`ar_ecoles`) : ne rien ajouter qui contourne cette chaîne.
5. Le catalogue reste commun à tous les Pôles (décision de JF) : l'onglet Catalogue n'est pas lié à une école.

## Choix écartés

- **Pastille « anomalies » sur l'onglet Membres** : exigerait de charger `/api/membres` (un appel utilisateur par membre côté serveur) à chaque page d'administration, même hors de l'onglet. À la place, le message « N comptes sans école assignée » apparaît en tête de l'onglet Membres lui-même.
- **Conserver l'onglet ouvert (chapitre de catalogue déplié, etc.) en changeant d'onglet** : l'état local est réinitialisé en quittant l'onglet. Accepté, sans valeur justifiant une adresse paramétrée.

## Laissé au réalisateur

- Style exact de la barre d'onglets, dans la charte PLAI et `src/plai-style.css`.
- Noms internes des hooks et composants, tant que la structure de fichiers ci-dessus est respectée.
- Choix d'une icône ou non pour chaque onglet (par défaut : aucune).

## Vérification attendue (preuves à citer à la livraison)

1. `npx vite build` et `npx vitest run` : sorties citées.
2. Chaque onglet atteint par son adresse directe et après rechargement ; `/administration` redirige vers `/membres` ; `/administration/transmission` inchangée.
3. Compte non administrateur (référent) : refusé sur `/administration`, `/administration/droits` et `/administration/catalogue`.
4. Parcours réels de l'ancien comportement, un par onglet, sur une école d'essai (créée puis désactivée, jamais une vraie implantation) : ajouter puis désactiver une école ; ajouter une année sans l'activer ; ouvrir et refermer un chapitre du catalogue ; ouvrir la fenêtre d'usage d'un aménagement ; changer le rôle d'un compte d'essai. Aucune invitation réelle envoyée sans accord de JF.
5. Cases « Niveaux » : une direction d'essai, cocher puis décocher des niveaux, contrôler la colonne PAR de la fiche d'une classe correspondante et d'une classe sans niveau.
6. Capture à 375 px de large : pas de défilement horizontal.
7. Matrice de l'onglet Droits : tableau des écarts entre la matrice affichée et le code/SQL, même s'il est vide.

## Étapes ultérieures (hors périmètre, décidées par JF)

- **Étape 2** : droits modifiables par type d'utilisateur, par Pôle ; administrateur de Pôle peut les modifier pour son Pôle ; journal des changements ; réécriture des fonctions SQL de droits.
- **Étape 3** : Pôles (16 intéressés), deux niveaux d'administrateur, catalogue commun, isolation par Pôle ; question juridique et d'hébergement à régler avant.
- **En parallèle ou avant l'étape 2** : le super lien (sommaire de classes), déjà spécifié en conversation (option A).
