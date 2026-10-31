import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import { getDetailedPlay } from './strategyEngine';
import { describeIndexSet, getDeviationGuideGroups, getDeviations } from './deviations';

const card = value => new Card('♠', String(value));
const play = (hand, dealer, trueCount, options = {}) => (
  getDetailedPlay(hand.map(card), card(dealer), trueCount, options).action
);

describe('complete six-deck H17 Hi-Lo deviations', () => {
  test('applies surrender indices and their reverse plays', () => {
    expect(play([10, 6], 8, 4)).toBe('surrender');
    expect(play([10, 6], 8, 3)).toBe('hit');
    expect(play([10, 6], 9, -1)).toBe('hit');
    expect(play([10, 6], 9, 0)).toBe('surrender');
    expect(play([10, 6], 10, -3)).toBe('hit');
    expect(play([10, 6], 10, -2)).toBe('surrender');
    expect(play([10, 5], 9, 2)).toBe('surrender');
    expect(play([10, 5], 9, 1)).toBe('hit');
    expect(play([10, 5], 10, 0, { runningCount: -1 })).toBe('hit');
    expect(play([10, 5], 10, 0, { runningCount: 0 })).toBe('surrender');
    expect(play([10, 5], 'A', -1)).toBe('surrender');
    expect(play([10, 5], 'A', -2)).toBe('hit');
    expect(play([10, 4], 10, 3)).toBe('surrender');
    expect(play([10, 4], 10, 2)).toBe('hit');
  });

  test('applies hard-total stand and hit indices without surrender', () => {
    const noSurrender = { allowSurrender: false };
    expect(play([10, 6], 9, 4, noSurrender)).toBe('stand');
    expect(play([10, 6], 9, 3, noSurrender)).toBe('hit');
    expect(play([10, 6], 10, 0, { allowSurrender: false, runningCount: 0 })).toBe('stand');
    expect(play([10, 6], 10, 0, { allowSurrender: false, runningCount: -1 })).toBe('hit');
    expect(play([10, 6], 'A', 3, noSurrender)).toBe('stand');
    expect(play([10, 6], 'A', 2, noSurrender)).toBe('hit');
    expect(play([10, 5], 10, 4, noSurrender)).toBe('stand');
    expect(play([10, 5], 10, 3, noSurrender)).toBe('hit');
    expect(play([10, 5], 'A', 5, noSurrender)).toBe('stand');
    expect(play([10, 5], 'A', 4, noSurrender)).toBe('hit');
    expect(play([10, 3], 2, -1)).toBe('hit');
    expect(play([10, 3], 2, 0)).toBe('stand');
    expect(play([10, 2], 2, 3)).toBe('stand');
    expect(play([10, 2], 2, 2)).toBe('hit');
    expect(play([10, 2], 3, 2)).toBe('stand');
    expect(play([10, 2], 3, 1)).toBe('hit');
    expect(play([10, 2], 4, 0, { runningCount: -1 })).toBe('hit');
    expect(play([10, 2], 4, 0, { runningCount: 0 })).toBe('stand');
  });

  test('applies every hard doubling index', () => {
    expect(play([6, 4], 10, 4)).toBe('double');
    expect(play([6, 4], 10, 3)).toBe('hit');
    expect(play([6, 4], 'A', 3)).toBe('double');
    expect(play([6, 4], 'A', 2)).toBe('hit');
    expect(play([5, 4], 2, 1)).toBe('double');
    expect(play([5, 4], 2, 0)).toBe('hit');
    expect(play([5, 4], 7, 3)).toBe('double');
    expect(play([5, 4], 7, 2)).toBe('hit');
    expect(play([5, 3], 6, 2)).toBe('double');
    expect(play([5, 3], 6, 1)).toBe('hit');
  });

  test('applies soft-total indices and H17 basic plays', () => {
    expect(play(['A', 8], 4, 3)).toBe('double');
    expect(play(['A', 8], 4, 2)).toBe('stand');
    expect(play(['A', 8], 5, 1)).toBe('double');
    expect(play(['A', 8], 5, 0)).toBe('stand');
    expect(play(['A', 8], 6, 0, { runningCount: -1 })).toBe('stand');
    expect(play(['A', 8], 6, 0, { runningCount: 0 })).toBe('double');
    expect(play(['A', 6], 2, 1)).toBe('double');
    expect(play(['A', 6], 2, 0)).toBe('hit');
    expect(play(['A', 7], 2, 0)).toBe('double');
  });

  test('applies all ten-splitting indices', () => {
    expect(play([10, 10], 4, 6)).toBe('split');
    expect(play([10, 10], 4, 5)).toBe('stand');
    expect(play([10, 10], 5, 5)).toBe('split');
    expect(play([10, 10], 5, 4)).toBe('stand');
    expect(play([10, 10], 6, 4)).toBe('split');
    expect(play([10, 10], 6, 3)).toBe('stand');
  });
});

