import { describe, expect, test } from 'vitest';
import {
  DEFAULT_BET_SPREAD,
  evaluateBetSpread,
  getSpreadBet,
  getTrueCountDistribution,
  normalizeBetSpread,
  optimizeBetSpread,
  SPREAD_TRUE_COUNTS,
} from './betSpread';
import { DEFAULT_RULES, getHouseEdgePercent, normalizeRules } from './tableRules';

const sum = values => values.reduce((total, value) => total + value, 0);

describe('true count distribution', () => {
  test('is a probability distribution centred on zero', () => {
    const distribution = getTrueCountDistribution(6, 0.75);
    expect(sum(Object.values(distribution))).toBeCloseTo(1, 5);
    const zero = distribution['0'];
    SPREAD_TRUE_COUNTS.forEach((tc) => {
      expect(distribution[String(tc)]).toBeLessThanOrEqual(zero + 1e-9);
    });
    expect(distribution['1']).toBeCloseTo(distribution['-1'], 6);
  });

  test('deeper penetration and fewer decks put more weight on high counts', () => {
    const highCounts = distribution => sum(['2', '3', '4', '5', '6'].map(tc => distribution[tc]));
    expect(highCounts(getTrueCountDistribution(6, 0.85))).toBeGreaterThan(highCounts(getTrueCountDistribution(6, 0.6)));
    expect(highCounts(getTrueCountDistribution(2, 0.75))).toBeGreaterThan(highCounts(getTrueCountDistribution(8, 0.75)));
    // Six decks, 75% penetration, rounded true count (as this trainer counts):
    // Monte Carlo puts TC +2 or better at ~20.7% of hands.
    const p = highCounts(getTrueCountDistribution(6, 0.75));
    expect(p).toBeGreaterThan(0.17);
    expect(p).toBeLessThan(0.24);
  });
});

describe('rules and house edge', () => {
  test('layers rule effects onto the base edge', () => {
    expect(getHouseEdgePercent(DEFAULT_RULES)).toBeCloseTo(0.54, 2);
    expect(getHouseEdgePercent({ ...DEFAULT_RULES, dealerHitsSoft17: false })).toBeCloseTo(0.33, 2);
    expect(getHouseEdgePercent({ ...DEFAULT_RULES, blackjackPayout: 1.2 })).toBeGreaterThan(1.8);
    expect(getHouseEdgePercent({ ...DEFAULT_RULES, doubleAfterSplit: false })).toBeGreaterThan(getHouseEdgePercent(DEFAULT_RULES));
    expect(getHouseEdgePercent({ ...DEFAULT_RULES, lateSurrender: false })).toBeGreaterThan(getHouseEdgePercent(DEFAULT_RULES));
  });

  test('normalizeRules discards invalid values', () => {
    expect(normalizeRules({ decks: 3, penetration: 0.99, blackjackPayout: 2 })).toEqual(DEFAULT_RULES);
    expect(normalizeRules(null)).toEqual(DEFAULT_RULES);
    expect(normalizeRules({ dealerHitsSoft17: false, decks: 2 }).decks).toBe(2);
  });
});

describe('bet spread evaluation', () => {
  test('a flat table-minimum bet loses at the house edge', () => {
    const flat = Object.fromEntries(SPREAD_TRUE_COUNTS.map(tc => [String(tc), 25]));
    const result = evaluateBetSpread({ bankroll: 5000, handsPerHour: 100, rules: DEFAULT_RULES, spread: flat });
    expect(result.evPerHour).toBeLessThan(0);
    expect(result.averageBet).toBeCloseTo(25, 6);
    expect(result.riskOfRuin).toBe(1);
  });

  test('the default ramp beats flat betting and a Kelly spread beats both', () => {
    const base = { bankroll: 20000, handsPerHour: 200, rules: DEFAULT_RULES };
    const flat = evaluateBetSpread({ ...base, spread: Object.fromEntries(SPREAD_TRUE_COUNTS.map(tc => [String(tc), 25])) });
    const ramp = evaluateBetSpread({ ...base, spread: DEFAULT_BET_SPREAD });
    const optimized = evaluateBetSpread({
      ...base,
      spread: optimizeBetSpread({ bankroll: 20000, kellyFraction: 1, maxBet: 500, rules: DEFAULT_RULES }),
    });
    expect(ramp.evPerHour).toBeGreaterThan(flat.evPerHour);
    expect(optimized.evPerHour).toBeGreaterThan(ramp.evPerHour);
    expect(optimized.riskOfRuin).toBeGreaterThan(0);
    expect(optimized.riskOfRuin).toBeLessThan(1);
    expect(optimized.sdPerHour).toBeGreaterThan(0);
  });

  test('a small bankroll gets a conservative, near-flat half-Kelly spread', () => {
    const spread = optimizeBetSpread({ bankroll: 5000, kellyFraction: 0.5, maxBet: 300, rules: DEFAULT_RULES });
    expect(spread['2']).toBe(25);
    expect(spread['6']).toBeLessThanOrEqual(75);
  });

  test('sitting out negative counts raises EV per hand played', () => {
    const rules = DEFAULT_RULES;
    const stay = optimizeBetSpread({ bankroll: 5000, maxBet: 300, rules });
    const wong = optimizeBetSpread({ bankroll: 5000, maxBet: 300, rules, sitOutBelow: -1 });
    expect(wong['-2']).toBe(0);
    expect(wong['-1']).toBe(0);
    expect(wong['0']).toBe(25);
    const stayResult = evaluateBetSpread({ bankroll: 5000, handsPerHour: 200, rules, spread: stay });
    const wongResult = evaluateBetSpread({ bankroll: 5000, handsPerHour: 200, rules, spread: wong });
    expect(wongResult.evPerHour).toBeGreaterThan(stayResult.evPerHour);
    expect(wongResult.handsSatOut).toBeGreaterThan(0.1);
  });

  test('optimizer never bets less at a higher count and respects the cap', () => {
    const spread = optimizeBetSpread({ bankroll: 20000, kellyFraction: 1, maxBet: 500, rules: DEFAULT_RULES });
    let previous = 0;
    SPREAD_TRUE_COUNTS.forEach((tc) => {
      expect(spread[String(tc)]).toBeGreaterThanOrEqual(previous);
      expect(spread[String(tc)]).toBeLessThanOrEqual(500);
      expect(spread[String(tc)] % 25).toBe(0);
      previous = spread[String(tc)];
    });
    const capped = optimizeBetSpread({ bankroll: 200000, kellyFraction: 1, maxBet: 500, rules: DEFAULT_RULES });
    expect(capped['6']).toBe(500);
    expect(capped['3']).toBe(500);
  });

  test('normalizeBetSpread rounds to units and getSpreadBet clamps the count', () => {
    const spread = normalizeBetSpread({ 2: 60, 6: 999999, '-2': -5 });
    expect(spread['2']).toBe(50);
    expect(spread['6']).toBe(10000);
    expect(spread['-2']).toBe(DEFAULT_BET_SPREAD['-2']);
    expect(getSpreadBet(spread, 12)).toBe(spread['6']);
    expect(getSpreadBet(spread, -9)).toBe(spread['-2']);
    expect(getSpreadBet(spread, 2.4)).toBe(50);
  });
});
