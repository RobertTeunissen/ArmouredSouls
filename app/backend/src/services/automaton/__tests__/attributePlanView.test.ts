import { attributePlanView, buildFocusOptions } from '../attributePlanView';
import { BUILD_FOCUS_PRESETS, BUILD_FOCUS_WEIGHTS, academyLevelForTarget } from '../buildFocus';

describe('attributePlanView (Editor attributes plan, task 10.3)', () => {
  const robots = [
    { slot: 1, robotName: 'Rex', buildFocus: 'versatile' as const },
    { slot: 2, robotName: 'Cody', buildFocus: 'deadeye' as const },
  ];

  it('lists each robot\'s groups in Build_Focus priority order with their targets', () => {
    const plan = attributePlanView({ goalId: 'g', target: 15, isMax: false }, robots, {}, BUILD_FOCUS_WEIGHTS);
    expect(plan.goalId).toBe('g');
    expect(plan.robots[0].groups.map((g) => [g.group, g.target])).toEqual([
      ['combat', 15], ['defense', 15], ['mobility', 15], ['ai', 15],
    ]);
    // Deadeye: combat 1.0, ai 0.8, mobility 0.5, defense 0.4.
    expect(plan.robots[1].groups.map((g) => [g.group, g.target])).toEqual([
      ['combat', 15], ['ai', 12], ['mobility', 8], ['defense', 6],
    ]);
  });

  it('marks the first robot that needs an academy level the stable lacks and lists the academies bought', () => {
    const plan = attributePlanView({ goalId: 'g', target: 15, isMax: false }, robots, {}, BUILD_FOCUS_WEIGHTS);
    const level = academyLevelForTarget(15);
    expect(level).toBeGreaterThan(0);
    expect(plan.robots[0].groups.every((g) => g.buysAcademy && g.academyLevel === level)).toBe(true);
    expect(plan.robots[1].groups.find((g) => g.group === 'combat')?.buysAcademy).toBe(false);
    expect(plan.academies).toEqual([
      { group: 'combat', level }, { group: 'defense', level }, { group: 'mobility', level }, { group: 'ai', level },
    ]);
  });

  it('buys no academy the stable already holds', () => {
    const level = academyLevelForTarget(15);
    const plan = attributePlanView(
      { goalId: 'g', target: 15, isMax: false },
      robots,
      { combat_training_academy: level, defense_training_academy: level, mobility_training_academy: level, ai_training_academy: level },
      BUILD_FOCUS_WEIGHTS,
    );
    expect(plan.academies).toEqual([]);
    expect(plan.robots.flatMap((r) => r.groups).some((g) => g.buysAcademy)).toBe(false);
  });

  it('targets 50 in every group for Max', () => {
    const plan = attributePlanView({ goalId: 'g', target: 50, isMax: true }, robots.slice(1), {}, BUILD_FOCUS_WEIGHTS);
    expect(plan.robots[0].groups.every((g) => g.target === 50)).toBe(true);
  });

  it('exposes the six Build_Focus presets in table order', () => {
    expect(buildFocusOptions().map((o) => o.key)).toEqual(BUILD_FOCUS_PRESETS.map((p) => p.key));
    expect(buildFocusOptions()[0]).toEqual({ key: 'bruiser', displayName: 'Bruiser', description: BUILD_FOCUS_PRESETS[0].description });
  });
});
