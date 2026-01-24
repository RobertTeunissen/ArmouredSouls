import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample components (chassis, weapons, armor)
  console.log('Creating components...');
  
  // Chassis
  const chassis = await Promise.all([
    prisma.component.create({
      data: {
        name: 'Tank',
        type: 'chassis',
        description: 'Heavy and durable chassis',
        healthModifier: 50,
        speedModifier: -5,
        defenseModifier: 10,
        attackModifier: 0,
      },
    }),
    prisma.component.create({
      data: {
        name: 'Scout',
        type: 'chassis',
        description: 'Fast and agile chassis',
        healthModifier: 0,
        speedModifier: 10,
        defenseModifier: -5,
        attackModifier: 5,
      },
    }),
    prisma.component.create({
      data: {
        name: 'Balanced',
        type: 'chassis',
        description: 'Well-rounded chassis',
        healthModifier: 20,
        speedModifier: 0,
        defenseModifier: 0,
        attackModifier: 0,
      },
    }),
  ]);

  // Weapons
  const weapons = await Promise.all([
    prisma.component.create({
      data: {
        name: 'Laser Rifle',
        type: 'weapon',
        description: 'Standard energy weapon',
        attackModifier: 15,
      },
    }),
    prisma.component.create({
      data: {
        name: 'Plasma Cannon',
        type: 'weapon',
        description: 'High damage, heavy',
        attackModifier: 25,
      },
    }),
    prisma.component.create({
      data: {
        name: 'Machine Gun',
        type: 'weapon',
        description: 'Rapid fire',
        attackModifier: 10,
      },
    }),
  ]);

  // Armor
  const armor = await Promise.all([
    prisma.component.create({
      data: {
        name: 'Heavy Plate',
        type: 'armor',
        description: 'Maximum protection',
        defenseModifier: 20,
        speedModifier: -5,
      },
    }),
    prisma.component.create({
      data: {
        name: 'Light Armor',
        type: 'armor',
        description: 'Basic protection',
        defenseModifier: 10,
        speedModifier: 0,
      },
    }),
    prisma.component.create({
      data: {
        name: 'Energy Shield',
        type: 'armor',
        description: 'Advanced defensive system',
        defenseModifier: 15,
        speedModifier: 2,
      },
    }),
  ]);

  console.log(`✅ Created ${chassis.length} chassis, ${weapons.length} weapons, ${armor.length} armor`);

  // Create test users
  console.log('Creating test users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
        currency: 10000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player1',
        passwordHash: hashedPassword,
        currency: 1000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player2',
        passwordHash: hashedPassword,
        currency: 1000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player3',
        passwordHash: hashedPassword,
        currency: 1000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player4',
        passwordHash: hashedPassword,
        currency: 1000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player5',
        passwordHash: hashedPassword,
        currency: 1000,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);
  console.log('   - admin/admin123 (admin role)');
  console.log('   - player1-5/password123 (regular users)');

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
