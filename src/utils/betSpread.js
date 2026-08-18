import { BET_UNIT, TABLE_MAX_BET } from './betSizing';
import { getPlayerEdgePercent } from './advantageCurve';

export const SPREAD_MIN_TC = -2;
export const SPREAD_MAX_TC = 6;
export const SPREAD_TRUE_COUNTS = Array.from(
  { length: SPREAD_MAX_TC - SPREAD_MIN_TC + 1 },
  (_, index) => SPREAD_MIN_TC + index,
);

// Per-hand variance of a blackjack wager in units of bet², including the
// extra variance from doubles, splits, and 3:2 blackjacks.
export const HAND_VARIANCE = 1.33;

export const HANDS_PER_HOUR_BY_SEATS = { 0: 200, 2: 130, 4: 85 };

export const DEFAULT_BET_SPREAD = {
  '-2': 25, '-1': 25, 0: 25, 1: 25, 2: 50, 3: 100, 4: 150, 5: 200, 6: 200,
};

const clampTrueCount = trueCount => (
  Math.min(SPREAD_MAX_TC, Math.max(SPREAD_MIN_TC, Math.round(trueCount)))
);

export const normalizeBetSpread = (input) => {
  const spread = {};
  SPREAD_TRUE_COUNTS.forEach((trueCount) => {
    const raw = Number(input?.[String(trueCount)]);
    spread[String(trueCount)] = Number.isFinite(raw) && raw >= 0
      ? Math.min(TABLE_MAX_BET, Math.round(raw / BET_UNIT) * BET_UNIT)
      : DEFAULT_BET_SPREAD[String(trueCount)];
  });
  return spread;
};

export const getSpreadBet = (spread, trueCount) => (
  spread[String(clampTrueCount(trueCount))] ?? BET_UNIT
);

// Standard normal CDF via the Abramowitz–Stegun approximation.
const normalCdf = (z) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const tail = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) * poly;
  return z >= 0 ? 1 - tail : tail;
};

/**
 * Probability of each rounded true count for a shoe with the given decks and
 * penetration. The Hi-Lo running count after n cards is approximately normal
 * with variance (40/52)·n·(1 − n/N); dividing by decks remaining gives the
 * true-count spread. Averaging over every point in the dealt portion of the
 * shoe yields the frequency table.
 */
export const getTrueCountDistribution = (decks, penetration) => {
  const totalCards = decks * 52;
  const dealtCards = penetration * totalCards;
  const tagVariance = 40 / 52;
  const steps = 80;
  const distribution = Object.fromEntries(SPREAD_TRUE_COUNTS.map(tc => [String(tc), 0]));

  for (let step = 0; step < steps; step += 1) {
    const dealt = ((step + 0.5) / steps) * dealtCards;
    const decksRemaining = Math.max(0.25, (totalCards - dealt) / 52);
    const sigma = Math.sqrt(tagVariance * dealt * (1 - dealt / totalCards)) / decksRemaining;
    SPREAD_TRUE_COUNTS.forEach((tc) => {
      const lower = tc === SPREAD_MIN_TC ? -Infinity : (tc - 0.5) / sigma;
      const upper = tc === SPREAD_MAX_TC ? Infinity : (tc + 0.5) / sigma;
      const probability = sigma === 0
        ? (tc === 0 ? 1 : 0)
        : (upper === Infinity ? 1 : normalCdf(upper)) - (lower === -Infinity ? 0 : normalCdf(lower));
      distribution[String(tc)] += probability / steps;
    });
  }
  return distribution;
};

// Rounded true counts at the clamped edges represent "this count or beyond",
// so use a representative edge slightly past the boundary.
const representativeTrueCount = tc => (
  tc === SPREAD_MAX_TC ? tc + 0.6 : tc === SPREAD_MIN_TC ? tc - 0.6 : tc
);

export const evaluateBetSpread = ({
  bankroll,
  handsPerHour,
  rules,
  spread,
}) => {
  const distribution = getTrueCountDistribution(rules.decks, rules.penetration);
  let evPerHand = 0;
  let variancePerHand = 0;
  let averageBet = 0;
  let handsSatOut = 0;
  const rows = SPREAD_TRUE_COUNTS.map((tc) => {
    const probability = distribution[String(tc)];
    const bet = spread[String(tc)] ?? 0;
    const edgePercent = getPlayerEdgePercent(rules, representativeTrueCount(tc));
    const ev = bet * edgePercent / 100;
    const variance = bet * bet * HAND_VARIANCE;
    evPerHand += probability * ev;
    variancePerHand += probability * variance;
    averageBet += probability * bet;
    if (bet === 0) handsSatOut += probability;
    return { bet, edgePercent, ev, probability, trueCount: tc };
  });

  const evPerHour = evPerHand * handsPerHour;
  const sdPerHour = Math.sqrt(variancePerHand * handsPerHour);
  const n0 = evPerHand > 0 ? variancePerHand / (evPerHand * evPerHand) : Infinity;
  const riskOfRuin = evPerHand <= 0
    ? 1
    : Math.min(1, Math.exp(-2 * evPerHand * bankroll / variancePerHand));

  return {
    averageBet,
    averageEdgePercent: averageBet > 0 ? (evPerHand / averageBet) * 100 : 0,
    distribution,
    evPerHand,
    evPerHour,
    handsSatOut,
    n0,
    n0Hours: Number.isFinite(n0) ? n0 / handsPerHour : Infinity,
    riskOfRuin,
    rows,
    sdPerHour,
  };
};

