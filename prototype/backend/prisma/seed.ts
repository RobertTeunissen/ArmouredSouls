import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with COMPLETE future-state schema...');

  // Create weapons with ALL specifications from DATABASE_SCHEMA_FUTURE_STATE.md
  console.log('Creating weapons...');
  
  const weapons = await Promise.all([
    // ===== ENERGY WEAPONS =====
    // 1. Laser Rifle (₡150,000)
    prisma.weapon.create({
      data: {
        name: 'Laser Rifle',
        weaponType: 'energy',
        baseDamage: 20,
        cooldown: 3,
        cost: 150000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'single',
        specialProperty: '+15% accuracy bonus',
        description: 'Standard energy weapon with good accuracy',
        targetingSystemsBonus: 3,
        weaponControlBonus: 4,
        attackSpeedBonus: 2,
      },
    }),
    
    // 2. Plasma Cannon (₡300,000)
    prisma.weapon.create({
      data: {
        name: 'Plasma Cannon',
        weaponType: 'energy',
        baseDamage: 40,
        cooldown: 5,
        cost: 300000,
        handsRequired: 'two',
        damageType: 'energy',
        loadoutType: 'two_handed',
        specialProperty: '+20% vs energy shields',
        description: 'High damage plasma weapon, generates heat',
        combatPowerBonus: 5,
        criticalSystemsBonus: 4,
        powerCoreBonus: -3,
      },
    }),
    
    // 3. Ion Beam (₡400,000)
    prisma.weapon.create({
      data: {
        name: 'Ion Beam',
        weaponType: 'energy',
        baseDamage: 30,
        cooldown: 4,
        cost: 400000,
        handsRequired: 'two',
        damageType: 'energy',
        loadoutType: 'two_handed',
        specialProperty: 'Disables enemy energy shields for 2 seconds on crit',
        description: 'Efficient energy weapon with armor penetration',
        penetrationBonus: 8,
        shieldCapacityBonus: 4,
        attackSpeedBonus: 3,
      },
    }),
    
    // ===== BALLISTIC WEAPONS =====
    // 4. Machine Gun (₡100,000)
    prisma.weapon.create({
      data: {
        name: 'Machine Gun',
        weaponType: 'ballistic',
        baseDamage: 12,
        cooldown: 2,
        cost: 100000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: 'Can fire burst (3 shots at 40% damage each)',
        description: 'Rapid-fire ballistic weapon',
        combatPowerBonus: 2,
        attackSpeedBonus: 6,
        weaponControlBonus: 3,
      },
    }),
    
    // 5. Railgun (₡350,000)
    prisma.weapon.create({
      data: {
        name: 'Railgun',
        weaponType: 'ballistic',
        baseDamage: 50,
        cooldown: 6,
        cost: 350000,
        handsRequired: 'two',
        damageType: 'ballistic',
        loadoutType: 'two_handed',
        specialProperty: 'Ignores 50% of armor',
        description: 'High-velocity penetrating weapon',
        penetrationBonus: 12,
        targetingSystemsBonus: 5,
        attackSpeedBonus: -3,
      },
    }),
    
    // 6. Shotgun (₡120,000)
    prisma.weapon.create({
      data: {
        name: 'Shotgun',
        weaponType: 'ballistic',
        baseDamage: 35,
        cooldown: 4,
        cost: 120000,
        handsRequired: 'two',
        damageType: 'ballistic',
        loadoutType: 'two_handed',
        specialProperty: '+30% damage at close range',
        description: 'Close-range devastating weapon',
        combatPowerBonus: 4,
        criticalSystemsBonus: 5,
        targetingSystemsBonus: -3,
      },
    }),
    
    // ===== MELEE WEAPONS =====
    // 7. Power Sword (₡180,000)
    prisma.weapon.create({
      data: {
        name: 'Power Sword',
        weaponType: 'melee',
        baseDamage: 28,
        cooldown: 3,
        cost: 180000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: '+25% counter damage',
        description: 'Energized melee weapon for close combat',
        hydraulicSystemsBonus: 6,
        counterProtocolsBonus: 5,
        gyroStabilizersBonus: 3,
      },
    }),
    
    // 8. Hammer (₡200,000)
    prisma.weapon.create({
      data: {
        name: 'Hammer',
        weaponType: 'melee',
        baseDamage: 42,
        cooldown: 5,
        cost: 200000,
        handsRequired: 'two',
        damageType: 'melee',
        loadoutType: 'two_handed',
        specialProperty: 'High impact force',
        description: 'Heavy crushing weapon',
        hydraulicSystemsBonus: 8,
        combatPowerBonus: 6,
        servoMotorsBonus: -2,
      },
    }),
    
    // 9. Plasma Blade (₡250,000)
    prisma.weapon.create({
      data: {
        name: 'Plasma Blade',
        weaponType: 'melee',
        baseDamage: 24,
        cooldown: 3,  // Changed from 2.5 to 3 (schema uses Int)
        cost: 250000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: 'Burns through energy shields (70% effective vs shields)',
        description: 'Fast melee weapon with energy damage',
        hydraulicSystemsBonus: 4,
        attackSpeedBonus: 5,
        criticalSystemsBonus: 3,
      },
    }),
    
    // ===== SHIELD WEAPONS =====
    // 10. Combat Shield (₡100,000)
    prisma.weapon.create({
      data: {
        name: 'Combat Shield',
        weaponType: 'shield',
        baseDamage: 0,
        cooldown: 0,
        cost: 100000,
        handsRequired: 'shield',
        damageType: 'none',
        loadoutType: 'weapon_shield',
        specialProperty: '25% chance to block ranged attacks',
        description: 'Defensive shield for protection',
        armorPlatingBonus: 8,
        counterProtocolsBonus: 6,
        evasionThrustersBonus: -2,
        shieldCapacityBonus: 5,
      },
    }),
  ]);

  console.log(`✅ Created ${weapons.length} weapons`);
  console.log('   - 3 energy weapons (Laser Rifle, Plasma Cannon, Ion Beam)');
  console.log('   - 3 ballistic weapons (Machine Gun, Railgun, Shotgun)');
  console.log('   - 3 melee weapons (Power Sword, Hammer, Plasma Blade)');
  console.log('   - 1 shield weapon (Combat Shield)');

  // Create test users
  console.log('Creating test users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'admin',
        currency: 10000000, // ₡10 million for admin
        prestige: 50000,    // Admin has high prestige
      },
    }),
    prisma.user.create({
      data: {
        username: 'player1',
        passwordHash: hashedPassword,
        currency: 2000000, // ₡2 million starting balance
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
  console.log('   - admin/admin123 (admin role, ₡10,000,000, 50k prestige)');
  console.log('   - player1-5/password123 (regular users, ₡2,000,000 each)');

  console.log('');
  console.log('✅ Database seeded successfully with complete future-state schema!');
  console.log('');
  console.log('📊 System Overview:');
  console.log('   💰 Currency: Credits (₡)');
  console.log('   👤 Starting balance: ₡2,000,000');
  console.log('   🤖 Robot creation cost: ₡500,000');
  console.log('   ⚔️  Weapon costs: ₡100,000 - ₡400,000');
  console.log('   📈 Upgrade formula: (level + 1) × 1,000 Credits');
  console.log('');
  console.log('🤖 Robot Attributes: 23 total');
  console.log('   ⚡ Combat Systems (6): combatPower, targetingSystems, criticalSystems, penetration, weaponControl, attackSpeed');
  console.log('   🛡️  Defensive Systems (5): armorPlating, shieldCapacity, evasionThrusters, damageDampeners, counterProtocols');
  console.log('   🔧 Chassis & Mobility (5): hullIntegrity, servoMotors, gyroStabilizers, hydraulicSystems, powerCore');
  console.log('   🧠 AI Processing (4): combatAlgorithms, threatAnalysis, adaptiveAI, logicCores');
  console.log('   🤝 Team Coordination (3): syncProtocols, supportSystems, formationTactics');
  console.log('');
  console.log('🏭 Facilities: 14 types with 10 levels each');
  console.log('   - repair_bay, training_facility, weapons_workshop, research_lab');
  console.log('   - medical_bay, roster_expansion, storage_facility, coaching_staff');
  console.log('   - booking_office, combat/defense/mobility/ai_training_academy, income_generator');
  console.log('');
  console.log('⚔️  Loadout Types: single, weapon_shield, two_handed, dual_wield');
  console.log('🥊 Stances: offensive, defensive, balanced');
  console.log('🏆 Leagues: bronze, silver, gold, platinum, diamond, champion');
  console.log('');
  console.log('📝 HP Formula: maxHP = hullIntegrity × 10');
  console.log('🛡️  Shield Formula: maxShield = shieldCapacity × 2');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
