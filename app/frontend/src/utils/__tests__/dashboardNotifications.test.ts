/**
 * Unit tests for the pure dashboard notification builders.
 *
 * These cover the decision logic that used to live inside an effect in
 * DashboardPage.tsx. The page-level render tests in
 * `pages/__tests__/DashboardPage.notifications.test.tsx` still cover the wiring.
 */

import { describe, it, expect } from 'vitest';
import {
  getNextPrestigeThreshold,
  getUnlockedFacilityLevel,
} from '../../../../shared/utils/prestigeGates';
import {
  buildEmptyRosterNotifications,
  buildOnboardingReminder,
  buildPrestigeUnlockNotification,
  buildRobotReadinessNotifications,
  buildTeamCreationNotifications,
  buildTeamSubscriptionGapNotification,
  buildTierChangeNotifications,
  buildTournamentChampionNotifications,
  formatModeLabel,
  tutorialDisplayStep,
  type NotificationRobot,
  type NotificationTeam,
} from '../dashboardNotifications';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function robot(overrides: Partial<NotificationRobot> = {}): NotificationRobot {
  return { id: 1, name: 'Bot', currentHP: 100, maxHP: 100, mainWeaponId: 1, ...overrides };
}

const finishedTutorial = {
  currentStep: 9,
  hasCompletedOnboarding: true,
  onboardingSkipped: false,
};

function overviewFor(entries: { robotId: number; subs?: string[]; held?: string[]; cap?: number }[]) {
  return {
    robots: entries.map(e => ({
      robotId: e.robotId,
      subscriptions: (e.subs ?? []).map(eventType => ({ eventType })),
      heldSlots: e.held ?? [],
      cap: e.cap ?? 3,
    })),
  };
}

