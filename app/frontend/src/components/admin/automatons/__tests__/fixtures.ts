/** Test data for the admin Automatons page (Spec #55, task 10.6). Shapes follow `automatonAdminApi.ts`. */
import type {
  AutomatonStatusBar,
  BlueprintView,
  CatalogueWeapon,
  DraftView,
  LibraryStrategy,
  ModePerformance,
  ProfileDetail,
  ProfileListItem,
  ProfileTurnPreview,
  StrategyComparison,
  TieredStandingsMode,
  UpgradeDryRun,
} from '../../../../utils/automatonAdminApi';
import { PLACEMENT_STANDINGS_MODES, TEAM_STANDINGS_MODES, TIERED_STANDINGS_MODES } from '@shared/utils/automatonStandingsTier';

export const EVENT_ORDER = [
  'league_2v2', 'tag_team', 'league_3v3', 'league_1v1', 'koth', 'grand_melee', 'tournament_3v3', 'tournament_1v1', 'tournament_2v2',
];

export function statusBar(overrides: Partial<AutomatonStatusBar> = {}): AutomatonStatusBar {
  return {
    program: { turnsEnabled: true, updatedAt: '2026-10-08T00:00:00.000Z' },
    lastStep: { seasonNumber: 3, trigger: 'settlement', slot: 42, label: 'Cycle 42', finishedAt: '2026-10-08T00:01:00.000Z', processed: 11, durationMs: 38_000 },
    failedCount: 0,
    needAttentionCount: 2,
    ...overrides,
  };
}

export function listItem(overrides: Partial<ProfileListItem> = {}): ProfileListItem {
  return {
    catalogueKey: 'clone-legion',
    stableName: 'Kamino Clone Legion',
    franchise: 'Star Wars — Clone Troopers',
    status: 'active',
    origin: 'catalogue',
    strategyKey: 'swarm',
    strategyVersion: 1,
    strategyDisplayName: 'Swarm',
    blueprintCount: 11,
    robots: { current: 3, target: 11 },
    credits: 412_000,
    prestige: 820,
    bestTier: 'gold',
    bestTierMode: 'league_3v3',
    lastTurn: {
      seasonNumber: 3, trigger: 'settlement', slot: 42, attempt: 1, status: 'completed', reason: null,
      creditsSpent: 96_000, creditsReceived: 0, actionCount: 1,
      savingGoal: { goalId: 'swarm.v1.04.facility.booking_office', position: 4, label: 'Booking Office', target: 2 },
      startedAt: '2026-10-08T00:00:00.000Z', finishedAt: '2026-10-08T00:00:01.000Z',
    },
    activatedAt: '2026-10-01T00:00:00.000Z',
    needAttention: [],
    ...overrides,
  };
}

export const PROFILES: ProfileListItem[] = [
  listItem(),
  listItem({
    catalogueKey: 'decepticon-armada', stableName: 'Decepticon Armada', strategyKey: 'trio', strategyDisplayName: 'Trio',
    credits: -12_400, bestTier: 'silver', bestTierMode: 'league_1v1', needAttention: [{ code: 'balance_negative', label: 'Balance negative' }],
  }),
  listItem({
    catalogueKey: 'grim-reaper', stableName: 'Grim Reaper Works', status: 'draft', strategyKey: 'generalist', strategyDisplayName: 'Generalist',
    robots: { current: 0, target: 2 }, credits: null, prestige: null, bestTier: null, bestTierMode: null, lastTurn: null, activatedAt: null,
  }),
];

/** A zero-filled per-mode entry with the mode's kind and entity type. */
export function modePerformance(mode: TieredStandingsMode, overrides: Partial<ModePerformance> = {}): ModePerformance {
  return {
    mode,
    kind: PLACEMENT_STANDINGS_MODES.includes(mode) ? 'placement' : 'head_to_head',
    entityType: TEAM_STANDINGS_MODES.includes(mode) ? 'team' : 'robot',
    stablesPlayed: 0,
    entitiesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    matches: 0,
    winPercentage: null,
    bestPlacement: null,
    lowSample: true,
    ...overrides,
  };
}

