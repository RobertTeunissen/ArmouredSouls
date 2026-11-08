/**
 * `buildStandingStatuses` and `buildLeagueZoneMeta` (League Standings
 * redesign, Nov 2026): the status chip must say exactly what the executor's
 * tier plan will do, and why a zone place is held.
 */
import * as fc from 'fast-check';
import { buildLeagueTierPreview, type PlannableStanding } from '../../../src/services/league/league-rebalancing-preview';
import { HEAD_TO_HEAD_LEAGUE_RULES, PLACEMENT_LEAGUE_RULES } from '../../../src/services/league/league-rules';
import { buildStandingStatuses } from '../../../src/services/league/standing-status';
import { buildLeagueZoneMeta } from '../../../src/services/league/league-zone-meta';

const row = (entityId: number, leaguePoints: number, cyclesInTier: number, leagueInstanceId = 'diamond_1'): PlannableStanding =>
  ({ entityId, leaguePoints, cyclesInTier, leagueInstanceId });

/** 20 entities in one instance: 2 promotion and 2 demotion places. LP descends with id. */
function instance(overrides: Record<number, Partial<PlannableStanding>> = {}, tierInstance = 'diamond_1'): PlannableStanding[] {
  return Array.from({ length: 20 }, (_, i) => ({ ...row(i + 1, 200 - i * 5, 10, tierInstance), ...overrides[i + 1] }));
}

describe('buildStandingStatuses', () => {
  it('marks qualifying zone places as moving', () => {
    const preview = buildLeagueTierPreview('gold', instance({}, 'gold_1'), HEAD_TO_HEAD_LEAGUE_RULES, 50);
    const statuses = buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES);
    expect(statuses.get(1)).toEqual({ kind: 'promotes', zone: 'promotion' });
    expect(statuses.get(2)).toEqual({ kind: 'promotes', zone: 'promotion' });
    expect(statuses.get(19)).toEqual({ kind: 'demotes', zone: 'demotion' });
    expect(statuses.get(20)).toEqual({ kind: 'demotes', zone: 'demotion' });
    // Outside the fixed places there is no status, however eligible.
    expect(statuses.has(3)).toBe(false);
    expect(statuses.has(18)).toBe(false);
  });

  it('says how many cycles a zone place still needs, without backfilling', () => {
    const preview = buildLeagueTierPreview('gold', instance({ 1: { cyclesInTier: 3 }, 20: { cyclesInTier: 0 } }, 'gold_1'), HEAD_TO_HEAD_LEAGUE_RULES, 50);
    const statuses = buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES);
    expect(statuses.get(1)).toEqual({ kind: 'held_cycles', zone: 'promotion', cyclesToGo: 2 });
    expect(statuses.get(20)).toEqual({ kind: 'held_cycles', zone: 'demotion', cyclesToGo: 5 });
    expect(statuses.has(3)).toBe(false);
  });

  /** ACC, 1v1 Diamond 1, Nov 2026: the whole top of the instance sat at 119–123 LP. */
  const belowMinimum = (overrides: Record<number, Partial<PlannableStanding>> = {}): PlannableStanding[] =>
    Array.from({ length: 20 }, (_, i) => ({ ...row(i + 1, 123 - i, 10), ...overrides[i + 1] }));

  it('names the LP minimum when a promotion place is below it (Diamond: 125)', () => {
    const preview = buildLeagueTierPreview('diamond', belowMinimum(), HEAD_TO_HEAD_LEAGUE_RULES, 34);
    const statuses = buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES);
    expect(statuses.get(1)).toEqual({ kind: 'held_lp', zone: 'promotion', minLP: 125 });
    expect(statuses.get(2)).toEqual({ kind: 'held_lp', zone: 'promotion', minLP: 125 });
  });

  it('reports residency before the LP minimum when both fail', () => {
    const preview = buildLeagueTierPreview('diamond', belowMinimum({ 1: { cyclesInTier: 1 } }), HEAD_TO_HEAD_LEAGUE_RULES, 34);
    expect(buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES).get(1)).toEqual({ kind: 'held_cycles', zone: 'promotion', cyclesToGo: 4 });
  });

  it('holds a qualifying promotion when the empty tier above needs a larger cohort', () => {
    // 2 qualifiers into an empty Champion: below the 3-entity cohort.
    const preview = buildLeagueTierPreview('diamond', instance({ 1: { leaguePoints: 300 }, 2: { leaguePoints: 290 } }), HEAD_TO_HEAD_LEAGUE_RULES, 0);
    const statuses = buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES);
    expect(preview.plan.promotionBlockReason).toBe('destination_cohort_too_small');
    expect(statuses.get(1)).toEqual({ kind: 'held_cohort', zone: 'promotion' });
  });

  it('uses the placement rules for KotH and Grand Melee (10 cycles, no LP gate)', () => {
    const preview = buildLeagueTierPreview('platinum', instance({ 1: { cyclesInTier: 6 }, 2: { leaguePoints: 1 } }, 'platinum_1'), PLACEMENT_LEAGUE_RULES, 300);
    const statuses = buildStandingStatuses(preview, PLACEMENT_LEAGUE_RULES);
    expect(statuses.get(1)).toEqual({ kind: 'held_cycles', zone: 'promotion', cyclesToGo: 4 });
  });

  it('gives no status in an instance below the 10-entity minimum', () => {
    const rows = instance().slice(0, 9);
    const preview = buildLeagueTierPreview('gold', rows, HEAD_TO_HEAD_LEAGUE_RULES, 50);
    expect(buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES).size).toBe(0);
  });

  it('agrees with the executor plan for any tier (property)', () => {
    const tiers = HEAD_TO_HEAD_LEAGUE_RULES.tiers;
    fc.assert(fc.property(
      fc.constantFrom(...tiers),
      fc.array(fc.record({ lp: fc.integer({ min: 0, max: 400 }), cycles: fc.integer({ min: 0, max: 12 }), inst: fc.integer({ min: 1, max: 3 }) }), { maxLength: 80 }),
      fc.integer({ min: 0, max: 40 }),
      (tier, specs, destination) => {
        const rows = specs.map((s, i) => row(i + 1, s.lp, s.cycles, `${tier}_${s.inst}`));
        const preview = buildLeagueTierPreview(tier, rows, HEAD_TO_HEAD_LEAGUE_RULES, destination);
        const statuses = buildStandingStatuses(preview, HEAD_TO_HEAD_LEAGUE_RULES);
        const ids = (kind: string) => [...statuses].filter(([, s]) => s.kind === kind).map(([id]) => id).sort((a, b) => a - b);
        expect(ids('promotes')).toEqual([...preview.effectivePromotionEntityIds].sort((a, b) => a - b));
        expect(ids('demotes')).toEqual([...preview.demotionEntityIds].sort((a, b) => a - b));
        // Every status sits in a fixed zone place of its instance.
        for (const [id, status] of statuses) {
          const inst = preview.plan.instancePlans.find((p) => [...p.promotionZone, ...p.demotionZone].some((s) => s.entityId === id));
          expect(inst).toBeDefined();
          if (status.kind === 'held_cycles') expect(status.cyclesToGo).toBeGreaterThan(0);
        }
      },
    ));
  });
});

