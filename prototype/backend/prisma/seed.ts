import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Default robot attributes (all set to 1.00)
const DEFAULT_ROBOT_ATTRIBUTES = {
  combatPower: 1.0,
  targetingSystems: 1.0,
  criticalSystems: 1.0,
  penetration: 1.0,
  weaponControl: 1.0,
  attackSpeed: 1.0,
  armorPlating: 1.0,
  shieldCapacity: 1.0,
  evasionThrusters: 1.0,
  damageDampeners: 1.0,
  counterProtocols: 1.0,
  hullIntegrity: 1.0,
  servoMotors: 1.0,
  gyroStabilizers: 1.0,
  hydraulicSystems: 1.0,
  powerCore: 1.0,
  combatAlgorithms: 1.0,
  threatAnalysis: 1.0,
  adaptiveAI: 1.0,
  logicCores: 1.0,
  syncProtocols: 1.0,
  supportSystems: 1.0,
  formationTactics: 1.0,
};

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

  // Clean up existing data (allows seed to be run multiple times)
  console.log('🧹 Cleaning up existing data...');
  await prisma.scheduledMatch.deleteMany();
  await prisma.battle.deleteMany();
  await prisma.weaponInventory.deleteMany();
  await prisma.robot.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.weapon.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cycleMetadata.deleteMany();
  console.log('✅ Existing data cleaned up\n');

  // Initialize cycle metadata
  console.log('Initializing cycle metadata...');
  await prisma.cycleMetadata.create({
    data: {
      id: 1,
      totalCycles: 0,
    },
  });
  console.log('✅ Cycle metadata initialized\n');

  // Create weapons with ALL specifications from DATABASE_SCHEMA_FUTURE_STATE.md
  console.log('Creating weapons...');
  
  const weapons = await Promise.all([
    // ===== STARTER/PRACTICE WEAPONS =====
    // 1. Practice Sword (₡50,000) - Baseline weapon
    prisma.weapon.create({
      data: {
        name: 'Practice Sword',
        weaponType: 'melee',
        baseDamage: 8,  // Reduced from 10 (20% nerf, new baseline)
        cooldown: 3,
        cost: 50000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Basic training weapon establishing baseline cost',
        // All bonuses are 0 (default)
      },
    }),

    // ===== BUDGET TIER (₡50K-₡100K) =====
    // 2. Machine Pistol (₡75,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Machine Pistol',
        weaponType: 'ballistic',
        baseDamage: 6,  // Reduced from 8 (~25% nerf)
        cooldown: 2,
        cost: 75000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Rapid-fire sidearm with quick attacks',
        attackSpeedBonus: 3,
        weaponControlBonus: 2,
      },
    }),

    // 3. Laser Pistol (₡75,000) - One-handed energy
    prisma.weapon.create({
      data: {
        name: 'Laser Pistol',
        weaponType: 'energy',
        baseDamage: 8,  // Reduced from 12 (~33% nerf)
        cooldown: 3,
        cost: 75000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Precise energy sidearm with good accuracy',
        targetingSystemsBonus: 3,
        combatPowerBonus: 2,
      },
    }),

    // 4. Combat Knife (₡90,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Combat Knife',
        weaponType: 'melee',
        baseDamage: 6,  // Reduced from 9 (~33% nerf)
        cooldown: 2,
        cost: 90000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Fast melee weapon for close combat',
        attackSpeedBonus: 3,
        gyroStabilizersBonus: 1,
      },
    }),

    // 5. Light Shield (₡50,000) - Budget shield
    prisma.weapon.create({
      data: {
        name: 'Light Shield',
        weaponType: 'shield',
        baseDamage: 0,
        cooldown: 0,
        cost: 50000,
        handsRequired: 'shield',
        damageType: 'none',
        loadoutType: 'weapon_shield',
        specialProperty: null,
        description: 'Basic defensive shield for protection',
        armorPlatingBonus: 3,
        shieldCapacityBonus: 2,
      },
    }),

    // 6. Combat Shield (₡80,000) - Mid shield
    prisma.weapon.create({
      data: {
        name: 'Combat Shield',
        weaponType: 'shield',
        baseDamage: 0,
        cooldown: 0,
        cost: 80000,
        handsRequired: 'shield',
        damageType: 'none',
        loadoutType: 'weapon_shield',
        specialProperty: null,
        description: 'Heavy-duty shield with counter capabilities',
        armorPlatingBonus: 6,
        counterProtocolsBonus: 3,
        evasionThrustersBonus: -2,
        shieldCapacityBonus: 5,
      },
    }),

    // 7. Reactive Shield (₡90,000) - Advanced shield
    prisma.weapon.create({
      data: {
        name: 'Reactive Shield',
        weaponType: 'shield',
        baseDamage: 0,
        cooldown: 0,
        cost: 90000,
        handsRequired: 'shield',
        damageType: 'none',
        loadoutType: 'weapon_shield',
        specialProperty: null,
        description: 'Advanced shield with energy-reactive plating',
        shieldCapacityBonus: 7,
        counterProtocolsBonus: 6,
        powerCoreBonus: 4,
        servoMotorsBonus: -2,
      },
    }),

    // 8. Machine Gun (₡120,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Machine Gun',
        weaponType: 'ballistic',
        baseDamage: 7,  // Reduced from 10 (~30% nerf)
        cooldown: 2,
        cost: 120000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Sustained fire support weapon',
        combatPowerBonus: 3,
        attackSpeedBonus: 5,
        weaponControlBonus: 2,
      },
    }),

    // ===== MID TIER (₡100K-₡200K) =====
    // 9. Burst Rifle (₡145,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Burst Rifle',
        weaponType: 'ballistic',
        baseDamage: 11,  // Reduced from 15 (~27% nerf)
        cooldown: 3, // Adjusted from 2.5 for integer compatibility
        cost: 145000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: null,
        description: '3-round burst fire weapon with controlled recoil',
        attackSpeedBonus: 4,
        targetingSystemsBonus: 3,
        criticalSystemsBonus: 3,
      },
    }),

    // 10. Assault Rifle (₡150,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Assault Rifle',
        weaponType: 'ballistic',
        baseDamage: 13,  // Reduced from 18 (~28% nerf)
        cooldown: 3,
        cost: 150000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Versatile military-grade firearm',
        combatPowerBonus: 4,
        targetingSystemsBonus: 4,
        weaponControlBonus: 3,
        attackSpeedBonus: 2,
      },
    }),

    // 11. Energy Blade (₡190,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Energy Blade',
        weaponType: 'melee',
        baseDamage: 13,  // Reduced from 18 (~28% nerf)
        cooldown: 3, // Adjusted from 2.5 for integer compatibility
        cost: 190000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Energy-infused blade for swift strikes',
        attackSpeedBonus: 5,
        hydraulicSystemsBonus: 4,
        weaponControlBonus: 3,
      },
    }),

    // 12. Laser Rifle (₡195,000) - One-handed energy
    prisma.weapon.create({
      data: {
        name: 'Laser Rifle',
        weaponType: 'energy',
        baseDamage: 15,  // Reduced from 22 (~32% nerf)
        cooldown: 3,
        cost: 195000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Precision energy rifle with excellent accuracy',
        targetingSystemsBonus: 5,
        weaponControlBonus: 4,
        attackSpeedBonus: 3,
        combatPowerBonus: 2,
      },
    }),

    // ===== PREMIUM TIER (₡200K-₡400K) =====
    // 13. Plasma Blade (₡215,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Plasma Blade',
        weaponType: 'melee',
        baseDamage: 14,  // Reduced from 20 (~30% nerf)
        cooldown: 3,  // Adjusted from 2.5 for integer compatibility
        cost: 215000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Energy-enhanced melee blade with rapid strikes',
        hydraulicSystemsBonus: 5,
        attackSpeedBonus: 4,
        criticalSystemsBonus: 3,
        gyroStabilizersBonus: 2,
      },
    }),

    // 14. Plasma Rifle (₡220,000) - One-handed energy
    prisma.weapon.create({
      data: {
        name: 'Plasma Rifle',
        weaponType: 'energy',
        baseDamage: 17,  // Reduced from 24 (~29% nerf)
        cooldown: 3,
        cost: 220000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Advanced energy weapon with high damage output',
        combatPowerBonus: 6,
        targetingSystemsBonus: 4,
        weaponControlBonus: 3,
        powerCoreBonus: -2,
      },
    }),

    // 15. Power Sword (₡280,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Power Sword',
        weaponType: 'melee',
        baseDamage: 20,  // Reduced from 28 (~29% nerf)
        cooldown: 3,
        cost: 280000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'High-tech melee weapon with superior handling',
        hydraulicSystemsBonus: 7,
        counterProtocolsBonus: 5,
        gyroStabilizersBonus: 4,
        combatPowerBonus: 3,
      },
    }),

    // 16. Shotgun (₡215,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Shotgun',
        weaponType: 'ballistic',
        baseDamage: 18,  // Reduced from 22 (v1.2: further nerf due to two-handed dominance)
        cooldown: 4,
        cost: 215000,  // v1.2: Reduced from 325K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'ballistic',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Close-range devastation with wide spread',
        combatPowerBonus: 4,
        criticalSystemsBonus: 3,
        targetingSystemsBonus: -2,
      },
    }),

    // 17. Grenade Launcher (₡235,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Grenade Launcher',
        weaponType: 'ballistic',
        baseDamage: 21,  // Reduced from 25 (v1.2: further nerf due to two-handed dominance)
        cooldown: 5,
        cost: 235000,  // v1.2: Reduced from 325K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'ballistic',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Explosive area damage with arc trajectory',
        combatPowerBonus: 6,
        penetrationBonus: 5,
        criticalSystemsBonus: 4,
        targetingSystemsBonus: -3,
      },
    }),

    // ===== ELITE TIER (₡400K+) =====
    // 18. Sniper Rifle (₡295,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Sniper Rifle',
        weaponType: 'ballistic',
        baseDamage: 29,  // Reduced from 35 (v1.2: further nerf due to two-handed dominance)
        cooldown: 6,
        cost: 295000,  // v1.2: Reduced from 425K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'ballistic',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Long-range precision weapon with high damage',
        targetingSystemsBonus: 8,
        penetrationBonus: 6,
        criticalSystemsBonus: 5,
        attackSpeedBonus: -3,
      },
    }),

    // 19. Battle Axe (₡310,000) - Two-handed melee
    prisma.weapon.create({
      data: {
        name: 'Battle Axe',
        weaponType: 'melee',
        baseDamage: 23,  // Reduced from 27 (v1.2: further nerf due to two-handed dominance)
        cooldown: 4,
        cost: 310000,  // v1.2: Reduced from 430K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'melee',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Brutal melee weapon with devastating power',
        hydraulicSystemsBonus: 6,
        combatPowerBonus: 4,
        criticalSystemsBonus: 3,
        servoMotorsBonus: -2,
      },
    }),

    // 20. Plasma Cannon (₡320,000) - Two-handed energy
    prisma.weapon.create({
      data: {
        name: 'Plasma Cannon',
        weaponType: 'energy',
        baseDamage: 27,  // Reduced from 32 (v1.2: further nerf due to two-handed dominance)
        cooldown: 5,
        cost: 320000,  // v1.2: Reduced from 440K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'energy',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Heavy plasma weapon with devastating firepower',
        combatPowerBonus: 7,
        criticalSystemsBonus: 6,
        penetrationBonus: 4,
        powerCoreBonus: -3,
      },
    }),

    // 21. Heavy Hammer (₡360,000) - Two-handed melee
    prisma.weapon.create({
      data: {
        name: 'Heavy Hammer',
        weaponType: 'melee',
        baseDamage: 29,  // Reduced from 34 (v1.2: further nerf due to two-handed dominance)
        cooldown: 5,
        cost: 360000,  // v1.2: Reduced from 490K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'melee',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Massive impact weapon for maximum damage',
        hydraulicSystemsBonus: 8,
        combatPowerBonus: 7,
        criticalSystemsBonus: 4,
        servoMotorsBonus: -3,
      },
    }),

    // 22. Railgun (₡390,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Railgun',
        weaponType: 'ballistic',
        baseDamage: 33,  // Reduced from 39 (v1.2: further nerf due to two-handed dominance)
        cooldown: 6,
        cost: 390000,  // v1.2: Reduced from 545K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'ballistic',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Ultra-high velocity kinetic weapon with extreme penetration',
        penetrationBonus: 12,
        targetingSystemsBonus: 7,
        combatPowerBonus: 5,
        attackSpeedBonus: -4,
      },
    }),

    // 23. Ion Beam (₡430,000) - Two-handed energy (Highest DPS)
    prisma.weapon.create({
      data: {
        name: 'Ion Beam',
        weaponType: 'energy',
        baseDamage: 24,  // Reduced from 28 (v1.2: further nerf due to two-handed dominance)
        cooldown: 4,
        cost: 430000,  // v1.2: Reduced from 565K to match DPS-based pricing formula
        handsRequired: 'two',
        damageType: 'energy',
        loadoutType: 'two_handed',
        specialProperty: null,
        description: 'Focused energy beam with shield disruption',
        penetrationBonus: 10,
        shieldCapacityBonus: 8,
        attackSpeedBonus: 5,
        targetingSystemsBonus: 4,
      },
    }),
  ]);

  console.log(`✅ Created ${weapons.length} weapons (Complete catalog of 23 weapons)`);
  console.log('   Budget Tier (₡50K-₡100K): 8 weapons');
  console.log('     - Practice Sword (₡50K), Light Shield (₡50K)');
  console.log('     - Machine Pistol (₡75K), Laser Pistol (₡75K)');
  console.log('     - Combat Shield (₡80K), Combat Knife (₡90K)');
  console.log('     - Reactive Shield (₡90K), Machine Gun (₡120K)');
  console.log('   Mid Tier (₡100K-₡200K): 5 weapons');
  console.log('     - Burst Rifle (₡145K), Assault Rifle (₡150K)');
  console.log('     - Energy Blade (₡190K), Laser Rifle (₡195K)');
  console.log('     - Plasma Blade (₡215K)');
  console.log('   Premium Tier (₡200K-₡400K): 10 weapons (including 2 two-handed)');
  console.log('     - Plasma Rifle (₡220K), Power Sword (₡280K)');
  console.log('     - Shotgun (₡215K), Grenade Launcher (₡235K), Sniper Rifle (₡295K)');
  console.log('     - Battle Axe (₡310K), Plasma Cannon (₡320K), Heavy Hammer (₡360K)');
  console.log('   Elite Tier (₡400K+): 1 weapon');
  console.log('     - Railgun (₡390K), Ion Beam (₡430K)');
  console.log('   ✅ All weapons use DPS-inclusive pricing formula');
  console.log('   ✅ v1.2: Two-handed prices reduced 24-34% to match nerfed DPS values');
  console.log('   ✅ Special properties removed (not yet implemented in combat)');
  console.log('   ✅ Complete weapon variety across all loadout types');

  // Find the Practice Sword weapon by name for later use
  const practiceSword = weapons.find((weapon) => weapon.name === 'Practice Sword');
  
  if (!practiceSword) {
    throw new Error('Practice Sword weapon not found in seeded weapons array');
  }

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
        
        // All 23 attributes set to 1.00 via shared defaults
        ...DEFAULT_ROBOT_ATTRIBUTES,
        
        // Combat state (HP formula: 50 + (hullIntegrity × 5) = 50 + (1.00 × 5) = 55)
        currentHP: 55,
        maxHP: 55,
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

  // Create 23 attribute-focused test users for balance testing
  console.log('Creating 23 attribute-focused test users for balance testing...');
  
  // Define all 23 attributes in order by category
  const attributeList = [
    // Combat Systems (6)
    'combatPower',
    'targetingSystems',
    'criticalSystems',
    'penetration',
    'weaponControl',
    'attackSpeed',
    // Defensive Systems (5)
    'armorPlating',
    'shieldCapacity',
    'evasionThrusters',
    'damageDampeners',
    'counterProtocols',
    // Chassis & Mobility (5)
    'hullIntegrity',
    'servoMotors',
    'gyroStabilizers',
    'hydraulicSystems',
    'powerCore',
    // AI Processing (4)
    'combatAlgorithms',
    'threatAnalysis',
    'adaptiveAI',
    'logicCores',
    // Team Coordination (3)
    'syncProtocols',
    'supportSystems',
    'formationTactics',
  ];

  const attributeTestUsers = [];
  
  for (const attribute of attributeList) {
    const username = `test_attr_${attribute.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: testHashedPassword,
        currency: 500000, // ₡500,000 for attribute testing
      },
    });

    // Create Roster Expansion facility at max level (9) to enable 10 robots
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'roster_expansion',
        level: 9, // Max level is 9 for Roster Expansion (enables 10 robots)
        maxLevel: 9,
      },
    });

    // Create 10 robots for this user, each with the focused attribute at 10.0
    const robots = [];
    for (let i = 0; i < 10; i++) {
      const robotName = `${attribute.charAt(0).toUpperCase() + attribute.slice(1)} Bot ${i + 1}`;
      
      // Build attributes object with all at 1.0 except the focused one at 10.0
      const robotAttributes = { ...DEFAULT_ROBOT_ATTRIBUTES };
      robotAttributes[attribute as keyof typeof DEFAULT_ROBOT_ATTRIBUTES] = 10.0;
      
      // Calculate HP and shield based on attributes
      // HP formula: 50 + (hullIntegrity × 5)
      const hullIntegrityValue = robotAttributes.hullIntegrity;
      const maxHP = Math.floor(50 + (hullIntegrityValue * 5));
      const currentHP = maxHP;
      
      // Shield formula: shieldCapacity × 2
      const shieldCapacityValue = robotAttributes.shieldCapacity;
      const maxShield = Math.floor(shieldCapacityValue * 2);
      const currentShield = maxShield;

      // Create weapon inventory entry for Practice Sword
      const weaponInventory = await prisma.weaponInventory.create({
        data: {
          userId: user.id,
          weaponId: practiceSword.id,
        },
      });

      // Create robot
      const robot = await prisma.robot.create({
        data: {
          userId: user.id,
          name: robotName,
          frameId: 1,
          
          // Apply attributes with focused attribute at 10.0
          ...robotAttributes,
          
          // Combat state
          currentHP,
          maxHP,
          currentShield,
          maxShield,
          
          // Performance tracking
          elo: 1200, // Starting ELO
          
          // League
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
          leaguePoints: 0,
          
          // Loadout - single weapon with Practice Sword
          loadoutType: 'single',
          mainWeaponId: weaponInventory.id,
          
          // Stance - balanced as specified
          stance: 'balanced',
          
          // Battle readiness
          battleReadiness: 100,
          yieldThreshold: 10,
        },
      });
      
      robots.push(robot);
    }
    
    attributeTestUsers.push({ user, robots });
    console.log(`   Created ${username} with 10 robots (focused on ${attribute})`);
  }

  console.log(`✅ Created 23 attribute-focused test users with 230 robots total`);
  console.log(`   - Username format: test_attr_<attribute_name>`);
  console.log(`   - Password: testpass123`);
  console.log(`   - Each user has Roster Expansion facility at level 9 (enables 10 robots)`);
  console.log(`   - Each user has 10 robots with focused attribute at 10.0, all others at 1.0`);
  console.log(`   - All robots equipped with Practice Sword (single loadout)`);
  console.log(`   - All robots in balanced stance`);

  // Create weapon loadout test users (14 users with 10 robots each, all stats at 5.00)
  console.log('Creating 14 weapon loadout test users...');
  
  // Find weapons needed for loadout testing
  const machinePistol = weapons.find(w => w.name === 'Machine Pistol');
  const laserPistol = weapons.find(w => w.name === 'Laser Pistol');
  const combatKnife = weapons.find(w => w.name === 'Combat Knife');
  const machineGun = weapons.find(w => w.name === 'Machine Gun');
  const lightShield = weapons.find(w => w.name === 'Light Shield');
  const shotgun = weapons.find(w => w.name === 'Shotgun');
  const assaultRifle = weapons.find(w => w.name === 'Assault Rifle');
  
  if (!machinePistol || !laserPistol || !combatKnife || !machineGun || !lightShield || !shotgun || !assaultRifle) {
    throw new Error('Required weapons not found for loadout testing');
  }

  // Attributes set to 5.00 for all loadout test robots
  const LOADOUT_TEST_ATTRIBUTES = {
    combatPower: 5.0,
    targetingSystems: 5.0,
    criticalSystems: 5.0,
    penetration: 5.0,
    weaponControl: 5.0,
    attackSpeed: 5.0,
    armorPlating: 5.0,
    shieldCapacity: 5.0,
    evasionThrusters: 5.0,
    damageDampeners: 5.0,
    counterProtocols: 5.0,
    hullIntegrity: 5.0,
    servoMotors: 5.0,
    gyroStabilizers: 5.0,
    hydraulicSystems: 5.0,
    powerCore: 5.0,
    combatAlgorithms: 5.0,
    threatAnalysis: 5.0,
    adaptiveAI: 5.0,
    logicCores: 5.0,
    syncProtocols: 5.0,
    supportSystems: 5.0,
    formationTactics: 5.0,
  };

  // Calculate HP and Shield for 5.00 attributes
  // HP formula: 50 + (hullIntegrity × 5) = 50 + (5.00 × 5) = 75
  // Shield formula: shieldCapacity × 2 = 5.00 × 2 = 10
  const loadoutTestMaxHP = 75;
  const loadoutTestMaxShield = 10;

  // Define loadout configurations
  const loadoutConfigs = [
    // Single loadout (4 users)
    { username: 'loadout_machine_pistol_single', loadoutType: 'single', mainWeapon: machinePistol, offhandWeapon: null, displayName: 'MP Single' },
    { username: 'loadout_laser_pistol_single', loadoutType: 'single', mainWeapon: laserPistol, offhandWeapon: null, displayName: 'LP Single' },
    { username: 'loadout_combat_knife_single', loadoutType: 'single', mainWeapon: combatKnife, offhandWeapon: null, displayName: 'CK Single' },
    { username: 'loadout_machine_gun_single', loadoutType: 'single', mainWeapon: machineGun, offhandWeapon: null, displayName: 'MG Single' },
    
    // Weapon + Shield (4 users)
    { username: 'loadout_machine_pistol_shield', loadoutType: 'weapon_shield', mainWeapon: machinePistol, offhandWeapon: lightShield, displayName: 'MP + Shield' },
    { username: 'loadout_laser_pistol_shield', loadoutType: 'weapon_shield', mainWeapon: laserPistol, offhandWeapon: lightShield, displayName: 'LP + Shield' },
    { username: 'loadout_combat_knife_shield', loadoutType: 'weapon_shield', mainWeapon: combatKnife, offhandWeapon: lightShield, displayName: 'CK + Shield' },
    { username: 'loadout_machine_gun_shield', loadoutType: 'weapon_shield', mainWeapon: machineGun, offhandWeapon: lightShield, displayName: 'MG + Shield' },
    
    // Dual-Wield (4 users)
    { username: 'loadout_machine_pistol_dual', loadoutType: 'dual_wield', mainWeapon: machinePistol, offhandWeapon: machinePistol, displayName: 'MP Dual' },
    { username: 'loadout_laser_pistol_dual', loadoutType: 'dual_wield', mainWeapon: laserPistol, offhandWeapon: laserPistol, displayName: 'LP Dual' },
    { username: 'loadout_combat_knife_dual', loadoutType: 'dual_wield', mainWeapon: combatKnife, offhandWeapon: combatKnife, displayName: 'CK Dual' },
    { username: 'loadout_machine_gun_dual', loadoutType: 'dual_wield', mainWeapon: machineGun, offhandWeapon: machineGun, displayName: 'MG Dual' },
    
    // Two-Handed (2 users)
    { username: 'loadout_shotgun_two_handed', loadoutType: 'two_handed', mainWeapon: shotgun, offhandWeapon: null, displayName: 'Shotgun 2H' },
    { username: 'loadout_assault_rifle_two_handed', loadoutType: 'two_handed', mainWeapon: assaultRifle, offhandWeapon: null, displayName: 'Assault Rifle 2H' },
  ];

  const loadoutTestUsers = [];

  for (const config of loadoutConfigs) {
    // Create user
    const user = await prisma.user.create({
      data: {
        username: config.username,
        passwordHash: testHashedPassword,
        currency: 1000000, // ₡1,000,000 for loadout testing
      },
    });

    // Create Roster Expansion facility at max level (9) to enable 10 robots
    await prisma.facility.create({
      data: {
        userId: user.id,
        facilityType: 'roster_expansion',
        level: 9,
        maxLevel: 9,
      },
    });

    // Create weapon inventory entries
    const mainWeaponInventory = await prisma.weaponInventory.create({
      data: {
        userId: user.id,
        weaponId: config.mainWeapon.id,
      },
    });

    let offhandWeaponInventory = null;
    if (config.offhandWeapon) {
      offhandWeaponInventory = await prisma.weaponInventory.create({
        data: {
          userId: user.id,
          weaponId: config.offhandWeapon.id,
        },
      });
    }

    // Create 10 robots for this user
    const robots = [];
    for (let i = 0; i < 10; i++) {
      const robotName = `${config.displayName} Bot ${i + 1}`;

      const robot = await prisma.robot.create({
        data: {
          userId: user.id,
          name: robotName,
          frameId: 1,
          
          // All 23 attributes set to 5.00
          ...LOADOUT_TEST_ATTRIBUTES,
          
          // Combat state
          currentHP: loadoutTestMaxHP,
          maxHP: loadoutTestMaxHP,
          currentShield: loadoutTestMaxShield,
          maxShield: loadoutTestMaxShield,
          
          // Performance tracking
          elo: 1200,
          
          // League
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
          leaguePoints: 0,
          
          // Loadout configuration
          loadoutType: config.loadoutType,
          mainWeaponId: mainWeaponInventory.id,
          offhandWeaponId: offhandWeaponInventory ? offhandWeaponInventory.id : null,
          
          // Stance
          stance: 'balanced',
          
          // Battle readiness
          battleReadiness: 100,
          yieldThreshold: 10,
        },
      });

      robots.push(robot);
    }

    loadoutTestUsers.push({ user, robots });
    console.log(`   Created ${config.username} with 10 robots (${config.displayName})`);
  }

  console.log(`✅ Created 14 weapon loadout test users with 140 robots total`);
  console.log(`   - Username format: loadout_<weapon>_<type>`);
  console.log(`   - Password: testpass123`);
  console.log(`   - Each user has Roster Expansion facility at level 9 (enables 10 robots)`);
  console.log(`   - All robots have ALL 23 attributes set to 5.00`);
  console.log(`   - HP: 75 (50 + 5.00 × 5), Shield: 10 (5.00 × 2)`);
  console.log(`   - Loadouts: 4 single, 4 weapon+shield, 4 dual-wield, 2 two-handed`);
  console.log(`   - All robots in balanced stance with ELO 1200`);

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
      
      // All attributes set to 1.00 via shared defaults
      ...DEFAULT_ROBOT_ATTRIBUTES,
      
      // Combat state (HP formula: 50 + (hullIntegrity × 5) = 50 + (1.00 × 5) = 55)
      currentHP: 55,
      maxHP: 55,
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

  console.log(`✅ Total users created: ${users.length + 1 + attributeTestUsers.length + loadoutTestUsers.length} (including bye-robot user)`);

  console.log('');
  console.log('✅ Database seeded successfully with matchmaking test data!');
  console.log('');
  console.log('📊 System Overview:');
  console.log('   💰 Currency: Credits (₡)');
  console.log('   👤 Admin: ₡10,000,000 (username: admin, password: admin123)');
  console.log('   👤 Player users: ₡2,000,000 each (player1-5, password: password123)');
  console.log('   👤 Test users: ₡100,000 each (test_user_001-100, password: testpass123)');
  console.log('   👤 Attribute test users: ₡500,000 each (test_attr_*, password: testpass123)');
  console.log('   👤 Loadout test users: ₡1,000,000 each (loadout_*, password: testpass123)');
  console.log('   🤖 Robots: 100 test robots + 230 attribute test robots + 140 loadout test robots + 1 bye-robot');
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
  console.log('📝 HP Formula: maxHP = 50 + (hullIntegrity × 5)');
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
  console.log('   - Attribute test users: test_attr_combat_power, test_attr_targeting_systems, etc. / testpass123');
  console.log('   - Loadout test users: loadout_machine_pistol_single, loadout_laser_pistol_shield, etc. / testpass123');
  console.log('');
  console.log('🧪 Attribute Balance Testing:');
  console.log('   - 23 users (one per attribute) with 10 robots each = 230 robots');
  console.log('   - Each user focuses on ONE attribute (set to 10.0, all others at 1.0)');
  console.log('   - Usernames clearly indicate focused attribute (e.g., test_attr_hull_integrity)');
  console.log('   - All robots have Practice Sword, single loadout, balanced stance');
  console.log('   - Roster Expansion facility maxed out (level 9) for each user');
  console.log('');
  console.log('⚔️  Weapon Loadout Testing:');
  console.log('   - 14 users (testing weapon economy) with 10 robots each = 140 robots');
  console.log('   - All robots have ALL 23 attributes set to 5.00 (HP: 75, Shield: 10)');
  console.log('   - Loadout types: 4 single, 4 weapon+shield, 4 dual-wield, 2 two-handed');
  console.log('   - Weapons tested: Machine Pistol, Laser Pistol, Combat Knife, Machine Gun, Light Shield, Shotgun, Assault Rifle');
  console.log('   - Usernames: loadout_<weapon>_<type> (e.g., loadout_machine_pistol_single)');
  console.log('   - Roster Expansion facility maxed out (level 9) for each user');
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
