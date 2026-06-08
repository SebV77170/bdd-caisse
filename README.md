# BDD Caisse

Application de caisse composée d'un backend Node.js/Express, d'un frontend React
et d'une application Electron.

Ce document décrit principalement les contrôles à lancer pour vérifier
l'application avant une session de caisse ou avant la publication d'une
nouvelle version.

## Quelle commande utiliser ?

Toutes les commandes suivantes doivent être lancées depuis la racine du projet :

```powershell
cd "C:\Users\Seb Bis\Sites\bdd-caisse"
```

### Vérification rapide pendant le développement

```powershell
npm test
```

Cette commande lance en parallèle :

- les tests automatisés du backend ;
- les tests de composants et de parcours du frontend.

Elle ne lance pas Electron et ne contacte pas les services distants réels.

### Vérification complète avant une mise en production

```powershell
npm run test:production
```

Cette commande lance successivement :

1. tous les tests backend et frontend ;
2. le build React de production ;
3. le parcours E2E dans la véritable application Electron.

`npm run test:all` est actuellement un alias de cette même commande.

### Parcours Electron uniquement

```powershell
npm run test:e2e
```

Cette commande reconstruit le frontend puis exécute uniquement le scénario E2E
de production.

### Services distants réels

```powershell
npm run test:remote
```

Cette commande contacte réellement MySQL, SMTP et WebDAV. Elle nécessite une
connexion Internet et des identifiants valides.

Elle est volontairement séparée de `test:production`, car elle dépend de
services externes et envoie un véritable e-mail.

## Tests backend et frontend

Le lanceur commun se trouve dans `scripts/test-all.ps1`. Il utilise le runtime
Node embarqué dans `electron-app/vendor/node.exe`, afin d'utiliser le même
environnement sur les différents postes.

Au moment de la rédaction de ce guide, la suite contient :

- 73 tests backend ;
- 51 tests frontend.

Ces nombres augmenteront lorsque de nouveaux tests seront ajoutés. Le critère
important est que toutes les suites se terminent avec le code `0`.

Les tests backend couvrent notamment :

- les sessions et l'authentification ;
- l'ouverture et la fermeture de caisse ;
- la validation et la correction des ventes ;
- les paiements et les bilans ;
- la synchronisation des utilisateurs avec `pseudo_normalise` ;
- les échanges entre caisses principale et secondaire ;
- les documents PDF, SMTP et WebDAV dans des environnements contrôlés.

Les tests frontend couvrent notamment :

- l'ouverture et la fermeture de caisse ;
- la validation d'une vente ;
- les corrections ;
- les factures ;
- les composants et formulaires utilisés par ces parcours.

Des avertissements React `act(...)` peuvent encore apparaître dans la sortie.
Ils rendent le journal bruyant mais ne correspondent pas à un échec si le
résumé final indique que toutes les suites sont réussies.

## Parcours E2E Electron

Le scénario principal se trouve dans
`scripts/e2e/electron-production.e2e.js`.

Il utilise :

- le build React de production ;
- le vrai backend Express ;
- une base SQLite E2E isolée ;
- les routes et composants réels ;
- la véritable application Electron.

Il ne modifie pas la base SQLite utilisée quotidiennement par la caisse.

### Session simulée

Le test réalise une session complète comprenant :

- l'ouverture de la caisse avec un fond initial ;
- 100 ventes réalisées depuis l'interface ;
- quatre utilisateurs, avec plusieurs changements d'utilisateur ;
- 20 paiements en espèces ;
- 20 paiements par carte ;
- 20 paiements par chèque ;
- 20 paiements par virement ;
- 20 paiements mixtes utilisant au moins deux moyens de paiement ;
- cinq corrections de ventes sous plusieurs utilisateurs ;
- la création des tickets d'annulation et de correction ;
- la vérification de l'historique et du motif des corrections ;
- l'annulation d'une vente temporaire ;
- la vérification du nombre de ventes ;
- la vérification du bilan total ;
- la vérification du bilan par moyen de paiement ;
- la vérification de la liste des caissiers de la session ;
- la fermeture de caisse avec les montants attendus ;
- la création réelle du PDF de clôture ;
- la vérification que ce PDF existe et n'est pas vide ;
- le déclenchement de la synchronisation finale.

La synchronisation finale est dirigée vers un serveur local contrôlé pendant le
test. Le scénario vérifie ainsi que l'appel est bien effectué sans envoyer les
100 ventes E2E vers la base MySQL distante.

### Artefacts E2E

Après le test, les captures d'écran se trouvent dans :

```text
e2e-artifacts/
```

Le journal détaillé se trouve dans :

```text
.e2e-runtime/e2e.log
```

Le dossier `.e2e-runtime` contient également la base et le profil utilisateur
isolés du scénario.

Un test E2E réussi doit se terminer par :

```text
E2E production réussi : session caisse complète validée.
Parcours Electron de production validé.
```

## Audit des services distants

Le script `scripts/audit-remote-services.js` contrôle les véritables services
configurés dans `backend/.env` et `backend/.env.local`.