describe('buildLeagueZoneMeta', () => {
  it('has no LP minimum in Champion (it used to serialise Infinity as null and render "≥ LP")', () => {
    const preview = buildLeagueTierPreview('champion', instance({}, 'champion_1'), HEAD_TO_HEAD_LEAGUE_RULES, 0);
    const meta = buildLeagueZoneMeta(preview, HEAD_TO_HEAD_LEAGUE_RULES, 'champion');
    expect(meta).toMatchObject({ minLP: null, isChampion: true, promotionSlots: 0, demotionSlots: 2 });
  });

  it('projects a selected instance and counts paused instances', () => {
    const rows = [...instance({}, 'gold_1'), ...instance({}, 'gold_2').slice(0, 5).map((r) => ({ ...r, entityId: r.entityId + 100 }))];
    const preview = buildLeagueTierPreview('gold', rows, HEAD_TO_HEAD_LEAGUE_RULES, 50);
    expect(buildLeagueZoneMeta(preview, HEAD_TO_HEAD_LEAGUE_RULES, 'gold')).toMatchObject({
      minLP: 75, totalInstances: 2, activeInstances: 1, instancesBelowMinimum: 1, totalEntities: 25, promotionSlots: 2,
    });
    expect(buildLeagueZoneMeta(preview, HEAD_TO_HEAD_LEAGUE_RULES, 'gold', 'gold_2')).toMatchObject({
      totalInstances: 1, totalEntities: 5, hasEnoughRobots: false, promotionSlots: 0,
    });
    expect(buildLeagueZoneMeta(preview, HEAD_TO_HEAD_LEAGUE_RULES, 'gold', 'gold_9')).toMatchObject({ totalInstances: 0, totalEntities: 0 });
  });
});
