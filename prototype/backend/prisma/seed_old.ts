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
        loadoutType: 'single',
        description: 'Standard energy weapon with good accuracy',
        baseDamage: 20,
        cost: 150000,
        targetingSystemsBonus: 3,
        weaponControlBonus: 4,
        attackSpeedBonus: 2,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Plasma Cannon',
        weaponType: 'energy',
        loadoutType: 'two-handed',
        description: 'High damage plasma weapon, generates heat',
        baseDamage: 35,
        cost: 300000,
        combatPowerBonus: 5,
        criticalSystemsBonus: 4,
        powerCoreBonus: -3,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Ion Beam',
        weaponType: 'energy',
        loadoutType: 'single',
        description: 'Efficient energy weapon with armor penetration',
        baseDamage: 25,
        cost: 400000,
        penetrationBonus: 6,
        shieldCapacityBonus: 4,
        attackSpeedBonus: 5,
      },
    }),
  ]);

  // Ballistic Weapons
  const ballisticWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Machine Gun',
        weaponType: 'ballistic',
        loadoutType: 'dual-wield',
        description: 'Rapid-fire ballistic weapon',
        baseDamage: 15,
        cost: 100000,
        combatPowerBonus: 2,
        attackSpeedBonus: 8,
        weaponControlBonus: 3,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Railgun',
        weaponType: 'ballistic',
        loadoutType: 'two-handed',
        description: 'High-velocity penetrating weapon',
        baseDamage: 40,
        cost: 350000,
        penetrationBonus: 10,
        targetingSystemsBonus: 5,
        attackSpeedBonus: -3,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Shotgun',
        weaponType: 'ballistic',
        loadoutType: 'single',
        description: 'Close-range devastating weapon',
        baseDamage: 30,
        cost: 120000,
        combatPowerBonus: 4,
        criticalSystemsBonus: 5,
        targetingSystemsBonus: -3,
      },
    }),
  ]);

  // Melee Weapons
  const meleeWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Power Sword',
        weaponType: 'melee',
        loadoutType: 'single',
        description: 'Energized melee weapon for close combat',
        baseDamage: 28,
        cost: 180000,
        hydraulicSystemsBonus: 6,
        counterProtocolsBonus: 5,
        gyroStabilizersBonus: 3,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Hammer',
        weaponType: 'melee',
        loadoutType: 'two-handed',
        description: 'Heavy crushing weapon',
        baseDamage: 35,
        cost: 200000,
        hydraulicSystemsBonus: 8,
        combatPowerBonus: 6,
        servoMotorsBonus: -2,
      },
    }),
  ]);

  // Explosive Weapons
  const explosiveWeapons = await Promise.all([
    prisma.weapon.create({
      data: {
        name: 'Rocket Launcher',
        weaponType: 'explosive',
        loadoutType: 'two-handed',
        description: 'High-damage area weapon',
        baseDamage: 45,
        cost: 320000,
        combatPowerBonus: 7,
        criticalSystemsBonus: 6,
        attackSpeedBonus: -4,
      },
    }),
    prisma.weapon.create({
      data: {
        name: 'Grenade Launcher',
        weaponType: 'explosive',
        loadoutType: 'single',
        description: 'Tactical explosive weapon',
        baseDamage: 32,
        cost: 250000,
        combatPowerBonus: 5,
        threatAnalysisBonus: 4,
        attackSpeedBonus: -2,
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
      },
    }),
    prisma.user.create({
      data: {
        username: 'player1',
        passwordHash: hashedPassword,
        currency: 2000000, // 2 million starting balance
      },
    }),
    prisma.user.create({
      data: {
        username: 'player2',
        passwordHash: hashedPassword,
        currency: 2000000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player3',
        passwordHash: hashedPassword,
        currency: 2000000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player4',
        passwordHash: hashedPassword,
        currency: 2000000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player5',
        passwordHash: hashedPassword,
        currency: 2000000,
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);
  console.log('   - admin/admin123 (admin role, ₡10,000,000)');
  console.log('   - player1-5/password123 (regular users, ₡2,000,000 each)');

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('💰 Currency: Credits (₡)');
  console.log('👤 Starting balance: ₡2,000,000');
  console.log('🤖 Robot frame cost: ₡500,000');
  console.log('⚔️  Weapon costs: ₡100,000 - ₡400,000');
  console.log('📈 Upgrade formula: (level + 1) × 1,000 Credits');
  console.log('');
  console.log('🔧 Attributes: 23 total (Combat Systems, Defensive Systems, Chassis & Mobility, AI Processing, Team Coordination)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
