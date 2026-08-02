import { calculateTotal } from './strategyEngine';

export const isNaturalBlackjack = (hand) => (
  Boolean(hand)
  && !hand.isSplitHand
  && hand.cards.length === 2
  && calculateTotal(hand.cards) === 21
);

export const getEvenMoneyOffers = (spots) => (
  spots.flatMap((spot, spotIndex) => (
    spot.subHands
      .map((hand, handIndex) => (
        isNaturalBlackjack(hand) ? { spotIndex, handIndex } : null
      ))
      .filter(Boolean)
  ))
);

export const applyEvenMoneyDecision = (spots, offer, accepted) => (
  spots.map((spot, spotIndex) => ({
    ...spot,
    subHands: spot.subHands.map((hand, handIndex) => (
      spotIndex === offer.spotIndex && handIndex === offer.handIndex
        ? { ...hand, evenMoneyAccepted: accepted }
        : hand
    )),
  }))
);

export const getNaturalBlackjackSettlement = (hand, dealerHasBlackjack) => {
  if (!isNaturalBlackjack(hand)) return null;

  if (hand.evenMoneyAccepted) {
    return { outcome: 'win', returnAmount: hand.bet * 2 };
  }

  if (dealerHasBlackjack) {
    return { outcome: 'push', returnAmount: hand.bet };
  }

  return { outcome: 'win', returnAmount: hand.bet * 2.5 };
};

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
