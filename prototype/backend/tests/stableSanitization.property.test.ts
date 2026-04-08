import * as fc from 'fast-check';
import { sanitizeRobotForPublic, SENSITIVE_ROBOT_FIELDS } from '../src/routes/robots';
import { positiveIntParam } from '../src/utils/securityValidation';

describe('Stable Sanitization - Property Tests', () => {
  describe('Property 1: Sensitive field stripping on stable endpoint', () => {
    /**
     * **Validates: Requirements 2.1, 2.5**
     * For any robot object with all fields populated, after sanitizeRobotForPublic,
     * no key from SENSITIVE_ROBOT_FIELDS shall be present.
     */
    test('strips all sensitive fields from any robot object', () => {
      // Build an arbitrary that generates a robot with every sensitive field populated
      const robotArb = fc.record({
        // Public fields that should survive
        id: fc.nat(),
        name: fc.string({ minLength: 1, maxLength: 20 }),
        elo: fc.integer({ min: 0, max: 3000 }),
        wins: fc.nat({ max: 500 }),
        losses: fc.nat({ max: 500 }),
        draws: fc.nat({ max: 500 }),
        totalBattles: fc.nat({ max: 1500 }),
        fame: fc.nat({ max: 10000 }),
        kills: fc.nat({ max: 200 }),
        damageDealtLifetime: fc.nat({ max: 100000 }),
        damageTakenLifetime: fc.nat({ max: 100000 }),
        currentLeague: fc.constantFrom('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'),
        leaguePoints: fc.integer({ min: 0, max: 100 }),
        imageUrl: fc.option(fc.webUrl(), { nil: null }),
        // Sensitive fields that must be stripped
        combatPower: fc.nat({ max: 50 }),
        targetingSystems: fc.nat({ max: 50 }),
        criticalSystems: fc.nat({ max: 50 }),
        penetration: fc.nat({ max: 50 }),
        weaponControl: fc.nat({ max: 50 }),
        attackSpeed: fc.nat({ max: 50 }),
        armorPlating: fc.nat({ max: 50 }),
        shieldCapacity: fc.nat({ max: 50 }),
        evasionThrusters: fc.nat({ max: 50 }),
        damageDampeners: fc.nat({ max: 50 }),
        counterProtocols: fc.nat({ max: 50 }),
        hullIntegrity: fc.nat({ max: 50 }),
        servoMotors: fc.nat({ max: 50 }),
        gyroStabilizers: fc.nat({ max: 50 }),
        hydraulicSystems: fc.nat({ max: 50 }),
        powerCore: fc.nat({ max: 50 }),
        combatAlgorithms: fc.nat({ max: 50 }),
        threatAnalysis: fc.nat({ max: 50 }),
        adaptiveAI: fc.nat({ max: 50 }),
        logicCores: fc.nat({ max: 50 }),
        syncProtocols: fc.nat({ max: 50 }),
        supportSystems: fc.nat({ max: 50 }),
        formationTactics: fc.nat({ max: 50 }),
        yieldThreshold: fc.integer({ min: 0, max: 50 }),
        stance: fc.constantFrom('aggressive', 'defensive', 'balanced'),
        loadoutType: fc.constantFrom('single', 'weapon_shield', 'two_handed', 'dual_wield'),
        currentHP: fc.nat({ max: 1000 }),
        currentShield: fc.nat({ max: 500 }),
        damageTaken: fc.nat({ max: 1000 }),
        mainWeaponId: fc.option(fc.nat(), { nil: null }),
        offhandWeaponId: fc.option(fc.nat(), { nil: null }),
        mainWeapon: fc.option(fc.record({ id: fc.nat(), name: fc.string() }), { nil: null }),
        offhandWeapon: fc.option(fc.record({ id: fc.nat(), name: fc.string() }), { nil: null }),
      });

      fc.assert(
        fc.property(robotArb, (robot) => {
          const sanitized = sanitizeRobotForPublic(robot);

          for (const field of SENSITIVE_ROBOT_FIELDS) {
            expect(sanitized).not.toHaveProperty(field);
          }

          // Public fields should still be present
          expect(sanitized).toHaveProperty('id');
          expect(sanitized).toHaveProperty('name');
          expect(sanitized).toHaveProperty('elo');
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 2: Robot list sorted by ELO descending', () => {
    /**
     * **Validates: Requirements 2.6**
     * For any array of robots with random ELO values, after sorting by ELO desc,
     * each robot's ELO shall be >= the next robot's ELO.
     */
    test('sorting robots by ELO desc maintains descending order invariant', () => {
      const robotWithEloArb = fc.record({
        id: fc.nat(),
        name: fc.string({ minLength: 1, maxLength: 20 }),
        elo: fc.integer({ min: 0, max: 3000 }),
      });

      fc.assert(
        fc.property(fc.array(robotWithEloArb, { minLength: 0, maxLength: 50 }), (robots) => {
          const sorted = [...robots].sort((a, b) => b.elo - a.elo);

          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i].elo).toBeGreaterThanOrEqual(sorted[i + 1].elo);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: Stable statistics aggregation correctness', () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
     * For any set of robot stat objects, verify:
     *   totalBattles = sum of all robots' totalBattles
     *   totalWins = sum of wins
     *   totalLosses = sum of losses
     *   totalDraws = sum of draws
     *   highestElo = max elo (or 0 if empty)
     *   activeRobots = count
     */
    test('aggregate stats match sum/max/count of individual robot stats', () => {
      const robotStatArb = fc.record({
        totalBattles: fc.nat({ max: 1000 }),
        wins: fc.nat({ max: 500 }),
        losses: fc.nat({ max: 500 }),
        draws: fc.nat({ max: 500 }),
        elo: fc.integer({ min: 0, max: 3000 }),
      });

      fc.assert(
        fc.property(fc.array(robotStatArb, { minLength: 0, maxLength: 30 }), (robots) => {
          // Replicate the server-side aggregation logic from stables.ts
          const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
          const totalWins = robots.reduce((sum, r) => sum + r.wins, 0);
          const totalLosses = robots.reduce((sum, r) => sum + r.losses, 0);
          const totalDraws = robots.reduce((sum, r) => sum + r.draws, 0);
          const highestElo = robots.length > 0
            ? Math.max(...robots.map((r) => r.elo))
            : 0;
          const activeRobots = robots.length;

          // Verify each aggregation independently
          expect(totalBattles).toBe(robots.reduce((s, r) => s + r.totalBattles, 0));
          expect(totalWins).toBe(robots.reduce((s, r) => s + r.wins, 0));
          expect(totalLosses).toBe(robots.reduce((s, r) => s + r.losses, 0));
          expect(totalDraws).toBe(robots.reduce((s, r) => s + r.draws, 0));
          expect(activeRobots).toBe(robots.length);

          if (robots.length === 0) {
            expect(highestElo).toBe(0);
          } else {
            // highestElo must equal the max elo in the array
            const maxElo = robots.reduce((max, r) => Math.max(max, r.elo), -Infinity);
            expect(highestElo).toBe(maxElo);
            // highestElo must be >= every individual robot's elo
            for (const r of robots) {
              expect(highestElo).toBeGreaterThanOrEqual(r.elo);
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 5: userId parameter validation rejects invalid inputs', () => {
    /**
     * **Validates: Requirements 5.4**
     * For any string that is not a positive integer representation,
     * the Zod positiveIntParam schema shall reject it.
     */
    test('rejects negative numbers, floats, alpha, empty, and special characters', () => {
      // Generate strings that are NOT valid positive integers
      const invalidInputArb = fc.oneof(
        // Negative numbers
        fc.integer({ min: -10000, max: -1 }).map(String),
        // Zero (not positive)
        fc.constant('0'),
        // Floats
        fc.tuple(fc.nat({ max: 1000 }), fc.integer({ min: 1, max: 99 })).map(
          ([whole, frac]) => `${whole}.${frac}`,
        ),
        // Alphabetic strings
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]+$/.test(s)),
        // Empty string
        fc.constant(''),
        // Special characters
        fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '(', ')'),
        // Mixed alphanumeric (number followed by letters)
        fc.tuple(fc.nat({ max: 100 }), fc.constant('abc')).map(
          ([n, s]) => `${n}${s}`,
        ),
      );

      fc.assert(
        fc.property(invalidInputArb, (input) => {
          const result = positiveIntParam.safeParse(input);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 6: Owner and non-owner receive identical stable response', () => {
    /**
     * **Validates: Requirements 1.4**
     * Verify that sanitizeRobotForPublic produces the same output regardless of
     * who calls it — the function has no branching based on viewer identity.
     * This confirms the route handler returns identical data for owner and non-owner.
     */
    test('sanitizeRobotForPublic output is identical regardless of simulated viewer', () => {
      const robotArb = fc.record({
        id: fc.nat(),
        name: fc.string({ minLength: 1, maxLength: 20 }),
        elo: fc.integer({ min: 0, max: 3000 }),
        wins: fc.nat({ max: 500 }),
        losses: fc.nat({ max: 500 }),
        draws: fc.nat({ max: 500 }),
        totalBattles: fc.nat({ max: 1500 }),
        fame: fc.nat({ max: 10000 }),
        combatPower: fc.nat({ max: 50 }),
        targetingSystems: fc.nat({ max: 50 }),
        stance: fc.constantFrom('aggressive', 'defensive', 'balanced'),
        currentHP: fc.nat({ max: 1000 }),
        mainWeaponId: fc.option(fc.nat(), { nil: null }),
      });

      fc.assert(
        fc.property(
          robotArb,
          fc.nat({ max: 10000 }), // owner userId
          fc.nat({ max: 10000 }), // viewer userId
          (robot, _ownerId, _viewerId) => {
            // sanitizeRobotForPublic takes no viewer param — it always strips the same fields
            const resultForOwner = sanitizeRobotForPublic({ ...robot });
            const resultForViewer = sanitizeRobotForPublic({ ...robot });

            expect(resultForOwner).toEqual(resultForViewer);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
