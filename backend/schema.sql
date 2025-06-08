CREATE TABLE IF NOT EXISTS ticketdecaisse (
  id_ticket INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid_ticket TEXT,  -- ✅ Ajout UUID obligatoire
  date_achat_dt TEXT,
  correction_de INTEGER,
  flag_correction INTEGER DEFAULT 0,
  nom_vendeur TEXT,
  id_vendeur INTEGER,
  nbr_objet INTEGER,
  prix_total INTEGER,
  moyen_paiement TEXT,
  lien TEXT,
  corrige_le_ticket INTEGER,
  reducbene INTEGER DEFAULT 0,
  reducclient INTEGER DEFAULT 0,
  reducgrospanierclient INTEGER DEFAULT 0,
  reducgrospanierbene INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS objets_vendus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid_objet TEXT,  -- ✅ Ajout de la colonne uuid_ticket
  id_ticket INTEGER,
  nom TEXT,
  prix INTEGER,
  nbr INTEGER,
  categorie TEXT,
  souscat TEXT,
  nom_vendeur TEXT,
  id_vendeur INTEGER,
  date_achat TEXT,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS bilan (
  date TEXT PRIMARY KEY,
  timestamp INTEGER,
  nombre_vente INTEGER,
  poids INTEGER,
  prix_total INTEGER,
  prix_total_espece INTEGER,
  prix_total_cheque INTEGER,
  prix_total_carte INTEGER,
  prix_total_virement INTEGER
);

CREATE TABLE IF NOT EXISTS paiement_mixte (
  id_ticket INTEGER PRIMARY KEY,
  uuid_ticket TEXT,  -- ✅ Ajout de la colonne uuid_ticket
  espece INTEGER,
  carte INTEGER,
  cheque INTEGER,
  virement INTEGER
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

CREATE TABLE IF NOT EXISTS vente (
  id_temp_vente INTEGER PRIMARY KEY AUTOINCREMENT,
  dateheure TEXT
);

CREATE TABLE IF NOT EXISTS ticketdecaissetemp (
  id_temp_vente TEXT,
  nom TEXT,
  prix INTEGER,
  prixt INTEGER,
  nbr INTEGER,
  categorie TEXT,
  souscat TEXT,
  poids INTEGER
);

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    operation TEXT,
    payload TEXT,
    synced INTEGER DEFAULT 0
);
