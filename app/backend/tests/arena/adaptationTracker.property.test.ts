import * as fc from 'fast-check';
import {
  updateAdaptation,
  getEffectiveAdaptation,
  AdaptationState,
  AdaptationEvent,
} from '../../src/services/arena/adaptationTracker';

/**
 * Property-based tests for adaptationTracker module.
 * Uses fast-check to verify universal properties across random inputs.
 */

const arbAdaptiveAI = (): fc.Arbitrary<number> =>
  fc.integer({ min: 1, max: 50 });

const arbEvent = (): fc.Arbitrary<AdaptationEvent> =>
  fc.constantFrom('damage_taken' as const, 'miss' as const);

function makeState(overrides: Partial<AdaptationState> = {}): AdaptationState {
  return {
    adaptiveAI: 25,
    adaptationHitBonus: 0,
    adaptationDamageBonus: 0,
    currentHP: 100,
    maxHP: 100,
    ...overrides,
  };
}

describe('adaptationTracker property tests', () => {
  /**
   * Property 19: Adaptation bonuses never exceed their caps
   * (adaptiveAI × 0.5 for hit, adaptiveAI × 0.25 for damage)
   * for any sequence of events.
   * **Validates: Requirement 7.4**
   */
  describe('Property 19: Adaptation bonuses never exceed caps', () => {
    it('should cap hit bonus at adaptiveAI × 0.5 and damage bonus at adaptiveAI × 0.25 for any event sequence', () => {
      fc.assert(
        fc.property(
          arbAdaptiveAI(),
          fc.array(arbEvent(), { minLength: 1, maxLength: 200 }),
          (ai, events) => {
            const state = makeState({ adaptiveAI: ai });

            for (const event of events) {
              updateAdaptation(state, event);
            }

            expect(state.adaptationHitBonus).toBeLessThanOrEqual(ai * 0.5 + 1e-9);
            expect(state.adaptationDamageBonus).toBeLessThanOrEqual(ai * 0.25 + 1e-9);
            expect(state.adaptationHitBonus).toBeGreaterThanOrEqual(0);
            expect(state.adaptationDamageBonus).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  /**
   * Property 20: Effective adaptation at HP > 70% is exactly half
   * of raw adaptation bonus.
   * **Validates: Requirement 7.5**
   */
  describe('Property 20: Effective adaptation halved when HP > 70%', () => {
    it('should return exactly half the raw bonus when HP > 70%', () => {
      fc.assert(
        fc.property(
          arbAdaptiveAI(),
          fc.array(arbEvent(), { minLength: 1, maxLength: 50 }),
          fc.double({ min: 71, max: 100, noNaN: true, noDefaultInfinity: true }),
          (ai, events, hpPercent) => {
            const maxHP = 100;
            const currentHP = hpPercent; // hpPercent is 71-100, maxHP is 100

            const state = makeState({
              adaptiveAI: ai,
              currentHP,
              maxHP,
            });

            for (const event of events) {
              updateAdaptation(state, event);
            }

            const effective = getEffectiveAdaptation(state);

            expect(effective.hitBonus).toBeCloseTo(
              state.adaptationHitBonus * 0.5,
              10,
            );
            expect(effective.damageBonus).toBeCloseTo(
              state.adaptationDamageBonus * 0.5,
              10,
            );
          },
        ),
        { numRuns: 500 },
      );
    });

    it('should return full bonus when HP ≤ 70%', () => {
      fc.assert(
        fc.property(
          arbAdaptiveAI(),
          fc.array(arbEvent(), { minLength: 1, maxLength: 50 }),
          fc.double({ min: 1, max: 70, noNaN: true, noDefaultInfinity: true }),
          (ai, events, hpPercent) => {
            const maxHP = 100;
            const currentHP = hpPercent;

            const state = makeState({
              adaptiveAI: ai,
              currentHP,
              maxHP,
            });

            for (const event of events) {
              updateAdaptation(state, event);
            }

            const effective = getEffectiveAdaptation(state);

            expect(effective.hitBonus).toBeCloseTo(
              state.adaptationHitBonus,
              10,
            );
            expect(effective.damageBonus).toBeCloseTo(
              state.adaptationDamageBonus,
              10,
            );
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
