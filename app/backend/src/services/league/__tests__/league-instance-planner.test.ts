import * as fc from 'fast-check';
import {
  INSTANCE_HEADROOM,
  InstanceSize,
  planInstanceMaintenance,
  targetInstanceCount,
} from '../league-instance-planner';

const MAX = 100;

function tier(counts: number[]): InstanceSize[] {
  return counts.map((count, index) => ({
    leagueId: `bronze_${index + 1}`,
    instanceNumber: index + 1,
    count,
  }));
}

/** Instance sizes after an even round-robin deal of `total` over `instances`. */
function evenDeal(total: number, instances: number): number[] {
  return Array.from({ length: instances }, (_, i) =>
    Math.floor(total / instances) + (i < total % instances ? 1 : 0));
}

describe('targetInstanceCount', () => {
  it('leaves INSTANCE_HEADROOM free places per instance on average', () => {
    expect(INSTANCE_HEADROOM).toBe(20);
    expect(targetInstanceCount(0, MAX)).toBe(0);
    expect(targetInstanceCount(1, MAX)).toBe(1);
    expect(targetInstanceCount(80, MAX)).toBe(1);
    expect(targetInstanceCount(81, MAX)).toBe(2);
    expect(targetInstanceCount(1100, MAX)).toBe(14);
  });

  it('never exceeds the instance maximum', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5000 }), (total) => {
      expect(Math.ceil(total / targetInstanceCount(total, MAX))).toBeLessThanOrEqual(MAX);
    }));
  });
});

describe('planInstanceMaintenance (issue #603)', () => {
  it('leaves a balanced tier alone, whatever the LP changes', () => {
    expect(planInstanceMaintenance(tier([92, 91, 90, 93]), MAX)).toEqual({ action: 'none' });
    expect(planInstanceMaintenance(tier([100]), MAX)).toEqual({ action: 'none' });
    expect(planInstanceMaintenance([], MAX)).toEqual({ action: 'none' });
  });

  it('re-deals an instance above the maximum', () => {
    expect(planInstanceMaintenance(tier([331]), MAX)).toEqual({
      action: 'redeal', reason: 'overflow', targetInstanceCount: 5,
    });
  });

  it('re-deals a split: every instance full and a new one opened', () => {
    expect(planInstanceMaintenance(tier([100, 100, 100, 1]), MAX)).toEqual({
      action: 'redeal', reason: 'imbalance', targetInstanceCount: 4,
    });
  });

  it('re-deals an instance more than 20 off the tier target', () => {
    expect(planInstanceMaintenance(tier([95, 95, 55]), MAX)).toMatchObject({
      action: 'redeal', reason: 'imbalance',
    });
    expect(planInstanceMaintenance(tier([95, 95, 76]), MAX)).toEqual({ action: 'none' });
  });

  it('merges a shrunken tier by dissolving the highest-numbered instances', () => {
    // 11 instances of 72 = 792 entities: fits in 10 instances of ≤ 80.
    expect(planInstanceMaintenance(tier(Array(11).fill(72)), MAX)).toEqual({
      action: 'merge',
      keep: Array.from({ length: 10 }, (_, i) => `bronze_${i + 1}`),
      dissolve: ['bronze_11'],
    });
    // 3 instances of 50 fit in 2.
    expect(planInstanceMaintenance(tier([50, 50, 50]), MAX)).toEqual({
      action: 'merge', keep: ['bronze_1', 'bronze_2'], dissolve: ['bronze_3'],
    });
  });

  it('does not merge while the smaller instance count would be nearly full', () => {
    // 11 × 75 = 825 would need 10 instances of 82.5: keep 11.
    expect(planInstanceMaintenance(tier(Array(11).fill(75)), MAX)).toEqual({ action: 'none' });
  });

  it('keeps the lowest numbers when instance numbers have gaps', () => {
    const sizes: InstanceSize[] = [
      { leagueId: 'silver_1', instanceNumber: 1, count: 40 },
      { leagueId: 'silver_4', instanceNumber: 4, count: 40 },
      { leagueId: 'silver_2', instanceNumber: 2, count: 40 },
    ];
    expect(planInstanceMaintenance(sizes, MAX)).toEqual({
      action: 'merge', keep: ['silver_1', 'silver_2'], dissolve: ['silver_4'],
    });
  });

  it('is stable right after any re-deal or merge (no flip-flopping)', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 5000 }), (total) => {
      const sizes = evenDeal(total, targetInstanceCount(total, MAX));
      expect(planInstanceMaintenance(tier(sizes), MAX)).toEqual({ action: 'none' });
    }));
  });

  it('only merges after a split once the tier fits in one fewer instance with headroom', () => {
    // A split of k full instances deals 100k + 1 over targetInstanceCount instances;
    // the tier must then shrink to ≤ 80 per instance of one fewer before it merges.
    fc.assert(fc.property(fc.integer({ min: 1, max: 30 }), (full) => {
      const total = full * MAX + 1;
      const instances = targetInstanceCount(total, MAX);
      expect(planInstanceMaintenance(tier(evenDeal(total, instances)), MAX)).toEqual({ action: 'none' });
      const mergesAt = (instances - 1) * (MAX - INSTANCE_HEADROOM);
      expect(planInstanceMaintenance(tier(evenDeal(mergesAt + 1, instances)), MAX)).toEqual({ action: 'none' });
      expect(planInstanceMaintenance(tier(evenDeal(mergesAt, instances)), MAX)).toMatchObject({ action: 'merge' });
    }));
  });
});
