/**
 * Best league tier of a stable, read from `standings` (Spec #55, R11.13,
 * design §17.3): the highest tier over the standings rows of the stable's
 * robots (`entityType = robot`) and teams (`entityType = team`), all modes.
 * `standings` is the source of truth for competitive ranking; entity models
 * are never read for it.
 */
import prisma from '../../lib/prisma';

/** Tier order, lowest first (design §17.3). */
export const LEAGUE_TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type LeagueTier = (typeof LEAGUE_TIER_ORDER)[number];

function tierRank(tier: string): number {
  return (LEAGUE_TIER_ORDER as readonly string[]).indexOf(tier);
}

/** The higher of two tiers (unknown tier strings rank below bronze). */
export function higherTier(a: LeagueTier | null, b: string): LeagueTier | null {
  const rank = tierRank(b);
  if (rank < 0) return a;
  if (a === null || rank > tierRank(a)) return LEAGUE_TIER_ORDER[rank];
  return a;
}

/** Best tier per user id; users without standings map to null. Three bounded queries. */
export async function bestTiersForUsers(userIds: readonly number[]): Promise<Map<number, LeagueTier | null>> {
  const result = new Map<number, LeagueTier | null>(userIds.map((id) => [id, null]));
  if (userIds.length === 0) return result;
  const [robots, teams] = await Promise.all([
    prisma.robot.findMany({ where: { userId: { in: [...userIds] } }, select: { id: true, userId: true } }),
    prisma.teamBattle.findMany({ where: { stableId: { in: [...userIds] } }, select: { id: true, stableId: true } }),
  ]);
  const ownerOfRobot = new Map(robots.map((r) => [r.id, r.userId]));
  const ownerOfTeam = new Map(teams.map((t) => [t.id, t.stableId]));
  if (ownerOfRobot.size === 0 && ownerOfTeam.size === 0) return result;
  const rows = await prisma.standing.findMany({
    where: {
      OR: [
        { entityType: 'robot', entityId: { in: [...ownerOfRobot.keys()] } },
        { entityType: 'team', entityId: { in: [...ownerOfTeam.keys()] } },
      ],
    },
    select: { entityType: true, entityId: true, tier: true },
  });
  for (const row of rows) {
    const owner = row.entityType === 'robot' ? ownerOfRobot.get(row.entityId) : ownerOfTeam.get(row.entityId);
    if (owner === undefined) continue;
    result.set(owner, higherTier(result.get(owner) ?? null, row.tier));
  }
  return result;
}
