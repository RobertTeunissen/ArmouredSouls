/**
 * Pure notification builders for the Command Center dashboard.
 *
 * Extracted from DashboardPage.tsx so the decision logic can be reasoned about
 * and tested without a router, a store, or a DOM.
 *
 * Two rules keep these functions pure:
 *   1. They return a route string (`action.to`), never a callback. The page turns
 *      that into `onAction={() => navigate(to)}`.
 *   2. They never touch `localStorage`. Anything persisted is passed in as an
 *      argument (see `buildPrestigeUnlockNotification`).
 *
 * Ordering is expressed by the sequence of pushes inside each builder, and by the
 * order the page concatenates the builders. Both are load-bearing — the dashboard
 * shows one alert per category, highest priority first.
 */

// ─── Descriptor ──────────────────────────────────────────────────────────────

export type NotificationVariant = 'success' | 'warning' | 'danger' | 'info';

export interface NotificationAction {
  label: string;
  /** Route to navigate to. The page supplies the navigate call. */
  to: string;
}

export interface NotificationDescriptor {
  /** Stable React key, unique across the whole dashboard list. */
  key: string;
  variant: NotificationVariant;
  icon: string;
  message: string;
  detail?: string;
  action?: NotificationAction;
}

// ─── Input shapes ────────────────────────────────────────────────────────────
// Deliberately narrow: only the fields the decisions actually read. The full
// `Robot` / `TeamBattle` / `TutorialState` types satisfy these structurally.

export interface NotificationRobot {
  id: number;
  name: string;
  currentHP: number;
  maxHP: number;
  mainWeaponId: number | null;
}

export interface NotificationSubscriptionOverview {
  robots: {
    robotId: number;
    subscriptions: { eventType: string }[];
    heldSlots: string[];
    cap: number;
  }[];
}

export interface NotificationTuningState {
  robotId: number;
  poolSize: number;
  remaining: number;
}

export interface NotificationOnboardingState {
  currentStep: number;
  hasCompletedOnboarding: boolean;
  onboardingSkipped: boolean;
}

export interface NotificationTeam {
  id: number;
  teamName: string;
  teamSize: number;
  members: { robot: { name: string; subscriptions?: { eventType: string }[] } }[];
}

export interface TierChange {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: 'promotion' | 'demotion';
  sourceTier: string;
  destinationTier: string;
  mode?: string;
}

export interface RecentTournamentWinner {
  tournamentId: number;
  tournamentName: string;
  participantType: string;
  winnerName: string;
  isMyWin: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  league_1v1: '1v1 League',
  koth: 'KotH',
  grand_melee: 'Grand Melee',
  tag_team: 'Tag Team',
  league_2v2: '2v2 League',
  league_3v3: '3v3 League',
};

/** Falls back to the raw mode string for modes without a friendly label. */
export function formatModeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

/**
 * Collapse the internal tutorial step onto the 5 steps shown to the player.
 */
export function tutorialDisplayStep(currentStep: number): number {
  if (currentStep <= 2) return 1;
  if (currentStep <= 5) return 2;
  if (currentStep <= 7) return 3;
  return currentStep - 4;
}

function isTutorialUnfinished(state: NotificationOnboardingState | null): state is NotificationOnboardingState {
  return !!state && !state.hasCompletedOnboarding && !state.onboardingSkipped;
}

/** "(+2 more)" suffix, or "" for a single item. */
function moreSuffix(count: number): string {
  return count > 1 ? ` (+${count - 1} more)` : '';
}

function resumeTutorialNotification(state: NotificationOnboardingState): NotificationDescriptor {
  return {
    key: 'onboarding-resume',
    variant: 'info',
    icon: '🎓',
    message: `Tutorial in progress — step ${tutorialDisplayStep(state.currentStep)} of 5`,
    detail: 'Pick up where you left off',
    action: { label: 'Resume Tutorial', to: '/onboarding' },
  };
}

// ─── Empty roster ────────────────────────────────────────────────────────────

/**
 * Alerts shown when the stable has no robots at all.
 *
 * Note the asymmetry with `buildOnboardingReminder`: here a player still on step
 * 1 gets a "Welcome" greeting, whereas a player who already owns robots gets the
 * "Tutorial in progress" wording even on step 1. That difference is intentional
 * in the original and preserved here.
 */
