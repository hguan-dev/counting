import { Card } from '../models/Card';
import { computeActionEvs, getCountAdjustedRankProbabilities } from './actionEv';
import { getHouseEdgePercent } from './tableRules';

const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CARDS = Object.fromEntries(RANKS.map(rank => [rank, new Card('♠', rank === 11 ? 'A' : String(rank))]));
export const CURVE_MIN_TC = -4;
export const CURVE_MAX_TC = 8;

const curveCache = new Map();

/**
 * Whole-game player expectation (per unit wagered) at a true count: average
 * over every initial deal of the best available action, with naturals paid,
 * dealer naturals losing (insurance never taken), and optimal count-aware play.
 */
export const computeGameEv = (trueCount, rules) => {
  const p = getCountAdjustedRankProbabilities(trueCount, { decks: rules.decks });
  const payout = rules.blackjackPayout;
  let ev = 0;
  RANKS.forEach((a) => {
    RANKS.forEach((b) => {
      if (b < a) return;
      const pairWeight = a === b ? p[a] * p[b] : 2 * p[a] * p[b];
      RANKS.forEach((u) => {
        const weight = pairWeight * p[u];
        const playerNatural = (a === 11 && b === 10) || (a === 10 && b === 11);
        const dealerNatural = u === 11 ? p[10] : u === 10 ? p[11] : 0;
        let value;
        if (playerNatural) {
          value = (1 - dealerNatural) * payout;
        } else {
          const result = computeActionEvs({
            canSplit: a === b,
            canSurrender: rules.lateSurrender,
            dealerUpCard: CARDS[u],
            decks: rules.decks,
            doubleAfterSplit: rules.doubleAfterSplit,
            hitsSoft17: rules.dealerHitsSoft17,
            playerCards: [CARDS[a], CARDS[b]],
            trueCount,
          });
          value = -dealerNatural + (1 - dealerNatural) * result.evs[result.best];
        }
        ev += weight * value;
      });
    });
  });
  return ev;
};

const rulesKey = rules => [
  rules.decks, rules.dealerHitsSoft17, rules.doubleAfterSplit, rules.lateSurrender, rules.blackjackPayout,
].join('|');

/**
 * Player advantage (percent) at each integer true count for these rules.
 * The curve's shape comes from the EV engine; it is anchored at TC 0 to the
 * published off-the-top house edge so the headline number matches the
 * standard effects-of-rules tables.
 */
export const getAdvantageCurve = (rules) => {
  const key = rulesKey(rules);
  if (curveCache.has(key)) return curveCache.get(key);
  const raw = {};
  for (let tc = CURVE_MIN_TC; tc <= CURVE_MAX_TC; tc += 1) raw[tc] = computeGameEv(tc, rules) * 100;
  const anchor = -getHouseEdgePercent(rules) - raw[0];
  const curve = {};
  for (let tc = CURVE_MIN_TC; tc <= CURVE_MAX_TC; tc += 1) curve[tc] = raw[tc] + anchor;
  curveCache.set(key, curve);
  return curve;
};

export const getPlayerEdgePercent = (rules, trueCount) => {
  const curve = getAdvantageCurve(rules);
  const tc = Number.isFinite(trueCount) ? trueCount : 0;
  if (tc <= CURVE_MIN_TC) return curve[CURVE_MIN_TC] - (CURVE_MIN_TC - tc) * (curve[CURVE_MIN_TC + 1] - curve[CURVE_MIN_TC]);
  if (tc >= CURVE_MAX_TC) return curve[CURVE_MAX_TC] + (tc - CURVE_MAX_TC) * (curve[CURVE_MAX_TC] - curve[CURVE_MAX_TC - 1]);
  const lower = Math.floor(tc);
  const upper = Math.ceil(tc);
  if (lower === upper) return curve[lower];
  return curve[lower] + (curve[upper] - curve[lower]) * (tc - lower);
};

/** Average gain per true-count point between TC 0 and TC +4, in percent. */
export const getEdgePerTrueCount = (rules) => {
  const curve = getAdvantageCurve(rules);
  return (curve[4] - curve[0]) / 4;
};
