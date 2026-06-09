# Feuille de route operationnelle

Cette feuille de route poursuit l'audit fonctionnel et operationnel de
l'application de caisse. Elle ne traite pas du chantier de securisation.

Objectif principal : pouvoir terminer une session de caisse meme en cas de
coupure Internet, panne d'un service distant, redemarrage de l'application ou
incident sur une operation en cours.

## Etat de depart

Les controles suivants sont deja en place :

- tests automatises du backend et du frontend ;
- utilisation des routes et composants reels dans les tests d'integration ;
- parcours E2E dans l'application Electron de production ;
- ouverture et fermeture complete d'une session de caisse ;
- 100 ventes avec plusieurs changements d'utilisateur ;
- paiements en especes, carte, cheque, virement et paiements mixtes ;
- plusieurs corrections de ventes ;
- verification du bilan total et des bilans par moyen de paiement ;
- generation et verification du PDF de cloture ;
- tests controles des integrations MySQL, SMTP et WebDAV ;
- script unique de test de production.

Commandes actuelles :

```powershell
npm test
npm run test:e2e
npm run test:production
npm run test:remote
```

## Priorite 1 - Garantir la continuite d'une vente

Ces scenarios sont prioritaires, car leur echec peut bloquer la caisse ou
produire un bilan incorrect.

### 1.1 Validation unique d'une vente

- [x] Tester un double clic rapide sur le bouton de validation.
- [x] Tester deux requetes de validation identiques envoyees simultanement.
- [x] Verifier qu'un seul ticket, un seul paiement et un seul mouvement de
      bilan sont crees.
- [x] Desactiver visuellement la validation pendant son traitement.
- [x] Afficher un resultat clair si la vente a deja ete enregistree.

Critere de sortie : une action utilisateur ne peut jamais creer deux ventes.

### 1.2 Redemarrage pendant une vente

- [ ] Fermer Electron avec une vente temporaire en cours.
- [x] Relancer l'application et verifier si le panier est restaure ou abandonne
      selon la regle metier choisie.
- [ ] Redemarrer juste avant la validation.
- [x] Redemarrer juste apres l'enregistrement SQLite mais avant la reponse UI.
- [x] Verifier qu'aucune vente partielle ne reste dans la base.

Critere de sortie : apres redemarrage, la situation de la vente est explicite
et les donnees restent coherentes.

### 1.3 Corrections interrompues

- [ ] Interrompre une correction avant sa validation.
- [ ] Interrompre une correction pendant l'ecriture en base.
- [ ] Rejouer la correction apres redemarrage.
- [ ] Verifier l'unicite des tickets d'annulation et de correction.
- [ ] Verifier que le bilan final reste exact.

Critere de sortie : une correction est appliquee entierement ou pas du tout.

## Priorite 2 - Fonctionnement sans services distants

La vente locale doit rester possible lorsque Internet ou un service distant est
indisponible.

### 2.1 MySQL indisponible

- [x] Demarrer l'application sans utiliser de connexion MySQL.
- [x] Ouvrir une caisse, effectuer des ventes et la fermer.
- [x] Verifier que les erreurs distantes ne bloquent pas l'interface.
- [x] Retablir MySQL puis lancer la synchronisation.
- [x] Verifier que les lignes en echec redeviennent disponibles pour le rejeu.
- [ ] Verifier sur un lot complet que toutes les donnees locales sont transmises
      une seule fois (traite en priorite 3).

### 2.2 WebDAV indisponible

- [x] Simuler une erreur reseau equivalente a un DNS invalide.
- [x] Simuler un delai d'attente.
- [x] Simuler une erreur d'authentification.
- [x] Simuler une coupure pendant l'envoi d'un fichier.
- [x] Verifier la reprise manuelle.
- [x] Verifier qu'un echec WebDAV reste independant des operations de caisse.

### 2.3 SMTP indisponible

- [x] Simuler un refus SMTP.
- [x] Verifier que le ticket et la facture restent disponibles localement.
- [x] Afficher que la facture est creee localement sans annoncer un mail envoye.
- [x] Permettre une nouvelle tentative d'envoi sans regenerer une vente.
- [ ] Distinguer dans les tests distants le refus d'authentification, le
      destinataire refuse et le delai d'attente.

Critere de sortie global : une panne distante est visible et journalisee, mais
ne bloque jamais les operations locales indispensables.

## Priorite 3 - Fiabiliser la synchronisation

### 3.1 Rejeu et doublons

- [x] Envoyer deux fois le meme lot de synchronisation.
- [x] Reprendre un lot apres une coupure reseau.
- [x] Verifier l'absence de doublons dans les tickets, objets, paiements et
      bilans.
- [x] Verifier que les elements deja synchronises ne sont pas reappliques.

Chaque operation de `sync_log` possede maintenant un UUID. MySQL et la caisse
principale enregistrent cet UUID dans un registre transactionnel avant de
valider l'operation. Un rejeu apres perte de reponse est donc reconnu sans
recompter les donnees.

### 3.2 Plusieurs caisses

