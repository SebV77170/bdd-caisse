# Factures : stockage et envoi email

- Les PDF de factures sont générés dans le dossier utilisateur :
  `~/.bdd-caisse/factures/<YYYY>/<MM>/<DD>`.
- Le backend expose ce dossier via la route statique `/factures`.
- L'envoi d'une facture se fait via SMTP Gmail (`smtp.gmail.com`, port `465`, `secure: true`) avec l'expéditeur `magasin@ressourcebrie.fr`.
- La synchro WebDAV envoie aussi les factures avec la même arborescence de dates que les tickets, dans le dossier distant `/factures`.
