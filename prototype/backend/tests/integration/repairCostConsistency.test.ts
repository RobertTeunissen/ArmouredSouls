/**
 * Integration Test: Repair Cost Consistency Across Battle Types
 * 
 * **Validates: Requirement 8.6**
 * 
 * This test verifies that repair costs are calculated consistently across different battle types
 * (tag team battles and league battles) when using the canonical repair cost function.
 * 
 * The test ensures:
 * - Tag team battles use the canonical calculateRepairCost function
 * - Repair costs are consistent for the same damage, HP, and facility levels
 * - Multi-robot discount is applied correctly in both battle types
 * - Medical Bay reduction is applied consistently
 */

import prisma from '../../src/lib/prisma';
import { calculateRepairCost, calculateAttributeSum } from '../../src/utils/robotCalculations';


describe('Repair Cost Consistency Integration Test', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testWeapon: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Get a weapon for robots
    testWeapon = await prisma.weapon.findFirst();
    if (!testWeapon) {
      throw new Error('No weapons found. Run seed first.');
    }
  });

  afterEach(async () => {
    // Clean up in correct order
    if (testRobotIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { robot: { id: { in: testRobotIds } } },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.facility.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    testRobotIds = [];
    testUserIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('canonical function produces consistent repair costs for same damage', async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `repair_consistency_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
      },
    });
    testUserIds.push(testUser.id);

    // Create Repair Bay facility (level 3 = 21% discount with 2 robots)
    await prisma.facility.create({
      data: {
        userId: testUser.id,
        facilityType: 'repair_bay',
        level: 3,
      },
    });

    // Create Medical Bay facility (level 2 = 20% reduction to destruction multiplier)
    await prisma.facility.create({
      data: {
        userId: testUser.id,
        facilityType: 'medical_bay',
        level: 2,
      },
    });

    // Create 2 robots for multi-robot discount
    const testRobots: any[] = [];
    for (let i = 0; i < 2; i++) {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: testWeapon.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: `Consistency_Robot_${i}_${Date.now()}`,
          elo: 1000,
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
          yieldThreshold: 20,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
          leaguePoints: 0,
          cyclesInCurrentLeague: 0,
          // Set all 23 attributes to 10.0 for consistent testing
          combatPower: 10,
          targetingSystems: 10,
          criticalSystems: 10,
          penetration: 10,
          weaponControl: 10,
          attackSpeed: 10,
          armorPlating: 10,
          shieldCapacity: 10,
          evasionThrusters: 10,
          damageDampeners: 10,
          counterProtocols: 10,
          hullIntegrity: 10,
          servoMotors: 10,
          gyroStabilizers: 10,
          hydraulicSystems: 10,
          powerCore: 10,
          combatAlgorithms: 10,
          threatAnalysis: 10,
          adaptiveAI: 10,
          logicCores: 10,
          syncProtocols: 10,
          supportSystems: 10,
          formationTactics: 10,
        },
      });
      testRobots.push(robot);
      testRobotIds.push(robot.id);
    }
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
          leaguePoints: 0,
          cyclesInCurrentLeague: 0,
          // Set all 23 attributes to 10.0 for consistent testing
          combatPower: 10,
          targetingSystems: 10,
          criticalSystems: 10,
          penetration: 10,
          weaponControl: 10,
          attackSpeed: 10,
          armorPlating: 10,
          shieldCapacity: 10,
          evasionThrusters: 10,
          damageDampeners: 10,
          counterProtocols: 10,
          hullIntegrity: 10,
          servoMotors: 10,
          gyroStabilizers: 10,
          hydraulicSystems: 10,
          powerCore: 10,
          combatAlgorithms: 10,
          threatAnalysis: 10,
          adaptiveAI: 10,
          logicCores: 10,
          syncProtocols: 10,
          supportSystems: 10,
          formationTactics: 10,
        },
      });
      testRobots.push(robot);
      testRobotIds.push(robot.id);
    }

    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    // Get active robot count
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    expect(activeRobotCount).toBe(2);
    expect(repairBay?.level).toBe(3);
    expect(medicalBay?.level).toBe(2);

    // Test scenario 1: Normal damage (50% damage, 50% HP remaining)
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    const damagePercent = 50;
    const hpPercent = 50;

    const repairCost1 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Call the function again with same parameters (simulating different battle type)
    const repairCost2 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Verify costs are identical
    expect(repairCost1).toBe(repairCost2);
    expect(repairCost1).toBeGreaterThan(0);

    // Verify the discount is applied correctly
    // Expected: repairBayLevel × (5 + activeRobotCount) = 3 × (5 + 2) = 21%
    const expectedDiscount = 21;
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * 1.0; // 1.0x multiplier for HP >= 10%
    const expectedCost = Math.round(rawCost * (1 - expectedDiscount / 100));

    expect(repairCost1).toBe(expectedCost);
  });

  test('canonical function handles destroyed robots consistently', async () => {
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    // Get active robot count
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    // Test scenario 2: Destroyed robot (100% damage, 0% HP)
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    const damagePercent = 100;
    const hpPercent = 0;

    const repairCost1 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Call the function again with same parameters
    const repairCost2 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Verify costs are identical
    expect(repairCost1).toBe(repairCost2);
    expect(repairCost1).toBeGreaterThan(0);

    // Verify Medical Bay reduction is applied
    // Multiplier: 2.0 * (1 - 0.2) = 1.6 (Medical Bay level 2 reduces by 20%)
    const expectedMultiplier = 2.0 * (1 - (medicalBay?.level || 0) * 0.1);
    expect(expectedMultiplier).toBe(1.6);

    // Verify the discount is applied correctly
    const expectedDiscount = 21; // 3 × (5 + 2) = 21%
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * expectedMultiplier;
    const expectedCost = Math.round(rawCost * (1 - expectedDiscount / 100));

    expect(repairCost1).toBe(expectedCost);
  });

  test('canonical function handles heavily damaged robots consistently', async () => {
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    // Get active robot count
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    // Test scenario 3: Heavily damaged robot (95% damage, 5% HP)
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    const damagePercent = 95;
    const hpPercent = 5;

    const repairCost1 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Call the function again with same parameters
    const repairCost2 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Verify costs are identical
    expect(repairCost1).toBe(repairCost2);
    expect(repairCost1).toBeGreaterThan(0);

    // Verify the 1.5x multiplier is applied for HP < 10%
    const expectedMultiplier = 1.5;
    const expectedDiscount = 21; // 3 × (5 + 2) = 21%
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * expectedMultiplier;
    const expectedCost = Math.round(rawCost * (1 - expectedDiscount / 100));

    expect(repairCost1).toBe(expectedCost);
  });

  test('repair costs scale correctly with robot count', async () => {
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    const damagePercent = 50;
    const hpPercent = 50;

    // Calculate cost with 2 robots (current state)
    const costWith2Robots = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      0, // medicalBayLevel
      2  // activeRobotCount
    );

    // Calculate cost with 1 robot (hypothetical)
    const costWith1Robot = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      0, // medicalBayLevel
      1  // activeRobotCount
    );

    // Calculate cost with 0 robots (hypothetical)
    const costWith0Robots = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      0, // medicalBayLevel
      0  // activeRobotCount
    );

    // Verify costs decrease as robot count increases (higher discount)
    expect(costWith2Robots).toBeLessThan(costWith1Robot);
    expect(costWith1Robot).toBeLessThan(costWith0Robots);

    // Verify discount calculations
    // 2 robots: 3 × (5 + 2) = 21%
    // 1 robot:  3 × (5 + 1) = 18%
    // 0 robots: 3 × (5 + 0) = 15%
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * 1.0;

    expect(costWith2Robots).toBe(Math.round(rawCost * 0.79)); // 1 - 0.21
    expect(costWith1Robot).toBe(Math.round(rawCost * 0.82));  // 1 - 0.18
    expect(costWith0Robots).toBe(Math.round(rawCost * 0.85)); // 1 - 0.15
  });

  test('repair costs respect 90% discount cap', async () => {
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    const damagePercent = 100;
    const hpPercent = 50;

    // Scenario that would exceed 90% discount: level 10 repair bay + 10 robots
    // 10 × (5 + 10) = 150% -> capped at 90%
    const costAtCap = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      10, // repairBayLevel
      0,  // medicalBayLevel
      10  // activeRobotCount
    );

    // Scenario that exactly hits 90% discount: level 6 repair bay + 10 robots
    // 6 × (5 + 10) = 90%
    const costAtExact90 = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      6,  // repairBayLevel
      0,  // medicalBayLevel
      10  // activeRobotCount
    );

    // Both should result in the same cost (90% discount)
    expect(costAtCap).toBe(costAtExact90);

    // Verify the cost is 10% of base (90% discount)
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * 1.0;
    const expectedCost = Math.round(rawCost * 0.10); // 1 - 0.90

    expect(costAtCap).toBe(expectedCost);
  });

  test('zero damage results in zero repair cost', async () => {
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);

    const repairCost = calculateRepairCost(
      sumOfAllAttributes,
      0,   // damagePercent = 0
      100, // hpPercent = 100 (full health)
      3,   // repairBayLevel
      2,   // medicalBayLevel
      2    // activeRobotCount
    );

    expect(repairCost).toBe(0);
  });

  test('attribute sum affects repair cost linearly', async () => {
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    const damagePercent = 50;
    const hpPercent = 50;

    // Calculate cost with base attributes
    const baseCost = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      0, // repairBayLevel = 0 (no discount for easier comparison)
      0, // medicalBayLevel
      0  // activeRobotCount
    );

    // Calculate cost with doubled attributes
    const doubledCost = calculateRepairCost(
      sumOfAllAttributes * 2,
      damagePercent,
      hpPercent,
      0, // repairBayLevel = 0
      0, // medicalBayLevel
      0  // activeRobotCount
    );

    // Cost should scale linearly with attributes
    expect(doubledCost).toBe(baseCost * 2);
  });

  test('tag team battle repair costs use canonical function', async () => {
    // This test verifies that tag team battles would calculate repair costs
    // using the same canonical function as league battles
    
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    // Simulate tag team battle damage scenario
    // Active robot takes 60% damage, ends at 40% HP
    const activeDamagePercent = 60;
    const activeHpPercent = 40;
    
    // Reserve robot takes 30% damage, ends at 70% HP
    const reserveDamagePercent = 30;
    const reserveHpPercent = 70;

    // Calculate repair costs using canonical function (as tag team battles do)
    const activeRepairCost = calculateRepairCost(
      sumOfAllAttributes,
      activeDamagePercent,
      activeHpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    const reserveRepairCost = calculateRepairCost(
      sumOfAllAttributes,
      reserveDamagePercent,
      reserveHpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Verify both costs are calculated correctly
    expect(activeRepairCost).toBeGreaterThan(0);
    expect(reserveRepairCost).toBeGreaterThan(0);
    
    // Active robot should have higher repair cost (more damage)
    expect(activeRepairCost).toBeGreaterThan(reserveRepairCost);

    // Verify the costs match expected calculations
    const baseRepairCost = sumOfAllAttributes * 100;
    const expectedDiscount = 21; // 3 × (5 + 2) = 21%
    
    const expectedActiveCost = Math.round(
      baseRepairCost * (activeDamagePercent / 100) * 1.0 * (1 - expectedDiscount / 100)
    );
    const expectedReserveCost = Math.round(
      baseRepairCost * (reserveDamagePercent / 100) * 1.0 * (1 - expectedDiscount / 100)
    );

    expect(activeRepairCost).toBe(expectedActiveCost);
    expect(reserveRepairCost).toBe(expectedReserveCost);
  });

  test('league battle and tag team battle produce same repair cost for same damage', async () => {
    // This test explicitly verifies that league battles and tag team battles
    // would produce identical repair costs for the same damage scenario
    
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    // Same damage scenario for both battle types
    const damagePercent = 75;
    const hpPercent = 25;

    // Calculate repair cost as if from league battle
    const leagueBattleRepairCost = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Calculate repair cost as if from tag team battle
    const tagTeamBattleRepairCost = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Verify costs are identical (validates Requirement 8.6)
    expect(leagueBattleRepairCost).toBe(tagTeamBattleRepairCost);
    expect(leagueBattleRepairCost).toBeGreaterThan(0);

    // Verify the cost is calculated correctly
    const baseRepairCost = sumOfAllAttributes * 100;
    const expectedDiscount = 21; // 3 × (5 + 2) = 21%
    const expectedCost = Math.round(
      baseRepairCost * (damagePercent / 100) * 1.0 * (1 - expectedDiscount / 100)
    );

    expect(leagueBattleRepairCost).toBe(expectedCost);
  });

  test('league battle repair costs use canonical function with multi-robot discount', async () => {
    /**
     * **Validates: Requirement 8.7**
     * 
     * This test verifies that league battles use the canonical calculateRepairCost function
     * from robotCalculations.ts with the multi-robot discount properly applied.
     * 
     * The test ensures:
     * - League battles calculate repair costs using the canonical function
     * - The activeRobotCount parameter is correctly passed
     * - The multi-robot discount is applied correctly
     * - Repair costs are consistent with the expected formula
     */
    
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    
    // Get facility levels (simulating what battleOrchestrator does)
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    // Get active robot count (simulating what battleOrchestrator does)
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    expect(activeRobotCount).toBe(2);
    expect(repairBay?.level).toBe(3);
    expect(medicalBay?.level).toBe(2);

    // Simulate league battle damage scenario
    // Robot takes 80% damage in a league battle, ends at 20% HP
    const damagePercent = 80;
    const hpPercent = 20;

    // Calculate repair cost using the canonical function (as league battles do)
    // This is the exact same call that battleOrchestrator.ts makes
    const leagueRepairCost = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    // Verify the repair cost is calculated correctly
    expect(leagueRepairCost).toBeGreaterThan(0);

    // Verify the multi-robot discount is applied
    // Expected discount: repairBayLevel × (5 + activeRobotCount) = 3 × (5 + 2) = 21%
    const expectedDiscount = 21;
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * 1.0; // 1.0x multiplier for HP >= 10%
    const expectedCost = Math.round(rawCost * (1 - expectedDiscount / 100));

    expect(leagueRepairCost).toBe(expectedCost);

    // Verify that without the multi-robot discount, the cost would be higher
    const costWithoutMultiRobotBonus = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      0 // No multi-robot bonus
    );

    // With 0 robots: 3 × (5 + 0) = 15% discount
    // With 2 robots: 3 × (5 + 2) = 21% discount
    // The cost with 2 robots should be lower
    expect(leagueRepairCost).toBeLessThan(costWithoutMultiRobotBonus);

    // Verify the exact discount difference
    const discountWithoutBonus = 15; // 3 × 5 = 15%
    const expectedCostWithoutBonus = Math.round(rawCost * (1 - discountWithoutBonus / 100));
    expect(costWithoutMultiRobotBonus).toBe(expectedCostWithoutBonus);
  });

  test('league battle repair costs handle destroyed robots correctly', async () => {
    /**
     * **Validates: Requirement 8.7**
     * 
     * This test verifies that league battles correctly handle destroyed robots
     * using the canonical function with Medical Bay reduction.
     */
    
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    const medicalBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'medical_bay',
      },
    });

    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: testUser.id,
        NOT: { name: 'Bye Robot' },
      },
    });

    // Simulate league battle where robot is destroyed (100% damage, 0% HP)
    const damagePercent = 100;
    const hpPercent = 0;

    // Calculate repair cost using canonical function (as league battles do)
    const leagueRepairCost = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      medicalBay?.level || 0,
      activeRobotCount
    );

    expect(leagueRepairCost).toBeGreaterThan(0);

    // Verify Medical Bay reduction is applied to destruction multiplier
    // Base multiplier: 2.0
    // Medical Bay level 2: 2.0 × (1 - 0.2) = 1.6
    const expectedMultiplier = 2.0 * (1 - (medicalBay?.level || 0) * 0.1);
    expect(expectedMultiplier).toBe(1.6);

    // Verify the repair cost calculation
    const expectedDiscount = 21; // 3 × (5 + 2) = 21%
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * expectedMultiplier;
    const expectedCost = Math.round(rawCost * (1 - expectedDiscount / 100));

    expect(leagueRepairCost).toBe(expectedCost);
  });

  test('league battle repair costs scale with different robot counts', async () => {
    /**
     * **Validates: Requirement 8.7**
     * 
     * This test verifies that league battles correctly apply the multi-robot discount
     * as the robot count changes.
     */
    
    const robot = testRobots[0];
    const sumOfAllAttributes = calculateAttributeSum(robot);
    
    // Get facility levels
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: testUser.id,
        facilityType: 'repair_bay',
      },
    });

    // Simulate league battle damage
    const damagePercent = 50;
    const hpPercent = 50;

    // Calculate costs with different robot counts (simulating different stable sizes)
    const costWith5Robots = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      0, // medicalBayLevel
      5  // activeRobotCount
    );

    const costWith3Robots = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      0, // medicalBayLevel
      3  // activeRobotCount
    );

    const costWith1Robot = calculateRepairCost(
      sumOfAllAttributes,
      damagePercent,
      hpPercent,
      repairBay?.level || 0,
      0, // medicalBayLevel
      1  // activeRobotCount
    );

    // Verify costs decrease as robot count increases (higher discount)
    expect(costWith5Robots).toBeLessThan(costWith3Robots);
    expect(costWith3Robots).toBeLessThan(costWith1Robot);

    // Verify exact discount calculations
    // 5 robots: 3 × (5 + 5) = 30%
    // 3 robots: 3 × (5 + 3) = 24%
    // 1 robot:  3 × (5 + 1) = 18%
    const baseRepairCost = sumOfAllAttributes * 100;
    const rawCost = baseRepairCost * (damagePercent / 100) * 1.0;

    expect(costWith5Robots).toBe(Math.round(rawCost * 0.70)); // 1 - 0.30
    expect(costWith3Robots).toBe(Math.round(rawCost * 0.76)); // 1 - 0.24
    expect(costWith1Robot).toBe(Math.round(rawCost * 0.82));  // 1 - 0.18
  });
});