/** Six entries in display order; `overrides` per mode. */
function modes(overrides: Partial<Record<TieredStandingsMode, Partial<ModePerformance>>> = {}): ModePerformance[] {
  return TIERED_STANDINGS_MODES.map((mode) => modePerformance(mode, overrides[mode]));
}

export function blueprint(slot: number, overrides: Partial<BlueprintView> = {}): BlueprintView {
  return {
    slot,
    id: 100 + slot,
    robotName: `Robot ${slot}`,
    loadoutType: 'single',
    stance: 'balanced',
    yieldThreshold: 10,
    buildFocus: 'versatile',
    weaponPath: [{ main: 'Laser Pistol' }, { main: 'Volt Sabre' }],
    refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
    imageUrl: null,
    liveRobot: null,
    ...overrides,
  };
}

const BUILD_ORDER: ProfileDetail['strategy']['buildOrder'] = [
  { position: 1, goalId: 'swarm.v1.01.robots', type: 'robots', label: 'Robots', defaultTarget: 3, bounds: { min: 1, max: 3 }, isMax: false, buys: 'Robot chain', target: 3 },
  { position: 2, goalId: 'swarm.v1.02.facility.booking_office', type: 'facility', facilityType: 'booking_office', label: 'Booking Office', defaultTarget: 1, bounds: { min: 0, max: 6 }, isMax: false, buys: 'Booking Office levels', target: 1 },
  { position: 3, goalId: 'swarm.v1.03.attributes', type: 'attributes', label: 'Attributes', defaultTarget: 5, bounds: { min: 1, max: 10 }, isMax: false, buys: 'Attribute upgrades', target: 5 },
  { position: 4, goalId: 'swarm.v1.04.attributes', type: 'attributes', label: 'Attributes', defaultTarget: 50, bounds: { min: 50, max: 50 }, isMax: true, buys: 'Every attribute', target: 50 },
];

export function detail(overrides: Partial<ProfileDetail> = {}): ProfileDetail {
  return {
    catalogueKey: 'clone-legion',
    stableName: 'Kamino Clone Legion',
    franchise: 'Star Wars — Clone Troopers',
    backstory: 'Grown, drilled and shipped in batches.',
    status: 'active',
    origin: 'catalogue',
    activatedAt: '2026-10-01T00:00:00.000Z',
    userId: 7,
    credits: 412_000,
    prestige: 820,
    strategy: { key: 'swarm', version: 1, displayName: 'Swarm', latestVersion: 2, buildOrder: BUILD_ORDER, parametersValid: true },
    teamNames: { twoVsTwo: ['Torrent Company'], threeVsThree: ['Bad Batch'] },
    requiredTeamNames: { twoVsTwo: 1, threeVsThree: 1 },
    teams: [],
    eventOrder: [...EVENT_ORDER],
    blueprints: [
      blueprint(1, { robotName: 'CT-7567 Rex', liveRobot: { id: 1, name: 'CT-7567 Rex' } }),
      blueprint(2, { robotName: 'CC-2224 Cody', liveRobot: { id: 2, name: 'CC-2224 Cody' } }),
      blueprint(3, { robotName: 'CT-5555 Fives' }),
    ],
    registeredTeams: [],
    lastTurn: null,
    attributePlans: [{
      goalId: 'swarm.v1.03.attributes',
      robots: [{ slot: 1, robotName: 'CT-7567 Rex', buildFocus: 'versatile', groups: [{ group: 'combat', target: 5, academyLevel: 0, buysAcademy: false }] }],
      academies: [],
    }],
    buildFocusOptions: [
      { key: 'versatile', displayName: 'Versatile', description: 'No weak spots.' },
      { key: 'bruiser', displayName: 'Bruiser', description: 'A heavy hitter.' },
    ],
    ...overrides,
  };
}

export const LIBRARY: LibraryStrategy[] = [
  {
    key: 'swarm', displayName: 'Swarm', description: 'Goes wide.', latestVersion: 2, profileCount: 2,
    versions: [
      { version: 1, displayName: 'Swarm', description: 'Goes wide.', latest: false, profileCount: 2, buildOrder: BUILD_ORDER },
      { version: 2, displayName: 'Swarm', description: 'Goes wide.', latest: true, profileCount: 0, buildOrder: BUILD_ORDER },
    ],
  },
  {
    key: 'paragon', displayName: 'Paragon', description: 'Goes tall.', latestVersion: 1, profileCount: 1,
    versions: [{ version: 1, displayName: 'Paragon', description: 'Goes tall.', latest: true, profileCount: 1, buildOrder: BUILD_ORDER }],
  },
];

