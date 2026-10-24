/**
 * Recurring economy estimate of an Automaton (Economy Goal, `goals/economyGoal.ts`).
 *
 * Re-prices the stable's recent recurring income and costs
 * (`EconomyFacts`, `stableHistory.ts`) at any set of facility levels, with
 * the formulas the charging paths use:
 * - repairs: the recorded pre-discount repair spend × (1 − Repair Bay
 *   discount) (`calculateRepairBayDiscountPercent`);
 * - streaming: the recorded spend at Studio Multiplier 1 × (1 + 0.5 × level)
 *   (`STREAMING_STUDIO_PER_LEVEL`);
 * - merchandising: `calculateMerchandisingIncome` at the stable's prestige
 *   and Roster_Capacity;
 * - upkeep: `calculateFacilityOperatingCost` per facility plus the roster
 *   upkeep the history recorded.
 * Battle income does not depend on these facilities and is taken as recorded.
 *
 * Pure: the same facts give the same estimate. Because the estimate is
 * re-priced from the current levels, buying a level changes it at once, so
 * the Economy Goal stops buying as soon as the stable is projected to cover
 * its costs.
 */
import { calculateMerchandisingIncome } from '../../utils/economyFormulas';
import { calculateRepairBayDiscountPercent } from '../../shared/utils/repairCost';
import { getRosterCapacity } from '../../shared/utils/rosterCapacity';
import { STREAMING_STUDIO_PER_LEVEL } from '../economy/streamingRevenueService';
import { quoteFacilityLevel, type FacilityLevelQuote } from './pricing';
import type { FacilityType, StableFacts } from './stableFacts';
import { facilityUpkeepPerCycle, type EconomyFacts } from './stableHistory';

/** Facilities the Economy Goal can buy, in tie-break order (cheapest first-level payback first). */
export const ECONOMY_FACILITY_TYPES = ['merchandising_hub', 'repair_bay', 'streaming_studio'] as const;
export type EconomyFacilityType = (typeof ECONOMY_FACILITY_TYPES)[number];

/** The parts of the estimate, per cycle. */
export interface RecurringEstimate {
  battleIncome: number;
  streaming: number;
  merchandising: number;
  repairs: number;
  upkeep: number;
  /** Income minus costs. */
  net: number;
}

/** One facility level the Economy Goal could buy. */
export interface EconomyCandidate {
  facilityType: EconomyFacilityType;
  quote: FacilityLevelQuote;
  /** Change of the recurring net per cycle once the level is bought. */
  gainPerCycle: number;
  /** Cycles until the level has paid for itself; null when it never does (gain ≤ 0) or cannot be bought. */
  paybackCycles: number | null;
}

/** The recurring estimate of `facts` at `facilities` (the stable's own levels by default). */
export function estimateRecurring(
  facts: Pick<StableFacts, 'prestige' | 'facilities'>,
  economy: EconomyFacts,
  facilities: Readonly<Record<FacilityType, number>> = facts.facilities,
): RecurringEstimate {
  const repairDiscount = calculateRepairBayDiscountPercent(facilities.repair_bay) / 100;
  const repairs = economy.repairBasePerCycle * (1 - repairDiscount);
  const streaming = economy.streamingBasePerCycle * (1 + STREAMING_STUDIO_PER_LEVEL * facilities.streaming_studio);
  const merchandising = calculateMerchandisingIncome(
    facilities.merchandising_hub,
    facts.prestige,
    getRosterCapacity(facilities.roster_expansion),
  );
  const upkeep = facilityUpkeepPerCycle(facilities) + economy.otherOperatingPerCycle;
  const battleIncome = economy.battleIncomePerCycle;
  return {
    battleIncome,
    streaming,
    merchandising,
    repairs,
    upkeep,
    net: battleIncome + streaming + merchandising - repairs - upkeep,
  };
}

/** The next level of each Economy facility, with its gain and payback, in ECONOMY_FACILITY_TYPES order. */
export function economyCandidates(facts: Pick<StableFacts, 'prestige' | 'facilities'>, economy: EconomyFacts): EconomyCandidate[] {
  const now = estimateRecurring(facts, economy).net;
  return ECONOMY_FACILITY_TYPES.map((facilityType) => {
    const quote = quoteFacilityLevel(facilityType, facts.facilities[facilityType], facts.prestige);
    if (quote.kind === 'max_level') return { facilityType, quote, gainPerCycle: 0, paybackCycles: null };
    const next = { ...facts.facilities, [facilityType]: quote.toLevel };
    const gainPerCycle = estimateRecurring(facts, economy, next).net - now;
    const paybackCycles = quote.kind === 'available' && gainPerCycle > 0 ? quote.cost / gainPerCycle : null;
    return { facilityType, quote, gainPerCycle, paybackCycles };
  });
}
