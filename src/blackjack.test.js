import { calculateTotal, getDetailedPlay } from './utils/strategyEngine';
import { Card } from './models/Card';
import { Shoe } from './models/Shoe';
import { describe, expect, test } from 'vitest';

describe('Blackjack Engine Logic & Strategy Tests', () => {
  
  test('calculateTotal evaluates hard totals correctly', () => {
    const cards = [new Card('♥', '10'), new Card('♠', '7')];
    expect(calculateTotal(cards)).toBe(17);
  });

  test('calculateTotal evaluates soft aces correctly', () => {
    const cards = [new Card('♥', 'A'), new Card('♠', '6')];
    expect(calculateTotal(cards)).toBe(17);
  });

  test('calculateTotal adjusts multiple aces when busting', () => {
    const cards = [new Card('♥', 'A'), new Card('♠', 'A'), new Card('♦', '9')];
    expect(calculateTotal(cards)).toBe(21);
  });

  test('calculateTotal safely handles empty and plain card objects', () => {
    expect(calculateTotal(null)).toBe(0);
    expect(calculateTotal([{ value: 'A' }, { value: 'K' }])).toBe(21);
  });

  test('Shoe initializes with correct number of cards', () => {
    const shoe = new Shoe(6);
    expect(shoe.cards.length).toBe(6 * 52);
  });

  test('Shoe draw returns a Card and removes it from the shoe', () => {
    const shoe = new Shoe(1);
    const card = shoe.draw();
    expect(card).toBeInstanceOf(Card);
    expect(shoe.cards).toHaveLength(51);
  });

  test('Strategy engine: stand on hard 17 vs 10', () => {
    const playerHand = [new Card('♥', '10'), new Card('♠', '7')];
    const dealerUpCard = new Card('♦', '10');
    expect(getDetailedPlay(playerHand, dealerUpCard, 0).action).toBe('stand');
  });

  test('Strategy engine: hit hard 14 vs 4 is correct (should not trigger wrong warning)', () => {
    const playerHand = [new Card('♥', '10'), new Card('♠', '4')];
    const dealerUpCard = new Card('♦', '4');
    // Hard 14 vs 4 is a stand in basic strategy (dealer bust card)
    expect(getDetailedPlay(playerHand, dealerUpCard, 0).action).toBe('stand');
  });

  test('Strategy engine: Illustrious 18 deviation 16 vs 10 at TC >= 0', () => {
    const playerHand = [new Card('♥', '10'), new Card('♠', '6')];
    const dealerUpCard = new Card('♦', '10');
    expect(getDetailedPlay(playerHand, dealerUpCard, 0).action).toBe('stand');
  });

  test('Strategy engine: always splits aces and eights', () => {
    const dealerUpCard = new Card('♦', '10');
    expect(getDetailedPlay([new Card('♥', 'A'), new Card('♠', 'A')], dealerUpCard, 0).action).toBe('split');
    expect(getDetailedPlay([new Card('♥', '8'), new Card('♠', '8')], dealerUpCard, 0).action).toBe('split');
  });

  test('Strategy engine: handles soft 18 by dealer up-card', () => {
    const hand = [new Card('♥', 'A'), new Card('♠', '7')];
    expect(getDetailedPlay(hand, new Card('♦', '5'), 0).action).toBe('double');
    expect(getDetailedPlay(hand, new Card('♦', '8'), 0).action).toBe('stand');
    expect(getDetailedPlay(hand, new Card('♦', '10'), 0).action).toBe('hit');
  });

});
