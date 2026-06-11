import {
  formatParisDateTime,
  getParisDateKey,
  parseUtcDate,
} from './dateTime';

describe('dateTime', () => {
  test('interprete les anciens horodatages sans fuseau comme UTC', () => {
    expect(parseUtcDate('2026-01-15 23:30:00').toISOString())
      .toBe('2026-01-15T23:30:00.000Z');
  });

  test('affiche les horaires en heure de Paris en hiver et en ete', () => {
    expect(formatParisDateTime('2026-01-15T23:30:00.000Z'))
      .toContain('00:30:00');
    expect(formatParisDateTime('2026-07-15T22:30:00.000Z'))
      .toContain('00:30:00');
  });

  test('utilise le jour parisien pour le filtre du bilan', () => {
    expect(getParisDateKey('2026-01-15T23:30:00.000Z')).toBe('2026-01-16');
    expect(getParisDateKey('2026-07-15T22:30:00.000Z')).toBe('2026-07-16');
  });
});
