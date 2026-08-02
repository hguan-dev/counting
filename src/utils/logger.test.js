import { describe, expect, test } from 'vitest';
import { GameLogger } from './logger';

describe('game logger', () => {
  test('exports substantive structured round data and safely escapes details', () => {
    const logger = new GameLogger(() => '2026-08-02T12:00:00.000Z');
    logger.log('DEAL', 'Two spots, $75 total', {
      dealerCards: '5♥, [hole]',
      playerCards: '10♠ 6♦ | 8♣ 8♥',
      runningCount: 2,
      trueCount: 1,
      wager: 75,
    });
    logger.log('ROUND_RESULT', 'Spot 1, hand 1: win, "nice"', {
      dealerCards: '5♥ 10♦ 8♠',
      dealerTotal: 23,
      hand: 1,
      net: 50,
      outcome: 'win',
      playerCards: '10♠ 6♦ 5♣',
      playerTotal: 21,
      returnAmount: 100,
      spot: 1,
      wager: 50,
    });

    const csv = logger.toCSV();
    expect(csv).toContain('"Round","Event","Spot","Hand","Player Cards"');
    expect(csv).toContain('"Running Count","True Count","Decks Remaining","Bankroll"');
    expect(csv).toContain('"1","ROUND_RESULT","1","1","10♠ 6♦ 5♣"');
    expect(csv).toContain('"Spot 1, hand 1: win, ""nice"""');
  });

  test('increments the round number only when a new deal begins', () => {
    const logger = new GameLogger(() => 'now');
    expect(logger.log('DEAL', 'first').round).toBe(1);
    expect(logger.log('HIT', 'card').round).toBe(1);
    expect(logger.log('DEAL', 'second').round).toBe(2);
  });
});
