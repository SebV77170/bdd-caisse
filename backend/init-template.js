const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Chemin de sortie du fichier template
const outputPath = path.join(__dirname, 'ressourcebrie-sqlite-template.db');

// Supprime l'existant si présent
if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

const db = new Database(outputPath);
console.log('🆕 Création du template de base :', outputPath);

// Exécution des instructions CREATE TABLE extraites
db.exec(`

CREATE TABLE boutons_ventes (
	id_bouton int NOT NULL,
	sous_categorie varchar(34),
	nom varchar(66),
	id_cat varchar(6),
	id_souscat int,
	prix varchar(4)
);

CREATE TABLE categories (
	id int NOT NULL,
	parent_id varchar(255),
	category varchar(255),
	color varchar(255)
);

CREATE TABLE compte_transac (
	date_transac TIMESTAMP(10) NOT NULL,
	compte int NOT NULL
);

CREATE TABLE facture (
	uuid_facture int NOT NULL,
	uuid_ticket int NOT NULL,
	lien TEXT(32767)
);

CREATE TABLE modifticketdecaisse (
	id_modif int NOT NULL,
	id_ticket int NOT NULL,
	nom_vendeur varchar(255),
	id_vendeur int NOT NULL,
	date_achat_dt TIMESTAMP(26),
	nbr_objet int NOT NULL,
	moyen_paiement TEXT(32767),
	num_cheque TEXT(32767),
	banque varchar(255),
	num_transac varchar(255),
	prix_total int NOT NULL,
	lien TEXT(32767),
	reducbene tinyint,
	reducclient tinyint,
	reducgrospanierclient tinyint,
	reducgrospanierbene tinyint
);

CREATE TABLE paiement_mixte_modif (
	id_paiement_mixte_modif int NOT NULL,
	id_paiement_mixte int NOT NULL,
	id_ticket int NOT NULL,
	espece int NOT NULL,
	carte int NOT NULL,
	cheque int NOT NULL,
	virement int
);

CREATE TABLE users (
	id int NOT NULL,
	prenom varchar(255),
	nom varchar(255),
	pseudo varchar(255),
	password TEXT(32767),
	admin tinyint NOT NULL,
	mail varchar(255),
	tel varchar(255)
);

CREATE TABLE vente (
  id_temp_vente INTEGER PRIMARY KEY AUTOINCREMENT,
  dateheure TEXT,
  id_vendeur INTEGER,
  modif TINYINT,
  id_modif INTEGER
);

CREATE TABLE ticketdecaissetemp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_temp_vente INTEGER NOT NULL,
  nom TEXT NOT NULL,
  categorie TEXT,       -- peut être NULL
  souscat TEXT,         -- peut être NULL
  prix REAL NOT NULL,
  nbr INTEGER NOT NULL,
  prixt REAL NOT NULL
);

CREATE TABLE ticketdecaisse (
  id_ticket INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_vendeur VARCHAR,
  id_vendeur INTEGER NOT NULL,
  date_achat_dt TIMESTAMP,
  nbr_objet INTEGER NOT NULL,
  moyen_paiement TEXT,
  num_cheque TEXT,
  banque VARCHAR,
  num_transac VARCHAR,
  prix_total INTEGER NOT NULL,
  lien TEXT,
  reducbene TINYINT,
  reducclient TINYINT,
  reducgrospanierclient TINYINT,
  reducgrospanierbene TINYINT
, annulation_de INTEGER, flag_annulation BOOLEAN DEFAULT 0, corrige_le_ticket INTEGER, uuid_ticket TEXT, cloture INTEGER, uuid_session_caisse INTEGER, flag_correction INTEGER DEFAULT 0);

CREATE TABLE objets_vendus (
  id_achat INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid_ticket INTEGER NOT NULL,
  nom_vendeur VARCHAR,
  id_vendeur INTEGER NOT NULL,
  nom VARCHAR,
  categorie VARCHAR,
  souscat VARCHAR,
  date_achat TEXT,
  timestamp INTEGER NOT NULL,
  prix INTEGER,
  nbr INTEGER NOT NULL
, uuid_objet TEXT);

CREATE TABLE bilan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date VARCHAR NOT NULL,
  timestamp INTEGER NOT NULL,
  nombre_vente INTEGER NOT NULL,
  poids INTEGER NOT NULL,
  prix_total INTEGER NOT NULL,
  prix_total_espece INTEGER NOT NULL,
  prix_total_cheque INTEGER NOT NULL,
  prix_total_carte INTEGER NOT NULL,
  prix_total_virement INTEGER
);

CREATE TABLE paiement_mixte (
  id_paiement_mixte INTEGER PRIMARY KEY AUTOINCREMENT,
  id_ticket INTEGER NOT NULL,
  espece INTEGER NOT NULL DEFAULT 0,
  carte INTEGER NOT NULL DEFAULT 0,
  cheque INTEGER NOT NULL DEFAULT 0,
  virement INTEGER NOT NULL DEFAULT 0
, uuid_ticket TEXT);

CREATE TABLE journal_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_correction TEXT,
    uuid_ticket_original INTEGER,
    uuid_ticket_annulation INTEGER,
    uuid_ticket_correction INTEGER,
    utilisateur TEXT,
    motif TEXT
);

CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- "ticketdecaisse", "users", etc.
  operation TEXT NOT NULL,      -- "INSERT", "UPDATE", "DELETE"
  payload TEXT NOT NULL,        -- Données JSON sérialisées
  synced INTEGER DEFAULT 0,     -- 0 = non synchronisé, 1 = synchronisé
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE code_postal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE session_caisse (
  id_session TEXT PRIMARY KEY,
  date_ouverture TEXT NOT NULL,
  heure_ouverture TEXT NOT NULL,
  utilisateur_ouverture TEXT,           -- Celui qui a cliqué pour ouvrir
  responsable_ouverture TEXT,           -- Celui qui a signé l’ouverture
  fond_initial INTEGER NOT NULL,
  date_fermeture TEXT,
  heure_fermeture TEXT,
  utilisateur_fermeture TEXT,           -- Celui qui a cliqué pour fermer
  responsable_fermeture TEXT,           -- Celui qui a signé la fermeture
  montant_reel INTEGER,
  commentaire TEXT,
  ecart INTEGER,
  caissiers TEXT                        -- Chaine JSON, ex: '["alice", "bob", "julie"]'
, montant_reel_carte INTEGER, montant_reel_cheque INTEGER, montant_reel_virement INTEGER);

CREATE TABLE uuid_mapping (
  uuid TEXT PRIMARY KEY,         -- L'UUID unique (ex: 94dfb9fc-6c8d-4c9b-b4e0-0d0a68533a71)
  id_friendly TEXT UNIQUE,       -- L'identifiant lisible (ex: T00001, O00001, etc.)
  type TEXT                      -- Optionnel : type d'élément (ex: 'ticket', 'objet', 'correction')
);

`);

db.close();
console.log('✅ Template généré avec succès !');
