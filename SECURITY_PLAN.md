# Strategie de securisation

Ce document transforme l'audit de securite en plan d'action. L'objectif est de
reduire rapidement les risques de perte ou de divulgation de donnees, sans
fragiliser le fonctionnement hors ligne pendant une session de caisse.

## Principes

- La caisse doit continuer a vendre sans acces Internet.
- Une route sensible doit refuser l'acces par defaut.
- CORS n'est jamais considere comme un controle d'acces.
- Les operations destructrices demandent une session et une confirmation
  administrateur recente.
- Les echanges entre caisses sont authentifies et rejouables uniquement une
  fois.
- Une mise a jour de securite ne part en production qu'apres les tests backend,
  frontend et Electron.

## Phase 0 - Mesures immediates

Priorite : critique. A faire avant toute nouvelle publication.

1. Renouveler les mots de passe MySQL actuellement presents dans l'historique.
2. Verifier et renouveler les secrets SMTP et WebDAV s'ils ont ete exposes.
3. Generer un `SESSION_SECRET` aleatoire d'au moins 32 octets.
4. Retirer les secrets et les donnees personnelles des fichiers suivis par Git.
5. Purger ces fichiers de l'historique Git, puis invalider les anciens secrets.
6. Conserver uniquement des exemples fictifs dans le depot.
7. Limiter temporairement le backend a `127.0.0.1` tant que les routes ne sont
   pas protegees.

Condition de sortie :

- aucun secret reel detecte dans l'etat courant ou l'historique du depot ;
- les anciens identifiants ne permettent plus de se connecter ;
- le backend n'est pas accessible depuis une autre machine par defaut.

## Phase 1 - Fermer les routes sensibles

Priorite : critique.

Creer trois middlewares communs :

- `requireSession` : exige un utilisateur connecte ;
- `requireAdmin` : exige un compte administrateur actif ;
- `requireRecentAdminProof` : exige une nouvelle saisie du mot de passe
  administrateur, valable quelques minutes et liee a la session.

Politique initiale :

| Groupe de routes | Protection minimale |
| --- | --- |
| Connexion et etat de session | publique |
| Catalogue necessaire a l'ecran de vente | session |
| Creation et validation d'une vente | session |
| Bilans, journaux et sessions fermees | session |
| Corrections et annulations | session + preuve administrateur |
| Configuration MySQL, SMTP, WebDAV et synchronisation | administrateur |
| Application de schema et synchronisation utilisateurs | administrateur |
| Reinitialisation complete | preuve administrateur + confirmation explicite |
| Envoi de ticket et creation de facture | session |

La route `/api/reset` doit en plus :

- etre desactivee en production par defaut ;
- demander une valeur de confirmation non triviale ;
- journaliser l'utilisateur, la date et le poste ;
- ne jamais effacer MySQL implicitement avec la base locale.

Condition de sortie :

- toutes les routes ont une politique declaree ;
- les routes privees renvoient `401` sans session et `403` sans droit ;
- aucun endpoint destructeur n'est accessible anonymement.

## Phase 2 - Renforcer l'authentification

1. Regenerer l'identifiant de session apres une connexion reussie.
2. Retourner le meme message pour un pseudo inconnu ou un mot de passe faux.
3. Ajouter une limitation des tentatives par adresse et par pseudo normalise.
4. Utiliser la comparaison bcrypt asynchrone.
5. Refuser le demarrage en production si `SESSION_SECRET` est absent.
6. Definir un nom de cookie explicite et supprimer le cookie a la deconnexion.
7. Fixer une duree d'inactivite et renouveler proprement les sessions actives.
8. Charger le role depuis la base lors des controles sensibles, afin qu'une
   suppression de droit soit prise en compte immediatement.

Le cookie reste `httpOnly` et `SameSite=Strict`. `Secure` devient obligatoire
si le backend est un jour expose via HTTPS. Sur l'application locale HTTP, le
backend doit rester lie a l'interface locale.

Condition de sortie :

- aucun test ne peut reutiliser l'identifiant de session d'avant connexion ;
- le blocage temporaire des tentatives abusives est teste ;
- le serveur de production refuse un secret de session faible ou absent.

## Phase 3 - CSRF et CORS

1. Ajouter une protection CSRF aux routes utilisant la session.
2. Transmettre le jeton CSRF au frontend puis le joindre aux requetes
   `POST`, `PUT`, `PATCH` et `DELETE`.
