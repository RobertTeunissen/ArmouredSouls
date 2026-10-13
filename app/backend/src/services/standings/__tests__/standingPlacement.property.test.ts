/**
 * Property tests for the standing placement rule.
 *
 * Random sequences of subscribe / unsubscribe / register / swap operations run
 * against an in-memory fake transaction client. After each operation the
 * matching helper is called the way production callers will call it, and the
 * resulting `standings` rows are checked against an independent model:
 *
 * (a) a team row for mode m exists ⇔ the team was, after some operation,
 *     complete with every member subscribed to m;
 * (b) a robot row for mode m exists ⇔ the robot was ever subscribed to m;
 * (c) no row is ever removed or changed (unsubscribe and swap keep rows);
 * (d) at most one row per (entity, mode).
 */
import * as fc from 'fast-check';
import type { Prisma } from '../../../../generated/prisma';
import {
  STANDING_BACKED_EVENTS,
  ensureStandingsForSubscriptionGain,
  ensureTeamStandings,
  teamModesForSize,
  type TeamSize,
} from '../standingPlacement';

// ── In-memory fake transaction ───────────────────────────────────────

interface FakeStanding {
  id: number;
  entityType: string;
  entityId: number;
  mode: string;
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  cyclesInTier: number;
  wins: number;
  losses: number;
  draws: number;
  currentWinStreak: number;
  bestWinStreak: number;
  currentLoseStreak: number;
}

interface FakeTeam {
  id: number;
  teamSize: TeamSize;
  members: number[];
}

interface FakeState {
  standings: FakeStanding[];
  subscriptions: Set<string>;
  teams: Map<number, FakeTeam>;
}

interface UniqueArgs {
  where: { entityType_entityId_mode: { entityType: string; entityId: number; mode: string } };
}

const subKey = (robotId: number, event: string): string => `${robotId}|${event}`;

