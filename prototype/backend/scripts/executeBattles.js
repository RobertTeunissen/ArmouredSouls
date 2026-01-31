const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simplified battle execution for demonstration
// (Full implementation is in battleOrchestrator.ts and verified via Jest tests)

const ELO_K_FACTOR = 32;
const LEAGUE_POINTS_WIN = 3;
const LEAGUE_POINTS_LOSS = -1;
const BASE_REWARD_WIN = 1000;
const BASE_REWARD_LOSS = 300;

function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculateELOChange(winnerELO, loserELO) {
  const expectedWinner = calculateExpectedScore(winnerELO, loserELO);
  const expectedLoser = calculateExpectedScore(loserELO, winnerELO);
  
  const winnerChange = Math.round(ELO_K_FACTOR * (1 - expectedWinner));
  const loserChange = Math.round(ELO_K_FACTOR * (0 - expectedLoser));
  
  return { winnerChange, loserChange };
}

function simulateBattle(robot1, robot2) {
  // Simple simulation
  const eloDiff = robot1.elo - robot2.elo;
  const robot1WinChance = 0.5 + (eloDiff / 400) * 0.1;
  const robot1Wins = robot1WinChance > Math.random();
  
  const robot1DamageTaken = robot1Wins ? Math.floor(robot1.maxHP * 0.15) : Math.floor(robot1.maxHP * 0.40);
  const robot2DamageTaken = robot1Wins ? Math.floor(robot2.maxHP * 0.40) : Math.floor(robot2.maxHP * 0.15);
  
  return {
    winnerId: robot1Wins ? robot1.id : robot2.id,
    robot1FinalHP: Math.max(0, robot1.currentHP - robot1DamageTaken),
    robot2FinalHP: Math.max(0, robot2.currentHP - robot2DamageTaken),
    robot1Damage: robot1DamageTaken,
    robot2Damage: robot2DamageTaken,
    durationSeconds: 20 + Math.floor(Math.random() * 25)
  };
}

async function executeBattle(scheduledMatch) {
  const robot1 = await prisma.robot.findUnique({ where: { id: scheduledMatch.robot1Id } });
  const robot2 = await prisma.robot.findUnique({ where: { id: scheduledMatch.robot2Id } });
  
  const result = simulateBattle(robot1, robot2);
  const isRobot1Winner = result.winnerId === robot1.id;
  
  // Calculate ELO changes
  const eloChanges = calculateELOChange(
    isRobot1Winner ? robot1.elo : robot2.elo,
    isRobot1Winner ? robot2.elo : robot1.elo
  );
  
  const robot1ELOAfter = isRobot1Winner 
    ? robot1.elo + eloChanges.winnerChange 
    : robot1.elo + eloChanges.loserChange;
  const robot2ELOAfter = isRobot1Winner 
    ? robot2.elo + eloChanges.loserChange 
    : robot2.elo + eloChanges.winnerChange;
  
  // Create battle record
  const battle = await prisma.battle.create({
    data: {
      userId: robot1.userId,
      robot1Id: robot1.id,
      robot2Id: robot2.id,
      winnerId: result.winnerId,
      battleType: 'league',
      leagueType: scheduledMatch.leagueType,
      battleLog: {
        events: [
          { time: 0, action: 'Battle started' },
          { time: result.durationSeconds, action: 'Battle ended' }
        ]
      },
      durationSeconds: result.durationSeconds,
      winnerReward: isRobot1Winner ? BASE_REWARD_WIN : BASE_REWARD_LOSS,
      loserReward: isRobot1Winner ? BASE_REWARD_LOSS : BASE_REWARD_WIN,
      robot1RepairCost: result.robot1Damage * 50,
      robot2RepairCost: result.robot2Damage * 50,
      robot1FinalHP: result.robot1FinalHP,
      robot2FinalHP: result.robot2FinalHP,
      robot1FinalShield: 0,
      robot2FinalShield: 0,
      robot1Yielded: false,
      robot2Yielded: false,
      robot1Destroyed: result.robot1FinalHP === 0,
      robot2Destroyed: result.robot2FinalHP === 0,
      robot1DamageDealt: result.robot2Damage,
      robot2DamageDealt: result.robot1Damage,
      robot1ELOBefore: robot1.elo,
      robot2ELOBefore: robot2.elo,
      robot1ELOAfter,
      robot2ELOAfter,
      eloChange: Math.abs(eloChanges.winnerChange)
    }
  });
  
  // Update robot stats
  await prisma.robot.update({
    where: { id: robot1.id },
    data: {
      currentHP: result.robot1FinalHP,
      elo: robot1ELOAfter,
      leaguePoints: Math.max(0, robot1.leaguePoints + (isRobot1Winner ? LEAGUE_POINTS_WIN : LEAGUE_POINTS_LOSS)),
      totalBattles: robot1.totalBattles + 1,
      wins: isRobot1Winner ? robot1.wins + 1 : robot1.wins,
      losses: !isRobot1Winner ? robot1.losses + 1 : robot1.losses,
      damageDealtLifetime: robot1.damageDealtLifetime + result.robot2Damage,
      damageTakenLifetime: robot1.damageTakenLifetime + result.robot1Damage
    }
  });
  
  await prisma.robot.update({
    where: { id: robot2.id },
    data: {
      currentHP: result.robot2FinalHP,
      elo: robot2ELOAfter,
      leaguePoints: Math.max(0, robot2.leaguePoints + (!isRobot1Winner ? LEAGUE_POINTS_WIN : LEAGUE_POINTS_LOSS)),
      totalBattles: robot2.totalBattles + 1,
      wins: !isRobot1Winner ? robot2.wins + 1 : robot2.wins,
      losses: isRobot1Winner ? robot2.losses + 1 : robot2.losses,
      damageDealtLifetime: robot2.damageDealtLifetime + result.robot1Damage,
      damageTakenLifetime: robot2.damageTakenLifetime + result.robot2Damage
    }
  });
  
  // Update scheduled match
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: {
      status: 'completed',
      battleId: battle.id
    }
  });
  
  return { battle, result, robot1, robot2 };
}

