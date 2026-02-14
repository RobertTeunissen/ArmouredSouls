const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLeagueTypes() {
  try {
    // Check a sample of battles
    const battles = await prisma.battle.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        battleType: true,
        leagueType: true,
        createdAt: true,
        robot1: {
          select: {
            name: true,
            currentLeague: true,
          }
        },
        robot2: {
          select: {
            name: true,
            currentLeague: true,
          }
        }
      }
    });

    console.log('\n=== Recent Battles League Type Analysis ===\n');
    battles.forEach(battle => {
      console.log(`Battle #${battle.id} (${battle.battleType})`);
      console.log(`  leagueType in DB: "${battle.leagueType}"`);
      console.log(`  Robot 1 current league: ${battle.robot1.currentLeague}`);
      console.log(`  Robot 2 current league: ${battle.robot2.currentLeague}`);
      console.log(`  Created: ${battle.createdAt}`);
      console.log('');
    });

    // Check tag team matches
    const tagTeamMatches = await prisma.tagTeamMatch.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tagTeamLeague: true,
        status: true,
        battle: {
          select: {
            id: true,
            leagueType: true,
          }
        }
      }
    });

    console.log('\n=== Tag Team Matches ===\n');
    tagTeamMatches.forEach(match => {
      console.log(`TagTeamMatch #${match.id}`);
      console.log(`  tagTeamLeague: "${match.tagTeamLeague}"`);
      console.log(`  Battle leagueType: "${match.battle?.leagueType || 'N/A'}"`);
      console.log(`  Status: ${match.status}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLeagueTypes();