export function buildEmptyRosterNotifications(
  onboardingState: NotificationOnboardingState | null,
): NotificationDescriptor[] {
  const alerts: NotificationDescriptor[] = [];

  if (isTutorialUnfinished(onboardingState)) {
    if (onboardingState.currentStep <= 1) {
      alerts.push({
        key: 'onboarding-welcome',
        variant: 'info',
        icon: '👋',
        message: 'Welcome to Armoured Souls!',
        detail: 'Start the interactive tutorial to learn the ropes in 5 guided steps',
        action: { label: 'Begin Tutorial', to: '/onboarding' },
      });
    } else {
      alerts.push(resumeTutorialNotification(onboardingState));
    }
  }

  // Always shown while the roster is empty, tutorial state notwithstanding.
  alerts.push({
    key: 'no-robots',
    variant: 'warning',
    icon: '🤖',
    message: "You don't have any robots yet",
    detail: 'Create your first robot to start competing in battles',
    action: { label: 'Create Robot', to: '/robots' },
  });

  return alerts;
}

/** Tutorial reminder for a player who already owns robots. */
export function buildOnboardingReminder(
  onboardingState: NotificationOnboardingState | null,
): NotificationDescriptor | null {
  if (!isTutorialUnfinished(onboardingState)) return null;
  return resumeTutorialNotification(onboardingState);
}

// ─── Robot readiness ladder ──────────────────────────────────────────────────

export interface RobotReadinessInput {
  robots: NotificationRobot[];
  subscriptionOverview: NotificationSubscriptionOverview | null;
  tuningStates: NotificationTuningState[];
  onboardingState: NotificationOnboardingState | null;
}

/**
 * The priority ladder. At most one alert per rung, and each rung skips robots
 * already covered by a higher one:
 *
 *   1  no weapon equipped   — cannot be scheduled at all
 *   2  no subscriptions     — has a weapon but will never be entered
 *   3a free subscription slots
 *   3b unallocated tuning points
 *   4  damaged              — repairs are cheaper at higher HP
 */
