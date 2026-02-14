const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCompletedTagBattles() {
  try {
    // Check tag team battles that are completed
    const tagTeamBattles = await prisma.battle.findMany({
      where: {
        battleType: 'tag_team'
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        battleType: true,
        leagueType: true,
        createdAt: true,
        winnerReward: true,
        loserReward: true,
      }
    });

    console.log('\n=== Completed Tag Team Battles ===\n');
    console.log(`Found ${tagTeamBattles.length} tag team battles\n`);
    
    tagTeamBattles.forEach(battle => {
      console.log(`Battle #${battle.id}`);
      console.log(`  leagueType: "${battle.leagueType}"`);
      console.log(`  Winner reward: ${battle.winnerReward}`);
      console.log(`  Loser reward: ${battle.loserReward}`);
      console.log(`  Created: ${battle.createdAt}`);
      console.log('');
    });

    // Also check regular league battles
    const leagueBattles = await prisma.battle.findMany({
      where: {
        battleType: 'league'
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        battleType: true,
        leagueType: true,
        createdAt: true,
      }
    });

    console.log('\n=== Recent League Battles ===\n');
    console.log(`Found ${leagueBattles.length} league battles\n`);
    
    leagueBattles.forEach(battle => {
      console.log(`Battle #${battle.id}`);
      console.log(`  leagueType: "${battle.leagueType}"`);
      console.log(`  Created: ${battle.createdAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCompletedTagBattles();
