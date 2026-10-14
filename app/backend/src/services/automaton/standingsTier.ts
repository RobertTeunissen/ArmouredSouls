/**
 * Highest current tier of a stable, read from `standings` (Spec #55, R11.13,
 * design §17.3): the highest tier over the played standings rows of the
 * stable's robots (`entityType = robot`) and teams (`entityType = team`) in
 * the six tiered modes, returned with the mode that holds it.
 *
 * Played only: the Bronze rows created on the first matchable subscription
 * (W/L/D 0, no placement match) are ignored, so a stable that
 * never played has no tier. This is the current tier, not the season's peak;
 * tournament modes have no tier. The rules (played predicate, tie-break) live
 * in `app/shared/utils/automatonStandingsTier.ts`, shared with the admin UI.
 * `standings` is the source of truth for competitive ranking; entity models
 * are never read for it.
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';
import {
  highestTierOf,
  LEAGUE_TIER_ORDER,
  TIERED_STANDINGS_MODES,
  type HighestTier,
  type StandingPlayInput,
  type StandingsTier,
} from '../../shared/utils/automatonStandingsTier';

export { LEAGUE_TIER_ORDER };
export type LeagueTier = StandingsTier;

/**
 * SQL mirror of `isPlayedStanding`; expects the `standings` alias `s`.
 * Keep in step with the shared predicate.
 */
export const PLAYED_STANDING_SQL = Prisma.sql`(s."wins" + s."losses" + s."draws" > 0 OR COALESCE(s."total_matches", 0) > 0)`;

/**
 * SQL mirror of `TIERED_STANDINGS_MODES`; expects the `standings` alias `s`.
 * The `::text` cast is required: the enum column cannot be compared with text parameters.
 */
export const TIERED_MODE_SQL = Prisma.sql`s."mode"::text IN (${Prisma.join([...TIERED_STANDINGS_MODES])})`;

type TierDb = Pick<Prisma.TransactionClient, 'robot' | 'teamBattle' | 'standing'>;

/** Highest played tier with its mode per user id; users without a played tiered row map to null. Three bounded queries. */
export async function bestTiersForUsers(userIds: readonly number[], db: TierDb = prisma): Promise<Map<number, HighestTier | null>> {
  const result = new Map<number, HighestTier | null>(userIds.map((id) => [id, null]));
  if (userIds.length === 0) return result;
  const [robots, teams] = await Promise.all([
    db.robot.findMany({ where: { userId: { in: [...userIds] } }, select: { id: true, userId: true } }),
    db.teamBattle.findMany({ where: { stableId: { in: [...userIds] } }, select: { id: true, stableId: true } }),
  ]);
  const ownerOfRobot = new Map(robots.map((r) => [r.id, r.userId]));
  const ownerOfTeam = new Map(teams.map((t) => [t.id, t.stableId]));
  if (ownerOfRobot.size === 0 && ownerOfTeam.size === 0) return result;
  const rows = await db.standing.findMany({
    where: {
      mode: { in: [...TIERED_STANDINGS_MODES] },
      OR: [
        { entityType: 'robot', entityId: { in: [...ownerOfRobot.keys()] } },
        { entityType: 'team', entityId: { in: [...ownerOfTeam.keys()] } },
      ],
    },
    select: { entityType: true, entityId: true, mode: true, tier: true, wins: true, losses: true, draws: true, totalMatches: true },
  });
  const rowsByOwner = new Map<number, StandingPlayInput[]>();
  for (const row of rows) {
    const owner = row.entityType === 'robot' ? ownerOfRobot.get(row.entityId) : ownerOfTeam.get(row.entityId);
    if (owner === undefined) continue;
    const group = rowsByOwner.get(owner) ?? [];
    group.push(row);
    rowsByOwner.set(owner, group);
  }
  for (const [owner, group] of rowsByOwner) result.set(owner, highestTierOf(group));
  return result;
}
