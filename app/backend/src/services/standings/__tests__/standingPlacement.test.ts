/**
 * Unit tests for the standing placement rule (standingPlacement) and the
 * tx-scoped league instance picker (leagueInstancePlacement).
 *
 * The transaction client is a hand-rolled mock; neither module touches
 * `lib/prisma`, so nothing here needs a database.
 */
import type { Prisma, Standing } from '../../../../generated/prisma';
import {
  MAX_ENTITIES_PER_INSTANCE,
  leagueInstanceLockKey,
  pickLeagueInstanceInTransaction,
} from '../../league/leagueInstancePlacement';
import {
  STANDING_BACKED_EVENTS,
  ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE,
  TEAM_STANDING_LOCK_NAMESPACE,
  ensureStanding,
  ensureStandingsForSubscriptionGain,
  ensureTeamStandings,
  isStandingBackedEvent,
  isTeamMatchable,
  lockRobotTeamMembership,
  lockTeamStandings,
  teamModesForSize,
} from '../standingPlacement';

// ── Mock transaction ─────────────────────────────────────────────────

interface TeamFixture {
  teamSize: number;
  members: number[];
}

interface UniqueWhere {
  where: { entityType_entityId_mode: { entityType: string; entityId: number; mode: string } };
}

/** A lock call as recorded from `$executeRaw`: `mode:<key>` or `<ns>:<id>`. */
type LockCall = string;

function makeStanding(entityType: string, entityId: number, mode: string, overrides: Partial<Standing> = {}): Standing {
  return {
    id: entityId * 100 + mode.length,
    entityType,
    entityId,
    mode,
    tier: 'bronze',
    leagueInstanceId: 'bronze_1',
    leaguePoints: 0,
    cyclesInTier: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    totalMatches: null,
    totalZoneScore: null,
    totalZoneTime: null,
    bestPlacement: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as Standing;
}

function createMockTx(options: {
  teams?: Record<number, TeamFixture>;
  subscriptions?: Array<{ robotId: number; eventType: string }>;
  memberships?: Array<{ teamId: number; team: { teamSize: number } }>;
  groups?: Array<{ leagueInstanceId: string; _count: { id: number } }>;
} = {}) {
  const teams = options.teams ?? {};
  const subscriptions = options.subscriptions ?? [];
  const locks: LockCall[] = [];
  const created: Array<{ entityType: string; entityId: number; mode: string }> = [];

  const tx = {
    $executeRaw: jest.fn((_strings: TemplateStringsArray, ...values: unknown[]) => {
      locks.push(values.length === 1 ? `mode:${String(values[0])}` : `${String(values[0])}:${String(values[1])}`);
      return Promise.resolve(1);
    }),
    standing: {
      findUnique: jest.fn((_args: UniqueWhere): Promise<Standing | null> => Promise.resolve(null)),
      findUniqueOrThrow: jest.fn(({ where }: UniqueWhere) => {
        const key = where.entityType_entityId_mode;
        return Promise.resolve(makeStanding(key.entityType, key.entityId, key.mode));
      }),
      groupBy: jest.fn(() => Promise.resolve(options.groups ?? [])),
      createMany: jest.fn(({ data }: { data: Array<{ entityType: string; entityId: number; mode: string }> }) => {
        created.push(...data.map(({ entityType, entityId, mode }) => ({ entityType, entityId, mode })));
        return Promise.resolve({ count: data.length });
      }),
    },
    teamBattle: {
      findUnique: jest.fn(({ where }: { where: { id: number } }) => {
        const team = teams[where.id];
        return Promise.resolve(
          team ? { teamSize: team.teamSize, members: team.members.map((robotId) => ({ robotId })) } : null,
        );
      }),
    },
    teamBattleMember: {
      findMany: jest.fn(() => Promise.resolve(options.memberships ?? [])),
    },
    subscription: {
      findMany: jest.fn(({ where }: { where: { robotId: { in: number[] }; eventType: { in: string[] } } }) =>
        Promise.resolve(
          subscriptions.filter((s) => where.robotId.in.includes(s.robotId) && where.eventType.in.includes(s.eventType)),
        ),
      ),
    },
  };

  return { tx, client: tx as unknown as Prisma.TransactionClient, locks, created };
}

/** The pre-refactor `hashTierName` from leagueInstanceService, kept as the reference. */
function legacyHashTierName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 2147483647;
}

