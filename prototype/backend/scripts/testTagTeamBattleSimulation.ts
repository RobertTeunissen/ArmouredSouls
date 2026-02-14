import prisma from '../src/lib/prisma';
import { executeScheduledTagTeamBattles } from '../src/services/tagTeamBattleOrchestrator';

async function testTagTeamBattle() {
  console.log('Testing tag team battle execution with fixed winner logic...\n');

  // Find a scheduled tag team match or create one for testing
  const scheduledMatch = await prisma.tagTeamMatch.findFirst({
    where: {
      status: 'scheduled',
    },
  });

  if (!scheduledMatch) {
    console.log('No scheduled tag team matches found. Creating a test match...');
    
    // Find two tag teams
    const teams = await prisma.tagTeam.findMany({
      where: {
        activeRobotId: { not: null },
        reserveRobotId: { not: null },
      },
      take: 2,
    });

    if (teams.length < 2) {
      console.log('Not enough tag teams available for testing.');
      await prisma.$disconnect();
      return;
    }

    // Create a test match
    const testMatch = await prisma.tagTeamMatch.create({
      data: {
        team1Id: teams[0].id,
        team2Id: teams[1].id,
        tagTeamLeague: teams[0].tagTeamLeague,
        scheduledFor: new Date(),
        status: 'scheduled',
      },
    });

    console.log(`Created test match ${testMatch.id} between teams ${teams[0].id} and ${teams[1].id}\n`);
  }

  // Execute the battles
  console.log('Executing scheduled tag team battles...\n');
  const result = await executeScheduledTagTeamBattles();

  console.log(`\nExecution complete:`);
  console.log(`  Total battles: ${result.totalBattles}`);
  console.log(`  Skipped (unready): ${result.skippedDueToUnreadyRobots}`);

  // Check the most recent tag team battle
  const recentBattle = await prisma.battle.findFirst({
    where: {
      battleType: 'tag_team',
    },
    include: {
      robot1: { select: { name: true } },
      robot2: { select: { name: true } },
    },
    orderBy: { id: 'desc' },
  });

  if (recentBattle) {
    console.log(`\nMost recent tag team battle (ID ${recentBattle.id}):`);
    console.log(`  ${recentBattle.robot1?.name}: ${recentBattle.robot1FinalHP} HP`);
    console.log(`  ${recentBattle.robot2?.name}: ${recentBattle.robot2FinalHP} HP`);
    console.log(`  Winner: ${recentBattle.winnerId ? `Robot ${recentBattle.winnerId}` : 'DRAW'}`);
    
    // Check if result makes sense
    const robot1Alive = recentBattle.robot1FinalHP > 0;
    const robot2Alive = recentBattle.robot2FinalHP > 0;
    const hasWinner = recentBattle.winnerId !== null;
    
    if (!hasWinner && ((robot1Alive && !robot2Alive) || (!robot1Alive && robot2Alive))) {
      console.log('  ⚠️  INCORRECT DRAW - One robot has HP remaining!');
    } else if (hasWinner && robot1Alive && robot2Alive) {
      console.log('  ⚠️  INCORRECT WINNER - Both robots still have HP!');
    } else {
      console.log('  ✓ Result looks correct');
    }
  }

  await prisma.$disconnect();
}

testTagTeamBattle().catch(console.error);
