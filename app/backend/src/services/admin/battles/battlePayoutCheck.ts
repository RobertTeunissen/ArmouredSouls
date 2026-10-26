/**
 * Payout check for one battle: the credits written on the participants
 * compared with the `financial_ledger` entries that reference the battle.
 *
 * `financial_ledger` has no index on `metadata.battleId` (a lookup by it alone
 * is a ~26 s scan on ACC), so the lookup narrows by the participants' users and
 * the battle's cycle first (index `(user_id, cycle_number)`). Battles have no
 * cycle column; a battle fought after settlement N's start belongs to cycle N+1
 * (`cycle_snapshots.start_time`), and ±1 cycle covers clock edges.
 */
import prisma from '../../../lib/prisma';
import type { ParticipantFact } from './battleFacts';
import type { PayoutCheck, PayoutInputs, StablePayoutCheck, StableRef } from './battleTypes';

export interface LedgerEntry {
  id: number;
  transactionType: 'battle_income' | 'streaming_revenue';
  userId: number;
  robotId: number | null;
  amount: number;
  cycleNumber: number;
  metadata: Record<string, unknown> | null;
}

interface RawLedgerRow {
  id: number;
  transaction_type: string;
  user_id: number;
  robot_id: number | null;
  amount: number;
  cycle_number: number;
  metadata: unknown;
}

/** Best estimate of the cycle a battle was fought in, from settlement start times. */
export async function estimateBattleCycle(createdAt: Date): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ n: number | null }>>`
    SELECT max(cycle_number)::int AS n FROM cycle_snapshots WHERE start_time <= ${createdAt}
  `;
  return (rows[0]?.n ?? 0) + 1;
}

export async function loadBattleLedgerEntries(
  battleId: number,
  createdAt: Date,
  userIds: readonly number[],
): Promise<LedgerEntry[]> {
  if (userIds.length === 0) return [];
  const cycle = await estimateBattleCycle(createdAt);
  const rows = await prisma.$queryRaw<RawLedgerRow[]>`
    SELECT id, transaction_type, user_id, robot_id, amount, cycle_number, metadata
    FROM financial_ledger
    WHERE transaction_type IN ('battle_income', 'streaming_revenue')
      AND user_id = ANY(${[...userIds]}::int[])
      AND cycle_number BETWEEN ${cycle - 1} AND ${cycle + 1}
      AND (metadata::jsonb ->> 'battleId') = ${String(battleId)}
    ORDER BY id
  `;
  return rows.map((r) => ({
    id: r.id,
    transactionType: r.transaction_type as LedgerEntry['transactionType'],
    userId: r.user_id,
    robotId: r.robot_id,
    amount: Number(r.amount),
    cycleNumber: r.cycle_number,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
  }));
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function payoutInputs(metadata: Record<string, unknown> | null): PayoutInputs | null {
  if (!metadata) return null;
  return {
    participationFloor: num(metadata.participationFloor),
    winComponent: num(metadata.winComponent),
    teamSize: num(metadata.teamSize),
    modifiers: Array.isArray(metadata.modifiers) ? metadata.modifiers : [],
    formula: str(metadata.formula),
    formulaVersion: str(metadata.formulaVersion),
    outcome: str(metadata.outcome),
  };
}

/** Compare participant credits with ledger entries, per stable. Pure. */
export function comparePayouts(participants: readonly ParticipantFact[], entries: readonly LedgerEntry[]): PayoutCheck {
  const stables = new Map<number, { stable: StableRef; credits: number; streaming: number }>();
  for (const p of participants) {
    const s = stables.get(p.stable.userId) ?? { stable: p.stable, credits: 0, streaming: 0 };
    s.credits += p.credits;
    s.streaming += p.streamingRevenue;
    stables.set(p.stable.userId, s);
  }

  const result: StablePayoutCheck[] = [];
  for (const [userId, s] of stables) {
    const income = entries.filter(e => e.userId === userId && e.transactionType === 'battle_income');
    const streaming = entries.filter(e => e.userId === userId && e.transactionType === 'streaming_revenue');
    const incomeLedger = income.length > 0 ? income.reduce((sum, e) => sum + e.amount, 0) : null;
    const streamingLedger = streaming.length > 0 ? streaming.reduce((sum, e) => sum + e.amount, 0) : null;

    const incomeOk = incomeLedger === null ? s.credits === 0 : incomeLedger === s.credits;
    const streamingOk = streamingLedger === null ? s.streaming === 0 : streamingLedger === s.streaming;
    const missing = (incomeLedger === null && s.credits !== 0) || (streamingLedger === null && s.streaming !== 0);

    result.push({
      stable: s.stable,
      battleIncome: { participants: s.credits, ledger: incomeLedger },
      streaming: { participants: s.streaming, ledger: streamingLedger },
      status: missing ? 'missing' : incomeOk && streamingOk ? 'match' : 'mismatch',
      inputs: payoutInputs(income[0]?.metadata ?? null),
    });
  }

  let status: PayoutCheck['status'];
  if (result.length === 0) status = 'unavailable';
  else if (entries.length === 0 && result.some(r => r.status === 'missing')) status = 'unavailable';
  else if (result.some(r => r.status === 'mismatch')) status = 'mismatch';
  else if (result.some(r => r.status === 'missing')) status = 'missing';
  else status = 'match';

  return { status, stables: result, ledgerEntries: entries.length };
}

/** Cycle number recorded on the battle's ledger entries, when any were found. */
export function cycleFromEntries(entries: readonly LedgerEntry[]): number | null {
  return entries[0]?.cycleNumber ?? null;
}
