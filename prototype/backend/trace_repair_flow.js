const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function traceRepairFlow() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TRACING REPAIR COST FLOW');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    const player1 = await prisma.user.findUnique({
      where: { username: 'player1' }
    });

    console.log(`Player1 Current Credits: ₡${(player1.currency || 0).toLocaleString()}\n`);

    // 1. Check battle repair costs
    const battles = await prisma.battle.findMany({
      where: {
        id: { in: [59, 60, 61] }
      },
      orderBy: { id: 'asc' }
    });

    let battleRepairTotal = 0;
    console.log('1. BATTLE TABLE REPAIR COSTS:');
    battles.forEach(b => {
      const robot1Cost = b.robot1RepairCost || 0;
      const robot2Cost = b.robot2RepairCost || 0;
      console.log(`   Battle ${b.id}: Robot1=₡${robot1Cost.toLocaleString()}, Robot2=₡${robot2Cost.toLocaleString()}`);
      
      // Check which robots belong to player1
      if (b.robot1Id === 117 || b.robot1Id === 118) {
        battleRepairTotal += robot1Cost;
      }
      if (b.robot2Id === 117 || b.robot2Id === 118) {
        battleRepairTotal += robot2Cost;
      }
    });
    console.log(`   Total for player1: ₡${battleRepairTotal.toLocaleString()}\n`);

    // 2. Check audit log for robot_repair events
    console.log('2. AUDIT LOG REPAIR EVENTS:');
    const repairEvents = await prisma.auditLog.findMany({
      where: {
        userId: 2,
        eventType: 'robot_repair',
        cycleNumber: 2
      },
      orderBy: { id: 'asc' }
    });

    let auditRepairTotal = 0;
    repairEvents.forEach(e => {
      const cost = e.payload.cost || 0;
      const robotId = e.payload.robotId;
      const robotName = e.payload.robotName || `Robot ${robotId}`;
      console.log(`   ${robotName}: ₡${cost.toLocaleString()}`);
      auditRepairTotal += cost;
    });
    console.log(`   Total: ₡${auditRepairTotal.toLocaleString()}\n`);

    // 3. Check credit_change events
    console.log('3. CREDIT CHANGE EVENTS (repairs):');
    const creditChanges = await prisma.auditLog.findMany({
      where: {
        userId: 2,
        eventType: 'credit_change',
        cycleNumber: 2
      },
      orderBy: { id: 'asc' }
    });

    let repairDeductions = 0;
    creditChanges.forEach(e => {
      const amount = e.payload.amount || 0;
      const source = e.payload.source || '';
      if (source.includes('repair') || source.includes('Repair')) {
        console.log(`   ${source}: ₡${amount.toLocaleString()}`);
        repairDeductions += Math.abs(amount);
      }
    });
    console.log(`   Total repair deductions: ₡${repairDeductions.toLocaleString()}\n`);

    // 4. Check cycle snapshot
    console.log('4. CYCLE SNAPSHOT:');
    const snapshot = await prisma.cycleSnapshot.findUnique({
      where: { cycleNumber: 2 }
    });

    if (snapshot && Array.isArray(snapshot.stableMetrics)) {
      const playerMetrics = snapshot.stableMetrics.find(m => m.userId === 2);
      if (playerMetrics) {
        console.log(`   Total Repair Costs: ₡${playerMetrics.totalRepairCosts?.toLocaleString() || 0}`);
        console.log(`   Total Credits Earned: ₡${playerMetrics.totalCreditsEarned?.toLocaleString() || 0}`);
        console.log(`   Operating Costs: ₡${playerMetrics.operatingCosts?.toLocaleString() || 0}`);
        console.log(`   Net Profit: ₡${playerMetrics.netProfit?.toLocaleString() || 0}\n`);
      }
    }

    // 5. Calculate actual credits flow
    console.log('5. ACTUAL CREDITS FLOW:');
    console.log(`   Starting credits (Cycle 1 end): ₡16,000 (assumed)`);
    console.log(`   + Credits earned (Cycle 2): ₡19,266`);
    console.log(`   - Operating costs: ₡2,000`);
    console.log(`   - Repair costs: ₡??? (to be determined)`);
    console.log(`   = Ending credits: ₡${(player1.currency || 0).toLocaleString()}\n`);
    
    const startingCredits = 16000;
    const creditsEarned = 19266;
    const operatingCosts = 2000;
    const endingCredits = player1.currency || 0;
    
    const actualRepairCosts = startingCredits + creditsEarned - operatingCosts - endingCredits;
    console.log(`   Calculated repair costs: ${startingCredits} + ${creditsEarned} - ${operatingCosts} - ${endingCredits} = ₡${actualRepairCosts.toLocaleString()}\n`);

    // 6. Check robot repair costs stored on robots
    console.log('6. ROBOT TABLE REPAIR COSTS:');
    const robots = await prisma.robot.findMany({
      where: {
        userId: 2
      },
      select: {
        id: true,
        name: true,
        repairCost: true,
        currentHP: true,
        maxHP: true
      }
    });

    robots.forEach(r => {
      console.log(`   ${r.name} (ID ${r.id}): repairCost=₡${r.repairCost?.toLocaleString() || 0}, HP=${r.currentHP}/${r.maxHP}`);
    });
    console.log();

    // 7. Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Battle table total:        ₡${battleRepairTotal.toLocaleString()}`);
    console.log(`Audit log repairs:         ₡${auditRepairTotal.toLocaleString()}`);
    console.log(`Credit deductions:         ₡${repairDeductions.toLocaleString()}`);
    console.log(`Cycle snapshot:            ₡30,988`);
    console.log(`Actual from credits flow:  ₡${actualRepairCosts.toLocaleString()}`);
    console.log();
    
    console.log('CONCLUSION:');
    if (actualRepairCosts === auditRepairTotal) {
      console.log(`✅ The actual repair costs (₡${actualRepairCosts.toLocaleString()}) match the audit log.`);
      console.log(`   This is the amount WITH the 14% Repair Bay discount applied.`);
    }
    
    if (battleRepairTotal === 30988) {
      console.log(`✅ The battle table stores pre-discount costs (₡${battleRepairTotal.toLocaleString()}).`);
    }
    
    const expectedWithDiscount = Math.round(battleRepairTotal * 0.86);
    console.log(`\nExpected with 14% discount: ₡${battleRepairTotal.toLocaleString()} × 0.86 = ₡${expectedWithDiscount.toLocaleString()}`);
    console.log(`Actual deducted: ₡${actualRepairCosts.toLocaleString()}`);
    console.log(`Difference: ₡${Math.abs(actualRepairCosts - expectedWithDiscount).toLocaleString()}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

traceRepairFlow();
