import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Robot name generator for test data
const prefixes = [
  'Iron', 'Steel', 'Titanium', 'Cyber', 'Plasma', 'Quantum',
  'Thunder', 'Lightning', 'Frost', 'Inferno', 'Shadow', 'Light',
  'Battle', 'War', 'Combat', 'Strike', 'Guard', 'Shield',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Prime',
  'Crimson', 'Azure', 'Emerald', 'Golden', 'Silver', 'Bronze',
  'Viper', 'Falcon', 'Dragon', 'Phoenix', 'Griffin', 'Hydra',
  'Storm', 'Blaze', 'Frost', 'Volt', 'Nova', 'Eclipse'
];

const suffixes = [
  'Gladiator', 'Warrior', 'Champion', 'Sentinel', 'Guardian',
  'Striker', 'Destroyer', 'Crusher', 'Breaker', 'Reaper',
  'Titan', 'Colossus', 'Behemoth', 'Juggernaut', 'Warlord',
  'Knight', 'Paladin', 'Vanguard', 'Enforcer', 'Protector',
  'Avenger', 'Hunter', 'Predator', 'Slayer', 'Annihilator',
  'Dominator', 'Conqueror', 'Victor', 'Defender', 'Vindicator',
  'Phantom', 'Specter', 'Wraith', 'Ghost', 'Shadow'
];

