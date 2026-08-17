/**
 * Count-adjusted expected values for each blackjack action.
 *
 * Model: an "infinite shoe" whose rank probabilities are shifted by the Hi-Lo
 * true count. With TC = t, the remaining shoe holds (highs − lows) = t per
 * remaining deck; assuming neutral cards (7–9) are dealt in proportion, each
 * of the five high ranks (10, J, Q, K, A) has probability (40 + t) / 520 and
 * each of the five low ranks (2–6) has (40 − t) / 520 per card. Player and
 * dealer draws are then evaluated exactly by recursion over this
 * distribution, with the dealer's hole card conditioned on "no blackjack"
 * (the dealer peeks) whenever an ace or ten is showing.
 */

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const getCountAdjustedRankProbabilities = (trueCount) => {
  const t = Math.max(-12, Math.min(12, Number.isFinite(trueCount) ? trueCount : 0));
  const low = Math.max(0.004, (40 - t) / 520);
  const high = Math.max(0.004, (40 + t) / 520);
  const neutral = 4 / 52;
  const probabilities = {
    2: low, 3: low, 4: low, 5: low, 6: low,
    7: neutral, 8: neutral, 9: neutral,
    10: high * 4,
    11: high,
  };
  const total = RANKS.reduce((sum, rank) => sum + probabilities[rank], 0);
  RANKS.forEach((rank) => { probabilities[rank] /= total; });
  return probabilities;
};

const cardValue = (card) => {
  if (card.numericValue !== undefined) return card.numericValue;
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return Number(card.value);
};

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

const dealerDistribution = (upcard, probabilities, hitsSoft17) => {
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
  doubleAfterSplit = true,
  hitsSoft17 = true,
  playerCards,
  trueCount = 0,
}) => {
  const probabilities = getCountAdjustedRankProbabilities(trueCount);
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
    let perHand = 0;
    RANKS.forEach((rank) => {
      const start = addCard(splitRank, splitRank === 11, rank);
      let value;
      if (splitRank === 11) {
        value = standValue(start.total, dealer); // split aces take one card
      } else {
        const options = [standValue(start.total, dealer), hitEv(start.total, start.soft)];
        if (doubleAfterSplit) options.push(doubleEv(start.total, start.soft));
        value = Math.max(...options);
      }
      perHand += probabilities[rank] * value;
    });
    evs.split = 2 * perHand;
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
