/**
 * Per-achievement unlock conditions — Spec #46 Requirement 8
 *
 * One test per achievement reported as having zero unlocks over 40+ cycles,
 * asserting it now evaluates true when its stated condition is met. These are
 * `evaluateTrigger()` unit tests: all nine gate on either the cached robot or the
 * battle event payload, so none needs a database.
 *
 * **Validates: Requirements 8.24, 8.25**
 */

import { evaluateTrigger } from '../../src/services/achievement/triggerEvaluator';
import { ACHIEVEMENTS, type AchievementDefinition } from '../../src/config/achievements';
import type { AchievementEvent } from '../../src/services/achievement/achievementTypes';

function achievement(id: string): AchievementDefinition {
  const found = ACHIEVEMENTS.find(a => a.id === id);
  if (!found) throw new Error(`Achievement ${id} not found`);
  return found;
}

/** Minimal battle_complete event. Fields default to a plain non-qualifying win. */
function battleEvent(data: Record<string, unknown> = {}): AchievementEvent {
  return {
    type: 'battle_complete',
    data: {
      won: true,
      battleType: 'league_1v1',
      finalHpPercent: 50,
      eloChange: 32,
      subjectEloBefore: 1000,
      opponentEloBefore: 1000,
      ...data,
    },
  };
}

/** Cached robot with every counter at zero unless overridden. */
function robot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    wins: 0,
    losses: 0,
    kills: 0,
    elo: 1000,
    fame: 0,
    totalBattles: 0,
    kothWins: 0,
    totalTagTeamWins: 0,
    totalLeague2v2Wins: 0,
    totalLeague3v3Wins: 0,
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
    currentWinStreak: 0,
    currentLoseStreak: 0,
    ...overrides,
  };
}

const user = { prestige: 0, currency: 0 } as Record<string, unknown>;

const evaluate = (id: string, cachedRobot: Record<string, unknown> | null, event: AchievementEvent) =>
  evaluateTrigger(achievement(id), 1, 1, event, cachedRobot, user);

// ─── Cause A: team-mode win counters ────────────────────────────────

describe('L16 Dynamic Duo — 40 tag team wins', () => {
  it('unlocks at the threshold', async () => {
    await expect(evaluate('L16', robot({ totalTagTeamWins: 40 }), battleEvent())).resolves.toBe(true);
  });

  it('does not unlock one win short', async () => {
    await expect(evaluate('L16', robot({ totalTagTeamWins: 39 }), battleEvent())).resolves.toBe(false);
  });

  it('does not unlock at zero, which is what a missing standing used to resolve to', async () => {
    await expect(evaluate('L16', robot({ totalTagTeamWins: 0 }), battleEvent())).resolves.toBe(false);
  });
});

describe('L19 Twins! — 25 2v2 league wins', () => {
  it('unlocks at the threshold', async () => {
    await expect(evaluate('L19', robot({ totalLeague2v2Wins: 25 }), battleEvent())).resolves.toBe(true);
  });

  it('does not unlock one win short', async () => {
    await expect(evaluate('L19', robot({ totalLeague2v2Wins: 24 }), battleEvent())).resolves.toBe(false);
  });
});

describe('L21 Voltron — 25 3v3 league wins', () => {
  it('unlocks at the threshold', async () => {
    await expect(evaluate('L21', robot({ totalLeague3v3Wins: 25 }), battleEvent())).resolves.toBe(true);
  });

  it('does not unlock one win short', async () => {
    await expect(evaluate('L21', robot({ totalLeague3v3Wins: 24 }), battleEvent())).resolves.toBe(false);
  });

  it('is not satisfied by 2v2 wins', async () => {
    await expect(
      evaluate('L21', robot({ totalLeague2v2Wins: 99, totalLeague3v3Wins: 0 }), battleEvent()),
    ).resolves.toBe(false);
  });
});

// ─── Cause B: the Opponent_Elo_Gap ──────────────────────────────────

