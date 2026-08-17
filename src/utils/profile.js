const PROFILE_KEY = 'count-lab-profile-v1';

export const DEFAULT_PROFILE = {
  bestSessionPnl: 0,
  bestStreak: 0,
  biggestWin: 0,
  currentStreak: 0,
  decisions: 0,
  drillAttempts: 0,
  drillExact: 0,
  fullTableCasinoRounds: 0,
  handsPlayed: 0,
  mistakes: 0,
  sessions: 1,
  shoesCompleted: 0,
  xp: 0,
};

export const XP_REWARDS = {
  correctDecision: 3,
  drillClose: 15,
  drillExact: 40,
  hand: 5,
  shoe: 30,
};

export const RANKS = [
  { minXp: 0, title: 'Tourist' },
  { minXp: 250, title: 'Ploppy' },
  { minXp: 750, title: 'Basic Strategist' },
  { minXp: 2000, title: 'Card Counter' },
  { minXp: 5000, title: 'Advantage Player' },
  { minXp: 10000, title: 'Backroom Regular' },
  { minXp: 20000, title: "Pit Boss's Nightmare" },
  { minXp: 40000, title: 'Team Captain' },
];

export const ACHIEVEMENTS = [
  { id: 'first-hand', title: 'Seat taken', description: 'Play your first hand.', unlocked: p => p.handsPlayed >= 1 },
  { id: 'century', title: 'Century', description: 'Play 100 hands.', unlocked: p => p.handsPlayed >= 100 },
  { id: 'grinder', title: 'Grinder', description: 'Play 1,000 hands.', unlocked: p => p.handsPlayed >= 1000 },
  { id: 'sharp', title: 'Sharp', description: '95% strategy accuracy over 200+ decisions.', unlocked: p => p.decisions >= 200 && (p.decisions - p.mistakes) / p.decisions >= 0.95 },
  { id: 'flawless-fifty', title: 'Flawless fifty', description: '50 correct decisions in a row.', unlocked: p => p.bestStreak >= 50 },
  { id: 'eagle-eye', title: 'Eagle eye', description: 'Call the running count exactly 10 times at the shuffle.', unlocked: p => p.drillExact >= 10 },
  { id: 'shoe-master', title: 'Shoe master', description: 'Play through 25 shoes.', unlocked: p => p.shoesCompleted >= 25 },
  { id: 'heater', title: 'Heater', description: 'Finish a session up $500 or more.', unlocked: p => p.bestSessionPnl >= 500 },
  { id: 'big-hand', title: 'Big hand', description: 'Win $200 or more on a single hand.', unlocked: p => p.biggestWin >= 200 },
  { id: 'full-table', title: 'Casino ready', description: 'Play 10 rounds at a full table on Casino pace.', unlocked: p => p.fullTableCasinoRounds >= 10 },
];

export const getRank = (xp) => {
  let current = RANKS[0];
  let next = null;
  for (let index = 0; index < RANKS.length; index += 1) {
    if (xp >= RANKS[index].minXp) {
      current = RANKS[index];
      next = RANKS[index + 1] || null;
    }
  }
  const progress = next
    ? Math.min(1, (xp - current.minXp) / (next.minXp - current.minXp))
    : 1;
  return { current, next, progress, level: RANKS.indexOf(current) + 1 };
};

export const normalizeProfile = (input) => {
  const profile = { ...DEFAULT_PROFILE };
  if (!input || typeof input !== 'object') return profile;
  Object.keys(DEFAULT_PROFILE).forEach((key) => {
    const value = Number(input[key]);
    if (Number.isFinite(value) && value >= 0) profile[key] = value;
  });
  return profile;
};

export const loadProfile = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };
  try {
    return normalizeProfile(JSON.parse(window.localStorage.getItem(PROFILE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_PROFILE };
  }
};

export const saveProfile = (profile) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failures; the profile just won't persist.
  }
};

export const clearProfile = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

// Pure reducers so profile updates are easy to test.
export const recordDecisions = (profile, { decisions = 0, mistakes = 0 }) => {
  if (decisions <= 0) return profile;
  const correct = Math.max(0, decisions - mistakes);
  const currentStreak = mistakes > 0 ? 0 : profile.currentStreak + correct;
  return {
    ...profile,
    bestStreak: Math.max(profile.bestStreak, currentStreak),
    currentStreak,
    decisions: profile.decisions + decisions,
    mistakes: profile.mistakes + mistakes,
    xp: profile.xp + correct * XP_REWARDS.correctDecision,
  };
};

export const recordHands = (profile, hands) => {
  if (!hands.length) return profile;
  const biggestWin = hands.reduce((best, hand) => Math.max(best, hand.net || 0), profile.biggestWin);
  return {
    ...profile,
    biggestWin,
    handsPlayed: profile.handsPlayed + hands.length,
    xp: profile.xp + hands.length * XP_REWARDS.hand,
  };
};

export const recordDrill = (profile, difference) => ({
  ...profile,
  drillAttempts: profile.drillAttempts + 1,
  drillExact: profile.drillExact + (difference === 0 ? 1 : 0),
  xp: profile.xp + (difference === 0 ? XP_REWARDS.drillExact : difference === 1 ? XP_REWARDS.drillClose : 0),
});

export const recordShoe = profile => ({
  ...profile,
  shoesCompleted: profile.shoesCompleted + 1,
  xp: profile.xp + XP_REWARDS.shoe,
});

export const recordSessionPnl = (profile, pnl) => (
  pnl > profile.bestSessionPnl ? { ...profile, bestSessionPnl: pnl } : profile
);

export const recordFullTableCasinoRound = profile => ({
  ...profile,
  fullTableCasinoRounds: profile.fullTableCasinoRounds + 1,
});

export const startNewSession = profile => ({ ...profile, sessions: profile.sessions + 1 });
