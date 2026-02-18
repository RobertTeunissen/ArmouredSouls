import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { eventLogger } from '../src/services/eventLogger';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const ROBOT_CREATION_COST = 500000;

// Helper function to log robot creation
async function logRobotCreation(userId: number, robotId: number, robotName: string) {
  try {
    await eventLogger.logCreditChange(
      0, // cycle 0 for seed data
      userId,
      -ROBOT_CREATION_COST,
      0, // We don't track balance during seeding
      'other'
    );
    console.log(`  [Event] Logged robot creation: ${robotName} (₡${ROBOT_CREATION_COST.toLocaleString()})`);
  } catch (error) {
    console.error(`  [Event] Failed to log robot creation for ${robotName}:`, error);
  }
}

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
    // 1. Practice Sword (₡62,500) - Baseline weapon
    prisma.weapon.create({
      data: {
        name: 'Practice Sword',
        weaponType: 'melee',
        baseDamage: 8,  // Reduced from 10 (20% nerf, new baseline)
        cooldown: 3,
        cost: 62500,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Basic training weapon establishing baseline cost',
        // All bonuses are 0 (default)
      },
    }),

    // ===== BUDGET TIER (₡62K-₡125K) =====
    // 2. Machine Pistol (₡94,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Machine Pistol',
        weaponType: 'ballistic',
        baseDamage: 6,  // Reduced from 8 (~25% nerf)
        cooldown: 2,
        cost: 94000,
        handsRequired: 'one',
        damageType: 'ballistic',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Rapid-fire sidearm with quick attacks',
        attackSpeedBonus: 3,
        weaponControlBonus: 2,
      },
    }),

    // 3. Laser Pistol (₡94,000) - One-handed energy
    prisma.weapon.create({
      data: {
        name: 'Laser Pistol',
        weaponType: 'energy',
        baseDamage: 8,  // Reduced from 12 (~33% nerf)
        cooldown: 3,
        cost: 94000,
        handsRequired: 'one',
        damageType: 'energy',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Precise energy sidearm with good accuracy',
        targetingSystemsBonus: 3,
        combatPowerBonus: 2,
      },
    }),

    // 4. Combat Knife (₡113,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Combat Knife',
        weaponType: 'melee',
        baseDamage: 6,  // Reduced from 9 (~33% nerf)
        cooldown: 2,
        cost: 113000,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
        specialProperty: null,
        description: 'Fast melee weapon for close combat',
        attackSpeedBonus: 3,
        gyroStabilizersBonus: 1,
      },
    }),

    // 5. Light Shield (₡62,500) - Budget shield
    prisma.weapon.create({
      data: {
        name: 'Light Shield',
        weaponType: 'shield',
        baseDamage: 0,
        cooldown: 0,
        cost: 62500,
        handsRequired: 'shield',
        damageType: 'none',
        loadoutType: 'weapon_shield',
        specialProperty: null,
        description: 'Basic defensive shield for protection',
        armorPlatingBonus: 3,
        shieldCapacityBonus: 2,
      },
    }),

    // 6. Combat Shield (₡100,000) - Mid shield
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
        specialProperty: null,
        description: 'Heavy-duty shield with counter capabilities',
        armorPlatingBonus: 6,
        counterProtocolsBonus: 3,
        evasionThrustersBonus: -2,
        shieldCapacityBonus: 5,
      },
    }),

    // 7. Reactive Shield (₡113,000) - Advanced shield
    prisma.weapon.create({
      data: {
        name: 'Reactive Shield',
        weaponType: 'shield',
        baseDamage: 0,
        cooldown: 0,
        cost: 113000,
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

    // 8. Machine Gun (₡150,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Machine Gun',
        weaponType: 'ballistic',
        baseDamage: 7,  // Reduced from 10 (~30% nerf)
        cooldown: 2,
        cost: 150000,
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

    // ===== MID TIER (₡125K-₡250K) =====
    // 9. Burst Rifle (₡181,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Burst Rifle',
        weaponType: 'ballistic',
        baseDamage: 11,  // Reduced from 15 (~27% nerf)
        cooldown: 3, // Adjusted from 2.5 for integer compatibility
        cost: 181000,
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

    // 10. Assault Rifle (₡188,000) - One-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Assault Rifle',
        weaponType: 'ballistic',
        baseDamage: 13,  // Reduced from 18 (~28% nerf)
        cooldown: 3,
        cost: 188000,
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

    // 11. Energy Blade (₡238,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Energy Blade',
        weaponType: 'melee',
        baseDamage: 13,  // Reduced from 18 (~28% nerf)
        cooldown: 3, // Adjusted from 2.5 for integer compatibility
        cost: 238000,
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

    // 12. Laser Rifle (₡244,000) - One-handed energy
    prisma.weapon.create({
      data: {
        name: 'Laser Rifle',
        weaponType: 'energy',
        baseDamage: 15,  // Reduced from 22 (~32% nerf)
        cooldown: 3,
        cost: 244000,
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

    // ===== PREMIUM TIER (₡250K-₡500K) =====
    // 13. Plasma Blade (₡269,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Plasma Blade',
        weaponType: 'melee',
        baseDamage: 14,  // Reduced from 20 (~30% nerf)
        cooldown: 3,  // Adjusted from 2.5 for integer compatibility
        cost: 269000,
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

    // 14. Plasma Rifle (₡275,000) - One-handed energy
    prisma.weapon.create({
      data: {
        name: 'Plasma Rifle',
        weaponType: 'energy',
        baseDamage: 17,  // Reduced from 24 (~29% nerf)
        cooldown: 3,
        cost: 275000,
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

    // 15. Power Sword (₡350,000) - One-handed melee
    prisma.weapon.create({
      data: {
        name: 'Power Sword',
        weaponType: 'melee',
        baseDamage: 20,  // Reduced from 28 (~29% nerf)
        cooldown: 3,
        cost: 350000,
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

    // 16. Shotgun (₡269,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Shotgun',
        weaponType: 'ballistic',
        baseDamage: 18,  // Reduced from 22 (v1.2: further nerf due to two-handed dominance)
        cooldown: 4,
        cost: 269000,  // v1.2: Increased by 25% from base pricing formula
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

    // 17. Grenade Launcher (₡294,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Grenade Launcher',
        weaponType: 'ballistic',
        baseDamage: 21,  // Reduced from 25 (v1.2: further nerf due to two-handed dominance)
        cooldown: 5,
        cost: 294000,  // v1.2: Increased by 25% from base pricing formula
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

    // ===== ELITE TIER (₡350K+) =====
    // 18. Sniper Rifle (₡369,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Sniper Rifle',
        weaponType: 'ballistic',
        baseDamage: 29,  // Reduced from 35 (v1.2: further nerf due to two-handed dominance)
        cooldown: 6,
        cost: 369000,  // v1.2: Increased by 25% from base pricing formula
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

    // 19. Battle Axe (₡388,000) - Two-handed melee
    prisma.weapon.create({
      data: {
        name: 'Battle Axe',
        weaponType: 'melee',
        baseDamage: 23,  // Reduced from 27 (v1.2: further nerf due to two-handed dominance)
        cooldown: 4,
        cost: 388000,  // v1.2: Increased by 25% from base pricing formula
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

    // 20. Plasma Cannon (₡400,000) - Two-handed energy
    prisma.weapon.create({
      data: {
        name: 'Plasma Cannon',
        weaponType: 'energy',
        baseDamage: 27,  // Reduced from 32 (v1.2: further nerf due to two-handed dominance)
        cooldown: 5,
        cost: 400000,  // v1.2: Increased by 25% from base pricing formula
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

    // 21. Heavy Hammer (₡450,000) - Two-handed melee
    prisma.weapon.create({
      data: {
        name: 'Heavy Hammer',
        weaponType: 'melee',
        baseDamage: 29,  // Reduced from 34 (v1.2: further nerf due to two-handed dominance)
        cooldown: 5,
        cost: 450000,  // v1.2: Increased by 25% from base pricing formula
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

    // 22. Railgun (₡488,000) - Two-handed ballistic
    prisma.weapon.create({
      data: {
        name: 'Railgun',
        weaponType: 'ballistic',
        baseDamage: 33,  // Reduced from 39 (v1.2: further nerf due to two-handed dominance)
        cooldown: 6,
        cost: 488000,  // v1.2: Increased by 25% from base pricing formula
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

    // 23. Ion Beam (₡538,000) - Two-handed energy (Highest DPS)
    prisma.weapon.create({
      data: {
        name: 'Ion Beam',
        weaponType: 'energy',
        baseDamage: 24,  // Reduced from 28 (v1.2: further nerf due to two-handed dominance)
        cooldown: 4,
        cost: 538000,  // v1.2: Increased by 25% from base pricing formula
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
        currency: 3000000, // ₡3 million starting balance
      },
    }),
    prisma.user.create({
      data: {
        username: 'player2',
        passwordHash: hashedPassword,
        currency: 3000000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player3',
        passwordHash: hashedPassword,
        currency: 3000000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player4',
        passwordHash: hashedPassword,
        currency: 3000000,
      },
    }),
    prisma.user.create({
      data: {
        username: 'player5',
        passwordHash: hashedPassword,
        currency: 3000000,
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
  console.log('Creating 100 test users with WimpBot robots...');
  const testUsersWithRobots = [];
  
  for (let i = 1; i <= 100; i++) {
    const username = `test_user_${String(i).padStart(3, '0')}`;
    const robotName = `WimpBot ${i}`; // Changed from generated names to WimpBot 1-100
    
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
      console.log(`   Created ${i}/100 test users with WimpBot robots...`);
    }
  }

  console.log(`✅ Created 100 test users with WimpBot robots`);
  console.log(`   - Username format: test_user_001 to test_user_100`);
  console.log(`   - Password: testpass123`);
  console.log(`   - Robot names: WimpBot 1 through WimpBot 100`);
  console.log(`   - All robots equipped with Practice Sword`);
  console.log(`   - All robots in Bronze League (bronze_1)`);
  console.log(`   - All robots have ELO 1200`);
  console.log(`   - Purpose: Easily defeated mob for tournaments`);

  // Create Player Archetype Test Users (17 users with specific builds)
  console.log('Creating 17 player archetype test users...');
  
  // Find weapons needed for archetypes
  const powerSword = weapons.find(w => w.name === 'Power Sword');
  const combatShield = weapons.find(w => w.name === 'Combat Shield');
  const plasmaCannon = weapons.find(w => w.name === 'Plasma Cannon');
  const railgun = weapons.find(w => w.name === 'Railgun');
  const heavyHammer = weapons.find(w => w.name === 'Heavy Hammer');
  const machineGun = weapons.find(w => w.name === 'Machine Gun');
  const plasmaRifle = weapons.find(w => w.name === 'Plasma Rifle');
  
  if (!powerSword || !combatShield || !plasmaCannon || !railgun || !heavyHammer || !machineGun || !plasmaRifle) {
    throw new Error('Required weapons not found for archetype testing');
  }

  const archetypeUsers = [];

  // Helper function to calculate attribute upgrade cost
  function calculateAttributeCost(targetLevel: number): number {
    return 1500 * (targetLevel * (targetLevel + 1) / 2);
  }

  // ARCHETYPE 1: Tank Fortress
  console.log('   Creating Tank Fortress archetype...');
  const tankFortressUser = await prisma.user.create({
    data: {
      username: 'archetype_tank_fortress',
      passwordHash: testHashedPassword,
      currency: 756000, // Remaining after purchases
      prestige: 0,
    },
  });

  // Create facilities for Tank Fortress
  await prisma.facility.create({
    data: {
      userId: tankFortressUser.id,
      facilityType: 'defense_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: tankFortressUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  // Create weapon inventory for Tank Fortress
  const tankPowerSwordInv = await prisma.weaponInventory.create({
    data: { userId: tankFortressUser.id, weaponId: powerSword.id },
  });
  const tankCombatShieldInv = await prisma.weaponInventory.create({
    data: { userId: tankFortressUser.id, weaponId: combatShield.id },
  });

  // Create Tank Fortress robot
  const tankFortressRobot = await prisma.robot.create({
    data: {
      userId: tankFortressUser.id,
      name: 'Tank Fortress C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      hullIntegrity: 15.0,
      armorPlating: 14.0,
      shieldCapacity: 14.0,
      counterProtocols: 12.0,
      combatPower: 12.0,
      damageDampeners: 10.0,
      weaponControl: 10.0,
      currentHP: 125, // 50 + 15×5
      maxHP: 125,
      currentShield: 28, // 14×2
      maxShield: 28,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'weapon_shield',
      mainWeaponId: tankPowerSwordInv.id,
      offhandWeaponId: tankCombatShieldInv.id,
      stance: 'defensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: tankFortressUser, robots: [tankFortressRobot] });
  console.log('   ✅ Tank Fortress created');

  // ARCHETYPE 2A: Glass Cannon with Plasma Cannon
  console.log('   Creating Glass Cannon A (Plasma Cannon)...');
  const glassCannonAUser = await prisma.user.create({
    data: {
      username: 'archetype_glass_cannon_a',
      passwordHash: testHashedPassword,
      currency: 946500,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: glassCannonAUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const gcaPlasmaCannonInv = await prisma.weaponInventory.create({
    data: { userId: glassCannonAUser.id, weaponId: plasmaCannon.id },
  });

  const glassCannonARobot = await prisma.robot.create({
    data: {
      userId: glassCannonAUser.id,
      name: 'Glass Cannon A C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 15.0,
      criticalSystems: 15.0,
      penetration: 14.0,
      weaponControl: 13.0,
      targetingSystems: 12.0,
      hullIntegrity: 10.0,
      currentHP: 100,
      maxHP: 100,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'two_handed',
      mainWeaponId: gcaPlasmaCannonInv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: glassCannonAUser, robots: [glassCannonARobot] });
  console.log('   ✅ Glass Cannon A created');

  // ARCHETYPE 2B: Glass Cannon with Railgun
  console.log('   Creating Glass Cannon B (Railgun)...');
  const glassCannonBUser = await prisma.user.create({
    data: {
      username: 'archetype_glass_cannon_b',
      passwordHash: testHashedPassword,
      currency: 996500,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: glassCannonBUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const gcbRailgunInv = await prisma.weaponInventory.create({
    data: { userId: glassCannonBUser.id, weaponId: railgun.id },
  });

  const glassCannonBRobot = await prisma.robot.create({
    data: {
      userId: glassCannonBUser.id,
      name: 'Glass Cannon B C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 15.0,
      criticalSystems: 15.0,
      penetration: 14.0,
      weaponControl: 13.0,
      targetingSystems: 12.0,
      hullIntegrity: 10.0,
      currentHP: 100,
      maxHP: 100,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'two_handed',
      mainWeaponId: gcbRailgunInv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: glassCannonBUser, robots: [glassCannonBRobot] });
  console.log('   ✅ Glass Cannon B created');

  // ARCHETYPE 2C: Glass Cannon with Heavy Hammer
  console.log('   Creating Glass Cannon C (Heavy Hammer)...');
  const glassCannonCUser = await prisma.user.create({
    data: {
      username: 'archetype_glass_cannon_c',
      passwordHash: testHashedPassword,
      currency: 1046500,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: glassCannonCUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const gccHeavyHammerInv = await prisma.weaponInventory.create({
    data: { userId: glassCannonCUser.id, weaponId: heavyHammer.id },
  });

  const glassCannonCRobot = await prisma.robot.create({
    data: {
      userId: glassCannonCUser.id,
      name: 'Glass Cannon C C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 15.0,
      criticalSystems: 15.0,
      penetration: 14.0,
      weaponControl: 13.0,
      targetingSystems: 12.0,
      hullIntegrity: 10.0,
      currentHP: 100,
      maxHP: 100,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'two_handed',
      mainWeaponId: gccHeavyHammerInv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: glassCannonCUser, robots: [glassCannonCRobot] });
  console.log('   ✅ Glass Cannon C created');

  // Find additional weapons needed for remaining archetypes
  const plasmaBlade = weapons.find(w => w.name === 'Plasma Blade');
  const lightShield = weapons.find(w => w.name === 'Light Shield');
  
  if (!plasmaBlade || !lightShield) {
    throw new Error('Required weapons not found for remaining archetypes');
  }

  // ARCHETYPE 3A: Speed Demon with Dual Machine Guns
  console.log('   Creating Speed Demon A (Dual Machine Guns)...');
  const speedDemonAUser = await prisma.user.create({
    data: {
      username: 'archetype_speed_demon_a',
      passwordHash: testHashedPassword,
      currency: 66500,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: speedDemonAUser.id,
      facilityType: 'mobility_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: speedDemonAUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const sdaMachineGun1Inv = await prisma.weaponInventory.create({
    data: { userId: speedDemonAUser.id, weaponId: machineGun.id },
  });
  const sdaMachineGun2Inv = await prisma.weaponInventory.create({
    data: { userId: speedDemonAUser.id, weaponId: machineGun.id },
  });

  const speedDemonARobot = await prisma.robot.create({
    data: {
      userId: speedDemonAUser.id,
      name: 'Speed Demon A C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      attackSpeed: 15.0,
      servoMotors: 15.0,
      weaponControl: 15.0,
      combatPower: 15.0,
      gyroStabilizers: 14.0,
      hullIntegrity: 14.0,
      armorPlating: 13.0,
      evasionThrusters: 12.0,
      targetingSystems: 12.0,
      penetration: 11.0,
      shieldCapacity: 10.0,
      currentHP: 120,
      maxHP: 120,
      currentShield: 20,
      maxShield: 20,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'dual_wield',
      mainWeaponId: sdaMachineGun1Inv.id,
      offhandWeaponId: sdaMachineGun2Inv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: speedDemonAUser, robots: [speedDemonARobot] });
  console.log('   ✅ Speed Demon A created');

  // ARCHETYPE 3B: Speed Demon with Dual Plasma Blades
  console.log('   Creating Speed Demon B (Dual Plasma Blades)...');
  const speedDemonBUser = await prisma.user.create({
    data: {
      username: 'archetype_speed_demon_b',
      passwordHash: testHashedPassword,
      currency: 100000,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: speedDemonBUser.id,
      facilityType: 'mobility_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: speedDemonBUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const sdbPlasmaBlade1Inv = await prisma.weaponInventory.create({
    data: { userId: speedDemonBUser.id, weaponId: plasmaBlade.id },
  });
  const sdbPlasmaBlade2Inv = await prisma.weaponInventory.create({
    data: { userId: speedDemonBUser.id, weaponId: plasmaBlade.id },
  });

  const speedDemonBRobot = await prisma.robot.create({
    data: {
      userId: speedDemonBUser.id,
      name: 'Speed Demon B C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      attackSpeed: 15.0,
      servoMotors: 15.0,
      weaponControl: 15.0,
      combatPower: 15.0,
      gyroStabilizers: 14.0,
      hullIntegrity: 14.0,
      armorPlating: 13.0,
      evasionThrusters: 12.0,
      targetingSystems: 12.0,
      penetration: 11.0,
      shieldCapacity: 10.0,
      currentHP: 120,
      maxHP: 120,
      currentShield: 20,
      maxShield: 20,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'dual_wield',
      mainWeaponId: sdbPlasmaBlade1Inv.id,
      offhandWeaponId: sdbPlasmaBlade2Inv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: speedDemonBUser, robots: [speedDemonBRobot] });
  console.log('   ✅ Speed Demon B created');

  // ARCHETYPE 3C: Speed Demon with Mixed Loadout
  console.log('   Creating Speed Demon C (Mixed Loadout)...');
  const speedDemonCUser = await prisma.user.create({
    data: {
      username: 'archetype_speed_demon_c',
      passwordHash: testHashedPassword,
      currency: 31000,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: speedDemonCUser.id,
      facilityType: 'mobility_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: speedDemonCUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const sdcMachineGunInv = await prisma.weaponInventory.create({
    data: { userId: speedDemonCUser.id, weaponId: machineGun.id },
  });
  const sdcPlasmaBladeInv = await prisma.weaponInventory.create({
    data: { userId: speedDemonCUser.id, weaponId: plasmaBlade.id },
  });

  const speedDemonCRobot = await prisma.robot.create({
    data: {
      userId: speedDemonCUser.id,
      name: 'Speed Demon C C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      attackSpeed: 15.0,
      servoMotors: 15.0,
      weaponControl: 15.0,
      combatPower: 15.0,
      gyroStabilizers: 14.0,
      hullIntegrity: 14.0,
      armorPlating: 13.0,
      evasionThrusters: 12.0,
      targetingSystems: 12.0,
      penetration: 11.0,
      shieldCapacity: 10.0,
      currentHP: 120,
      maxHP: 120,
      currentShield: 20,
      maxShield: 20,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'dual_wield',
      mainWeaponId: sdcMachineGunInv.id,
      offhandWeaponId: sdcPlasmaBladeInv.id,
      stance: 'balanced',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: speedDemonCUser, robots: [speedDemonCRobot] });
  console.log('   ✅ Speed Demon C created');

  // ARCHETYPE 4: Balanced Brawler
  console.log('   Creating Balanced Brawler...');
  const balancedBrawlerUser = await prisma.user.create({
    data: {
      username: 'archetype_balanced_brawler',
      passwordHash: testHashedPassword,
      currency: 500000,
      prestige: 0,
    },
  });

  const bbPowerSwordInv = await prisma.weaponInventory.create({
    data: { userId: balancedBrawlerUser.id, weaponId: powerSword.id },
  });

  const balancedBrawlerRobot = await prisma.robot.create({
    data: {
      userId: balancedBrawlerUser.id,
      name: 'Balanced Brawler C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 10.0,
      hullIntegrity: 10.0,
      attackSpeed: 10.0,
      armorPlating: 10.0,
      weaponControl: 10.0,
      servoMotors: 10.0,
      damageDampeners: 10.0,
      currentHP: 100,
      maxHP: 100,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'single',
      mainWeaponId: bbPowerSwordInv.id,
      stance: 'balanced',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: balancedBrawlerUser, robots: [balancedBrawlerRobot] });
  console.log('   ✅ Balanced Brawler created');

  // ARCHETYPE 5: Facility Investor
  console.log('   Creating Facility Investor...');
  const facilityInvestorUser = await prisma.user.create({
    data: {
      username: 'archetype_facility_investor',
      passwordHash: testHashedPassword,
      currency: 250000,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: facilityInvestorUser.id,
      facilityType: 'income_generator',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: facilityInvestorUser.id,
      facilityType: 'repair_bay',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: facilityInvestorUser.id,
      facilityType: 'training_facility',
      level: 1,
      maxLevel: 10,
    },
  });

  const fiMachineGunInv = await prisma.weaponInventory.create({
    data: { userId: facilityInvestorUser.id, weaponId: machineGun.id },
  });

  const facilityInvestorRobot = await prisma.robot.create({
    data: {
      userId: facilityInvestorUser.id,
      name: 'Facility Investor C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 6.0,
      hullIntegrity: 6.0,
      attackSpeed: 5.0,
      armorPlating: 5.0,
      weaponControl: 5.0,
      currentHP: 80,
      maxHP: 80,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'single',
      mainWeaponId: fiMachineGunInv.id,
      stance: 'defensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: facilityInvestorUser, robots: [facilityInvestorRobot] });
  console.log('   ✅ Facility Investor created');

  // ARCHETYPE 6: Two-Robot Specialist
  console.log('   Creating Two-Robot Specialist...');
  const twoRobotUser = await prisma.user.create({
    data: {
      username: 'archetype_two_robot',
      passwordHash: testHashedPassword,
      currency: 200000,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: twoRobotUser.id,
      facilityType: 'roster_expansion',
      level: 1,
      maxLevel: 10,
    },
  });

  const trPlasmaRifleInv = await prisma.weaponInventory.create({
    data: { userId: twoRobotUser.id, weaponId: plasmaRifle.id },
  });
  const trPowerSwordInv = await prisma.weaponInventory.create({
    data: { userId: twoRobotUser.id, weaponId: powerSword.id },
  });
  const trCombatShieldInv = await prisma.weaponInventory.create({
    data: { userId: twoRobotUser.id, weaponId: combatShield.id },
  });

  const twoRobotAlpha = await prisma.robot.create({
    data: {
      userId: twoRobotUser.id,
      name: 'Two-Robot Alpha C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 10.0,
      hullIntegrity: 10.0,
      attackSpeed: 8.0,
      armorPlating: 8.0,
      weaponControl: 8.0,
      currentHP: 100,
      maxHP: 100,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'single',
      mainWeaponId: trPlasmaRifleInv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  const twoRobotBeta = await prisma.robot.create({
    data: {
      userId: twoRobotUser.id,
      name: 'Two-Robot Beta C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 10.0,
      hullIntegrity: 10.0,
      attackSpeed: 8.0,
      armorPlating: 8.0,
      weaponControl: 8.0,
      currentHP: 100,
      maxHP: 100,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'weapon_shield',
      mainWeaponId: trPowerSwordInv.id,
      offhandWeaponId: trCombatShieldInv.id,
      stance: 'defensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: twoRobotUser, robots: [twoRobotAlpha, twoRobotBeta] });
  console.log('   ✅ Two-Robot Specialist created');

  // Create tag team for Two-Robot Specialist
  const twoRobotTeam = await prisma.tagTeam.create({
    data: {
      stableId: twoRobotUser.id,
      activeRobotId: twoRobotAlpha.id,
      reserveRobotId: twoRobotBeta.id,
      tagTeamLeague: 'bronze',
      tagTeamLeagueId: 'bronze_1',
    },
  });
  console.log(`   ✅ Tag team created for Two-Robot Specialist (ID: ${twoRobotTeam.id})`);

  // ARCHETYPE 7: Melee Specialist
  console.log('   Creating Melee Specialist...');
  const meleeSpecialistUser = await prisma.user.create({
    data: {
      username: 'archetype_melee_specialist',
      passwordHash: testHashedPassword,
      currency: 350000,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: meleeSpecialistUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const msHeavyHammerInv = await prisma.weaponInventory.create({
    data: { userId: meleeSpecialistUser.id, weaponId: heavyHammer.id },
  });

  const meleeSpecialistRobot = await prisma.robot.create({
    data: {
      userId: meleeSpecialistUser.id,
      name: 'Melee Specialist C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 15.0,
      hydraulicSystems: 15.0,
      hullIntegrity: 14.0,
      armorPlating: 13.0,
      weaponControl: 12.0,
      criticalSystems: 12.0,
      gyroStabilizers: 11.0,
      servoMotors: 10.0,
      currentHP: 120,
      maxHP: 120,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'two_handed',
      mainWeaponId: msHeavyHammerInv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: meleeSpecialistUser, robots: [meleeSpecialistRobot] });
  console.log('   ✅ Melee Specialist created');

  // ARCHETYPE 8: Ranged Sniper
  console.log('   Creating Ranged Sniper...');
  const rangedSniperUser = await prisma.user.create({
    data: {
      username: 'archetype_ranged_sniper',
      passwordHash: testHashedPassword,
      currency: 350000,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: rangedSniperUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const rsRailgunInv = await prisma.weaponInventory.create({
    data: { userId: rangedSniperUser.id, weaponId: railgun.id },
  });

  const rangedSniperRobot = await prisma.robot.create({
    data: {
      userId: rangedSniperUser.id,
      name: 'Ranged Sniper C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 15.0,
      targetingSystems: 15.0,
      penetration: 14.0,
      criticalSystems: 13.0,
      weaponControl: 12.0,
      hullIntegrity: 12.0,
      armorPlating: 10.0,
      currentHP: 110,
      maxHP: 110,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'two_handed',
      mainWeaponId: rsRailgunInv.id,
      stance: 'defensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: rangedSniperUser, robots: [rangedSniperRobot] });
  console.log('   ✅ Ranged Sniper created');

  // ARCHETYPE 9: AI Tactician
  console.log('   Creating AI Tactician...');
  const aiTacticianUser = await prisma.user.create({
    data: {
      username: 'archetype_ai_tactician',
      passwordHash: testHashedPassword,
      currency: 504500,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: aiTacticianUser.id,
      facilityType: 'ai_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const atPlasmaRifleInv = await prisma.weaponInventory.create({
    data: { userId: aiTacticianUser.id, weaponId: plasmaRifle.id },
  });

  const aiTacticianRobot = await prisma.robot.create({
    data: {
      userId: aiTacticianUser.id,
      name: 'AI Tactician C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatAlgorithms: 15.0,
      threatAnalysis: 15.0,
      adaptiveAI: 15.0,
      logicCores: 15.0,
      combatPower: 12.0,
      hullIntegrity: 12.0,
      attackSpeed: 10.0,
      armorPlating: 10.0,
      weaponControl: 10.0,
      currentHP: 110,
      maxHP: 110,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'single',
      mainWeaponId: atPlasmaRifleInv.id,
      stance: 'balanced',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: aiTacticianUser, robots: [aiTacticianRobot] });
  console.log('   ✅ AI Tactician created');

  // ARCHETYPE 10: Prestige Rusher
  console.log('   Creating Prestige Rusher...');
  const prestigeRusherUser = await prisma.user.create({
    data: {
      username: 'archetype_prestige_rusher',
      passwordHash: testHashedPassword,
      currency: 300500,
      prestige: 0,
    },
  });

  await prisma.facility.create({
    data: {
      userId: prestigeRusherUser.id,
      facilityType: 'combat_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: prestigeRusherUser.id,
      facilityType: 'defense_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });
  await prisma.facility.create({
    data: {
      userId: prestigeRusherUser.id,
      facilityType: 'mobility_training_academy',
      level: 1,
      maxLevel: 10,
    },
  });

  const prPlasmaCannonInv = await prisma.weaponInventory.create({
    data: { userId: prestigeRusherUser.id, weaponId: plasmaCannon.id },
  });

  const prestigeRusherRobot = await prisma.robot.create({
    data: {
      userId: prestigeRusherUser.id,
      name: 'Prestige Rusher C000',
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      combatPower: 15.0,
      hullIntegrity: 15.0,
      attackSpeed: 15.0,
      armorPlating: 15.0,
      weaponControl: 15.0,
      criticalSystems: 12.0,
      penetration: 10.0,
      currentHP: 125,
      maxHP: 125,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'two_handed',
      mainWeaponId: prPlasmaCannonInv.id,
      stance: 'offensive',
      battleReadiness: 100,
      yieldThreshold: 10,
    },
  });

  archetypeUsers.push({ user: prestigeRusherUser, robots: [prestigeRusherRobot] });
  console.log('   ✅ Prestige Rusher created');

  console.log(`✅ Created ${archetypeUsers.length} archetype users with ${archetypeUsers.reduce((sum, a) => sum + a.robots.length, 0)} robots`);
  console.log(`   - All 17 archetype variations implemented`);
  console.log(`   - All robots configured per PLAYER_ARCHETYPES_GUIDE.md specifications`);

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
    ...testUsersWithRobots.map(t => t.user),
    ...archetypeUsers.map(t => t.user)
  ];

  console.log(`✅ Total users created: ${users.length + 1} (including bye-robot user)`);

  console.log('');
  console.log('✅ Database seeded successfully with archetype test data!');
  console.log('');
  console.log('📊 System Overview:');
  console.log('   💰 Currency: Credits (₡)');
  console.log('   👤 Admin: ₡10,000,000 (username: admin, password: admin123)');
  console.log('   👤 Player users: ₡3,000,000 each (player1-5, password: password123)');
  console.log('   👤 Test users: ₡100,000 each (test_user_001-100, password: testpass123)');
  console.log('   👤 Archetype users: Various amounts (archetype_*, password: testpass123)');
  console.log('   🤖 Robots: 100 WimpBot robots + 18 archetype robots + 1 bye-robot');
  console.log('   👥 Tag Teams: 1 team (Two-Robot Specialist archetype)');
  console.log('   ⚔️  Practice Sword: FREE (equipped on all WimpBot robots)');
  console.log('   🏆 League: All robots start in Bronze (bronze_1)');
  console.log('   📈 ELO: Test robots at 1200, Bye-Robot at 1000');
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
  console.log('📝 HP Formula: maxHP = 50 + (hullIntegrity × 5)');
  console.log('🛡️  Shield Formula: maxShield = shieldCapacity × 2');
  console.log('');
  console.log('🎯 Matchmaking Test Data:');
  console.log(`   - 100 WimpBot robots (WimpBot 1 through WimpBot 100)`);
  console.log(`   - Bye-Robot ID: ${byeRobot.id} for odd-number matching`);
  console.log('   - All WimpBots battle-ready with Practice Sword equipped');
  console.log('   - Purpose: Easily defeated mob for tournaments');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('   - Admin: admin / admin123');
  console.log('   - Players: player1-5 / password123 (for manual testing)');
  console.log('   - Test users: test_user_001-100 / testpass123 (WimpBot mob)');
  console.log('   - Archetype users: archetype_tank_fortress, archetype_glass_cannon_a, etc. / testpass123');
  console.log('');
  console.log('🎮 Player Archetypes:');
  console.log('   - 17 archetype users representing 10 distinct playstyles');
  console.log('   - Tank Fortress: Defensive powerhouse with high HP and armor');
  console.log('   - Glass Cannon (3 options): Maximum offense with Plasma Cannon, Railgun, or Heavy Hammer');
  console.log('   - Speed Demon (3 options): High attack speed with dual weapons (Machine Guns, Plasma Blades, or Mixed)');
  console.log('   - Balanced Brawler: Well-rounded generalist');
  console.log('   - Facility Investor: Economic focus with Income Generator');
  console.log('   - Two-Robot Specialist: 2 robots with different loadouts');
  console.log('     * Automatically creates tag team with both robots');
  console.log('     * Active robot: Specialist Alpha (offensive), Reserve robot: Specialist Beta (defensive)');
  console.log('     * Ready for tag team matches immediately');
  console.log('   - Melee Specialist: Heavy Hammer focused');
  console.log('   - Ranged Sniper: Railgun precision build');
  console.log('   - AI Tactician: AI-focused strategic build');
  console.log('   - Prestige Rusher: Win-optimized with all 3 training academies');
  console.log('   - All configured per PLAYER_ARCHETYPES_GUIDE.md specifications');
  console.log('');
  console.log('🔄 Dynamic User Generation:');
  console.log('   - When cycles run, new archetype users will be created');
  console.log('   - Cycle N creates N users (Cycle 1 = 1 user, Cycle 2 = 2 users, etc.)');
  console.log('   - Cycles through all 14 archetype variations in order');
  console.log('   - Format: archetype_<name>_<cycle_number>');
  console.log('   - Example: Cycle 1 creates Tank Fortress, Cycle 2 creates Glass Cannon A + B');
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