3. Verifier `Origin` sur toutes les requetes avec effet de bord.
4. Configurer une liste d'origines issue de l'environnement :
   - application de production servie par le backend ;
   - serveur React local en developpement ;
   - aucune autre origine par defaut.
5. Faire echouer explicitement les origines inconnues au lieu de seulement
   omettre les en-tetes CORS.
6. Appliquer la meme politique a Socket.IO.

Condition de sortie :

- une requete avec origine inconnue ne modifie jamais la base ;
- une requete sans jeton CSRF valide renvoie `403` ;
- les parcours React et Electron fonctionnent encore avec les protections.

## Phase 4 - Authentifier les synchronisations

Les communications entre caisse principale et caisse secondaire ne doivent pas
dependre d'une session navigateur.

Mettre en place :

- un secret distinct par caisse, stocke hors du depot ;
- une signature HMAC du corps, de l'horodatage et d'un identifiant unique ;
- une fenetre temporelle courte ;
- un registre des identifiants deja traites contre les rejeux ;
- une taille maximale et une validation stricte du schema des journaux ;
- une liste blanche des tables, operations et champs acceptes ;
- une journalisation des refus et validations.

Les configurations MySQL, SMTP et WebDAV ne doivent jamais transiter dans ces
echanges.

Condition de sortie :

- une signature absente, fausse, expiree ou rejouee est refusee ;
- une caisse inconnue ne peut ni deposer ni valider des journaux ;
- un lot invalide est rejete atomiquement, sans modification partielle.

## Phase 5 - Donnees et secrets

1. Remplacer `inserts_users.sql` par des utilisateurs fictifs sans donnees
   personnelles.
2. Ne jamais renvoyer les hashes dans `/api/users/compare`.
3. Restreindre la comparaison aux champs utiles et a un administrateur.
4. Masquer les informations de connexion dans les erreurs et journaux.
5. Ajouter un scan de secrets local et dans l'integration continue.
6. Documenter la procedure de rotation et de revocation.

Condition de sortie :

- aucune API ne renvoie de hash de mot de passe ;
- les journaux et rapports de test ne contiennent aucun secret ;
- le scan de secrets bloque une publication en cas de detection.

## Phase 6 - Dependances

Traiter d'abord les composants executes en production :

1. mettre a jour `axios`, `express`, `nodemailer`, `uuid` et Socket.IO ;
2. migrer Electron 27 vers une version maintenue, par etapes si necessaire ;
3. mettre a jour `react-router-dom` ;
4. supprimer le paquet `currency`, qui n'est pas utilise ;
5. planifier le remplacement de `react-scripts` par une chaine maintenue ;
6. mettre a jour les outils de build sans utiliser aveuglement
   `npm audit fix --force`.

Chaque mise a jour est faite par petit lot avec tests complets.

Condition de sortie :

- aucune vulnerabilite critique connue dans les dependances executees ;
- les vulnerabilites restantes sont documentees avec leur contexte et leur
  date de reevaluation ;
- le build et le parcours Electron de production restent valides.

## Tests de securite a ajouter

- matrice de tests `401`, `403` et succes pour chaque groupe de routes ;
- session regeneree apres connexion et invalidee apres deconnexion ;
- limitation des tentatives de connexion ;
- refus CSRF sans jeton, avec jeton faux et avec origine inconnue ;
- refus CORS HTTP et Socket.IO ;
- refus des signatures de synchronisation invalides ou rejouees ;
- absence de `password`, secret ou donnee personnelle dans les reponses ;
- impossibilite d'appeler `/api/reset` en production normale ;
- verification que les protections fonctionnent dans l'E2E Electron ;
- scan des dependances et des secrets avant publication.

Les tests destructeurs utilisent exclusivement SQLite en memoire et des
services distants controles. Ils ne doivent jamais viser la production.

## Ordre de livraison recommande

1. Rotation des secrets et retrait des donnees sensibles.
2. Protection de `/api/reset`, des schemas, des configurations et des syncs.
3. Middleware d'authentification et matrice d'autorisations complete.
4. Durcissement des sessions et de la connexion.
5. CSRF, verification d'origine et CORS strict.
6. Signature des communications entre caisses.
7. Mise a jour progressive des dependances.
8. Nouvelle passe d'audit et test de production complet.

Chaque etape doit rester deployable et reversible. Avant une migration
importante, conserver une sauvegarde testee de SQLite et verifier le plan de
retour a la version precedente.
