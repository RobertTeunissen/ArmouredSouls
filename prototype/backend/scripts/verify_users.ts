import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 Verifying attribute-focused test users...\n');
  
  // Get one example user
  const exampleUser = await prisma.user.findUnique({
    where: { username: 'test_attr_combat_power' },
    include: {
      robots: true,
      facilities: true,
    },
  });

  if (exampleUser) {
    console.log(`✅ User: ${exampleUser.username}`);
    console.log(`   Currency: ₡${exampleUser.currency.toLocaleString()}`);
    console.log(`   Number of robots: ${exampleUser.robots.length}`);
    console.log(`   Facilities: ${exampleUser.facilities.map(f => `${f.facilityType} (level ${f.level})`).join(', ')}`);
    
    if (exampleUser.robots.length > 0) {
      const robot = exampleUser.robots[0];
      console.log(`\n   Robot example: ${robot.name}`);
      console.log(`      Combat Power: ${robot.combatPower}`);
      console.log(`      Targeting Systems: ${robot.targetingSystems}`);
      console.log(`      Hull Integrity: ${robot.hullIntegrity}`);
      console.log(`      Max HP: ${robot.maxHP} (calculated from hullIntegrity × 10)`);
      console.log(`      Max Shield: ${robot.maxShield} (calculated from shieldCapacity × 2)`);
      console.log(`      Loadout: ${robot.loadoutType}`);
      console.log(`      Stance: ${robot.stance}`);
    }
  }

  // Count all attribute test users
  const attributeUsers = await prisma.user.count({
    where: {
      username: {
        startsWith: 'test_attr_'
      }
    }
  });

  console.log(`\n✅ Total attribute-focused test users: ${attributeUsers}`);
  
  // Count their robots
  const attributeRobots = await prisma.robot.count({
    where: {
      user: {
        username: {
          startsWith: 'test_attr_'
        }
      }
    }
  });
  
  console.log(`✅ Total robots for attribute testing: ${attributeRobots}`);
  
  // List all attribute test users
  const allAttributeUsers = await prisma.user.findMany({
    where: {
      username: {
        startsWith: 'test_attr_'
      }
    },
    orderBy: {
      username: 'asc'
    },
    select: {
      username: true,
    }
  });
  
  console.log('\n📋 All attribute-focused test users:');
  allAttributeUsers.forEach((user, index) => {
    console.log(`   ${index + 1}. ${user.username}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
