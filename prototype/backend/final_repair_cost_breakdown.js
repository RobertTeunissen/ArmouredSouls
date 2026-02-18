const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalRepairCostBreakdown() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  CYCLE 2 REPAIR COSTS - COMPLETE BREAKDOWN');
  console.log('  Including Repair Bay Level 2 Discount');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get player1's repair bay level
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: 2,
        facilityType: 'repair_bay'
      }
    });

    const repairBayLevel = repairBay ? repairBay.level : 0;
    const activeRobotCount = 2; // player1 has 2 robots

    // Calculate discount: repairBayLevel × (5 + activeRobotCount), capped at 90%
    const rawDiscount = repairBayLevel * (5 + activeRobotCount);
    const discountPercent = Math.min(rawDiscount, 90);
    const discountMultiplier = 1 - (discountPercent / 100);

    console.log('REPAIR BAY DISCOUNT:');
    console.log(`  Repair Bay Level: ${repairBayLevel}`);
    console.log(`  Active Robots: ${activeRobotCount}`);
    console.log(`  Formula: ${repairBayLevel} × (5 + ${activeRobotCount}) = ${rawDiscount}%`);
    console.log(`  Discount: ${discountPercent}%`);
    console.log(`  Multiplier: ${discountMultiplier} (pay ${(discountMultiplier * 100).toFixed(0)}% of cost)\n`);

    // Get battles 59, 60, 61
    const battles = await prisma.battle.findMany({
      where: {
        id: { in: [59, 60, 61] }
      },
      include: {
        robot1: true,
        robot2: true
      },
      orderBy: { id: 'asc' }
    });

    let totalRepairCosts = 0;
    const repairsByRobot = {};

    battles.forEach((battle) => {
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`  BATTLE #${battle.id}`);
      console.log(`═══════════════════════════════════════════════════════════\n`);

      console.log(`Battle Type: ${battle.battleType} (${battle.leagueType || 'N/A'})`);
      console.log(`${battle.robot1.name} (User ${battle.robot1.userId}) vs ${battle.robot2.name} (User ${battle.robot2.userId})\n`);

      // Process Robot 1
      const robot1 = battle.robot1;
      const robot1Sum = 
        (Number(robot1.combatPower) || 0) + (Number(robot1.targetingSystems) || 0) + (Number(robot1.criticalSystems) || 0) +
        (Number(robot1.penetration) || 0) + (Number(robot1.weaponControl) || 0) + (Number(robot1.attackSpeed) || 0) +
        (Number(robot1.armorPlating) || 0) + (Number(robot1.shieldCapacity) || 0) + (Number(robot1.evasionThrusters) || 0) +
        (Number(robot1.damageDampeners) || 0) + (Number(robot1.counterProtocols) || 0) + (Number(robot1.shieldRegeneration) || 0) +
        (Number(robot1.hullIntegrity) || 0) + (Number(robot1.servoMotors) || 0) + (Number(robot1.gyroStabilizers) || 0) +
        (Number(robot1.hydraulicSystems) || 0) + (Number(robot1.powerCore) || 0) + (Number(robot1.coolingSystem) || 0) +
        (Number(robot1.sensorArray) || 0) + (Number(robot1.targetingComputer) || 0) + (Number(robot1.aiCore) || 0) +
        (Number(robot1.tacticalProcessor) || 0) + (Number(robot1.teamCoordination) || 0);

      const robot1MaxHP = robot1.maxHP;
      const robot1FinalHP = battle.robot1FinalHP;
      const robot1Damage = robot1MaxHP - robot1FinalHP;
      const robot1DamagePercent = (robot1Damage / robot1MaxHP) * 100;
      const robot1HPPercent = (robot1FinalHP / robot1MaxHP) * 100;

      let robot1Multiplier = 1.0;
      if (robot1HPPercent === 0) {
        robot1Multiplier = 2.0;
      } else if (robot1HPPercent < 10) {
        robot1Multiplier = 1.5;
      }

      const robot1BaseRepairCost = robot1Sum * 100;
      const robot1RawCost = robot1BaseRepairCost * (robot1DamagePercent / 100) * robot1Multiplier;
      
      // Apply discount only for player1's robots
      const robot1IsPlayer1 = robot1.userId === 2;
      const robot1FinalCost = robot1IsPlayer1 ? Math.round(robot1RawCost * discountMultiplier) : Math.round(robot1RawCost);
      const robot1ActualCost = battle.robot1RepairCost || 0;

      console.log(`${robot1.name}:`);
      console.log(`  Sum of Attributes: ${robot1Sum}`);
      console.log(`  Base Repair Cost: ${robot1Sum} × 100 = ₡${robot1BaseRepairCost.toLocaleString()}`);
      console.log(`  Damage: ${robot1Damage}/${robot1MaxHP} HP (${robot1DamagePercent.toFixed(1)}%)`);
      console.log(`  Final HP: ${robot1FinalHP} (${robot1HPPercent.toFixed(1)}%)`);
      console.log(`  Multiplier: ${robot1Multiplier}x ${robot1HPPercent === 0 ? '(destroyed)' : robot1HPPercent < 10 ? '(critical)' : '(normal)'}`);
      console.log(`  Raw Cost: ₡${robot1BaseRepairCost.toLocaleString()} × ${(robot1DamagePercent/100).toFixed(4)} × ${robot1Multiplier} = ₡${Math.round(robot1RawCost).toLocaleString()}`);
      
      if (robot1IsPlayer1) {
        console.log(`  Repair Bay Discount: ${discountPercent}% (Level ${repairBayLevel})`);
        console.log(`  Final Cost: ₡${Math.round(robot1RawCost).toLocaleString()} × ${discountMultiplier} = ₡${robot1FinalCost.toLocaleString()}`);
      } else {
        console.log(`  Final Cost: ₡${robot1FinalCost.toLocaleString()} (no discount - not player1's robot)`);
      }
      
      console.log(`  Actual Charged: ₡${robot1ActualCost.toLocaleString()}`);
      
      if (Math.abs(robot1FinalCost - robot1ActualCost) <= 1) {
        console.log(`  ✅ MATCH!`);
      } else {
        console.log(`  ⚠️  DISCREPANCY: ₡${(robot1ActualCost - robot1FinalCost).toLocaleString()}`);
      }
      console.log();

      // Process Robot 2
      const robot2 = battle.robot2;
      const robot2Sum = 
        (Number(robot2.combatPower) || 0) + (Number(robot2.targetingSystems) || 0) + (Number(robot2.criticalSystems) || 0) +
        (Number(robot2.penetration) || 0) + (Number(robot2.weaponControl) || 0) + (Number(robot2.attackSpeed) || 0) +
        (Number(robot2.armorPlating) || 0) + (Number(robot2.shieldCapacity) || 0) + (Number(robot2.evasionThrusters) || 0) +
        (Number(robot2.damageDampeners) || 0) + (Number(robot2.counterProtocols) || 0) + (Number(robot2.shieldRegeneration) || 0) +
        (Number(robot2.hullIntegrity) || 0) + (Number(robot2.servoMotors) || 0) + (Number(robot2.gyroStabilizers) || 0) +
        (Number(robot2.hydraulicSystems) || 0) + (Number(robot2.powerCore) || 0) + (Number(robot2.coolingSystem) || 0) +
        (Number(robot2.sensorArray) || 0) + (Number(robot2.targetingComputer) || 0) + (Number(robot2.aiCore) || 0) +
        (Number(robot2.tacticalProcessor) || 0) + (Number(robot2.teamCoordination) || 0);

      const robot2MaxHP = robot2.maxHP;
      const robot2FinalHP = battle.robot2FinalHP;
      const robot2Damage = robot2MaxHP - robot2FinalHP;
      const robot2DamagePercent = (robot2Damage / robot2MaxHP) * 100;
      const robot2HPPercent = (robot2FinalHP / robot2MaxHP) * 100;

      let robot2Multiplier = 1.0;
      if (robot2HPPercent === 0) {
        robot2Multiplier = 2.0;
      } else if (robot2HPPercent < 10) {
        robot2Multiplier = 1.5;
      }

      const robot2BaseRepairCost = robot2Sum * 100;
      const robot2RawCost = robot2BaseRepairCost * (robot2DamagePercent / 100) * robot2Multiplier;
      
      // Apply discount only for player1's robots
      const robot2IsPlayer1 = robot2.userId === 2;
      const robot2FinalCost = robot2IsPlayer1 ? Math.round(robot2RawCost * discountMultiplier) : Math.round(robot2RawCost);
      const robot2ActualCost = battle.robot2RepairCost || 0;

      console.log(`${robot2.name}:`);
      console.log(`  Sum of Attributes: ${robot2Sum}`);
      console.log(`  Base Repair Cost: ${robot2Sum} × 100 = ₡${robot2BaseRepairCost.toLocaleString()}`);
      console.log(`  Damage: ${robot2Damage}/${robot2MaxHP} HP (${robot2DamagePercent.toFixed(1)}%)`);
      console.log(`  Final HP: ${robot2FinalHP} (${robot2HPPercent.toFixed(1)}%)`);
      console.log(`  Multiplier: ${robot2Multiplier}x ${robot2HPPercent === 0 ? '(destroyed)' : robot2HPPercent < 10 ? '(critical)' : '(normal)'}`);
      console.log(`  Raw Cost: ₡${robot2BaseRepairCost.toLocaleString()} × ${(robot2DamagePercent/100).toFixed(4)} × ${robot2Multiplier} = ₡${Math.round(robot2RawCost).toLocaleString()}`);
      
      if (robot2IsPlayer1) {
        console.log(`  Repair Bay Discount: ${discountPercent}% (Level ${repairBayLevel})`);
        console.log(`  Final Cost: ₡${Math.round(robot2RawCost).toLocaleString()} × ${discountMultiplier} = ₡${robot2FinalCost.toLocaleString()}`);
      } else {
        console.log(`  Final Cost: ₡${robot2FinalCost.toLocaleString()} (no discount - not player1's robot)`);
      }
      
      console.log(`  Actual Charged: ₡${robot2ActualCost.toLocaleString()}`);
      
      if (Math.abs(robot2FinalCost - robot2ActualCost) <= 1) {
        console.log(`  ✅ MATCH!`);
      } else {
        console.log(`  ⚠️  DISCREPANCY: ₡${(robot2ActualCost - robot2FinalCost).toLocaleString()}`);
      }
      console.log();

      // Track player1's costs
      if (robot1IsPlayer1) {
        totalRepairCosts += robot1ActualCost;
        if (!repairsByRobot[robot1.name]) {
          repairsByRobot[robot1.name] = { battles: 0, totalRepairs: 0, totalDamage: 0 };
        }
        repairsByRobot[robot1.name].battles++;
        repairsByRobot[robot1.name].totalRepairs += robot1ActualCost;
        repairsByRobot[robot1.name].totalDamage += robot1Damage;
      }

      if (robot2IsPlayer1) {
        totalRepairCosts += robot2ActualCost;
        if (!repairsByRobot[robot2.name]) {
          repairsByRobot[robot2.name] = { battles: 0, totalRepairs: 0, totalDamage: 0 };
        }
        repairsByRobot[robot2.name].battles++;
        repairsByRobot[robot2.name].totalRepairs += robot2ActualCost;
        repairsByRobot[robot2.name].totalDamage += robot2Damage;
      }
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  PLAYER1 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    Object.entries(repairsByRobot).forEach(([robotName, stats]) => {
      console.log(`${robotName}:`);
      console.log(`  Battles: ${stats.battles}`);
      console.log(`  Total Damage: ${stats.totalDamage} HP`);
      console.log(`  Total Repairs: ₡${stats.totalRepairs.toLocaleString()}`);
      console.log();
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TOTAL REPAIR COSTS FOR PLAYER1: ₡${totalRepairCosts.toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('FORMULA:');
    console.log('  1. Base Repair Cost = Sum of All 23 Attributes × 100');
    console.log('  2. Damage Multiplier = 2.0x if HP=0, 1.5x if HP<10%, else 1.0x');
    console.log('  3. Raw Cost = Base × (Damage% / 100) × Multiplier');
    console.log('  4. Repair Bay Discount = Level × (5 + Active Robots), capped at 90%');
    console.log('  5. Final Cost = Raw Cost × (1 - Discount%)');
    console.log();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalRepairCostBreakdown();
