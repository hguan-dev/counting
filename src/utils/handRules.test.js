import { describe, expect, test, vi } from 'vitest';
import { Card } from '../models/Card';
import {
  applyEvenMoneyDecision,
  canSplitHand,
  findNextPlayableHand,
  getEvenMoneyOffers,
  getNaturalBlackjackSettlement,
  isNaturalBlackjack,
  splitHand,
} from './handRules';

const playingHand = (cards, overrides = {}) => ({
  cards,
  bet: 25,
  status: 'playing',
  outcome: null,
  isSplitAce: false,
  isSplitHand: false,
  ...overrides,
});

describe('split hand rules', () => {
  test('allows equal-value face cards to split', () => {
    const hand = playingHand([new Card('♥', 'K'), new Card('♠', 'Q')]);
    expect(canSplitHand(hand)).toBe(true);
  });

  test('rejects hands that are not active two-card pairs', () => {
    expect(canSplitHand(playingHand([new Card('♥', '8'), new Card('♠', '7')]))).toBe(false);
    expect(canSplitHand(playingHand(
      [new Card('♥', '8'), new Card('♠', '8')],
      { status: 'stood' },
    ))).toBe(false);
  });

  test('creates two playable hands while preserving the wager', () => {
    const hand = playingHand([new Card('♥', '8'), new Card('♠', '8')]);
    const draws = [new Card('♦', '3'), new Card('♣', '10')];
    const drawCard = vi.fn(() => draws.shift());
    const result = splitHand(hand, drawCard);

    expect(drawCard).toHaveBeenCalledTimes(2);
    expect(result.map(split => split.cards.map(card => card.value))).toEqual([
      ['8', '3'],
      ['8', '10'],
    ]);
    expect(result.every(split => split.bet === 25 && split.status === 'playing')).toBe(true);
    expect(result.every(split => split.isSplitHand && !split.isSplitAce)).toBe(true);
  });

  test('split aces receive one card each and automatically stand', () => {
    const hand = playingHand([new Card('♥', 'A'), new Card('♠', 'A')]);
    const draws = [new Card('♦', 'K'), new Card('♣', '9')];
    const result = splitHand(hand, () => draws.shift());

    expect(result.every(split => split.status === 'stood')).toBe(true);
    expect(result.every(split => split.isSplitAce)).toBe(true);
  });

  test('keeps the first new hand active after a split', () => {
    const spots = [{
      subHands: [
        playingHand([new Card('♥', '8'), new Card('♦', '3')], { isSplitHand: true }),
        playingHand([new Card('♠', '8'), new Card('♣', '10')], { isSplitHand: true }),
      ],
    }];

    expect(findNextPlayableHand(spots, 0, 0, true)).toEqual({ spotIndex: 0, handIndex: 0 });
    expect(findNextPlayableHand(spots, 0, 0, false)).toEqual({ spotIndex: 0, handIndex: 1 });
  });

  test('advances across spots and returns null when every hand is done', () => {
    const stood = playingHand([new Card('♥', '10'), new Card('♠', '7')], { status: 'stood' });
    const playing = playingHand([new Card('♦', '9'), new Card('♣', '7')]);
    const spots = [{ subHands: [stood] }, { subHands: [playing] }];

    expect(findNextPlayableHand(spots, 0, 0)).toEqual({ spotIndex: 1, handIndex: 0 });
    playing.status = 'stood';
    expect(findNextPlayableHand(spots, 0, 0)).toBeNull();
  });
});

describe('blackjack classification', () => {
  test('only an unsplit two-card 21 is a natural blackjack', () => {
    const cards = [new Card('♥', 'A'), new Card('♠', 'K')];
    expect(isNaturalBlackjack(playingHand(cards))).toBe(true);
    expect(isNaturalBlackjack(playingHand(cards, { isSplitHand: true }))).toBe(false);
    expect(isNaturalBlackjack(playingHand([
      new Card('♥', '7'),
      new Card('♠', '7'),
      new Card('♦', '7'),
    ]))).toBe(false);
  });
});

describe('per-hand even money', () => {
  const natural = (bet = 25) => playingHand(
    [new Card('♥', 'A'), new Card('♠', 'K')],
    { bet },
  );

  test('creates one offer for each natural blackjack across multiple spots', () => {
    const spots = [
      { subHands: [natural()] },
      { subHands: [playingHand([new Card('♦', '10'), new Card('♣', '9')])] },
      { subHands: [natural(50)] },
    ];

    expect(getEvenMoneyOffers(spots)).toEqual([
      { spotIndex: 0, handIndex: 0 },
      { spotIndex: 2, handIndex: 0 },
    ]);
  });

  test('records a decision on only the offered hand', () => {
    const spots = [
      { subHands: [natural()] },
      { subHands: [natural()] },
    ];
    const result = applyEvenMoneyDecision(
      spots,
      { spotIndex: 1, handIndex: 0 },
      true,
    );

    expect(result[0].subHands[0].evenMoneyAccepted).toBeUndefined();
    expect(result[1].subHands[0].evenMoneyAccepted).toBe(true);
    expect(spots[1].subHands[0].evenMoneyAccepted).toBeUndefined();
  });

  test('settles accepted and declined naturals independently', () => {
    const accepted = { ...natural(40), evenMoneyAccepted: true };
    const declined = { ...natural(40), evenMoneyAccepted: false };

    expect(getNaturalBlackjackSettlement(accepted, false)).toEqual({
      outcome: 'win',
      returnAmount: 80,
    });
    expect(getNaturalBlackjackSettlement(accepted, true)).toEqual({
      outcome: 'win',
      returnAmount: 80,
    });
    expect(getNaturalBlackjackSettlement(declined, false)).toEqual({
      outcome: 'win',
      returnAmount: 100,
    });
    expect(getNaturalBlackjackSettlement(declined, true)).toEqual({
      outcome: 'push',
      returnAmount: 40,
    });
  });
});
