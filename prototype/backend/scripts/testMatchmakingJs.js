const { PrismaClient } = require('@prisma/client');
const { runMatchmaking } = require('../src/services/matchmakingService');
const { getLeagueInstanceStats } = require('../src/services/leagueInstanceService');

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('MATCHMAKING SYSTEM DATABASE TEST');
  console.log('========================================\n');

  // 1. Check initial state
  console.log('📊 INITIAL STATE CHECK');
  console.log('─────────────────────────────────────\n');

  const totalRobots = await prisma.robot.count({
    where: {
      NOT: { name: 'Bye Robot' }
    }
  });
  
  const byeRobot = await prisma.robot.findFirst({
    where: { name: 'Bye Robot' }
  });

  console.log(`✓ Total robots in database: ${totalRobots}`);
  console.log(`✓ Bye-Robot ID: ${byeRobot?.id || 'NOT FOUND'}\n`);

  // Check robots by league
  const robotsByLeague = await prisma.robot.groupBy({
    by: ['currentLeague'],
    where: {
      NOT: { name: 'Bye Robot' }
    },
    _count: { id: true }
  });

  console.log('Robots by league:');
  robotsByLeague.forEach(league => {
    console.log(`  ${league.currentLeague}: ${league._count.id} robots`);
  });
  console.log();

  // 2. Check battle readiness
  console.log('⚔️  BATTLE READINESS CHECK');
  console.log('─────────────────────────────────────\n');

  const allRobots = await prisma.robot.findMany({
    where: { NOT: { name: 'Bye Robot' } },
    take: 5
  });
  
  const totalReady = allRobots.filter(r => 
    (r.currentHP / r.maxHP >= 0.75) && r.mainWeaponId !== null
  ).length;

  console.log(`Battle-ready robots (sample): ${totalReady}/5\n`);

  // 3. Check existing scheduled matches
  console.log('📅 EXISTING SCHEDULED MATCHES');
  console.log('─────────────────────────────────────\n');

  const existingMatches = await prisma.scheduledMatch.findMany({
    where: { status: 'scheduled' }
  });

  console.log(`Existing scheduled matches: ${existingMatches.length}\n`);

  // 4. Run matchmaking
  console.log('🎮 RUNNING MATCHMAKING');
  console.log('─────────────────────────────────────\n');

  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  console.log(`Scheduling matches for: ${scheduledFor.toISOString()}\n`);

  const matchesCreated = await runMatchmaking(scheduledFor);

  console.log(`\n✓ Matchmaking complete: ${matchesCreated} matches created\n`);

  // 5. Verify database updates
  console.log('✅ DATABASE VERIFICATION');
  console.log('─────────────────────────────────────\n');

  const scheduledMatches = await prisma.scheduledMatch.findMany({
    where: { 
      status: 'scheduled'
    },
    include: {
      robot1: {
        select: { name: true, elo: true, currentLeague: true, leagueId: true }
      },
      robot2: {
        select: { name: true, elo: true, currentLeague: true, leagueId: true }
      }
    },
    take: 10
  });

  console.log(`Total scheduled matches in database: ${scheduledMatches.length}\n`);

  if (scheduledMatches.length > 0) {
    console.log('Sample matches (first 10):\n');
    scheduledMatches.slice(0, 10).forEach((match, index) => {
      const isByeMatch = match.robot2.name === 'Bye Robot';
      console.log(`  Match ${index + 1}:`);
      console.log(`    ${match.robot1.name} (ELO: ${match.robot1.elo}, ${match.robot1.leagueId})`);
      console.log(`    vs`);
      console.log(`    ${match.robot2.name} (ELO: ${match.robot2.elo}, ${match.robot2.leagueId})`);
      console.log(`    League: ${match.leagueType}`);
      if (isByeMatch) console.log(`    ⚠️  BYE MATCH`);
      console.log();
    });
  }

  // 6. Check for bye-matches
  const byeMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      OR: [
        { robot1Id: byeRobot?.id || -1 },
        { robot2Id: byeRobot?.id || -1 }
      ]
    }
  });

  console.log(`Bye-matches created: ${byeMatches.length}\n`);

  // 7. Summary
  console.log('========================================');
  console.log('TEST SUMMARY');
  console.log('========================================\n');

  console.log(`✓ Database connection: SUCCESS`);
  console.log(`✓ Total robots: ${totalRobots}`);
  console.log(`✓ Matches created: ${matchesCreated}`);
  console.log(`✓ Scheduled matches in DB: ${scheduledMatches.length}`);
  console.log(`✓ Bye-matches: ${byeMatches.length}`);
  console.log();

  if (matchesCreated > 0) {
    console.log('🎉 SUCCESS: Matchmaking system is working!');
    console.log('   Database is being updated correctly.\n');
  } else {
    console.log('⚠️  WARNING: No matches were created.');
    console.log('   Check robot battle readiness and league distribution.\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error during matchmaking test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
