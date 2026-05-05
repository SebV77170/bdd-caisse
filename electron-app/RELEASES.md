# Publier une release WebDAV compatible auto-update (Electron)

Ce projet utilise `electron-updater` : l'application installée compare sa version locale avec les métadonnées publiées sur ton serveur WebDAV.

Pour que ça fonctionne, il faut publier **les artefacts Electron Builder** (pas seulement un tag Git).

## 1) Pré-requis serveur WebDAV

1. Disposer d'un dossier distant WebDAV dédié aux releases (ex: `https://mon-serveur/webdav/bdd-caisse/releases/`).
2. Avoir les accès en écriture (upload des artefacts).

## 2) Lier l'app à ton endpoint WebDAV

L'auto-update lit cette variable au runtime (dans `electron-app/main.js`) :

- `BDD_CAISSE_UPDATE_URL`

Exemple :

```bash
export BDD_CAISSE_UPDATE_URL=https://mon-serveur/webdav/bdd-caisse/releases/
```

## 3) Incrémenter la version

Mettre à jour la version dans `electron-app/package.json` (ex: `1.2.2` -> `1.2.3`).

## 4) Build + publication des artefacts release

Depuis `electron-app/` (sans publication GitHub) :

```bash
npm run dist -- --publish never
```

Electron Builder va générer dans `dist/` :

- l'installeur (`.exe`),
- les métadonnées (`latest.yml` + fichiers associés),
- les fichiers de blockmap (`*.blockmap` éventuels).

Ensuite, uploader ces fichiers dans ton dossier WebDAV de release.

## 5) Vérifier le dossier de release WebDAV

Vérifier la présence de :

- l'installeur Windows (`*.exe`),
- `latest.yml`,
- blocs (`*.blockmap` éventuels).

Sans `latest.yml`, `electron-updater` ne peut pas déterminer la version/URL de mise à jour.

## 6) Vérification côté app

Lancer l'application packagée avec `BDD_CAISSE_UPDATE_URL` pointant vers le dossier WebDAV qui contient `latest.yml`.

Au démarrage, elle doit logguer la vérification de MAJ et télécharger automatiquement si la version distante est plus récente.

---

## CI (optionnel mais recommandé)

Tu peux automatiser le build puis l'upload WebDAV via CI/CD (GitHub Actions, GitLab CI, etc.) pour éviter les publications manuelles.
