const REQUIRED_FIELDS = {
  'ticketdecaisse:INSERT': ['uuid_ticket', 'id_vendeur', 'nbr_objet', 'prix_total'],
  'ticketdecaisse:UPDATE': ['uuid_ticket'],
  'ticketdecaisse:DELETE': ['uuid_ticket'],
  'objets_vendus:INSERT': ['uuid_ticket', 'uuid_objet', 'id_vendeur', 'timestamp', 'nbr'],
  'paiement_mixte:INSERT': ['uuid_ticket'],
  'bilan:INSERT': ['date'],
  'bilan:UPDATE': ['date'],
  'facture:INSERT': ['uuid_facture', 'uuid_ticket'],
  'code_postal:INSERT': ['code', 'date'],
  'journal_corrections:INSERT': ['uuid_ticket_original', 'uuid_ticket_annulation'],
  'session_caisse:INSERT': ['id_session'],
  'session_caisse:UPDATE': ['id_session'],
  'uuid_mapping:INSERT': ['uuid', 'id_friendly', 'type'],
  'users:INSERT': ['uuid_user']
};

function validateSyncEntry(type, operation, payload) {
  if (!type || !operation || !payload || typeof payload !== 'object') {
    throw new Error('Entrée sync_log incomplète');
  }

  const key = `${type}:${operation}`;
  const fields = REQUIRED_FIELDS[key];
  if (!fields) {
    throw new Error(`Type non reconnu ou opération non supportée : ${type}/${operation}`);
  }

  const missing = fields.filter(field => (
    payload[field] === undefined
    || payload[field] === null
    || payload[field] === ''
  ));
  if (missing.length > 0) {
    throw new Error(`Payload ${key} incomplet : ${missing.join(', ')}`);
  }
}

module.exports = { validateSyncEntry };
