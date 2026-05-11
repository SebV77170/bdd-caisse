# Publier une release WebDAV compatible auto-update (Electron)

Ce projet utilise `electron-updater` : l'application installée compare sa version locale avec les métadonnées publiées sur ton serveur WebDAV.

Pour que ça fonctionne, il faut publier **les artefacts Electron Builder** (pas seulement un tag Git) : l'installeur, `latest.yml` et les fichiers de blockmap.

## 1) Pré-requis serveur WebDAV

1. Disposer d'un dossier distant WebDAV dédié aux releases (ex: `https://mon-serveur/webdav/bdd-caisse/releases/`).
2. Avoir les accès en écriture (upload des artefacts).
3. Rendre ce dossier lisible par les applications installées, car elles téléchargent `latest.yml` et l'installeur depuis cette URL.

## 2) Variables d'environnement

L'auto-update lit cette variable au runtime (dans `electron-app/main.js`) :

- `BDD_CAISSE_UPDATE_URL` : URL du dossier WebDAV qui contient `latest.yml`.

Le script de publication charge automatiquement `.env`, `backend/.env`, puis `electron-app/.env` (sans écraser les variables déjà définies). Il peut donc réutiliser les profils `WEBDAV_ENDPOINTS` déjà présents dans `backend/.env`.

Le script de publication utilise aussi :

- `BDD_CAISSE_UPDATE_URL` : si absente, elle est dérivée de `WEBDAV_ENDPOINTS` avec le profil `prod` (ou le premier profil disponible si `prod` est absent) et le chemin `/releases`.
- `BDD_CAISSE_RELEASE_WEBDAV_PROFILE` ou `WEBDAV_PROFILE` : nom du profil `WEBDAV_ENDPOINTS` à utiliser pour publier la release (par défaut : `prod`, ou le premier profil disponible si `prod` est absent).
- `BDD_CAISSE_RELEASE_WEBDAV_PATH` ou `BDD_CAISSE_UPDATE_PATH` : chemin du dossier de release à ajouter à l'URL du profil (par défaut : `/releases`).
- `BDD_CAISSE_WEBDAV_USER` ou `WEBDAV_USERNAME` : identifiant WebDAV (optionnel si accès public en écriture).
- `BDD_CAISSE_WEBDAV_PASSWORD` ou `WEBDAV_PASSWORD` : mot de passe WebDAV (optionnel si accès public en écriture).
- `BDD_CAISSE_RELEASE_NOTES` : texte des dernières modifications à afficher à l'utilisateur après mise à jour.
- `BDD_CAISSE_RELEASE_NOTES_FILE` : chemin vers un fichier de notes si tu préfères écrire un message plus long.

Exemple :

```bash
export BDD_CAISSE_UPDATE_URL=https://mon-serveur/webdav/bdd-caisse/releases/
export BDD_CAISSE_WEBDAV_USER=mon-utilisateur
export BDD_CAISSE_WEBDAV_PASSWORD=mon-mot-de-passe
export BDD_CAISSE_RELEASE_NOTES="Correction de la clôture de caisse et ajout du bouton de mise à jour."

# Variante si backend/.env contient déjà WEBDAV_ENDPOINTS :
export BDD_CAISSE_RELEASE_WEBDAV_PROFILE=prod
export BDD_CAISSE_RELEASE_WEBDAV_PATH=/releases
```

## 3) Incrémenter la version

Mettre à jour la version dans `electron-app/package.json` (ex: `1.2.2` -> `1.2.3`).

## 4) Build avec question de publication

Depuis la racine du projet (comme l'ancien `npm run package`) :

```bash
npm run package
```

Le `package.json` à utiliser est celui de la racine du dépôt. La commande `package` contient directement le build React, la copie du build dans Electron, la construction de l'installeur, puis la question de publication WebDAV. Les scripts `release*` restent seulement des alias pratiques.

Tu peux aussi lancer seulement la partie Electron depuis `electron-app/` :

```bash
npm run release
```

Le script :

1. demande si tu veux publier la mise à jour sur WebDAV (sauf avec `release:publish` ou `release:no-publish`),
2. lance `electron-builder --publish never`,
3. si la publication est demandée, fournit à `electron-builder` une configuration temporaire `publish` de type `generic` avec `BDD_CAISSE_UPDATE_URL` pour générer `latest.yml`,
4. génère les artefacts dans `electron-app/dist/`,
5. si tu publies, ajoute les notes dans `latest.yml`,
6. upload `latest.yml`, l'installateur et les fichiers `.blockmap` vers `BDD_CAISSE_UPDATE_URL`.

## 5) Publication automatique sans question

Pour publier automatiquement depuis la racine (utile en CI/CD ou si tu sais déjà que tu veux publier) :

```bash
npm run package:publish
```

Pour construire sans jamais publier depuis la racine :

```bash
npm run package:no-publish
```

Équivalents depuis `electron-app/` :

```bash
npm run release:publish
npm run release:no-publish
```

Tu peux aussi fournir un fichier de notes :

```bash
npm run package:publish -- --notes-file=../CHANGELOG_RELEASE.md
```

## 6) Message des dernières modifications côté utilisateur

Le script ajoute les notes de version dans `latest.yml` via le champ `releaseNotes`.

Quand une mise à jour est téléchargée, l'application sauvegarde ces notes avant de redémarrer. Au prochain lancement, elle affiche une boîte de dialogue indiquant la version installée et le détail des changements.

## 7) Vérifier le dossier de release WebDAV

Vérifier la présence de :

- l'installeur Windows (`*.exe`),
- `latest.yml`,
- blocs (`*.blockmap` éventuels).

Sans `latest.yml`, `electron-updater` ne peut pas déterminer la version/URL de mise à jour.

## 8) Vérification côté app

Lancer l'application packagée avec `BDD_CAISSE_UPDATE_URL` pointant vers le dossier WebDAV qui contient `latest.yml`.

Au démarrage, elle doit logguer la vérification de MAJ et télécharger automatiquement si la version distante est plus récente. Tu peux aussi lancer la recherche depuis le bouton des paramètres.
