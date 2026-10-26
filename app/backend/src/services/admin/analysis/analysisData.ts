/**
 * Reads the battles behind the "what wins" analyses: every battle with a
 * battle-time build record (`battle_participant_builds`) in the window, its
 * participants and their builds. Never touches `battle_log`.
 *
 * Reads in pages of battle ids and converts each page to compact layered
 * builds before the next, so memory stays bounded. Long windows are sampled
 * deterministically by battle id (a multiplicative hash), so the same window
 * always gives the same answer.
 */
import prisma from '../../../lib/prisma';
import { Prisma } from '../../../../generated/prisma';
import type { AttributeValues, StoredRefinement } from '../../../types/combatBuildTypes';
import { layerBuild } from './attributeLayers';
import { addBattle, emptyComparisonSet, PLACEMENT_PAIR_CAP, type AnalysisBattle, type AnalysisParticipant, type ComparisonSet } from './comparisons';

/** Comparisons the models are fitted on at most; longer windows are sampled. */
export const COMPARISON_CAP = 100_000;

const PAGE_SIZE = 2_000;
const HASH_MODULUS = 4_294_967_296;

export interface RecordingBounds {
  since: Date | null;
  newestId: number;
}

export async function getRecordingBounds(): Promise<RecordingBounds> {
  const rows = await prisma.$queryRaw<Array<{ created_at: Date; newest: number }>>(Prisma.sql`
    SELECT (SELECT created_at FROM battle_participant_builds ORDER BY id ASC LIMIT 1) AS created_at,
           COALESCE((SELECT MAX(id) FROM battle_participant_builds), 0)::int AS newest
  `);
  return { since: rows[0]?.created_at ?? null, newestId: Number(rows[0]?.newest ?? 0) };
}

/** Battles with at least one build record since `from`, per battle type. */
export async function countRecordedBattles(from: Date | null): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ battle_type: string; battles: bigint }>>(Prisma.sql`
    SELECT battle_type, COUNT(DISTINCT battle_id) AS battles
    FROM battle_participant_builds
    WHERE ${from ? Prisma.sql`created_at >= ${from}` : Prisma.sql`TRUE`}
    GROUP BY battle_type
  `);
  return new Map(rows.map((r) => [r.battle_type, Number(r.battles)]));
}

/** Expected comparisons per battle, for the sample rate. */
function comparisonsPerBattle(battleType: string): number {
  if (battleType === 'koth') return 15;
  if (battleType === 'grand_melee') return PLACEMENT_PAIR_CAP;
  return 1;
}

/** Share of battles to read so the comparisons stay under `cap`. */
export function sampleRate(battlesByType: ReadonlyMap<string, number>, cap = COMPARISON_CAP): number {
  let expected = 0;
  for (const [type, count] of battlesByType) expected += count * comparisonsPerBattle(type);
  return expected <= cap ? 1 : cap / expected;
}

interface RawBattle {
  id: number;
  battle_type: string;
  winner_id: number | null;
  winning_side: number | null;
  duration_seconds: number;
}

interface RawParticipant {
  battle_id: number;
  robot_id: number;
  team: number;
  placement: number | null;
  forfeited: boolean;
  destroyed: boolean;
  yielded: boolean;
  stable_type: string | null;
  base_attributes: AttributeValues | null;
  tuning: AttributeValues | null;
  effective_attributes: AttributeValues | null;
  main_refinements: StoredRefinement[] | null;
  offhand_refinements: StoredRefinement[] | null;
  loadout_type: string | null;
  stance: string | null;
}

function toParticipant(r: RawParticipant): AnalysisParticipant {
  const build = r.base_attributes && r.effective_attributes && r.loadout_type && r.stance
    ? layerBuild({
      baseAttributes: r.base_attributes,
      tuning: r.tuning ?? {},
      effectiveAttributes: r.effective_attributes,
      mainRefinements: r.main_refinements,
      offhandRefinements: r.offhand_refinements,
      loadoutType: r.loadout_type,
      stance: r.stance,
    })
    : null;
  return {
    robotId: r.robot_id,
    team: r.team,
    placement: r.placement,
    forfeited: r.forfeited,
    destroyed: r.destroyed,
    yielded: r.yielded,
    stableType: r.stable_type,
    build,
  };
}

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** Read every (sampled) recorded battle since `from` into comparisons. */
export async function loadComparisons(from: Date | null, rate: number): Promise<{ set: ComparisonSet; battlesRead: number }> {
  const set = emptyComparisonSet();
  const threshold = Math.floor(Math.min(1, Math.max(rate, 0)) * HASH_MODULUS);
  const sampled = threshold < HASH_MODULUS;
  let lastId = 0;
  let battlesRead = 0;
  for (;;) {
    const ids = await prisma.$queryRaw<Array<{ battle_id: number }>>(Prisma.sql`
      SELECT DISTINCT battle_id FROM battle_participant_builds
      WHERE battle_id > ${lastId}
        AND ${from ? Prisma.sql`created_at >= ${from}` : Prisma.sql`TRUE`}
        AND ${sampled ? Prisma.sql`((battle_id::bigint * 2654435761) % ${HASH_MODULUS}::bigint) < ${threshold}::bigint` : Prisma.sql`TRUE`}
      ORDER BY battle_id
      LIMIT ${PAGE_SIZE}
    `);
    if (ids.length === 0) break;
    const battleIds = ids.map((r) => r.battle_id);
    lastId = battleIds[battleIds.length - 1];

    const [battles, participants] = await Promise.all([
      prisma.$queryRaw<RawBattle[]>(Prisma.sql`
        SELECT id, battle_type, winner_id, winning_side, duration_seconds
        FROM battles WHERE id = ANY(${battleIds}::int[]) ORDER BY id
      `),
      prisma.$queryRaw<RawParticipant[]>(Prisma.sql`
        SELECT p.battle_id, p.robot_id, p.team, p.placement, p.forfeited, p.destroyed, p.yielded,
               u.stable_type::text AS stable_type,
               pb.base_attributes, pb.tuning, pb.effective_attributes, pb.main_refinements, pb.offhand_refinements,
               pb.loadout_type, pb.stance
        FROM battle_participants p
        LEFT JOIN battle_participant_builds pb ON pb.battle_id = p.battle_id AND pb.robot_id = p.robot_id
        LEFT JOIN robots r ON r.id = p.robot_id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE p.battle_id = ANY(${battleIds}::int[])
        ORDER BY p.battle_id, p.team, p.robot_id
      `),
    ]);

    const byBattle = new Map<number, AnalysisParticipant[]>();
    for (const row of participants) {
      const list = byBattle.get(row.battle_id) ?? [];
      list.push(toParticipant(row));
      byBattle.set(row.battle_id, list);
    }
    for (const b of battles) {
      const battle: AnalysisBattle = {
        battleId: b.id,
        battleType: b.battle_type,
        winnerId: b.winner_id,
        winningSide: b.winning_side,
        durationSeconds: b.duration_seconds,
        participants: byBattle.get(b.id) ?? [],
      };
      addBattle(battle, set);
      battlesRead++;
    }
    if (ids.length < PAGE_SIZE) break;
    await yieldToEventLoop();
  }
  return { set, battlesRead };
}
