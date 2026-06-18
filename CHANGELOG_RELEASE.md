Depuis la dernière version en production, l'application gagne en robustesse opérationnelle.

Principales améliorations :

- Pré-tickets tablette
  - Création, modification, envoi, conversion et annulation.
  - Récupération d'un pré-ticket pour le modifier.
  - Possibilité de masquer la ligne des pré-tickets.

- Synchronisation caisse principale / caisses secondaires
  - Meilleure fiabilité des échanges entre caisses.
  - Reprise plus robuste après échec ou coupure.
  - Corrections de plusieurs bugs liés aux caisses secondaires.
  - Suivi plus fiable des éléments déjà envoyés à la caisse principale.
  - Ajout d'une autorisation d'ouverture de caisse secondaire.

- Mises à jour applicatives
  - Publication des versions via WebDAV.
  - Vérification des mises à jour depuis les paramètres.
  - Affichage de l'état de téléchargement.
  - Confirmation avant lancement d'une mise à jour.
  - Affichage des notes de version après installation.

- Sauvegarde et restauration
  - Sauvegardes vérifiées avec manifeste.
  - Restauration du profil caisse.
  - Sauvegarde automatique avant migration sensible.
  - Scripts dédiés pour sauvegarder ou restaurer une caisse.

- Factures, PDF, WebDAV et email
  - Synchronisation des factures PDF vers WebDAV.
  - Amélioration de la configuration SMTP.
  - Meilleur rendu des tickets et factures, notamment avec le logo.
  - En-tête PDF plus cohérent.

- Paramétrage et exploitation
  - Affichage du numéro de version dans les paramètres.
  - Alerte lorsqu'un environnement de développement utilise une base MySQL distante.
  - Sélection automatique de la connexion MySQL au démarrage.
  - Heure de Paris appliquée de façon plus cohérente.

- Comptabilité, bilans et clôture
  - Ajout de contrôles de cohérence comptable.
  - Améliorations des bilans, fermetures et ouvertures de caisse.
  - Meilleure normalisation des paiements.
  - Corrections autour de la validation de vente et des corrections tickets.

- Utilisateurs et sécurité fonctionnelle
  - Normalisation des pseudos pour fiabiliser les comparaisons utilisateurs.
  - Retrait de la création de compte depuis l'application.
  - Tests renforcés autour des utilisateurs et de la synchronisation.

- Qualité et maintenance
  - Ajout de nombreux tests backend, frontend, intégration, E2E et endurance.
  - Tests dédiés à WebDAV, SMTP, PDF, sauvegarde, migrations et synchronisation secondaire.
  - Documentation d'exploitation enrichie.