function createFakeTx(state: FakeState): Prisma.TransactionClient {
  let nextId = 1;
  const find = ({ where }: UniqueArgs): FakeStanding | null => {
    const key = where.entityType_entityId_mode;
    return state.standings.find(
      (s) => s.entityType === key.entityType && s.entityId === key.entityId && s.mode === key.mode,
    ) ?? null;
  };

  const tx = {
    $executeRaw: (): Promise<number> => Promise.resolve(1),
    standing: {
      findUnique: (args: UniqueArgs) => Promise.resolve(find(args)),
      findUniqueOrThrow: (args: UniqueArgs) => {
        const row = find(args);
        return row ? Promise.resolve(row) : Promise.reject(new Error('No Standing found'));
      },
      groupBy: ({ where }: { where: { mode: string; tier: string } }) => {
        const counts = new Map<string, number>();
        for (const s of state.standings) {
          if (s.mode === where.mode && s.tier === where.tier) {
            counts.set(s.leagueInstanceId, (counts.get(s.leagueInstanceId) ?? 0) + 1);
          }
        }
        return Promise.resolve([...counts].map(([leagueInstanceId, id]) => ({ leagueInstanceId, _count: { id } })));
      },
      createMany: ({ data, skipDuplicates }: { data: Array<Omit<FakeStanding, 'id'>>; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const row of data) {
          const duplicate = find({ where: { entityType_entityId_mode: row } });
          if (duplicate) {
            if (!skipDuplicates) return Promise.reject(new Error('P2002'));
            continue;
          }
          state.standings.push({ ...row, id: nextId++ });
          count++;
        }
        return Promise.resolve({ count });
      },
    },
    teamBattle: {
      findUnique: ({ where }: { where: { id: number } }) => {
        const team = state.teams.get(where.id);
        return Promise.resolve(
          team ? { teamSize: team.teamSize, members: team.members.map((robotId) => ({ robotId })) } : null,
        );
      },
    },
    teamBattleMember: {
      findMany: ({ where }: { where: { robotId: number; team: { teamSize: { in: number[] } } } }) =>
        Promise.resolve(
          [...state.teams.values()]
            .filter((t) => t.members.includes(where.robotId) && where.team.teamSize.in.includes(t.teamSize))
            .map((t) => ({ teamId: t.id, team: { teamSize: t.teamSize } })),
        ),
    },
    subscription: {
      findMany: ({ where }: { where: { robotId: { in: number[] }; eventType: { in: string[] } } }) =>
        Promise.resolve(
          where.robotId.in.flatMap((robotId) =>
            where.eventType.in
              .filter((eventType) => state.subscriptions.has(subKey(robotId, eventType)))
              .map((eventType) => ({ robotId, eventType })),
          ),
        ),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

// ── Operations ───────────────────────────────────────────────────────

const EVENTS = [...STANDING_BACKED_EVENTS.map((d) => d.event), 'tournament_1v1', 'tournament_2v2'] as const;
const ROBOT_MODES: readonly string[] = STANDING_BACKED_EVENTS.filter((d) => d.entityType === 'robot').map((d) => d.event);

type Op =
  | { kind: 'subscribe'; robot: number; events: number[] }
  | { kind: 'unsubscribe'; robot: number; event: number }
  | { kind: 'register'; slot: number; pick: number[] }
  | { kind: 'swap'; slot: number; memberSlot: number; robot: number };

// Bounded uniform indices (fc.nat() is biased towards 0, which would starve
// every robot but the first and every event but league_1v1).
const indexArb = fc.integer({ min: 0, max: 59 });
const EVENT_INDEXES = EVENTS.map((_event, i) => i);

const opArb: fc.Arbitrary<Op> = fc.oneof(
  {
    // A subscription change can add several events at once (setSubscriptionsForRobot).
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('subscribe' as const),
      robot: indexArb,
      events: fc.subarray(EVENT_INDEXES, { minLength: 1 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('unsubscribe' as const),
      robot: indexArb,
      event: fc.constantFrom(...EVENT_INDEXES),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('register' as const),
      slot: indexArb,
      pick: fc.array(indexArb, { minLength: 3, maxLength: 3 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant('swap' as const), slot: indexArb, memberSlot: indexArb, robot: indexArb }),
  },
);

const scenarioArb = fc.record({
  robotCount: fc.integer({ min: 4, max: 6 }),
  teamSizes: fc.array(fc.constantFrom<TeamSize>(2, 3), { minLength: 1, maxLength: 2 }),
  ops: fc.array(opArb, { minLength: 10, maxLength: 25 }),
});

/** True when `robotId` is on a team of `size` other than `exceptTeamId`. */
function onSameSizeTeam(state: FakeState, robotId: number, size: TeamSize, exceptTeamId?: number): boolean {
  return [...state.teams.values()].some(
    (t) => t.id !== exceptTeamId && t.teamSize === size && t.members.includes(robotId),
  );
}

/**
 * Apply `op` to the state and call the helper production would call.
 * Returns nothing; inapplicable operations are no-ops.
 */
async function applyOp(
  state: FakeState,
  tx: Prisma.TransactionClient,
  op: Op,
  robotIds: number[],
  teamSizes: TeamSize[],
): Promise<void> {
  switch (op.kind) {
    case 'subscribe': {
      const robotId = robotIds[op.robot % robotIds.length];
      // Like applySubscriptionChange: the helper receives only the newly added events.
      const added = op.events
        .map((i) => EVENTS[i])
        .filter((event) => !state.subscriptions.has(subKey(robotId, event)));
      for (const event of added) state.subscriptions.add(subKey(robotId, event));
      await ensureStandingsForSubscriptionGain(tx, robotId, added);
      return;
    }
    case 'unsubscribe': {
      const robotId = robotIds[op.robot % robotIds.length];
      state.subscriptions.delete(subKey(robotId, EVENTS[op.event % EVENTS.length]));
      return;
    }
    case 'register': {
      const slot = op.slot % teamSizes.length;
      const teamId = slot + 1;
      if (state.teams.has(teamId)) return;
      const size = teamSizes[slot];
      const free = robotIds.filter((id) => !onSameSizeTeam(state, id, size));
      const members: number[] = [];
      for (const p of op.pick) {
        const remaining = free.filter((id) => !members.includes(id));
        if (members.length === size || remaining.length === 0) break;
        members.push(remaining[p % remaining.length]);
      }
      if (members.length !== size) return;
      state.teams.set(teamId, { id: teamId, teamSize: size, members });
      await ensureTeamStandings(tx, teamId);
      return;
    }
    case 'swap': {
      const team = state.teams.get((op.slot % teamSizes.length) + 1);
      if (!team) return;
      const robotId = robotIds[op.robot % robotIds.length];
      if (team.members.includes(robotId) || onSameSizeTeam(state, robotId, team.teamSize, team.id)) return;
      team.members[op.memberSlot % team.members.length] = robotId;
      await ensureTeamStandings(tx, team.id);
      return;
    }
  }
}

function isMatchableNow(state: FakeState, team: FakeTeam, mode: string): boolean {
  return team.members.length === team.teamSize
    && new Set(team.members).size === team.members.length
    && team.members.every((robotId) => state.subscriptions.has(subKey(robotId, mode)));
}

const rowKey = (s: { entityType: string; entityId: number; mode: string }): string =>
  `${s.entityType}:${s.entityId}:${s.mode}`;

// ── Properties ───────────────────────────────────────────────────────

describe('standing placement rule (property)', () => {
  it('creates rows exactly on first matchability and never removes or changes them', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ robotCount, teamSizes, ops }) => {
        const state: FakeState = { standings: [], subscriptions: new Set(), teams: new Map() };
        const tx = createFakeTx(state);
        const robotIds = Array.from({ length: robotCount }, (_, i) => i + 1);
        const everSubscribed = new Set<string>();
        const everMatchable = new Set<string>();

        for (const op of ops) {
          const before = state.standings.map((s) => ({ ...s }));

          await applyOp(state, tx, op, robotIds, teamSizes);

          // Model update, independent of the helpers under test.
          for (const key of state.subscriptions) everSubscribed.add(key);
          for (const team of state.teams.values()) {
            for (const mode of teamModesForSize(team.teamSize)) {
              if (isMatchableNow(state, team, mode)) everMatchable.add(rowKey({ entityType: 'team', entityId: team.id, mode }));
            }
          }

          // (c) no row removed or changed.
          for (const prior of before) {
            expect(state.standings.find((s) => s.id === prior.id)).toEqual(prior);
          }

          // (d) at most one row per (entity, mode).
          const keys = state.standings.map(rowKey);
          expect(new Set(keys).size).toBe(keys.length);

          // (a) team rows ⇔ ever matchable.
          const teamRows = new Set(state.standings.filter((s) => s.entityType === 'team').map(rowKey));
          expect(teamRows).toEqual(everMatchable);

          // (b) robot rows ⇔ ever subscribed to a robot mode.
          const robotRows = new Set(state.standings.filter((s) => s.entityType === 'robot').map(rowKey));
          const expectedRobotRows = new Set(
            [...everSubscribed]
              .map((key) => key.split('|'))
              .filter(([, event]) => ROBOT_MODES.includes(event))
              .map(([robotId, event]) => rowKey({ entityType: 'robot', entityId: Number(robotId), mode: event })),
          );
          expect(robotRows).toEqual(expectedRobotRows);

          // New rows start in Bronze with 0 LP.
          for (const s of state.standings) {
            expect(s).toMatchObject({ tier: 'bronze', leagueInstanceId: 'bronze_1', leaguePoints: 0, cyclesInTier: 0 });
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
