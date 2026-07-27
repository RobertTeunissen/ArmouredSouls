/**
 * Achievement trigger registration audit — Spec #46 Requirement 8
 *
 * Property 5: every achievement must be reachable. An achievement is reachable
 * only if all three registration points agree about its trigger type:
 *
 *   1. `ACHIEVEMENTS` declares it (`config/achievements.ts`)
 *   2. `EVENT_TRIGGER_MAP` selects it as a candidate for some event
 *      (`achievementTypes.ts`)
 *   3. `evaluateTrigger()` has a non-default branch for it (`triggerEvaluator.ts`)
 *
 * Cause C in this requirement was exactly a step-2 gap: `grand_melee_wins`,
 * `grand_melee_top3`, and `grand_melee_win_high_hp` were declared and used by
 * five achievements but absent from `EVENT_TRIGGER_MAP`, so no event ever
 * selected them and L26–L30 were unreachable for the mode's entire lifetime.
 * Nothing in the type system catches that: the trigger type union is satisfied
 * by declaration alone.
 *
 * `evaluateTrigger()` is checked by reading the source rather than by calling it,
 * because a missing branch falls through to `default: return false` — which is
 * indistinguishable from "condition not met" at runtime. That is precisely why
 * the defect survived 40+ cycles.
 *
 * **Validates: Requirements 8.10, 8.11, 8.12, 8.20, 8.21, 8.22, 8.23**
 */

import * as fs from 'fs';
import * as path from 'path';
import { ACHIEVEMENTS, type AchievementTriggerType } from '../../src/config/achievements';
import { EVENT_TRIGGER_MAP } from '../../src/services/achievement/achievementTypes';

const EVALUATOR_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../src/services/achievement/triggerEvaluator.ts'),
  'utf8',
);
const CATALOG_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../src/services/achievement/achievementCatalog.ts'),
  'utf8',
);

/** Trigger types reachable from at least one event. */
const registeredTriggerTypes = new Set<string>(Object.values(EVENT_TRIGGER_MAP).flat());

/** Trigger types with a `case '<type>':` branch in evaluateTrigger(). */
function hasEvaluatorBranch(triggerType: string): boolean {
  return EVALUATOR_SOURCE.includes(`case '${triggerType}':`);
}

/** Trigger types with a `case '<type>':` branch in the progress resolver. */
function hasProgressResolverBranch(triggerType: string): boolean {
  return CATALOG_SOURCE.includes(`case '${triggerType}':`);
}

const declaredTriggerTypes = [...new Set(ACHIEVEMENTS.map(a => a.triggerType))];

describe('Property 5: every achievement trigger is registered', () => {
  it('every declared trigger type is selected by at least one event', () => {
    const unregistered = declaredTriggerTypes.filter(t => !registeredTriggerTypes.has(t));
    expect(unregistered).toEqual([]);
  });

  it('every declared trigger type has a non-default branch in evaluateTrigger()', () => {
    const unhandled = declaredTriggerTypes.filter(t => !hasEvaluatorBranch(t));
    expect(unhandled).toEqual([]);
  });

  it('every achievement is reachable, named individually when it is not', () => {
    const unreachable = ACHIEVEMENTS.filter(
      a => !registeredTriggerTypes.has(a.triggerType) || !hasEvaluatorBranch(a.triggerType),
    ).map(a => `${a.id} ${a.name} (${a.triggerType})`);
    expect(unreachable).toEqual([]);
  });

  it('registers the three Grand Melee trigger types that Cause C omitted', () => {
    const grandMeleeTriggers: AchievementTriggerType[] = [
      'grand_melee_wins',
      'grand_melee_top3',
      'grand_melee_win_high_hp',
    ];
    for (const trigger of grandMeleeTriggers) {
      expect(registeredTriggerTypes.has(trigger)).toBe(true);
      expect(hasEvaluatorBranch(trigger)).toBe(true);
    }
  });

  it('selects the Grand Melee triggers from the battle_complete event specifically', () => {
    // Grand Melee has no dedicated event type — it reports through battle_complete
    // like every other mode, so that is where the registration has to live.
    const battleTriggers = EVENT_TRIGGER_MAP.battle_complete;
    expect(battleTriggers).toContain('grand_melee_wins');
    expect(battleTriggers).toContain('grand_melee_top3');
    expect(battleTriggers).toContain('grand_melee_win_high_hp');
  });
});

describe('Progress resolver coverage (R8.23)', () => {
  it('every numeric achievement has a progress resolver branch', () => {
    const numericTriggers = [
      ...new Set(
        ACHIEVEMENTS.filter(a => a.progressType === 'numeric').map(a => a.triggerType),
      ),
    ];
    const missing = numericTriggers.filter(t => !hasProgressResolverBranch(t));
    expect(missing).toEqual([]);
  });

  it('resolves progress for the two numeric Grand Melee counters', () => {
    expect(hasProgressResolverBranch('grand_melee_wins')).toBe(true);
    expect(hasProgressResolverBranch('grand_melee_top3')).toBe(true);
  });

  it('does not require a progress branch for the boolean Grand Melee trigger', () => {
    const l30 = ACHIEVEMENTS.find(a => a.id === 'L30');
    expect(l30?.triggerType).toBe('grand_melee_win_high_hp');
    expect(l30?.progressType).toBe('boolean');
  });
});

