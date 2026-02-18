const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function calculateActualRepairCosts() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ACTUAL REPAIR COST CALCULATION - CYCLE 2');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get battles 59, 60, 61 with full robot data
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

    console.log(`Found ${battles.length} battles\n`);

    let totalRepairCosts = 0;

    battles.forEach((battle) => {
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`  BATTLE #${battle.id}`);
      console.log(`═══════════════════════════════════════════════════════════\n`);

      console.log(`Battle Type: ${battle.battleType} (${battle.leagueType || 'N/A'})`);
      console.log(`Robot1: ${battle.robot1.name} (User ${battle.robot1.userId})`);
      console.log(`Robot2: ${battle.robot2.name} (User ${battle.robot2.userId})\n`);

      // Calculate Robot 1 repair cost
      const robot1 = battle.robot1;
      const robot1SumOfAttributes = 
        (Number(robot1.combatPower) || 0) + (Number(robot1.targetingSystems) || 0) + (Number(robot1.criticalSystems) || 0) +
        (Number(robot1.penetration) || 0) + (Number(robot1.weaponControl) || 0) + (Number(robot1.attackSpeed) || 0) +
        (Number(robot1.armorPlating) || 0) + (Number(robot1.shieldCapacity) || 0) + (Number(robot1.evasionThrusters) || 0) +
        (Number(robot1.damageDampeners) || 0) + (Number(robot1.counterProtocols) || 0) + (Number(robot1.shieldRegeneration) || 0) +
        (Number(robot1.hullIntegrity) || 0) + (Number(robot1.servoMotors) || 0) + (Number(robot1.gyroStabilizers) || 0) +
        (Number(robot1.hydraulicSystems) || 0) + (Number(robot1.powerCore) || 0) + (Number(robot1.coolingSystem) || 0) +
        (Number(robot1.sensorArray) || 0) + (Number(robot1.targetingComputer) || 0) + (Number(robot1.aiCore) || 0) +
        (Number(robot1.tacticalProcessor) || 0) + (Number(robot1.teamCoordination) || 0);

      const robot1MaxHP = robot1.maxHP || 100;
      const robot1FinalHP = battle.robot1FinalHP || 0;
      const robot1Damage = robot1MaxHP - robot1FinalHP;
      const robot1DamagePercent = (robot1Damage / robot1MaxHP) * 100;
      const robot1HPPercent = (robot1FinalHP / robot1MaxHP) * 100;

      // Determine multiplier
      let robot1Multiplier = 1.0;
      if (robot1HPPercent === 0) {
        robot1Multiplier = 2.0;
      } else if (robot1HPPercent < 10) {
        robot1Multiplier = 1.5;
      }

      const robot1BaseRepairCost = robot1SumOfAttributes * 100;
      const robot1CalculatedCost = Math.round(robot1BaseRepairCost * (robot1DamagePercent / 100) * robot1Multiplier);
      const robot1ActualCost = battle.robot1RepairCost || 0;

      console.log(`${robot1.name}:`);
      console.log(`  Sum of All Attributes: ${robot1SumOfAttributes}`);
      console.log(`  Base Repair Cost: ${robot1SumOfAttributes} × 100 = ₡${robot1BaseRepairCost.toLocaleString()}`);
      console.log(`  Max HP: ${robot1MaxHP}`);
      console.log(`  Final HP: ${robot1FinalHP} (${robot1HPPercent.toFixed(1)}%)`);
      console.log(`  Damage: ${robot1Damage} HP (${robot1DamagePercent.toFixed(1)}%)`);
      console.log(`  Multiplier: ${robot1Multiplier}x ${robot1HPPercent === 0 ? '(destroyed)' : robot1HPPercent < 10 ? '(critical)' : '(normal)'}`);
      console.log(`  Formula: ₡${robot1BaseRepairCost.toLocaleString()} × ${robot1DamagePercent.toFixed(1)}% × ${robot1Multiplier} = ₡${robot1CalculatedCost.toLocaleString()}`);
      console.log(`  Actual Charged: ₡${robot1ActualCost.toLocaleString()}`);
      
      if (Math.abs(robot1CalculatedCost - robot1ActualCost) > 1) {
        console.log(`  ⚠️  DISCREPANCY: ₡${(robot1ActualCost - robot1CalculatedCost).toLocaleString()}`);
      } else {
        console.log(`  ✅ MATCH!`);
      }
      console.log();

      // Calculate Robot 2 repair cost
      const robot2 = battle.robot2;
      const robot2SumOfAttributes = 
        (Number(robot2.combatPower) || 0) + (Number(robot2.targetingSystems) || 0) + (Number(robot2.criticalSystems) || 0) +
        (Number(robot2.penetration) || 0) + (Number(robot2.weaponControl) || 0) + (Number(robot2.attackSpeed) || 0) +
        (Number(robot2.armorPlating) || 0) + (Number(robot2.shieldCapacity) || 0) + (Number(robot2.evasionThrusters) || 0) +
        (Number(robot2.damageDampeners) || 0) + (Number(robot2.counterProtocols) || 0) + (Number(robot2.shieldRegeneration) || 0) +
        (Number(robot2.hullIntegrity) || 0) + (Number(robot2.servoMotors) || 0) + (Number(robot2.gyroStabilizers) || 0) +
        (Number(robot2.hydraulicSystems) || 0) + (Number(robot2.powerCore) || 0) + (Number(robot2.coolingSystem) || 0) +
        (Number(robot2.sensorArray) || 0) + (Number(robot2.targetingComputer) || 0) + (Number(robot2.aiCore) || 0) +
        (Number(robot2.tacticalProcessor) || 0) + (Number(robot2.teamCoordination) || 0);

      const robot2MaxHP = robot2.maxHP || 100;
      const robot2FinalHP = battle.robot2FinalHP || 0;
      const robot2Damage = robot2MaxHP - robot2FinalHP;
      const robot2DamagePercent = (robot2Damage / robot2MaxHP) * 100;
      const robot2HPPercent = (robot2FinalHP / robot2MaxHP) * 100;

      // Determine multiplier
      let robot2Multiplier = 1.0;
      if (robot2HPPercent === 0) {
        robot2Multiplier = 2.0;
      } else if (robot2HPPercent < 10) {
        robot2Multiplier = 1.5;
      }

      const robot2BaseRepairCost = robot2SumOfAttributes * 100;
      const robot2CalculatedCost = Math.round(robot2BaseRepairCost * (robot2DamagePercent / 100) * robot2Multiplier);
      const robot2ActualCost = battle.robot2RepairCost || 0;

      console.log(`${robot2.name}:`);
      console.log(`  Sum of All Attributes: ${robot2SumOfAttributes}`);
      console.log(`  Base Repair Cost: ${robot2SumOfAttributes} × 100 = ₡${robot2BaseRepairCost.toLocaleString()}`);
      console.log(`  Max HP: ${robot2MaxHP}`);
      console.log(`  Final HP: ${robot2FinalHP} (${robot2HPPercent.toFixed(1)}%)`);
      console.log(`  Damage: ${robot2Damage} HP (${robot2DamagePercent.toFixed(1)}%)`);
      console.log(`  Multiplier: ${robot2Multiplier}x ${robot2HPPercent === 0 ? '(destroyed)' : robot2HPPercent < 10 ? '(critical)' : '(normal)'}`);
      console.log(`  Formula: ₡${robot2BaseRepairCost.toLocaleString()} × ${robot2DamagePercent.toFixed(1)}% × ${robot2Multiplier} = ₡${robot2CalculatedCost.toLocaleString()}`);
      console.log(`  Actual Charged: ₡${robot2ActualCost.toLocaleString()}`);
      
      if (Math.abs(robot2CalculatedCost - robot2ActualCost) > 1) {
        console.log(`  ⚠️  DISCREPANCY: ₡${(robot2ActualCost - robot2CalculatedCost).toLocaleString()}`);
      } else {
        console.log(`  ✅ MATCH!`);
      }
      console.log();

      // Track player1's costs
      if (robot1.userId === 2) {
        totalRepairCosts += robot1ActualCost;
      }
      if (robot2.userId === 2) {
        totalRepairCosts += robot2ActualCost;
      }

      console.log(`Battle Total: ₡${(robot1ActualCost + robot2ActualCost).toLocaleString()}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TOTAL REPAIR COSTS FOR PLAYER1: ₡${totalRepairCosts.toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('FORMULA SUMMARY:');
    console.log('  Base Repair Cost = Sum of All 23 Attributes × 100');
    console.log('  Damage Multiplier = 2.0x if HP=0, 1.5x if HP<10%, else 1.0x');
    console.log('  Final Cost = Base × (Damage% / 100) × Multiplier');
    console.log('  (Repair Bay discount NOT applied during battle execution)\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

calculateActualRepairCosts();
