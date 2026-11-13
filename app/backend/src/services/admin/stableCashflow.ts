/**
 * One stable's cashflow over its last cycles, from `financial_ledger`: the
 * balance after each cycle's last row and what it earned, paid in running
 * costs (repairs + operating costs) and bought. Shared by the Players detail
 * panel and the Automaton Editor's Cashflow card.
 *
 * @module services/admin/stableCashflow
 */

import prisma from '../../lib/prisma';
import { BANKRUPTCY_RISK_THRESHOLD } from './adminThresholds';
import type { StableCashflow, StableCashflowCycle } from '../../shared/types';

/** Cycles the cashflow covers, including the ledger's cycle in progress. */
const STABLE_CASHFLOW_CYCLES = 10;

interface CashflowRow {
  cycle_number: number;
  balance_after: number;
  earned: bigint | number | null;
  running: bigint | number | null;
  bought: bigint | number | null;
}

const num = (value: bigint | number | null): number => (value === null ? 0 : Number(value));

/** The last `STABLE_CASHFLOW_CYCLES` ledger cycles of one stable. */
export async function readStableCashflow(userId: number): Promise<StableCashflow> {
  const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 }, select: { totalCycles: true } });
  // The ledger's cycle in progress is totalCycles + 1; it is included.
  const fromCycle = Math.max(0, (meta?.totalCycles ?? 0) + 2 - STABLE_CASHFLOW_CYCLES);
  const rows = await prisma.$queryRaw<CashflowRow[]>`
    SELECT l.cycle_number, l.balance_after, t.earned, t.running, t.bought
    FROM (
      SELECT DISTINCT ON (cycle_number) cycle_number, balance_after
      FROM financial_ledger
      WHERE user_id = ${userId} AND cycle_number >= ${fromCycle}
      ORDER BY cycle_number, id DESC
    ) l
    JOIN (
      SELECT cycle_number,
        SUM(amount) FILTER (WHERE amount > 0) AS earned,
        -SUM(amount) FILTER (WHERE amount < 0 AND transaction_type IN ('repair_cost', 'operating_costs')) AS running,
        -SUM(amount) FILTER (WHERE amount < 0 AND transaction_type NOT IN ('repair_cost', 'operating_costs')) AS bought
      FROM financial_ledger
      WHERE user_id = ${userId} AND cycle_number >= ${fromCycle}
      GROUP BY cycle_number
    ) t ON t.cycle_number = l.cycle_number
    ORDER BY l.cycle_number`;
  const points = rows.map((row): StableCashflowCycle => ({
    cycle: row.cycle_number,
    balance: row.balance_after,
    earned: num(row.earned),
    runningCosts: num(row.running),
    bought: num(row.bought),
  }));
  return {
    points,
    earned: points.reduce((sum, p) => sum + p.earned, 0),
    runningCosts: points.reduce((sum, p) => sum + p.runningCosts, 0),
    bought: points.reduce((sum, p) => sum + p.bought, 0),
    lowBalanceCycles: points.filter((p) => p.balance < BANKRUPTCY_RISK_THRESHOLD).length,
  };
}
