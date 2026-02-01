import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔐 Testing login for attribute-focused users...\n');
  
  const testUsers = [
    'test_attr_combat_power',
    'test_attr_hull_integrity',
    'test_attr_shield_capacity',
  ];

  for (const username of testUsers) {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      console.log(`❌ User ${username} not found`);
      continue;
    }

    // Test password verification (password is 'testpass123')
    const isValid = await bcrypt.compare('testpass123', user.passwordHash);
    
    if (isValid) {
      console.log(`✅ ${username} - login successful`);
    } else {
      console.log(`❌ ${username} - login failed (password mismatch)`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
