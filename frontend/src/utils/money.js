// utils/money.js
export function eurosStringToCents(input) {
  if (input === null || input === undefined) return 0;

  // Accepte number direct
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.round(input * 100);
  }

  // Normalise la chaîne: supprime espaces, remplace ',' par '.'
  const s = String(input).trim().replace(/\s/g, '').replace(',', '.');

  // Vide ou juste un séparateur -> 0
  if (s === '' || s === '.' || s === '-.' || s === '-') return 0;

  const num = Number(s);
  if (!Number.isFinite(num)) return 0;

  return Math.round(num * 100);
}