const modeLock = (mode: string): LockCall => `mode:${leagueInstanceLockKey(mode, 'bronze')}`;
const teamLock = (teamId: number): LockCall => `${TEAM_STANDING_LOCK_NAMESPACE}:${teamId}`;

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Events and modes ─────────────────────────────────────────────────

describe('event/mode mapping', () => {
  it('lists the standing-backed events in canonical order', () => {
    expect(STANDING_BACKED_EVENTS.map((d) => d.event)).toEqual([
      'league_1v1', 'koth', 'grand_melee', 'league_2v2', 'tag_team', 'league_3v3',
    ]);
    expect(STANDING_BACKED_EVENTS.map((d) => d.entityType)).toEqual([
      'robot', 'robot', 'robot', 'team', 'team', 'team',
    ]);
  });

  it('recognises standing-backed events and rejects tournaments and unknowns', () => {
    for (const { event } of STANDING_BACKED_EVENTS) {
      expect(isStandingBackedEvent(event)).toBe(true);
    }
    for (const event of ['tournament_1v1', 'tournament_2v2', 'tournament_3v3', 'unknown', '']) {
      expect(isStandingBackedEvent(event)).toBe(false);
    }
  });

  it('maps team sizes to their modes', () => {
    expect(teamModesForSize(2)).toEqual(['league_2v2', 'tag_team']);
    expect(teamModesForSize(3)).toEqual(['league_3v3']);
  });
});

// ── isTeamMatchable ──────────────────────────────────────────────────

describe('isTeamMatchable', () => {
  it.each([
    ['incomplete team', 2, [1], new Set([1, 2]), false],
    ['too many members', 2, [1, 2, 3], new Set([1, 2, 3]), false],
    ['duplicate member ids', 2, [1, 1], new Set([1]), false],
    ['one member missing the subscription', 2, [1, 2], new Set([1]), false],
    ['one of three missing', 3, [1, 2, 3], new Set([1, 3]), false],
    ['all members subscribed (2)', 2, [1, 2], new Set([1, 2]), true],
    ['all members subscribed (3)', 3, [1, 2, 3], new Set([3, 2, 1, 9]), true],
  ])('%s', (_label, teamSize, members, subscribed, expected) => {
    expect(isTeamMatchable(teamSize, members, subscribed)).toBe(expected);
  });
});

// ── Locks ────────────────────────────────────────────────────────────

describe('lock helpers', () => {
  it('take the robot membership and team standing namespaces', async () => {
    const { client, locks } = createMockTx();
    await lockRobotTeamMembership(client, 42);
    await lockTeamStandings(client, 7);
    expect(locks).toEqual([`${ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE}:42`, `${TEAM_STANDING_LOCK_NAMESPACE}:7`]);
    expect(ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE).toBe(2);
    expect(TEAM_STANDING_LOCK_NAMESPACE).toBe(5);
  });
});

// ── Instance picking ─────────────────────────────────────────────────

describe('pickLeagueInstanceInTransaction', () => {
  it('keeps the legacy mode/tier lock key', () => {
    const modes = ['league_1v1', 'koth', 'grand_melee', 'league_2v2', 'tag_team', 'league_3v3'];
    const tiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];
    for (const mode of modes) {
      for (const tier of tiers) {
        expect(leagueInstanceLockKey(mode, tier)).toBe(legacyHashTierName(`${mode}_${tier}`));
      }
    }
  });

  it('takes the mode/tier lock before counting', async () => {
    const { tx, client, locks } = createMockTx();
    await pickLeagueInstanceInTransaction(client, 'koth', 'bronze', MAX_ENTITIES_PER_INSTANCE);
    expect(locks).toEqual([modeLock('koth')]);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.standing.groupBy.mock.invocationCallOrder[0]);
    expect(tx.standing.groupBy).toHaveBeenCalledWith({
      by: ['leagueInstanceId'],
      where: { mode: 'koth', tier: 'bronze' },
      _count: { id: true },
    });
  });

  it('returns bronze_1 when no rows exist', async () => {
    const { client } = createMockTx({ groups: [] });
    await expect(pickLeagueInstanceInTransaction(client, 'league_1v1', 'bronze', 100)).resolves.toBe('bronze_1');
  });

  it('chooses the least-full instance', async () => {
    const { client } = createMockTx({
      groups: [
        { leagueInstanceId: 'bronze_1', _count: { id: 80 } },
        { leagueInstanceId: 'bronze_2', _count: { id: 3 } },
        { leagueInstanceId: 'bronze_3', _count: { id: 50 } },
      ],
    });
    await expect(pickLeagueInstanceInTransaction(client, 'league_1v1', 'bronze', 100)).resolves.toBe('bronze_2');
  });

  it('breaks ties on the lowest instance number', async () => {
    const { client } = createMockTx({
      groups: [
        { leagueInstanceId: 'bronze_3', _count: { id: 10 } },
        { leagueInstanceId: 'bronze_10', _count: { id: 10 } },
        { leagueInstanceId: 'bronze_2', _count: { id: 10 } },
      ],
    });
    await expect(pickLeagueInstanceInTransaction(client, 'koth', 'bronze', 100)).resolves.toBe('bronze_2');
  });

  it('opens bronze_{max+1} when the least-full instance is full', async () => {
    const { client } = createMockTx({
      groups: [
        { leagueInstanceId: 'bronze_1', _count: { id: 100 } },
        { leagueInstanceId: 'bronze_4', _count: { id: 101 } },
      ],
    });
    await expect(pickLeagueInstanceInTransaction(client, 'koth', 'bronze', 100)).resolves.toBe('bronze_5');
  });
});

