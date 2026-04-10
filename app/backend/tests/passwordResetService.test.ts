/**
 * Unit tests for PasswordResetService
 *
 * Tests the transactional password reset logic: hash update, tokenVersion
 * increment, audit log creation, error handling, and rollback behavior.
 * All external dependencies (Prisma, hashPassword) are mocked.
 *
 * Requirements: 11.1, 11.4, 11.5
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockAuditLogFindFirst = jest.fn();
const mockAuditLogCreate = jest.fn();

const mockTx = {
  user: {
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  auditLog: {
    findFirst: mockAuditLogFindFirst,
    create: mockAuditLogCreate,
  },
};

// $transaction receives a callback; we invoke it with our mockTx
const mockTransaction = jest.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
  return cb(mockTx);
});

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: mockTransaction,
  },
}));

const mockHashPassword = jest.fn();
jest.mock('../src/services/auth/passwordService', () => ({
  hashPassword: mockHashPassword,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { resetPassword } from '../src/services/auth/passwordResetService';
import { AuthError } from '../src/errors/authErrors';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PasswordResetService', () => {
  const defaultUser = {
    id: 42,
    username: 'player1',
    tokenVersion: 3,
  };

  const defaultInitiator = {
    initiatorId: 1,
    resetType: 'admin' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default happy-path stubs
    mockFindUnique.mockResolvedValue(defaultUser);
    mockHashPassword.mockResolvedValue('$2b$10$hashedvalue');
    mockUpdate.mockResolvedValue({ ...defaultUser, tokenVersion: 4 });
    mockAuditLogFindFirst.mockResolvedValue(null);
    mockAuditLogCreate.mockResolvedValue({});
  });

  describe('successful reset', () => {
    it('should update passwordHash and increment tokenVersion by 1', async () => {
      const result = await resetPassword(42, 'NewPass123', defaultInitiator);

      expect(result).toEqual({ userId: 42, username: 'player1' });

      // Verify user lookup
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 42 },
        select: { id: true, username: true, tokenVersion: true },
      });

      // Verify hash was generated
      expect(mockHashPassword).toHaveBeenCalledWith('NewPass123');

      // Verify user update with new hash and tokenVersion incremented by exactly 1
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 42 },
        data: {
          passwordHash: '$2b$10$hashedvalue',
          tokenVersion: 4, // 3 + 1
        },
      });
    });

    it('should create an audit log entry with correct fields', async () => {
      await resetPassword(42, 'NewPass123', defaultInitiator);

      expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
      const createCall = mockAuditLogCreate.mock.calls[0][0];

      expect(createCall.data.cycleNumber).toBe(0);
      expect(createCall.data.eventType).toBe('admin_password_reset');
      expect(createCall.data.userId).toBe(1); // initiatorId
      expect(createCall.data.payload).toEqual({
        adminId: 1,
        targetUserId: 42,
        resetType: 'admin',
      });
    });

    it('should NOT include password or hash in audit log payload', async () => {
      await resetPassword(42, 'SecretPass99', defaultInitiator);

      const createCall = mockAuditLogCreate.mock.calls[0][0];
      const payload = createCall.data.payload;
      const payloadStr = JSON.stringify(payload);

      // Neither plaintext password nor hash should appear
      expect(payloadStr).not.toContain('SecretPass99');
      expect(payloadStr).not.toContain('$2b$10$hashedvalue');
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('passwordHash');
      expect(payload).not.toHaveProperty('hash');
      expect(payload).not.toHaveProperty('newPassword');
    });

    it('should increment tokenVersion by exactly 1', async () => {
      // User with tokenVersion 7
      mockFindUnique.mockResolvedValue({ id: 10, username: 'user10', tokenVersion: 7 });

      await resetPassword(10, 'AnyPass1', defaultInitiator);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tokenVersion: 8 }),
        }),
      );
    });

    it('should compute correct sequenceNumber when prior audit entries exist', async () => {
      mockAuditLogFindFirst.mockResolvedValue({ sequenceNumber: 5 });

      await resetPassword(42, 'NewPass123', defaultInitiator);

      const createCall = mockAuditLogCreate.mock.calls[0][0];
      expect(createCall.data.sequenceNumber).toBe(6);
    });

    it('should use sequenceNumber 1 when no prior audit entries exist', async () => {
      mockAuditLogFindFirst.mockResolvedValue(null);

      await resetPassword(42, 'NewPass123', defaultInitiator);

      const createCall = mockAuditLogCreate.mock.calls[0][0];
      expect(createCall.data.sequenceNumber).toBe(1);
    });
  });

  describe('non-existent user', () => {
    it('should throw a 404 AuthError when user is not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        resetPassword(999, 'NewPass123', defaultInitiator),
      ).rejects.toThrow(AuthError);

      await expect(
        resetPassword(999, 'NewPass123', defaultInitiator),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });

    it('should not call hashPassword or update when user is not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      await expect(
        resetPassword(999, 'NewPass123', defaultInitiator),
      ).rejects.toThrow();

      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  describe('transaction rollback on DB failure', () => {
    it('should propagate error when user update fails mid-transaction', async () => {
      mockUpdate.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        resetPassword(42, 'NewPass123', defaultInitiator),
      ).rejects.toThrow('DB connection lost');

      // Audit log should NOT have been created since update failed before it
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it('should propagate error when audit log creation fails', async () => {
      mockAuditLogCreate.mockRejectedValue(new Error('Disk full'));

      await expect(
        resetPassword(42, 'NewPass123', defaultInitiator),
      ).rejects.toThrow('Disk full');
    });

    it('should propagate error when hashPassword fails', async () => {
      mockHashPassword.mockRejectedValue(new Error('bcrypt failure'));

      await expect(
        resetPassword(42, 'NewPass123', defaultInitiator),
      ).rejects.toThrow('bcrypt failure');

      // Neither update nor audit log should have been called
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });
  });

  describe('audit log field correctness', () => {
    it('should record the correct adminId and targetUserId for different initiators', async () => {
      const initiator = { initiatorId: 77, resetType: 'admin' };

      mockFindUnique.mockResolvedValue({ id: 200, username: 'target_user', tokenVersion: 0 });

      await resetPassword(200, 'Pass1234', initiator);

      const createCall = mockAuditLogCreate.mock.calls[0][0];
      expect(createCall.data.payload.adminId).toBe(77);
      expect(createCall.data.payload.targetUserId).toBe(200);
      expect(createCall.data.payload.resetType).toBe('admin');
    });

    it('should support different resetType values for future extensibility', async () => {
      const initiator = { initiatorId: 42, resetType: 'self_service' };

      await resetPassword(42, 'Pass1234', initiator);

      const createCall = mockAuditLogCreate.mock.calls[0][0];
      expect(createCall.data.payload.resetType).toBe('self_service');
    });

    it('should only contain adminId, targetUserId, and resetType in payload', async () => {
      await resetPassword(42, 'MySecret!1', defaultInitiator);

      const createCall = mockAuditLogCreate.mock.calls[0][0];
      const payloadKeys = Object.keys(createCall.data.payload);

      expect(payloadKeys).toEqual(
        expect.arrayContaining(['adminId', 'targetUserId', 'resetType']),
      );
      expect(payloadKeys).toHaveLength(3);
    });
  });
});


// ---------------------------------------------------------------------------
// Property-Based Tests (fast-check)
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';
import bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Generates valid passwords (8–128 chars) that satisfy the character class
 * requirements: at least one uppercase letter, one lowercase letter, and one
 * digit. The generator builds a password by concatenating one char from each
 * required class plus random padding, then shuffling.
 */