### Audit complet

```powershell
npm run test:remote
```

### SMTP uniquement

```powershell
.\electron-app\vendor\node.exe .\scripts\audit-remote-services.js --smtp-only
```

### WebDAV uniquement

```powershell
.\electron-app\vendor\node.exe .\scripts\audit-remote-services.js --webdav-only
```

Il n'existe pas actuellement d'option MySQL seule. L'audit complet doit être
utilisé pour contrôler MySQL.

### Contrôle MySQL

Le script utilise `MYSQL_PRESET_REMOTE` et se connecte au serveur Alwaysdata.

Il effectue :

1. une connexion réelle ;
2. une lecture de l'identité du serveur, de la base et de sa version ;
3. la création d'une table temporaire ;
4. une écriture et une relecture dans cette table ;
5. la suppression de la table temporaire.

La table est propre à la connexion et aucune donnée permanente ne doit rester
dans la base distante.

### Contrôle SMTP

Le script :

1. s'authentifie réellement auprès du serveur SMTP ;
2. envoie un véritable e-mail à l'adresse `SMTP_USER` ;
3. vérifie que le serveur accepte le destinataire et ne le rejette pas.

Le message porte un sujet ressemblant à :

```text
[BDD Caisse] Confirmation SMTP réelle 123456789-abcd1234
```

L'acceptation SMTP confirme que le serveur a pris en charge le message. Elle ne
garantit pas son classement dans la boîte de réception. En cas d'absence,
vérifier également les dossiers Spam, Tous les messages et Messages envoyés.

`SMTP_FROM` doit contenir une adresse e-mail complète et valide. Il est
actuellement configuré avec la même adresse que le compte authentifié.

### Contrôle WebDAV

Le script teste séparément les profils `dev` et `prod` déclarés dans
`WEBDAV_ENDPOINTS`.

Pour chaque profil, il effectue :

1. un `PROPFIND` pour vérifier la connexion et l'authentification ;
2. la création du dossier isolé `/codex-integration-tests` si nécessaire ;
3. l'envoi d'un fichier texte portant un identifiant unique ;
4. la relecture et la comparaison de son contenu ;
5. la suppression immédiate du fichier.

Le dossier de test peut rester présent, mais les fichiers créés par un audit
réussi sont supprimés.

Le profil WebDAV utilisé automatiquement par l'application est défini dans :

```text
%USERPROFILE%\.bdd-caisse\webdavSyncConfig.json
```

Le fait que les profils `dev` et `prod` réussissent l'audit ne signifie pas que
la synchronisation planifiée est activée. Vérifier la propriété `enabled` de ce
fichier ou la configuration correspondante dans l'interface d'administration.

### Synthèse finale

À la fin de l'audit distant, une synthèse est affichée :

```text
=== Synthèse des tests distants ===
[RÉUSSI] MySQL - connexion distante
[RÉUSSI] MySQL - écriture temporaire
[RÉUSSI] SMTP - authentification réelle
[RÉUSSI] SMTP - envoi réel
[RÉUSSI] WebDAV dev - connexion réelle

Tests réussis : 10
Tests échoués : 0
Total         : 10
Résultat global : RÉUSSI
```

Si un contrôle échoue, son message apparaît sous la ligne concernée et le
script renvoie un code de sortie non nul.

## Configuration et secrets

Les identifiants MySQL, SMTP et WebDAV sont chargés depuis :

```text
backend/.env
backend/.env.local
```

Ces fichiers sont ignorés par Git et ne doivent jamais être ajoutés au dépôt.
Le fichier `backend/.env.example` sert de modèle sans secret.

Après l'affichage accidentel d'un mot de passe dans un terminal, une capture
d'écran, un journal ou une conversation, il faut renouveler ce mot de passe.

Ne jamais joindre les fichiers `.env` à un rapport de bug.

## Corrections apportées pendant l'audit

Les travaux de robustesse ont notamment permis de :

- adapter les tests utilisateurs à `pseudo_normalise` ;
- renforcer les tests des routes et composants réels ;
- corriger la collision SQL entre les alias `annulation_de` et
  `correction_de` ;
- vérifier précisément les bilans totaux et par moyen de paiement ;
- enrichir le scénario E2E avec 100 ventes et plusieurs utilisateurs ;
- ajouter les corrections de ventes et les paiements mixtes au scénario ;
- vérifier la génération effective du PDF de clôture ;
- supprimer l'appel HTTP interne fragile utilisé par ce PDF ;
- rendre l'URL de synchronisation finale configurable ;
- éviter l'arrêt du backend avant la fin des opérations de clôture ;
- ajouter des tests réels et nettoyés pour MySQL, SMTP et WebDAV.

## Routine recommandée

Pendant le développement :

```powershell
npm test
```

Avant de préparer une nouvelle version :

```powershell
npm run test:production
```

Pour vérifier aussi l'infrastructure distante :

```powershell
npm run test:remote
```

Le dernier test envoie un e-mail réel. Il est donc préférable de ne pas le
lancer à chaque petite modification.

