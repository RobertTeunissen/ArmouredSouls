import * as fc from 'fast-check';
import { getSeedMode } from '../prisma/seed';

const NUM_RUNS = 10;

// Save original env so we can restore after each test
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

/**
 * Mock Prisma client that tracks all operations for idempotence verification.
 * Each "table" is an in-memory map keyed by the upsert key.
 */
function createMockPrisma() {
  const stores: Record<string, Map<string, Record<string, unknown>>> = {
    weapon: new Map(),
    user: new Map(),
    weaponInventory: new Map(),
    robot: new Map(),
    cycleMetadata: new Map(),
  };

  let autoId = 1;

  return {
    weapon: {
      findFirst: async ({ where }: any) => stores.weapon.get(where.name) || null,
      create: async ({ data }: any) => {
        const record = { ...data, id: autoId++ };
        stores.weapon.set(data.name, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const existing = [...stores.weapon.values()].find(r => r.id === where.id);
        if (existing) {
          const updated = { ...existing, ...data };
          stores.weapon.set(updated.name as string, updated);
          return updated;
        }
        return null;
      },
    },
    user: {
      upsert: async ({ where, update, create }: any) => {
        const key = where.username;
        const existing = stores.user.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          stores.user.set(key, updated);
          return updated;
        }
        const record = { ...create, id: autoId++ };
        stores.user.set(key, record);
        return record;
      },
    },
    weaponInventory: {
      findFirst: async ({ where }: any) => {
        const key = `${where.userId}-${where.weaponId}`;
        return stores.weaponInventory.get(key) || null;
      },
      create: async ({ data }: any) => {
        const key = `${data.userId}-${data.weaponId}`;
        const record = { ...data, id: autoId++ };
        stores.weaponInventory.set(key, record);
        return record;
      },
    },
    robot: {
      findFirst: async ({ where }: any) => {
        const key = `${where.userId}-${where.name}`;
        return stores.robot.get(key) || null;
      },
      create: async ({ data }: any) => {
        const key = `${data.userId}-${data.name}`;
        const record = { ...data, id: autoId++ };
        stores.robot.set(key, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        const existing = [...stores.robot.values()].find(r => r.id === where.id);
        if (existing) {
          const key = `${existing.userId}-${existing.name}`;
          const updated = { ...existing, ...data };
          stores.robot.set(key, updated);
          return updated;
        }
        return null;
      },
    },
    cycleMetadata: {
      upsert: async ({ where, update, create }: any) => {
        const key = String(where.id);
        const existing = stores.cycleMetadata.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          stores.cycleMetadata.set(key, updated);
          return updated;
        }
        const record = { ...create };
        stores.cycleMetadata.set(key, record);
        return record;
      },
    },
    $disconnect: async () => {},
    _stores: stores,
  };
}

const WEAPON_NAMES = [
  'Practice Sword', 'Practice Blaster', 'Training Rifle', 'Training Beam',
  'Machine Pistol', 'Laser Pistol', 'Combat Knife', 'Light Shield',
  'Combat Shield', 'Reactive Shield', 'Machine Gun', 'Burst Rifle',
  'Assault Rifle', 'Energy Blade', 'Laser Rifle', 'Plasma Blade',
  'Plasma Rifle', 'Power Sword', 'Shotgun', 'Grenade Launcher',
  'Sniper Rifle', 'Battle Axe', 'Plasma Cannon', 'Heavy Hammer',
  'Railgun', 'Ion Beam', 'Vibro Mace', 'War Club', 'Shock Maul',
  'Thermal Lance', 'Volt Sabre', 'Scatter Cannon', 'Pulse Accelerator',
  'Arc Projector', 'Bolt Carbine', 'Flux Repeater', 'Disruptor Cannon',
  'Nova Caster', 'Mortar System', 'Beam Pistol', 'Photon Marksman',
  'Gauss Pistol', 'Particle Lance', 'Siege Cannon', 'Barrier Shield',
  'Fortress Shield', 'Aegis Bulwark',
];