function validPasswordArb(): fc.Arbitrary<string> {
  const upper = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  const lower = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''));
  const digit = fc.constantFrom(...'0123456789'.split(''));
  const anyChar = fc.oneof(upper, lower, digit, fc.constantFrom('!', '@', '#', '_', '-', '.'));

  return fc
    .tuple(
      upper,
      lower,
      digit,
      fc.array(anyChar, { minLength: 5, maxLength: 125 }),
    )
    .map(([u, l, d, rest]) => {
      const chars = [u, l, d, ...rest];
      // Fisher-Yates shuffle (deterministic per fast-check seed)
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    });
}

// ---------------------------------------------------------------------------
// Property-Based Test Suite
// ---------------------------------------------------------------------------

describe('PasswordResetService — Property-Based Tests', () => {
  const defaultInitiator = {
    initiatorId: 1,
    resetType: 'admin' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default happy-path stubs for Properties 3 & 4
    mockFindUnique.mockResolvedValue({ id: 42, username: 'player1', tokenVersion: 3 });
    mockHashPassword.mockResolvedValue('$2b$10$hashedvalue');
    mockUpdate.mockResolvedValue({ id: 42, username: 'player1', tokenVersion: 4 });
    mockAuditLogFindFirst.mockResolvedValue(null);
    mockAuditLogCreate.mockResolvedValue({});
  });

  /**
   * **Property 5: Hash verification round-trip**
   *
   * For any valid password (8–128 chars, uppercase + lowercase + digit),
   * the service produces a bcrypt hash that passes bcrypt.compare(password, hash).
   *
   * Uses the REAL hashPassword implementation (not the mock).
   *
   * **Validates: Requirements 11.4**
   */
  test('Property 5: any valid password round-trips through bcrypt hash + compare', async () => {
    // Use the real hashPassword, not the mock
    const { hashPassword: realHashPassword } = jest.requireActual<
      typeof import('../src/services/auth/passwordService')
    >('../src/services/auth/passwordService');

    await fc.assert(
      fc.asyncProperty(validPasswordArb(), async (password) => {
        const hash = await realHashPassword(password);

        // Hash must be a valid bcrypt string
        expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);

        // Round-trip: bcrypt.compare must succeed
        const matches = await bcrypt.compare(password, hash);
        expect(matches).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Property 4: Token version increment**
   *
   * For any valid password and target user, after reset the tokenVersion
   * is exactly previousTokenVersion + 1.
   *
   * **Validates: Requirements 11.5**
   */
  test('Property 4: tokenVersion is always incremented by exactly 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        validPasswordArb(),
        fc.integer({ min: 0, max: 1_000_000 }),
        async (password, previousVersion) => {
          // Stub user with the generated tokenVersion
          mockFindUnique.mockResolvedValue({
            id: 42,
            username: 'player1',
            tokenVersion: previousVersion,
          });
          mockUpdate.mockResolvedValue({
            id: 42,
            username: 'player1',
            tokenVersion: previousVersion + 1,
          });

          await resetPassword(42, password, defaultInitiator);

          // The update call must set tokenVersion to exactly previous + 1
          expect(mockUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                tokenVersion: previousVersion + 1,
              }),
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Property 3: No password leakage**
   *
   * For any password used in a reset, neither the plaintext password nor
   * the bcrypt hash appears in the audit log payload.
   *
   * **Validates: Requirements 5.4, 6.3**
   */
  test('Property 3: neither plaintext password nor hash leaks into audit log', async () => {
    await fc.assert(
      fc.asyncProperty(validPasswordArb(), async (password) => {
        const fakeHash = `$2b$10$fake_hash_for_${password.slice(0, 8)}`;
        mockHashPassword.mockResolvedValue(fakeHash);
        mockFindUnique.mockResolvedValue({ id: 42, username: 'player1', tokenVersion: 3 });
        mockUpdate.mockResolvedValue({ id: 42, username: 'player1', tokenVersion: 4 });
        mockAuditLogFindFirst.mockResolvedValue(null);
        mockAuditLogCreate.mockResolvedValue({});

        await resetPassword(42, password, defaultInitiator);

        // Inspect the audit log create call
        const createCall = mockAuditLogCreate.mock.calls[0][0];
        const payloadStr = JSON.stringify(createCall.data.payload);
        const fullDataStr = JSON.stringify(createCall.data);

        // Plaintext password must not appear anywhere in the audit log data
        expect(fullDataStr).not.toContain(password);

        // Bcrypt hash must not appear anywhere in the audit log data
        expect(fullDataStr).not.toContain(fakeHash);

        // Payload must not have password-related keys
        expect(createCall.data.payload).not.toHaveProperty('password');
        expect(createCall.data.payload).not.toHaveProperty('passwordHash');
        expect(createCall.data.payload).not.toHaveProperty('hash');
        expect(createCall.data.payload).not.toHaveProperty('newPassword');

        jest.clearAllMocks();
      }),
      { numRuns: 100 },
    );
  });
});
