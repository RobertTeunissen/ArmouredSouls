const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const purchases = await prisma.auditLog.findMany({
    where: {
      cycleNumber: 0,
      eventType: { in: ['weapon_purchase', 'facility_purchase', 'facility_upgrade'] }
    }
  });
  
  console.log('Cycle 0 purchases:\n');
  
  for (const e of purchases) {
    const user = e.userId ? await prisma.user.findUnique({ where: { id: e.userId } }) : null;
    console.log(`${user?.username || 'unknown'} (userId: ${e.userId}): ${e.eventType} - ₡${e.payload?.cost}`);
  }
  
  await prisma.$disconnect();
}

check();
