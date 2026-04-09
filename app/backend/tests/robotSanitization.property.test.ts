/**
 * Feature: security-audit-guardrails, Property 9: Sensitive field stripping for non-owners
 *
 * **Validates: Requirements 4.4**
 *
 * For any robot returned via the public robots endpoint (/all/robots) to a user
 * who does not own that robot, the response object shall not contain any key from
 * the SENSITIVE_ROBOT_FIELDS constant (23 attributes, battle config, combat state,
 * equipment IDs).
 */
import fc from 'fast-check';
import {
  SENSITIVE_ROBOT_FIELDS,
  sanitizeRobotForPublic,
} from '../src/routes/robots';

/**
 * Arbitrary that generates a robot-like object with all sensitive fields populated
 * plus some safe public fields.
 */
const robotArbitrary = fc.record({
  // Public fields that should survive sanitization
  id: fc.integer({ min: 1, max: 100000 }),
  name: fc.stringMatching(/^[a-zA-Z0-9 _-]{1,30}$/),
  userId: fc.integer({ min: 1, max: 100000 }),
  elo: fc.integer({ min: 0, max: 3000 }),
  wins: fc.integer({ min: 0, max: 10000 }),
  losses: fc.integer({ min: 0, max: 10000 }),
  kills: fc.integer({ min: 0, max: 10000 }),
  imageUrl: fc.constant('/src/assets/robots/robot-1.webp'),
  createdAt: fc.constant(new Date().toISOString()),

  // 23 core attributes (sensitive)
  combatPower: fc.integer({ min: 1, max: 50 }),
  targetingSystems: fc.integer({ min: 1, max: 50 }),
  criticalSystems: fc.integer({ min: 1, max: 50 }),
  penetration: fc.integer({ min: 1, max: 50 }),
  weaponControl: fc.integer({ min: 1, max: 50 }),
  attackSpeed: fc.integer({ min: 1, max: 50 }),
  armorPlating: fc.integer({ min: 1, max: 50 }),
  shieldCapacity: fc.integer({ min: 1, max: 50 }),
  evasionThrusters: fc.integer({ min: 1, max: 50 }),
  damageDampeners: fc.integer({ min: 1, max: 50 }),
  counterProtocols: fc.integer({ min: 1, max: 50 }),
  hullIntegrity: fc.integer({ min: 1, max: 50 }),
  servoMotors: fc.integer({ min: 1, max: 50 }),
  gyroStabilizers: fc.integer({ min: 1, max: 50 }),
  hydraulicSystems: fc.integer({ min: 1, max: 50 }),
  powerCore: fc.integer({ min: 1, max: 50 }),
  combatAlgorithms: fc.integer({ min: 1, max: 50 }),
  threatAnalysis: fc.integer({ min: 1, max: 50 }),
  adaptiveAI: fc.integer({ min: 1, max: 50 }),
  logicCores: fc.integer({ min: 1, max: 50 }),
  syncProtocols: fc.integer({ min: 1, max: 50 }),
  supportSystems: fc.integer({ min: 1, max: 50 }),
  formationTactics: fc.integer({ min: 1, max: 50 }),

  // Battle configuration (sensitive)
  yieldThreshold: fc.integer({ min: 0, max: 50 }),
  stance: fc.constantFrom('offensive', 'defensive', 'balanced'),
  loadoutType: fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),

  // Current combat state (sensitive)
  currentHP: fc.integer({ min: 0, max: 500 }),
  currentShield: fc.integer({ min: 0, max: 100 }),
  damageTaken: fc.integer({ min: 0, max: 1000 }),

  // Equipment details (sensitive)
  mainWeaponId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  offhandWeaponId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  mainWeapon: fc.option(fc.record({ id: fc.integer(), weapon: fc.record({ name: fc.constant('Sword') }) }), { nil: null }),
  offhandWeapon: fc.option(fc.record({ id: fc.integer(), weapon: fc.record({ name: fc.constant('Shield') }) }), { nil: null }),
});

describe('Feature: security-audit-guardrails, Property 9: Sensitive field stripping for non-owners', () => {
  it('sanitizeRobotForPublic removes all SENSITIVE_ROBOT_FIELDS from robot objects', () => {
    fc.assert(
      fc.property(robotArbitrary, (robot) => {
        const sanitized = sanitizeRobotForPublic(robot);

        // No sensitive field should be present in the sanitized output
        for (const field of SENSITIVE_ROBOT_FIELDS) {
          expect(sanitized).not.toHaveProperty(field);
        }

        // Public fields should still be present
        expect(sanitized).toHaveProperty('id', robot.id);
        expect(sanitized).toHaveProperty('name', robot.name);
        expect(sanitized).toHaveProperty('userId', robot.userId);
        expect(sanitized).toHaveProperty('elo', robot.elo);
        expect(sanitized).toHaveProperty('wins', robot.wins);
        expect(sanitized).toHaveProperty('losses', robot.losses);
      }),
      { numRuns: 100 }
    );
  });

  it('sanitizeRobotForPublic does not modify the original robot object', () => {
    fc.assert(
      fc.property(robotArbitrary, (robot) => {
        const originalKeys = Object.keys(robot);
        sanitizeRobotForPublic(robot);

        // Original object should still have all its keys
        expect(Object.keys(robot)).toEqual(originalKeys);
      }),
      { numRuns: 100 }
    );
  });

  it('sanitizeRobotForPublic handles null/undefined input gracefully', () => {
    expect(sanitizeRobotForPublic(null)).toBeNull();
    expect(sanitizeRobotForPublic(undefined)).toBeUndefined();
  });

  it('sanitizeRobotForPublic strips sensitive fields even with extra unknown fields', () => {
    fc.assert(
      fc.property(
        robotArbitrary,
        fc.dictionary(
          fc.stringMatching(/^extra_[a-z]{1,10}$/),
          fc.integer()
        ),
        (robot, extraFields) => {
          const robotWithExtras = { ...robot, ...extraFields };
          const sanitized = sanitizeRobotForPublic(robotWithExtras);

          // Sensitive fields must still be stripped
          for (const field of SENSITIVE_ROBOT_FIELDS) {
            expect(sanitized).not.toHaveProperty(field);
          }

          // Extra fields should survive (they're not in the sensitive list)
          for (const key of Object.keys(extraFields)) {
            expect(sanitized).toHaveProperty(key);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
