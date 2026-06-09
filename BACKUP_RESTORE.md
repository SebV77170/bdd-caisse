# Sauvegarde et restauration

Cette procedure permet de remettre la caisse en service apres une panne du
poste, une base locale endommagee ou une migration ayant echoue.

## Contenu d'une sauvegarde

Une sauvegarde contient :

- `ressourcebrie-sqlite.db`, avec les ventes, paiements, corrections, sessions
  et donnees locales ;
- tous les fichiers JSON de configuration situes dans `.bdd-caisse` ;
- les dossiers `tickets` et `factures`.

Le fichier temporaire `sessions.sqlite` n'est pas sauvegarde. Chaque sauvegarde
possede un `manifest.json` avec la taille et l'empreinte SHA-256 de chaque
fichier. La base SQLite est aussi controlee avec `PRAGMA quick_check`.

Par defaut, les sauvegardes sont creees dans :

```text
C:\Users\<utilisateur>\.bdd-caisse-backups
```

Ce dossier est distinct du profil actif :

```text
C:\Users\<utilisateur>\.bdd-caisse
```

Une copie recente doit aussi etre conservee sur un support different du disque
du poste de caisse.

## Creer une sauvegarde

Fermer de preference l'application, puis lancer depuis la racine du projet :

```powershell
npm run backup
```

Pour choisir un autre emplacement :

```powershell
npm run backup -- "E:\Sauvegardes caisse"
```

Depuis une installation Windows, ouvrir PowerShell dans le dossier `resources`
de Bdd-caisse et lancer :

```powershell
.\tools\sauvegarder-caisse.ps1
```

Le script affiche le chemin exact de la sauvegarde creee et verifiee.

## Restaurer sur un autre poste

1. Installer la meme version de Bdd-caisse, ou une version plus recente.
2. Fermer completement Bdd-caisse sur le poste de destination.
3. Copier le dossier complet de sauvegarde sur ce poste.
4. Ouvrir PowerShell dans le dossier `resources` de l'installation.
5. Lancer :

```powershell
.\tools\restaurer-caisse.ps1 -Sauvegarde "E:\Sauvegardes caisse\20260609..."
```

Le script controle d'abord le manifeste et la base. Il demande ensuite de
taper `RESTAURER`. L'ancien profil est conserve a cote du profil actif dans un
dossier `.bdd-caisse-rollback-*`.

Depuis le projet, la commande equivalente est :

```powershell
npm run restore -- -Sauvegarde "E:\Sauvegardes caisse\20260609..."
```

## En cas d'erreur

Une sauvegarde absente, modifiee, incomplete ou contenant une base SQLite
illisible est refusee avant le remplacement du profil. Ne supprimez pas le
profil `.bdd-caisse` manuellement.

Apres restauration, lancer Bdd-caisse et verifier :

- la derniere session de caisse ;
- quelques tickets recents ;
- les montants par moyen de paiement ;
- les tickets et factures PDF ;
- la configuration du poste.

## Sauvegardes avant migration

Lorsqu'une nouvelle version detecte des colonnes ou tables a ajouter, elle cree
automatiquement une sauvegarde `pre-migration` avant de modifier la base. Si la
base existante est illisible, le demarrage s'arrete avec une erreur et le
fichier endommage n'est pas remplace silencieusement.
