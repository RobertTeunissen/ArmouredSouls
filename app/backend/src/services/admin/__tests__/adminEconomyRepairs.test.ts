/**
 * Unit tests of the Economy page's Repairs block (it replaced the Repair Log):
 * totals per repair type with the Repair Bay and Manual Repair discounts,
 * player stables that repaired, and every stable type side by side.
 */
jest.mock('../../../lib/prisma', () => ({ __esModule: true, default: {} }));

import { summarizeRepairs, type PlayerRepairRow, type RepairGroup } from '../adminEconomyService';

// ACC players, cycles 86–92 (1 Nov 2026), split over two cycles.
const groups: RepairGroup[] = [
  { kind: 'players', cycle: 91, repairType: 'automatic', repairs: 1_000, fullPrice: 40_000_000, afterRepairBay: 22_000_000, paid: 22_000_000 },
  { kind: 'players', cycle: 92, repairType: 'automatic', repairs: 544, fullPrice: 25_829_219, afterRepairBay: 15_415_132, paid: 15_415_132 },
  { kind: 'players', cycle: 92, repairType: 'manual', repairs: 377, fullPrice: 27_926_073, afterRepairBay: 14_602_131, paid: 7_301_010 },
  { kind: 'automatons', cycle: 92, repairType: 'automatic', repairs: 17_965, fullPrice: 196_495_323, afterRepairBay: 183_716_279, paid: 183_716_279 },
  { kind: 'generated', cycle: 92, repairType: 'automatic', repairs: 109_029, fullPrice: 1_028_180_412, afterRepairBay: 1_028_180_412, paid: 1_028_180_412 },
  { kind: 'other', cycle: 92, repairType: 'automatic', repairs: 3, fullPrice: 300, afterRepairBay: 300, paid: 300 },
  // Outside a window that starts at cycle 86.
  { kind: 'players', cycle: 80, repairType: 'manual', repairs: 50, fullPrice: 1_000_000, afterRepairBay: 600_000, paid: 300_000 },
];

const playerRows: PlayerRepairRow[] = [
  { userId: 1, cycle: 91, repairType: 'automatic' },
  { userId: 1, cycle: 92, repairType: 'manual' },
  { userId: 2, cycle: 92, repairType: 'automatic' },
  { userId: 3, cycle: 92, repairType: 'manual' },
  { userId: 4, cycle: 80, repairType: 'manual' }, // outside the window
];

describe('summarizeRepairs', () => {
  it('splits the players\' full price into Repair Bay and Manual Repair discounts and what was paid', () => {
    const repairs = summarizeRepairs(groups, playerRows, 'players', 86, 92);

    expect(repairs.automatic).toEqual({ repairs: 1_544, fullPrice: 65_829_219, repairBayDiscount: 28_414_087, manualDiscount: 0, paid: 37_415_132 });
    expect(repairs.manual).toEqual({ repairs: 377, fullPrice: 27_926_073, repairBayDiscount: 13_323_942, manualDiscount: 7_301_121, paid: 7_301_010 });
    expect(repairs.total).toEqual({ repairs: 1_921, fullPrice: 93_755_292, repairBayDiscount: 41_738_029, manualDiscount: 7_301_121, paid: 44_716_142 });
    expect(repairs.total.fullPrice - repairs.total.repairBayDiscount - repairs.total.manualDiscount).toBe(repairs.total.paid);
    expect(repairs.playerStables).toEqual({ repairing: 3, manual: 2 });
  });

  it('compares every stable type in the same window, whatever the scope', () => {
    const { byStableType } = summarizeRepairs(groups, playerRows, 'automatons', 86, 92);

    expect(byStableType).toEqual([
      { stables: 'players', repairs: 1_921, paid: 44_716_142, repairBayShare: 44.5, manualShare: 19.6 },
      { stables: 'automatons', repairs: 17_965, paid: 183_716_279, repairBayShare: 6.5, manualShare: 0 },
      { stables: 'generated', repairs: 109_029, paid: 1_028_180_412, repairBayShare: 0, manualShare: 0 },
    ]);
  });

  it('has no player stable counts outside the players and all scopes', () => {
    expect(summarizeRepairs(groups, playerRows, 'automatons', 86, 92).playerStables).toBeNull();
    expect(summarizeRepairs(groups, playerRows, 'all', 86, 92).playerStables).toEqual({ repairing: 3, manual: 2 });
    // All includes the "other" stables (system accounts) in the totals.
    expect(summarizeRepairs(groups, playerRows, 'all', 86, 92).total.repairs).toBe(1_921 + 17_965 + 109_029 + 3);
  });

  it('honours the window and is empty-safe', () => {
    expect(summarizeRepairs(groups, playerRows, 'players', 1, 92).manual.repairs).toBe(427);
    expect(summarizeRepairs(groups, playerRows, 'players', 1, 92).playerStables).toEqual({ repairing: 4, manual: 3 });

    const empty = summarizeRepairs([], [], 'players', 1, 0);
    expect(empty.total).toEqual({ repairs: 0, fullPrice: 0, repairBayDiscount: 0, manualDiscount: 0, paid: 0 });
    expect(empty.byStableType.every((row) => row.repairBayShare === null && row.manualShare === null)).toBe(true);
  });
});
