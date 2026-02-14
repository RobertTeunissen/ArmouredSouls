import prisma from '../src/lib/prisma';

async function testTagTeamWinnerLogic() {
  console.log('Testing tag team winner determination logic...\n');

  // Find some tag team battles
  const tagTeamBattles = await prisma.battle.findMany({
    where: {
      battleType: 'tag_team',
    },
    include: {
      robot1: { select: { name: true } },
      robot2: { select: { name: true } },
    },
    orderBy: { id: 'desc' },
    take: 10,
  });

  console.log(`Found ${tagTeamBattles.length} tag team battles\n`);

  for (const battle of tagTeamBattles) {
    const hasWinner = battle.winnerId !== null;
    const robot1Alive = battle.robot1FinalHP > 0;
    const robot2Alive = battle.robot2FinalHP > 0;

    // Check for incorrect draws (one robot alive, one dead, but marked as draw)
    const incorrectDraw = !hasWinner && ((robot1Alive && !robot2Alive) || (!robot1Alive && robot2Alive));

    console.log(`Battle ${battle.id}:`);
    console.log(`  ${battle.robot1?.name}: ${battle.robot1FinalHP} HP`);
    console.log(`  ${battle.robot2?.name}: ${battle.robot2FinalHP} HP`);
    console.log(`  Winner: ${hasWinner ? `Robot ${battle.winnerId}` : 'DRAW'}`);
    
    if (incorrectDraw) {
      console.log(`  ⚠️  INCORRECT DRAW - One robot has HP remaining!`);
    }
    
    console.log('');
  }

  await prisma.$disconnect();
}

testTagTeamWinnerLogic().catch(console.error);