export function buildRobotReadinessNotifications(input: RobotReadinessInput): NotificationDescriptor[] {
  const { robots, subscriptionOverview, tuningStates, onboardingState } = input;

  if (robots.length === 0) {
    return buildEmptyRosterNotifications(onboardingState);
  }

  const alerts: NotificationDescriptor[] = [];

  const reminder = buildOnboardingReminder(onboardingState);
  if (reminder) alerts.push(reminder);

  // Priority 1: no weapon equipped.
  const noWeaponRobots = robots.filter(r => !r.mainWeaponId);
  if (noWeaponRobots.length > 0) {
    const first = noWeaponRobots[0];
    alerts.push({
      key: 'readiness-no-weapon',
      variant: 'danger',
      icon: '🔧',
      message: `${first.name} has no weapon equipped${moreSuffix(noWeaponRobots.length)}`,
      detail: 'Cannot be scheduled for any match without a weapon',
      action: { label: 'Equip Weapon', to: `/robots/${first.id}` },
    });
  }

  if (subscriptionOverview) {
    const overviewFor = (robotId: number) =>
      subscriptionOverview.robots.find(or => or.robotId === robotId);

    // Priority 2: no subscriptions. Robots without a weapon are already covered.
    const noSubRobots = robots.filter(r => {
      if (!r.mainWeaponId) return false;
      const overview = overviewFor(r.id);
      return !!overview && overview.subscriptions.length === 0 && overview.heldSlots.length === 0;
    });
    if (noSubRobots.length > 0) {
      const first = noSubRobots[0];
      alerts.push({
        key: 'readiness-no-subscriptions',
        variant: 'danger',
        icon: '📋',
        message: `${first.name} has no event subscriptions${moreSuffix(noSubRobots.length)}`,
        detail: 'Subscribe to at least one event to enter battles',
        action: { label: 'Manage Subscriptions', to: `/robots/${first.id}` },
      });
    }

    // Priority 3a: partially subscribed — most free slots first.
    const slotsAvailable = robots
      .filter(r => !!r.mainWeaponId)
      .map(r => ({ robot: r, overview: overviewFor(r.id) }))
      .filter((entry): entry is { robot: NotificationRobot; overview: NonNullable<typeof entry.overview> } => !!entry.overview)
      .map(({ robot, overview }) => {
        const occupied = overview.subscriptions.length + overview.heldSlots.length;
        return { robot, occupied, cap: overview.cap, free: overview.cap - occupied };
      })
      .filter(entry => entry.occupied > 0 && entry.occupied < entry.cap)
      .sort((a, b) => b.free - a.free);

    if (slotsAvailable.length > 0) {
      const { robot: first, free } = slotsAvailable[0];
      alerts.push({
        key: 'readiness-free-slots',
        variant: 'warning',
        icon: '📬',
        message: `${first.name} has ${free} subscription slot${free > 1 ? 's' : ''} available${moreSuffix(slotsAvailable.length)}`,
        detail: 'Subscribe to more events to fight more often',
        action: { label: 'View Subscriptions', to: `/robots/${first.id}` },
      });
    }
  }

  // Priority 3b: unallocated tuning points — most remaining first.
  const unallocated = tuningStates
    .filter(t => t.remaining > 0 && t.poolSize > 0)
    .map(t => ({ tuning: t, robot: robots.find(r => r.id === t.robotId) }))
    .filter((entry): entry is { tuning: NotificationTuningState; robot: NotificationRobot } => !!entry.robot)
    .sort((a, b) => b.tuning.remaining - a.tuning.remaining);

  if (unallocated.length > 0) {
    const { robot: first, tuning } = unallocated[0];
    alerts.push({
      key: 'readiness-tuning',
      variant: 'info',
      icon: '🎯',
      message: `${first.name} has ${tuning.remaining} unallocated tuning point${tuning.remaining > 1 ? 's' : ''}${moreSuffix(unallocated.length)}`,
      detail: 'Allocate tuning points to boost combat performance',
      action: { label: 'Allocate Tuning', to: `/robots/${first.id}` },
    });
  }

  // Priority 4: damaged — most damaged first. Weaponless robots are covered by P1.
  const damaged = robots
    .filter(r => r.currentHP < r.maxHP && r.mainWeaponId)
    .sort((a, b) => (a.currentHP / a.maxHP) - (b.currentHP / b.maxHP));

  if (damaged.length > 0) {
    const first = damaged[0];
    const hpPercent = Math.round((first.currentHP / first.maxHP) * 100);
    alerts.push({
      key: 'readiness-damaged',
      variant: 'warning',
      icon: '🔨',
      message: `${first.name} is damaged (${hpPercent}% HP)${moreSuffix(damaged.length)}`,
      detail: 'Repair before the next battle to reduce costs',
      action: { label: 'Repair All', to: '/robots' },
    });
  }

  return alerts;
}

// ─── Events worth celebrating ────────────────────────────────────────────────

export function buildTierChangeNotifications(changes: TierChange[]): NotificationDescriptor[] {
  return changes.map(change => {
    const direction = change.changeType === 'promotion' ? 'promoted' : 'demoted';
    const modeSuffix = change.mode ? ` in ${formatModeLabel(change.mode)}` : '';
    return {
      key: `tier-change-${change.id}`,
      variant: change.changeType === 'promotion' ? 'success' : 'danger',
      icon: change.changeType === 'promotion' ? '🏆' : '📉',
      message: `${change.entityName} was ${direction} from ${change.sourceTier} to ${change.destinationTier}${modeSuffix}!`,
    };
  });
}

export function buildTournamentChampionNotifications(
  champions: RecentTournamentWinner[],
): NotificationDescriptor[] {
  return champions.map(champ => ({
    key: `champion-${champ.tournamentId}`,
    variant: 'success' as const,
    icon: '👑',
    message: champ.isMyWin
      ? `${champ.winnerName} won ${champ.tournamentName}!`
      : `${champ.winnerName} won ${champ.tournamentName}`,
    detail: champ.isMyWin ? 'Championship title awarded' : undefined,
    action: { label: 'View Tournament', to: `/tournaments/${champ.tournamentId}` },
  }));
}

// ─── Teams ───────────────────────────────────────────────────────────────────

const TEAM_MODES_2V2 = [
  { event: 'league_2v2', label: '2v2 League' },
  { event: 'tag_team', label: 'Tag Team' },
  { event: 'tournament_2v2', label: '2v2 Tournament' },
];

const TEAM_MODES_3V3 = [
  { event: 'league_3v3', label: '3v3 League' },
  { event: 'tournament_3v3', label: '3v3 Tournament' },
];

