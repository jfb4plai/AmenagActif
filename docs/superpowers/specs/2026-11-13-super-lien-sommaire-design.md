# Super lien : sommaire de classes — spécification

Date : 2026-11-13. Statut : brouillon à valider par JF. Aucun code écrit, aucune migration appliquée.

## Intention

Un enseignant qui a plusieurs classes dans une même implantation (jusqu'à 22 : 22 heures de présence devant élèves) reçoit **une seule adresse**. Elle ouvre un sommaire de ses classes ; chaque classe ouvre sa fiche habituelle, séparée des autres. Le gestionnaire (admin, référent PLAI, direction) peut **ajouter ou retirer des classes** du sommaire sans changer l'adresse. C'est un regroupement, pas un changement de principe : la fiche par classe reste l'unité, et un lien reste destiné à un seul enseignant. Aujourd'hui, un enseignant à plusieurs classes doit retrouver le bon courriel pour chacune.

## Décisions de JF (2026-11-13)

- Option A : le sommaire référence des **classes**, pas des liens existants (leurs secrets ne sont pas récupérables : seul le hash est stocké).
- Toujours une seule implantation par sommaire (un enseignant sur deux implantations aura deux sommaires).
- Le sommaire est une page de l'application ; le courriel ne contient que le lien.
- **Pas de plafond de classes** pour un sommaire (22 h de présence = 22 classes au plus aujourd'hui, mais un plafond fixe deviendrait un bogue le jour où il est dépassé).
- **Aucun automatisme d'une année à l'autre** : les sommaires expirent le 31 août comme les liens et sont recréés par le gestionnaire.
- **Un nom est obligatoire** pour chaque sommaire : implantation, numéro incrémental avec date de création, repère RGPD de l'enseignant, nombre de classes (voir « Nom et identifiant »).
- Un sommaire ne peut pas être vide : on ne retire pas la dernière classe, on révoque.

## Écart avec ce qui avait été annoncé (à confirmer)

Je recommandais de nouvelles tables `ar_hubs` et `ar_hubs_classes`. En lisant le code, il existe mieux : **ajouter une colonne `mode` à `ar_liens`** (valeurs `fusion`, défaut, et `sommaire`). Un sommaire est alors un lien comme les autres, dont les classes se trouvent déjà dans `ar_liens_classes`. Cela reste l'option A (référence directe aux classes) mais évite de dupliquer :

| Réutilisé tel quel | Constaté dans |
|---|---|
| Création, secret opaque (hash), expiration au 31 août, purge | `api/_lib/liensData.js` (`creerLien`, `purgerLiensExpires`) |
| Contrôle « même école et même année » (le plafond de 10 est **levé pour les sommaires**, voir plus bas) | trigger `ar_liens_classes_controle` (`20260924d`) |
| Révocation immédiate, compteur d'ouvertures, liste « Liens enseignants » | `revoquerLien`, `ar_lien_compter_ouverture`, `LiensEnseignants.jsx` |
| RLS et droits de gestion (admin, référent, direction ; jamais agent) | `ar_can_editer_structure_ecole`, `api/_lib/liens.js` |
| Passerelle de profil de classe : un secret de lien ouvre le profil de **ses** classes | `api/profil-classe.js` : `lien.classeIds.includes(classeId)` (déduit : un sommaire en bénéficie sans modification, à tester) |

Contre : le mot « lien groupé » recouvre deux comportements (fusionné, sommaire). Atténuation : la colonne `mode` est explicite, et l'écran l'affiche.

## Nom et identifiant (obligatoires)

Chaque sommaire a un **nom d'affichage composé**, visible du gestionnaire dans « Liens enseignants » :

`Super lien SL-0042 (créé le 13 novembre 2026) · {implantation} · {repère enseignant} · {N} classes`

- **Repère enseignant** : le champ « Destinataire » existant, déjà obligatoire (1 à 80 caractères), avec sa règle RGPD actuelle (initiale du prénom, matière, implantation ; jamais le nom complet).
- **Numéro incrémental** `SL-0042` : nombre automatique attribué par la base à la création (colonne `numero` à identité, voir plus bas), jamais saisi, jamais réutilisé. Il évite que deux repères voisins (« A., français ») se confondent. Il est affiché sur 4 chiffres (`SL-0042`), calculé à l'affichage. **Décision de JF** : numérotation incrémentale plutôt qu'un code aléatoire.
- **Date de création** : la colonne `cree_le` existe déjà (aucune colonne à ajouter), formatée en français comme partout (`dateFR`).
- **Implantation et nombre de classes** : déduits automatiquement, jamais saisis (donc toujours justes après ajout ou retrait de classes).
- Le champ `nom_groupe` (titre de fiche fusionnée) n'est pas utilisé pour un sommaire.

## Ce que reçoit l'enseignant

1. Courriel : un lien intitulé « Aménagements à mettre en place — Vos classes ({implantation}) ».
2. Page du sommaire (`/fiche/<secret>`) : titre « Vos classes — {implantation} », référence `SL-0042` en petit, sans la date (elle permet à l'enseignant de la citer en cas de problème ; ce n'est pas une donnée personnelle) ; un grand bouton par classe, triées par niveau puis nom, texte 16 px minimum ; liens vers le catalogue et le mode d'emploi, comme sur la fiche actuelle. Aucun nom d'élève, aucun libellé « destinataire » (règle actuelle).
3. Clic sur une classe : la fiche habituelle de cette seule classe (`/fiche/<secret>/classe/<id>`), bouton « Imprimer / PDF » existant, plus un bouton « Retour à mes classes » (masqué à l'impression).
4. Après ajout ou retrait d'une classe par le gestionnaire : visible à la prochaine ouverture (pas de cache). Une classe retirée n'est plus ouvrable, même avec l'adresse de sa fiche.
5. Lien révoqué ou expiré, secret inconnu, classe absente du sommaire : **même réponse** « Ce lien n'est plus actif » (aucune information sur la cause).

## Ce que fait le gestionnaire

- **Création** : dans « Fiches », au même endroit que la fiche groupée (sélection de 2 classes ou plus). Un choix est ajouté : « Une seule fiche fusionnée » (comportement actuel, toujours limité à 10 classes) ou « Un sommaire : une fiche par classe » (sans plafond). Le champ « Destinataire » reste obligatoire, avec l'aide actuelle (repère sans nom complet). Après création, le numéro `SL-0042` est affiché avec le lien copié.
- **Avertissement affiché avant de générer un sommaire** : « Ce lien ouvre toutes les classes listées. Ne le transmettez qu'à l'enseignant concerné. » (surface d'exposition multipliée par le nombre de classes, même nature de risque que les liens actuels).
- **Gestion** dans « Liens enseignants » : la ligne d'un sommaire affiche le nom composé ci-dessus ; un bouton « Modifier les classes » ouvre une boîte de dialogue (cases à cocher des classes de l'école et de l'année du lien, regroupées par niveau, « Tout cocher / Tout décocher » par niveau pour 22 classes, au moins 1 coché) ; « Révoquer » inchangé.
- Aucun bouton de conversion entre `fusion` et `sommaire` (on crée un nouveau lien).

## Conception technique

1. **Migration** `supabase/migrations/2026MMDD_amenagactif_liens_sommaire.sql`, idempotente, additive :
   - `alter table ar_liens add column if not exists mode text not null default 'fusion' check (mode in ('fusion','sommaire'))` ;
   - **GRANT par colonnes** : `authenticated` n'a le droit de lire que les colonnes listées (`20260924d`, `revoke all` puis `grant select (colonnes)`). Il faut ajouter `mode` à ce `grant select`, sinon l'écran « Liens enseignants » ne peut pas la lire côté client. Vérification : `has_column_privilege('authenticated','public.ar_liens','mode','select')` ;
   - **plafond** : le trigger actuel (`create or replace function ar_liens_classes_controle`) refuse toute insertion quand le lien a déjà 10 classes, quel que soit le lien. Il est réécrit pour ne plafonner que les liens `fusion` (10) : un sommaire n'a pas de plafond fixe ; il est borné naturellement par les classes de l'école et de l'année. Le contrôle « même école et même année » reste pour les deux modes ;
   - colonne `numero bigint generated always as identity` + index unique : la base attribue elle-même le numéro à chaque insertion, sans collision possible, sans code de nouvelle tentative. Les liens existants reçoivent un numéro à l'ajout de la colonne. La lecture par `authenticated` de cette colonne est ajoutée au `grant select` ;
   - fonction `ar_lien_definir_classes(p_lien uuid, p_classes uuid[])` (service role uniquement) qui remplace atomiquement l'ensemble des classes (suppression puis insertion) et refuse un tableau vide ;
   - aucune table nouvelle, aucune politique RLS modifiée.
2. **`api/_lib/liens.js` et `liensData.js`** : la constante `MAX_CLASSES_PAR_LIEN` (10) ne s'applique plus qu'au mode `fusion` ; `creerLien` accepte `mode`, ne génère plus rien pour le numéro (la base le fait) ; `COLONNES_LIEN` inclut `mode` et `numero` ; une fonction pure `referenceLien(numero)` formate `SL-0042` ; nouvelle fonction `definirClasses`. La même limite est aujourd'hui contrôlée dans `api/fiche-token.js` (message « Au plus 10 classes par fiche groupée ») : à rendre dépendante du mode. Un plafond technique de protection d'entrée (par exemple 100 identifiants par requête) est conservé pour refuser des requêtes aberrantes ; il n'est pas une règle métier.
3. **`api/fiche-token.js`** :
   - POST : paramètre `mode` (`fusion` par défaut) ; le `nomGroupe` n'est utilisé que pour `fusion` ; la réponse renvoie aussi `numero` ;
   - GET `?token=<secret>` : si le lien est actif et `mode = 'sommaire'`, renvoie `{ sommaire: { titre, ecole, numero, classes: [{ id, nom, niveau }] } }` ; sinon comportement actuel inchangé ;
   - GET `?token=<secret>&classe=<uuid>` : vérifie que la classe appartient au lien (même refus 410 sinon), renvoie `{ vm, depuisSommaire: true }` ;
   - ouverture comptée comme aujourd'hui, `Cache-Control: private, no-store`.
4. **`api/liens.js`** : action POST `definir_classes` `{ lien_id, classe_ids }` ; contrôles : `peutGererEcole`, lien non révoqué, `mode = 'sommaire'`, au moins 1 classe, mêmes école et année (le trigger double la vérification) ; la liste GET expose `mode`, `numero` et le nombre de classes.
5. **Interface** :
   - route `/fiche/:token/classe/:classeId` dans `App.jsx` (la règle Vercel `/fiche/(.*)` couvre déjà les sous-chemins : en-têtes `noindex` et `no-referrer`, constaté dans `vercel.json`) ;
   - `FichePublique.jsx` : branche sommaire (nouveau composant `SommairePublic.jsx`) ou fiche selon la réponse ;
   - `FicheClassePage.jsx` (sélecteur) : le choix de mode ; `GenerateurLien.jsx` transmet `mode` ;
   - `LiensEnseignants.jsx` : colonne classes enrichie, bouton « Modifier les classes », boîte de dialogue accessible (`<dialog>` natif comme la révocation).
6. **Textes à compléter** (pas à renverser : le principe « la classe reste l'unité de tri, un lien pour un seul enseignant » reste vrai ; on ajoute que le sommaire regroupe, pour un même enseignant, l'accès aux fiches de ses classes) : le paragraphe « Un lien, un seul enseignant » de `src/pages/LiensEnseignants.jsx` (ligne ~169) et les trois modes d'emploi qui le reprennent, chacun en deux copies : `directions.html`, `directions-complet.html`, `referents-plai.html` dans `public/modes-emploi/` et `docs/modes-emploi/` ; le guide enseignant (`enseignants.html`, deux copies) pour expliquer le sommaire. Constaté : aucun test existant ne cite la phrase « un lien par classe » (recherche dans `liensPage`, `fichePubliqueGuide`, `generateurLienAvertissement`, `liensApi`, `liens`) ; les autres textes testés de ces fichiers sont à relire avant de modifier.

## Non-objectifs

- Sommaire entre plusieurs implantations ; réordonnancement manuel ; liens individuels par classe dans un sommaire.
- Notification de l'enseignant quand ses classes changent.
- Reconduction ou création automatique d'un sommaire (décision de JF : aucun automatisme).
- Modification de la passerelle de profil de classe ou du comportement des liens `fusion`.
- Aucune modification de l'accès aux données d'élèves : la fiche d'une classe est inchangée.

## Anti-objectifs

- Une classe consultable depuis un sommaire alors qu'elle n'y figure plus.
- Une réponse qui permette de deviner qu'un secret existe, qu'il est révoqué ou qu'une classe existe.
- Un lien `fusion` existant dont le comportement change.
- Un sommaire qui mélange écoles ou années, ou qui devient vide.
- Un lien `fusion` qui accepterait soudain plus de 10 classes (le levier du plafond ne doit toucher que le mode `sommaire`).
- Une numérotation par implantation ou par année (non voulue : le numéro est global, voir « Limites de la numérotation »).

## Garde-fous pour les autres Pôles

Aucune table ni colonne propre à un Pôle ; le Pôle se déduit de l'école (`ecole_id` déjà sur `ar_liens`). Le titre par défaut utilise l'implantation, pas « PLAI ».

## Vérification attendue (preuves à citer)

1. Tests Vitest (modèle `tests/domain/liensApi.test.js` avec `fakeDb.js`) : GET sommaire actif ; fiche d'une classe du sommaire ; classe hors sommaire → 410 identique à « inconnu » ; sommaire révoqué et expiré → 410 ; `definir_classes` refusé pour un agent, pour une autre école, pour un lien `fusion`, à 0 classe ; **un sommaire de 22 classes est accepté, une fiche fusionnée de 11 est toujours refusée** ; deux créations successives produisent des numéros strictement croissants ; liens `fusion` inchangés.
2. Test SQL dans `supabase/tests/liens_rls.sql` : colonnes `mode` et `numero` lisibles par `authenticated`, `token_hash` toujours illisible, trigger (plafond 10 pour `fusion`, aucun plafond pour `sommaire`, même école et même année pour les deux), numéro attribué automatiquement et croissant, fonction atomique et refus du tableau vide.
3. `npx vite build` et `npx vitest run` : sorties citées.
4. Parcours réel sur une école d'essai (jamais une vraie implantation) : créer un sommaire de 3 classes ; ouvrir l'adresse en navigation privée (sans connexion) ; ouvrir chaque fiche et revenir au sommaire ; retirer une classe, recharger, constater qu'elle a disparu et que l'ancienne adresse de sa fiche renvoie « lien plus actif » ; révoquer, constater le refus.
5. Largeur 375 px : aucun défilement horizontal sur le sommaire et le dialogue.
6. Ordre de mise en ligne : **migration d'abord** (additive, défaut `fusion`, aucun effet sur l'existant), puis le code. Migration appliquée seulement avec l'accord explicite de JF. L'ordre inverse casse l'existant : le code lit les colonnes `mode` et `numero`, absentes sans la migration, et tous les liens opaques (ainsi que la passerelle profil-classe, la liste et la création de liens) répondraient alors 500.

## Laissé au réalisateur

Style des boutons du sommaire (charte PLAI), noms internes, découpage des commits.

## Limites de la numérotation (à connaître, sans conséquence fonctionnelle)

- **Numéro global** : une seule suite pour toutes les implantations, toutes les années et, plus tard, tous les Pôles. Un numéro par implantation et par année exigerait un compteur verrouillé (plus de code, risque de doublons en cas de créations simultanées) : écarté pour rester simple.
- **Numéros non consécutifs** : une insertion annulée consomme un numéro. Il peut donc y avoir des trous (`SL-0041`, `SL-0043`). Le numéro identifie, il ne compte pas.
- **Rien de secret** : le numéro n'ouvre rien (l'accès repose sur le secret du lien) ; il révèle seulement le volume approximatif de liens créés. Jugé sans importance.

## Questions ouvertes pour JF

Aucune. Prochaine étape après votre approbation : le plan d'exécution.
