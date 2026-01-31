const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignRobots() {
  try {
    // Get player1
    const player1 = await prisma.user.findFirst({
      where: { username: 'player1' }
    });
    
    if (!player1) {
      console.log('player1 not found');
      return;
    }
    
    console.log(`Found player1 (ID: ${player1.id})`);
    
    // Get robots that have battles
    const robots = await prisma.robot.findMany({
      where: {
        name: { contains: 'Gladiator' },
        NOT: { name: 'Bye Robot' }
      },
      include: {
        _count: {
          select: {
            battlesAsRobot1: true,
            battlesAsRobot2: true
          }
        }
      },
      take: 3
    });
    
    console.log(`\nFound ${robots.length} robots with battles`);
    
    // Assign first 3 robots to player1
    for (const robot of robots) {
      const totalBattles = robot._count.battlesAsRobot1 + robot._count.battlesAsRobot2;
      console.log(`  ${robot.name}: ${totalBattles} battles`);
      
      await prisma.robot.update({
        where: { id: robot.id },
        data: { userId: player1.id }
      });
    }
    
    console.log(`\n✓ Assigned ${robots.length} robots to player1`);
    
    // Verify assignment
    const player1WithRobots = await prisma.user.findUnique({
      where: { id: player1.id },
      include: {
        robots: {
          include: {
            _count: {
              select: {
                battlesAsRobot1: true,
                battlesAsRobot2: true
              }
            }
          }
        }
      }
    });
    
    console.log(`\nPlayer1 now has ${player1WithRobots.robots.length} robots:`);
    player1WithRobots.robots.forEach(r => {
      const battles = r._count.battlesAsRobot1 + r._count.battlesAsRobot2;
      console.log(`  - ${r.name} (${battles} battles, ELO: ${r.elo})`);
    });
    
  } finally {
    await prisma.$disconnect();
  }
}

assignRobots().catch(console.error);
