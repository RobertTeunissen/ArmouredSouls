/**
 * Reconciliation signature 2 (design §11, R3): a fought battle with missing income.
 *
 * Any mode can leave this behind when an exception hits after the battle row was
 * written: for some stable, the sum of its robots' `battle_participants.credits`
 * is > 0 but that stable has no `battle_income` ledger row whose breakdown
 * `metadata.battleId` is the battle. Matching on the breakdown battle id (the
 * field the Finance Center deployment query reads) covers every income identity:
 * fought battles (`battle:`), byes (`bye:`) and forfeit wins (`forfeit:`), with
 * or without the optional `robot:{id}` component. Stables with 0 credits are
 * excluded because `awardCreditsWithLedger` writes nothing for an amount <= 0.
 * The check is battle-centric, so it also finds battles whose queued match was
 * cancelled.
 *
 * The same query is the operator check documented in the financial ledger guide.
 */
import prisma from '../../src/lib/prisma';
export interface MissingIncomeRow {
  battleId: number;
  stableId: number;
  credits: number;
}
/** Fought battles (restricted to `battleIds`) that owe a stable its battle income. */
export async function findFoughtBattlesMissingIncome(battleIds: readonly number[]): Promise<MissingIncomeRow[]> {
  if (battleIds.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<{ battleId: number; stableId: number; credits: number }>>`
    SELECT bp.battle_id AS "battleId", r.user_id AS "stableId", SUM(bp.credits)::int AS credits
    FROM battle_participants bp
    JOIN robots r ON r.id = bp.robot_id
    WHERE bp.battle_id = ANY(${[...battleIds]}::int[])
    GROUP BY bp.battle_id, r.user_id
    HAVING SUM(bp.credits) > 0
       AND NOT EXISTS (
         SELECT 1 FROM financial_ledger fl
         WHERE fl.transaction_type = 'battle_income'
           AND fl.user_id = r.user_id
           AND fl.metadata->>'battleId' = bp.battle_id::text
       )
    ORDER BY bp.battle_id, r.user_id
  `;
  return rows.map((r) => ({ battleId: Number(r.battleId), stableId: Number(r.stableId), credits: Number(r.credits) }));
}
