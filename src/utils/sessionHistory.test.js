import { describe, expect, test } from 'vitest';
import { rateSession, summarizeHistory, summarizeSession } from './sessionHistory';

const hands = [
  { cumulativePnl: 25, net: 25 },
  { cumulativePnl: 0, net: -25 },
  { cumulativePnl: 75, net: 75 },
];

describe('session rating', () => {
  test('needs a minimum sample before awarding stars', () => {
    expect(rateSession({ decisions: 5, mistakes: 0 }).stars).toBe(0);
  });

  test('awards stars by accuracy, blending drill accuracy when present', () => {
    expect(rateSession({ decisions: 40, mistakes: 1 }).stars).toBe(3);
    expect(rateSession({ decisions: 40, mistakes: 4 }).stars).toBe(2);
    expect(rateSession({ decisions: 40, mistakes: 10 }).stars).toBe(1);
    // Perfect strategy but half the count calls missed drags a 3 down to a 2.
    expect(rateSession({ decisions: 40, mistakes: 0, drillAttempts: 4, drillExact: 2 }).stars).toBe(2);
    // Missing every count call costs another star.
    expect(rateSession({ decisions: 40, mistakes: 0, drillAttempts: 4, drillExact: 0 }).stars).toBe(1);
  });
});

describe('session summaries', () => {
  test('summarizeSession derives P&L, accuracy, peak/trough, and win rate', () => {
    const summary = summarizeSession({ decisions: 20, hands, mistakes: 1, startedAt: 1 });
    expect(summary.pnl).toBe(75);
    expect(summary.accuracy).toBe(95);
    expect(summary.peak).toBe(75);
    expect(summary.trough).toBe(0);
    expect(summary.winRate).toBe(67);
    expect(summary.rating.stars).toBe(3);
    expect(summary.id).toBe('session-1');
  });

  test('summarizeHistory aggregates across sessions', () => {
    const one = summarizeSession({ decisions: 20, hands, mistakes: 1, startedAt: 1 });
    const two = summarizeSession({ decisions: 20, hands: [{ cumulativePnl: -50, net: -50 }], mistakes: 5, startedAt: 2 });
    const totals = summarizeHistory([one, two]);
    expect(totals.sessions).toBe(2);
    expect(totals.totalHands).toBe(4);
    expect(totals.totalPnl).toBe(25);
    expect(totals.bestPnl).toBe(75);
    expect(totals.threeStar).toBe(1);
    expect(totals.averageStars).toBeCloseTo(2, 5);
    expect(totals.lifetimeAccuracy).toBe(85);
  });
});
