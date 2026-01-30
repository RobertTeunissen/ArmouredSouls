const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('========================================');
    console.log('DATABASE CONNECTION TEST');
    console.log('========================================\n');
    
    // 1. Count robots
    const robotCount = await prisma.robot.count({ 
      where: { NOT: { name: 'Bye Robot' } } 
    });
    const byeRobot = await prisma.robot.findFirst({ where: { name: 'Bye Robot' } });
    
    console.log('📊 DATABASE STATE:');
    console.log(`  Total robots: ${robotCount}`);
    console.log(`  Bye-Robot ID: ${byeRobot ? byeRobot.id : 'NOT FOUND'}\n`);
    
    // 2. Show sample robots
    const robots = await prisma.robot.findMany({ 
      take: 5,
      where: { NOT: { name: 'Bye Robot' } },
      select: { 
        name: true, 
        elo: true, 
        leagueId: true,
        currentHP: true,
        maxHP: true,
        mainWeaponId: true
      } 
    });
    
    console.log('Sample robots:');
    let readyCount = 0;
    robots.forEach(r => {
      const hpPercent = Math.floor((r.currentHP / r.maxHP) * 100);
      const hasWeapon = r.mainWeaponId !== null;
      const isReady = (hpPercent >= 75 && hasWeapon);
      if (isReady) readyCount++;
      console.log(`  ${r.name} (ELO: ${r.elo}, ${r.leagueId})`);
      console.log(`    HP: ${r.currentHP}/${r.maxHP} (${hpPercent}%), Weapon: ${hasWeapon ? 'Yes' : 'No'}, Ready: ${isReady ? '✓' : '✗'}`);
    });
    console.log(`\n  ${readyCount}/${robots.length} sample robots are battle-ready\n`);
    
    // 3. Count scheduled matches BEFORE matchmaking
    const beforeCount = await prisma.scheduledMatch.count();
    console.log('📅 SCHEDULED MATCHES:');
    console.log(`  Existing matches: ${beforeCount}\n`);
    
    console.log('✅ Database connection successful!');
    console.log('   All queries executed correctly.\n');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
