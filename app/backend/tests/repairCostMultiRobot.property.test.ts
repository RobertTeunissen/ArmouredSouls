import * as fc from 'fast-check';
import { calculateRepairCost } from './helpers/legacyRepairCost';
import prisma from '../src/lib/prisma';

/**
 * Repair cost and robot count — property tests.
 *
 * Season 2 (#525): the Repair Bay discount is `6 × min(level, 10)` percent for
 * every stable. It used to be `min(90, level × (5 + activeRobotCount))`, which
 * this suite covered as a "multi-robot discount". The robot count is still
 * counted (it is recorded on every repair as a stable fact), but it is no longer
 * a discount input, so the properties below pin that it has no effect.
 */

// Test configuration
const NUM_RUNS = 10;

/** Independent restatement of the decided discount, for expectations. */
function expectedDiscountPercent(repairBayLevel: number): number {
  return 6 * Math.min(repairBayLevel, 10);
}

/** Independent restatement of the quote formula, for expectations. */
function expectedQuote(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number,
): number {
  const baseRepairCost = sumOfAllAttributes * 100;
  let multiplier = 1.0;
  if (hpPercent === 0) {
    multiplier = 2.0;
  } else if (hpPercent < 10) {
    multiplier = 1.5;
  }
  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
  return Math.round(rawCost * (1 - expectedDiscountPercent(repairBayLevel) / 100));
}

