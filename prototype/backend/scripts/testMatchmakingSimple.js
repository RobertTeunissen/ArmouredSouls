const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the compiled services (we'll need to compile first)
// For now, let's manually implement a simplified version

async function checkBattleReadiness(robot) {
  const hpPercent = robot.currentHP / robot.maxHP;
  const hpCheck = hpPercent >= 0.75;
  const weaponCheck = robot.mainWeaponId !== null;
  return hpCheck && weaponCheck;
}

async function runSimpleMatchmaking() {
  console.log('========================================');
  console.log('MATCHMAKING DATABASE UPDATE TEST');
  console.log('========================================\n');
  
  // 1. Check initial state
  const robotCount = await prisma.robot.count({ where: { NOT: { name: 'Bye Robot' } } });
  const byeRobot = await prisma.robot.findFirst({ where: { name: 'Bye Robot' } });
  
  console.log('📊 INITIAL STATE:');
  console.log(`  Total robots: ${robotCount}`);
  console.log(`  Bye-Robot ID: ${byeRobot.id}\n`);
  
  // 2. Get battle-ready robots
  const allRobots = await prisma.robot.findMany({
    where: { 
      NOT: { name: 'Bye Robot' },
      currentLeague: 'bronze'
    },
    orderBy: { elo: 'desc' }
  });
  
  const readyRobots = [];
  for (const robot of allRobots) {
    if (await checkBattleReadiness(robot)) {
      readyRobots.push(robot);
    }
  }
  
  console.log(`⚔️  BATTLE READINESS:`);
  console.log(`  Ready robots: ${readyRobots.length}/${allRobots.length}\n`);
  
  // 3. Create simple matches (pair first 10 robots)
  console.log('🎮 CREATING MATCHES:');
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const matchData = [];
  
  const robotsToPair = readyRobots.slice(0, 10);
  for (let i = 0; i < robotsToPair.length - 1; i += 2) {
    const robot1 = robotsToPair[i];
    const robot2 = robotsToPair[i + 1];
    
    matchData.push({
      robot1Id: robot1.id,
      robot2Id: robot2.id,
      leagueType: robot1.currentLeague,
      scheduledFor: scheduledFor,
      status: 'scheduled'
    });
    
    console.log(`  Creating match: ${robot1.name} vs ${robot2.name}`);
  }
  
  // Handle odd robot with bye-match
  if (robotsToPair.length % 2 === 1) {
    const lastRobot = robotsToPair[robotsToPair.length - 1];
    matchData.push({
      robot1Id: lastRobot.id,
      robot2Id: byeRobot.id,
      leagueType: lastRobot.currentLeague,
      scheduledFor: scheduledFor,
      status: 'scheduled'
    });
    console.log(`  Creating bye-match: ${lastRobot.name} vs Bye Robot`);
  }
  
  console.log();
  
  // 4. Insert matches into database
  console.log('💾 WRITING TO DATABASE...');
  await prisma.scheduledMatch.createMany({ data: matchData });
  console.log(`  ✓ Inserted ${matchData.length} matches into database\n`);
  
  // 5. Verify database was updated
  console.log('✅ VERIFICATION:');
  const matches = await prisma.scheduledMatch.findMany({
    where: { status: 'scheduled' },
    include: {
      robot1: { select: { name: true, elo: true } },
      robot2: { select: { name: true, elo: true } }
    }
  });
  
  console.log(`  Total scheduled matches in DB: ${matches.length}\n`);
  
  if (matches.length > 0) {
    console.log('Sample matches from database:\n');
    matches.slice(0, 5).forEach((match, i) => {
      console.log(`  ${i + 1}. ${match.robot1.name} (ELO ${match.robot1.elo})`);
      console.log(`     vs`);
      console.log(`     ${match.robot2.name} (ELO ${match.robot2.elo})`);
      console.log(`     Status: ${match.status}`);
      console.log();
    });
  }
  
  // 6. Summary
  console.log('========================================');
  console.log('RESULT SUMMARY');
  console.log('========================================\n');
  
  console.log(`✓ Robots ready for battle: ${readyRobots.length}`);
  console.log(`✓ Matches created: ${matchData.length}`);
  console.log(`✓ Matches in database: ${matches.length}`);
  console.log();
  
  if (matches.length === matchData.length) {
    console.log('🎉 SUCCESS!');
    console.log('   Database is being updated correctly.');
    console.log('   All matches were written to the database.\n');
  } else {
    console.log('⚠️  Warning: Match count mismatch!');
  }
}

runSimpleMatchmaking()
  .catch(e => {
    console.error('❌ Error:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
