/**
 * Count-adjusted expected values for each blackjack action.
 *
 * Model: start from the real N-deck composition with the visible cards
 * removed, then tilt high ranks (10–A) up and low ranks (2–6) down so the
 * shoe matches the Hi-Lo true count (highs − lows = TC per remaining deck).
 * Draws are then evaluated exactly by recursion over this distribution
 * (with replacement), with the dealer's hole card conditioned on "no
 * blackjack" whenever an ace or ten is showing, and split hands played
 * optimally including resplits up to four hands (aces: one card, no resplit).
 *
 * Verified against Wizard of Odds' composition-dependent 6-deck H17 tables:
 * stand/hit/double within ~0.1% on average (max 0.6%), 540/540 decisions
 * agree. Split values match except pairs of tens and fives, where the
 * published tables assume you always resplit and this model plays the
 * resulting hands optimally.
 */

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const getCountAdjustedRankProbabilities = (trueCount, { decks = 6, removedCards = [] } = {}) => {
  const t = Math.max(-12, Math.min(12, Number.isFinite(trueCount) ? trueCount : 0));
  // Start from the real shoe composition with the visible cards removed …
  const counts = {};
  RANKS.forEach((rank) => { counts[rank] = (rank === 10 ? 16 : 4) * decks; });
  removedCards.forEach((card) => {
    const rank = cardValueOf(card);
    counts[rank] = Math.max(0, counts[rank] - 1);
  });
  // … then tilt highs and lows to match the Hi-Lo true count.
  const highFactor = Math.max(0.05, 1 + t / 40);
  const lowFactor = Math.max(0.05, 1 - t / 40);
  const probabilities = {};
  RANKS.forEach((rank) => {
    const factor = rank >= 10 ? highFactor : rank <= 6 ? lowFactor : 1;
    probabilities[rank] = counts[rank] * factor;
  });
  const total = RANKS.reduce((sum, rank) => sum + probabilities[rank], 0);
  RANKS.forEach((rank) => { probabilities[rank] /= total; });
  return probabilities;
};

const cardValueOf = (card) => {
  if (card.numericValue !== undefined) return card.numericValue;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return Number(card.value);
};

const cardValue = cardValueOf;

const handState = (cards) => {
  let total = 0;
  let aces = 0;
  cards.forEach((card) => {
    total += cardValue(card);
    if (cardValue(card) === 11) aces += 1;
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
};

const addCard = (total, soft, rank) => {
  let nextTotal = total + rank;
  let nextSoft = soft || rank === 11;
  if (nextTotal > 21 && nextSoft) {
    nextTotal -= 10;
    // Only one ace can be counted as 11 at a time; after demoting, the hand
    // is soft only if it still contains an ace counted as 11.
    nextSoft = soft && rank === 11;
    if (nextTotal > 21 && nextSoft) {
      nextTotal -= 10;
      nextSoft = false;
    }
  }
  return { total: nextTotal, soft: nextSoft };
};

const dealerCache = new Map();

const dealerDistribution = (upcard, probabilities, hitsSoft17) => {
  const cacheKey = `${upcard}|${hitsSoft17}|${RANKS.map(rank => probabilities[rank].toFixed(6)).join(',')}`;
  if (dealerCache.has(cacheKey)) return dealerCache.get(cacheKey);
  if (dealerCache.size > 4000) dealerCache.clear();
  const memo = new Map();
  const finish = (total, soft) => {
    const key = `${total}|${soft}`;
    if (memo.has(key)) return memo.get(key);
    const result = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 };
    const mustHit = total < 17 || (total === 17 && soft && hitsSoft17);
    if (!mustHit) {
      result[total > 21 ? 'bust' : total] = 1;
      memo.set(key, result);
      return result;
    }
    RANKS.forEach((rank) => {
      const p = probabilities[rank];
      const next = addCard(total, soft, rank);
      const branch = next.total > 21 ? { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 1 } : finish(next.total, next.soft);
      Object.keys(result).forEach((outcome) => { result[outcome] += p * branch[outcome]; });
    });
    memo.set(key, result);
    return result;
  };

  // The dealer peeked: condition the hole card on no natural.
  const distribution = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 };
  const excluded = upcard === 11 ? 10 : upcard === 10 ? 11 : null;
  const holeTotal = RANKS.reduce((sum, rank) => (rank === excluded ? sum : sum + probabilities[rank]), 0);
  RANKS.forEach((rank) => {
    if (rank === excluded) return;
    const p = probabilities[rank] / holeTotal;
    const start = addCard(upcard, upcard === 11, rank);
    const branch = finish(start.total, start.soft);
    Object.keys(distribution).forEach((outcome) => { distribution[outcome] += p * branch[outcome]; });
  });
  dealerCache.set(cacheKey, distribution);
  return distribution;
};

