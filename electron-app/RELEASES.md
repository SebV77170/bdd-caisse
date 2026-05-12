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

L'application packagée et le script de publication chargent automatiquement `.env`, `backend/.env`, puis `electron-app/.env` (sans écraser les variables déjà définies). Si `BDD_CAISSE_UPDATE_URL` est absente, ils la dérivent du profil `prod` de `WEBDAV_ENDPOINTS` et du chemin `/releases`. Le bouton "Rechercher une mise à jour" utilise donc la même URL dérivée que `npm run package:publish`.

Le script de publication utilise aussi :

- `BDD_CAISSE_UPDATE_URL` : si absente, elle est dérivée de `WEBDAV_ENDPOINTS` avec le profil `prod` (ou le premier profil disponible si `prod` est absent) et le chemin `/releases`.
- `BDD_CAISSE_RELEASE_WEBDAV_PROFILE` ou `WEBDAV_PROFILE` : nom du profil `WEBDAV_ENDPOINTS` à utiliser pour publier la release (par défaut : `prod`, ou le premier profil disponible si `prod` est absent).
- `BDD_CAISSE_RELEASE_WEBDAV_PATH` ou `BDD_CAISSE_UPDATE_PATH` : chemin du dossier de release à ajouter à l'URL du profil (par défaut : `/releases`).
- `BDD_CAISSE_WEBDAV_USER` ou `WEBDAV_USERNAME` : identifiant WebDAV (optionnel si accès public en écriture).
- `BDD_CAISSE_WEBDAV_PASSWORD` ou `WEBDAV_PASSWORD` : mot de passe WebDAV (optionnel si accès public en écriture).
- `BDD_CAISSE_RELEASE_NOTES` : texte des dernières modifications à afficher à l'utilisateur après mise à jour.
- `BDD_CAISSE_RELEASE_NOTES_FILE` : chemin vers un fichier de notes si tu préfères écrire un message plus long.
- `BDD_CAISSE_UPLOAD_RETRIES` : nombre de tentatives par fichier en cas d'erreur réseau (`3` par défaut).
- `BDD_CAISSE_UPLOAD_TIMEOUT_MS` : délai maximum sans réponse pour un upload (`300000`, soit 5 minutes, par défaut).

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

## 3) Version et notes de version

Avant de lancer `electron-builder`, le script de release prépare les métadonnées :

- avec `release:publish` / `package:publish`, il propose automatiquement d'incrémenter la version de `electron-app/package.json` (par défaut : incrément automatique, ex. `1.2.2` -> `1.2.3` ou `1.3` -> `1.4`) ;
- il met aussi à jour `electron-app/package-lock.json` si présent ;
- tu peux saisir une version courte (`1.3`, `2.0`) ; elle sera normalisée pour `electron-builder` (`1.3.0`, `2.0.0`) car l'outil exige une version semver complète ;
- il demande les évolutions de la version pour les injecter dans `latest.yml` (`releaseNotes`) et les afficher à l'utilisateur après mise à jour.

Options utiles :

```bash
npm run package:publish -- --version=1.2.3 --notes="Correction de la mise à jour automatique"
npm run package:publish -- --version=2.0 --notes="Nouvelle version majeure"
npm run package:no-publish -- --bump-version
npm run package:publish -- --no-version-bump
```

Tu peux aussi utiliser `BDD_CAISSE_RELEASE_VERSION`, `BDD_CAISSE_RELEASE_NOTES` ou `BDD_CAISSE_RELEASE_NOTES_FILE` en CI.

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
2. prépare la version et les notes de version avant le build,
3. lance `electron-builder --publish never`,
4. si une URL de mise à jour est disponible (`BDD_CAISSE_UPDATE_URL` explicite ou dérivée de `WEBDAV_ENDPOINTS`), fournit à `electron-builder` une configuration temporaire `publish` de type `generic` pour générer `latest.yml`, même avec `release:no-publish`,
5. génère les artefacts dans `electron-app/dist/`,
6. si tu publies, prépare le dossier WebDAV distant avec `MKCOL`,
7. ajoute les notes dans `latest.yml`,
8. upload `latest.yml`, l'installateur et les fichiers `.blockmap` vers `BDD_CAISSE_UPDATE_URL` avec retry en cas d'erreur réseau (`ECONNRESET`, timeout, etc.).

## 5) Publication automatique sans question

Pour publier automatiquement depuis la racine (utile en CI/CD ou si tu sais déjà que tu veux publier) :

```bash
npm run package:publish
```

Pour construire sans jamais publier depuis la racine (génère aussi `latest.yml` si l'URL de mise à jour est configurée ou dérivable) :

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

Lancer l'application packagée avec `BDD_CAISSE_UPDATE_URL` pointant vers le dossier WebDAV qui contient `latest.yml`, ou avec un `WEBDAV_ENDPOINTS` contenant le profil `prod` pour que l'URL soit dérivée automatiquement.

Au démarrage, elle doit logguer la vérification de MAJ et télécharger automatiquement si la version distante est plus récente. Tu peux aussi lancer la recherche depuis le bouton des paramètres : l'application lit d'abord `latest.yml` pour afficher immédiatement "déjà à jour" quand la version WebDAV est identique à la version installée, ou "mise à jour disponible" dès qu'une version différente est détectée. Dans ce second cas, l'application demande d'abord confirmation avec la boîte de dialogue "Voulez-vous vraiment mettre à jour l'application ?". Si l'utilisateur accepte, `electron-updater` est lancé en arrière-plan avec les identifiants WebDAV dérivés du profil, et l'écran Paramètres affiche ensuite l'état du téléchargement (progression, erreur ou redémarrage).
