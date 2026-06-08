import { eurosStringToCents } from '../utils/money';
import { formatCents } from '../utils/euro';

describe('Utilitaires monétaires', () => {
  test.each([
    [null, 0],
    [undefined, 0],
    ['', 0],
    ['-', 0],
    ['12,34', 1234],
    [' 1 234,56 ', 123456],
    [12.345, 1235],
    ['invalide', 0]
  ])('eurosStringToCents(%p) renvoie %p', (input, expected) => {
    expect(eurosStringToCents(input)).toBe(expected);
  });

  test('formatCents formate les centimes en euros français', () => {
    expect(formatCents(123456)).toContain('1 234,56');
  });
});
