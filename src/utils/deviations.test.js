import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import { getDetailedPlay } from './strategyEngine';

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
