import { describe, expect, test } from 'vitest';
import { Card } from '../models/Card';
import { getDetailedPlay } from './strategyEngine';
import { DEFAULT_RULES } from './tableRules';
import { buildQuizScenario, getEvGap, isDifficultSpot, QUIZ_MAX_EV_GAP } from './quizScenarios';

const spot = (values, dealer, trueCount = 0) => {
  const cards = values.map(value => new Card('♠', value));
  const dealerCard = new Card('♥', dealer);
  const evaluation = getDetailedPlay(cards, dealerCard, trueCount, { rules: DEFAULT_RULES });
  return { cards, dealerCard, evaluation, rules: DEFAULT_RULES, trueCount };
};

describe('quiz scenarios', () => {
  test('obvious spots are left out and close calls are kept', () => {
    expect(isDifficultSpot(spot(['5', '6'], '6'))).toBe(false);
    expect(isDifficultSpot(spot(['10', '9'], '7'))).toBe(false);
    expect(isDifficultSpot(spot(['10', '6'], '10'))).toBe(true);
    expect(isDifficultSpot(spot(['A', '7'], '2'))).toBe(true);
    expect(isDifficultSpot(spot(['10', '2'], '3'))).toBe(true);
  });

  test('every generated scenario is a close call or a count deviation', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < 150; index += 1) {
      const scenario = buildQuizScenario(DEFAULT_RULES, random);
      const closeCall = getEvGap({ ...scenario, rules: DEFAULT_RULES }) < QUIZ_MAX_EV_GAP;
      expect(closeCall || scenario.evaluation.type !== 'Basic Strategy').toBe(true);
    }
  });
});