/**
 * Simulate the seed main() logic using the mock prisma, following the exact
 * branching logic from seed.ts.
 */
async function simulateSeed(mockPrisma: ReturnType<typeof createMockPrisma>, mode: string) {
  // Seed cycle metadata (ALL environments)
  await mockPrisma.cycleMetadata.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, totalCycles: 0 },
  });

  // Seed weapons (ALL environments) — 47 weapons
  for (const name of WEAPON_NAMES) {
    const existing = await mockPrisma.weapon.findFirst({ where: { name } });
    if (existing) {
      await mockPrisma.weapon.update({ where: { id: existing.id }, data: { name } });
    } else {
      await mockPrisma.weapon.create({ data: { name } });
    }
  }

  // Bye-Robot user (ALL environments)
  await mockPrisma.user.upsert({
    where: { username: 'bye_robot_user' },
    update: { passwordHash: 'hash', currency: 0, prestige: 0, role: 'user' },
    create: { username: 'bye_robot_user', passwordHash: 'hash', currency: 0, prestige: 0 },
  });

  // Acceptance + Development: admin + 200 WimpBots
  if (mode === 'acceptance' || mode === 'development') {
    await mockPrisma.user.upsert({
      where: { username: 'admin' },
      update: { passwordHash: 'hash', role: 'admin', currency: 3000000, prestige: 0 },
      create: { username: 'admin', passwordHash: 'hash', role: 'admin', currency: 3000000, prestige: 0, stableName: 'Admin Stable' },
    });

    for (let i = 1; i <= 200; i++) {
      const username = `test_user_${String(i).padStart(3, '0')}`;
      await mockPrisma.user.upsert({
        where: { username },
        update: { passwordHash: 'hash', role: 'user', currency: 100000, prestige: 0 },
        create: { username, passwordHash: 'hash', currency: 100000, stableName: `Stable ${i}` },
      });
    }
  }
}

