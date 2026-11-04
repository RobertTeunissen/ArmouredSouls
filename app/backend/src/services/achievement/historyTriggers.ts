/**
 * History-based achievement checks added for Season 2
 * (docs/analysis/ACHIEVEMENTS_SEASON_2_REVAMP.md §4).
 *
 * Each one reads season-scoped history (battle participants, battle builds,
 * league history, the financial ledger, subscriptions, season archives), so a
 * rollover resets them along with the unlocks. The trigger cases that call
 * these live in `triggerEvaluator.ts`.
 *
 * Win/loss is only well defined per robot in 1v1 modes, where
 * `battles.winner_id` is a robot id. Team modes store a team id there and use
 * `winning_side` with the participant's `team` instead.
 */

import prisma from '../../lib/prisma';
import { STARTER_WEAPON_NAMES } from '../../config/starterWeapons';
import { SUBSCRIBABLE_EVENT_TYPES } from '../subscription/eventRegistry';
import { getAchievementCounterStart } from './achievementCounterWindow';

/** Battle types where `battles.winner_id` is the winning robot. */
export const ONE_VS_ONE_BATTLE_TYPES = ['league_1v1', 'tournament_1v1'] as const;

/** Battle types where the winner is a side (`winning_side` + participant `team`). */
const TEAM_BATTLE_TYPES = ['league_2v2', 'league_3v3', 'tag_team', 'tournament_2v2', 'tournament_3v3'];

/** League tiers, lowest first. */
export const LEAGUE_TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

/** Whether a battle type is a 1v1 mode. */
export function isOneVsOne(battleType: unknown): boolean {
  return (ONE_VS_ONE_BATTLE_TYPES as readonly string[]).includes(String(battleType ?? ''));
}

/**
 * Times a robot yielded (C23) or was destroyed (C24) this season, in any mode.
 *
 * A destruction must also leave 0 HP: Grand Melee rows written before yields
 * were recorded separately have `destroyed: true` for robots that yielded with
 * HP left, and those must not count towards C24.
 */
export async function countRobotOutcomes(robotId: number, outcome: 'yielded' | 'destroyed'): Promise<number> {
  const where = outcome === 'destroyed'
    ? { robotId, destroyed: true, finalHP: { lte: 0 } }
    : { robotId, yielded: true };
  return prisma.battleParticipant.count({ where });
}

/**
 * Per-robot yield and destruction counts, one query, for the progress display.
 */
export async function getRobotOutcomeCounts(
  robotIds: readonly number[],
): Promise<Map<number, { yielded: number; destroyed: number }>> {
  const result = new Map<number, { yielded: number; destroyed: number }>();
  if (robotIds.length === 0) return result;
  const rows = await prisma.$queryRaw<Array<{ robot_id: number; yielded: bigint; destroyed: bigint }>>`
    SELECT robot_id,
           COUNT(*) FILTER (WHERE yielded) AS yielded,
           COUNT(*) FILTER (WHERE destroyed AND final_hp <= 0) AS destroyed
    FROM battle_participants
    WHERE robot_id = ANY(${[...robotIds]}::int[])
    GROUP BY robot_id
  `;
  for (const row of rows) {
    result.set(row.robot_id, { yielded: Number(row.yielded), destroyed: Number(row.destroyed) });
  }
  return result;
}

/**
 * C25: the robot's latest 1v1 battle is a win and the `minLosses` 1v1 battles
 * before it were all losses. Draws break the streak.
 */
export async function checkLosingStreakBroken(robotId: number, minLosses: number): Promise<boolean> {
  const recent = await prisma.battleParticipant.findMany({
    where: { robotId, battle: { battleType: { in: [...ONE_VS_ONE_BATTLE_TYPES] } } },
    orderBy: { battle: { createdAt: 'desc' } },
    take: minLosses + 1,
    select: { battle: { select: { winnerId: true } } },
  });
  if (recent.length < minLosses + 1) return false;
  const [latest, ...before] = recent;
  if (latest.battle.winnerId !== robotId) return false;
  return before.every((p) => p.battle.winnerId !== null && p.battle.winnerId !== robotId);
}

