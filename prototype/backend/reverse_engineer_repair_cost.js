const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reverseEngineerRepairCost() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  REVERSE ENGINEER REPAIR COST FORMULA');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get battle 59 with full details
    const battle = await prisma.battle.findUnique({
      where: { id: 59 },
      include: {
        robot1: true,
        robot2: true
      }
    });

    const robot1 = battle.robot1;
    const robot2 = battle.robot2;

    // Calculate sum of attributes
    const robot1Sum = 
      (Number(robot1.combatPower) || 0) + (Number(robot1.targetingSystems) || 0) + (Number(robot1.criticalSystems) || 0) +
      (Number(robot1.penetration) || 0) + (Number(robot1.weaponControl) || 0) + (Number(robot1.attackSpeed) || 0) +
      (Number(robot1.armorPlating) || 0) + (Number(robot1.shieldCapacity) || 0) + (Number(robot1.evasionThrusters) || 0) +
      (Number(robot1.damageDampeners) || 0) + (Number(robot1.counterProtocols) || 0) + (Number(robot1.shieldRegeneration) || 0) +
      (Number(robot1.hullIntegrity) || 0) + (Number(robot1.servoMotors) || 0) + (Number(robot1.gyroStabilizers) || 0) +
      (Number(robot1.hydraulicSystems) || 0) + (Number(robot1.powerCore) || 0) + (Number(robot1.coolingSystem) || 0) +
      (Number(robot1.sensorArray) || 0) + (Number(robot1.targetingComputer) || 0) + (Number(robot1.aiCore) || 0) +
      (Number(robot1.tacticalProcessor) || 0) + (Number(robot1.teamCoordination) || 0);

    const robot2Sum = 
      (Number(robot2.combatPower) || 0) + (Number(robot2.targetingSystems) || 0) + (Number(robot2.criticalSystems) || 0) +
      (Number(robot2.penetration) || 0) + (Number(robot2.weaponControl) || 0) + (Number(robot2.attackSpeed) || 0) +
      (Number(robot2.armorPlating) || 0) + (Number(robot2.shieldCapacity) || 0) + (Number(robot2.evasionThrusters) || 0) +
      (Number(robot2.damageDampeners) || 0) + (Number(robot2.counterProtocols) || 0) + (Number(robot2.shieldRegeneration) || 0) +
      (Number(robot2.hullIntegrity) || 0) + (Number(robot2.servoMotors) || 0) + (Number(robot2.gyroStabilizers) || 0) +
      (Number(robot2.hydraulicSystems) || 0) + (Number(robot2.powerCore) || 0) + (Number(robot2.coolingSystem) || 0) +
      (Number(robot2.sensorArray) || 0) + (Number(robot2.targetingComputer) || 0) + (Number(robot2.aiCore) || 0) +
      (Number(robot2.tacticalProcessor) || 0) + (Number(robot2.teamCoordination) || 0);

    console.log('BATTLE #59 - TAG TEAM MATCH');
    console.log(`${robot1.name} vs ${robot2.name}\n`);

    console.log(`${robot1.name}:`);
    console.log(`  Sum of Attributes: ${robot1Sum}`);
    console.log(`  Max HP: ${robot1.maxHP}`);
    console.log(`  Final HP: ${battle.robot1FinalHP}`);
    console.log(`  Actual Repair Cost: ₡${battle.robot1RepairCost.toLocaleString()}\n`);

    // Work backwards from repair cost
    const robot1Cost = battle.robot1RepairCost;
    const robot1BaseRepair = robot1Sum * 100;
    
    console.log(`  Working backwards:`);
    console.log(`  ₡${robot1Cost} / (${robot1Sum} × 100) = ${(robot1Cost / robot1BaseRepair).toFixed(4)}`);
    console.log(`  This should equal: (damage% / 100) × multiplier\n`);
    
    // Try different scenarios
    const robot1FinalHP = battle.robot1FinalHP;
    const robot1MaxHP = robot1.maxHP;
    const robot1Damage = robot1MaxHP - robot1FinalHP;
    const robot1DamagePercent = (robot1Damage / robot1MaxHP) * 100;
    const robot1HPPercent = (robot1FinalHP / robot1MaxHP) * 100;
    
    console.log(`  Scenario 1: Using damage from MaxHP - FinalHP`);
    console.log(`    Damage: ${robot1MaxHP} - ${robot1FinalHP} = ${robot1Damage} HP`);
    console.log(`    Damage%: ${robot1DamagePercent.toFixed(2)}%`);
    console.log(`    HP%: ${robot1HPPercent.toFixed(2)}%`);
    console.log(`    Multiplier (HP < 10%): 1.5x`);
    console.log(`    Expected: ${robot1BaseRepair} × ${(robot1DamagePercent/100).toFixed(4)} × 1.5 = ₡${Math.round(robot1BaseRepair * (robot1DamagePercent/100) * 1.5).toLocaleString()}`);
    console.log(`    Actual: ₡${robot1Cost.toLocaleString()}`);
    console.log(`    Difference: ₡${(robot1Cost - Math.round(robot1BaseRepair * (robot1DamagePercent/100) * 1.5)).toLocaleString()}\n`);

    // Check if there's a different damage value stored
    console.log(`  Checking battle damage fields:`);
    console.log(`    robot1DamageDealt: ${battle.robot1DamageDealt}`);
    console.log(`    robot2DamageDealt: ${battle.robot2DamageDealt}\n`);

    // Try using robot2DamageDealt as robot1's damage taken
    const robot1DamageTaken = battle.robot2DamageDealt;
    const robot1DamageTakenPercent = (robot1DamageTaken / robot1MaxHP) * 100;
    
    console.log(`  Scenario 2: Using robot2DamageDealt as robot1's damage taken`);
    console.log(`    Damage Taken: ${robot1DamageTaken} HP`);
    console.log(`    Damage%: ${robot1DamageTakenPercent.toFixed(2)}%`);
    console.log(`    Multiplier (HP < 10%): 1.5x`);
    console.log(`    Expected: ${robot1BaseRepair} × ${(robot1DamageTakenPercent/100).toFixed(4)} × 1.5 = ₡${Math.round(robot1BaseRepair * (robot1DamageTakenPercent/100) * 1.5).toLocaleString()}`);
    console.log(`    Actual: ₡${robot1Cost.toLocaleString()}`);
    console.log(`    Difference: ₡${(robot1Cost - Math.round(robot1BaseRepair * (robot1DamageTakenPercent/100) * 1.5)).toLocaleString()}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`${robot2.name}:`);
    console.log(`  Sum of Attributes: ${robot2Sum}`);
    console.log(`  Max HP: ${robot2.maxHP}`);
    console.log(`  Final HP: ${battle.robot2FinalHP}`);
    console.log(`  Actual Repair Cost: ₡${battle.robot2RepairCost.toLocaleString()}\n`);

    const robot2Cost = battle.robot2RepairCost;
    const robot2BaseRepair = robot2Sum * 100;
    
    const robot2FinalHP = battle.robot2FinalHP;
    const robot2MaxHP = robot2.maxHP;
    const robot2Damage = robot2MaxHP - robot2FinalHP;
    const robot2DamagePercent = (robot2Damage / robot2MaxHP) * 100;
    const robot2HPPercent = (robot2FinalHP / robot2MaxHP) * 100;
    
    console.log(`  Scenario 1: Using damage from MaxHP - FinalHP`);
    console.log(`    Damage: ${robot2MaxHP} - ${robot2FinalHP} = ${robot2Damage} HP`);
    console.log(`    Damage%: ${robot2DamagePercent.toFixed(2)}%`);
    console.log(`    HP%: ${robot2HPPercent.toFixed(2)}%`);
    console.log(`    Multiplier (HP = 0): 2.0x`);
    console.log(`    Expected: ${robot2BaseRepair} × ${(robot2DamagePercent/100).toFixed(4)} × 2.0 = ₡${Math.round(robot2BaseRepair * (robot2DamagePercent/100) * 2.0).toLocaleString()}`);
    console.log(`    Actual: ₡${robot2Cost.toLocaleString()}`);
    console.log(`    Difference: ₡${(robot2Cost - Math.round(robot2BaseRepair * (robot2DamagePercent/100) * 2.0)).toLocaleString()}\n`);

    // Try using robot1DamageDealt as robot2's damage taken
    const robot2DamageTaken = battle.robot1DamageDealt;
    const robot2DamageTakenPercent = (robot2DamageTaken / robot2MaxHP) * 100;
    
    console.log(`  Scenario 2: Using robot1DamageDealt as robot2's damage taken`);
    console.log(`    Damage Taken: ${robot2DamageTaken} HP`);
    console.log(`    Damage%: ${robot2DamageTakenPercent.toFixed(2)}%`);
    console.log(`    Multiplier (HP = 0): 2.0x`);
    console.log(`    Expected: ${robot2BaseRepair} × ${(robot2DamageTakenPercent/100).toFixed(4)} × 2.0 = ₡${Math.round(robot2BaseRepair * (robot2DamageTakenPercent/100) * 2.0).toLocaleString()}`);
    console.log(`    Actual: ₡${robot2Cost.toLocaleString()}`);
    console.log(`    Difference: ₡${(robot2Cost - Math.round(robot2BaseRepair * (robot2DamageTakenPercent/100) * 2.0)).toLocaleString()}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

reverseEngineerRepairCost();
