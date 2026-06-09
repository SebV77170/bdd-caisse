const PAYMENT_METHODS = ['espece', 'carte', 'cheque', 'virement'];

function normalizePaymentMethod(method) {
  const normalized = String(method || '').trim().toLowerCase();
  const mapping = {
    carte: 'carte',
    cb: 'carte',
    'cb visa': 'carte',
    cb_visa: 'carte',
    espece: 'espece',
    'espèce': 'espece',
    especes: 'espece',
    'espèces': 'espece',
    cash: 'espece',
    cheque: 'cheque',
    'chèque': 'cheque',
    virement: 'virement'
  };
  return mapping[normalized] || null;
}

function summarizePayments(payments) {
  const totals = { espece: 0, carte: 0, cheque: 0, virement: 0 };

  for (const payment of payments || []) {
    const method = normalizePaymentMethod(payment?.moyen);
    const amount = Number(payment?.montant);
    if (!method) {
      throw new Error(`Moyen de paiement invalide : ${payment?.moyen || ''}`);
    }
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error('Les montants de paiement doivent être des centimes positifs.');
    }
    totals[method] += amount;
  }

  return totals;
}

function assertPaymentsMatchTotal(payments, expectedTotal) {
  const totals = summarizePayments(payments);
  const paidTotal = PAYMENT_METHODS.reduce((sum, method) => sum + totals[method], 0);
  if (paidTotal !== expectedTotal) {
    throw new Error(
      `Le total des paiements (${paidTotal}) ne correspond pas au total à encaisser (${expectedTotal}).`
    );
  }
  return totals;
}

module.exports = {
  normalizePaymentMethod,
  summarizePayments,
  assertPaymentsMatchTotal
};