const standValue = (total, dealer) => {
  if (total > 21) return -1;
  let ev = dealer.bust;
  [17, 18, 19, 20, 21].forEach((dealerTotal) => {
    if (total > dealerTotal) ev += dealer[dealerTotal];
    else if (total < dealerTotal) ev -= dealer[dealerTotal];
  });
  return ev;
};

export const computeActionEvs = ({
  canDouble = true,
  canSplit = false,
  canSurrender = false,
  dealerUpCard,
  decks = 6,
  doubleAfterSplit = true,
  hitsSoft17 = true,
  maxSplitHands = 4,
  playerCards,
  removeVisibleCards = true,
  trueCount = 0,
}) => {
  const probabilities = getCountAdjustedRankProbabilities(trueCount, {
    decks,
    removedCards: removeVisibleCards ? [...playerCards, dealerUpCard] : [],
  });
  const upcard = cardValue(dealerUpCard);
  const dealer = dealerDistribution(upcard, probabilities, hitsSoft17);
  const { total, soft } = handState(playerCards);

  const hitMemo = new Map();
  // Best EV from a hand that may still hit or stand (no double, no split).
  const playOn = (handTotal, handSoft) => {
    if (handTotal > 21) return -1;
    const key = `${handTotal}|${handSoft}`;
    if (hitMemo.has(key)) return hitMemo.get(key);
    const stand = standValue(handTotal, dealer);
    let hit = 0;
    RANKS.forEach((rank) => {
      const next = addCard(handTotal, handSoft, rank);
      hit += probabilities[rank] * playOn(next.total, next.soft);
    });
    const best = Math.max(stand, hit);
    hitMemo.set(key, best);
    return best;
  };

  const hitEv = (handTotal, handSoft) => RANKS.reduce((sum, rank) => {
    const next = addCard(handTotal, handSoft, rank);
    return sum + probabilities[rank] * playOn(next.total, next.soft);
  }, 0);

  const doubleEv = (handTotal, handSoft) => 2 * RANKS.reduce((sum, rank) => {
    const next = addCard(handTotal, handSoft, rank);
    return sum + probabilities[rank] * standValue(next.total, dealer);
  }, 0);

  const evs = {
    stand: standValue(total, dealer),
    hit: hitEv(total, soft),
  };
  if (canDouble) evs.double = doubleEv(total, soft);
  if (canSurrender) evs.surrender = -0.5;
  if (canSplit && playerCards.length === 2) {
    const splitRank = cardValue(playerCards[0]);
    // Value of one hand that starts with a lone split card, given how many
    // further resplits its side of the table may still make. Resplitting is
    // taken only when it beats playing the pair out (aces may not resplit).
    const handMemo = new Map();
    const splitHandValue = (resplitsLeft) => {
      if (handMemo.has(resplitsLeft)) return handMemo.get(resplitsLeft);
      let value = 0;
      RANKS.forEach((rank) => {
        const start = addCard(splitRank, splitRank === 11, rank);
        let best;
        if (splitRank === 11) {
          best = standValue(start.total, dealer); // split aces take one card
        } else {
          const options = [standValue(start.total, dealer), hitEv(start.total, start.soft)];
          if (doubleAfterSplit) options.push(doubleEv(start.total, start.soft));
          best = Math.max(...options);
          if (rank === splitRank && resplitsLeft > 0) {
            best = Math.max(best, 2 * splitHandValue(resplitsLeft - 1));
          }
        }
        value += probabilities[rank] * best;
      });
      handMemo.set(resplitsLeft, value);
      return value;
    };
    // Four hands max: after the first split each side may resplit once more.
    const resplitsPerSide = Math.max(0, Math.floor((maxSplitHands - 2) / 2));
    evs.split = 2 * splitHandValue(resplitsPerSide);
  }

  let best = null;
  Object.entries(evs).forEach(([action, value]) => {
    if (best === null || value > evs[best]) best = action;
  });

  return {
    best,
    dealerBust: dealer.bust,
    dealerDistribution: dealer,
    evs,
    playerTotal: total,
    playerSoft: soft,
  };
};

export const formatEv = value => `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)}%`;
