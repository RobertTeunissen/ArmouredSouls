import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

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

// Archetype definitions (17 variations cycling through 10 base archetypes)
interface ArchetypeSpec {
  name: string;
  username: string;
  currency: number;
  facilities: Array<{ type: string; level: number }>;
  weapons: string[];
  robots: Array<{
    name: string;
    attributes: Record<string, number>;
    hp: number;
    shield: number;
    loadout: string;
    stance: string;
  }>;
}

const ARCHETYPE_SPECS: ArchetypeSpec[] = [
  // 0: Tank Fortress
  {
    name: 'tank_fortress',
    username: 'archetype_tank_fortress',
    currency: 756000,
    facilities: [
      { type: 'defense_training_academy', level: 1 },
      { type: 'combat_training_academy', level: 1 },
    ],
    weapons: ['Power Sword', 'Combat Shield'],
    robots: [{
      name: 'Fortress Prime',
      attributes: {
        hullIntegrity: 15.0,
        armorPlating: 14.0,
        shieldCapacity: 14.0,
        counterProtocols: 12.0,
        combatPower: 12.0,
        damageDampeners: 10.0,
        weaponControl: 10.0,
      },
      hp: 125,
      shield: 28,
      loadout: 'weapon_shield',
      stance: 'defensive',
    }],
  },
  // 1: Glass Cannon A (Plasma Cannon)
  {
    name: 'glass_cannon_a',
    username: 'archetype_glass_cannon_a',
    currency: 946500,
    facilities: [{ type: 'combat_training_academy', level: 1 }],
    weapons: ['Plasma Cannon'],
    robots: [{
      name: 'Glass Cannon A',
      attributes: {
        combatPower: 15.0,
        criticalSystems: 15.0,
        penetration: 14.0,
        weaponControl: 13.0,
        targetingSystems: 12.0,
        hullIntegrity: 10.0,
      },
      hp: 100,
      shield: 2,
      loadout: 'two_handed',
      stance: 'offensive',
    }],
  },
  // 2: Glass Cannon B (Railgun)
  {
    name: 'glass_cannon_b',
    username: 'archetype_glass_cannon_b',
    currency: 996500,
    facilities: [{ type: 'combat_training_academy', level: 1 }],
    weapons: ['Railgun'],
    robots: [{
      name: 'Glass Cannon B',
      attributes: {
        combatPower: 15.0,
        criticalSystems: 15.0,
        penetration: 14.0,
        weaponControl: 13.0,
        targetingSystems: 12.0,
        hullIntegrity: 10.0,
      },
      hp: 100,
      shield: 2,
      loadout: 'two_handed',
      stance: 'offensive',
    }],
  },
  // 3: Glass Cannon C (Heavy Hammer)
  {
    name: 'glass_cannon_c',
    username: 'archetype_glass_cannon_c',
    currency: 1046500,
    facilities: [{ type: 'combat_training_academy', level: 1 }],
    weapons: ['Heavy Hammer'],
    robots: [{
      name: 'Glass Cannon C',
      attributes: {
        combatPower: 15.0,
        criticalSystems: 15.0,
        penetration: 14.0,
        weaponControl: 13.0,
        targetingSystems: 12.0,
        hullIntegrity: 10.0,
      },
      hp: 100,
      shield: 2,
      loadout: 'two_handed',
      stance: 'offensive',
    }],
  },
  // 4: Speed Demon A (Dual Machine Guns)
  {
    name: 'speed_demon_a',
    username: 'archetype_speed_demon_a',
    currency: 66500,
    facilities: [
      { type: 'mobility_training_academy', level: 1 },
      { type: 'combat_training_academy', level: 1 },
    ],
    weapons: ['Machine Gun', 'Machine Gun'],
    robots: [{
      name: 'Velocity Alpha',
      attributes: {
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
      },
      hp: 120,
      shield: 20,
      loadout: 'dual_wield',
      stance: 'offensive',
    }],
  },
  // 5: Speed Demon B (Dual Plasma Blades)
  {
    name: 'speed_demon_b',
    username: 'archetype_speed_demon_b',
    currency: 100000,
    facilities: [
      { type: 'mobility_training_academy', level: 1 },
      { type: 'combat_training_academy', level: 1 },
    ],
    weapons: ['Plasma Blade', 'Plasma Blade'],
    robots: [{
      name: 'Velocity Beta',
      attributes: {
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
      },
      hp: 120,
      shield: 20,
      loadout: 'dual_wield',
      stance: 'offensive',
    }],
  },
  // 6: Speed Demon C (Mixed Loadout)
  {
    name: 'speed_demon_c',
    username: 'archetype_speed_demon_c',
    currency: 31000,
    facilities: [
      { type: 'mobility_training_academy', level: 1 },
      { type: 'combat_training_academy', level: 1 },
    ],
    weapons: ['Machine Gun', 'Plasma Blade'],
    robots: [{
      name: 'Velocity Gamma',
      attributes: {
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
      },
      hp: 120,
      shield: 20,
      loadout: 'dual_wield',
      stance: 'balanced',
    }],
  },
  // 7: Balanced Brawler
  {
    name: 'balanced_brawler',
    username: 'archetype_balanced_brawler',
    currency: 500000,
    facilities: [],
    weapons: ['Power Sword'],
    robots: [{
      name: 'Equilibrium',
      attributes: {
        combatPower: 10.0,
        hullIntegrity: 10.0,
        attackSpeed: 10.0,
        armorPlating: 10.0,
        weaponControl: 10.0,
        servoMotors: 10.0,
        damageDampeners: 10.0,
      },
      hp: 100,
      shield: 2,
      loadout: 'single',
      stance: 'balanced',
    }],
  },
  // 8: Facility Investor
  {
    name: 'facility_investor',
    username: 'archetype_facility_investor',
    currency: 250000,
    facilities: [
      { type: 'income_generator', level: 1 },
      { type: 'repair_bay', level: 1 },
      { type: 'training_facility', level: 1 },
    ],
    weapons: ['Machine Gun'],
    robots: [{
      name: 'Investor One',
      attributes: {
        combatPower: 6.0,
        hullIntegrity: 6.0,
        attackSpeed: 5.0,
        armorPlating: 5.0,
        weaponControl: 5.0,
      },
      hp: 80,
      shield: 2,
      loadout: 'single',
      stance: 'defensive',
    }],
  },
  // 9: Two-Robot Specialist
  {
    name: 'two_robot',
    username: 'archetype_two_robot',
    currency: 200000,
    facilities: [{ type: 'roster_expansion', level: 1 }],
    weapons: ['Plasma Rifle', 'Power Sword', 'Combat Shield'],
    robots: [
      {
        name: 'Specialist Alpha',
        attributes: {
          combatPower: 10.0,
          hullIntegrity: 10.0,
          attackSpeed: 8.0,
          armorPlating: 8.0,
          weaponControl: 8.0,
        },
        hp: 100,
        shield: 2,
        loadout: 'single',
        stance: 'offensive',
      },
      {
        name: 'Specialist Beta',
        attributes: {
          combatPower: 10.0,
          hullIntegrity: 10.0,
          attackSpeed: 8.0,
          armorPlating: 8.0,
          weaponControl: 8.0,
        },
        hp: 100,
        shield: 2,
        loadout: 'weapon_shield',
        stance: 'defensive',
      },
    ],
  },
  // 10: Melee Specialist
  {
    name: 'melee_specialist',
    username: 'archetype_melee_specialist',
    currency: 350000,
    facilities: [{ type: 'combat_training_academy', level: 1 }],
    weapons: ['Heavy Hammer'],
    robots: [{
      name: 'Brawler Prime',
      attributes: {
        combatPower: 15.0,
        hydraulicSystems: 15.0,
        hullIntegrity: 14.0,
        armorPlating: 13.0,
        weaponControl: 12.0,
        criticalSystems: 12.0,
        gyroStabilizers: 11.0,
        servoMotors: 10.0,
      },
      hp: 120,
      shield: 2,
      loadout: 'two_handed',
      stance: 'offensive',
    }],
  },
  // 11: Ranged Sniper
  {
    name: 'ranged_sniper',
    username: 'archetype_ranged_sniper',
    currency: 350000,
    facilities: [{ type: 'combat_training_academy', level: 1 }],
    weapons: ['Railgun'],
    robots: [{
      name: 'Longshot',
      attributes: {
        combatPower: 15.0,
        targetingSystems: 15.0,
        penetration: 14.0,
        criticalSystems: 13.0,
        weaponControl: 12.0,
        hullIntegrity: 12.0,
        armorPlating: 10.0,
      },
      hp: 110,
      shield: 2,
      loadout: 'two_handed',
      stance: 'defensive',
    }],
  },
  // 12: AI Tactician
  {
    name: 'ai_tactician',
    username: 'archetype_ai_tactician',
    currency: 504500,
    facilities: [{ type: 'ai_training_academy', level: 1 }],
    weapons: ['Plasma Rifle'],
    robots: [{
      name: 'Strategist',
      attributes: {
        combatAlgorithms: 15.0,
        threatAnalysis: 15.0,
        adaptiveAI: 15.0,
        logicCores: 15.0,
        combatPower: 12.0,
        hullIntegrity: 12.0,
        attackSpeed: 10.0,
        armorPlating: 10.0,
        weaponControl: 10.0,
      },
      hp: 110,
      shield: 2,
      loadout: 'single',
      stance: 'balanced',
    }],
  },
  // 13: Prestige Rusher
  {
    name: 'prestige_rusher',
    username: 'archetype_prestige_rusher',
    currency: 300500,
    facilities: [
      { type: 'combat_training_academy', level: 1 },
      { type: 'defense_training_academy', level: 1 },
      { type: 'mobility_training_academy', level: 1 },
    ],
    weapons: ['Plasma Cannon'],
    robots: [{
      name: 'Prestige Hunter',
      attributes: {
        combatPower: 15.0,
        hullIntegrity: 15.0,
        attackSpeed: 15.0,
        armorPlating: 15.0,
        weaponControl: 15.0,
        criticalSystems: 12.0,
        penetration: 10.0,
      },
      hp: 125,
      shield: 2,
      loadout: 'two_handed',
      stance: 'offensive',
    }],
  },
  // Archetypes repeat after 14 variations
];

