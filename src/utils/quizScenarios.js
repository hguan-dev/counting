import { Card } from '../models/Card';
import { computeActionEvs } from './actionEv';
import { calculateTotal, getDetailedPlay } from './strategyEngine';

const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

// A spot counts as difficult when the best play beats the runner-up by less
// than this many units of the original bet. Around 30% of dealt hands
// qualify: 16 v 10, A,7 v 2 and 12 v 3 do, 11 v 6 and hard 19 don't.
export const QUIZ_MAX_EV_GAP = 0.08;

const randomItem = (items, random) => items[Math.floor(random() * items.length)];
const randomCard = (random, value) => new Card(randomItem(SUITS, random), value ?? randomItem(VALUES, random));

export const getEvGap = ({ cards, dealerCard, rules, trueCount }) => {
  const isPair = cards[0].numericValue === cards[1].numericValue;
  const { evs } = computeActionEvs({
    canDouble: true,
    canSplit: isPair,
    canSurrender: rules?.lateSurrender !== false,
    dealerUpCard: dealerCard,
    decks: rules?.decks ?? 6,
    doubleAfterSplit: rules?.doubleAfterSplit !== false,
    hitsSoft17: rules?.dealerHitsSoft17 !== false,
    playerCards: cards,
    trueCount,
  });
  const values = Object.values(evs).filter(Number.isFinite).sort((a, b) => b - a);
  return values.length > 1 ? values[0] - values[1] : Infinity;
};

// Close calls, plus any spot where the count changes the play.
export const isDifficultSpot = ({ cards, dealerCard, evaluation, rules, trueCount }) => (
  evaluation.type !== 'Basic Strategy'
  || getEvGap({ cards, dealerCard, rules, trueCount }) < QUIZ_MAX_EV_GAP
);

export const buildQuizScenario = (rules, random = Math.random) => {
  for (;;) {
    const trueCount = Math.floor(random() * 9) - 3;
    const dealerCard = randomCard(random);
    const roll = random();
    let cards;
    if (roll < 0.25) {
      const value = randomItem(VALUES, random);
      cards = [randomCard(random, value), randomCard(random, value)];
    } else if (roll < 0.5) {
      cards = [randomCard(random, 'A'), randomCard(random, randomItem(['2', '3', '4', '5', '6', '7', '8', '9'], random))];
    } else {
      cards = [randomCard(random), randomCard(random)];
    }
    if (calculateTotal(cards) === 21) continue;

    const evaluation = getDetailedPlay(cards, dealerCard, trueCount, { rules });
    const scenario = { cards, dealerCard, evaluation, trueCount };
    if (isDifficultSpot({ ...scenario, rules })) return scenario;
  }
};