- [x] Traiter deux demandes de caisses secondaires en parallele.
- [x] Synchroniser les caisses dans des ordres differents.
- [x] Synchroniser deux ventes ayant des horaires proches.
- [x] Tester deux corrections portant sur des ventes distinctes.
- [x] Verifier les totaux consolides sur la caisse principale.

### 3.3 Conflits et donnees invalides

- [x] Recevoir un lot incomplet.
- [x] Recevoir une operation inconnue.
- [x] Recevoir une reference vers un ticket absent.
- [x] Verifier qu'un lot invalide est refuse sans application partielle.
- [x] Produire un rapport lisible des elements acceptes et refuses.

Critere de sortie : la synchronisation est idempotente, reprenable et
verifiable.

## Priorite 4 - Installation, mise a jour et migration

### 4.1 Installation neuve

- [ ] Installer l'application sur un profil Windows vierge.
- [x] Verifier automatiquement la creation atomique de la base SQLite et des
      dossiers `tickets` et `factures` sur un profil isole vide.
- [x] Verifier le premier lancement sans ancienne configuration.
- [ ] Effectuer une ouverture, une vente et une fermeture.
- [ ] Desinstaller puis verifier quelles donnees utilisateur sont conservees.

Le test automatise utilise un profil temporaire complet et le vrai template
distribue. Une installation et une desinstallation NSIS restent a valider sur
un poste Windows de recette, car elles ne doivent pas etre executees sur le
poste de caisse en service.

### 4.2 Mise a jour d'une version existante

- [x] Partir des vraies bases templates disponibles dans les tags `v1.0`,
      `v1.1.0`, `v1.2.0`, `version-stable-03092025` et
      `version-en-prod-au-11092025`.
- [x] Simuler le premier lancement de la nouvelle version sur chacune de ces
      anciennes bases.
- [x] Verifier les migrations de schema.
- [x] Verifier la conservation des ventes, utilisateurs et configurations.
- [x] Verifier qu'un second lancement ne rejoue pas les migrations.

Les migrations sont maintenant additives et transactionnelles. Une colonne
historique inconnue est conservee. Une nouvelle colonne obligatoire sans
valeur par defaut provoque un refus explicite et un rollback complet au lieu
d'une migration partielle.

### 4.3 Echec de mise a jour

- [ ] Interrompre le telechargement d'une mise a jour.
- [ ] Interrompre l'installation si l'outil le permet sans risque.
- [ ] Verifier que l'ancienne version reste demarrable.
- [x] Verifier que la recherche de mise a jour s'execute en arriere-plan et ne
      bloque pas le demarrage de la caisse.
- [x] Tester qu'une erreur de telechargement est absorbee sans exception non
      geree.
- [x] Documenter le retour manuel a la version precedente dans
      `UPDATE_RECOVERY.md`.

Commande automatisee :

```powershell
npm run test:installation
```

Critere de sortie : une mise a jour ne peut pas rendre la caisse inutilisable
ni detruire sa base locale.

## Priorite 5 - Sauvegarde et restauration

- [x] Definir les fichiers exacts a sauvegarder.
- [x] Automatiser une sauvegarde avant toute migration.
- [x] Tester la restauration sur un profil Windows distinct.
- [x] Verifier les ventes, paiements, corrections, sessions et configurations.
- [x] Tester une base absente.
- [x] Tester une base illisible ou tronquee.
- [x] Afficher une erreur actionnable sans remplacer silencieusement une base
      endommagee.
- [x] Rediger une procedure de restauration utilisable sans outil de
      developpement.

Les sauvegardes contiennent la base SQLite, les configurations JSON, les
tickets et les factures. Chaque fichier est controle par SHA-256 et la base par
`PRAGMA quick_check`. La sauvegarde pre-migration est creee avec un instantane
SQLite coherent, y compris si un journal WAL est actif.

Commandes depuis le projet :

```powershell
npm run backup
npm run restore -- -Sauvegarde "C:\chemin\vers\la-sauvegarde"
```

Les scripts sont aussi embarques dans le dossier `resources\tools` de
l'installation Windows. La procedure detaillee se trouve dans
`BACKUP_RESTORE.md`.

Critere de sortie : une sauvegarde testee permet de remettre la caisse en
service sur un autre poste.

## Priorite 6 - Exactitude comptable renforcee

- [x] Tester une session sans vente.
- [x] Tester une seule vente par moyen de paiement.
- [x] Tester des montants avec arrondis et petites valeurs.
- [x] Tester des reductions seules et combinees.
- [x] Tester une correction totale et une correction partielle.
- [x] Tester plusieurs corrections successives durant une session.
- [x] Tester une vente a minuit et un changement de jour.
- [x] Tester un changement d'heure ete/hiver.
- [x] Comparer automatiquement :
  - total des tickets ;
  - total des objets vendus ;
  - total des paiements simples et mixtes ;
  - bilan de session ;
  - bilan journalier ;
  - montant du PDF de cloture.

