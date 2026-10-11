/**
 * Need_Attention (Spec #55, R11.11, R11.12, design §17.1a, task 9.6).
 *
 * Computed per Active_Automaton by the list and status endpoints, never
 * stored. Reasons, in this order (PLAYER_FACING_TEXT §6.3):
 *
 * - `last_cycle_failed`: the most recent Turn_Record has `status = failed`;
 * - `balance_negative`: `User.currency < 0`;
 * - `nothing_bought`: the 14 most recent `completed` Turn_Records contain no
 *   charged action (all have `creditsSpent = 0`); the count shown is the
 *   length of the current zero-spend run.
 *
 * Turn_Records are purged at rollover, so the window never spans seasons.
 * Two bounded queries per call, whatever the number of profiles.
 */
import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';

/** Completed zero-spend Turn_Records that make a stable need attention. */
export const NOTHING_BOUGHT_WINDOW = 14;

export type NeedAttentionReason =
  | { code: 'last_cycle_failed'; errorCode: string; label: string }
  | { code: 'balance_negative'; label: string }
  | { code: 'nothing_bought'; cycles: number; label: string };

export type NeedAttentionCode = NeedAttentionReason['code'];

export interface NeedAttentionFacts {
  /** The profile's most recent Turn_Record (any status), or null. */
  latestTurn: { status: string; reason: string | null } | null;
  /** `User.currency`; null for a profile without a User. */
  balance: number | null;
  /** Completed Turn_Records since the last completed one with credits spent. */
  zeroSpendRun: number;
}

/** The reasons of one Active_Automaton, in the approved order (R11.12). */
export function classifyNeedAttention(facts: NeedAttentionFacts): NeedAttentionReason[] {
  const reasons: NeedAttentionReason[] = [];
  if (facts.latestTurn?.status === 'failed') {
    const errorCode = facts.latestTurn.reason ?? 'unknown';
    reasons.push({ code: 'last_cycle_failed', errorCode, label: `Last cycle failed: ${errorCode}` });
  }
  if (facts.balance !== null && facts.balance < 0) {
    reasons.push({ code: 'balance_negative', label: 'Balance negative' });
  }
  if (facts.zeroSpendRun >= NOTHING_BOUGHT_WINDOW) {
    reasons.push({ code: 'nothing_bought', cycles: facts.zeroSpendRun, label: `Nothing bought for ${facts.zeroSpendRun} cycles` });
  }
  return reasons;
}

/**
 * The current zero-spend run of Turn_Records ordered newest first: completed
 * records counted until the first completed record with credits spent;
 * skipped, failed and in-progress records are passed over (the same rule as
 * the SQL in `loadNeedAttention`).
 */
export function zeroSpendRun(turnsNewestFirst: readonly { status: string; creditsSpent: number }[]): number {
  let run = 0;
  for (const turn of turnsNewestFirst) {
    if (turn.status !== 'completed') continue;
    if (turn.creditsSpent > 0) break;
    run++;
  }
  return run;
}

export interface NeedAttentionSubject {
  profileId: number;
  balance: number | null;
}

interface LatestTurnRow {
  profile_id: number;
  status: string;
  reason: string | null;
}

interface ZeroRunRow {
  profile_id: number;
  zero_run: number;
}

/**
 * Need_Attention reasons of Active_Automatons (profile id → reasons). Two
 * queries: the latest Turn_Record per profile and the zero-spend run per
 * profile, both on the `(profile_id, started_at)` index.
 */
export async function loadNeedAttention(subjects: readonly NeedAttentionSubject[]): Promise<Map<number, NeedAttentionReason[]>> {
  const result = new Map<number, NeedAttentionReason[]>();
  if (subjects.length === 0) return result;
  const ids = Prisma.join(subjects.map((s) => s.profileId));
  const [latest, runs] = await Promise.all([
    prisma.$queryRaw<LatestTurnRow[]>`
      SELECT DISTINCT ON ("profile_id") "profile_id", "status"::text AS "status", "reason"
      FROM "automaton_turns"
      WHERE "profile_id" IN (${ids})
      ORDER BY "profile_id", "started_at" DESC, "id" DESC`,
    prisma.$queryRaw<ZeroRunRow[]>`
      WITH "last_spend" AS (
        SELECT "profile_id", MAX("started_at") AS "at"
        FROM "automaton_turns"
        WHERE "profile_id" IN (${ids}) AND "status" = 'completed' AND "credits_spent" > 0
        GROUP BY "profile_id"
      )
      SELECT t."profile_id", COUNT(*)::int AS "zero_run"
      FROM "automaton_turns" t
      LEFT JOIN "last_spend" l ON l."profile_id" = t."profile_id"
      WHERE t."profile_id" IN (${ids}) AND t."status" = 'completed' AND (l."at" IS NULL OR t."started_at" > l."at")
      GROUP BY t."profile_id"`,
  ]);
  const latestBy = new Map(latest.map((row) => [row.profile_id, row]));
  const runBy = new Map(runs.map((row) => [row.profile_id, row.zero_run]));
  for (const subject of subjects) {
    const turn = latestBy.get(subject.profileId);
    result.set(subject.profileId, classifyNeedAttention({
      latestTurn: turn ? { status: turn.status, reason: turn.reason } : null,
      balance: subject.balance,
      zeroSpendRun: runBy.get(subject.profileId) ?? 0,
    }));
  }
  return result;
}

/** Every Active_Automaton with its reasons (status bar and the `attention` filter). */
export async function loadActiveNeedAttention(where: Prisma.AutomatonProfileWhereInput = {}): Promise<Map<number, NeedAttentionReason[]>> {
  const profiles = await prisma.automatonProfile.findMany({
    where: { AND: [where, { status: 'active' }] },
    select: { id: true, user: { select: { currency: true } } },
  });
  return loadNeedAttention(profiles.map((p) => ({ profileId: p.id, balance: p.user?.currency ?? null })));
}