export function turnPreview(overrides: Partial<ProfileTurnPreview> = {}): ProfileTurnPreview {
  return {
    catalogueKey: 'clone-legion', status: 'active', strategyKey: 'swarm', strategyVersion: 1, seasonNumber: 3, phase: 'competitive',
    startBalance: 412_000, projectedEndBalance: 166_000, chargedActions: 2, stop: 'saving',
    actions: [
      { goalId: 'swarm.v1.02.facility.booking_office', position: 2, kind: 'facility_upgrade', cost: 150_000, chargedSteps: 1, detail: { facilityType: 'booking_office', toLevel: 2 } },
    ],
    goals: [
      { goalId: 'swarm.v1.01.robots', position: 1, type: 'robots', label: 'Robots', target: 3, isMax: false, status: 'done', gated: false, detail: {}, bought: { steps: 0, cost: 0 } },
      { goalId: 'swarm.v1.02.facility.booking_office', position: 2, type: 'facility', facilityType: 'booking_office', label: 'Booking Office', target: 1, isMax: false, status: 'bought', gated: false, detail: {}, bought: { steps: 1, cost: 150_000 } },
      { goalId: 'swarm.v1.03.attributes', position: 3, type: 'attributes', label: 'Attributes', target: 5, isMax: false, status: 'saving', gated: false, detail: {}, bought: { steps: 0, cost: 0 }, needed: 225_000, available: 166_000 },
      {
        goalId: 'swarm.v1.04.attributes', position: 4, type: 'attributes', label: 'Attributes', target: 50, isMax: true, status: 'waiting', gated: true, reason: 'prestige_gate',
        detail: { facilityType: 'combat_training_academy', level: 4, prestigeRequired: 1000, prestigeHeld: 820 }, bought: { steps: 0, cost: 0 },
      },
    ],
    ...overrides,
  };
}

export const COMPARISON: StrategyComparison = {
  season: { seasonNumber: 3, phase: 'competitive', cycle: 42, lengthCycles: 100, preparationDay: 0 },
  rows: [
    {
      strategyKey: 'swarm', displayName: 'Swarm', reference: false, stables: 2, robots: { average: 3.5, targetAverage: 11 },
      prestigeAverage: 910, bestTier: { tier: 'silver', stables: 2 }, creditsAverage: 296_000,
      winRate: { wins: 61, losses: 78, draws: 3, total: 142, percentage: 43 },
      modes: modes({
        league_1v1: { stablesPlayed: 2, entitiesPlayed: 5, wins: 40, losses: 38, draws: 2, matches: 80, winPercentage: 50, lowSample: true },
        koth: { stablesPlayed: 2, entitiesPlayed: 4, wins: 3, matches: 30, winPercentage: 10, bestPlacement: 1, lowSample: true },
      }),
    },
    {
      strategyKey: 'paragon', displayName: 'Paragon', reference: false, stables: 1, robots: { average: 1, targetAverage: 1 },
      prestigeAverage: 4105, bestTier: null, creditsAverage: 88_700, winRate: { wins: 0, losses: 0, draws: 0, total: 0, percentage: null },
      modes: modes(),
    },
    {
      strategyKey: null, displayName: 'Human stables', reference: true, stables: 9, robots: { average: 2.7, targetAverage: null },
      prestigeAverage: 2260, bestTier: { tier: 'gold', stables: 3 }, creditsAverage: 514_000, winRate: null,
      modes: modes({
        league_1v1: { stablesPlayed: 9, entitiesPlayed: 24, wins: 120, losses: 80, draws: 0, matches: 200, winPercentage: 60, lowSample: false },
      }),
    },
  ],
  generatedAt: '2026-10-08T00:00:00.000Z',
};