// ── ensureStanding ───────────────────────────────────────────────────

describe('ensureStanding', () => {
  it('returns an existing row untouched without locking or inserting', async () => {
    const { tx, client, locks } = createMockTx();
    const existing = makeStanding('robot', 5, 'koth', { tier: 'gold', leaguePoints: 37, wins: 4 });
    tx.standing.findUnique.mockResolvedValueOnce(existing);

    const result = await ensureStanding(client, 'robot', 5, 'koth');

    expect(result).toEqual({ standing: existing, created: false });
    expect(tx.standing.findUnique).toHaveBeenCalledWith({
      where: { entityType_entityId_mode: { entityType: 'robot', entityId: 5, mode: 'koth' } },
    });
    expect(tx.standing.createMany).not.toHaveBeenCalled();
    expect(locks).toEqual([]);
  });

  it('re-reads after taking the mode lock and does not insert when another tx committed the row', async () => {
    const { tx, client, locks } = createMockTx();
    const committed = makeStanding('robot', 5, 'koth', { leagueInstanceId: 'bronze_2' });
    tx.standing.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(committed);

    const result = await ensureStanding(client, 'robot', 5, 'koth');

    expect(result).toEqual({ standing: committed, created: false });
    expect(locks).toEqual([modeLock('koth')]);
    expect(tx.standing.findUnique).toHaveBeenCalledTimes(2);
    expect(tx.standing.createMany).not.toHaveBeenCalled();
  });

  it('inserts a Bronze, 0 LP, zero-counter row in the picked instance with skipDuplicates', async () => {
    const { tx, client } = createMockTx({
      groups: [
        { leagueInstanceId: 'bronze_1', _count: { id: 100 } },
        { leagueInstanceId: 'bronze_2', _count: { id: 3 } },
      ],
    });

    const result = await ensureStanding(client, 'team', 12, 'league_2v2');

    expect(tx.standing.createMany).toHaveBeenCalledTimes(1);
    expect(tx.standing.createMany).toHaveBeenCalledWith({
      data: [{
        entityType: 'team',
        entityId: 12,
        mode: 'league_2v2',
        tier: 'bronze',
        leagueInstanceId: 'bronze_2',
        leaguePoints: 0,
        cyclesInTier: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
        currentLoseStreak: 0,
      }],
      skipDuplicates: true,
    });
    expect(tx.standing.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { entityType_entityId_mode: { entityType: 'team', entityId: 12, mode: 'league_2v2' } },
    });
    expect(result.created).toBe(true);
    expect(result.standing.entityId).toBe(12);
  });

  it('reports created:false when the insert was skipped as a duplicate', async () => {
    const { tx, client } = createMockTx();
    tx.standing.createMany.mockResolvedValueOnce({ count: 0 });

    const result = await ensureStanding(client, 'robot', 8, 'grand_melee');

    expect(result.created).toBe(false);
    expect(tx.standing.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });
});

// ── ensureTeamStandings ──────────────────────────────────────────────

