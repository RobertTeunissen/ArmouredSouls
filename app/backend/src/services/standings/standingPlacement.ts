/**
 * Standing placement: the single rule for when a `standings` row is created.
 *
 * ## The rule
 *
 * - A standings row is created the first time its entity becomes *matchable*
 *   in a standing-backed mode:
 *   - robot modes (`league_1v1`, `koth`, `grand_melee`): when the robot first
 *     holds that subscription;
 *   - team modes (`league_2v2`, `tag_team` for 2-robot teams, `league_3v3` for
 *     3-robot teams): when the team is complete and every member holds that
 *     mode's subscription.
 * - Rows are never created at robot or team creation.
 * - Rows are kept on unsubscribe and on member swap (the entity keeps its tier,
 *   LP and record and simply stops being matched).
 * - Rows are deleted on team disband, account reset and robot deletion; the
 *   season rollover wipes them.
 * - New rows start in Bronze with 0 LP in the least-full Bronze instance.
 *
 * ## Locking
 *
 * Global lock order (keeps the wait-for graph acyclic):
 *
 *   (2, robotId) → (3, cycle) → (5, teamId) ascending → mode/tier hash lock,
 *   taking mode locks in canonical mode order
 *   (league_1v1, koth, grand_melee, league_2v2, tag_team, league_3v3).
 *
 * - `(2, robotId)` serialises team membership changes for a robot (see
 *   `teamBattleService`). Callers that *add team modes* through
 *   {@link ensureStandingsForSubscriptionGain} must already hold it.
 * - `(5, teamId)` serialises every team-standing check (subscription gain,
 *   registration, swap) so two members subscribing at the same time cannot both
 *   miss each other's subscription.
 * - The mode/tier hash lock is taken by `pickLeagueInstanceInTransaction` and
 *   serialises instance picks.
 *
 * ## Why `createMany({ skipDuplicates: true })`
 *
 * Postgres aborts an interactive transaction on a unique violation, so
 * "create → catch P2002 → re-read" cannot work on `tx`. Inserting with
 * `ON CONFLICT DO NOTHING` and then reading the row back lets concurrent
 * callers converge on the same row while the transaction survives.
 *
 * This module imports neither `lib/prisma` nor `config/logger` (only Prisma
 * types), so `prisma/seed.ts` can use it with its own client.
 *
 * @module services/standings/standingPlacement
 */

import type { Prisma, Standing } from '../../../generated/prisma';
import {
  MAX_ENTITIES_PER_INSTANCE,
  pickLeagueInstanceInTransaction,
} from '../league/leagueInstancePlacement';

// --- Events and modes ---

/** Standing-backed events in canonical (lock) order. */
export const STANDING_BACKED_EVENTS = [
  { event: 'league_1v1', entityType: 'robot', teamSize: null },
  { event: 'koth', entityType: 'robot', teamSize: null },
  { event: 'grand_melee', entityType: 'robot', teamSize: null },
  { event: 'league_2v2', entityType: 'team', teamSize: 2 },
  { event: 'tag_team', entityType: 'team', teamSize: 2 },
  { event: 'league_3v3', entityType: 'team', teamSize: 3 },
] as const;

type StandingBackedEventDefinition = typeof STANDING_BACKED_EVENTS[number];

/** A subscription event that has a `standings` row (subset of `StandingsMode`). */
export type StandingBackedEvent = StandingBackedEventDefinition['event'];

export type StandingEntityType = 'robot' | 'team';

export type TeamSize = 2 | 3;

const STANDING_BACKED_EVENT_NAMES: ReadonlySet<string> = new Set(
  STANDING_BACKED_EVENTS.map((definition) => definition.event),
);

export function isStandingBackedEvent(event: string): event is StandingBackedEvent {
  return STANDING_BACKED_EVENT_NAMES.has(event);
}

/** Team modes a team of `size` robots competes in, in canonical order. */
export function teamModesForSize(size: TeamSize): StandingBackedEvent[] {
  return STANDING_BACKED_EVENTS
    .filter((definition) => definition.teamSize === size)
    .map((definition) => definition.event);
}

// --- Locks ---

export const ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE = 2;
export const TEAM_STANDING_LOCK_NAMESPACE = 5;

/** Take `(2, robotId)` for the rest of the transaction. */
export async function lockRobotTeamMembership(tx: Prisma.TransactionClient, robotId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ROBOT_TEAM_MEMBERSHIP_LOCK_NAMESPACE}, ${robotId})`;
}

/** Take `(5, teamId)` for the rest of the transaction. */
export async function lockTeamStandings(tx: Prisma.TransactionClient, teamId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TEAM_STANDING_LOCK_NAMESPACE}, ${teamId})`;
}

// --- Pure predicate ---

/**
 * A team is matchable in a mode when it is complete (exactly `teamSize`
 * distinct members) and every member holds that mode's subscription.
 */
export function isTeamMatchable(
  teamSize: number,
  memberRobotIds: readonly number[],
  subscribedRobotIds: ReadonlySet<number>,
): boolean {
  if (memberRobotIds.length !== teamSize) return false;
  if (new Set(memberRobotIds).size !== memberRobotIds.length) return false;
  return memberRobotIds.every((robotId) => subscribedRobotIds.has(robotId));
}