function readiness(input: Partial<Parameters<typeof buildRobotReadinessNotifications>[0]>) {
  return buildRobotReadinessNotifications({
    robots: [],
    subscriptionOverview: null,
    tuningStates: [],
    onboardingState: finishedTutorial,
    ...input,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

describe('tutorialDisplayStep', () => {
  it.each([
    [1, 1], [2, 1],
    [3, 2], [5, 2],
    [6, 3], [7, 3],
    [8, 4], [9, 5],
  ])('should map internal step %i to displayed step %i', (internal, displayed) => {
    expect(tutorialDisplayStep(internal)).toBe(displayed);
  });
});

describe('formatModeLabel', () => {
  it('should use the friendly label when the mode is known', () => {
    expect(formatModeLabel('league_1v1')).toBe('1v1 League');
    expect(formatModeLabel('grand_melee')).toBe('Grand Melee');
  });

  it('should fall back to the raw mode when unknown', () => {
    expect(formatModeLabel('some_future_mode')).toBe('some_future_mode');
  });
});

// ─── Empty roster ────────────────────────────────────────────────────────────

describe('buildEmptyRosterNotifications', () => {
  it('should welcome a player who has not started the tutorial', () => {
    const result = buildEmptyRosterNotifications({
      currentStep: 1,
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
    });
    expect(result.map(n => n.key)).toEqual(['onboarding-welcome', 'no-robots']);
    expect(result[0].action).toEqual({ label: 'Begin Tutorial', to: '/onboarding' });
  });

  it('should offer to resume when the tutorial is partway through', () => {
    const result = buildEmptyRosterNotifications({
      currentStep: 5,
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
    });
    expect(result.map(n => n.key)).toEqual(['onboarding-resume', 'no-robots']);
    expect(result[0].message).toBe('Tutorial in progress — step 2 of 5');
  });

  it('should show only the create-robot alert when the tutorial is complete', () => {
    expect(buildEmptyRosterNotifications(finishedTutorial).map(n => n.key)).toEqual(['no-robots']);
  });

  it('should show only the create-robot alert when the tutorial was skipped', () => {
    const result = buildEmptyRosterNotifications({
      currentStep: 3,
      hasCompletedOnboarding: false,
      onboardingSkipped: true,
    });
    expect(result.map(n => n.key)).toEqual(['no-robots']);
  });

  it('should show only the create-robot alert when onboarding state is unknown', () => {
    expect(buildEmptyRosterNotifications(null).map(n => n.key)).toEqual(['no-robots']);
  });
});

describe('buildOnboardingReminder', () => {
  it('should use the "in progress" wording even on step 1', () => {
    // Deliberate asymmetry with the empty-roster path, which greets instead.
    const result = buildOnboardingReminder({
      currentStep: 1,
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
    });
    expect(result?.message).toBe('Tutorial in progress — step 1 of 5');
  });

  it('should return null when the tutorial is finished', () => {
    expect(buildOnboardingReminder(finishedTutorial)).toBeNull();
  });
});

// ─── Readiness ladder ────────────────────────────────────────────────────────

describe('buildRobotReadinessNotifications', () => {
  it('should delegate to the empty-roster builder when there are no robots', () => {
    expect(readiness({ robots: [] }).map(n => n.key)).toEqual(['no-robots']);
  });

  it('should flag a robot with no weapon as danger and link to that robot', () => {
    const result = readiness({ robots: [robot({ id: 7, name: 'Unarmed', mainWeaponId: null })] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      key: 'readiness-no-weapon',
      variant: 'danger',
      message: 'Unarmed has no weapon equipped',
      action: { label: 'Equip Weapon', to: '/robots/7' },
    });
  });

  it('should count the remaining robots in a "+N more" suffix', () => {
    const result = readiness({
      robots: [
        robot({ id: 1, name: 'A', mainWeaponId: null }),
        robot({ id: 2, name: 'B', mainWeaponId: null }),
        robot({ id: 3, name: 'C', mainWeaponId: null }),
      ],
    });
    expect(result[0].message).toBe('A has no weapon equipped (+2 more)');
  });

  it('should not raise a subscription alert for a robot already flagged for no weapon', () => {
    const result = readiness({
      robots: [robot({ id: 1, mainWeaponId: null })],
      subscriptionOverview: overviewFor([{ robotId: 1, subs: [] }]),
    });
    expect(result.map(n => n.key)).toEqual(['readiness-no-weapon']);
  });

  it('should treat a held slot as participation rather than an empty subscription', () => {
    const result = readiness({
      robots: [robot({ id: 1 })],
      subscriptionOverview: overviewFor([{ robotId: 1, subs: [], held: ['league_1v1'], cap: 1 }]),
    });
    expect(result).toHaveLength(0);
  });

  it('should report free subscription slots, most free first', () => {
    const result = readiness({
      robots: [robot({ id: 1, name: 'OneFree' }), robot({ id: 2, name: 'TwoFree' })],
      subscriptionOverview: overviewFor([
        { robotId: 1, subs: ['league_1v1', 'koth'], cap: 3 },
        { robotId: 2, subs: ['league_1v1'], cap: 3 },
      ]),
    });
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('TwoFree has 2 subscription slots available (+1 more)');
  });

  it('should not report free slots for a robot at its cap', () => {
    const result = readiness({
      robots: [robot({ id: 1 })],
      subscriptionOverview: overviewFor([{ robotId: 1, subs: ['league_1v1'], cap: 1 }]),
    });
    expect(result).toHaveLength(0);
  });

  it('should report unallocated tuning points, most remaining first', () => {
    const result = readiness({
      robots: [robot({ id: 1, name: 'Few' }), robot({ id: 2, name: 'Many' })],
      tuningStates: [
        { robotId: 1, poolSize: 10, remaining: 1 },
        { robotId: 2, poolSize: 10, remaining: 4 },
      ],
    });
    expect(result[0].message).toBe('Many has 4 unallocated tuning points (+1 more)');
  });

  it('should ignore tuning state for a robot with no pool', () => {
    const result = readiness({
      robots: [robot({ id: 1 })],
      tuningStates: [{ robotId: 1, poolSize: 0, remaining: 0 }],
    });
    expect(result).toHaveLength(0);
  });

  it('should report damage as a percentage, most damaged first', () => {
    const result = readiness({
      robots: [
        robot({ id: 1, name: 'Scratched', currentHP: 90, maxHP: 100 }),
        robot({ id: 2, name: 'Wrecked', currentHP: 20, maxHP: 100 }),
      ],
    });
    expect(result[0]).toMatchObject({
      key: 'readiness-damaged',
      message: 'Wrecked is damaged (20% HP) (+1 more)',
      action: { label: 'Repair All', to: '/robots' },
    });
  });

  it('should order the ladder weapon, subscription, slots, tuning, damage', () => {
    const result = readiness({
      onboardingState: { currentStep: 4, hasCompletedOnboarding: false, onboardingSkipped: false },
      robots: [
        robot({ id: 1, name: 'NoWeapon', mainWeaponId: null }),
        robot({ id: 2, name: 'NoSubs' }),
        robot({ id: 3, name: 'PartialSubs' }),
        robot({ id: 4, name: 'Damaged', currentHP: 50, maxHP: 100 }),
      ],
      subscriptionOverview: overviewFor([
        { robotId: 2, subs: [] },
        { robotId: 3, subs: ['league_1v1'], cap: 3 },
        { robotId: 4, subs: ['league_1v1'], cap: 1 },
      ]),
      tuningStates: [{ robotId: 4, poolSize: 5, remaining: 2 }],
    });

    expect(result.map(n => n.key)).toEqual([
      'onboarding-resume',
      'readiness-no-weapon',
      'readiness-no-subscriptions',
      'readiness-free-slots',
      'readiness-tuning',
      'readiness-damaged',
    ]);
  });

  it('should produce unique keys so the list can be rendered without index keys', () => {
    const result = readiness({
      robots: [robot({ id: 1, mainWeaponId: null }), robot({ id: 2, currentHP: 10, maxHP: 100 })],
      tuningStates: [{ robotId: 2, poolSize: 5, remaining: 5 }],
    });
    expect(new Set(result.map(n => n.key)).size).toBe(result.length);
  });
});

// ─── Events ──────────────────────────────────────────────────────────────────

describe('buildTierChangeNotifications', () => {
  const base = { id: 1, entityType: 'robot', entityId: 1, entityName: 'Bot' };

  it('should celebrate a promotion with the mode label', () => {
    const [result] = buildTierChangeNotifications([
      { ...base, changeType: 'promotion', sourceTier: 'bronze', destinationTier: 'silver', mode: 'league_1v1' },
    ]);
    expect(result).toMatchObject({
      variant: 'success',
      icon: '🏆',
      message: 'Bot was promoted from bronze to silver in 1v1 League!',
    });
  });

  it('should mark a demotion as danger', () => {
    const [result] = buildTierChangeNotifications([
      { ...base, changeType: 'demotion', sourceTier: 'silver', destinationTier: 'bronze', mode: 'koth' },
    ]);
    expect(result).toMatchObject({
      variant: 'danger',
      icon: '📉',
      message: 'Bot was demoted from silver to bronze in KotH!',
    });
  });

  it('should omit the mode clause when no mode is given', () => {
    const [result] = buildTierChangeNotifications([
      { ...base, changeType: 'promotion', sourceTier: 'bronze', destinationTier: 'silver' },
    ]);
    expect(result.message).toBe('Bot was promoted from bronze to silver!');
  });
});

describe('buildTournamentChampionNotifications', () => {
  const base = { tournamentId: 4, tournamentName: 'Spring Cup', participantType: 'robot', winnerName: 'Bot' };

  it('should add the title detail when the win belongs to this player', () => {
    const [result] = buildTournamentChampionNotifications([{ ...base, isMyWin: true }]);
    expect(result).toMatchObject({
      message: 'Bot won Spring Cup!',
      detail: 'Championship title awarded',
      action: { label: 'View Tournament', to: '/tournaments/4' },
    });
  });

  it('should report another player\'s win without the title detail', () => {
    const [result] = buildTournamentChampionNotifications([{ ...base, isMyWin: false }]);
    expect(result.message).toBe('Bot won Spring Cup');
    expect(result.detail).toBeUndefined();
  });
});

// ─── Teams ───────────────────────────────────────────────────────────────────

function team(overrides: Partial<NotificationTeam> & { subs?: (string[] | undefined)[] } = {}): NotificationTeam {
  const size = overrides.teamSize ?? 2;
  const subs = overrides.subs ?? [];
  return {
    id: overrides.id ?? 1,
    teamName: overrides.teamName ?? 'The Duo',
    teamSize: size,
    members:
      overrides.members ??
      Array.from({ length: size }, (_, i) => ({
        robot: {
          name: `Member${i + 1}`,
          subscriptions: (subs[i] ?? []).map(eventType => ({ eventType })),
        },
      })),
  };
}

describe('buildTeamSubscriptionGapNotification', () => {
  it('should flag a partial subscription as a gap and name who is missing', () => {
    const result = buildTeamSubscriptionGapNotification([
      team({ subs: [['league_2v2', 'tag_team', 'tournament_2v2'], []] }),
    ]);
    expect(result).toMatchObject({
      variant: 'warning',
      message: 'The Duo missing 2v2 League subscription (+2 more)',
      detail: 'Member2 not subscribed',
      action: { label: 'Manage Subscriptions', to: '/booking-office' },
    });
  });

  it('should not flag a mode nobody on the team subscribes to', () => {
    // Opting the whole team out is a deliberate choice, not an oversight.
    expect(buildTeamSubscriptionGapNotification([team({ subs: [[], []] })])).toBeNull();
  });

  it('should not flag a team where everyone is subscribed', () => {
    const all = ['league_2v2', 'tag_team', 'tournament_2v2'];
    expect(buildTeamSubscriptionGapNotification([team({ subs: [all, all] })])).toBeNull();
  });

  it('should check 3v3 modes for a three-robot team', () => {
    const result = buildTeamSubscriptionGapNotification([
      team({ teamSize: 3, teamName: 'Trio', subs: [['league_3v3'], [], []] }),
    ]);
    expect(result?.message).toBe('Trio missing 3v3 League subscription');
    expect(result?.detail).toBe('Member2, Member3 not subscribed');
  });

  it('should return null for a stable with no teams', () => {
    expect(buildTeamSubscriptionGapNotification([])).toBeNull();
  });
});

describe('buildTeamCreationNotifications', () => {
  it('should suggest nothing with a single robot', () => {
    expect(buildTeamCreationNotifications(1, [])).toHaveLength(0);
  });

  it('should suggest a 2v2 team at two robots', () => {
    expect(buildTeamCreationNotifications(2, []).map(n => n.key)).toEqual(['create-team-2v2']);
  });

  it('should suggest both team sizes at three robots', () => {
    expect(buildTeamCreationNotifications(3, []).map(n => n.key)).toEqual([
      'create-team-2v2',
      'create-team-3v3',
    ]);
  });

  it('should not suggest a size the player already fields', () => {
    const result = buildTeamCreationNotifications(3, [team({ teamSize: 2 })]);
    expect(result.map(n => n.key)).toEqual(['create-team-3v3']);
  });
});

// ─── Prestige ────────────────────────────────────────────────────────────────

describe('buildPrestigeUnlockNotification', () => {
  function build(prestige: number, acknowledgedLevel = 3) {
    return buildPrestigeUnlockNotification({
      prestige,
      acknowledgedLevel,
      getUnlockedFacilityLevel,
      getNextPrestigeThreshold,
    });
  }

  it('should stay silent inside the ungated L1–L3 band', () => {
    expect(build(0)).toBeNull();
    expect(build(999)).toBeNull();
  });

  it('should announce a newly crossed gate with the next threshold', () => {
    const result = build(3500);
    expect(result).toMatchObject({
      message: 'L5 facilities unlocked',
      unlockedLevel: 5,
      action: { label: 'View Facilities', to: '/facilities' },
    });
    expect(result?.detail).toBe('Next tier (L6) requires 5,000 prestige — you have 3,500');
  });

  it('should stay silent once the level has been acknowledged', () => {
    expect(build(3500, 5)).toBeNull();
  });

  it('should announce again after crossing the next gate', () => {
    expect(build(5000, 5)?.message).toBe('L6 facilities unlocked');
  });

  it('should stay silent when every level is already unlocked', () => {
    expect(build(50_000)).toBeNull();
  });
});