/**
 * Flags teams where *some* members are subscribed to a mode and others are not.
 *
 * A team where nobody is subscribed is a deliberate choice, not a gap, so it is
 * left alone. Only the first mismatch is surfaced, with a count of the rest.
 */
export function buildTeamSubscriptionGapNotification(
  teams: NotificationTeam[],
): NotificationDescriptor | null {
  const gaps: { team: NotificationTeam; modeLabel: string; missing: string[] }[] = [];

  for (const team of teams) {
    const modes = team.teamSize === 2 ? TEAM_MODES_2V2 : TEAM_MODES_3V3;

    for (const { event, label } of modes) {
      const isSubscribed = (member: NotificationTeam['members'][number]) =>
        !!member.robot.subscriptions?.some(s => s.eventType === event);

      const subscribedCount = team.members.filter(isSubscribed).length;
      const missing = team.members.filter(m => !isSubscribed(m)).map(m => m.robot.name);

      if (subscribedCount > 0 && missing.length > 0) {
        gaps.push({ team, modeLabel: label, missing });
      }
    }
  }

  if (gaps.length === 0) return null;

  const first = gaps[0];
  return {
    key: 'team-subscription-gap',
    variant: 'warning',
    icon: '📋',
    message: `${first.team.teamName} missing ${first.modeLabel} subscription${moreSuffix(gaps.length)}`,
    detail: `${first.missing.join(', ')} not subscribed`,
    action: { label: 'Manage Subscriptions', to: '/booking-office' },
  };
}

/** Suggests forming a team when the roster is big enough and none exists yet. */
export function buildTeamCreationNotifications(
  robotCount: number,
  teams: NotificationTeam[],
): NotificationDescriptor[] {
  const alerts: NotificationDescriptor[] = [];

  if (robotCount >= 2 && !teams.some(t => t.teamSize === 2)) {
    alerts.push({
      key: 'create-team-2v2',
      variant: 'info',
      icon: '👥',
      message: 'You can form a 2v2 team',
      detail: 'Pair two robots for 2v2 League, Tag Team, and 2v2 Tournaments',
      action: { label: 'Create Team', to: '/team-battles' },
    });
  }

  if (robotCount >= 3 && !teams.some(t => t.teamSize === 3)) {
    alerts.push({
      key: 'create-team-3v3',
      variant: 'info',
      icon: '👥',
      message: 'You can form a 3v3 team',
      detail: 'Group three robots for 3v3 League and 3v3 Tournaments',
      action: { label: 'Create Team', to: '/team-battles' },
    });
  }

  return alerts;
}

// ─── Prestige gates ──────────────────────────────────────────────────────────

export interface PrestigeUnlockInput {
  prestige: number;
  /**
   * Highest facility level the player has already acknowledged. Persisted by the
   * caller — see `useAcknowledgedPrestigeLevel`. Defaults to 3 because L1–L3 are
   * ungated and so never worth announcing.
   */
  acknowledgedLevel: number;
  getUnlockedFacilityLevel: (prestige: number) => number;
  getNextPrestigeThreshold: (prestige: number) => { level: number; required: number } | null;
}

/**
 * Announces a newly crossed facility gate, once. Returns null when every level
 * is unlocked, when the player is still inside the free L1–L3 band, or when this
 * level has already been acknowledged.
 *
 * The two gate helpers are injected so this stays a pure function of its input.
 */
export function buildPrestigeUnlockNotification(
  input: PrestigeUnlockInput,
): (NotificationDescriptor & { unlockedLevel: number }) | null {
  const { prestige, acknowledgedLevel } = input;

  const nextGate = input.getNextPrestigeThreshold(prestige);
  if (!nextGate) return null; // every level already unlocked

  const currentMax = input.getUnlockedFacilityLevel(prestige);
  if (currentMax <= 3) return null; // L1–L3 are free, nothing to announce
  if (currentMax <= acknowledgedLevel) return null; // already seen

  return {
    key: 'prestige-unlock',
    variant: 'info',
    icon: '⭐',
    message: `L${currentMax} facilities unlocked`,
    detail: `Next tier (L${nextGate.level}) requires ${nextGate.required.toLocaleString()} prestige — you have ${prestige.toLocaleString()}`,
    action: { label: 'View Facilities', to: '/facilities' },
    unlockedLevel: currentMax,
  };
}
