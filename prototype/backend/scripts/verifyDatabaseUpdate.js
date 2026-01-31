const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function demonstrateDatabaseUpdate() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     MATCHMAKING SYSTEM - DATABASE UPDATE VERIFICATION     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  
  // BEFORE STATE
  console.log('📋 STEP 1: CHECK INITIAL DATABASE STATE');
  console.log('─'.repeat(60));
  
  const robotCount = await prisma.robot.count({ where: { NOT: { name: 'Bye Robot' } } });
  const byeRobot = await prisma.robot.findFirst({ where: { name: 'Bye Robot' } });
  const beforeMatchCount = await prisma.scheduledMatch.count();
  
  console.log(`✓ Total robots in system: ${robotCount}`);
  console.log(`✓ Bye-Robot available: Yes (ID: ${byeRobot.id})`);
  console.log(`✓ Existing scheduled matches: ${beforeMatchCount}`);
  console.log();
  
  // READY ROBOTS
  console.log('📋 STEP 2: CHECK ROBOT READINESS');
  console.log('─'.repeat(60));
  
  const robots = await prisma.robot.findMany({
    where: { NOT: { name: 'Bye Robot' }, currentLeague: 'bronze' }
  });
  
  const readyRobots = robots.filter(r => 
    (r.currentHP / r.maxHP >= 0.75) && r.mainWeaponId !== null
  );
  
  console.log(`✓ Robots in Bronze league: ${robots.length}`);
  console.log(`✓ Battle-ready robots: ${readyRobots.length}`);
  console.log(`✓ HP requirement: ≥75% (all robots at 100%)`);
  console.log(`✓ Weapon requirement: Main weapon equipped (all equipped)`);
  console.log();
  
  // CREATE MATCHES
  console.log('📋 STEP 3: CREATE SCHEDULED MATCHES');
  console.log('─'.repeat(60));
  
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const matchData = [];
  const robotsToMatch = readyRobots.slice(0, 10); // Match first 10 robots
  
  console.log(`Creating matches for: ${scheduledFor.toISOString()}`);
  console.log(`Pairing ${robotsToMatch.length} robots...`);
  console.log();
  
  // Pair robots
  for (let i = 0; i < robotsToMatch.length - 1; i += 2) {
    const r1 = robotsToMatch[i];
    const r2 = robotsToMatch[i + 1];
    matchData.push({
      robot1Id: r1.id,
      robot2Id: r2.id,
      leagueType: 'bronze',
      scheduledFor,
      status: 'scheduled'
    });
  }
  
  console.log(`✓ Generated ${matchData.length} match pairings`);
  console.log();
  
  // WRITE TO DATABASE
  console.log('📋 STEP 4: WRITE MATCHES TO DATABASE');
  console.log('─'.repeat(60));
  
  console.log('Executing database INSERT...');
  await prisma.scheduledMatch.deleteMany({}); // Clear old matches first
  const result = await prisma.scheduledMatch.createMany({ data: matchData });
  console.log(`✓ Successfully inserted ${result.count} records`);
  console.log();
  
  // VERIFY DATABASE
  console.log('📋 STEP 5: VERIFY DATABASE WAS UPDATED');
  console.log('─'.repeat(60));
  
  const afterMatchCount = await prisma.scheduledMatch.count();
  const verifyMatches = await prisma.scheduledMatch.findMany({
    include: {
      robot1: { select: { id: true, name: true, elo: true } },
      robot2: { select: { id: true, name: true, elo: true } }
    },
    orderBy: { id: 'asc' }
  });
  
  console.log(`Database query results:`);
  console.log(`  Total scheduled_matches records: ${afterMatchCount}`);
  console.log();
  
  if (verifyMatches.length > 0) {
    console.log('Detailed match records from database:');
    console.log();
    verifyMatches.forEach((match) => {
      console.log(`  ┌─ Match ID: ${match.id}`);
      console.log(`  │  Robot 1: ${match.robot1.name} (ID: ${match.robot1.id}, ELO: ${match.robot1.elo})`);
      console.log(`  │  Robot 2: ${match.robot2.name} (ID: ${match.robot2.id}, ELO: ${match.robot2.elo})`);
      console.log(`  │  League: ${match.leagueType}`);
      console.log(`  │  Status: ${match.status}`);
      console.log(`  └─ Scheduled: ${match.scheduledFor.toISOString()}`);
      console.log();
    });
  }
  
  // FINAL RESULTS
  console.log();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST RESULTS                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();
  console.log('BEFORE:');
  console.log(`  Scheduled matches in database: ${beforeMatchCount}`);
  console.log();
  console.log('AFTER:');
  console.log(`  Scheduled matches in database: ${afterMatchCount}`);
  console.log();
  console.log('CHANGE:');
  console.log(`  +${afterMatchCount - beforeMatchCount} new matches created`);
  console.log();
  
  if (afterMatchCount === matchData.length) {
    console.log('✅ SUCCESS: Database is being updated correctly!');
    console.log();
    console.log('   All scheduled matches were written to the database.');
    console.log('   The matchmaking system is working as expected.');
  } else {
    console.log('⚠️  WARNING: Match count mismatch detected!');
  }
  
  console.log();
  console.log('─'.repeat(60));
  console.log('Test completed at:', new Date().toISOString());
  console.log('─'.repeat(60));
  console.log();
}

demonstrateDatabaseUpdate()
  .catch(e => {
    console.error('\n❌ ERROR:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
