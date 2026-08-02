import { describe, expect, test } from 'vitest';
import {
  calculateRealizedPnl,
  getUnresolvedHandWager,
  STARTING_BANKROLL,
} from './sessionAccounting';

describe('session accounting', () => {
  test('does not treat an unresolved wager as a realized loss', () => {
    expect(calculateRealizedPnl({
      bankroll: 975,
      unresolvedWager: 25,
    })).toBe(0);
  });

  test('reconciles settled wins and losses directly to the stack', () => {
    expect(calculateRealizedPnl({ bankroll: 1025 })).toBe(25);
    expect(calculateRealizedPnl({ bankroll: 950 })).toBe(-50);
  });

  test('excludes reloads from realized profit', () => {
    expect(calculateRealizedPnl({
      bankroll: 1575,
      buyIns: 500,
      startingBankroll: STARTING_BANKROLL,
    })).toBe(75);
  });

  test('includes only unresolved hands in the open-wager adjustment', () => {
    expect(getUnresolvedHandWager([
      {
        subHands: [
          { bet: 50, outcome: null },
          { bet: 50, outcome: 'loss' },
        ],
      },
      {
        subHands: [
          { bet: 100, outcome: null },
          { bet: 25, outcome: 'surrender' },
        ],
      },
    ])).toBe(150);
  });
});
