const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    where: { username: { in: ['player1', 'player2'] } },
    select: { id: true, username: true, currency: true }
  });
  
  console.log('Users:');
  users.forEach(u => {
    console.log(`  ${u.username} (id: ${u.id}): ₡${u.currency.toLocaleString()}`);
  });
  
  await prisma.$disconnect();
}

check();
