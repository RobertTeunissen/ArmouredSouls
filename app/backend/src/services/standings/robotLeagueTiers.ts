/**
 * Robot → `league_1v1` tier lookup.
 *
 * `standings` is the single source of truth for competitive ranking; `Robot` has
 * carried no `currentLeague` column since Spec #40. Three services were still
 * selecting it — `getRobotAttributeStats`, the admin user-detail query, and the
 * engagement-players query — so `GET /api/admin/stats/robots`,
 * `GET /api/admin/users/:id` and `GET /api/admin/engagement/players` answered 500 on
 * every request. None of them was covered by a gating tier.
 *
 * The lookup itself was already written out twice by hand (`economyCalculations.ts`
 * and `routes/adminUsers.ts`), which is why it lives here now: five call sites, one
 * declaration.
 *
 * @module services/standings/robotLeagueTiers
 */

import prisma from '../../lib/prisma';
import { StandingsMode } from '../../../generated/prisma';

/** The tier a robot is placed in when it has no standing row yet. */
export const DEFAULT_LEAGUE_TIER = 'bronze';

/**
 * Map robot id → `league_1v1` tier, defaulting to {@link DEFAULT_LEAGUE_TIER}.
 *
 * One query regardless of how many ids are passed. Robots with no standing are
 * absent from the map; use {@link tierOf} to read it so the default is applied
 * consistently.
 */
export async function getRobotLeagueTiers(
  robotIds: readonly number[],
): Promise<Map<number, string>> {
  if (robotIds.length === 0) return new Map();

  const standings = await prisma.standing.findMany({
    where: {
      entityType: 'robot',
      entityId: { in: [...new Set(robotIds)] },
      mode: StandingsMode.league_1v1,
    },
    select: { entityId: true, tier: true },
  });

  return new Map(standings.map((s) => [s.entityId, s.tier]));
}

/** Read a tier out of the map, applying the default for an unranked robot. */
export function tierOf(tiers: Map<number, string>, robotId: number): string {
  return tiers.get(robotId) ?? DEFAULT_LEAGUE_TIER;
}
