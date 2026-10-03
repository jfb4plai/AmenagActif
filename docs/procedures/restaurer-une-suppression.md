# Réactiver une classe ou un élève supprimé par erreur

Quand un référent signale « j'ai supprimé la classe 5LA » (ou un élève) : tout est conservé **30 jours** dans une archive, invisible dans l'application. Seul l'administrateur peut le réactiver, dans l'éditeur SQL de Supabase (projet partagé, base « RetroActif ») ou en ligne de commande.

## 1. Retrouver la suppression

```sql
select * from ar_archive_lister('5LA');   -- un mot du nom de la classe, de l'élève ou de l'implantation
select * from ar_archive_lister();        -- toutes les suppressions récentes
```
Colonnes utiles : `id` (à recopier), `genre` (classe ou élève), `libelle`, `nb_eleves`, `ecole`, `annee`, `supprime_le`, `supprime_par_nom`, `jours_restants`, `restaure_le` (renseigné si déjà réactivé).

## 2. Réactiver

```sql
select ar_archive_restaurer('<id>');
```
Le résultat est un bilan (`eleves`, `selections`, `libres`, `au`, `ignores`). `ignores` doit valoir 0 ; sinon, des lignes n'ont pas pu être rétablies parce que leur parent n'existe plus (aménagement retiré du catalogue, par exemple).

Le référent recharge la page (Ctrl+F5) : la classe, ses élèves, leurs aménagements, ses AU, ses dispositifs et le rattachement de ses **liens enseignants** sont revenus, avec les mêmes identifiants.

## 3. Cas particuliers

| Message | Cause | Solution |
|---|---|---|
| `nom_deja_utilise` | une classe porte déjà ce nom (recréée entre-temps) | `select ar_archive_restaurer('<id>', '5LA (ancienne)');` |
| `classe_introuvable` (élève) | la classe de l'élève n'existe plus | `select ar_archive_restaurer('<id>', null, '<id de la classe d''accueil>');` |
| `ecole_disparue` / `annee_disparue` | l'école ou l'année a été supprimée | restauration impossible : recréer d'abord l'école ou l'année avec le même identifiant, ou contacter le développeur |
| `deja_restauree` | cet élément a déjà été réactivé | rien à faire |
| `archive_introuvable` | identifiant erroné, ou archive purgée (plus de 30 jours) | relancer la recherche |

## 4. Ce qui n'est pas rétabli
- Le lien « élève repris de l'année précédente » des **successeurs** (les élèves de l'année suivante repris depuis un élève supprimé) : refaire une reprise si nécessaire.
- Les modifications de texte (commentaires écrasés, noms de référents), qui ne sont pas des suppressions.
- Au-delà de 30 jours, l'archive est purgée automatiquement (chaque nuit à 03 h 30).

## 5. Effacement immédiat (demande RGPD)
```sql
select ar_archive_effacer('<id>');   -- supprime la ligne d'archive tout de suite
```
Penser à vérifier qu'il n'existe pas d'autre ligne d'archive pour la même personne (recherche par prénom).

## Limites
Cet archivage n'est **pas une sauvegarde** de la base : il ne protège que des suppressions de classes et d'élèves faites depuis l'application.
