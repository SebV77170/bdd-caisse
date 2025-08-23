CREATE TABLE IF NOT EXISTS boutons_ventes (
  id_bouton INT NOT NULL,
  sous_categorie VARCHAR(34),
  nom VARCHAR(66),
  id_cat VARCHAR(6),
  id_souscat INT,
  prix VARCHAR(4)
);

CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL,
  parent_id VARCHAR(255),
  category VARCHAR(255),
  color VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS compte_transac (
  date_transac TIMESTAMP(10) NOT NULL,
  compte INT NOT NULL
);

CREATE TABLE IF NOT EXISTS facture (
  uuid_facture INT NOT NULL,
  uuid_ticket INT NOT NULL,
  lien TEXT
);

CREATE TABLE IF NOT EXISTS modifticketdecaisse (
  id_modif INT NOT NULL,
  id_ticket INT NOT NULL,
  nom_vendeur VARCHAR(255),
  id_vendeur TEXT NOT NULL,
  date_achat_dt TIMESTAMP,
  nbr_objet INT NOT NULL,
  moyen_paiement TEXT,
  num_cheque TEXT,
  banque VARCHAR(255),
  num_transac VARCHAR(255),
  prix_total INT NOT NULL,
  lien TEXT,
  reducbene TINYINT,
  reducclient TINYINT,
  reducgrospanierclient TINYINT,
  reducgrospanierbene TINYINT
);

CREATE TABLE IF NOT EXISTS paiement_mixte_modif (
  id_paiement_mixte_modif INT NOT NULL,
  id_paiement_mixte INT NOT NULL,
  id_ticket INT NOT NULL,
  espece INT NOT NULL,
  carte INT NOT NULL,
  cheque INT NOT NULL,
  virement INT
);

CREATE TABLE IF NOT EXISTS users (
  uuid_user TEXT NOT NULL,
  prenom VARCHAR(255),
  nom VARCHAR(255),
  pseudo VARCHAR(255),
  password TEXT,
  admin TINYINT NOT NULL,
  mail VARCHAR(255),
  tel VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS vente (
  id_temp_vente INTEGER PRIMARY KEY AUTOINCREMENT,
  dateheure TEXT,
  id_vendeur TEXT,
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
  id_vendeur TEXT NOT NULL,
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
  annulation_de INTEGER,
  flag_annulation BOOLEAN DEFAULT 0,
  corrige_le_ticket INTEGER,
  uuid_ticket TEXT,
  cloture INTEGER,
  uuid_session_caisse INTEGER,
  flag_correction INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS objets_vendus (
  id_achat INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid_ticket INTEGER NOT NULL,
  nom_vendeur VARCHAR,
  id_vendeur TEXT NOT NULL,
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
  prix_total INTEGER,
  prix_total_espece INTEGER,
  prix_total_cheque INTEGER,
  prix_total_carte INTEGER,
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
  uuid_ticket_original INTEGER,
  uuid_ticket_annulation INTEGER,
  uuid_ticket_correction INTEGER,
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

-- ─────────────────────────────────────────────────────────────
-- NOUVELLE VERSION (UTC) DE session_caisse
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_caisse (
  id_session TEXT PRIMARY KEY,

  -- Timestamps en UTC
  opened_at_utc   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at_utc   DATETIME,

  -- Infos ouverture/fermeture
  utilisateur_ouverture  TEXT,
  responsable_ouverture  TEXT,
  utilisateur_fermeture  TEXT,
  responsable_fermeture  TEXT,

  -- Données comptables (en centimes)
  fond_initial          INTEGER NOT NULL,
  montant_reel          INTEGER,
  commentaire           TEXT,
  ecart                 INTEGER,
  caissiers             TEXT,
  montant_reel_carte    INTEGER,
  montant_reel_cheque   INTEGER,
  montant_reel_virement INTEGER,

  -- Métadonnées
  issecondaire INTEGER DEFAULT 0,
  poste        INTEGER
);

-- Index utiles pour requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_session_caisse_opened_at_utc ON session_caisse (opened_at_utc);
CREATE INDEX IF NOT EXISTS idx_session_caisse_closed_at_utc ON session_caisse (closed_at_utc);

CREATE TABLE IF NOT EXISTS uuid_mapping (
  uuid TEXT PRIMARY KEY,
  id_friendly TEXT UNIQUE,
  type TEXT
);