export function draftView(overrides: Partial<DraftView> = {}): DraftView {
  return {
    id: 5,
    basedOn: 'swarm.v2',
    definition: {
      schemaVersion: 1, key: 'swarm', version: 3, displayName: 'Swarm', description: 'Goes wide.',
      buildOrder: [
        { position: 1, goal: { type: 'robots' }, defaultTarget: 3, bounds: { min: 1, max: 3 } },
        { position: 2, goal: { type: 'facility', facilityType: 'booking_office' }, defaultTarget: 6, bounds: { min: 0, max: 8 } },
        { position: 3, goal: { type: 'attributes' }, defaultTarget: 'max', bounds: { min: 'max', max: 'max' } },
      ],
    },
    createdBy: 1,
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z',
    issues: [
      { rule: 'bounds_limit', message: 'Booking Office cannot go above L6.', position: 2, path: ['buildOrder', 1, 'bounds', 'max'] },
      { rule: 'required_goal_type', message: 'Every strategy needs a Tuning Bay goal with a default above 0.', path: ['buildOrder'] },
    ],
    errorCount: 2,
    ready: false,
    upgradeWarning: [],
    ...overrides,
  };
}

export function dryRun(): UpgradeDryRun {
  return {
    strategyKey: 'swarm', toVersion: 2, confirm: false,
    profiles: [
      {
        catalogueKey: 'clone-legion', stableName: 'Kamino Clone Legion', status: 'active', fromVersion: 1, toVersion: 2,
        changes: [
          { status: 'kept', type: 'robots', fromGoalId: 'swarm.v1.01.robots', toGoalId: 'swarm.v2.01.robots', position: 1, oldTarget: 3, newTarget: 3, label: 'Robots' },
          { status: 'clamped', type: 'attributes', fromGoalId: 'swarm.v1.14.attributes', toGoalId: 'swarm.v2.15.attributes', position: 15, oldTarget: 15, newTarget: 12, label: 'Attributes' },
          { status: 'new', type: 'facility', facilityType: 'merchandising_hub', fromGoalId: null, toGoalId: 'swarm.v2.10.facility.merchandising_hub', position: 10, oldTarget: null, newTarget: 2, label: 'Merchandising Hub' },
          { status: 'removed', type: 'facility', facilityType: 'streaming_studio', fromGoalId: 'swarm.v1.20.facility.streaming_studio', toGoalId: null, position: null, oldTarget: 8, newTarget: null, label: 'Streaming Studio' },
        ],
        params: { targets: {} }, requiredTeamNames: { twoVsTwo: 5, threeVsThree: 3 }, passes: true, rejection: null,
      },
      {
        catalogueKey: 'swarm-two', stableName: 'Second Swarm', status: 'active', fromVersion: 1, toVersion: 2, changes: [],
        params: { targets: {} }, requiredTeamNames: { twoVsTwo: 5, threeVsThree: 3 }, passes: false,
        rejection: { code: 'AUTOMATON_BLUEPRINTS_TOO_FEW', reason: 'Goal 6 targets 11 robots, but this stable has 4 blueprints. Add blueprints or lower the target.' },
      },
    ],
  };
}

export const WEAPONS: CatalogueWeapon[] = [
  { id: 1, name: 'Laser Pistol', weaponType: 'energy', handsRequired: 'one', rangeBand: 'short', baseDamage: 10, cooldown: 2, cost: 57_000 },
  { id: 2, name: 'Volt Sabre', weaponType: 'melee', handsRequired: 'one', rangeBand: 'melee', baseDamage: 20, cooldown: 2, cost: 425_000 },
  { id: 3, name: 'Nova Caster', weaponType: 'energy', handsRequired: 'one', rangeBand: 'mid', baseDamage: 20, cooldown: 2, cost: 300_000 },
  { id: 4, name: 'Tower Shield', weaponType: 'shield', handsRequired: 'shield', rangeBand: 'melee', baseDamage: 0, cooldown: 1, cost: 100_000 },
  { id: 5, name: 'War Hammer', weaponType: 'melee', handsRequired: 'two', rangeBand: 'melee', baseDamage: 40, cooldown: 3, cost: 500_000 },
];

export const WEAPON_MAP: ReadonlyMap<string, CatalogueWeapon> = new Map(WEAPONS.map((w) => [w.name, w]));
