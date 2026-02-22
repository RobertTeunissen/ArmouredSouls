import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getLowestEloRobots() {
  try {
    const robots = await prisma.robot.findMany({
      orderBy: {
        elo: 'asc'
      },
      take: 100,
      select: {
        id: true,
        name: true,
        elo: true,
        userId: true,
        currentLeague: true,
        wins: true,
        losses: true,
        draws: true,
        totalBattles: true,
        user: {
          select: {
            username: true,
            stableName: true
          }
        }
      }
    });

    console.log('\n=== 100 ROBOTS WITH LOWEST ELO ===\n');
    console.log('Rank | Robot ID | Robot Name | ELO | Owner | League | W-L-D | Total Battles');
    console.log('-'.repeat(100));

    robots.forEach((robot, index) => {
      const rank = (index + 1).toString().padStart(3);
      const id = robot.id.toString().padStart(4);
      const name = robot.name.padEnd(20).substring(0, 20);
      const elo = robot.elo.toString().padStart(4);
      const owner = (robot.user.stableName || robot.user.username).padEnd(15).substring(0, 15);
      const league = robot.currentLeague.padEnd(8);
      const record = `${robot.wins}-${robot.losses}-${robot.draws}`.padEnd(10);
      const battles = robot.totalBattles.toString().padStart(5);

      console.log(`${rank}  | ${id}     | ${name} | ${elo} | ${owner} | ${league} | ${record} | ${battles}`);
    });

    console.log('\n=== SUMMARY ===');
    console.log(`Total robots found: ${robots.length}`);
    if (robots.length > 0) {
      console.log(`Lowest ELO: ${robots[0].elo} (${robots[0].name})`);
      console.log(`Highest ELO in this list: ${robots[robots.length - 1].elo} (${robots[robots.length - 1].name})`);
    }

    // Count by robot type
    console.log('\n=== ROBOT TYPE BREAKDOWN ===');
    const typeCounts: Record<string, number> = {};
    
    robots.forEach(robot => {
      if (robot.name.startsWith('WimpBot')) {
        typeCounts['WimpBot'] = (typeCounts['WimpBot'] || 0) + 1;
      } else if (robot.name.startsWith('Investor One')) {
        typeCounts['Investor One'] = (typeCounts['Investor One'] || 0) + 1;
      } else if (robot.name.startsWith('Bye Robot')) {
        typeCounts['Bye Robot'] = (typeCounts['Bye Robot'] || 0) + 1;
      } else if (robot.name.startsWith('Henk')) {
        typeCounts['Henk'] = (typeCounts['Henk'] || 0) + 1;
      } else {
        typeCounts['Other'] = (typeCounts['Other'] || 0) + 1;
      }
    });

    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`${type}: ${count}`);
      });

  } catch (error) {
    console.error('Error fetching robots:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getLowestEloRobots();
