import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import { computeActionEvs, getCountAdjustedRankProbabilities } from './actionEv';

const hand = (...values) => values.map(value => new Card('♠', value));
const up = value => new Card('♥', value);

describe('count-adjusted rank probabilities', () => {
  test('sum to one and shift with the count', () => {
    const neutral = getCountAdjustedRankProbabilities(0);
    expect(Object.values(neutral).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(neutral[10]).toBeCloseTo(16 / 52, 6);
    expect(neutral[11]).toBeCloseTo(4 / 52, 6);
    const rich = getCountAdjustedRankProbabilities(4);
    expect(rich[10]).toBeGreaterThan(neutral[10]);
    expect(rich[5]).toBeLessThan(neutral[5]);
    expect(Object.values(rich).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});

describe('action EVs at a neutral count', () => {
  test('dealer bust probabilities follow the classic ordering', () => {
    const six = computeActionEvs({ dealerUpCard: up('6'), playerCards: hand('10', '7') });
    const ace = computeActionEvs({ dealerUpCard: up('A'), playerCards: hand('10', '7') });
    expect(six.dealerBust).toBeGreaterThan(0.38);
    expect(six.dealerBust).toBeLessThan(0.46);
    expect(ace.dealerBust).toBeLessThan(0.22);
  });

  test('hard 20 vs 6 is a big favourite standing', () => {
    const result = computeActionEvs({ dealerUpCard: up('6'), playerCards: hand('10', 'Q') });
    expect(result.best).toBe('stand');
    expect(result.evs.stand).toBeGreaterThan(0.6);
    expect(result.evs.hit).toBeLessThan(-0.7);
  });

  test('11 vs 6 doubles, A,A vs 6 splits, 16 vs 10 surrenders', () => {
    expect(computeActionEvs({ dealerUpCard: up('6'), playerCards: hand('5', '6') }).best).toBe('double');
    expect(computeActionEvs({ canSplit: true, dealerUpCard: up('6'), playerCards: hand('A', 'A') }).best).toBe('split');
    const sixteen = computeActionEvs({ canSurrender: true, dealerUpCard: up('10'), playerCards: hand('10', '6') });
    expect(sixteen.best).toBe('surrender');
    expect(sixteen.evs.hit).toBeLessThan(-0.45);
    expect(sixteen.evs.stand).toBeLessThan(-0.45);
    expect(Math.abs(sixteen.evs.hit - sixteen.evs.stand)).toBeLessThan(0.05);
  });

  test('a rising count flips 16 vs 10 from hit to stand and 12 vs 2 to stand', () => {
    const cold = computeActionEvs({ dealerUpCard: up('10'), playerCards: hand('10', '6'), trueCount: -3 });
    const hot = computeActionEvs({ dealerUpCard: up('10'), playerCards: hand('10', '6'), trueCount: 4 });
    expect(cold.evs.hit).toBeGreaterThan(cold.evs.stand);
    expect(hot.evs.stand).toBeGreaterThan(hot.evs.hit);
    const twelve = computeActionEvs({ dealerUpCard: up('2'), playerCards: hand('10', '2'), trueCount: 5 });
    expect(twelve.best).toBe('stand');
  });

  test('S17 makes standing on soft hands slightly better than H17', () => {
    const h17 = computeActionEvs({ dealerUpCard: up('6'), hitsSoft17: true, playerCards: hand('A', '7') });
    const s17 = computeActionEvs({ dealerUpCard: up('6'), hitsSoft17: false, playerCards: hand('A', '7') });
    expect(s17.dealerBust).toBeLessThan(h17.dealerBust);
    expect(h17.evs.double).toBeGreaterThan(h17.evs.stand);
  });
});
