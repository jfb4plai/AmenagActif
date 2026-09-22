# AménagActif — numéro FASE sur les fiches, statut IPT/PAR affiché, correctif accès admin

Date : 2026-09-22

## Contexte

Trois demandes de JF, indépendantes :

1. Il a perdu l'accès admin sur le compte `jeanfrancois.beguin@ens.ecl.be` (message "Accès non autorisé pour votre profil").
2. Ajouter le nom de l'école + le numéro FASE de l'implantation en en-tête de la fiche élève et de la fiche école complète (pas la fiche classe/enseignant, pas la fiche publique).
3. Afficher le statut IPT/PAR à côté du nom de l'élève sur la fiche élève et la fiche école complète (pas sur la fiche classe/enseignant).
4. Dans la page admin, ajouter un champ "nom de l'implantation FASE" à côté du numéro FASE, éditable.

Le statut IPT/PAR existe déjà (`ar_eleves.statut`, migration `20260922_amenagactif_statut_eleve.sql`) mais son spec d'origine excluait explicitement tout affichage sur les fiches — ce document révise ce choix pour les fiches élève et école uniquement.

**Découverte clé** : `FicheEcolePage.jsx` (fiche école complète) ne fait que boucler sur les classes de l'école et réutiliser `FicheClasseView.jsx` — le même composant que la fiche classe/enseignant (`/classe/:id/fiche`) et la fiche publique (`/fiche/:token`). Comme le statut IPT/PAR doit apparaître sur l'une mais pas les autres, `FicheClasseView` reçoit une nouvelle prop optionnelle `showStatutEleve` (défaut `false`), activée uniquement par `FicheEcolePage`.

## 1. Correctif accès admin (hors code)

Diagnostic : `RequireRole.jsx:8` affiche "Accès non autorisé" quand `useRole()` (dans `lib/auth.jsx`) ne trouve aucune ligne dans `ar_profils_acces` pour l'utilisateur connecté. JF a un compte admin existant (UUID `97d50a80-462c-41f2-bb93-8c0ea119a195`, probablement lié à `jf.beguin@outlook.com`) mais `jeanfrancois.beguin@ens.ecl.be` semble être un compte Supabase Auth distinct, sans ligne dans `ar_profils_acces`.

Pas de changement de code : script SQL de diagnostic puis correctif, à exécuter par JF dans le SQL Editor Supabase (projet `dfoaumjleqtxjeaplnna`), fourni séparément à l'exécution du plan (pas versionné comme migration — c'est une correction de données ponctuelle, pas un changement de schéma).

Diagnostic :
```sql
select u.id, u.email, p.role, p.ecole_id
from auth.users u
left join ar_profils_acces p on p.user_id = u.id
where u.email in ('jeanfrancois.beguin@ens.ecl.be', 'jf.beguin@outlook.com');
```

Deux issues possibles selon le résultat :
- Si `jeanfrancois.beguin@ens.ecl.be` existe dans `auth.users` sans ligne `ar_profils_acces` → `insert into ar_profils_acces (user_id, role, ecole_id) values ('<uuid>', 'admin', null);`
- Si le compte lui-même n'existe pas dans `auth.users` → JF doit d'abord se créer un compte (inscription normale) avant l'insert ci-dessus.

## 2. Modèle FASE

### Données

Nouvelle colonne sur `ar_ecoles` :

```sql
alter table ar_ecoles add column if not exists implantation_nom text;
```

`ar_ecoles.implantation` (déjà existant, texte libre) devient sémantiquement le **numéro FASE** — aucun changement de type ni de contrainte, seulement un changement de libellé côté UI et de sens métier. `implantation_nom` = nom de l'implantation FASE (distinct de `ar_ecoles.nom`, qui reste le nom de l'établissement/école).

### UI admin (`Administration.jsx`, `SectionEcoles`)

- Renommer le label du champ existant : "Implantation (code court)" → "Numéro FASE", placeholder `waha` → `12345` (les numéros FASE sont numériques en pratique, le champ reste `text` pour rester tolérant).
- Nouveau champ input à côté : "Nom de l'implantation (FASE)", `onBlur` sur `majEcole.mutate({ id, implantation_nom })`, même pattern que les champs existants.
- `useEcolesAdmin()` ([useEcoleGrid.js](../../../src/hooks/useEcoleGrid.js)) étend son `select` pour inclure `implantation_nom`.
- `useEcoles()` (utilisé par les sélecteurs de saisie/fiches) n'a pas besoin de `implantation_nom` pour son usage actuel (liste déroulante) mais **doit** inclure `implantation` (le numéro FASE) puisque les fiches élève/école en ont besoin pour l'en-tête — c'est déjà sélectionné aujourd'hui (`id, nom, implantation`), rien à changer là.
- `majEcole` (mutation dans `useAdmin.js`) accepte déjà un objet partiel `{ id, ...champs }` transmis tel quel à `.update()` — `implantation_nom` passe sans changement de signature.

