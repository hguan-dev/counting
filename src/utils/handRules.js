import { calculateTotal } from './strategyEngine';

export const isNaturalBlackjack = (hand) => (
  Boolean(hand)
  && !hand.isSplitHand
  && hand.cards.length === 2
  && calculateTotal(hand.cards) === 21
);

export const canSplitHand = (hand) => (
  Boolean(hand)
  && hand.status === 'playing'
  && hand.cards.length === 2
  && hand.cards[0].numericValue === hand.cards[1].numericValue
);

export const splitHand = (hand, drawCard) => {
  if (!canSplitHand(hand)) throw new Error('Hand cannot be split');

  const splitAces = hand.cards[0].value === 'A';
  const makeHand = (originalCard) => ({
    cards: [originalCard, drawCard()],
    bet: hand.bet,
    status: splitAces ? 'stood' : 'playing',
    outcome: null,
    isSplitAce: splitAces,
    isSplitHand: true,
    isDoubled: false,
  });

  return [makeHand(hand.cards[0]), makeHand(hand.cards[1])];
};

export const findNextPlayableHand = (
  spots,
  startSpotIndex = 0,
  startHandIndex = 0,
  includeCurrent = false,
) => {
  for (let spotIndex = startSpotIndex; spotIndex < spots.length; spotIndex += 1) {
    const firstHandIndex = spotIndex === startSpotIndex
      ? startHandIndex + (includeCurrent ? 0 : 1)
      : 0;

    for (let handIndex = firstHandIndex; handIndex < spots[spotIndex].subHands.length; handIndex += 1) {
      if (spots[spotIndex].subHands[handIndex].status === 'playing') {
        return { spotIndex, handIndex };
      }
    }
  }

  return null;
};
