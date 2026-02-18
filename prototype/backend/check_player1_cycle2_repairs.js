const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPlayer1Cycle2Repairs() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  PLAYER1 CYCLE 2 REPAIR COSTS BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Get player1 user
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' }
    });

    if (!player1) {
      console.log('❌ player1 not found');
      return;
    }

    console.log(`User: ${player1.username} (ID: ${player1.id})`);
    console.log(`Current Credits: ₡${(player1.credits || 0).toLocaleString()}\n`);

    // Get player1's robots
    const robots = await prisma.robot.findMany({
      where: { userId: player1.id },
      select: { id: true, name: true }
    });

    console.log(`Player1's Robots: ${robots.map(r => r.name).join(', ')}\n`);

    const robotIds = robots.map(r => r.id);
    const robotIdSet = new Set(robotIds);

    // Get battle events from audit log for cycle 2
    const battleEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 2,
        eventType: 'battle_complete',
      },
      orderBy: { id: 'asc' }
    });

    // Also check cycle 1 since data might be there
    const cycle1BattleEvents = await prisma.auditLog.findMany({
      where: {
        cycleNumber: 1,
        eventType: 'battle_complete',
      },
      orderBy: { id: 'asc' }
    });

    // Filter to only battles involving player1's robots
    const playerBattlesCycle2 = battleEvents.filter(e => {
      const p = e.payload;
      return robotIdSet.has(p.robot1Id) || robotIdSet.has(p.robot2Id);
    });

    const playerBattlesCycle1 = cycle1BattleEvents.filter(e => {
      const p = e.payload;
      return robotIdSet.has(p.robot1Id) || robotIdSet.has(p.robot2Id);
    });

    console.log(`Battles in Cycle 1 involving player1's robots: ${playerBattlesCycle1.length}`);
    console.log(`Battles in Cycle 2 involving player1's robots: ${playerBattlesCycle2.length}\n`);

    // Check cycle 2 snapshot
    const cycle2Snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 2 }
    });

    if (cycle2Snapshot && Array.isArray(cycle2Snapshot.stableMetrics)) {
      const playerMetrics = cycle2Snapshot.stableMetrics.find(m => m.userId === player1.id);
      if (playerMetrics) {
        console.log('Cycle 2 Snapshot Data for player1:');
        console.log(`  Battles: ${playerMetrics.battlesParticipated}`);
        console.log(`  Repair costs: ₡${playerMetrics.totalRepairCosts?.toLocaleString() || 0}`);
        console.log(`  Credits earned: ₡${playerMetrics.totalCreditsEarned?.toLocaleString() || 0}\n`);
      }
    }

    // Use whichever cycle has the data
    const playerBattles = playerBattlesCycle2.length > 0 ? playerBattlesCycle2 : playerBattlesCycle1;
    const cycleUsed = playerBattlesCycle2.length > 0 ? 2 : 1;

    console.log(`Using Cycle ${cycleUsed} data (${playerBattles.length} battles)\n`);

    console.log(`Total battles involving player1's robots: ${playerBattles.length}\n`);

    if (playerBattles.length === 0) {
      console.log('No battles found for player1 in Cycle 2');
      return;
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  BATTLE-BY-BATTLE BREAKDOWN');
    console.log('═══════════════════════════════════════════════════════════\n');

    let totalRepairCosts = 0;
    const repairsByRobot = {};

    // Create robot name lookup
    const robotNames = {};
    robots.forEach(r => {
      robotNames[r.id] = r.name;
    });

    playerBattles.forEach((event, index) => {
      const p = event.payload;
      const isRobot1 = robotIdSet.has(p.robot1Id);
      const isRobot2 = robotIdSet.has(p.robot2Id);

      console.log(`Battle #${index + 1} (Battle ID: ${p.battleId || 'N/A'})`);
      console.log(`  Robot1 ID: ${p.robot1Id} vs Robot2 ID: ${p.robot2Id}`);
      console.log(`  Winner: Robot ${p.winnerId}`);
      console.log(`  Battle Type: ${p.battleType || 'N/A'} (${p.leagueType || 'N/A'})`);
      
      if (isRobot1) {
        const robotName = robotNames[p.robot1Id] || `Robot ${p.robot1Id}`;
        const repairCost = p.robot1RepairCost || 0;
        const finalHP = p.robot1FinalHP || 0;
        const maxHP = p.robot1MaxHP || 100;
        const damage = maxHP - finalHP;
        
        if (!repairsByRobot[robotName]) {
          repairsByRobot[robotName] = { battles: 0, totalRepairs: 0, totalDamage: 0 };
        }
        repairsByRobot[robotName].battles++;
        repairsByRobot[robotName].totalRepairs += repairCost;
        repairsByRobot[robotName].totalDamage += damage;
        totalRepairCosts += repairCost;

        console.log(`  → ${robotName} (player1's robot):`);
        console.log(`     Repair Cost: ₡${repairCost.toLocaleString()}`);
        console.log(`     Final HP: ${finalHP}/${maxHP}`);
        console.log(`     Damage Taken: ${damage} HP`);
        console.log(`     Formula: ${damage} damage × 50 = ₡${repairCost}`);
      }
      
      if (isRobot2) {
        const robotName = robotNames[p.robot2Id] || `Robot ${p.robot2Id}`;
        const repairCost = p.robot2RepairCost || 0;
        const finalHP = p.robot2FinalHP || 0;
        const maxHP = p.robot2MaxHP || 100;
        const damage = maxHP - finalHP;
        
        if (!repairsByRobot[robotName]) {
          repairsByRobot[robotName] = { battles: 0, totalRepairs: 0, totalDamage: 0 };
        }
        repairsByRobot[robotName].battles++;
        repairsByRobot[robotName].totalRepairs += repairCost;
        repairsByRobot[robotName].totalDamage += damage;
        totalRepairCosts += repairCost;

        console.log(`  → ${robotName} (player1's robot):`);
        console.log(`     Repair Cost: ₡${repairCost.toLocaleString()}`);
        console.log(`     Final HP: ${finalHP}/${maxHP}`);
        console.log(`     Damage Taken: ${damage} HP`);
        console.log(`     Formula: ${damage} damage × 50 = ₡${repairCost}`);
      }
      
      console.log();
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY BY ROBOT');
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
    console.log('  TOTAL REPAIR COSTS');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total Repair Costs in Cycle 2: ₡${totalRepairCosts.toLocaleString()}`);
    console.log(`\nFormula: Damage Taken × 50 = Repair Cost`);
    console.log(`(See executeBattles.js line 84-85 for implementation)\n`);

    // Check if there's a repair bay discount
    const repairBay = await prisma.facility.findFirst({
      where: {
        userId: player1.id,
        facilityType: 'repair_bay'
      }
    });

    if (repairBay && repairBay.level > 0) {
      console.log(`\n⚠️  NOTE: Player1 has Repair Bay Level ${repairBay.level}`);
      console.log(`   Repair Bay provides discount on repairs, but this may not be`);
      console.log(`   applied retroactively to Cycle 2 battles.`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPlayer1Cycle2Repairs();