## 3. Fiche élève (`FicheEleveView.jsx`, `useFicheEleve.js`, `ficheEleve.js`)

### Données

`useFicheEleve.js` étend son select initial :

```js
.from('ar_eleves')
.select('id, prenom, initiale_nom, commentaire, statut, classe_id, ar_classes(nom, ar_ecoles(nom, implantation))')
```

`computeFicheEleve` (dans `ficheEleve.js`) reçoit et retourne en plus : `statut` (déjà présent sur `eleve`, à extraire), `ecoleNom`, `ecoleFase` (nouveaux paramètres calculés dans `useFicheEleve.js` depuis `eleve.ar_classes?.ar_ecoles`, transmis comme `classeNom` l'est aujourd'hui).

### Affichage (`FicheEleveView.jsx`)

- Sous le `<header>` logo (avant le `<h1>`), ligne de contexte identique en esprit à celle de `FicheClasseView` : `{vm.ecoleNom} · FASE {vm.ecoleFase}`.
- Dans le `<h1>`, badge à côté du nom : `Aménagements — {vm.eleve} <span className="badge-statut">{vm.statut}</span> ({vm.classeNom})`.

## 4. Fiche école complète (`FicheEcolePage.jsx`, `FicheClasseView.jsx`, `ficheClasse.js`)

### En-tête école + FASE (page-level, une fois)

`FicheEcolePage.jsx` a déjà `ecoles` (via `useEcoles()`, contient `nom, implantation`) et `ecoleActive`. Ajouter, juste avant la boucle `classes.map(...)` :

```jsx
{ecoleActive && anneeActive && (() => {
  const e = ecoles.find((x) => x.id === ecoleActive);
  return e ? <p className="font-semibold mb-2">{e.nom} · FASE {e.implantation || '—'}</p> : null;
})()}
```

### Statut IPT/PAR par élève (composant partagé, prop d'activation)

- `computeFicheClasse` ([ficheClasse.js](../../../src/domain/projections/ficheClasse.js)) : `nomEleve(e)` reste inchangé (texte brut, utilisé tel quel là où on ne veut pas le statut). On ajoute `statut: e.statut` aux objets qui identifient un élève par son nom affiché : `parAmenagement[].eleves[]` (ligne 68, `ajouterEleveAAmenagement` prend `statut` en plus de `nom, eleveId`) et `commentaires[]` (ligne 40, ajoute `statut: e.statut`). Le VM porte donc toujours le statut ; c'est la vue qui décide de l'afficher ou non.
- `FicheClasseView.jsx` reçoit une nouvelle prop `showStatutEleve = false`. Quand `true` :
  - dans le tableau "AR spécifiques à un élève" (ligne 42), le `<li>` devient `<a href=...>{e.nom}</a> <span className="badge-statut">{e.statut}</span>`.
  - dans le tableau "Commentaires" (ligne 65), la cellule devient `{c.eleve} <span className="badge-statut">{c.statut}</span>`.
  - Quand `false` (comportement actuel, fiche classe/enseignant et fiche publique) : aucun changement visuel, `e.statut`/`c.statut` simplement ignorés.
- `FicheEcolePage.jsx` → `FicheUneClasse` → `<FicheClasseView vm={vm} showStatutEleve />`.
- `FicheClassePage.jsx` et `FichePublique.jsx` : aucun changement, la prop garde sa valeur par défaut `false`.

### Style du badge

Petit badge textuel (pas besoin de composant partagé séparé pour deux occurrences) : classe utilitaire Tailwind inline, ex. `text-xs font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700`, cohérent avec le style neutre déjà utilisé sur les fiches (fond gris, pas de couleur vive — les fiches sont pensées pour l'impression N&B).

## Hors périmètre

- Pas de changement sur `FicheClassePage.jsx` (fiche classe/enseignant) ni `FichePublique.jsx` (lien enseignant par jeton) — ni FASE, ni IPT/PAR.
- Pas de filtre/tri par statut IPT/PAR construit dans cette itération (déjà écarté dans le spec du 2026-09-22 précédent, toujours valable).
- `implantation_nom` (nom de l'implantation FASE) n'apparaît nulle part sur les fiches — uniquement dans l'écran admin. Si besoin plus tard, extension simple (même schéma que `ecoleFase`).

## Self-Review

- **Placeholders** : aucun, code/SQL exact cité pour chaque changement.
- **Cohérence** : `showStatutEleve` par défaut `false` garantit que les deux routes existantes (fiche classe, fiche publique) ne changent pas de comportement sans y toucher explicitement — pas de risque de régression silencieuse.
- **Portée** : resserrée aux 4 points demandés par JF ; le correctif d'accès est traité comme une action opérationnelle (SQL fourni à l'exécution du plan), pas comme un changement de code applicatif.
- **Ambiguïté** : "numéro FASE" confirmé = réutilisation de `ar_ecoles.implantation` existant (décision prise en clarification), pas une nouvelle colonne numérique séparée.