async function demonstrateBattleExecution() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       BATTLE EXECUTION - COMPLETE DEMONSTRATION            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  // Get scheduled matches
  const scheduledMatches = await prisma.scheduledMatch.findMany({
    where: { status: 'scheduled' },
    include: {
      robot1: { select: { name: true, elo: true, currentHP: true, maxHP: true, leaguePoints: true, wins: true, losses: true } },
      robot2: { select: { name: true, elo: true, currentHP: true, maxHP: true, leaguePoints: true, wins: true, losses: true } }
    },
    take: 3 // Execute first 3 matches
  });

  if (scheduledMatches.length === 0) {
    console.log('⚠️  No scheduled matches found.');
    console.log('   Run matchmaking first: node scripts/testMatchmakingSimple.js');
    console.log();
    return;
  }

  console.log(`Found ${scheduledMatches.length} scheduled matches to execute\n`);

  // Execute each match
  for (let i = 0; i < scheduledMatches.length; i++) {
    const match = scheduledMatches[i];
    
    console.log(`════════════════ BATTLE ${i + 1} ════════════════`);
    console.log();
    console.log('BEFORE BATTLE:');
    console.log(`  ${match.robot1.name}:`);
    console.log(`    ELO: ${match.robot1.elo} | HP: ${match.robot1.currentHP}/${match.robot1.maxHP} | LP: ${match.robot1.leaguePoints} | W-L: ${match.robot1.wins}-${match.robot1.losses}`);
    console.log(`  ${match.robot2.name}:`);
    console.log(`    ELO: ${match.robot2.elo} | HP: ${match.robot2.currentHP}/${match.robot2.maxHP} | LP: ${match.robot2.leaguePoints} | W-L: ${match.robot2.wins}-${match.robot2.losses}`);
    console.log();
    
    const { battle, result, robot1, robot2 } = await executeBattle(match);
    
    const winnerName = result.winnerId === robot1.id ? match.robot1.name : match.robot2.name;
    console.log(`⚔️  BATTLE SIMULATION (${result.durationSeconds} seconds)`);
    console.log(`    Winner: ${winnerName}!`);
    console.log();
    
    // Get updated stats
    const robot1After = await prisma.robot.findUnique({ where: { id: robot1.id } });
    const robot2After = await prisma.robot.findUnique({ where: { id: robot2.id } });
    
    console.log('AFTER BATTLE:');
    console.log(`  ${match.robot1.name}:`);
    console.log(`    ELO: ${robot1After.elo} (${robot1After.elo - match.robot1.elo >= 0 ? '+' : ''}${robot1After.elo - match.robot1.elo})`);
    console.log(`    HP: ${robot1After.currentHP}/${robot1After.maxHP} (${robot1After.currentHP - match.robot1.currentHP})`);
    console.log(`    LP: ${robot1After.leaguePoints} (${robot1After.leaguePoints - match.robot1.leaguePoints >= 0 ? '+' : ''}${robot1After.leaguePoints - match.robot1.leaguePoints})`);
    console.log(`    W-L: ${robot1After.wins}-${robot1After.losses}`);
    console.log(`  ${match.robot2.name}:`);
    console.log(`    ELO: ${robot2After.elo} (${robot2After.elo - match.robot2.elo >= 0 ? '+' : ''}${robot2After.elo - match.robot2.elo})`);
    console.log(`    HP: ${robot2After.currentHP}/${robot2After.maxHP} (${robot2After.currentHP - match.robot2.currentHP})`);
    console.log(`    LP: ${robot2After.leaguePoints} (${robot2After.leaguePoints - match.robot2.leaguePoints >= 0 ? '+' : ''}${robot2After.leaguePoints - match.robot2.leaguePoints})`);
    console.log(`    W-L: ${robot2After.wins}-${robot2After.losses}`);
    console.log();
    console.log(`📊 Battle Record Created: ID #${battle.id}`);
    console.log(`✓ Scheduled Match Marked Complete`);
    console.log();
  }

  console.log('═'.repeat(60));
  console.log();
  console.log('✅ BATTLE EXECUTION COMPLETE!');
  console.log();
  console.log(`   ${scheduledMatches.length} battles executed successfully`);
  console.log('   All stats updated in database');
  console.log('   All scheduled matches marked as completed');
  console.log();
  console.log('─'.repeat(60));
  console.log(`Test completed at: ${new Date().toISOString()}`);
  console.log('─'.repeat(60));
  console.log();
}

demonstrateBattleExecution()
  .catch(e => {
    console.error('\n❌ ERROR:', e.message);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
