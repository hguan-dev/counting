import { describe, expect, test } from 'vitest';
import {
  ACHIEVEMENTS,
  DEFAULT_PROFILE,
  getRank,
  normalizeProfile,
  RANKS,
  recordDecisions,
  recordDrill,
  recordHands,
  recordSessionPnl,
  recordShoe,
  XP_REWARDS,
} from './profile';

describe('player profile', () => {
  test('ranks climb with XP and report progress to the next rank', () => {
    expect(getRank(0).current.title).toBe('Tourist');
    expect(getRank(0).next.title).toBe('Ploppy');
    expect(getRank(999999).next).toBeNull();
    expect(getRank(999999).progress).toBe(1);
    const mid = getRank(500);
    expect(mid.current.title).toBe('Ploppy');
    expect(mid.progress).toBeCloseTo(0.5, 2);
    expect(RANKS.map(rank => rank.minXp)).toEqual([...RANKS.map(rank => rank.minXp)].sort((a, b) => a - b));
  });

  test('decisions track streaks and award XP only for correct plays', () => {
    let profile = recordDecisions(DEFAULT_PROFILE, { decisions: 3, mistakes: 0 });
    expect(profile.currentStreak).toBe(3);
    expect(profile.xp).toBe(3 * XP_REWARDS.correctDecision);
    profile = recordDecisions(profile, { decisions: 1, mistakes: 1 });
    expect(profile.currentStreak).toBe(0);
    expect(profile.bestStreak).toBe(3);
    expect(profile.mistakes).toBe(1);
    expect(profile.decisions).toBe(4);
  });

  test('hands, drills, shoes, and session results accumulate', () => {
    let profile = recordHands(DEFAULT_PROFILE, [{ net: 25 }, { net: 250 }, { net: -25 }]);
    expect(profile.handsPlayed).toBe(3);
    expect(profile.biggestWin).toBe(250);
    profile = recordDrill(profile, 0);
    profile = recordDrill(profile, 1);
    profile = recordDrill(profile, 4);
    expect(profile.drillAttempts).toBe(3);
    expect(profile.drillExact).toBe(1);
    profile = recordShoe(profile);
    expect(profile.shoesCompleted).toBe(1);
    profile = recordSessionPnl(profile, 600);
    profile = recordSessionPnl(profile, 100);
    expect(profile.bestSessionPnl).toBe(600);
    expect(profile.xp).toBe(3 * XP_REWARDS.hand + XP_REWARDS.drillExact + XP_REWARDS.drillClose + XP_REWARDS.shoe);
  });

  test('achievements unlock from profile stats', () => {
    const fresh = ACHIEVEMENTS.filter(a => a.unlocked(DEFAULT_PROFILE));
    expect(fresh).toHaveLength(0);
    const veteran = {
      ...DEFAULT_PROFILE,
      bestSessionPnl: 800,
      bestStreak: 60,
      biggestWin: 300,
      decisions: 400,
      drillExact: 12,
      fullTableCasinoRounds: 10,
      handsPlayed: 1200,
      mistakes: 10,
      shoesCompleted: 30,
    };
    expect(ACHIEVEMENTS.every(a => a.unlocked(veteran))).toBe(true);
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  test('normalizeProfile ignores junk', () => {
    expect(normalizeProfile(null)).toEqual(DEFAULT_PROFILE);
    expect(normalizeProfile({ xp: -5, handsPlayed: 'nope', decisions: 12 })).toEqual({ ...DEFAULT_PROFILE, decisions: 12 });
  });
});
