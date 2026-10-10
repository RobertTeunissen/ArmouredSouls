/**
 * Spec #55 task 9.9 — the pure upgrade evaluation behind the dry-run, the
 * confirm and the Strategy_Draft upgrade warning (R3.6, R3.7, R6.6, design
 * §14.0a, decision 37).
 */
import { evaluateUpgrade, type UpgradeSubject } from '../strategyUpgradeService';
import { duoV1Definition, registryWithDuoV2 } from './helpers/upgradeFixtures';

const registry = registryWithDuoV2();
const v1 = registry.getStrategy('duo', 1)!;
const v2 = registry.getStrategy('duo', 2)!;
const goalId = (version: number, position: number, suffix: string): string =>
  `duo.v${version}.${String(position).padStart(2, '0')}.${suffix}`;

function subject(overrides: Partial<UpgradeSubject> = {}): UpgradeSubject {
  return {
    catalogueKey: 'duo-test',
    stableName: 'Duo Test',
    status: 'active',
    strategyKey: 'duo',
    strategyVersion: 1,
    strategyParameters: { targets: {} },
    teamNames: { twoVsTwo: ['Alpha Pair'], threeVsThree: ['Alpha Trio'] },
    blueprintSlots: [1, 2, 3],
    ...overrides,
  };
}

describe('evaluateUpgrade', () => {
  it('migrates every Goal: kept, clamped, new and removed, with labels (design §14.0a)', () => {
    const evaluation = evaluateUpgrade(subject(), v1, v2);
    const byStatus = (status: string) => evaluation.changes.filter((c) => c.status === status);
    expect(byStatus('clamped')).toEqual([
      expect.objectContaining({ type: 'robots', label: 'Robots', position: 13, oldTarget: 2, newTarget: 3, fromGoalId: goalId(1, 13, 'robots') }),
    ]);
    expect(byStatus('new')).toEqual([
      expect.objectContaining({ type: 'facility', facilityType: 'roster_expansion', label: 'Roster Expansion', oldTarget: null, newTarget: 2 }),
    ]);
    expect(byStatus('removed')).toEqual([
      expect.objectContaining({ type: 'facility', facilityType: 'weapons_workshop', label: 'Weapons Workshop', fromGoalId: goalId(1, 15, 'facility.weapons_workshop'), newTarget: null }),
    ]);
    expect(byStatus('kept')).toHaveLength(v2.buildOrder.length - 2);
    expect(evaluation.params.targets[goalId(2, 13, 'robots')]).toBe(3);
    expect(evaluation).toMatchObject({ fromVersion: 1, toVersion: 2, passes: true, rejection: null, requiredTeamNames: { twoVsTwo: 1, threeVsThree: 1 } });
  });

  it('keeps a stored target that fits the new bounds', () => {
    const stored = { targets: { [goalId(1, 3, 'facility.booking_office')]: 0 } };
    const evaluation = evaluateUpgrade(subject({ strategyParameters: stored }), v1, v2);
    expect(evaluation.params.targets[goalId(2, 3, 'facility.booking_office')]).toBe(0);
  });

  it('rejects with AUTOMATON_BLUEPRINTS_TOO_FEW when a migrated robots target exceeds the buildable blueprints (R3.7)', () => {
    const evaluation = evaluateUpgrade(subject({ blueprintSlots: [1, 2] }), v1, v2);
    expect(evaluation.passes).toBe(false);
    expect(evaluation.rejection).toEqual({
      code: 'AUTOMATON_BLUEPRINTS_TOO_FEW',
      reason: 'Goal 13 targets 3 robots, but this stable has 2 blueprints. Add blueprints or lower the target.',
    });
  });

  it('counts only buildable blueprints: slots 1…k without a gap', () => {
    expect(evaluateUpgrade(subject({ blueprintSlots: [1, 2, 4] }), v1, v2).rejection?.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
  });

  it('rejects with AUTOMATON_TEAM_NAMES_MISMATCH when the new bounds need more Team_Names (R3.6)', () => {
    const evaluation = evaluateUpgrade(subject({ blueprintSlots: [1, 2, 3, 4] }), v1, v2);
    expect(evaluation.requiredTeamNames).toEqual({ twoVsTwo: 2, threeVsThree: 1 });
    expect(evaluation.rejection).toEqual({ code: 'AUTOMATON_TEAM_NAMES_MISMATCH', reason: 'This stable needs 2 team names for 2v2 and 1 for 3v3.' });
  });

  it('passes with new Team_Names supplied for a single-profile upgrade', () => {
    const teamNames = { twoVsTwo: ['Alpha Pair', 'Beta Pair'], threeVsThree: ['Alpha Trio'] };
    expect(evaluateUpgrade(subject({ blueprintSlots: [1, 2, 3, 4] }), v1, v2, teamNames)).toMatchObject({ passes: true, rejection: null });
  });

  it('reports R3.7 before the Team_Names count when both fail', () => {
    const evaluation = evaluateUpgrade(subject({ blueprintSlots: [1, 2], teamNames: { twoVsTwo: [], threeVsThree: [] } }), v1, v2);
    expect(evaluation.rejection?.code).toBe('AUTOMATON_BLUEPRINTS_TOO_FEW');
  });

  it('starts every Goal at its default when the pinned version file is missing', () => {
    const evaluation = evaluateUpgrade(subject({ strategyVersion: 7 }), undefined, v2);
    expect(evaluation.changes.every((c) => c.status === 'new')).toBe(true);
    expect(evaluation.params.targets[goalId(2, 13, 'robots')]).toBe(4);
  });

  it('upgrades the unchanged v1 content to itself without a change (sanity: definitions are clones)', () => {
    expect(duoV1Definition().version).toBe(1);
    expect(evaluateUpgrade(subject(), v1, v1).changes.every((c) => c.status === 'kept')).toBe(true);
  });
});
