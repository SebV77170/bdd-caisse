const { sqlite } = require('../db');
const getBilanSession = require('./bilanSession');

const PAYMENT_COLUMNS = ['espece', 'carte', 'cheque', 'virement'];

function getAccountingSnapshot({ sessionId, date }) {
  const ticketTotals = sqlite.prepare(`
    SELECT
      COALESCE(SUM(prix_total), 0) AS total,
      COALESCE(SUM(CASE WHEN COALESCE(cloture, 0) = 0 THEN 1 ELSE 0 END), 0) AS rows
    FROM ticketdecaisse
    WHERE uuid_session_caisse = ?
      AND COALESCE(cloture, 0) = 0
  `).get(sessionId);

  const objectTotals = sqlite.prepare(`
    SELECT COALESCE(SUM(o.prix * o.nbr), 0) AS total
    FROM objets_vendus o
    JOIN ticketdecaisse t ON t.uuid_ticket = o.uuid_ticket
    WHERE t.uuid_session_caisse = ?
      AND COALESCE(t.cloture, 0) = 0
  `).get(sessionId);

  const paymentTotals = sqlite.prepare(`
    SELECT
      COALESCE(SUM(p.espece), 0) AS espece,
      COALESCE(SUM(p.carte), 0) AS carte,
      COALESCE(SUM(p.cheque), 0) AS cheque,
      COALESCE(SUM(p.virement), 0) AS virement
    FROM paiement_mixte p
    JOIN ticketdecaisse t ON t.uuid_ticket = p.uuid_ticket
    WHERE t.uuid_session_caisse = ?
      AND COALESCE(t.cloture, 0) = 0
  `).get(sessionId);
  paymentTotals.total = PAYMENT_COLUMNS.reduce(
    (sum, column) => sum + paymentTotals[column],
    0
  );

  const session = getBilanSession(sessionId);
  const daily = date
    ? sqlite.prepare(`
        SELECT
          COALESCE(nombre_vente, 0) AS nombre_vente,
          COALESCE(prix_total, 0) AS prix_total,
          COALESCE(prix_total_espece, 0) AS prix_total_espece,
          COALESCE(prix_total_carte, 0) AS prix_total_carte,
          COALESCE(prix_total_cheque, 0) AS prix_total_cheque,
          COALESCE(prix_total_virement, 0) AS prix_total_virement
        FROM bilan
        WHERE date = ?
      `).get(date) || {
        nombre_vente: 0,
        prix_total: 0,
        prix_total_espece: 0,
        prix_total_carte: 0,
        prix_total_cheque: 0,
        prix_total_virement: 0
      }
    : null;

  return {
    tickets: ticketTotals,
    objects: objectTotals,
    payments: paymentTotals,
    session,
    daily
  };
}

function assertAccountingConsistency(snapshot, { includeDaily = true } = {}) {
  const expected = snapshot.payments.total;
  const totals = {
    tickets: snapshot.tickets.total,
    objects: snapshot.objects.total,
    session: snapshot.session.prix_total
  };
  if (includeDaily && snapshot.daily) totals.daily = snapshot.daily.prix_total;

  for (const [source, total] of Object.entries(totals)) {
    if (total !== expected) {
      throw new Error(
        `Incohérence comptable ${source}: ${total} centimes, paiements: ${expected} centimes.`
      );
    }
  }

  for (const method of PAYMENT_COLUMNS) {
    const sessionValue = snapshot.session[`prix_total_${method}`];
    if (sessionValue !== snapshot.payments[method]) {
      throw new Error(`Incohérence du moyen de paiement ${method} dans le bilan de session.`);
    }
    if (
      includeDaily &&
      snapshot.daily &&
      snapshot.daily[`prix_total_${method}`] !== snapshot.payments[method]
    ) {
      throw new Error(`Incohérence du moyen de paiement ${method} dans le bilan journalier.`);
    }
  }

  return true;
}

module.exports = { getAccountingSnapshot, assertAccountingConsistency };
