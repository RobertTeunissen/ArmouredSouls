const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showSummary() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          ARMOURED SOULS - DATABASE STATE SUMMARY              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Get counts
  const stats = {
    users: await prisma.user.count(),
    robots: await prisma.robot.count(),
    weapons: await prisma.weapon.count(),
    scheduledMatches: await prisma.scheduledMatch.count(),
    battles: await prisma.battle.count(),
    facilities: await prisma.facility.count()
  };
  
  console.log('📊 DATABASE STATISTICS:');
  console.log('─'.repeat(63));
  console.log(`  Users:             ${stats.users.toString().padStart(4)} total`);
  console.log(`  Robots:            ${stats.robots.toString().padStart(4)} total (including Bye-Robot)`);
  console.log(`  Weapons:           ${stats.weapons.toString().padStart(4)} available`);
  console.log(`  Scheduled Matches: ${stats.scheduledMatches.toString().padStart(4)} pending`);
  console.log(`  Completed Battles: ${stats.battles.toString().padStart(4)} historical`);
  console.log(`  Facilities:        ${stats.facilities.toString().padStart(4)} purchased`);
  console.log();
  
  // League distribution
  const leagueStats = await prisma.robot.groupBy({
    by: ['currentLeague'],
    _count: { id: true },
    where: { NOT: { name: 'Bye Robot' } }
  });
  
  console.log('🏆 ROBOTS BY LEAGUE:');
  console.log('─'.repeat(63));
  leagueStats.forEach(league => {
    console.log(`  ${league.currentLeague.padEnd(12)}: ${league._count.id.toString().padStart(3)} robots`);
  });
  console.log();
  
  // Recent scheduled matches
  const matches = await prisma.scheduledMatch.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      robot1: { select: { name: true, elo: true } },
      robot2: { select: { name: true, elo: true } }
    }
  });
  
  if (matches.length > 0) {
    console.log('⚔️  RECENT SCHEDULED MATCHES:');
    console.log('─'.repeat(63));
    matches.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.robot1.name} vs ${m.robot2.name}`);
      console.log(`     Status: ${m.status} | League: ${m.leagueType}`);
    });
    console.log();
  }
  
  // Battle-ready robots
  const allRobots = await prisma.robot.findMany({
    where: { NOT: { name: 'Bye Robot' } }
  });
  const readyCount = allRobots.filter(r => 
    (r.currentHP / r.maxHP >= 0.75) && r.mainWeaponId !== null
  ).length;
  
  console.log('✅ SYSTEM STATUS:');
  console.log('─'.repeat(63));
  console.log(`  Battle-ready robots: ${readyCount}/${allRobots.length} (${Math.floor(readyCount/allRobots.length*100)}%)`);
  console.log(`  Matchmaking status:  ${stats.scheduledMatches > 0 ? 'Active' : 'Idle'}`);
  console.log(`  Database health:     ✓ Connected and operational`);
  console.log();
  
  console.log('─'.repeat(63));
  console.log(`Last updated: ${new Date().toISOString()}`);
  console.log('─'.repeat(63));
  console.log();
}

showSummary()
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
