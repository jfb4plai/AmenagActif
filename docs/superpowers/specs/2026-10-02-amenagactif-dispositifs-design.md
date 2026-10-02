# AménagActif — Dispositifs (groupes d'aménagements AR ou AU selon la classe)

Date : 2026-10-02. Statut : validée par JF, plan écrit (docs/superpowers/plans/2026-10-02-amenagactif-dispositifs.md).

## Objectif

Introduire des groupes d'aménagements nommés « dispositifs » (premier : « Dispositif de régulation des comportements »). Par défaut leurs items sont des **AR** (cochés par élève). Pour une classe donnée, une case par dispositif les fait basculer en **AU** (cochés une fois pour la classe). Le mode est unique par couple (classe, dispositif).

## Décisions (validées par JF)

1. Chaque dispositif est son propre groupe (chapitre marqué « dispositif ») avec sa propre case par classe. Les chapitres 1 à 12 ne changent pas.
2. Une case par dispositif et par classe.
3. La case et un badge (« AR · par élève » / « AU · toute la classe ») sont dans l'en-tête du dispositif, identique en mode AR (dans la grille) et en mode AU (dans une carte sous les AU). Une ligne récapitulative en haut de la saisie résume l'état de chaque dispositif.
4. Bascule bloquée si des données existent dans l'autre mode (message : nombre d'élèves ou d'items à vider d'abord). Pas de conversion automatique.
5. Fiche classe, mode AR : les items vont dans le tableau « AR spécifiques à un élève », mêlés aux autres AR.
6. Fiche classe, mode AU : un bloc par dispositif sous le bloc AU, titré avec le titre exact du dispositif.
7. Fiche élève : elle affiche tous les AU de la classe (bloc « AU applicable(s) à toute la classe », surbrillance de « Mise en page » comme sur la fiche classe), puis les blocs des dispositifs en mode AU. (Décision JF 2026-10-02 : la fiche élève n'affichait jusqu'ici aucun AU de classe.) Dispositifs en mode AR : leurs items cochés pour l'élève figurent sous le titre du dispositif dans ses aménagements.
8. Profil DiffActif et autres consommateurs : lisent le type effectif (AU ou AR selon la fiche classe). Chantier DiffActif reporté ; AménagActif prépare la donnée.
9. Rôles : la bascule est réservée à référent PLAI, direction, admin. L'agent accompagnant peut ajouter un dispositif en AU mais pas le retirer (règle RLS déjà en place pour les AU).
10. Confirmation avant tout décochage d'un AU de classe (**tous les AU**, pas seulement les dispositifs) par référent/direction/admin, avec explication des conséquences : retrait de la fiche pour tous les enseignants, signalé comme retrait au prochain envoi, absent du profil DiffActif.
11. Catalogue public : badge « Dispositif » + mention « AU ou AR selon la classe » (le catalogue n'a pas de notion de classe, un badge dynamique y est impossible).
12. Contenu initial : groupe « Dispositif de régulation des comportements » créé vide ; l'admin ajoute les items via Administration.

## Modèle de données

- `ar_chapitres.est_dispositif boolean not null default false`.
- Nouvelle table `ar_classe_dispositifs (classe_id uuid, chapitre_id uuid, pour_toute_la_classe boolean not null default false, modifie_le timestamptz default now(), primary key (classe_id, chapitre_id))`, préfixe `ar_` respecté. Absence de ligne = mode AR.
- Les items d'un dispositif gardent `ar_amenagements.type = 'AR'` (valeur de base) : la contrainte `check (type in ('AU','AR'))` ne change pas. Le type effectif est calculé, jamais stocké.
- Stockage des cochages inchangé : `ar_selections` (mode AR), `ar_amenagements_classe` (mode AU). Aucune migration de données.
- Migration unique : colonne, table, `GRANT` (select anon non requis ; select/insert/update/delete authenticated ; all service_role), RLS : lecture via `ar_can_read_ecole` (jointure sur la classe), écriture via `ar_can_editer_structure_ecole`. Fonctions `security definer` existantes uniquement, pas d'EXISTS auto-joint (voir incident RLS récursion 2026-09-23). Nom : `20261002_amenagactif_dispositifs.sql`, à exécuter par JF.

## Domaine

Fonction pure unique `typeEffectif(amenagement, chapitresById, modesDispositifs)` : `AU` si le chapitre est un dispositif en mode « pour toute la classe », sinon `a.type`. Appelée par `ficheClasse`, `ficheEleve`, `fusionClasses`, `snapshot`, `profilDiffActif`, `profilClasse`. Les projections ignorent défensivement une ligne stockée dans le mauvais mode (cas qui ne devrait pas exister vu le blocage).

`ficheClasse` expose `dispositifsClasse: [{ titre, items: [libelle] }]` (mode AU) ; les dispositifs en mode AR alimentent `parAmenagement` comme les AR existants. `fusionClasses` : un dispositif peut être AU dans une classe et AR dans une autre ; en fiche groupée, le bloc AU est étiqueté par classe (même principe que `commentairesClasses`).

## Chargement des données

Charger `ar_classe_dispositifs` partout où `ar_amenagements_classe` l'est : `useEcoleGrid`, `useFicheClasse`, `useFicheEleve`, `chargeurFiche` (partagé client + serveur).

## Interface

- Saisie : composant `EnTeteDispositif` (case + badge + message de blocage) ; `ChapitreAR` l'affiche pour un chapitre dispositif en mode AR ; nouvelle carte `CarteDispositif` sous `BandeauAU` en mode AU. La recherche par mots-clés couvre les deux.
- Fiche : `FicheClasseView` et `FicheEleveView` rendent les blocs ci-dessus.
- `BandeauAU` : confirmation au décochage (rôles non-agent), texte des conséquences.
- Administration : case « dispositif » posée à la création d'un chapitre uniquement (option (a) validée par JF : pas de modification après coup, pour éviter chapitres mixtes AU/AR et cochages orphelins) ; le sélecteur de type est masqué pour les items d'un chapitre dispositif (forcé AR). Catalogue public : badge « Dispositif ».

## Hors périmètre

Évolution du contrat DiffActif (les codes des items dispositifs devront être stables ; DiffActif devra les reconnaître ou les ignorer — non vérifié) ; explications « pourquoi ça aide » et références RISS pour les items (aucune référence ajoutée ici) ; rebase de `feature/explications-amenagements` (petit conflit attendu dans `Administration.jsx`).

## Tests (TDD)

`typeEffectif` ; projections `ficheClasse`/`fusionClasses`/`snapshot`/`profilDiffActif` (dispositif AR, AU, mixte entre classes, ligne dans le mauvais mode) ; règle de blocage de bascule ; fixtures étendues. Revue globale finale après la dernière tâche du plan, avec vérification en navigateur du flux complet (bascule, fiche, fiche élève, lien enseignant).