describe('ensureTeamStandings', () => {
  it('returns [] for a missing team after taking the team lock', async () => {
    const { tx, client, locks } = createMockTx();
    await expect(ensureTeamStandings(client, 99)).resolves.toEqual([]);
    expect(locks).toEqual([teamLock(99)]);
    expect(tx.subscription.findMany).not.toHaveBeenCalled();
  });

  it('takes the team lock before reading the team', async () => {
    const { tx, client } = createMockTx({ teams: { 1: { teamSize: 2, members: [1, 2] } } });
    await ensureTeamStandings(client, 1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.teamBattle.findUnique.mock.invocationCallOrder[0]);
  });

  it('creates nothing for an incomplete team even when every member is subscribed', async () => {
    const { client, created } = createMockTx({
      teams: { 1: { teamSize: 2, members: [1] } },
      subscriptions: [{ robotId: 1, eventType: 'league_2v2' }],
    });
    await expect(ensureTeamStandings(client, 1)).resolves.toEqual([]);
    expect(created).toEqual([]);
  });

  it('creates nothing when one member lacks the subscription', async () => {
    const { client, created } = createMockTx({
      teams: { 1: { teamSize: 2, members: [1, 2] } },
      subscriptions: [{ robotId: 1, eventType: 'league_2v2' }, { robotId: 2, eventType: 'tag_team' }],
    });
    await expect(ensureTeamStandings(client, 1)).resolves.toEqual([]);
    expect(created).toEqual([]);
  });

  it('ensures only league_2v2 when the complete team only holds league_2v2', async () => {
    const { tx, client, created } = createMockTx({
      teams: { 1: { teamSize: 2, members: [1, 2] } },
      subscriptions: [{ robotId: 1, eventType: 'league_2v2' }, { robotId: 2, eventType: 'league_2v2' }],
    });
    await expect(ensureTeamStandings(client, 1)).resolves.toEqual(['league_2v2']);
    expect(created).toEqual([{ entityType: 'team', entityId: 1, mode: 'league_2v2' }]);
    expect(tx.subscription.findMany).toHaveBeenCalledWith({
      where: { robotId: { in: [1, 2] }, eventType: { in: ['league_2v2', 'tag_team'] } },
      select: { robotId: true, eventType: true },
    });
  });

  it('treats tag_team independently of league_2v2', async () => {
    const { client, created } = createMockTx({
      teams: { 1: { teamSize: 2, members: [1, 2] } },
      subscriptions: [
        { robotId: 1, eventType: 'tag_team' },
        { robotId: 2, eventType: 'tag_team' },
        { robotId: 2, eventType: 'league_2v2' },
      ],
    });
    await expect(ensureTeamStandings(client, 1)).resolves.toEqual(['tag_team']);
    expect(created).toEqual([{ entityType: 'team', entityId: 1, mode: 'tag_team' }]);
  });

  it('ensures both 2-robot modes in canonical order when both are held', async () => {
    const { client, locks } = createMockTx({
      teams: { 1: { teamSize: 2, members: [1, 2] } },
      subscriptions: [1, 2].flatMap((robotId) => [
        { robotId, eventType: 'tag_team' },
        { robotId, eventType: 'league_2v2' },
      ]),
    });
    await expect(ensureTeamStandings(client, 1)).resolves.toEqual(['league_2v2', 'tag_team']);
    expect(locks).toEqual([teamLock(1), modeLock('league_2v2'), modeLock('tag_team')]);
  });

  it('requires all three members for league_3v3', async () => {
    const two = createMockTx({
      teams: { 3: { teamSize: 3, members: [1, 2, 3] } },
      subscriptions: [{ robotId: 1, eventType: 'league_3v3' }, { robotId: 2, eventType: 'league_3v3' }],
    });
    await expect(ensureTeamStandings(two.client, 3)).resolves.toEqual([]);
    expect(two.created).toEqual([]);

    const three = createMockTx({
      teams: { 3: { teamSize: 3, members: [1, 2, 3] } },
      subscriptions: [1, 2, 3].map((robotId) => ({ robotId, eventType: 'league_3v3' })),
    });
    await expect(ensureTeamStandings(three.client, 3)).resolves.toEqual(['league_3v3']);
    expect(three.created).toEqual([{ entityType: 'team', entityId: 3, mode: 'league_3v3' }]);
  });

  it('returns already-existing rows as ensured without inserting', async () => {
    const { tx, client, created } = createMockTx({
      teams: { 1: { teamSize: 2, members: [1, 2] } },
      subscriptions: [{ robotId: 1, eventType: 'league_2v2' }, { robotId: 2, eventType: 'league_2v2' }],
    });
    tx.standing.findUnique.mockResolvedValue(makeStanding('team', 1, 'league_2v2', { tier: 'silver' }));
    await expect(ensureTeamStandings(client, 1)).resolves.toEqual(['league_2v2']);
    expect(created).toEqual([]);
  });
});

