import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const ROBOT_CREATION_COST = 500000;

// ===== ENVIRONMENT DETECTION =====
type SeedMode = 'development' | 'acceptance' | 'production';

export function getSeedMode(): SeedMode {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'acceptance') return 'acceptance';
  return 'development';
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

// ===== WEAPON DEFINITIONS =====
// All weapon data defined as a constant array for idempotent upsert-by-name
export const WEAPON_DEFINITIONS = [
  {
    name: 'Practice Sword',
    weaponType: 'melee',
    baseDamage: 8,
    cooldown: 3,
    cost: 62500,
    handsRequired: 'one',
    damageType: 'melee',
    loadoutType: 'single',
    specialProperty: null,
    description: 'Basic training weapon establishing baseline cost',
  },
  {
    name: 'Machine Pistol',
    weaponType: 'ballistic',
    baseDamage: 6,
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
  {
    name: 'Laser Pistol',
    weaponType: 'energy',
    baseDamage: 8,
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
  {
    name: 'Combat Knife',
    weaponType: 'melee',
    baseDamage: 6,
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
  {
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
  {
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
  {
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
  {
    name: 'Machine Gun',
    weaponType: 'ballistic',
    baseDamage: 7,
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
  {
    name: 'Burst Rifle',
    weaponType: 'ballistic',
    baseDamage: 11,
    cooldown: 3,
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
  {
    name: 'Assault Rifle',
    weaponType: 'ballistic',
    baseDamage: 13,
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
  {
    name: 'Energy Blade',
    weaponType: 'melee',
    baseDamage: 13,
    cooldown: 3,
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
  {
    name: 'Laser Rifle',
    weaponType: 'energy',
    baseDamage: 15,
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
  {
    name: 'Plasma Blade',
    weaponType: 'melee',
    baseDamage: 14,
    cooldown: 3,
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
  {
    name: 'Plasma Rifle',
    weaponType: 'energy',
    baseDamage: 17,
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
  {
    name: 'Power Sword',
    weaponType: 'melee',
    baseDamage: 20,
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
  {
    name: 'Shotgun',
    weaponType: 'ballistic',
    baseDamage: 18,
    cooldown: 4,
    cost: 269000,
    handsRequired: 'two',
    damageType: 'ballistic',
    loadoutType: 'two_handed',
    specialProperty: null,
    description: 'Close-range devastation with wide spread',
    combatPowerBonus: 4,
    criticalSystemsBonus: 3,
    targetingSystemsBonus: -2,
  },
  {
    name: 'Grenade Launcher',
    weaponType: 'ballistic',
    baseDamage: 21,
    cooldown: 5,
    cost: 294000,
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
  {
    name: 'Sniper Rifle',
    weaponType: 'ballistic',
    baseDamage: 29,
    cooldown: 6,
    cost: 369000,
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
  {
    name: 'Battle Axe',
    weaponType: 'melee',
    baseDamage: 23,
    cooldown: 4,
    cost: 388000,
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
  {
    name: 'Plasma Cannon',
    weaponType: 'energy',
    baseDamage: 27,
    cooldown: 5,
    cost: 400000,
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
  {
    name: 'Heavy Hammer',
    weaponType: 'melee',
    baseDamage: 29,
    cooldown: 5,
    cost: 450000,
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
  {
    name: 'Railgun',
    weaponType: 'ballistic',
    baseDamage: 33,
    cooldown: 6,
    cost: 488000,
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
  {
    name: 'Ion Beam',
    weaponType: 'energy',
    baseDamage: 24,
    cooldown: 4,
    cost: 538000,
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
] as const;

// ===== IDEMPOTENT HELPERS =====

/**
 * Upsert a weapon by name. Since Weapon.name is not a unique constraint in the schema,
 * we use findFirst + create/update pattern.
 */
export async function upsertWeapon(data: Record<string, unknown>) {
  const existing = await prisma.weapon.findFirst({ where: { name: data.name as string } });
  if (existing) {
    return prisma.weapon.update({ where: { id: existing.id }, data });
  }
  return prisma.weapon.create({ data: data as any });
}

/**
 * Upsert a user by username (unique constraint exists).
 */
export async function upsertUser(data: { username: string; passwordHash: string; role?: string; currency?: number; prestige?: number }) {
  return prisma.user.upsert({
    where: { username: data.username },
    update: {
      passwordHash: data.passwordHash,
      role: data.role || 'user',
      currency: data.currency ?? 0,
      prestige: data.prestige ?? 0,
    },
    create: data,
  });
}

/**
 * Ensure a weapon inventory entry exists for a user+weapon combo.
 * Returns the existing or newly created entry.
 */
async function ensureWeaponInventory(userId: number, weaponId: number) {
  const existing = await prisma.weaponInventory.findFirst({
    where: { userId, weaponId },
  });
  if (existing) return existing;
  return prisma.weaponInventory.create({ data: { userId, weaponId } });
}

/**
 * Upsert a robot by userId+name (unique constraint exists).
 */
export async function upsertRobot(data: Record<string, unknown>) {
  const userId = data.userId as number;
  const name = data.name as string;
  const existing = await prisma.robot.findFirst({ where: { userId, name } });
  if (existing) {
    return prisma.robot.update({ where: { id: existing.id }, data });
  }
  return prisma.robot.create({ data: data as any });
}

// ===== SEED FUNCTIONS =====

/** Seeds weapons — required in ALL environments */
async function seedWeapons() {
  console.log('Creating weapons...');
  const weapons = [];
  for (const def of WEAPON_DEFINITIONS) {
    const weapon = await upsertWeapon({ ...def });
    weapons.push(weapon);
  }
  console.log(`✅ Upserted ${weapons.length} weapons (idempotent)`);
  return weapons;
}

/** Seeds cycle metadata — required in ALL environments */
async function seedCycleMetadata() {
  console.log('Initializing cycle metadata...');
  await prisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: {}, // Don't overwrite existing cycle counts
    create: { id: 1, totalCycles: 0 },
  });
  console.log('✅ Cycle metadata initialized (idempotent)\n');
}

/** Seeds the bye-robot user and robot — required in ALL environments */
async function seedByeRobot(practiceSword: { id: number }) {
  console.log('Creating Bye-Robot...');
  const byeUser = await upsertUser({
    username: 'bye_robot_user',
    passwordHash: await bcrypt.hash('testpass123', 10),
    currency: 0,
    prestige: 0,
  });

  const byeWeaponInv = await ensureWeaponInventory(byeUser.id, practiceSword.id);

  const byeRobot = await upsertRobot({
    userId: byeUser.id,
    name: 'Bye Robot',
    frameId: 1,
    ...DEFAULT_ROBOT_ATTRIBUTES,
    currentHP: 55,
    maxHP: 55,
    currentShield: 2,
    maxShield: 2,
    elo: 1000,
    currentLeague: 'bronze',
    leagueId: 'bronze_bye',
    leaguePoints: 0,
    loadoutType: 'single',
    mainWeaponId: byeWeaponInv.id,
    stance: 'balanced',
    battleReadiness: 100,
    yieldThreshold: 0,
  });

  console.log(`✅ Bye-Robot upserted (ELO: 1000, ID: ${byeRobot.id})`);
  return { byeUser, byeRobot };
}

/** Seeds admin + player1-5 test users — acceptance & development only */
async function seedCoreTestUsers(practiceSword: { id: number }) {
  console.log('Creating test users (admin + player1-5)...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await upsertUser({
    username: 'admin',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'admin',
    currency: 10000000,
    prestige: 50000,
  });
  console.log('✅ Admin user upserted');

  const playerUsers = [];
  for (let i = 1; i <= 5; i++) {
    const user = await upsertUser({
      username: `player${i}`,
      passwordHash: hashedPassword,
      currency: 3000000,
    });
    playerUsers.push(user);
  }
  console.log('✅ Player1-5 users upserted (password: password123)');

  return { adminUser, playerUsers };
}

/** Seeds 100 WimpBot test users — development only */
async function seedWimpBotUsers(practiceSword: { id: number }) {
  console.log('Creating 100 test users with WimpBot robots...');
  const testHashedPassword = await bcrypt.hash('testpass123', 10);

  for (let i = 1; i <= 100; i++) {
    const username = `test_user_${String(i).padStart(3, '0')}`;
    const robotName = `WimpBot ${i}`;

    const user = await upsertUser({
      username,
      passwordHash: testHashedPassword,
      currency: 100000,
    });

    const weaponInv = await ensureWeaponInventory(user.id, practiceSword.id);

    await upsertRobot({
      userId: user.id,
      name: robotName,
      frameId: 1,
      ...DEFAULT_ROBOT_ATTRIBUTES,
      currentHP: 55,
      maxHP: 55,
      currentShield: 2,
      maxShield: 2,
      elo: 1200,
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      loadoutType: 'single',
      mainWeaponId: weaponInv.id,
      stance: 'balanced',
      battleReadiness: 100,
      yieldThreshold: 10,
    });

    if (i % 10 === 0) {
      console.log(`   Created ${i}/100 test users with WimpBot robots...`);
    }
  }

  console.log('✅ 100 WimpBot test users upserted');
}

/** Seeds 230 attribute test users — development only */
async function seedAttributeTestUsers(practiceSword: { id: number }) {
  console.log('Creating 230 attribute test users (10 per attribute × 23 attributes)...');
  const testHashedPassword = await bcrypt.hash('testpass123', 10);

  const ATTRIBUTE_NAMES = [
    'combatPower', 'targetingSystems', 'criticalSystems', 'penetration', 'weaponControl', 'attackSpeed',
    'armorPlating', 'shieldCapacity', 'evasionThrusters', 'damageDampeners', 'counterProtocols',
    'hullIntegrity', 'servoMotors', 'gyroStabilizers', 'hydraulicSystems', 'powerCore',
    'combatAlgorithms', 'threatAnalysis', 'adaptiveAI', 'logicCores',
    'syncProtocols', 'supportSystems', 'formationTactics',
  ] as const;

  const ATTRIBUTE_LABELS: Record<string, string> = {
    combatPower: 'CombatPwr', targetingSystems: 'Targeting', criticalSystems: 'CritSys',
    penetration: 'Penetratn', weaponControl: 'WeaponCtl', attackSpeed: 'AtkSpeed',
    armorPlating: 'ArmorPlat', shieldCapacity: 'ShieldCap', evasionThrusters: 'Evasion',
    damageDampeners: 'DmgDampen', counterProtocols: 'CounterPr', hullIntegrity: 'HullInteg',
    servoMotors: 'ServoMtr', gyroStabilizers: 'GyroStab', hydraulicSystems: 'Hydraulic',
    powerCore: 'PowerCore', combatAlgorithms: 'CombatAlg', threatAnalysis: 'ThreatAnl',
    adaptiveAI: 'AdaptAI', logicCores: 'LogicCore', syncProtocols: 'SyncProto',
    supportSystems: 'SupportSy', formationTactics: 'FormTacti',
  };

  let count = 0;
  for (const attr of ATTRIBUTE_NAMES) {
    const label = ATTRIBUTE_LABELS[attr];

    for (let i = 1; i <= 10; i++) {
      const username = `attr_${label}_${String(i).padStart(2, '0')}`.toLowerCase();
      const robotName = `${label}-Bot-${String(i).padStart(2, '0')}`;

      const user = await upsertUser({
        username,
        passwordHash: testHashedPassword,
        currency: 100000,
      });

      const weaponInv = await ensureWeaponInventory(user.id, practiceSword.id);

      const robotAttrs = { ...DEFAULT_ROBOT_ATTRIBUTES, [attr]: 25.0 };
      const hullVal = attr === 'hullIntegrity' ? 25.0 : 1.0;
      const shieldVal = attr === 'shieldCapacity' ? 25.0 : 1.0;
      const maxHP = 50 + Math.floor(hullVal * 5);
      const maxShield = Math.floor(shieldVal * 2);

      await upsertRobot({
        userId: user.id,
        name: robotName,
        frameId: 1,
        ...robotAttrs,
        currentHP: maxHP,
        maxHP,
        currentShield: maxShield,
        maxShield,
        elo: 1200,
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        loadoutType: 'single',
        mainWeaponId: weaponInv.id,
        stance: 'balanced',
        battleReadiness: 100,
        yieldThreshold: 10,
      });

      count++;
    }

    console.log(`   ✅ Upserted 10 ${label} test users (attr: ${attr} = 25)`);
  }

  console.log(`✅ ${count} attribute test users upserted`);
}

// ===== MAIN =====

async function main() {
  const seedMode = getSeedMode();
  console.log(`🌱 Seeding database in ${seedMode.toUpperCase()} mode...`);
  console.log(`   NODE_ENV=${process.env.NODE_ENV || '(not set, defaulting to development)'}\n`);

  // --- Essential data (ALL environments) ---
  await seedCycleMetadata();
  const weapons = await seedWeapons();

  const practiceSword = weapons.find((w) => w.name === 'Practice Sword');
  if (!practiceSword) {
    throw new Error('Practice Sword weapon not found in seeded weapons array');
  }

  // Bye-Robot is essential game data (needed for odd-number matchmaking)
  await seedByeRobot(practiceSword);

  // --- Acceptance data (acceptance + development) ---
  if (seedMode === 'acceptance' || seedMode === 'development') {
    await seedCoreTestUsers(practiceSword);
  }

  // --- Full test data (development + acceptance) ---
  if (seedMode === 'development' || seedMode === 'acceptance') {
    await seedWimpBotUsers(practiceSword);
  }

  // --- Attribute test users (development only) ---
  if (seedMode === 'development') {
    await seedAttributeTestUsers(practiceSword);
  }

  // --- Summary ---
  console.log('');
  console.log(`✅ Database seeded successfully in ${seedMode.toUpperCase()} mode!`);
  console.log('');

  if (seedMode === 'production') {
    console.log('📊 Production seed summary:');
    console.log(`   ⚔️  ${weapons.length} weapons`);
    console.log('   🔄 Cycle metadata initialized');
    console.log('   🤖 Bye-Robot for matchmaking');
    console.log('   ❌ No test users seeded');
  } else if (seedMode === 'acceptance') {
    console.log('📊 Acceptance seed summary:');
    console.log(`   ⚔️  ${weapons.length} weapons`);
    console.log('   🔄 Cycle metadata initialized');
    console.log('   🤖 Bye-Robot for matchmaking');
    console.log('   👤 Admin + player1-5 test accounts');
    console.log('   👤 100 WimpBot test users');
    console.log('   ❌ No attribute test users');
  } else {
    console.log('📊 Development seed summary:');
    console.log(`   ⚔️  ${weapons.length} weapons`);
    console.log('   🔄 Cycle metadata initialized');
    console.log('   🤖 Bye-Robot for matchmaking');
    console.log('   👤 Admin + player1-5 test accounts');
    console.log('   👤 100 WimpBot test users');
    console.log('   👤 230 attribute test users');
  }

  console.log('');
  console.log('🔐 Login Credentials (if seeded):');
  if (seedMode !== 'production') {
    console.log('   - Admin: admin / admin123');
    console.log('   - Players: player1-5 / password123');
  }
  if (seedMode === 'development' || seedMode === 'acceptance') {
    console.log('   - Test users: test_user_001-100 / testpass123');
  }
  if (seedMode === 'development') {
    console.log('   - Attribute test: attr_combatpwr_01, etc. / testpass123');
  }
  console.log('');
}

// Only run main() when executed directly (not when imported for testing)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Error seeding database:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
