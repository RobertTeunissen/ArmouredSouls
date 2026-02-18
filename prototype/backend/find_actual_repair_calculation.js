const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findActualRepairCalculation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  FINDING THE ACTUAL REPAIR CALCULATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // The RepairService logged: ₡25,779 with 14% discount
    const actualPaid = 25779;
    const discount = 0.14;
    const preDiscountAmount = actualPaid / (1 - discount);
    
    console.log('Known facts:');
    console.log(`  Amount actually paid: ₡${actualPaid.toLocaleString()}`);
    console.log(`  Discount: 14%`);
    console.log(`  Pre-discount amount: ₡${Math.round(preDiscountAmount).toLocaleString()}\n`);

    // Get the robots
    const robots = await prisma.robot.findMany({
      where: { userId: 2 },
      select: { 
        id: true, 
        name: true,
        maxHP: true,
        combatPower: true,
        targetingSystems: true,
        criticalSystems: true,
        penetration: true,
        weaponControl: true,
        attackSpeed: true,
        armorPlating: true,
        shieldCapacity: true,
        evasionThrusters: true,
        damageDampeners: true,
        counterProtocols: true,
        shieldRegeneration: true,
        hullIntegrity: true,
        servoMotors: true,
        gyroStabilizers: true,
        hydraulicSystems: true,
        powerCore: true,
        coolingSystem: true,
        sensorArray: true,
        targetingComputer: true,
        aiCore: true,
        tacticalProcessor: true,
        teamCoordination: true
      }
    });

    console.log('Player1\'s robots:');
    robots.forEach(r => {
      const sum = 
        (Number(r.combatPower) || 0) + (Number(r.targetingSystems) || 0) + (Number(r.criticalSystems) || 0) +
        (Number(r.penetration) || 0) + (Number(r.weaponControl) || 0) + (Number(r.attackSpeed) || 0) +
        (Number(r.armorPlating) || 0) + (Number(r.shieldCapacity) || 0) + (Number(r.evasionThrusters) || 0) +
        (Number(r.damageDampeners) || 0) + (Number(r.counterProtocols) || 0) + (Number(r.shieldRegeneration) || 0) +
        (Number(r.hullIntegrity) || 0) + (Number(r.servoMotors) || 0) + (Number(r.gyroStabilizers) || 0) +
        (Number(r.hydraulicSystems) || 0) + (Number(r.powerCore) || 0) + (Number(r.coolingSystem) || 0) +
        (Number(r.sensorArray) || 0) + (Number(r.targetingComputer) || 0) + (Number(r.aiCore) || 0) +
        (Number(r.tacticalProcessor) || 0) + (Number(r.teamCoordination) || 0);
      
      console.log(`  ${r.name} (ID ${r.id}): Sum of attributes = ${sum}, MaxHP = ${r.maxHP}`);
    });
    console.log();

    // Get battle 59 to see the damage
    const battle59 = await prisma.battle.findUnique({
      where: { id: 59 }
    });

    console.log('Battle #59 (the main battle):');
    console.log(`  Morning Ride (118): FinalHP = ${battle59.robot1FinalHP}, Repair Cost = ₡${battle59.robot1RepairCost.toLocaleString()}`);
    console.log(`  Afternoon Ride (117): FinalHP = ${battle59.robot2FinalHP}, Repair Cost = ₡${battle59.robot2RepairCost.toLocaleString()}`);
    console.log();

    // Now let's try different scenarios to match ₡29,976 pre-discount
    const targetPreDiscount = Math.round(preDiscountAmount);
    console.log(`Target pre-discount amount: ₡${targetPreDiscount.toLocaleString()}\n`);

    // Scenario 1: Both robots with battle damage
    console.log('SCENARIO 1: Using battle-end HP');
    const morningRideBattleHP = 5;
    const afternoonRideBattleHP = 0;
    const maxHP = 80;
    
    const morningDamage = maxHP - morningRideBattleHP;
    const afternoonDamage = maxHP - afternoonRideBattleHP;
    
    const morningDamagePercent = (morningDamage / maxHP) * 100;
    const afternoonDamagePercent = (afternoonDamage / maxHP) * 100;
    
    const morningMultiplier = morningRideBattleHP < maxHP * 0.1 ? 1.5 : 1.0;
    const afternoonMultiplier = afternoonRideBattleHP === 0 ? 2.0 : 1.0;
    
    const baseRepair = 81 * 100;
    const morningCost = Math.round(baseRepair * (morningDamagePercent / 100) * morningMultiplier);
    const afternoonCost = Math.round(baseRepair * (afternoonDamagePercent / 100) * afternoonMultiplier);
    const totalScenario1 = morningCost + afternoonCost;
    
    console.log(`  Morning Ride: ${morningDamage}HP damage, ${morningMultiplier}x = ₡${morningCost.toLocaleString()}`);
    console.log(`  Afternoon Ride: ${afternoonDamage}HP damage, ${afternoonMultiplier}x = ₡${afternoonCost.toLocaleString()}`);
    console.log(`  Total: ₡${totalScenario1.toLocaleString()}`);
    console.log(`  Match? ${totalScenario1 === targetPreDiscount ? '✅ YES' : `❌ NO (off by ₡${Math.abs(totalScenario1 - targetPreDiscount).toLocaleString()})`}\n`);

    // Scenario 2: Try different damage amounts
    console.log('SCENARIO 2: Working backwards from ₡29,976');
    console.log(`  We need: ₡${targetPreDiscount.toLocaleString()} pre-discount`);
    console.log(`  Base repair per robot: ₡8,100`);
    console.log();
    
    // Try to find what damage would give us 29,976
    // Let's assume both robots were damaged
    // Morning Ride: 1.5x multiplier (critical)
    // Afternoon Ride: 2.0x multiplier (destroyed)
    
    // Let x = morning damage %, y = afternoon damage %
    // 8100 * x * 1.5 + 8100 * y * 2.0 = 29976
    // 12150x + 16200y = 29976
    
    // If afternoon is 100% (destroyed): 16200 * 1.0 = 16200
    // Then morning: 29976 - 16200 = 13776
    // 13776 / 12150 = 1.134 (113.4% - impossible)
    
    // Let's try afternoon at less than 100%
    for (let afternoonHP = 0; afternoonHP <= 10; afternoonHP++) {
      const afternoonDmg = maxHP - afternoonHP;
      const afternoonDmgPct = afternoonDmg / maxHP;
      const afternoonMult = afternoonHP === 0 ? 2.0 : (afternoonHP < maxHP * 0.1 ? 1.5 : 1.0);
      const afternoonRepair = baseRepair * afternoonDmgPct * afternoonMult;
      
      const remainingForMorning = targetPreDiscount - afternoonRepair;
      
      // Try to find morning damage that matches
      for (let morningHP = 0; morningHP <= 10; morningHP++) {
        const morningDmg = maxHP - morningHP;
        const morningDmgPct = morningDmg / maxHP;
        const morningMult = morningHP === 0 ? 2.0 : (morningHP < maxHP * 0.1 ? 1.5 : 1.0);
        const morningRepair = baseRepair * morningDmgPct * morningMult;
        
        const total = Math.round(morningRepair + afternoonRepair);
        
        if (Math.abs(total - targetPreDiscount) <= 5) {
          console.log(`  Found match!`);
          console.log(`    Morning Ride: ${morningHP}HP remaining (${morningDmg}HP damage, ${morningMult}x) = ₡${Math.round(morningRepair).toLocaleString()}`);
          console.log(`    Afternoon Ride: ${afternoonHP}HP remaining (${afternoonDmg}HP damage, ${afternoonMult}x) = ₡${Math.round(afternoonRepair).toLocaleString()}`);
          console.log(`    Total: ₡${total.toLocaleString()}`);
          console.log(`    Difference from target: ₡${Math.abs(total - targetPreDiscount)}`);
          console.log();
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findActualRepairCalculation();
