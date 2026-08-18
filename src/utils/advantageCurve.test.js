import { describe, expect, test } from 'vitest';
import { computeGameEv, getAdvantageCurve, getEdgePerTrueCount, getPlayerEdgePercent } from './advantageCurve';
import { DEFAULT_RULES, getHouseEdgePercent } from './tableRules';

describe('engine-derived advantage curve', () => {
  test('is anchored to the published house edge at TC 0 and rises with the count', () => {
    const curve = getAdvantageCurve(DEFAULT_RULES);
    expect(curve[0]).toBeCloseTo(-getHouseEdgePercent(DEFAULT_RULES), 6);
    for (let tc = -3; tc < 8; tc += 1) expect(curve[tc + 1]).toBeGreaterThan(curve[tc]);
    // 6-deck H17 DAS LS with full-index play: roughly 0.5–0.65% per true count.
    const slope = getEdgePerTrueCount(DEFAULT_RULES);
    expect(slope).toBeGreaterThan(0.5);
    expect(slope).toBeLessThan(0.65);
    // Break-even lands between TC 0 and TC +2.
    expect(getPlayerEdgePercent(DEFAULT_RULES, 0)).toBeLessThan(0);
    expect(getPlayerEdgePercent(DEFAULT_RULES, 2)).toBeGreaterThan(0);
  });

  test('raw engine edge at TC 0 sits near the published basic-strategy edge', () => {
    // Wizard of Odds, 6D H17 DAS, no surrender: −0.615%. Optimal play plus
    // the shoe model land within a tenth of a percent.
    const raw = computeGameEv(0, { ...DEFAULT_RULES, lateSurrender: false }) * 100;
    expect(raw).toBeGreaterThan(-0.72);
    expect(raw).toBeLessThan(-0.45);
  });

  test('rules reshape the curve the way the literature says', () => {
    const h17 = getAdvantageCurve(DEFAULT_RULES);
    const s17 = getAdvantageCurve({ ...DEFAULT_RULES, dealerHitsSoft17: false });
    const noLs = getAdvantageCurve({ ...DEFAULT_RULES, lateSurrender: false });
    const sixFive = getAdvantageCurve({ ...DEFAULT_RULES, blackjackPayout: 1.2 });
    [0, 2, 4, 6].forEach((tc) => {
      expect(s17[tc]).toBeGreaterThan(h17[tc]);
      expect(sixFive[tc]).toBeLessThan(h17[tc] - 1);
    });
    // Surrender is worth more in high counts than off the top.
    expect(h17[6] - noLs[6]).toBeGreaterThan(h17[0] - noLs[0]);
    // 6:5 does not break even until well past TC +3.
    expect(getPlayerEdgePercent({ ...DEFAULT_RULES, blackjackPayout: 1.2 }, 3)).toBeLessThan(0);
  });

  test('interpolates and extrapolates smoothly', () => {
    const half = getPlayerEdgePercent(DEFAULT_RULES, 2.5);
    expect(half).toBeGreaterThan(getPlayerEdgePercent(DEFAULT_RULES, 2));
    expect(half).toBeLessThan(getPlayerEdgePercent(DEFAULT_RULES, 3));
    expect(getPlayerEdgePercent(DEFAULT_RULES, 10)).toBeGreaterThan(getPlayerEdgePercent(DEFAULT_RULES, 8));
  });
});