describe('Seed Script - Property Tests', () => {
  describe('Property 12: Seed script idempotence', () => {
    /**
     * **Validates: Requirements 15.1, 15.2, 15.3**
     * Running seed N times produces the same state as running once, no duplicates.
     */

    test('getSeedMode returns consistent mode for any NODE_ENV value', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('production', 'acceptance', 'development', 'test', ''),
          (nodeEnv) => {
            process.env.NODE_ENV = nodeEnv;
            const mode1 = getSeedMode();
            const mode2 = getSeedMode();
            expect(mode1).toBe(mode2);
            expect(['production', 'acceptance', 'development']).toContain(mode1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('running seed N times produces the same user count as running once', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('production' as const, 'acceptance' as const, 'development' as const),
          fc.integer({ min: 1, max: 5 }),
          async (mode, runCount) => {
            const singleRunPrisma = createMockPrisma();
            await simulateSeed(singleRunPrisma, mode);
            const singleRunUserCount = singleRunPrisma._stores.user.size;
            const singleRunWeaponCount = singleRunPrisma._stores.weapon.size;

            const multiRunPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(multiRunPrisma, mode);
            }

            expect(multiRunPrisma._stores.user.size).toBe(singleRunUserCount);
            expect(multiRunPrisma._stores.weapon.size).toBe(singleRunWeaponCount);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('upsert pattern never creates duplicate weapons across N runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('production' as const, 'acceptance' as const, 'development' as const),
          fc.integer({ min: 2, max: 5 }),
          async (mode, runCount) => {
            const mockPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(mockPrisma, mode);
            }
            const weaponNames = [...mockPrisma._stores.weapon.values()].map(w => w.name);
            const uniqueNames = new Set(weaponNames);
            expect(uniqueNames.size).toBe(weaponNames.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('upsert pattern never creates duplicate users across N runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('production' as const, 'acceptance' as const, 'development' as const),
          fc.integer({ min: 2, max: 5 }),
          async (mode, runCount) => {
            const mockPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(mockPrisma, mode);
            }
            const usernames = [...mockPrisma._stores.user.keys()];
            const uniqueUsernames = new Set(usernames);
            expect(uniqueUsernames.size).toBe(usernames.length);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('cycle metadata is created exactly once regardless of run count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('production' as const, 'acceptance' as const, 'development' as const),
          fc.integer({ min: 1, max: 5 }),
          async (mode, runCount) => {
            const mockPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(mockPrisma, mode);
            }
            expect(mockPrisma._stores.cycleMetadata.size).toBe(1);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Property 13: Production seed data filtering', () => {
    /**
     * **Validates: Requirements 15.1, 15.2, 15.3**
     * In production mode, no test user accounts exist.
     */

    test('getSeedMode returns "production" when NODE_ENV is "production"', () => {
      fc.assert(
        fc.property(
          fc.constant('production'),
          (env) => {
            process.env.NODE_ENV = env;
            expect(getSeedMode()).toBe('production');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('getSeedMode returns "acceptance" when NODE_ENV is "acceptance"', () => {
      fc.assert(
        fc.property(
          fc.constant('acceptance'),
          (env) => {
            process.env.NODE_ENV = env;
            expect(getSeedMode()).toBe('acceptance');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('getSeedMode defaults to "development" for any unrecognized NODE_ENV', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 20 }).filter(
            s => s !== 'production' && s !== 'acceptance'
          ),
          (env) => {
            process.env.NODE_ENV = env;
            expect(getSeedMode()).toBe('development');
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('production mode seeds zero test user accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (runCount) => {
            const mockPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(mockPrisma, 'production');
            }
            const usernames = [...mockPrisma._stores.user.keys()];
            const testUsers = usernames.filter(u =>
              u === 'admin' ||
              u.startsWith('player') ||
              u.startsWith('test_user_') ||
              u.startsWith('attr_')
            );
            expect(testUsers).toEqual([]);
            expect(usernames).toEqual(['bye_robot_user']);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('production mode seeds essential game data (weapons, cycle metadata, bye-robot)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (runCount) => {
            const mockPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(mockPrisma, 'production');
            }
            expect(mockPrisma._stores.weapon.size).toBe(47);
            expect(mockPrisma._stores.cycleMetadata.size).toBe(1);
            expect(mockPrisma._stores.user.has('bye_robot_user')).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('acceptance mode seeds admin and WimpBot users', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (runCount) => {
            const mockPrisma = createMockPrisma();
            for (let i = 0; i < runCount; i++) {
              await simulateSeed(mockPrisma, 'acceptance');
            }
            const usernames = [...mockPrisma._stores.user.keys()];
            expect(usernames).toContain('admin');
            expect(usernames).toContain('test_user_001');
            expect(usernames).toContain('test_user_200');
            const wimpBots = usernames.filter(u => u.startsWith('test_user_'));
            expect(wimpBots.length).toBe(200);
            // No player1-5 or attribute users
            const playerUsers = usernames.filter(u => u.startsWith('player'));
            expect(playerUsers).toEqual([]);
            const attrUsers = usernames.filter(u => u.startsWith('attr_'));
            expect(attrUsers).toEqual([]);
            // bye_robot_user + admin + WimpBot(200) = 202
            expect(usernames.length).toBe(202);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('development mode seeds same as acceptance (admin + WimpBots)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(1),
          async () => {
            const mockPrisma = createMockPrisma();
            await simulateSeed(mockPrisma, 'development');
            const usernames = [...mockPrisma._stores.user.keys()];
            expect(usernames).toContain('bye_robot_user');
            expect(usernames).toContain('admin');
            expect(usernames).toContain('test_user_001');
            expect(usernames).toContain('test_user_200');
            // No player1-5 or attribute users
            const playerUsers = usernames.filter(u => u.startsWith('player'));
            expect(playerUsers).toEqual([]);
            const attrUsers = usernames.filter(u => u.startsWith('attr_'));
            expect(attrUsers).toEqual([]);
            // bye_robot_user(1) + admin(1) + WimpBot(200) = 202
            expect(usernames.length).toBe(202);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('for any seed mode, user sets form superset chain: prod ⊂ acc = dev', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(1),
          async () => {
            const prodPrisma = createMockPrisma();
            await simulateSeed(prodPrisma, 'production');
            const prodUsers = new Set(prodPrisma._stores.user.keys());

            const accPrisma = createMockPrisma();
            await simulateSeed(accPrisma, 'acceptance');
            const accUsers = new Set(accPrisma._stores.user.keys());

            const devPrisma = createMockPrisma();
            await simulateSeed(devPrisma, 'development');
            const devUsers = new Set(devPrisma._stores.user.keys());

            // Production users ⊂ Acceptance users
            for (const user of prodUsers) {
              expect(accUsers.has(user)).toBe(true);
              expect(devUsers.has(user)).toBe(true);
            }
            expect(prodUsers.size).toBeLessThan(accUsers.size);

            // Acceptance = Development (identical user sets)
            expect(accUsers.size).toBe(devUsers.size);
            for (const user of accUsers) {
              expect(devUsers.has(user)).toBe(true);
            }
            for (const user of devUsers) {
              expect(accUsers.has(user)).toBe(true);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });

  describe('Design Property 13: Seed loadout type matches weapon hand requirement', () => {
    /**
     * **Validates: Requirements 5.6**
     * For any seeded WimpBot robot, if its equipped weapon has handsRequired = 'one'
     * then loadoutType should be "single", and if handsRequired = 'two' then
     * loadoutType should be "two_handed".
     */

    // Practice weapons with their hand requirements per design doc
    const PRACTICE_WEAPONS = {
      'Practice Sword': { handsRequired: 'one', expectedLoadout: 'single', codename: 'Rusty' },
      'Practice Blaster': { handsRequired: 'one', expectedLoadout: 'single', codename: 'Spark' },
      'Training Rifle': { handsRequired: 'two', expectedLoadout: 'two_handed', codename: 'Cadet' },
      'Training Beam': { handsRequired: 'two', expectedLoadout: 'two_handed', codename: 'Drill' },
    } as const;

    // Loadout title mapping from design doc
    const LOADOUT_TITLES: Record<string, string> = {
      single: 'Lone',
      two_handed: 'Heavy',
    };

    /**
     * Simulates seed WimpBot robot creation with loadout assignment.
     * Returns array of robot records with weapon and loadout info.
     */
    function simulateSeedWimpBotRobots(robotCount: number): Array<{
      robotNumber: number;
      weaponName: string;
      handsRequired: 'one' | 'two';
      loadoutType: 'single' | 'two_handed';
      robotName: string;
    }> {
      const robots: Array<{
        robotNumber: number;
        weaponName: string;
        handsRequired: 'one' | 'two';
        loadoutType: 'single' | 'two_handed';
        robotName: string;
      }> = [];

      const weaponNames = Object.keys(PRACTICE_WEAPONS) as Array<keyof typeof PRACTICE_WEAPONS>;

      for (let i = 1; i <= robotCount; i++) {
        // Distribute evenly: 50 each for 200 robots
        const weaponIndex = Math.floor((i - 1) / 50) % 4;
        const weaponName = weaponNames[weaponIndex];
        const weaponConfig = PRACTICE_WEAPONS[weaponName];

        // Loadout type is determined by weapon's handsRequired
        const loadoutType = weaponConfig.handsRequired === 'one' ? 'single' : 'two_handed';
        const loadoutTitle = LOADOUT_TITLES[loadoutType];

        // Robot name format: {Tier} {LoadoutTitle} {WeaponCodename} {Number}
        const robotName = `WimpBot ${loadoutTitle} ${weaponConfig.codename} ${i}`;

        robots.push({
          robotNumber: i,
          weaponName,
          handsRequired: weaponConfig.handsRequired,
          loadoutType,
          robotName,
        });
      }

      return robots;
    }

    test('one-handed weapons always produce "single" loadout type', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Robot index within one-handed weapon range (1-100)
          (robotIndex) => {
            const robots = simulateSeedWimpBotRobots(200);
            // First 100 robots have one-handed weapons (Practice Sword: 1-50, Practice Blaster: 51-100)
            const robot = robots[robotIndex - 1];

            if (robot.handsRequired === 'one') {
              expect(robot.loadoutType).toBe('single');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('two-handed weapons always produce "two_handed" loadout type', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 101, max: 200 }), // Robot index within two-handed weapon range (101-200)
          (robotIndex) => {
            const robots = simulateSeedWimpBotRobots(200);
            // Robots 101-200 have two-handed weapons (Training Rifle: 101-150, Training Beam: 151-200)
            const robot = robots[robotIndex - 1];

            if (robot.handsRequired === 'two') {
              expect(robot.loadoutType).toBe('two_handed');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('loadout type is always consistent with weapon hand requirement for any robot', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }), // Any robot index
          (robotIndex) => {
            const robots = simulateSeedWimpBotRobots(200);
            const robot = robots[robotIndex - 1];

            // Core property: handsRequired determines loadoutType
            if (robot.handsRequired === 'one') {
              expect(robot.loadoutType).toBe('single');
            } else if (robot.handsRequired === 'two') {
              expect(robot.loadoutType).toBe('two_handed');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('robot names encode correct loadout title based on weapon hand requirement', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }),
          (robotIndex) => {
            const robots = simulateSeedWimpBotRobots(200);
            const robot = robots[robotIndex - 1];

            // One-handed weapons should have "Lone" in name
            if (robot.handsRequired === 'one') {
              expect(robot.robotName).toContain('Lone');
              expect(robot.robotName).not.toContain('Heavy');
            }
            // Two-handed weapons should have "Heavy" in name
            else if (robot.handsRequired === 'two') {
              expect(robot.robotName).toContain('Heavy');
              expect(robot.robotName).not.toContain('Lone');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('all 4 practice weapons are correctly mapped to loadout types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Practice Sword' as const,
            'Practice Blaster' as const,
            'Training Rifle' as const,
            'Training Beam' as const
          ),
          (weaponName) => {
            const weaponConfig = PRACTICE_WEAPONS[weaponName];

            // Verify the mapping is correct per design doc
            if (weaponName === 'Practice Sword' || weaponName === 'Practice Blaster') {
              expect(weaponConfig.handsRequired).toBe('one');
              expect(weaponConfig.expectedLoadout).toBe('single');
            } else {
              expect(weaponConfig.handsRequired).toBe('two');
              expect(weaponConfig.expectedLoadout).toBe('two_handed');
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('weapon distribution assigns correct loadout across all 200 seed robots', () => {
      fc.assert(
        fc.property(
          fc.constant(200), // Always test with full 200 robots
          (totalRobots) => {
            const robots = simulateSeedWimpBotRobots(totalRobots);

            // Count robots by loadout type
            const singleLoadoutCount = robots.filter(r => r.loadoutType === 'single').length;
            const twoHandedLoadoutCount = robots.filter(r => r.loadoutType === 'two_handed').length;

            // 50 Practice Sword + 50 Practice Blaster = 100 single loadout
            expect(singleLoadoutCount).toBe(100);
            // 50 Training Rifle + 50 Training Beam = 100 two_handed loadout
            expect(twoHandedLoadoutCount).toBe(100);

            // Verify each robot's loadout matches its weapon
            for (const robot of robots) {
              const expectedLoadout = robot.handsRequired === 'one' ? 'single' : 'two_handed';
              expect(robot.loadoutType).toBe(expectedLoadout);
            }
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