// --- Placement ---

export interface EnsureStandingResult {
  standing: Standing;
  created: boolean;
}

const PLACEMENT_TIER = 'bronze';

/**
 * Return the entity's standings row for `mode`, creating it in the least-full
 * Bronze instance with 0 LP if it does not exist. An existing row is returned
 * untouched.
 */
export async function ensureStanding(
  tx: Prisma.TransactionClient,
  entityType: StandingEntityType,
  entityId: number,
  mode: StandingBackedEvent,
): Promise<EnsureStandingResult> {
  const where: Prisma.StandingWhereUniqueInput = {
    entityType_entityId_mode: { entityType, entityId, mode },
  };

  const existing = await tx.standing.findUnique({ where });
  if (existing) return { standing: existing, created: false };

  // Takes the mode/tier lock; another transaction may have committed the row
  // while we waited for it, so read again before inserting.
  const leagueInstanceId = await pickLeagueInstanceInTransaction(
    tx,
    mode,
    PLACEMENT_TIER,
    MAX_ENTITIES_PER_INSTANCE,
  );

  const committedMeanwhile = await tx.standing.findUnique({ where });
  if (committedMeanwhile) return { standing: committedMeanwhile, created: false };

  // skipDuplicates (ON CONFLICT DO NOTHING): a unique violation would abort the
  // whole Postgres transaction, so catching P2002 and re-reading is impossible.
  const inserted = await tx.standing.createMany({
    data: [{
      entityType,
      entityId,
      mode,
      tier: PLACEMENT_TIER,
      leagueInstanceId,
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

  const standing = await tx.standing.findUniqueOrThrow({ where });
  return { standing, created: inserted.count === 1 };
}

/**
 * Ensure the team has a row for every team mode it is currently matchable in.
 * Takes `(5, teamId)` before reading members and subscriptions.
 *
 * @returns the modes the team now has a row for because it is matchable
 *   (canonical order); `[]` if the team is missing or incomplete.
 */
export async function ensureTeamStandings(
  tx: Prisma.TransactionClient,
  teamId: number,
): Promise<StandingBackedEvent[]> {
  await lockTeamStandings(tx, teamId);

  const team = await tx.teamBattle.findUnique({
    where: { id: teamId },
    select: { teamSize: true, members: { select: { robotId: true } } },
  });
  if (!team) return [];
  if (team.teamSize !== 2 && team.teamSize !== 3) return [];

  const memberRobotIds = team.members.map((member) => member.robotId);
  if (memberRobotIds.length !== team.teamSize) return [];

  const modes = teamModesForSize(team.teamSize);
  const subscriptions = await tx.subscription.findMany({
    where: { robotId: { in: memberRobotIds }, eventType: { in: modes } },
    select: { robotId: true, eventType: true },
  });

  const ensured: StandingBackedEvent[] = [];
  for (const mode of modes) {
    const subscribed = new Set(
      subscriptions.filter((s) => s.eventType === mode).map((s) => s.robotId),
    );
    if (isTeamMatchable(team.teamSize, memberRobotIds, subscribed)) {
      await ensureStanding(tx, 'team', teamId, mode);
      ensured.push(mode);
    }
  }
  return ensured;
}

/**
 * Create the rows a robot's newly added subscriptions make matchable: the
 * robot's own row for each added robot mode, and its teams' rows for added team
 * modes when the team is now complete and fully subscribed.
 *
 * Precondition: when `addedEvents` contains a team mode, the caller already
 * holds `(2, robotId)` (see the lock order in the module header).
 */
export async function ensureStandingsForSubscriptionGain(
  tx: Prisma.TransactionClient,
  robotId: number,
  addedEvents: readonly string[],
): Promise<void> {
  const added = STANDING_BACKED_EVENTS.filter((definition) => addedEvents.includes(definition.event));
  if (added.length === 0) return;

  const teamSizes = [...new Set(
    added.flatMap((definition) => (definition.teamSize === null ? [] : [definition.teamSize])),
  )];

  const memberships = teamSizes.length === 0
    ? []
    : await tx.teamBattleMember.findMany({
      where: { robotId, team: { teamSize: { in: teamSizes } } },
      select: { teamId: true, team: { select: { teamSize: true } } },
    });

  // Team locks first (ascending), before any mode lock.
  const teamIdsAscending = [...new Set(memberships.map((m) => m.teamId))].sort((a, b) => a - b);
  for (const teamId of teamIdsAscending) {
    await lockTeamStandings(tx, teamId);
  }

  for (const definition of added) {
    if (definition.entityType === 'robot') {
      await ensureStanding(tx, 'robot', robotId, definition.event);
    }
  }

  // Size 2 before size 3 keeps team mode locks in canonical order. Re-taking a
  // team lock inside ensureTeamStandings is a no-op: advisory locks are re-entrant.
  const teamsInModeOrder = [...memberships].sort(
    (a, b) => a.team.teamSize - b.team.teamSize || a.teamId - b.teamId,
  );
  for (const membership of teamsInModeOrder) {
    await ensureTeamStandings(tx, membership.teamId);
  }
}
