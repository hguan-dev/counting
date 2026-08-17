const HISTORY_KEY = 'count-lab-history-v1';
const MAX_SESSIONS = 40;

/**
 * Star rating for a session, judged on play quality rather than luck:
 * strategy accuracy carries most of the weight, count-drill accuracy the
 * rest. Needs a minimum of decisions before any stars are awarded.
 */
export const rateSession = ({ decisions = 0, mistakes = 0, drillAttempts = 0, drillExact = 0 }) => {
  if (decisions < 10) return { stars: 0, score: 0, reason: 'Play at least 10 decisions to be rated.' };
  const accuracy = (decisions - mistakes) / decisions;
  const drillRate = drillAttempts > 0 ? drillExact / drillAttempts : null;
  const score = drillRate === null ? accuracy : accuracy * 0.8 + drillRate * 0.2;
  const percent = Math.round(score * 100);
  if (score >= 0.95) return { stars: 3, score: percent, reason: 'Near-perfect play.' };
  if (score >= 0.85) return { stars: 2, score: percent, reason: 'Solid play with a few leaks.' };
  return { stars: 1, score: percent, reason: 'Keep drilling basic strategy.' };
};

export const summarizeSession = ({
  buyIns = 0,
  countDrillStats = { attempts: 0, exact: 0 },
  decisions = 0,
  endedAt = null,
  hands = [],
  id = null,
  mistakes = 0,
  rules = null,
  startedAt = null,
}) => {
  const pnl = hands.length ? hands[hands.length - 1].cumulativePnl : 0;
  const rating = rateSession({
    decisions,
    drillAttempts: countDrillStats.attempts,
    drillExact: countDrillStats.exact,
    mistakes,
  });
  const wins = hands.filter(hand => hand.net > 0).length;
  const peak = hands.reduce((best, hand) => Math.max(best, hand.cumulativePnl), 0);
  const trough = hands.reduce((worst, hand) => Math.min(worst, hand.cumulativePnl), 0);
  return {
    accuracy: decisions ? Math.round(((decisions - mistakes) / decisions) * 100) : 0,
    buyIns,
    countDrillStats,
    decisions,
    endedAt,
    hands,
    id: id || `session-${startedAt || Date.now()}`,
    mistakes,
    peak,
    pnl,
    rating,
    rules,
    startedAt,
    trough,
    winRate: hands.length ? Math.round((wins / hands.length) * 100) : 0,
  };
};

export const loadSessionHistory = () => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && Array.isArray(item.hands)) : [];
  } catch {
    return [];
  }
};

export const saveSessionHistory = (history) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_SESSIONS)));
  } catch {
    // Storage full or blocked; history simply won't persist.
  }
};

export const summarizeHistory = (history) => {
  const rated = history.filter(session => session.rating?.stars > 0);
  const totalHands = history.reduce((sum, session) => sum + session.hands.length, 0);
  const totalDecisions = history.reduce((sum, session) => sum + (session.decisions || 0), 0);
  const totalMistakes = history.reduce((sum, session) => sum + (session.mistakes || 0), 0);
  return {
    averageStars: rated.length ? rated.reduce((sum, session) => sum + session.rating.stars, 0) / rated.length : 0,
    bestPnl: history.reduce((best, session) => Math.max(best, session.pnl || 0), 0),
    lifetimeAccuracy: totalDecisions ? Math.round(((totalDecisions - totalMistakes) / totalDecisions) * 100) : 0,
    sessions: history.length,
    threeStar: history.filter(session => session.rating?.stars === 3).length,
    totalHands,
    totalPnl: history.reduce((sum, session) => sum + (session.pnl || 0), 0),
  };
};
