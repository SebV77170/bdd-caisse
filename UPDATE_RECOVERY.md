# Mise à jour et retour arrière

## Données conservées

Les données de caisse sont stockées dans :

```text
%USERPROFILE%\.bdd-caisse
```

Ce dossier est distinct du dossier d’installation de l’application. La
configuration NSIS actuelle ne demande pas sa suppression pendant une
désinstallation.

Il contient notamment la base `ressourcebrie-sqlite.db`, les tickets, les
factures et les fichiers de configuration locaux.

## Mise à jour interrompue pendant le téléchargement

Le téléchargement est effectué en arrière-plan. Une panne réseau ou un fichier
incomplet ne remplace pas la version installée. Fermer puis rouvrir
l’application permet de continuer avec la version actuelle et de relancer la
recherche de mise à jour plus tard.

La vérification distante ne bloque pas le démarrage du backend ni l’ouverture
de la caisse.

## Installation interrompue

Ne pas provoquer volontairement une coupure sur un poste de production.
Effectuer ce contrôle uniquement sur un poste de recette.

Si la nouvelle version ne démarre plus :

1. ne pas supprimer `%USERPROFILE%\.bdd-caisse` ;
2. désinstaller uniquement le programme ;
3. réinstaller l’installeur de la version précédente conservé dans les
   releases ;
4. relancer l’application et vérifier le bilan avant toute nouvelle vente.

La migration SQLite est additive et transactionnelle. Une migration impossible
est annulée plutôt que partiellement appliquée.

## Contrôle automatisé

Depuis la racine :

```powershell
npm run test:installation
```

Cette commande teste le premier lancement, les migrations depuis les tags
historiques disponibles, le second lancement, la conservation des données et
la politique de démarrage en cas de panne de mise à jour.
