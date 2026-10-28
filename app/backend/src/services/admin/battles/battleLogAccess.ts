/**
 * Admin access to a battle's stored combat log, which the nightly retention job
 * removes after `BATTLE_LOG_RETENTION_DAYS`. Stored compressed in
 * `battles.battle_log_zst` (descriptor in `battle_log_meta`); logs written before
 * the zstd codec are still in the legacy jsonb `battles.battle_log`. All decoding
 * goes through `services/battle/battleLogCodec.ts`.
 */
import prisma from '../../../lib/prisma';
import { BattleError, BattleErrorCode } from '../../../errors';
import { getBattleLogRetentionDays } from '../../retention/battleLogRetentionService';
import { BATTLE_LOG_SELECT, decodeBattleLog } from '../../battle/battleLogCodec';
import type { KothLogStorage } from '../../../types/battleLogTypes';
import { modeShape } from './battleModes';
import type { AdminCombatEvent, BattleLogResponse, CombatLogStatus } from './battleTypes';

/** The retention job runs daily at 01:30 UTC and removes logs older than the window. */
const RETENTION_RUN_UTC_MINUTES = 90;

export function logRemovalDate(createdAt: Date, retentionDays: number = getBattleLogRetentionDays()): Date {
  const eligible = new Date(createdAt.getTime() + retentionDays * 86_400_000);
  const run = new Date(Date.UTC(eligible.getUTCFullYear(), eligible.getUTCMonth(), eligible.getUTCDate(), 0, RETENTION_RUN_UTC_MINUTES));
  if (run.getTime() <= eligible.getTime()) run.setUTCDate(run.getUTCDate() + 1);
  return run;
}

/**
 * Log status from the battle type and the log's storage marker. 1v1, team and
 * tournament logs always kept every event with formulas; KotH / Grand Melee
 * logs say how they were stored, and logs without a marker predate formulas.
 */
export function combatLogStatus(
  battleType: string,
  createdAt: Date,
  hasLog: boolean,
  storage: KothLogStorage | null,
): CombatLogStatus {
  const placement = modeShape(battleType) === 'placement';
  return {
    available: hasLog,
    removesOn: logRemovalDate(createdAt).toISOString(),
    hasFormulas: placement ? storage?.formulas === true : true,
    movementSampled: placement ? storage?.sampled !== false : false,
  };
}

/**
 * Status without loading the (large) log itself: the storage marker comes from
 * the small `battle_log_meta` column, or from the legacy jsonb log.
 */
export async function loadCombatLogStatus(battleId: number, battleType: string, createdAt: Date): Promise<CombatLogStatus> {
  const rows = await prisma.$queryRaw<Array<{ has_log: boolean; storage: unknown }>>`
    SELECT (battle_log_zst IS NOT NULL OR battle_log IS NOT NULL) AS has_log,
           CASE WHEN battle_log_zst IS NOT NULL THEN battle_log_meta -> 'storage'
                ELSE battle_log -> 'storage' END AS storage
    FROM battles WHERE id = ${battleId}
  `;
  const row = rows[0];
  return combatLogStatus(battleType, createdAt, row?.has_log === true, (row?.storage as KothLogStorage | null) ?? null);
}

interface StoredLog {
  detailedCombatEvents?: unknown[];
  events?: unknown[];
  storage?: KothLogStorage;
}

/** The stored log object (or null after retention) plus the battle's basic row. */
export async function loadStoredLog(battleId: number): Promise<{
  battleType: string;
  createdAt: Date;
  log: Record<string, unknown> | null;
}> {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    select: { battleType: true, createdAt: true, ...BATTLE_LOG_SELECT },
  });
  if (!battle) throw new BattleError(BattleErrorCode.BATTLE_NOT_FOUND, 'Battle not found', 404, { battleId });
  const log = await decodeBattleLog(battle, battleId);
  return { battleType: battle.battleType, createdAt: battle.createdAt, log };
}

/** Events in time order: the simulator's detailed events, or the narrative events for logs without them. */
export function combatEventsOf(log: Record<string, unknown> | null): AdminCombatEvent[] {
  if (!log) return [];
  const stored = log as StoredLog;
  const events = Array.isArray(stored.detailedCombatEvents) && stored.detailedCombatEvents.length > 0
    ? stored.detailedCombatEvents
    : Array.isArray(stored.events) ? stored.events : [];
  return events.filter((e): e is AdminCombatEvent =>
    typeof e === 'object' && e !== null && typeof (e as AdminCombatEvent).timestamp === 'number' && typeof (e as AdminCombatEvent).type === 'string',
  );
}

export async function getAdminBattleLog(battleId: number): Promise<BattleLogResponse> {
  const { battleType, createdAt, log } = await loadStoredLog(battleId);
  const storage = (log as StoredLog | null)?.storage ?? null;
  return {
    battleId,
    status: combatLogStatus(battleType, createdAt, log !== null, storage),
    events: combatEventsOf(log),
  };
}