La suite `accountingConsistency.test.js` passe par les vraies routes de vente,
correction, bilan et fermeture. Elle compare toutes les sources au centime
pres apres chaque scenario. Les routes refusent maintenant une vente ou une
correction lorsque la somme des paiements ne correspond pas au montant a
encaisser.

La date du bilan journalier est calculee dans le fuseau `Europe/Paris`, y
compris autour de minuit et des changements d'heure. Les tickets de cloture ne
sont plus comptes comme des ventes dans le bilan de session.

Commande ciblee :

```powershell
npm run test:accounting
```

Critere de sortie : toutes les sources donnent le meme total au centime pres.

## Priorite 7 - Performance et endurance

- [ ] Tester 500 puis 1 000 ventes dans une meme session.
- [ ] Tester une base contenant plusieurs annees de ventes.
- [ ] Mesurer le temps d'ouverture de l'application.
- [ ] Mesurer le temps de validation d'une vente.
- [ ] Mesurer le temps d'affichage des bilans.
- [ ] Mesurer le temps de fermeture et de generation PDF.
- [ ] Laisser l'application ouverte plusieurs heures avec le planificateur
      actif.
- [ ] Surveiller la memoire, le processeur et la taille des journaux.

Seuils initiaux proposes :

- validation locale d'une vente en moins de 2 secondes ;
- affichage d'un bilan courant en moins de 3 secondes ;
- interface utilisable pendant les synchronisations ;
- aucune croissance continue de memoire au repos.

## Priorite 8 - Erreurs utilisateur et ergonomie de secours

- [ ] Tester les champs vides, montants invalides et valeurs extremes.
- [ ] Tester la fermeture de fenetres modales avec une saisie en cours.
- [ ] Tester les doubles clics sur toutes les actions irreversibles.
- [ ] Verifier les messages en cas d'echec de vente, correction, mail ou sync.
- [ ] Verifier qu'un message indique toujours :
  - ce qui a echoue ;
  - si les donnees ont ete enregistrees ;
  - l'action permettant de continuer.
- [ ] Tester le parcours uniquement au tactile.
- [ ] Tester la resolution et le facteur d'echelle des postes de caisse.

Critere de sortie : une erreur ne laisse jamais l'utilisateur sans savoir si la
vente a ete encaissee.

## Priorite 9 - Diagnostic et support

- [ ] Centraliser les journaux Electron, backend et synchronisation.
- [ ] Ajouter l'heure, la version, le poste et l'identifiant d'operation.
- [ ] Eviter les donnees clients inutiles dans les journaux.
- [ ] Ajouter un bouton d'export d'un diagnostic.
- [ ] Afficher l'etat de SQLite, MySQL, SMTP et WebDAV.
- [ ] Afficher la date de la derniere synchronisation reussie.
- [ ] Detecter et signaler les elements locaux encore non synchronises.
- [ ] Rediger une fiche de depannage utilisable pendant une session.

Critere de sortie : un incident peut etre compris sans acceder aux outils de
developpement.

## Priorite 10 - Automatisation de la validation

Etendre progressivement `npm run test:production` avec des scenarios locaux et
deterministes :

- [ ] anti-double validation ;
- [ ] redemarrage et reprise apres incident ;
- [ ] fonctionnement hors ligne ;
- [ ] synchronisation rejouee ;
- [ ] migration depuis une ancienne base ;
- [x] sauvegarde et restauration ;
- [x] coherence comptable complete ;
- [ ] test d'endurance raisonnable.

Conserver `npm run test:remote` separe, car il depend des vrais services
externes.

## Ordre de realisation recommande

1. Anti-doublon et reprise d'une vente interrompue.
2. Fonctionnement hors ligne avec MySQL, SMTP et WebDAV indisponibles.
3. Rejeu, reprise et coherence des synchronisations.
4. Installation neuve et mise a jour depuis une version precedente.
5. Sauvegarde et restauration testees.
6. Cas comptables limites et changement de jour.
7. Performance et session longue.
8. Diagnostic et documentation de secours.
9. Integration des nouveaux controles dans les scripts globaux.

## Validation avant une session reelle

Avant chaque session importante :

```powershell
npm run test:production
```

Puis verifier manuellement :

- ouverture de l'application ;
- connexion d'un utilisateur ;
- ouverture de caisse ;
- vente de test ou environnement de recette ;
- presence de papier ou solution de remise du ticket ;
- espace disque disponible ;
- date de la derniere synchronisation ;
- emplacement de la sauvegarde la plus recente.

## Definition de termine

L'audit operationnel pourra etre considere comme termine lorsque :

- tous les points des priorites 1 a 6 sont automatises ou verifies par une
  procedure reproductible ;
- une panne Internet ne bloque pas une session ;
- un redemarrage ne cree ni perte silencieuse ni doublon ;
- une sauvegarde peut etre restauree sur un autre poste ;
- les bilans sont coherents au centime pres dans tous les scenarios ;
- `npm run test:production` reussit sur le package destine a etre distribue ;
- une procedure papier de secours existe uniquement comme dernier recours, et
  non comme reponse normale a une panne logicielle.