describe('The nine reported achievements are now reachable (R8.24)', () => {
  const AFFECTED = ['L16', 'L19', 'L21', 'C11', 'L26', 'L27', 'L28', 'L29', 'L30'];

  it.each(AFFECTED)('%s has a registered and handled trigger type', (id) => {
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    expect(achievement).toBeDefined();
    expect(registeredTriggerTypes.has(achievement!.triggerType)).toBe(true);
    expect(hasEvaluatorBranch(achievement!.triggerType)).toBe(true);
  });
});

describe('Cause A: team-mode triggers do not read robot-scoped standings (R8.1)', () => {
  const SERVICE_SOURCE = fs.readFileSync(
    path.join(__dirname, '../../src/services/achievement/achievementService.ts'),
    'utf8',
  );

  it('resolves team-mode wins through the shared membership helper', () => {
    expect(SERVICE_SOURCE).toContain('resolveTeamModeWinsForRobot');
    expect(CATALOG_SOURCE).toContain('resolveTeamModeWins');
  });

  it('no longer derives the three team-mode counters from the robot standings list', () => {
    // The defect was `robotStandings.find(s => s.mode === 'tag_team')?.wins ?? 0`
    // against rows that are only ever written with entityType 'team'.
    for (const mode of ['tag_team', 'league_2v2', 'league_3v3']) {
      expect(SERVICE_SOURCE).not.toContain(`robotStandings.find(s => s.mode === '${mode}')`);
    }
  });

  it('uses the same helper on the unlock and the display path', () => {
    // If these ever diverge, a player sees progress that does not match the
    // number gating the unlock.
    expect(SERVICE_SOURCE).toContain('./teamModeWins');
    expect(CATALOG_SOURCE).toContain('./teamModeWins');
  });
});

describe('Cause B: elo_upset compares the opponent gap (R8.6)', () => {
  it('no longer reads the subject ELO change', () => {
    // ELO_K_FACTOR is 32, so `eloDiff` could never reach the 150 threshold.
    expect(EVALUATOR_SOURCE).not.toContain('Number(data.eloDiff)');
  });

  it('reads both pre-battle ratings instead', () => {
    expect(EVALUATOR_SOURCE).toContain('data.opponentEloBefore');
    expect(EVALUATOR_SOURCE).toContain('data.subjectEloBefore');
  });

  it('keeps the win requirement and the 1v1 mode restriction', () => {
    const eloUpsetBlock = EVALUATOR_SOURCE.slice(
      EVALUATOR_SOURCE.indexOf("case 'elo_upset':"),
      EVALUATOR_SOURCE.indexOf("case 'yield_forced':"),
    );
    expect(eloUpsetBlock).toContain('data.won');
    expect(eloUpsetBlock).toContain('league_1v1');
    expect(eloUpsetBlock).toContain('tournament_1v1');
  });
});

describe('Cause C: the Grand Melee counters are incremented (R8.13)', () => {
  const POST_COMBAT_SOURCE = fs.readFileSync(
    path.join(__dirname, '../../src/services/battle/battlePostCombat.ts'),
    'utf8',
  );
  const ORCHESTRATOR_SOURCE = fs.readFileSync(
    path.join(__dirname, '../../src/services/grand-melee/grandMeleeBattleOrchestrator.ts'),
    'utf8',
  );

  it('increments both counters in the shared post-combat helper', () => {
    expect(POST_COMBAT_SOURCE).toContain('data.grandMeleeWins');
    expect(POST_COMBAT_SOURCE).toContain('data.grandMeleeTop3');
  });

  it('places the increments outside the skipBattleCounters guard', () => {
    // Grand Melee passes skipBattleCounters: true to stay out of the Career
    // counters, not out of its own mode counters. If the increments sat inside
    // that guard they would never run.
    const guardIndex = POST_COMBAT_SOURCE.indexOf('if (!opts.skipBattleCounters) {');
    const grandMeleeIndex = POST_COMBAT_SOURCE.indexOf('data.grandMeleeWins');
    const guardBlockEnd = POST_COMBAT_SOURCE.indexOf('// ── Stance/Loadout Win Counters ──');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(grandMeleeIndex).toBeGreaterThan(guardBlockEnd);
  });

  it('no longer increments the counters inline in the orchestrator', () => {
    // The unified post-battle update rule in project-overview.md forbids inline
    // prisma.robot.update for combat stat persistence.
    expect(ORCHESTRATOR_SOURCE).not.toContain('grandMeleeWins: { increment: 1 }');
    expect(ORCHESTRATOR_SOURCE).not.toContain('grandMeleeTop3: { increment: 1 }');
  });

  it('passes placement and finalHpPercent in the achievement context', () => {
    expect(ORCHESTRATOR_SOURCE).toContain('placement: p.placement');
    expect(ORCHESTRATOR_SOURCE).toContain('finalHpPercent');
  });
});
