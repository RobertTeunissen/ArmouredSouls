const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const robots = await prisma.robot.findMany({
    where: { userId: 2 },
    select: { id: true, name: true, createdAt: true }
  });
  
  console.log('Player2 robots:');
  robots.forEach(r => {
    console.log(`  ${r.name} (id: ${r.id}) - created at ${r.createdAt}`);
  });
  
  // Check if there are any credit_change events for robot creation
  const robotEvents = await prisma.auditLog.findMany({
    where: {
      userId: 2,
      eventType: 'credit_change',
      payload: {
        path: ['source'],
        equals: 'other'
      }
    }
  });
  
  console.log(`\nCredit_change events with source='other': ${robotEvents.length}`);
  robotEvents.forEach(e => {
    console.log(`  Cycle ${e.cycleNumber}: amount=${e.payload?.amount}, newBalance=${e.payload?.newBalance}`);
  });
  
  await prisma.$disconnect();
}

check();