function generateRobotName(index: number): string {
  const prefix = prefixes[index % prefixes.length];
  const suffix = suffixes[Math.floor(index / prefixes.length) % suffixes.length];
  const variant = Math.floor(index / (prefixes.length * suffixes.length));
  
  if (variant > 0) {
    return `${prefix} ${suffix} ${variant + 1}`;
  }
  return `${prefix} ${suffix}`;
}

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
    
    // 11. Practice Sword (₡0) - FREE weapon for testing and matchmaking
    prisma.weapon.create({
      data: {
        name: 'Practice Sword',
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0, // FREE
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: 'Free starter weapon for testing',
        description: 'Basic training weapon with minimal stats',
        // All bonuses are 0 (default)
      },
    }),
  ]);

  console.log(`✅ Created ${weapons.length} weapons`);
  console.log('   - 3 energy weapons (Laser Rifle, Plasma Cannon, Ion Beam)');
  console.log('   - 3 ballistic weapons (Machine Gun, Railgun, Shotgun)');
  console.log('   - 3 melee weapons (Power Sword, Hammer, Plasma Blade)');
  console.log('   - 1 shield weapon (Combat Shield)');
  console.log('   - 1 practice weapon (Practice Sword - FREE)');

  // Store the Practice Sword ID for later use
  const practiceSword = weapons[10]; // Last weapon in array

  // Create test users
  console.log('Creating test users (admin + player1-5 + 100 test users)...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const testHashedPassword = await bcrypt.hash('testpass123', 10);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'admin',
      currency: 10000000, // ₡10 million for admin
      prestige: 50000,    // Admin has high prestige
    },
  });

  console.log('✅ Created admin user');

  // Create player users for manual testing
  console.log('Creating player1-5 users for manual testing...');
  const playerUsers = await Promise.all([
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

  console.log('✅ Created player1-5 users (password: password123)');

  // Create Bye-Robot special user (id will be determined by database)
  const byeUser = await prisma.user.create({
    data: {
      username: 'bye_robot_user',
      passwordHash: testHashedPassword,
      currency: 0,
      prestige: 0,
      role: 'user',
    },
  });

  console.log('✅ Created bye-robot user');

  // Create 100 test users with robots
  console.log('Creating 100 test users with robots...');
  const testUsersWithRobots = [];
  
  for (let i = 1; i <= 100; i++) {
    const username = `test_user_${String(i).padStart(3, '0')}`;
    const robotName = generateRobotName(i - 1);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: testHashedPassword,
        currency: 100000, // ₡100,000 starting balance
      },
    });

    // Create weapon inventory entry for Practice Sword
    const weaponInventory = await prisma.weaponInventory.create({
      data: {
        userId: user.id,
        weaponId: practiceSword.id,
      },
    });

    // Create robot with Practice Sword equipped
    const robot = await prisma.robot.create({
      data: {
        userId: user.id,
        name: robotName,
        frameId: 1,
        
        // All 23 attributes set to 1.00
        combatPower: 1.00,
        targetingSystems: 1.00,
        criticalSystems: 1.00,
        penetration: 1.00,
        weaponControl: 1.00,
        attackSpeed: 1.00,
        armorPlating: 1.00,
        shieldCapacity: 1.00,
        evasionThrusters: 1.00,
        damageDampeners: 1.00,
        counterProtocols: 1.00,
        hullIntegrity: 1.00,
        servoMotors: 1.00,
        gyroStabilizers: 1.00,
        hydraulicSystems: 1.00,
        powerCore: 1.00,
        combatAlgorithms: 1.00,
        threatAnalysis: 1.00,
        adaptiveAI: 1.00,
        logicCores: 1.00,
        syncProtocols: 1.00,
        supportSystems: 1.00,
        formationTactics: 1.00,
        
        // Combat state (HP formula: hullIntegrity × 10 = 1.00 × 10 = 10)
        currentHP: 10,
        maxHP: 10,
        currentShield: 2, // shieldCapacity × 2 = 1.00 × 2 = 2
        maxShield: 2,
        
        // Performance tracking
        elo: 1200, // Starting ELO
        
        // League
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        
        // Loadout
        loadoutType: 'single',
        mainWeaponId: weaponInventory.id,
        
        // Stance
        stance: 'balanced',
        
        // Battle readiness
        battleReadiness: 100,
        yieldThreshold: 10,
      },
    });

    testUsersWithRobots.push({ user, robot });
    
    if (i % 10 === 0) {
      console.log(`   Created ${i}/100 test users with robots...`);
    }
  }

  console.log(`✅ Created 100 test users with robots`);
  console.log(`   - Username format: test_user_001 to test_user_100`);
  console.log(`   - Password: testpass123`);
  console.log(`   - All robots equipped with Practice Sword`);
  console.log(`   - All robots in Bronze League (bronze_1)`);
  console.log(`   - All robots have ELO 1200`);

  // Create Bye-Robot (special robot for odd-number matchmaking)
  console.log('Creating Bye-Robot...');
  
  // First create weapon inventory for Bye-Robot
  const byeRobotWeapon = await prisma.weaponInventory.create({
    data: {
      userId: byeUser.id,
      weaponId: practiceSword.id,
    },
  });

  const byeRobot = await prisma.robot.create({
    data: {
      userId: byeUser.id,
      name: 'Bye Robot',
      frameId: 1,
      
      // All attributes set to 1.00 (minimal stats)
      combatPower: 1.00,
      targetingSystems: 1.00,
      criticalSystems: 1.00,
      penetration: 1.00,
      weaponControl: 1.00,
      attackSpeed: 1.00,
      armorPlating: 1.00,
      shieldCapacity: 1.00,
      evasionThrusters: 1.00,
      damageDampeners: 1.00,
      counterProtocols: 1.00,
      hullIntegrity: 1.00,
      servoMotors: 1.00,
      gyroStabilizers: 1.00,
      hydraulicSystems: 1.00,
      powerCore: 1.00,
      combatAlgorithms: 1.00,
      threatAnalysis: 1.00,
      adaptiveAI: 1.00,
      logicCores: 1.00,
      syncProtocols: 1.00,
      supportSystems: 1.00,
      formationTactics: 1.00,
      
      // Combat state
      currentHP: 10,
      maxHP: 10,
      currentShield: 2,
      maxShield: 2,
      
      // Performance tracking
      elo: 1000, // Fixed ELO of 1000
      
      // League
      currentLeague: 'bronze',
      leagueId: 'bronze_bye', // Special league ID
      leaguePoints: 0,
      
      // Loadout
      loadoutType: 'single',
      mainWeaponId: byeRobotWeapon.id,
      
      // Stance
      stance: 'balanced',
      
      // Battle readiness
      battleReadiness: 100,
      yieldThreshold: 0, // Never yields
    },
  });

  console.log(`✅ Created Bye-Robot (ELO: 1000, ID: ${byeRobot.id})`);

  // Keep original users for reference
  const users = [
    adminUser,
    ...playerUsers,
    ...testUsersWithRobots.map(t => t.user)
  ];

  console.log(`✅ Total users created: ${users.length + 1} (including bye-robot user)`);

  console.log('');
  console.log('✅ Database seeded successfully with matchmaking test data!');
  console.log('');
  console.log('📊 System Overview:');
  console.log('   💰 Currency: Credits (₡)');
  console.log('   👤 Admin: ₡10,000,000 (username: admin, password: admin123)');
  console.log('   👤 Player users: ₡2,000,000 each (player1-5, password: password123)');
  console.log('   👤 Test users: ₡100,000 each (test_user_001-100, password: testpass123)');
  console.log('   🤖 Robots: 100 test robots + 1 bye-robot');
  console.log('   ⚔️  Practice Sword: FREE (equipped on all test robots)');
  console.log('   🏆 League: All robots start in Bronze (bronze_1)');
  console.log('   📈 ELO: Test robots at 1200, Bye-Robot at 1000');
  console.log('');
  console.log('🤖 Robot Attributes: 23 total (all set to 1.00 for test robots)');
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
  console.log('🎯 Matchmaking Test Data:');
  console.log(`   - 100 test robots with creative names (e.g., "${testUsersWithRobots[0].robot.name}")`);
  console.log(`   - Bye-Robot ID: ${byeRobot.id} for odd-number matching`);
  console.log('   - All robots battle-ready with Practice Sword equipped');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('   - Admin: admin / admin123');
  console.log('   - Players: player1-5 / password123 (for manual testing)');
  console.log('   - Test users: test_user_001-100 / testpass123');
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
