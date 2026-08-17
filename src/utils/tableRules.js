export const DEFAULT_RULES = {
  blackjackPayout: 1.5,
  dealerHitsSoft17: true,
  decks: 6,
  doubleAfterSplit: true,
  lateSurrender: true,
  penetration: 0.75,
};

export const DECK_OPTIONS = [1, 2, 4, 6, 8];
export const PENETRATION_OPTIONS = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85];
export const PAYOUT_OPTIONS = [
  { label: '3:2', value: 1.5 },
  { label: '6:5', value: 1.2 },
];

export const normalizeRules = (input) => {
  const rules = { ...DEFAULT_RULES, ...(input && typeof input === 'object' ? input : {}) };
  return {
    blackjackPayout: PAYOUT_OPTIONS.some(option => option.value === rules.blackjackPayout)
      ? rules.blackjackPayout
      : DEFAULT_RULES.blackjackPayout,
    dealerHitsSoft17: Boolean(rules.dealerHitsSoft17),
    decks: DECK_OPTIONS.includes(rules.decks) ? rules.decks : DEFAULT_RULES.decks,
    doubleAfterSplit: Boolean(rules.doubleAfterSplit),
    lateSurrender: Boolean(rules.lateSurrender),
    penetration: PENETRATION_OPTIONS.includes(rules.penetration)
      ? rules.penetration
      : DEFAULT_RULES.penetration,
  };
};

export const formatPayout = payout => (payout === 1.2 ? '6:5' : '3:2');

export const describeRules = (rules) => [
  `${rules.decks} deck${rules.decks === 1 ? '' : 's'}`,
  rules.dealerHitsSoft17 ? 'H17' : 'S17',
  rules.doubleAfterSplit ? 'DAS' : 'no DAS',
  rules.lateSurrender ? 'LS' : 'no LS',
  `BJ ${formatPayout(rules.blackjackPayout)}`,
  `${Math.round(rules.penetration * 100)}% pen`,
].join(' · ');

// Base house edge (percent, positive favors the house) for basic strategy
// against S17, DAS, no surrender, 3:2 — then rule adjustments layered on.
// Figures follow the commonly published effects-of-rules tables.
const BASE_HOUSE_EDGE_BY_DECKS = { 1: 0.02, 2: 0.2, 4: 0.36, 6: 0.41, 8: 0.44 };

export const getHouseEdgePercent = (rules) => {
  let edge = BASE_HOUSE_EDGE_BY_DECKS[rules.decks] ?? 0.41;
  if (rules.dealerHitsSoft17) edge += 0.22;
  if (!rules.doubleAfterSplit) edge += 0.14;
  if (rules.lateSurrender) edge -= rules.dealerHitsSoft17 ? 0.09 : 0.08;
  if (rules.blackjackPayout === 1.2) edge += 1.39;
  return Math.round(edge * 100) / 100;
};

// Hi-Lo player advantage gained per true count point, in percent.
export const EDGE_PER_TRUE_COUNT = 0.5;

export const getPlayerEdgePercent = (rules, trueCount) => (
  -getHouseEdgePercent(rules) + EDGE_PER_TRUE_COUNT * trueCount
);