/**
 * The Kelly-optimal top bet for a bankroll: at the highest count, bet
 * kellyFraction × edge / variance × bankroll. This is advice about how big the
 * ramp's top rung should be for the bankroll — the ramp shape itself comes
 * from optimizeBetSpread.
 */
export const getKellyMaxBet = ({ bankroll, kellyFraction = 0.5, rules }) => {
  const topEdge = getPlayerEdgePercent(rules, representativeTrueCount(SPREAD_MAX_TC)) / 100;
  if (topEdge <= 0) return 0;
  const raw = (kellyFraction * topEdge / HAND_VARIANCE) * bankroll;
  return Math.max(0, Math.round(raw / BET_UNIT) * BET_UNIT);
};

/**
 * Build a ramp for the rules: bets scale with the player's edge at each true
 * count (the Kelly-optimal shape), anchored so the top count gets `maxBet`
 * and non-advantage counts get the table minimum (or sit out). Rounded to the
 * table unit and never decreasing as the count rises.
 */
export const optimizeBetSpread = ({
  maxBet = 300,
  rules,
  sitOutBelow = null,
}) => {
  const cappedMax = Math.max(BET_UNIT, Math.min(TABLE_MAX_BET, Math.round(maxBet / BET_UNIT) * BET_UNIT));
  const topEdge = getPlayerEdgePercent(rules, representativeTrueCount(SPREAD_MAX_TC)) / 100;
  const spread = {};
  SPREAD_TRUE_COUNTS.forEach((tc) => {
    if (sitOutBelow !== null && tc <= sitOutBelow) {
      spread[String(tc)] = 0;
      return;
    }
    const edge = getPlayerEdgePercent(rules, representativeTrueCount(tc)) / 100;
    if (edge <= 0 || topEdge <= 0) {
      spread[String(tc)] = BET_UNIT;
      return;
    }
    const scaled = cappedMax * (edge / topEdge);
    const rounded = Math.round(scaled / BET_UNIT) * BET_UNIT;
    spread[String(tc)] = Math.min(cappedMax, Math.max(BET_UNIT, rounded));
  });
  // Never bet less at a higher count than at a lower one.
  let floor = 0;
  SPREAD_TRUE_COUNTS.forEach((tc) => {
    if (spread[String(tc)] === 0) return;
    floor = Math.max(floor, spread[String(tc)]);
    spread[String(tc)] = floor;
  });
  return spread;
};

/**
 * A random non-decreasing ramp: table minimum through +1, then random rungs
 * that never fall as the count rises, topping out at (or below) `maxBet`.
 * Useful for exploring how spread shape moves EV and risk.
 */
export const randomBetSpread = ({ maxBet = 300, sitOutBelow = null, random = Math.random }) => {
  const cappedMax = Math.max(BET_UNIT, Math.min(TABLE_MAX_BET, Math.round(maxBet / BET_UNIT) * BET_UNIT));
  const steps = Math.max(1, Math.round((cappedMax - BET_UNIT) / BET_UNIT));
  const advantageCounts = SPREAD_TRUE_COUNTS.filter(tc => tc >= 2);
  // Draw a sorted set of unit-multiples so the ramp is monotonic by construction.
  const draws = advantageCounts.map(() => Math.floor(random() * (steps + 1))).sort((a, b) => a - b);
  draws[draws.length - 1] = steps; // the top count always reaches the max bet
  const spread = {};
  SPREAD_TRUE_COUNTS.forEach((tc) => {
    if (sitOutBelow !== null && tc <= sitOutBelow) {
      spread[String(tc)] = 0;
      return;
    }
    if (tc < 2) {
      spread[String(tc)] = BET_UNIT;
      return;
    }
    const draw = draws[advantageCounts.indexOf(tc)];
    spread[String(tc)] = BET_UNIT + draw * BET_UNIT;
  });
  return spread;
};

export const formatMoney = (value, { signed = false } = {}) => {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded).toLocaleString('en-US');
  if (signed) return `${rounded < 0 ? '−' : '+'}$${abs}`;
  return `${rounded < 0 ? '−' : ''}$${abs}`;
};
