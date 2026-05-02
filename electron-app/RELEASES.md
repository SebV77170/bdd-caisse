# Publier une release GitHub compatible auto-update (Electron)

Ce projet utilise `electron-updater` : l'application installée compare sa version locale avec la dernière release GitHub.

Pour que ça fonctionne, il faut publier **les artefacts Electron Builder** (pas seulement un tag Git).

## 1) Pré-requis GitHub

1. Créer un repository GitHub (public ou privé).
2. Créer un token GitHub avec droit `repo` (si privé) ou `public_repo` (si public).
3. Exporter le token dans le shell :

```bash
export GH_TOKEN=ghp_xxx
```

> Sous Windows PowerShell :
>
> ```powershell
> $env:GH_TOKEN="ghp_xxx"
> ```

## 2) Lier l'app à ton repo GitHub

L'auto-update lit ces variables au runtime (dans `electron-app/main.js`) :

- `BDD_CAISSE_GITHUB_OWNER`
- `BDD_CAISSE_GITHUB_REPO`

Exemple :

```bash
export BDD_CAISSE_GITHUB_OWNER=mon-org
export BDD_CAISSE_GITHUB_REPO=bdd-caisse
```

## 3) Incrémenter la version

Mettre à jour la version dans `electron-app/package.json` (ex: `1.2.2` -> `1.2.3`).

## 4) Build + publication des artefacts release

Depuis `electron-app/` :

```bash
npm run dist -- --publish always
```

Electron Builder va :

- construire l'installeur (`.exe`),
- générer les métadonnées (`latest.yml` + fichiers associés),
- créer/mettre à jour la release GitHub,
- uploader artefacts + métadonnées sur la release.

## 5) Vérifier la release GitHub

Dans la release, vérifier la présence de :

- l'installeur Windows (`*.exe`),
- `latest.yml`,
- blocs (`*.blockmap` éventuels).

Sans `latest.yml`, `electron-updater` ne peut pas déterminer la version/URL de mise à jour.

## 6) Vérification côté app

Lancer l'application packagée avec :

- `BDD_CAISSE_GITHUB_OWNER`
- `BDD_CAISSE_GITHUB_REPO`

Au démarrage, elle doit logguer la vérification de MAJ et télécharger automatiquement si la version GitHub est plus récente.

---

## CI (optionnel mais recommandé)

Tu peux automatiser le publish via GitHub Actions (`on: push tags`) avec `GH_TOKEN` en secret, pour éviter les publications manuelles.
