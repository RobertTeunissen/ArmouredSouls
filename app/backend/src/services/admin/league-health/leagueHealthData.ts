/**
 * Read-only data of League Health: the standings rows and the recent
 * rebalance history.
 *
 * Standings: every tiered row with its owner's stable type, whether it is
 * still subscribed, and its ELO, in one query.
 *
 * - Active: a robot has an active subscription to the standings mode's event; a
 *   team is active when it has members and every member is subscribed (the rule
 *   the team league routes use for `isSubscribed`). Standings rows survive an
 *   unsubscribe, so inactive rows still hold an instance seat.
 * - ELO: robot ELO, or the team's combined ELO (sum of its members), as the
 *   player league pages show it. Current values, not battle-time ones.
 *
 * @module services/admin/league-health/leagueHealthData
 */

import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import { TIERED_LEAGUE_MODES, TieredLeagueMode } from '../../league/league-rules';
import type { LeagueHealthRow, ModeRebalanceHistory } from './leagueHealthTypes';

interface RawRow {
  entity_id: number;
  entity_type: string;
  mode: string;
  tier: string;
  league_instance_id: string;
  league_points: number;
  cycles_in_tier: number;
  stable_type: string | null;
  active: boolean;
  elo: number | null;
}

const STABLE_TYPES = new Set(['human', 'generated', 'automaton']);

/** Team standings modes; a team is active in one when every member subscribed to it. */
const TEAM_MODES: readonly TieredLeagueMode[] = ['league_2v2', 'league_3v3', 'tag_team'];

function toRow(raw: RawRow): LeagueHealthRow {
  return {
    entityId: raw.entity_id,
    entityType: raw.entity_type === 'team' ? 'team' : 'robot',
    mode: raw.mode as TieredLeagueMode,
    tier: raw.tier,
    leagueInstanceId: raw.league_instance_id,
    leaguePoints: raw.league_points,
    cyclesInTier: raw.cycles_in_tier,
    stableType: raw.stable_type && STABLE_TYPES.has(raw.stable_type)
      ? raw.stable_type as LeagueHealthRow['stableType']
      : null,
    active: raw.active,
    elo: raw.elo === null ? null : Number(raw.elo),
  };
}

/** All standings rows of the six tiered modes. */
export async function loadLeagueHealthRows(): Promise<LeagueHealthRow[]> {
  // Joins instead of per-row subqueries: ~0.4 s on ACC (19k rows, Oct 2026)
  // against ~1.5 s for the correlated form. `subscriptions` is unique per
  // (robot, event), so the joins never duplicate a standings row.
  const rows = await prisma.$queryRaw<RawRow[]>`
    WITH team_stats AS (
      SELECT
        m.team_id,
        team_mode.mode,
        COUNT(*) AS members,
        COUNT(sub.robot_id) AS subscribed,
        SUM(mr.elo)::int AS elo
      FROM team_battle_members m
      JOIN robots mr ON mr.id = m.robot_id
      CROSS JOIN (VALUES ${Prisma.join(TEAM_MODES.map((mode) => Prisma.sql`(${mode})`))}) AS team_mode(mode)
      LEFT JOIN subscriptions sub
        ON sub.robot_id = m.robot_id AND sub.event_type = team_mode.mode AND sub.status = 'active'
      GROUP BY m.team_id, team_mode.mode
    )
    SELECT
      s.entity_id,
      s.entity_type,
      s.mode::text AS mode,
      s.tier,
      s.league_instance_id,
      s.league_points,
      s.cycles_in_tier,
      COALESCE(ru.stable_type, tu.stable_type)::text AS stable_type,
      CASE WHEN s.entity_type = 'robot' THEN rsub.robot_id IS NOT NULL
           ELSE COALESCE(ts.members > 0 AND ts.subscribed = ts.members, false) END AS active,
      CASE WHEN s.entity_type = 'robot' THEN r.elo ELSE ts.elo END AS elo
    FROM standings s
    LEFT JOIN robots r ON s.entity_type = 'robot' AND r.id = s.entity_id
    LEFT JOIN users ru ON ru.id = r.user_id
    LEFT JOIN subscriptions rsub
      ON s.entity_type = 'robot' AND rsub.robot_id = s.entity_id
      AND rsub.event_type = s.mode::text AND rsub.status = 'active'
    LEFT JOIN team_battles t ON s.entity_type = 'team' AND t.id = s.entity_id
    LEFT JOIN users tu ON tu.id = t.stable_id
    LEFT JOIN team_stats ts ON s.entity_type = 'team' AND ts.team_id = s.entity_id AND ts.mode = s.mode::text
    WHERE s.mode::text IN (${Prisma.join([...TIERED_LEAGUE_MODES])})
  `;
  return rows.map(toRow);
}

interface RawMoveRow {
  mode: string;
  cycle_number: number;
  source_tier: string;
  change_type: string;
  moved: number;
}

/**
 * Promotions and demotions per tier in each mode's last `window` rebalances.
 *
 * `league_history` records moves only, so a rebalance is observed as a cycle in
 * which the mode has at least one row. In a populated mode every rebalance moves
 * someone (Bronze always promotes), so this only misses a rebalance in which no
 * tier of the mode moved at all. The table is emptied at season rollover, so the
 * window never spans seasons.
 */
export async function loadRebalanceHistory(window: number): Promise<Map<TieredLeagueMode, ModeRebalanceHistory>> {
  const modes = Prisma.join([...TIERED_LEAGUE_MODES]);
  const rows = await prisma.$queryRaw<RawMoveRow[]>`
    WITH recent AS (
      SELECT mode, cycle_number
      FROM (
        SELECT mode, cycle_number,
               ROW_NUMBER() OVER (PARTITION BY mode ORDER BY cycle_number DESC) AS rn
        FROM (SELECT DISTINCT mode, cycle_number FROM league_history WHERE mode IN (${modes})) cycles
      ) ranked
      WHERE rn <= ${window}
    )
    SELECT r.mode, r.cycle_number, h.source_tier, h.change_type, COUNT(h.id)::int AS moved
    FROM recent r
    LEFT JOIN league_history h ON h.mode = r.mode AND h.cycle_number = r.cycle_number
    GROUP BY r.mode, r.cycle_number, h.source_tier, h.change_type
  `;

  const history = new Map<TieredLeagueMode, ModeRebalanceHistory>();
  for (const mode of TIERED_LEAGUE_MODES) history.set(mode, { cycles: [], moves: [] });
  for (const row of rows) {
    const entry = history.get(row.mode as TieredLeagueMode);
    if (!entry) continue;
    if (!entry.cycles.includes(row.cycle_number)) entry.cycles.push(row.cycle_number);
    if (row.change_type === 'promotion' || row.change_type === 'demotion') {
      entry.moves.push({
        mode: row.mode as TieredLeagueMode,
        cycleNumber: row.cycle_number,
        sourceTier: row.source_tier,
        changeType: row.change_type,
        moved: Number(row.moved),
      });
    }
  }
  for (const entry of history.values()) entry.cycles.sort((a, b) => b - a);
  return history;
}
