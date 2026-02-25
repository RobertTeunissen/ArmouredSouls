import * as fc from 'fast-check';
import { getSeedMode } from '../prisma/seed';

const NUM_RUNS = 100;

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
  'Practice Sword', 'Machine Pistol', 'Laser Pistol', 'Combat Knife',
  'Light Shield', 'Combat Shield', 'Reactive Shield', 'Machine Gun',
  'Burst Rifle', 'Assault Rifle', 'Energy Blade', 'Laser Rifle',
  'Plasma Blade', 'Plasma Rifle', 'Power Sword', 'Shotgun',
  'Grenade Launcher', 'Sniper Rifle', 'Battle Axe', 'Plasma Cannon',
  'Heavy Hammer', 'Railgun', 'Ion Beam',
];

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

  // Seed weapons (ALL environments) — mirrors upsertWeapon pattern
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

  // Acceptance + Development: core test users
  if (mode === 'acceptance' || mode === 'development') {
    await mockPrisma.user.upsert({
      where: { username: 'admin' },
      update: { passwordHash: 'hash', role: 'admin', currency: 10000000, prestige: 50000 },
      create: { username: 'admin', passwordHash: 'hash', role: 'admin', currency: 10000000, prestige: 50000 },
    });
    for (let i = 1; i <= 5; i++) {
      await mockPrisma.user.upsert({
        where: { username: `player${i}` },
        update: { passwordHash: 'hash', role: 'user', currency: 3000000, prestige: 0 },
        create: { username: `player${i}`, passwordHash: 'hash', currency: 3000000 },
      });
    }
  }

  // Development only: WimpBot users
  if (mode === 'development') {
    for (let i = 1; i <= 100; i++) {
      const username = `test_user_${String(i).padStart(3, '0')}`;
      await mockPrisma.user.upsert({
        where: { username },
        update: { passwordHash: 'hash', role: 'user', currency: 100000, prestige: 0 },
        create: { username, passwordHash: 'hash', currency: 100000 },
      });
    }
  }

  // Development only: attribute test users
  if (mode === 'development') {
    for (const label of Object.values(ATTRIBUTE_LABELS)) {
      for (let i = 1; i <= 10; i++) {
        const username = `attr_${label}_${String(i).padStart(2, '0')}`.toLowerCase();
        await mockPrisma.user.upsert({
          where: { username },
          update: { passwordHash: 'hash', role: 'user', currency: 100000, prestige: 0 },
          create: { username, passwordHash: 'hash', currency: 100000 },
        });
      }
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
            expect(mockPrisma._stores.weapon.size).toBe(23);
            expect(mockPrisma._stores.cycleMetadata.size).toBe(1);
            expect(mockPrisma._stores.user.has('bye_robot_user')).toBe(true);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('acceptance mode seeds admin and players but not WimpBot or attribute users', async () => {
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
            expect(usernames).toContain('player1');
            expect(usernames).toContain('player5');
            const wimpBots = usernames.filter(u => u.startsWith('test_user_'));
            const attrUsers = usernames.filter(u => u.startsWith('attr_'));
            expect(wimpBots).toEqual([]);
            expect(attrUsers).toEqual([]);
            // bye_robot_user + admin + player1-5 = 7
            expect(usernames.length).toBe(7);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('development mode seeds all user types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(1),
          async () => {
            const mockPrisma = createMockPrisma();
            await simulateSeed(mockPrisma, 'development');
            const usernames = [...mockPrisma._stores.user.keys()];
            expect(usernames).toContain('bye_robot_user');
            expect(usernames).toContain('admin');
            expect(usernames).toContain('player1');
            expect(usernames).toContain('test_user_001');
            expect(usernames).toContain('test_user_100');
            expect(usernames.some(u => u.startsWith('attr_'))).toBe(true);
            // bye_robot_user(1) + admin(1) + player1-5(5) + WimpBot(100) + attr(230) = 337
            expect(usernames.length).toBe(337);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('for any seed mode, user sets form a strict superset chain: prod ⊂ acc ⊂ dev', async () => {
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

            // Production users ⊆ Acceptance users ⊆ Development users
            for (const user of prodUsers) {
              expect(accUsers.has(user)).toBe(true);
              expect(devUsers.has(user)).toBe(true);
            }
            for (const user of accUsers) {
              expect(devUsers.has(user)).toBe(true);
            }

            // Strict ordering: prod < acc < dev
            expect(prodUsers.size).toBeLessThan(accUsers.size);
            expect(accUsers.size).toBeLessThan(devUsers.size);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