async function createUser(): Promise<{ id: number }> {
  return prisma.user.create({
    data: {
      username: `rc_test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      passwordHash: 'test_hash',
      currency: 1000000,
    },
  });
}

async function cleanupUser(userId: number): Promise<void> {
  await prisma.robot.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function countStableRobots(userId: number): Promise<number> {
  return prisma.robot.count({
    where: {
      userId,
      NOT: { name: 'Bye Robot' },
    },
  });
}

// Disconnect Prisma after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

describe('Repair Cost and Robot Count - Property Tests', () => {
  describe('Property 1: Repair Bay discount is 6% per level, at most 60%', () => {
    /**
     * For any Repair Bay level, the discount is `6 × min(level, 10)` and never
     * exceeds 60%.
     */
    test('discount is calculated correctly and never exceeds 60%', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 15 }), // repairBayLevel
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          (repairBayLevel, sumOfAllAttributes, damagePercent, hpPercent) => {
            const discount = expectedDiscountPercent(repairBayLevel);
            expect(discount).toBeLessThanOrEqual(60);
            expect(discount).toBe(repairBayLevel <= 10 ? repairBayLevel * 6 : 60);

            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              0,
            );
            expect(repairCost).toBe(
              expectedQuote(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel),
            );
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair cost decreases as the Repair Bay level increases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }), // repairBayLevel (1-9 to allow increment)
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to avoid 1.5x multiplier)
          (repairBayLevel, sumOfAllAttributes, damagePercent, hpPercent) => {
            const cost1 = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, 0);
            const cost2 = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel + 1, 0);

            // Below Level 10 every level adds 6 points of discount, so the cost
            // never rises with the level.
            expect(cost2).toBeLessThanOrEqual(cost1);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('the 60% maximum applies from Level 10 upwards', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 15 }), // repairBayLevel
          (repairBayLevel) => {
            const sumOfAllAttributes = 230; // Sum of all 23 attributes
            const cost = calculateRepairCost(
              sumOfAllAttributes,
              100, // damagePercent
              0, // hpPercent (destroyed, 2.0x multiplier)
              repairBayLevel,
              0, // medicalBayLevel
            );

            // Base: 230 × 100 = 23,000; 100% damage; ×2.0 destroyed = 46,000;
            // 60% discount: 46,000 × 0.40 = 18,400
            expect(cost).toBe(18400);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Property 4: Attribute-Sum Formula Consistency', () => {
    /**
     * For any robot, the base repair cost is
     * `sumOfAllAttributes × 100 × (damagePercent / 100) × multiplier`,
     * where multiplier depends on HP percentage (2.0 for HP=0, 1.5 for HP<10%, 1.0 otherwise).
     */
    test('base repair cost follows attribute-sum formula', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel) => {
            const repairCost = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, 0);
            expect(repairCost).toBe(
              expectedQuote(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel),
            );
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('multiplier is 2.0 for destroyed robots (HP = 0)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          (sumOfAllAttributes, damagePercent, repairBayLevel) => {
            const repairCost = calculateRepairCost(sumOfAllAttributes, damagePercent, 0, repairBayLevel, 0);

            const rawCost = sumOfAllAttributes * 100 * (damagePercent / 100) * 2.0;
            const expectedCost = Math.round(rawCost * (1 - expectedDiscountPercent(repairBayLevel) / 100));
            expect(repairCost).toBe(expectedCost);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('multiplier is 1.5 for heavily damaged robots (HP < 10%)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 1, max: 9 }), // hpPercent (1-9% for heavily damaged)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel) => {
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
            );

            const rawCost = sumOfAllAttributes * 100 * (damagePercent / 100) * 1.5;
            const expectedCost = Math.round(rawCost * (1 - expectedDiscountPercent(repairBayLevel) / 100));
            expect(repairCost).toBe(expectedCost);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('multiplier is 1.0 for normal damage (HP >= 10%)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 1, max: 100 }), // damagePercent (at least 1% to ensure cost > 0)
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10% for normal damage)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel) => {
            const repairCost = calculateRepairCost(
              sumOfAllAttributes,
              damagePercent,
              hpPercent,
              repairBayLevel,
              medicalBayLevel,
            );

            const rawCost = sumOfAllAttributes * 100 * (damagePercent / 100) * 1.0;
            const expectedCost = Math.round(rawCost * (1 - expectedDiscountPercent(repairBayLevel) / 100));
            expect(repairCost).toBe(expectedCost);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair cost scales linearly with sumOfAllAttributes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 11500 }), // sumOfAllAttributes (half of max to allow doubling)
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to avoid 1.5x multiplier)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel) => {
            const cost1 = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, 0);
            const cost2 = calculateRepairCost(sumOfAllAttributes * 2, damagePercent, hpPercent, repairBayLevel, 0);

            // Doubled attributes = doubled cost, allowing for rounding.
            expect(Math.abs(cost2 - cost1 * 2)).toBeLessThanOrEqual(1);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair cost scales linearly with damagePercent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 25, max: 50 }), // damagePercent (25-50% to allow doubling)
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to avoid 1.5x multiplier)
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel) => {
            const cost1 = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, 0);
            const cost2 = calculateRepairCost(sumOfAllAttributes, damagePercent * 2, hpPercent, repairBayLevel, 0);

            // Doubled damage = doubled cost, allowing for rounding.
            expect(Math.abs(cost2 - cost1 * 2)).toBeLessThanOrEqual(1);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('zero damage results in zero repair cost', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, hpPercent, repairBayLevel, medicalBayLevel) => {
            const repairCost = calculateRepairCost(sumOfAllAttributes, 0, hpPercent, repairBayLevel, medicalBayLevel);
            expect(repairCost).toBe(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('100% damage with 1.0x multiplier equals base repair cost before discount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 10, max: 100 }), // hpPercent (>= 10 to ensure 1.0x multiplier)
          (sumOfAllAttributes, hpPercent) => {
            const repairCost = calculateRepairCost(sumOfAllAttributes, 100, hpPercent, 0, 0);
            expect(repairCost).toBe(sumOfAllAttributes * 100);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Property 2: Robot Count Includes All Robots (recorded stable fact)', () => {
    /**
     * The owned-robot count is still recorded on every repair (`activeRobotCount`
     * in the repair breakdown). It includes every robot the stable owns,
     * regardless of HP status, and excludes the "Bye Robot" system robot.
     */

    test('robot count includes all robots regardless of HP status', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }), // robot HP percentages
          async (robotHPs) => {
            const user = await createUser();

            for (let i = 0; i < robotHPs.length; i++) {
              const maxHP = 100;
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Test Robot ${i}`,
                  currentHP: Math.floor((robotHPs[i] / 100) * maxHP),
                  maxHP,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            const count = await countStableRobots(user.id);
            await cleanupUser(user.id);

            expect(count).toBe(robotHPs.length);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('robot count excludes "Bye Robot" system robot', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // number of regular robots
          async (numRobots) => {
            const user = await createUser();

            for (let i = 0; i < numRobots; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Test Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            await prisma.robot.create({
              data: {
                userId: user.id,
                name: 'Bye Robot',
                currentHP: 100,
                maxHP: 100,
                currentShield: 0,
                maxShield: 20,
              },
            });

            const count = await countStableRobots(user.id);
            await cleanupUser(user.id);

            expect(count).toBe(numRobots);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('robot count includes destroyed robots (HP = 0)', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // number of healthy robots
          fc.integer({ min: 1, max: 5 }), // number of destroyed robots
          async (numHealthy, numDestroyed) => {
            const user = await createUser();

            for (let i = 0; i < numHealthy; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Healthy Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            for (let i = 0; i < numDestroyed; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Destroyed Robot ${i}`,
                  currentHP: 0,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            const count = await countStableRobots(user.id);
            await cleanupUser(user.id);

            expect(count).toBe(numHealthy + numDestroyed);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('robot count includes damaged robots (0 < HP < maxHP)', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // number of healthy robots
          fc.integer({ min: 1, max: 5 }), // number of damaged robots
          async (numHealthy, numDamaged) => {
            const user = await createUser();

            for (let i = 0; i < numHealthy; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Healthy Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            for (let i = 0; i < numDamaged; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Damaged Robot ${i}`,
                  currentHP: 50,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            const count = await countStableRobots(user.id);
            await cleanupUser(user.id);

            expect(count).toBe(numHealthy + numDamaged);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('robot count does not affect the repair cost (#525)', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }), // number of robots (0 = empty stable)
          fc.integer({ min: 1, max: 10 }), // repairBayLevel
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 10, max: 100 }), // hpPercent
          async (numRobots, repairBayLevel, sumOfAllAttributes, damagePercent, hpPercent) => {
            const user = await createUser();

            for (let i = 0; i < numRobots; i++) {
              await prisma.robot.create({
                data: {
                  userId: user.id,
                  name: `Test Robot ${i}`,
                  currentHP: 100,
                  maxHP: 100,
                  currentShield: 0,
                  maxShield: 20,
                },
              });
            }

            const activeRobotCount = await countStableRobots(user.id);
            await cleanupUser(user.id);

            expect(activeRobotCount).toBe(numRobots);

            // The quote depends on the level only: the same for any stable size.
            const repairCost = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, 0);
            const multiplier = 1.0; // hpPercent >= 10
            const rawCost = sumOfAllAttributes * 100 * (damagePercent / 100) * multiplier;
            const expectedCost = Math.round(rawCost * (1 - (6 * repairBayLevel) / 100));
            expect(repairCost).toBe(expectedCost);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  describe('Property 5: Repair Cost Consistency Across Battle Types', () => {
    /**
     * For any robot with the same damage, HP and facility levels, the repair cost
     * is identical whether the damage occurred in a league battle, tag team
     * battle, tournament battle or before an automatic repair.
     */
    test('repair costs are identical for same damage across all battle types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel) => {
            const leagueBattleCost = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel);
            const tagTeamBattleCost = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel);
            const tournamentBattleCost = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel);
            const autoRepairCost = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel);

            expect(leagueBattleCost).toBe(tagTeamBattleCost);
            expect(leagueBattleCost).toBe(tournamentBattleCost);
            expect(leagueBattleCost).toBe(autoRepairCost);

            const expectedCost = expectedQuote(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel);
            expect(leagueBattleCost).toBe(expectedCost);
            expect(tagTeamBattleCost).toBe(expectedCost);
            expect(tournamentBattleCost).toBe(expectedCost);
            expect(autoRepairCost).toBe(expectedCost);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair costs remain consistent with varying facility levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 50, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel) => {
            const costs = [
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel),
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel),
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel),
              calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel),
            ];

            const firstCost = costs[0];
            costs.forEach((cost) => {
              expect(cost).toBe(firstCost);
            });
            expect(firstCost).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair costs are deterministic for same inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel) => {
            const results: number[] = [];
            for (let i = 0; i < 10; i++) {
              results.push(
                calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel),
              );
            }

            const firstResult = results[0];
            results.forEach((result) => {
              expect(result).toBe(firstResult);
            });
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair costs are consistent regardless of call order', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 25, max: 100 }), // damagePercent
          fc.integer({ min: 0, max: 100 }), // hpPercent
          fc.integer({ min: 1, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel) => {
            const cost1 = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel);

            // Different damage scenario, interleaved between two identical calls so a
            // caching bug would show up as cost1 !== cost3. The validity guard wraps
            // the call: `hpPercent - 10` is negative whenever `hpPercent < 10`, which
            // `calculateRepairQuote` correctly rejects with a RangeError.
            const derivedInputsValid = damagePercent + 10 <= 100 && hpPercent - 10 >= 0;
            if (derivedInputsValid) {
              const cost2 = calculateRepairCost(
                sumOfAllAttributes,
                damagePercent + 10,
                hpPercent - 10,
                repairBayLevel,
                medicalBayLevel,
              );
              expect(cost2).toBeGreaterThanOrEqual(0);
            }

            const cost3 = calculateRepairCost(sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel);
            expect(cost1).toBe(cost3);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    test('repair costs handle edge cases consistently across battle types', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
          fc.integer({ min: 0, max: 10 }), // repairBayLevel
          fc.integer({ min: 0, max: 10 }), // medicalBayLevel
          (sumOfAllAttributes, repairBayLevel, medicalBayLevel) => {
            // Edge case 1: Zero damage
            const zeroDamageCost = calculateRepairCost(sumOfAllAttributes, 0, 100, repairBayLevel, medicalBayLevel);
            expect(zeroDamageCost).toBe(0);

            // Edge case 2: Full damage, destroyed
            const fullDamageCost = calculateRepairCost(sumOfAllAttributes, 100, 0, repairBayLevel, medicalBayLevel);
            expect(fullDamageCost).toBeGreaterThanOrEqual(0);

            // Edge case 3: Maximum discount (Level 10 = 60%)
            const maxDiscountCost = calculateRepairCost(sumOfAllAttributes, 100, 50, 10, 0);
            const rawCost = sumOfAllAttributes * 100 * 1.0; // 100% damage, 1.0x multiplier
            expect(maxDiscountCost).toBe(Math.round(rawCost * 0.40));
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
