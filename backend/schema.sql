CREATE TABLE IF NOT EXISTS boutons_ventes (
	id_bouton int NOT NULL,
	sous_categorie varchar(34),
	nom varchar(66),
	id_cat varchar(6),
	id_souscat int,
	prix varchar(4)
);

CREATE TABLE IF NOT EXISTS categories (
	id int NOT NULL,
	parent_id varchar(255),
	category varchar(255),
	color varchar(255)
);

CREATE TABLE IF NOT EXISTS compte_transac (
	date_transac TIMESTAMP(10) NOT NULL,
	compte int NOT NULL
);

CREATE TABLE IF NOT EXISTS facture (
	uuid_facture int NOT NULL,
	uuid_ticket int NOT NULL,
	lien TEXT
);

CREATE TABLE IF NOT EXISTS modifticketdecaisse (
	id_modif int NOT NULL,
	id_ticket int NOT NULL,
	nom_vendeur varchar(255),
	id_vendeur int NOT NULL,
	date_achat_dt TIMESTAMP,
	nbr_objet int NOT NULL,
	moyen_paiement TEXT,
	num_cheque TEXT,
	banque varchar(255),
	num_transac varchar(255),
	prix_total int NOT NULL,
	lien TEXT,
	reducbene tinyint,
	reducclient tinyint,
	reducgrospanierclient tinyint,
	reducgrospanierbene tinyint
);

CREATE TABLE IF NOT EXISTS paiement_mixte_modif (
	id_paiement_mixte_modif int NOT NULL,
	id_paiement_mixte int NOT NULL,
	id_ticket int NOT NULL,
	espece int NOT NULL,
	carte int NOT NULL,
	cheque int NOT NULL,
	virement int
);

CREATE TABLE IF NOT EXISTS users (
	id int NOT NULL,
	prenom varchar(255),
	nom varchar(255),
	pseudo varchar(255),
	password TEXT,
	admin tinyint NOT NULL,
	mail varchar(255),
	tel varchar(255)
);

CREATE TABLE IF NOT EXISTS vente (
	id_temp_vente INTEGER PRIMARY KEY AUTOINCREMENT,
	dateheure TEXT,
	id_vendeur INTEGER,
	modif TINYINT,
	id_modif INTEGER
);

CREATE TABLE IF NOT EXISTS ticketdecaissetemp (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	id_temp_vente INTEGER NOT NULL,
	nom TEXT NOT NULL,
	categorie TEXT,
	souscat TEXT,
	prix REAL NOT NULL,
	nbr INTEGER NOT NULL,
	prixt REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ticketdecaisse (
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
	reducgrospanierbene TINYINT,
	correction_de INTEGER,
	flag_correction BOOLEAN DEFAULT 0,
	corrige_le_ticket INTEGER,
	uuid_ticket TEXT,
	cloture INTEGER,
	uuid_session_caisse INTEGER
);

CREATE TABLE IF NOT EXISTS objets_vendus (
	id_achat INTEGER PRIMARY KEY AUTOINCREMENT,
	id_ticket INTEGER NOT NULL,
	nom_vendeur VARCHAR,
	id_vendeur INTEGER NOT NULL,
	nom VARCHAR,
	categorie VARCHAR,
	souscat VARCHAR,
	date_achat TEXT,
	timestamp INTEGER NOT NULL,
	prix INTEGER,
	nbr INTEGER NOT NULL,
	uuid_objet TEXT
);

CREATE TABLE IF NOT EXISTS bilan (
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

CREATE TABLE IF NOT EXISTS paiement_mixte (
	id_paiement_mixte INTEGER PRIMARY KEY AUTOINCREMENT,
	id_ticket INTEGER NOT NULL,
	espece INTEGER NOT NULL DEFAULT 0,
	carte INTEGER NOT NULL DEFAULT 0,
	cheque INTEGER NOT NULL DEFAULT 0,
	virement INTEGER NOT NULL DEFAULT 0,
	uuid_ticket TEXT
);

CREATE TABLE IF NOT EXISTS journal_corrections (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	date_correction TEXT,
	id_ticket_original INTEGER,
	id_ticket_annulation INTEGER,
	id_ticket_correction INTEGER,
	utilisateur TEXT,
	motif TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	type TEXT NOT NULL,
	operation TEXT NOT NULL,
	payload TEXT NOT NULL,
	synced INTEGER DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS code_postal (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	code TEXT NOT NULL,
	date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_caisse (
	id_session TEXT PRIMARY KEY,
	date_ouverture TEXT NOT NULL,
	heure_ouverture TEXT NOT NULL,
	utilisateur_ouverture TEXT,
	responsable_ouverture TEXT,
	fond_initial INTEGER NOT NULL,
	date_fermeture TEXT,
	heure_fermeture TEXT,
	utilisateur_fermeture TEXT,
	responsable_fermeture TEXT,
	montant_reel INTEGER,
	commentaire TEXT,
	ecart INTEGER,
	caissiers TEXT,
	montant_reel_carte INTEGER,
	montant_reel_cheque INTEGER,
	montant_reel_virement INTEGER
);
