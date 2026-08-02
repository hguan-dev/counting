import { describe, expect, test } from 'vitest';
import { getRecommendedWager, isValidTableWager } from './betSizing';

describe('the fixed $25-unit bet ramp', () => {
  test.each([
    [-5, 25],
    [0, 25],
    [1, 25],
    [2, 50],
    [3, 100],
    [4, 150],
    [5, 200],
    [8, 200],
  ])('maps true count %s to a $%s wager', (trueCount, wager) => {
    expect(getRecommendedWager(trueCount)).toBe(wager);
  });

  test('accepts only table wagers in $25 increments', () => {
    expect(isValidTableWager(25)).toBe(true);
    expect(isValidTableWager(150)).toBe(true);
    expect(isValidTableWager(10000)).toBe(true);
    expect(isValidTableWager(20)).toBe(false);
    expect(isValidTableWager(55)).toBe(false);
    expect(isValidTableWager(10025)).toBe(false);
  });
});
