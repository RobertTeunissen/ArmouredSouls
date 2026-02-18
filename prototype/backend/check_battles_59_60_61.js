const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBattles() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BATTLES 59, 60, 61 - COMPLETE BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get battles 59, 60, 61
    const battles = await prisma.battle.findMany({
      where: {
        id: { in: [59, 60, 61] }
      },
      include: {
        robot1: { select: { name: true, userId: true, maxHP: true } },
        robot2: { select: { name: true, userId: true, maxHP: true } }
      },
      orderBy: { id: 'asc' }
    });

    console.log(`Found ${battles.length} battles\n`);

    let totalRepairCosts = 0;
    const repairsByRobot = {};

    battles.forEach((battle, index) => {
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`  BATTLE #${battle.id}`);
      console.log(`═══════════════════════════════════════════════════════════\n`);

      console.log(`Battle Type: ${battle.battleType} (${battle.leagueType || 'N/A'})`);
      console.log(`Robot1: ${battle.robot1.name} (User ${battle.robot1.userId})`);
      console.log(`Robot2: ${battle.robot2.name} (User ${battle.robot2.userId})`);
      console.log(`Winner: Robot ${battle.winnerId}\n`);

      // Robot 1 details
      const robot1MaxHP = battle.robot1.maxHP || 100;
      const robot1FinalHP = battle.robot1FinalHP || 0;
      const robot1Damage = robot1MaxHP - robot1FinalHP;
      const robot1RepairCost = battle.robot1RepairCost || 0;

      console.log(`${battle.robot1.name}:`);
      console.log(`  Max HP: ${robot1MaxHP}`);
      console.log(`  Final HP: ${robot1FinalHP}`);
      console.log(`  Damage Taken: ${robot1Damage} HP`);
      console.log(`  Repair Cost: ₡${robot1RepairCost.toLocaleString()}`);
      console.log(`  Base Formula: ${robot1Damage} × 50 = ₡${robot1Damage * 50}`);
      
      // Calculate multiplier
      let robot1Multiplier = 1.0;
      if (robot1FinalHP === 0) {
        robot1Multiplier = 2.0;
        console.log(`  Multiplier: 2.0x (destroyed)`);
      } else if (robot1FinalHP < robot1MaxHP * 0.1) {
        robot1Multiplier = 1.5;
        console.log(`  Multiplier: 1.5x (critical damage, HP < 10%)`);
      } else {
        console.log(`  Multiplier: 1.0x (normal damage)`);
      }
      
      const robot1Expected = robot1Damage * 50 * robot1Multiplier;
      console.log(`  Expected with multiplier: ₡${Math.round(robot1Expected)}`);
      console.log(`  Actual charged: ₡${robot1RepairCost}`);
      
      if (Math.abs(robot1Expected - robot1RepairCost) > 1) {
        console.log(`  ⚠️  DISCREPANCY: ₡${Math.round(robot1RepairCost - robot1Expected)}`);
      }
      console.log();

      // Robot 2 details
      const robot2MaxHP = battle.robot2.maxHP || 100;
      const robot2FinalHP = battle.robot2FinalHP || 0;
      const robot2Damage = robot2MaxHP - robot2FinalHP;
      const robot2RepairCost = battle.robot2RepairCost || 0;

      console.log(`${battle.robot2.name}:`);
      console.log(`  Max HP: ${robot2MaxHP}`);
      console.log(`  Final HP: ${robot2FinalHP}`);
      console.log(`  Damage Taken: ${robot2Damage} HP`);
      console.log(`  Repair Cost: ₡${robot2RepairCost.toLocaleString()}`);
      console.log(`  Base Formula: ${robot2Damage} × 50 = ₡${robot2Damage * 50}`);
      
      // Calculate multiplier
      let robot2Multiplier = 1.0;
      if (robot2FinalHP === 0) {
        robot2Multiplier = 2.0;
        console.log(`  Multiplier: 2.0x (destroyed)`);
      } else if (robot2FinalHP < robot2MaxHP * 0.1) {
        robot2Multiplier = 1.5;
        console.log(`  Multiplier: 1.5x (critical damage, HP < 10%)`);
      } else {
        console.log(`  Multiplier: 1.0x (normal damage)`);
      }
      
      const robot2Expected = robot2Damage * 50 * robot2Multiplier;
      console.log(`  Expected with multiplier: ₡${Math.round(robot2Expected)}`);
      console.log(`  Actual charged: ₡${robot2RepairCost}`);
      
      if (Math.abs(robot2Expected - robot2RepairCost) > 1) {
        console.log(`  ⚠️  DISCREPANCY: ₡${Math.round(robot2RepairCost - robot2Expected)}`);
      }
      console.log();

      // Track player1's robots (userId = 2)
      if (battle.robot1.userId === 2) {
        if (!repairsByRobot[battle.robot1.name]) {
          repairsByRobot[battle.robot1.name] = { battles: 0, totalRepairs: 0, totalDamage: 0 };
        }
        repairsByRobot[battle.robot1.name].battles++;
        repairsByRobot[battle.robot1.name].totalRepairs += robot1RepairCost;
        repairsByRobot[battle.robot1.name].totalDamage += robot1Damage;
        totalRepairCosts += robot1RepairCost;
      }

      if (battle.robot2.userId === 2) {
        if (!repairsByRobot[battle.robot2.name]) {
          repairsByRobot[battle.robot2.name] = { battles: 0, totalRepairs: 0, totalDamage: 0 };
        }
        repairsByRobot[battle.robot2.name].battles++;
        repairsByRobot[battle.robot2.name].totalRepairs += robot2RepairCost;
        repairsByRobot[battle.robot2.name].totalDamage += robot2Damage;
        totalRepairCosts += robot2RepairCost;
      }

      console.log(`Battle Total: ₡${(robot1RepairCost + robot2RepairCost).toLocaleString()}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  PLAYER1 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    Object.entries(repairsByRobot).forEach(([robotName, stats]) => {
      console.log(`${robotName}:`);
      console.log(`  Battles: ${stats.battles}`);
      console.log(`  Total Damage: ${stats.totalDamage} HP`);
      console.log(`  Total Repairs: ₡${stats.totalRepairs.toLocaleString()}`);
      console.log(`  Avg per Battle: ₡${Math.round(stats.totalRepairs / stats.battles).toLocaleString()}`);
      console.log();
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`TOTAL REPAIR COSTS FOR PLAYER1: ₡${totalRepairCosts.toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check if repair bay discount should have been applied
    const player1 = await prisma.user.findUnique({
      where: { id: 2 }
    });

    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: 2,
        facilityType: 'repair_bay'
      }
    });

    if (repairBay && repairBay.level > 0) {
      const robotCount = Object.keys(repairsByRobot).length;
      const discount = Math.min(repairBay.level * (5 + robotCount), 90);
      
      console.log(`\n⚠️  REPAIR BAY DISCOUNT ANALYSIS:`);
      console.log(`   Repair Bay Level: ${repairBay.level}`);
      console.log(`   Active Robots: ${robotCount}`);
      console.log(`   Calculated Discount: ${discount}%`);
      console.log(`   Formula: ${repairBay.level} × (5 + ${robotCount}) = ${discount}%\n`);
      
      const expectedWithDiscount = Math.round(totalRepairCosts * (1 - discount / 100));
      console.log(`   If discount was applied:`);
      console.log(`   ₡${totalRepairCosts.toLocaleString()} × (1 - ${discount}%) = ₡${expectedWithDiscount.toLocaleString()}`);
      console.log(`   Savings: ₡${(totalRepairCosts - expectedWithDiscount).toLocaleString()}\n`);
      
      console.log(`   ⚠️  The actual costs suggest NO discount was applied during battles.`);
      console.log(`   This is expected - repair bay discounts are applied when repairing,`);
      console.log(`   not automatically during battle execution.\n`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBattles();
