import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get player1's user ID
  const user = await prisma.user.findUnique({
    where: { username: 'player1' },
    select: { id: true, currency: true }
  });
  
  console.log('User:', user);
  
  // Get audit logs for cycles 1-3
  const logs = await prisma.auditLog.findMany({
    where: {
      userId: user.id,
      cycleNumber: { lte: 3 },
      eventType: { in: ['credit_change', 'operating_costs', 'passive_income', 'robot_repair'] }
    },
    orderBy: [
      { cycleNumber: 'asc' },
      { sequenceNumber: 'asc' }
    ],
    select: {
      cycleNumber: true,
      eventType: true,
      payload: true,
      sequenceNumber: true
    }
  });
  
  console.log('\nAudit logs for cycles 1-3:');
  logs.forEach(log => {
    console.log(`Cycle ${log.cycleNumber} [${log.sequenceNumber}] ${log.eventType}:`, JSON.stringify(log.payload));
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
