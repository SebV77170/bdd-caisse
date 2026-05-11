# Publier une release WebDAV compatible auto-update (Electron)

Ce projet utilise `electron-updater` : l'application installée compare sa version locale avec les métadonnées publiées sur ton serveur WebDAV.

Pour que ça fonctionne, il faut publier **les artefacts Electron Builder** (`latest.yml`, l'installateur et les blockmaps) dans un dossier WebDAV accessible en lecture.

## 1) Pré-requis serveur WebDAV

1. Disposer d'un endpoint WebDAV déjà déclaré dans `backend/.env` via `WEBDAV_ENDPOINTS`.
2. Avoir les accès en écriture pour uploader les artefacts générés.
3. Prévoir un dossier distant dédié aux releases (par défaut `/releases`).

## 2) Configuration utilisée par l'application

L'auto-update ne lit plus `BDD_CAISSE_UPDATE_URL`. Il réutilise les accès déjà déclarés dans `backend/.env` via `WEBDAV_ENDPOINTS`.

Exemple de profil :

```json
{
  "production": {
    "label": "Serveur production",
    "url": "https://mon-serveur/webdav/",
    "username": "utilisateur",
    "password": "motdepasse",
    "basePath": "/tickets",
    "updatePath": "/releases"
  }
}
```

Notes :

- `url`, `username` et `password` sont obligatoires.
- `updatePath` indique le dossier qui contiendra `latest.yml` et l'installateur.
- Si `updatePath` est absent, l'application utilise `/releases` par défaut.
- Le profil actif est celui enregistré dans la configuration WebDAV de l'application ; sinon le premier profil de `WEBDAV_ENDPOINTS` est utilisé.

## 3) Incrémenter la version

Mettre à jour la version dans `electron-app/package.json` (ex: `1.2.2` -> `1.2.3`).

## 4) Build des artefacts release

Depuis `electron-app/` :

```bash
npm run dist
```

Le script `dist` lance `electron-builder --publish never`. La configuration `build.publish` du `package.json` force Electron Builder à générer les métadonnées d'auto-update, dont `latest.yml`, sans publier automatiquement sur GitHub.

Electron Builder génère dans `dist/` :

- l'installateur Windows (`*.exe`),
- les métadonnées (`latest.yml` + fichiers associés),
- les fichiers de blockmap (`*.blockmap` éventuels).

## 5) Upload WebDAV

Uploader tous les fichiers générés nécessaires dans le dossier WebDAV configuré par `updatePath`.

Exemple avec le profil ci-dessus :

```text
https://mon-serveur/webdav/releases/latest.yml
https://mon-serveur/webdav/releases/Bdd-caisse Setup 1.2.3.exe
https://mon-serveur/webdav/releases/Bdd-caisse Setup 1.2.3.exe.blockmap
```

## 6) Vérification côté app

Au démarrage, ou via le bouton **Rechercher une mise à jour** dans les paramètres, l'application :

1. lit `backend/.env`,
2. récupère `WEBDAV_ENDPOINTS`,
3. sélectionne le profil WebDAV actif,
4. pointe `electron-updater` vers `url + updatePath`,
5. télécharge automatiquement la mise à jour si la version distante est plus récente.

Sans `latest.yml` dans ce dossier, `electron-updater` ne peut pas déterminer la version/URL de mise à jour.
