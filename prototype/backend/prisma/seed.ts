import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create weapons
  console.log('Creating weapons...');
  
  // Energy Weapons
  const energyWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Laser Rifle',
        weaponType: 'energy',
        description: 'Standard energy weapon with good accuracy',
        baseDamage: 20,
        cost: 150000,
        accuracyBonus: 3,
        energyEfficiencyBonus: 5,
        targetingSystemsBonus: 2,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Plasma Cannon',
        weaponType: 'energy',
        description: 'High damage plasma weapon, generates heat',
        baseDamage: 35,
        cost: 300000,
        attackPowerBonus: 5,
        heatManagementBonus: -3,
        criticalStrikeBonus: 4,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Ion Beam',
        weaponType: 'energy',
        description: 'Efficient energy weapon with armor penetration',
        baseDamage: 25,
        cost: 400000,
        energyEfficiencyBonus: 8,
        armorPenetrationBonus: 6,
        reloadSpeedBonus: 4,
      },
    }),
  ]);

  // Ballistic Weapons
  const ballisticWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Machine Gun',
        weaponType: 'ballistic',
        description: 'Rapid-fire ballistic weapon',
        baseDamage: 15,
        cost: 100000,
        attackPowerBonus: 2,
        reloadSpeedBonus: 6,
        weaponHandlingBonus: 3,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Railgun',
        weaponType: 'ballistic',
        description: 'High-velocity penetrating weapon',
        baseDamage: 40,
        cost: 350000,
        armorPenetrationBonus: 10,
        accuracyBonus: 5,
        reloadSpeedBonus: -2,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Shotgun',
        weaponType: 'ballistic',
        description: 'Close-range devastating weapon',
        baseDamage: 30,
        cost: 120000,
        attackPowerBonus: 4,
        accuracyBonus: -3,
        criticalStrikeBonus: 5,
      },
    }),
  ]);

  // Melee Weapons
  const meleeWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Power Sword',
        weaponType: 'melee',
        description: 'Energized melee weapon for close combat',
        baseDamage: 28,
        cost: 180000,
        strengthBonus: 6,
        counterAttackBonus: 5,
        agilityBonus: 3,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Hammer',
        weaponType: 'melee',
        description: 'Heavy crushing weapon',
        baseDamage: 35,
        cost: 200000,
        strengthBonus: 8,
        attackPowerBonus: 6,
        speedBonus: -2,
      },
    }),
  ]);

  // Explosive Weapons
  const explosiveWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Rocket Launcher',
        weaponType: 'explosive',
        description: 'High-damage area weapon',
        baseDamage: 45,
        cost: 320000,
        attackPowerBonus: 7,
        criticalStrikeBonus: 6,
        reloadSpeedBonus: -4,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Grenade Launcher',
        weaponType: 'explosive',
        description: 'Tactical explosive weapon',
        baseDamage: 32,
        cost: 250000,
        attackPowerBonus: 5,
        tacticalAwarenessBonus: 4,
        reloadSpeedBonus: -2,
      },
    }),
  ]);

  const totalWeapons = energyWeapons.length + ballisticWeapons.length + meleeWeapons.length + explosiveWeapons.length;
  console.log(`✅ Created ${totalWeapons} weapons`);
  console.log(`   - ${energyWeapons.length} energy weapons`);
  console.log(`   - ${ballisticWeapons.length} ballistic weapons`);
  console.log(`   - ${meleeWeapons.length} melee weapons`);
  console.log(`   - ${explosiveWeapons.length} explosive weapons`);

  // Create test users with new currency system
  console.log('Creating test users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
        currency: 10000000, // 10 million for admin
        elo: 1200,
        fame: 0,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player1',
        passwordHash: hashedPassword,
        currency: 1000000, // 1 million starting balance
        elo: 1200,
        fame: 0,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player2',
        passwordHash: hashedPassword,
        currency: 1000000,
        elo: 1200,
        fame: 0,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player3',
        passwordHash: hashedPassword,
        currency: 1000000,
        elo: 1200,
        fame: 0,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player4',
        passwordHash: hashedPassword,
        currency: 1000000,
        elo: 1200,
        fame: 0,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player5',
        passwordHash: hashedPassword,
        currency: 1000000,
        elo: 1200,
        fame: 0,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);
  console.log('   - admin/admin123 (admin role, ₡10,000,000)');
  console.log('   - player1-5/password123 (regular users, ₡1,000,000 each)');

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('💰 Currency: Credits (₡)');
  console.log('🤖 Robot frame cost: ₡500,000');
  console.log('⚔️  Weapon costs: ₡100,000 - ₡400,000');
  console.log('📈 Upgrade formula: (level + 1) × 1,000 Credits');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
