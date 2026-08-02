import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import { getCardAssetName, getCardAssetUrl } from './cardAssets';

describe('card assets', () => {
  test.each([
    [new Card('♠', 'A'), 'ace_of_spades'],
    [new Card('♥', '10'), '10_of_hearts'],
    [new Card('♦', 'Q'), 'queen_of_diamonds'],
    [new Card('♣', 'K'), 'king_of_clubs'],
  ])('maps %o to its SVG asset name', (card, expected) => {
    expect(getCardAssetName(card)).toBe(expected);
    expect(getCardAssetUrl(card)).toBe(`/cards/${expected}.svg`);
  });

  test('returns null for malformed cards', () => {
    expect(getCardAssetName(null)).toBeNull();
    expect(getCardAssetName({ value: '1', suit: '♠' })).toBeNull();
    expect(getCardAssetName({ value: 'A', suit: '?' })).toBeNull();
    expect(getCardAssetUrl({ value: 'Joker', suit: 'red' })).toBeNull();
  });
});
