import { calculateTotal, getDetailedPlay } from './utils/strategyEngine';
import { Card } from './models/Card';
import { Shoe } from './models/Shoe';

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
    expect(calculateTotal(cards)).toBe(11);
  });

  test('Shoe initializes with correct number of cards', () => {
    const shoe = new Shoe(6);
    expect(shoe.cards.length).toBe(6 * 52);
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

});