const TOTAL_ARCHETYPES = ARCHETYPE_SPECS.length; // 14 variations

/**
 * Generate battle-ready users following archetype patterns.
 * 
 * This function creates users that cycle through all 14 archetype variations.
 * Each cycle creates N users where N is the cycle number:
 * - Cycle 1: 1 user (Tank Fortress)
 * - Cycle 2: 2 users (Glass Cannon A, Glass Cannon B)
 * - Cycle 3: 3 users (Glass Cannon C, Speed Demon A, Speed Demon B)
 * - etc.
 * 
 * The archetype position wraps around after 14 variations, ensuring even
 * distribution of all archetypes over time.
 * 
 * @param cycleNumber - The current cycle number (determines how many users to create)
 * @returns Summary of users and robots created
 */
export async function generateBattleReadyUsers(cycleNumber: number): Promise<{
  usersCreated: number;
  robotsCreated: number;
  usernames: string[];
}> {
  const startTime = Date.now();
  const count = cycleNumber; // Cycle N creates N users
  console.log(`[UserGeneration] Generating ${count} archetype users for Cycle ${cycleNumber}...`);

  // Calculate starting archetype position based on previous cycles
  // Total users created in previous cycles = sum(1 to cycleNumber-1) = (cycleNumber-1) * cycleNumber / 2
  const previousCyclesTotal = (cycleNumber - 1) * cycleNumber / 2;
  let archetypePosition = previousCyclesTotal % TOTAL_ARCHETYPES; // Wrap around after 14 variations

  const usernames: string[] = [];
  let totalRobotsCreated = 0;

  // Generate each user with archetype-specific configuration
  for (let i = 0; i < count; i++) {
    try {
      const archetype = ARCHETYPE_SPECS[archetypePosition % TOTAL_ARCHETYPES];
      const username = `${archetype.username}_${cycleNumber}`;

      console.log(`[UserGeneration] Creating user ${i + 1}/${count}: ${username} (archetype: ${archetype.name})`);

      // Use transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Create user
        const hashedPassword = await bcrypt.hash('testpass123', 10);
        const user = await tx.user.create({
          data: {
            username,
            passwordHash: hashedPassword,
            currency: archetype.currency,
            role: 'user',
          },
        });

        // Create facilities
        for (const facility of archetype.facilities) {
          await tx.facility.create({
            data: {
              userId: user.id,
              facilityType: facility.type,
              level: facility.level,
              maxLevel: 10,
            },
          });
        }

        // Get unique weapon names from the archetype's weapon list
        const uniqueWeaponNames = [...new Set(archetype.weapons)];
        
        // Get weapons from database
        const weaponRecords = await tx.weapon.findMany({
          where: { name: { in: uniqueWeaponNames } },
        });

        if (weaponRecords.length !== uniqueWeaponNames.length) {
          throw new Error(`Missing weapons for archetype ${archetype.name}. Expected ${uniqueWeaponNames.length} unique weapons, found ${weaponRecords.length}`);
        }

        // Create a map of weapon name to weapon record for easy lookup
        const weaponMap = new Map(weaponRecords.map(w => [w.name, w]));

        // Create weapon inventory entries (one for each weapon in the list, including duplicates)
        const weaponInventories = [];
        for (const weaponName of archetype.weapons) {
          const weaponRecord = weaponMap.get(weaponName);
          if (!weaponRecord) {
            throw new Error(`Weapon ${weaponName} not found in database`);
          }
          
          const inv = await tx.weaponInventory.create({
            data: {
              userId: user.id,
              weaponId: weaponRecord.id,
            },
          });
          weaponInventories.push(inv);
        }

        // Create robots
        for (let robotIndex = 0; robotIndex < archetype.robots.length; robotIndex++) {
          const robotSpec = archetype.robots[robotIndex];
          
          // Format robot name with cycle number
          const robotName = `${robotSpec.name} C${String(cycleNumber).padStart(3, '0')}`;

          // Prepare attributes (merge defaults with archetype-specific values)
          const attributes = { ...DEFAULT_ROBOT_ATTRIBUTES, ...robotSpec.attributes };

          // Determine weapon assignments based on loadout type
          let mainWeaponId = weaponInventories[0]?.id;
          let offhandWeaponId = null;

          if (robotSpec.loadout === 'weapon_shield') {
            // First weapon is main, second is shield
            mainWeaponId = weaponInventories[0]?.id;
            offhandWeaponId = weaponInventories[1]?.id;
          } else if (robotSpec.loadout === 'dual_wield') {
            // First weapon is main, second is offhand
            mainWeaponId = weaponInventories[0]?.id;
            offhandWeaponId = weaponInventories[1]?.id;
          } else if (robotSpec.loadout === 'two_handed' || robotSpec.loadout === 'single') {
            // Only main weapon
            mainWeaponId = weaponInventories[robotIndex]?.id || weaponInventories[0]?.id;
          }

          // Create robot
          await tx.robot.create({
            data: {
              userId: user.id,
              name: robotName,
              frameId: 1,
              ...attributes,
              currentHP: robotSpec.hp,
              maxHP: robotSpec.hp,
              currentShield: robotSpec.shield,
              maxShield: robotSpec.shield,
              elo: 1200,
              currentLeague: 'bronze',
              leagueId: 'bronze_1',
              leaguePoints: 0,
              loadoutType: robotSpec.loadout,
              mainWeaponId,
              offhandWeaponId,
              stance: robotSpec.stance,
              battleReadiness: 100,
              yieldThreshold: 10,
            },
          });

          totalRobotsCreated++;
        }
      });

      usernames.push(username);
      archetypePosition++; // Move to next archetype

      // Log progress
      if ((i + 1) % 5 === 0 || i + 1 === count) {
        console.log(`[UserGeneration] Created ${i + 1}/${count} users...`);
      }
    } catch (error) {
      console.error(`[UserGeneration] Error creating user ${i + 1}:`, error);
      throw error; // Fail fast if any user creation fails
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[UserGeneration] ✅ Created ${count} users with ${totalRobotsCreated} robots in ${duration}ms`);
  console.log(`[UserGeneration] Archetype position after this cycle: ${archetypePosition % TOTAL_ARCHETYPES}`);

  return {
    usersCreated: count,
    robotsCreated: totalRobotsCreated,
    usernames,
  };
}