describe('C11 Never Tell Me the Odds — beat an opponent 150+ ELO above you', () => {
  it('unlocks when the opponent was exactly 150 ELO above', async () => {
    await expect(
      evaluate('C11', robot(), battleEvent({ subjectEloBefore: 1000, opponentEloBefore: 1150 })),
    ).resolves.toBe(true);
  });

  it('unlocks on a large gap', async () => {
    await expect(
      evaluate('C11', robot(), battleEvent({ subjectEloBefore: 900, opponentEloBefore: 1400 })),
    ).resolves.toBe(true);
  });

  it('does not unlock when the gap is one short of the threshold', async () => {
    await expect(
      evaluate('C11', robot(), battleEvent({ subjectEloBefore: 1000, opponentEloBefore: 1149 })),
    ).resolves.toBe(false);
  });

  it('does not unlock on a loss against a much stronger opponent', async () => {
    await expect(
      evaluate('C11', robot(), battleEvent({ won: false, subjectEloBefore: 1000, opponentEloBefore: 1400 })),
    ).resolves.toBe(false);
  });

  it('does not unlock when the subject outrated the opponent', async () => {
    await expect(
      evaluate('C11', robot(), battleEvent({ subjectEloBefore: 1400, opponentEloBefore: 1000 })),
    ).resolves.toBe(false);
  });

  it('regression: a win whose ELO change is 32 but whose opponent gap is below the threshold does not unlock', async () => {
    // This is the exact shape the old code accepted as a 32-point "eloDiff" and
    // rejected as below 150 — proving the trigger read the wrong field. It must
    // stay rejected now, but for the right reason.
    await expect(
      evaluate('C11', robot(), battleEvent({ eloChange: 32, subjectEloBefore: 1000, opponentEloBefore: 1010 })),
    ).resolves.toBe(false);
  });

  it('is still restricted to the two 1v1 modes', async () => {
    for (const battleType of ['koth', 'grand_melee', 'league_2v2', 'league_3v3', 'tag_team']) {
      await expect(
        evaluate('C11', robot(), battleEvent({ battleType, subjectEloBefore: 1000, opponentEloBefore: 1400 })),
      ).resolves.toBe(false);
    }
  });

  it('unlocks in tournament_1v1 as well as league_1v1', async () => {
    await expect(
      evaluate('C11', robot(), battleEvent({ battleType: 'tournament_1v1', subjectEloBefore: 1000, opponentEloBefore: 1400 })),
    ).resolves.toBe(true);
  });
});

// ─── Cause C: the Grand Melee counters ──────────────────────────────

describe('L26 Real Steel — win 1 Grand Melee', () => {
  it('unlocks on the first win', async () => {
    await expect(
      evaluate('L26', robot({ grandMeleeWins: 1 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(true);
  });

  it('does not unlock with no wins', async () => {
    await expect(
      evaluate('L26', robot({ grandMeleeWins: 0 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(false);
  });
});

describe('L27 The Hunger Bots — win 5 Grand Melee matches', () => {
  it('unlocks at 5', async () => {
    await expect(
      evaluate('L27', robot({ grandMeleeWins: 5 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(true);
  });

  it('does not unlock at 4', async () => {
    await expect(
      evaluate('L27', robot({ grandMeleeWins: 4 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(false);
  });
});

describe('L28 Omega Supreme — win 20 Grand Melee matches', () => {
  it('unlocks at 20', async () => {
    await expect(
      evaluate('L28', robot({ grandMeleeWins: 20 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(true);
  });

  it('does not unlock at 19', async () => {
    await expect(
      evaluate('L28', robot({ grandMeleeWins: 19 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(false);
  });
});

describe('L29 Cockroach Protocol — 10 Grand Melee top-3 finishes', () => {
  it('unlocks at 10', async () => {
    await expect(
      evaluate('L29', robot({ grandMeleeTop3: 10 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(true);
  });

  it('does not unlock at 9', async () => {
    await expect(
      evaluate('L29', robot({ grandMeleeTop3: 9 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(false);
  });

  it('is not satisfied by wins alone when top-3 was never counted', async () => {
    await expect(
      evaluate('L29', robot({ grandMeleeWins: 20, grandMeleeTop3: 0 }), battleEvent({ battleType: 'grand_melee' })),
    ).resolves.toBe(false);
  });
});

describe('L30 Untouchable — win a Grand Melee above 75% HP', () => {
  it('unlocks on placement 1 with HP above the threshold', async () => {
    await expect(
      evaluate('L30', robot(), battleEvent({ battleType: 'grand_melee', placement: 1, finalHpPercent: 80 })),
    ).resolves.toBe(true);
  });

  it('does not unlock at exactly the threshold, since the condition is "more than"', async () => {
    await expect(
      evaluate('L30', robot(), battleEvent({ battleType: 'grand_melee', placement: 1, finalHpPercent: 75 })),
    ).resolves.toBe(false);
  });

  it('does not unlock below the threshold', async () => {
    await expect(
      evaluate('L30', robot(), battleEvent({ battleType: 'grand_melee', placement: 1, finalHpPercent: 40 })),
    ).resolves.toBe(false);
  });

  it('does not unlock on a top-3 finish that is not first', async () => {
    await expect(
      evaluate('L30', robot(), battleEvent({ battleType: 'grand_melee', placement: 2, finalHpPercent: 95 })),
    ).resolves.toBe(false);
  });

  it('does not unlock in another mode, even on a healthy win', async () => {
    await expect(
      evaluate('L30', robot(), battleEvent({ battleType: 'league_1v1', placement: 1, finalHpPercent: 95 })),
    ).resolves.toBe(false);
  });

  it('does not unlock when placement is absent from the context', async () => {
    // Guards against an orchestrator that forgets to pass it: absent must mean
    // "not first", never "first".
    await expect(
      evaluate('L30', robot(), battleEvent({ battleType: 'grand_melee', finalHpPercent: 95 })),
    ).resolves.toBe(false);
  });
});
