import currency from 'currency.js';

export const euro = (valeur) =>
  currency(valeur, {
    symbol: '€',
    decimal: ',',
    separator: ' ',
    precision: 2
  });

// ✅ Formateur pour des montants en centimes (ex: 1234 => "12,34 €")
export const formatCents = (cents) => euro(cents / 100).format();
