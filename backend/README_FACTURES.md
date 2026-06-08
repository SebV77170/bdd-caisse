# Factures : stockage et envoi email

- Les PDF de factures sont générés dans le dossier utilisateur :
  `~/.bdd-caisse/factures/<YYYY>/<MM>/<DD>`.
- Le backend expose ce dossier via la route statique `/factures`.
- L'envoi d'une facture se fait via SMTP Gmail. Les identifiants sont lus depuis
  `backend/.env.local`, qui n'est pas suivi par Git. Copier les clés SMTP de
  `backend/.env.example` et renseigner au minimum `SMTP_USER` et `SMTP_PASS`.
- La synchro WebDAV envoie aussi les factures avec la même arborescence de dates que les tickets, dans le dossier distant `/factures`.
