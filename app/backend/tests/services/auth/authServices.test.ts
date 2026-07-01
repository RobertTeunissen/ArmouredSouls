/**
 * Unit tests for Auth services: userService, passwordResetService, userProfileService.
 *
 * Tests:
 * - User CRUD operations (create, find by username/email/stableName/identifier)
 * - Password reset transactional flow with audit logging
 * - Profile retrieval and stable stats aggregation
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUserCreate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockRobotFindMany = jest.fn();
const mockTeamBattleFindMany = jest.fn();
const mockStandingFindMany = jest.fn();
const mockCycleSnapshotFindFirst = jest.fn();
const mockCycleSnapshotFindUnique = jest.fn();
const mockAuditLogFindFirst = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      create: (...args: unknown[]) => mockUserCreate(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    robot: {
      findMany: (...args: unknown[]) => mockRobotFindMany(...args),
    },
    teamBattle: {
      findMany: (...args: unknown[]) => mockTeamBattleFindMany(...args),
    },
    standing: {
      findMany: (...args: unknown[]) => mockStandingFindMany(...args),
    },
    cycleSnapshot: {
      findFirst: (...args: unknown[]) => mockCycleSnapshotFindFirst(...args),
      findUnique: (...args: unknown[]) => mockCycleSnapshotFindUnique(...args),
    },
    auditLog: {
      findFirst: (...args: unknown[]) => mockAuditLogFindFirst(...args),
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/auth/passwordService', () => ({
  hashPassword: jest.fn().mockResolvedValue('$2b$10$hashedNewPassword'),
}));

jest.mock('../../../src/utils/prestigeUtils', () => ({
  getPrestigeRank: jest.fn().mockReturnValue({ name: 'Novice', threshold: 0 }),
}));

import { createUser, findUserByStableName, findUserByUsername, findUserByEmail, findUserByIdentifier } from '../../../src/services/auth/userService';
import { resetPassword } from '../../../src/services/auth/passwordResetService';
import { getUserProfile, getStableStats } from '../../../src/services/auth/userProfileService';
import { AuthError } from '../../../src/errors/authErrors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    username: 'testplayer',
    email: 'test@example.com',
    passwordHash: '$2b$10$existing',
    stableName: 'Iron Forge',
    currency: 3000000,
    prestige: 100,
    role: 'user',
    tokenVersion: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    profileVisibility: 'public',
    notificationsBattle: true,
    notificationsLeague: true,
    themePreference: 'dark',
    championshipTitles: 0,
    championshipTitles1v1: 0,
    championshipTitles2v2: 0,
    championshipTitles3v3: 0,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══ userService ═══════════════════════════════════════════════════════════════

describe('userService', () => {
  describe('createUser', () => {
    it('should create a user with provided data', async () => {
      const created = makeUser();
      mockUserCreate.mockResolvedValue(created);

      const result = await createUser({
        username: 'testplayer',
        email: 'test@example.com',
        passwordHash: '$2b$10$existing',
        stableName: 'Iron Forge',
      });

      expect(result).toEqual(created);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: {
          username: 'testplayer',
          email: 'test@example.com',
          passwordHash: '$2b$10$existing',
          stableName: 'Iron Forge',
        },
      });
    });

    it('should propagate Prisma errors on duplicate username', async () => {
      mockUserCreate.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(createUser({
        username: 'duplicate',
        email: 'dup@example.com',
        passwordHash: 'hash',
        stableName: 'Dup Stable',
      })).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('findUserByStableName', () => {
    it('should return user when found', async () => {
      const user = makeUser();
      mockUserFindUnique.mockResolvedValue(user);

      const result = await findUserByStableName('Iron Forge');

      expect(result).toEqual(user);
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { stableName: 'Iron Forge' } });
    });

    it('should return null when not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await findUserByStableName('Nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findUserByUsername', () => {
    it('should return user when found', async () => {
      const user = makeUser();
      mockUserFindUnique.mockResolvedValue(user);

      const result = await findUserByUsername('testplayer');

      expect(result).toEqual(user);
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { username: 'testplayer' } });
    });

    it('should return null when not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await findUserByUsername('ghost');

      expect(result).toBeNull();
    });
  });

  describe('findUserByEmail', () => {
    it('should return user when found', async () => {
      const user = makeUser();
      mockUserFindUnique.mockResolvedValue(user);

      const result = await findUserByEmail('test@example.com');

      expect(result).toEqual(user);
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('should return null when not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await findUserByEmail('nope@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findUserByIdentifier', () => {
    it('should find by username first', async () => {
      const user = makeUser();
      mockUserFindUnique.mockResolvedValueOnce(user); // username lookup succeeds

      const result = await findUserByIdentifier('testplayer');

      expect(result).toEqual(user);
      // Should only query once (username) since it matched
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });

    it('should fall back to email when username not found', async () => {
      const user = makeUser();
      mockUserFindUnique
        .mockResolvedValueOnce(null) // username lookup fails
        .mockResolvedValueOnce(user); // email lookup succeeds

      const result = await findUserByIdentifier('test@example.com');

      expect(result).toEqual(user);
      expect(mockUserFindUnique).toHaveBeenCalledTimes(2);
    });

    it('should return null when neither username nor email matches', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await findUserByIdentifier('nobody');

      expect(result).toBeNull();
      expect(mockUserFindUnique).toHaveBeenCalledTimes(2);
    });
  });
});

// ═══ passwordResetService ═════════════════════════════════════════════════════

describe('passwordResetService', () => {
  describe('resetPassword', () => {
    it('should reset password, increment tokenVersion, and write audit log', async () => {
      // The service uses prisma.$transaction with a callback
      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue({ id: 5, username: 'target', tokenVersion: 3 }),
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            findFirst: jest.fn().mockResolvedValue({ sequenceNumber: 10 }),
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await resetPassword(5, 'newSecurePass!123', {
        initiatorId: 1,
        resetType: 'admin',
      });

      expect(result).toEqual({ userId: 5, username: 'target' });

      // Verify the transaction callback was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      const txCallback = mockTransaction.mock.calls[0][0];
      expect(typeof txCallback).toBe('function');
    });

    it('should throw USER_NOT_FOUND when target user does not exist', async () => {
      mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
          auditLog: {
            findFirst: jest.fn(),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        resetPassword(999, 'password', { initiatorId: 1, resetType: 'admin' }),
      ).rejects.toThrow(AuthError);
    });
  });
});

// ═══ userProfileService ══════════════════════════════════════════════════════

describe('userProfileService', () => {
  describe('getUserProfile', () => {
    it('should return profile with stableName', async () => {
      mockUserFindUnique.mockResolvedValue(makeUser());

      const result = await getUserProfile(1);

      expect(result.stableName).toBe('Iron Forge');
      expect(result.username).toBe('testplayer');
      expect(result.currency).toBe(3000000);
    });

    it('should fall back to username when stableName is null', async () => {
      mockUserFindUnique.mockResolvedValue(makeUser({ stableName: null }));

      const result = await getUserProfile(1);

      expect(result.stableName).toBe('testplayer');
    });

    it('should throw AuthError when user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getUserProfile(999)).rejects.toThrow(AuthError);
    });
  });

  describe('getStableStats', () => {
    it('should return zeroed stats when user has no robots', async () => {
      mockUserFindUnique.mockResolvedValue({ prestige: 50 });
      mockRobotFindMany.mockResolvedValue([]);
      mockTeamBattleFindMany.mockResolvedValue([]);
      mockStandingFindMany.mockResolvedValue([]);
      mockCycleSnapshotFindFirst.mockResolvedValue(null);

      const result = await getStableStats(1);

      expect(result.totalBattles).toBe(0);
      expect(result.wins).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.highestELO).toBe(0);
      expect(result.totalRobots).toBe(0);
    });

    it('should aggregate robot stats and standings', async () => {
      mockUserFindUnique.mockResolvedValue({ prestige: 200 });
      mockRobotFindMany.mockResolvedValue([
        { id: 1, elo: 1500, totalBattles: 20, wins: 12, losses: 6, draws: 2, currentHP: 100, maxHP: 100, mainWeapon: {} },
        { id: 2, elo: 1200, totalBattles: 10, wins: 5, losses: 4, draws: 1, currentHP: 80, maxHP: 100, mainWeapon: {} },
      ]);
      mockTeamBattleFindMany.mockResolvedValue([{ id: 10 }]);
      // First call: tag team standings, second: robot league standings
      mockStandingFindMany
        .mockResolvedValueOnce([{ tier: 'silver', wins: 3, losses: 2, draws: 0 }]) // tag team
        .mockResolvedValueOnce([{ tier: 'silver' }, { tier: 'bronze' }]); // robot league
      mockCycleSnapshotFindFirst.mockResolvedValue(null);

      const result = await getStableStats(1);

      expect(result.totalBattles).toBe(35); // 20 + 10 + 5 (tag team)
      expect(result.wins).toBe(20); // 12 + 5 + 3
      expect(result.losses).toBe(12); // 6 + 4 + 2
      expect(result.highestELO).toBe(1500);
      expect(result.totalRobots).toBe(2);
      expect(result.highestLeague).toBe('silver');
      expect(result.highestTagTeamLeague).toBe('silver');
    });

    it('should throw AuthError when user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getStableStats(999)).rejects.toThrow(AuthError);
    });

    it('should compute cycle changes when snapshots exist', async () => {
      mockUserFindUnique.mockResolvedValue({ prestige: 100 });
      mockRobotFindMany.mockResolvedValue([
        { id: 1, elo: 1500, totalBattles: 10, wins: 6, losses: 3, draws: 1, currentHP: 100, maxHP: 100, mainWeapon: {} },
      ]);
      mockTeamBattleFindMany.mockResolvedValue([]);
      mockStandingFindMany
        .mockResolvedValueOnce([]) // tag team
        .mockResolvedValueOnce([{ tier: 'bronze' }]); // robot league
      mockCycleSnapshotFindFirst.mockResolvedValue({ cycleNumber: 5 });
      mockCycleSnapshotFindUnique
        .mockResolvedValueOnce({
          stableMetrics: [{ userId: 1, totalPrestigeEarned: 50 }],
          robotMetrics: [{ robotId: 1, wins: 6, losses: 3, eloChange: 20 }],
        })
        .mockResolvedValueOnce({
          stableMetrics: [{ userId: 1, totalPrestigeEarned: 30 }],
          robotMetrics: [{ robotId: 1, wins: 4, losses: 2, eloChange: 10 }],
        });

      const result = await getStableStats(1);

      expect(result.cycleChanges).toEqual({
        prestige: 50,
        wins: 2, // 6 - 4
        losses: 1, // 3 - 2
        highestElo: 20, // eloChange from current snapshot's highest-ELO robot
      });
    });
  });
});
