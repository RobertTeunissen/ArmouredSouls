/**
 * Team-mode win resolution for achievement evaluation.
 *
 * Spec #46 R8 Cause A: `achievementService.ts` read `tag_team`, `league_2v2`, and
 * `league_3v3` win counts from a Robot_Scoped_Standing —
 * `standing.findMany({ entityType: 'robot', entityId: robotId })`. Those three
 * modes only ever write `entityType: 'team'` rows keyed by `TeamBattle.id`, so
 * the lookup found nothing, `?? 0` coerced the miss to zero, and Dynamic Duo
 * (L16), Twins! (L19), and Voltron (L21) could never unlock at any threshold.
 * The `?? 0` is what hid it: a missing standing and a genuine zero were
 * indistinguishable.
 *
 * Resolution goes robot → `TeamBattleMember` → `TeamBattle` → team-scoped
 * `Standing`, in two batched queries regardless of how many robots are passed.
 *
 * Used by both `achievementService.ts` (unlock evaluation) and
 * `achievementCatalog.ts` (displayed progress) so the number a player sees on
 * the achievement card cannot disagree with the number that gates the unlock.
 *
 * @module services/achievement/teamModeWins
 */

import prisma from '../../lib/prisma';
import { StandingsMode } from '../../../generated/prisma';

/** Per-robot win counts across the three team modes. */
export interface TeamModeWins {
  league_2v2: number;
  league_3v3: number;
  tag_team: number;
}

const ZERO_WINS: Readonly<TeamModeWins> = Object.freeze({
  league_2v2: 0,
  league_3v3: 0,
  tag_team: 0,
});

/** A robot with no team membership resolves to explicit zeros, never undefined. */
export function emptyTeamModeWins(): TeamModeWins {
  return { ...ZERO_WINS };
}

/**
 * Resolve team-mode win counts for a batch of robots.
 *
 * Returns an entry for every requested robot id, with zeros where the robot has
 * no membership in that team size. The evaluator runs for every participant of
 * every battle, so an absent membership must resolve rather than raise.
 *
 * A size-2 membership maps to **both** `league_2v2` and `tag_team`, because Tag
 * Team is a combat mode on the same `TeamBattle` row rather than a separate
 * entity, with its own standing under a different `mode`.
 *
 * Relies on the application-level invariant that a robot belongs to at most one
 * team per team size, enforced by the `TEAM_MEMBER_CONFLICT` check in
 * `createTeam()` under `pg_advisory_xact_lock(2, robotId)`. This is *not* a
 * database constraint: `TeamBattleMember`'s unique indexes are both
 * team-scoped, so nothing at the schema level prevents a second membership. If
 * the invariant is ever broken, the highest win count wins, so the achievement
 * cannot be under-awarded by a duplicate row.
 */
export async function resolveTeamModeWins(
  robotIds: readonly number[],
): Promise<Map<number, TeamModeWins>> {
  const result = new Map<number, TeamModeWins>();
  const uniqueIds = [...new Set(robotIds)];
  for (const id of uniqueIds) {
    result.set(id, emptyTeamModeWins());
  }
  if (uniqueIds.length === 0) return result;

  const memberships = await prisma.teamBattleMember.findMany({
    where: { robotId: { in: uniqueIds } },
    select: { robotId: true, teamId: true, team: { select: { teamSize: true } } },
  });
  if (memberships.length === 0) return result;

  const teamIds = [...new Set(memberships.map(m => m.teamId))];
  const standings = await prisma.standing.findMany({
    where: {
      entityType: 'team',
      entityId: { in: teamIds },
      mode: { in: [StandingsMode.league_2v2, StandingsMode.league_3v3, StandingsMode.tag_team] },
    },
    select: { entityId: true, mode: true, wins: true },
  });

  // teamId → mode → wins
  const winsByTeam = new Map<number, Map<string, number>>();
  for (const s of standings) {
    let byMode = winsByTeam.get(s.entityId);
    if (!byMode) {
      byMode = new Map();
      winsByTeam.set(s.entityId, byMode);
    }
    byMode.set(String(s.mode), s.wins);
  }

  for (const membership of memberships) {
    const entry = result.get(membership.robotId);
    if (!entry) continue;
    const byMode = winsByTeam.get(membership.teamId);
    if (!byMode) continue;

    if (membership.team.teamSize === 2) {
      // One TeamBattle, two competitive tracks.
      entry.league_2v2 = Math.max(entry.league_2v2, byMode.get('league_2v2') ?? 0);
      entry.tag_team = Math.max(entry.tag_team, byMode.get('tag_team') ?? 0);
    } else if (membership.team.teamSize === 3) {
      entry.league_3v3 = Math.max(entry.league_3v3, byMode.get('league_3v3') ?? 0);
    }
  }

  return result;
}

/** Convenience wrapper for the single-robot case. */
export async function resolveTeamModeWinsForRobot(robotId: number): Promise<TeamModeWins> {
  const map = await resolveTeamModeWins([robotId]);
  return map.get(robotId) ?? emptyTeamModeWins();
}