/** C26: the previous 1v1 battle between these two robots was won by the opponent. */
export async function checkRevengeWin(robotId: number, opponentRobotId: number, battleId: number): Promise<boolean> {
  const previous = await prisma.battle.findFirst({
    where: {
      id: { not: battleId },
      battleType: { in: [...ONE_VS_ONE_BATTLE_TYPES] },
      AND: [
        { participants: { some: { robotId } } },
        { participants: { some: { robotId: opponentRobotId } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { winnerId: true },
  });
  return previous?.winnerId === opponentRobotId;
}

/** C27: the opponent's 1v1 league tier is above `subjectTier`. */
export async function checkHigherTierOpponent(subjectTier: string, opponentRobotId: number): Promise<boolean> {
  const standing = await prisma.standing.findFirst({
    where: { entityType: 'robot', entityId: opponentRobotId, mode: 'league_1v1' },
    select: { tier: true },
  });
  const tiers: readonly string[] = LEAGUE_TIER_ORDER;
  const subject = tiers.indexOf(subjectTier);
  const opponent = tiers.indexOf(standing?.tier ?? '');
  return subject >= 0 && opponent > subject;
}

/** S16: both robots use the same chassis (frame). */
export async function checkSameChassis(subjectFrameId: unknown, opponentRobotId: number): Promise<boolean> {
  const opponent = await prisma.robot.findUnique({ where: { id: opponentRobotId }, select: { frameId: true } });
  return opponent !== null && Number(subjectFrameId) === opponent.frameId;
}

async function getStarterWeaponIds(): Promise<number[]> {
  const weapons = await prisma.weapon.findMany({
    where: { name: { in: [...STARTER_WEAPON_NAMES] } },
    select: { id: true },
  });
  return weapons.map((w) => w.id);
}

/** C29: 1v1 wins per robot with a starter weapon as main weapon (battle-time build). */
export async function getStarterWeaponWins(robotIds: readonly number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (robotIds.length === 0) return result;
  const starterIds = await getStarterWeaponIds();
  if (starterIds.length === 0) return result;
  const rows = await prisma.$queryRaw<Array<{ robot_id: number; wins: bigint }>>`
    SELECT bpb.robot_id, COUNT(*) AS wins
    FROM battle_participant_builds bpb
    JOIN battles b ON b.id = bpb.battle_id
    WHERE bpb.robot_id = ANY(${[...robotIds]}::int[])
      AND bpb.battle_type = ANY(${[...ONE_VS_ONE_BATTLE_TYPES]}::text[])
      AND bpb.main_weapon_id = ANY(${starterIds}::int[])
      AND b.winner_id = bpb.robot_id
    GROUP BY bpb.robot_id
  `;
  for (const row of rows) result.set(row.robot_id, Number(row.wins));
  return result;
}

/**
 * L31: the robot was demoted out of a 1v1 tier and later promoted back into it.
 */
export async function checkDemotionRepromotion(robotId: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ found: number }>>`
    SELECT 1 AS found
    FROM league_history d
    JOIN league_history p
      ON p.entity_type = d.entity_type AND p.entity_id = d.entity_id
     AND p.change_type = 'promotion' AND p.destination_tier = d.source_tier
     AND p.created_at > d.created_at
    WHERE d.entity_type = 'robot' AND d.entity_id = ${robotId}
      AND d.change_type = 'demotion'
      AND COALESCE(d.mode, 'league_1v1') = 'league_1v1'
      AND COALESCE(p.mode, 'league_1v1') = 'league_1v1'
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Ledger filter for one user, limited to rows after the latest account reset.
 *
 * The ledger is season-scoped, but an account reset keeps it (the financial
 * ledger guide requires that) while deleting the unlocks. Without the window,
 * pre-reset spending, income and low balances would re-unlock E27, E33 and E28
 * on a fresh account (same rule as the issue #342 audit counters).
 */
async function ledgerWhere(userId: number): Promise<{ userId: number; createdAt?: { gt: Date } }> {
  const since = await getAchievementCounterStart(userId);
  return since ? { userId, createdAt: { gt: since } } : { userId };
}

/** Sum of a ledger transaction type for a user (season-scoped, since the latest reset). */
export async function sumLedger(userId: number, transactionType: string): Promise<number> {
  const result = await prisma.financialLedger.aggregate({
    where: { ...(await ledgerWhere(userId)), transactionType },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
}

/** E27: credits spent on attribute upgrades (ledger amounts are negative). */
export async function getAttributeUpgradeSpend(userId: number): Promise<number> {
  return Math.abs(await sumLedger(userId, 'attribute_upgrade'));
}

/** E33: credits earned from the Merchandising Hub. */
export async function getMerchandisingIncome(userId: number): Promise<number> {
  return sumLedger(userId, 'passive_income');
}

/** E28: the balance was once below `lowBalance` (the current balance is checked by the caller). */
export async function hasDippedBelow(userId: number, lowBalance: number): Promise<boolean> {
  const low = await prisma.financialLedger.findFirst({
    where: { ...(await ledgerWhere(userId)), balanceAfter: { lt: lowBalance } },
    select: { id: true },
  });
  return low !== null;
}

/** E31: credits spent on repairs this season, across all robots. */
export async function getRepairSpend(userId: number): Promise<number> {
  const result = await prisma.robot.aggregate({
    where: { userId },
    _sum: { lifetimeRepairCreditsPaid: true },
  });
  return Number(result._sum.lifetimeRepairCreditsPaid ?? 0);
}

/** E34: distinct battle-time loadout types the user's robots have won with. */
export async function countLoadoutTypesWithWin(userId: number): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ loadouts: bigint }>>`
    SELECT COUNT(DISTINCT bpb.loadout_type) AS loadouts
    FROM battle_participant_builds bpb
    JOIN robots r ON r.id = bpb.robot_id
    JOIN battles b ON b.id = bpb.battle_id
    JOIN battle_participants bp ON bp.battle_id = bpb.battle_id AND bp.robot_id = bpb.robot_id
    WHERE r.user_id = ${userId}
      AND CASE
            WHEN b.battle_type = ANY(${TEAM_BATTLE_TYPES}::text[]) THEN b.winning_side = bp.team
            ELSE b.winner_id = bpb.robot_id
          END
  `;
  return Number(rows[0]?.loadouts ?? 0);
}

/** E35: one of the user's robots is subscribed to every Booking Office event type. */
export async function hasRobotOnEveryEvent(userId: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ robot_id: number }>>`
    SELECT s.robot_id
    FROM subscriptions s
    JOIN robots r ON r.id = s.robot_id
    WHERE r.user_id = ${userId} AND s.event_type = ANY(${[...SUBSCRIBABLE_EVENT_TYPES]}::text[])
    GROUP BY s.robot_id
    HAVING COUNT(DISTINCT s.event_type) >= ${SUBSCRIBABLE_EVENT_TYPES.length}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** P11: any battle this season paid the robot at least `threshold` in streaming revenue. */
export async function hasBattleStreamingRevenue(robotId: number, threshold: number): Promise<boolean> {
  const hit = await prisma.battleParticipant.findFirst({
    where: { robotId, streamingRevenue: { gte: threshold } },
    select: { id: true },
  });
  return hit !== null;
}

/** P12: the stable has an archive row, so it competed in an earlier season. */
export async function hasPreviousSeason(userId: number): Promise<boolean> {
  const count = await prisma.stableSeasonArchive.count({ where: { userId } });
  return count > 0;
}