describe('six-deck S17 Hi-Lo deviations', () => {
  const s17 = { dealerHitsSoft17: false, doubleAfterSplit: true, lateSurrender: true };
  const s17NoLs = { ...s17, lateSurrender: false };

  test('doubles 11 vs Ace only from TC +1', () => {
    expect(play([5, 6], 'A', 1, { rules: s17 })).toBe('double');
    expect(play([5, 6], 'A', 0, { rules: s17 })).toBe('hit');
  });

  test('doubles 10 vs Ace from TC +4, not the H17 +3', () => {
    expect(play([6, 4], 'A', 4, { rules: s17 })).toBe('double');
    expect(play([6, 4], 'A', 3, { rules: s17 })).toBe('hit');
  });

  test('doubles soft 19 vs 6 from TC +1 and stands below it', () => {
    expect(play(['A', 8], 6, 1, { rules: s17 })).toBe('double');
    expect(play(['A', 8], 6, 0, { rules: s17, runningCount: 2 })).toBe('stand');
  });

  test('surrenders 15 vs Ace from TC +2, not the H17 −1', () => {
    expect(play([10, 5], 'A', 2, { rules: s17 })).toBe('surrender');
    expect(play([10, 5], 'A', 1, { rules: s17 })).toBe('hit');
    expect(play([10, 5], 'A', -1, { rules: s17 })).toBe('hit');
  });

  test('has no 15 or 16 vs Ace stand index without surrender', () => {
    expect(play([10, 6], 'A', 6, { rules: s17NoLs })).toBe('hit');
    expect(play([10, 5], 'A', 6, { rules: s17NoLs })).toBe('hit');
  });

  test('never surrenders without late surrender', () => {
    expect(play([10, 6], 8, 6, { rules: s17NoLs })).toBe('hit');
    expect(play([10, 4], 10, 6, { rules: s17NoLs })).toBe('hit');
    expect(play([10, 6], 9, 4, { rules: s17NoLs })).toBe('stand');
  });
});

describe('rule-aware index set', () => {
  const rulesFor = (h17, ls) => ({ dealerHitsSoft17: h17, doubleAfterSplit: true, lateSurrender: ls });
  const codes = rules => getDeviations(rules).map(d => `${d.cell.hand}v${d.cell.dealer} ${d.cell.code}`);

  test('H17 and S17 get their own Ace indices', () => {
    expect(codes(rulesFor(true, true))).toEqual(expect.arrayContaining(['10v11 D ≥ +3', '15v11 R ≥ −1', 'A,8v6 S RC<0']));
    expect(codes(rulesFor(true, true))).not.toEqual(expect.arrayContaining(['11v11 D ≥ +1']));
    expect(codes(rulesFor(false, true))).toEqual(expect.arrayContaining(['10v11 D ≥ +4', '11v11 D ≥ +1', '15v11 R ≥ +2', 'A,8v6 D ≥ +1']));
    expect(codes(rulesFor(false, true))).not.toEqual(expect.arrayContaining(['10v11 D ≥ +3', '16v11 S ≥ +3', '15v11 S ≥ +5']));
  });

  test('no LS drops every surrender index', () => {
    [true, false].forEach((h17) => {
      expect(getDeviations(rulesFor(h17, false)).some(d => d.play.action === 'surrender')).toBe(false);
      expect(getDeviationGuideGroups(rulesFor(h17, false)).map(g => g.title)).not.toContain('Surrender');
    });
  });

  test('the guide names the active index set', () => {
    expect(describeIndexSet(rulesFor(true, true))).toBe('Six-deck H17, late surrender indices');
    expect(describeIndexSet(rulesFor(false, false))).toBe('Six-deck S17, no surrender indices');
  });
});
