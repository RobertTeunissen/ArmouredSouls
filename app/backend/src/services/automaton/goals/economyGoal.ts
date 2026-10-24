/**
 * Economy Goal: "Economy → {n} cycles".
 *
 * Acts only while the stable runs a deficit: when its recent recurring
 * income is below its recurring costs (`economyEstimate.ts`), it buys the
 * Repair Bay, Merchandising Hub or Streaming Studio level that pays for
 * itself soonest, provided that payback is at most the Goal_Target in cycles
 * and at most the competitive cycles left in the season (facilities are reset
 * at Season_Rollover). Like every Goal, it saves for that level when the
 * balance is short, so nothing lower in the Build_Order is bought meanwhile.
 *
 * Satisfied when the target is 0 (off), when the stable has fewer than
 * ECONOMY_MIN_HISTORY_CYCLES closed cycles of recurring entries this season
 * (no evidence yet, e.g. the opening build), when the estimate is not a
 * deficit, or when no level pays back in time. Blocked when none of the
 * three facilities can be bought at all (Prestige_Gate or maximum level).
 *
 * Re-priced from the current facility levels on every evaluation, so the
 * Goal stops as soon as the bought levels cover the deficit.
 */
import { economyCandidates, estimateRecurring, type EconomyCandidate } from '../economyEstimate';
import type { StableFacts } from '../stableFacts';
import { blockedFromQuote } from './goalSupport';
import { savingOrActionable, type Goal, type GoalContext, type GoalOutcome } from './goalTypes';

/** Closed cycles of recurring entries the Goal needs before it acts. */
export const ECONOMY_MIN_HISTORY_CYCLES = 2;

/** The candidate with the shortest payback within `limit` cycles; ties keep ECONOMY_FACILITY_TYPES order. */
function bestCandidate(candidates: readonly EconomyCandidate[], limit: number): EconomyCandidate | null {
  let best: EconomyCandidate | null = null;
  for (const candidate of candidates) {
    if (candidate.paybackCycles === null || candidate.paybackCycles > limit) continue;
    if (best === null || candidate.paybackCycles < (best.paybackCycles as number)) best = candidate;
  }
  return best;
}

/** Create the Goal "Economy → {target} cycles". */
export function createEconomyGoal(id: string): Goal {
  return {
    id,
    evaluate(facts: StableFacts, ctx: GoalContext): GoalOutcome {
      const economy = facts.history?.economy ?? null;
      if (ctx.target <= 0 || economy === null || economy.cycles < ECONOMY_MIN_HISTORY_CYCLES) {
        return { kind: 'satisfied', goalId: id };
      }
      if (estimateRecurring(facts, economy).net >= 0) return { kind: 'satisfied', goalId: id };

      const candidates = economyCandidates(facts, economy);
      const purchasable = candidates.filter((c) => c.quote.kind === 'available');
      if (purchasable.length === 0) {
        const first = candidates[0].quote;
        const blocked = first.kind === 'available' ? null : blockedFromQuote(first);
        if (blocked) return { kind: 'blocked', goalId: id, reason: blocked.reason, detail: blocked.detail };
      }

      const limit = Math.min(ctx.target, economy.remainingCycles ?? Number.POSITIVE_INFINITY);
      const best = bestCandidate(candidates, limit);
      if (best === null || best.quote.kind !== 'available') return { kind: 'satisfied', goalId: id };

      const { facilityType, toLevel, cost } = best.quote;
      return savingOrActionable(
        id,
        { kind: 'facility_upgrade', facilityType, toLevel, cost },
        cost,
        ctx.balance,
        { facilityType, toLevel, paybackCycles: Math.ceil(best.paybackCycles as number) },
      );
    },
  };
}