// ── ensureStandingsForSubscriptionGain ───────────────────────────────

describe('ensureStandingsForSubscriptionGain', () => {
  it('does nothing for tournament-only or empty gains', async () => {
    const { tx, client } = createMockTx();
    await ensureStandingsForSubscriptionGain(client, 1, ['tournament_1v1', 'tournament_2v2', 'tournament_3v3']);
    await ensureStandingsForSubscriptionGain(client, 1, []);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.standing.findUnique).not.toHaveBeenCalled();
    expect(tx.teamBattleMember.findMany).not.toHaveBeenCalled();
  });

  it('creates robot rows for the added robot modes only, in canonical order, without reading teams', async () => {
    const { tx, client, created } = createMockTx();
    await ensureStandingsForSubscriptionGain(client, 4, ['tournament_1v1', 'koth', 'league_1v1']);
    expect(created).toEqual([
      { entityType: 'robot', entityId: 4, mode: 'league_1v1' },
      { entityType: 'robot', entityId: 4, mode: 'koth' },
    ]);
    expect(tx.teamBattleMember.findMany).not.toHaveBeenCalled();
  });

  it('queries memberships only for the sizes of the added team modes', async () => {
    const { tx, client } = createMockTx();
    await ensureStandingsForSubscriptionGain(client, 4, ['tag_team', 'league_2v2']);
    expect(tx.teamBattleMember.findMany).toHaveBeenCalledWith({
      where: { robotId: 4, team: { teamSize: { in: [2] } } },
      select: { teamId: true, team: { select: { teamSize: true } } },
    });
  });

  it('creates the team row when the gain completes the set', async () => {
    const { client, created } = createMockTx({
      teams: { 6: { teamSize: 2, members: [1, 2] } },
      subscriptions: [{ robotId: 1, eventType: 'league_2v2' }, { robotId: 2, eventType: 'league_2v2' }],
      memberships: [{ teamId: 6, team: { teamSize: 2 } }],
    });
    await ensureStandingsForSubscriptionGain(client, 2, ['league_2v2']);
    expect(created).toEqual([{ entityType: 'team', entityId: 6, mode: 'league_2v2' }]);
  });

  it('creates no team row when a teammate is not subscribed', async () => {
    const { client, created } = createMockTx({
      teams: { 6: { teamSize: 2, members: [1, 2] } },
      subscriptions: [{ robotId: 2, eventType: 'league_2v2' }],
      memberships: [{ teamId: 6, team: { teamSize: 2 } }],
    });
    await ensureStandingsForSubscriptionGain(client, 2, ['league_2v2']);
    expect(created).toEqual([]);
  });

  it('locks teams ascending before any mode lock, and robot modes before team modes', async () => {
    const robotId = 1;
    const { client, locks, created } = createMockTx({
      teams: {
        9: { teamSize: 2, members: [1, 2] },
        4: { teamSize: 3, members: [1, 3, 5] },
      },
      subscriptions: [
        ...[1, 2].map((id) => ({ robotId: id, eventType: 'league_2v2' })),
        ...[1, 3, 5].map((id) => ({ robotId: id, eventType: 'league_3v3' })),
      ],
      // Deliberately unordered: the helper must sort.
      memberships: [{ teamId: 9, team: { teamSize: 2 } }, { teamId: 4, team: { teamSize: 3 } }],
    });

    await ensureStandingsForSubscriptionGain(client, robotId, ['league_3v3', 'league_2v2', 'grand_melee', 'koth']);

    expect(locks).toEqual([
      teamLock(4),
      teamLock(9),
      modeLock('koth'),
      modeLock('grand_melee'),
      teamLock(9),
      modeLock('league_2v2'),
      teamLock(4),
      modeLock('league_3v3'),
    ]);
    expect(created).toEqual([
      { entityType: 'robot', entityId: 1, mode: 'koth' },
      { entityType: 'robot', entityId: 1, mode: 'grand_melee' },
      { entityType: 'team', entityId: 9, mode: 'league_2v2' },
      { entityType: 'team', entityId: 4, mode: 'league_3v3' },
    ]);
  });
});
