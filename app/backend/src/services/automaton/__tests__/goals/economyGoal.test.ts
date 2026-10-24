import { createEconomyGoal, ECONOMY_MIN_HISTORY_CYCLES } from '../../goals/economyGoal';
import { economyCandidates, estimateRecurring } from '../../economyEstimate';
import type { EconomyFacts, StableHistoryFacts } from '../../stableHistory';
import type { FacilityType, StableFacts } from '../../stableFacts';
import { context, facilities, stable } from '../helpers/automatonFixtures';

const GOAL_ID = 'test.v2.04.economy';
const economyGoal = createEconomyGoal(GOAL_ID);

/** A Duo-like deficit: ₡60k battle income, ₡6k streaming, ₡110k repairs, ₡1k roster upkeep per cycle. */
function economy(overrides: Partial<EconomyFacts> = {}): EconomyFacts {
  return {
    cycles: 3,
    battleIncomePerCycle: 60_000,
    streamingBasePerCycle: 6_000,
    repairBasePerCycle: 110_000,
    otherOperatingPerCycle: 1_000,
    remainingCycles: 50,
    ...overrides,
  };
}

function withEconomy(
  economyFacts: EconomyFacts | null,
  overrides: Partial<StableFacts> = {},
  levels: Partial<Record<FacilityType, number>> = {},
): StableFacts {
  const history: StableHistoryFacts = { economy: economyFacts, eventResults: [] };
  return stable({ facilities: facilities(levels), history, ...overrides });
}

describe('economy estimate', () => {
  it('re-prices repairs, streaming, merchandising and upkeep at the given facility levels', () => {
    const facts = withEconomy(economy());
    expect(estimateRecurring(facts, economy())).toEqual({
      battleIncome: 60_000, streaming: 6_000, merchandising: 0, repairs: 110_000, upkeep: 1_000, net: -45_000,
    });
    const upgraded = estimateRecurring(facts, economy(), facilities({ repair_bay: 2, streaming_studio: 2, merchandising_hub: 1 }));
    // Repairs −12%, streaming ×2, merchandising ₡25,000, upkeep 1,500 + 200 + 200 + 1,000.
    expect(upgraded.repairs).toBeCloseTo(96_800);
    expect(upgraded.streaming).toBe(12_000);
    expect(upgraded.merchandising).toBe(25_000);
    expect(upgraded.upkeep).toBe(2_900);
  });

  it('prices each next level by its change of the recurring net and its payback', () => {
    const [merch, repair, streaming] = economyCandidates(withEconomy(economy()), economy());
    expect(merch).toMatchObject({ facilityType: 'merchandising_hub', gainPerCycle: 24_800 });
    expect(merch.paybackCycles).toBeCloseTo(150_000 / 24_800);
    expect(repair).toMatchObject({ facilityType: 'repair_bay' });
    expect(repair.gainPerCycle).toBeCloseTo(6_600 - 1_000);
    expect(streaming.gainPerCycle).toBeCloseTo(3_000 - 100);
  });
});

describe('Economy Goal', () => {
  it('is Satisfied when off, without enough history, or without a deficit', () => {
    const deficit = withEconomy(economy());
    expect(economyGoal.evaluate(deficit, context(deficit, { target: 0 })).kind).toBe('satisfied');
    expect(economyGoal.evaluate(stable(), context(stable(), { target: 20 })).kind).toBe('satisfied');
    const fresh = withEconomy(null);
    expect(economyGoal.evaluate(fresh, context(fresh, { target: 20 })).kind).toBe('satisfied');
    const short = withEconomy(economy({ cycles: ECONOMY_MIN_HISTORY_CYCLES - 1 }));
    expect(economyGoal.evaluate(short, context(short, { target: 20 })).kind).toBe('satisfied');
    const healthy = withEconomy(economy({ battleIncomePerCycle: 200_000 }));
    expect(economyGoal.evaluate(healthy, context(healthy, { target: 20 })).kind).toBe('satisfied');
  });

  it('buys the level with the shortest payback while the stable runs a deficit', () => {
    const facts = withEconomy(economy());
    expect(economyGoal.evaluate(facts, context(facts, { target: 20 }))).toEqual({
      kind: 'actionable',
      goalId: GOAL_ID,
      action: { kind: 'facility_upgrade', facilityType: 'merchandising_hub', toLevel: 1, cost: 150_000 },
      cost: 150_000,
    });
  });

  it('moves on to the next-best level once a bought level is priced in, and stops when the deficit is covered', () => {
    const afterMerch = withEconomy(economy(), {}, { merchandising_hub: 1 });
    expect(economyGoal.evaluate(afterMerch, context(afterMerch, { target: 20 }))).toMatchObject({
      kind: 'actionable', action: { facilityType: 'repair_bay', toLevel: 1, cost: 50_000 },
    });
    // ₡25,000 merchandising and a 12% Repair Bay leave a small deficit; a richer battle income covers it.
    const covered = withEconomy(economy({ battleIncomePerCycle: 85_000 }), {}, { merchandising_hub: 1, repair_bay: 2 });
    expect(economyGoal.evaluate(covered, context(covered, { target: 20 })).kind).toBe('satisfied');
  });

  it('saves for the level when the balance is short, so nothing lower is bought', () => {
    const facts = withEconomy(economy(), { balance: 100_000 });
    expect(economyGoal.evaluate(facts, context(facts, { target: 20 }))).toEqual({
      kind: 'saving',
      goalId: GOAL_ID,
      cost: 150_000,
      detail: { facilityType: 'merchandising_hub', toLevel: 1, paybackCycles: 7, actionKind: 'facility_upgrade' },
    });
  });

  it('only buys what pays back within the target and the cycles left in the season', () => {
    const facts = withEconomy(economy());
    expect(economyGoal.evaluate(facts, context(facts, { target: 5 })).kind).toBe('satisfied');
    const lateSeason = withEconomy(economy({ remainingCycles: 4 }));
    expect(economyGoal.evaluate(lateSeason, context(lateSeason, { target: 20 })).kind).toBe('satisfied');
    const noLength = withEconomy(economy({ remainingCycles: null }));
    expect(economyGoal.evaluate(noLength, context(noLength, { target: 20 })).kind).toBe('actionable');
  });

  it('is Blocked when none of the three facilities can be bought', () => {
    const heavyRepairs = economy({ repairBasePerCycle: 300_000 });
    const facts = withEconomy(heavyRepairs, { prestige: 0 }, { merchandising_hub: 3, repair_bay: 3, streaming_studio: 3 });
    expect(economyGoal.evaluate(facts, context(facts, { target: 20 }))).toMatchObject({
      kind: 'blocked', reason: 'prestige_gate', detail: { facilityType: 'merchandising_hub', level: 4 },
    });
  });

  it('passes over a gated facility and buys the next-best available one', () => {
    const facts = withEconomy(economy({ repairBasePerCycle: 300_000 }), { prestige: 0 }, { merchandising_hub: 3 });
    expect(economyGoal.evaluate(facts, context(facts, { target: 20 }))).toMatchObject({
      kind: 'actionable', action: { facilityType: 'repair_bay', toLevel: 1 },
    });
  });
});
