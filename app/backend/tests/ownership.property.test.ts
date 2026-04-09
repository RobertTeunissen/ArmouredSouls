/**
 * Feature: security-audit-guardrails, Property 8: Ownership verification returns generic 403
 *
 * **Validates: Requirements 4.1, 4.2**
 *
 * For any resource (robot, weapon inventory, facility) and for any authenticated user
 * who does not own that resource, a mutation request shall return HTTP 403 with a
 * response body containing error: 'Access denied' and no information about whether
 * the resource exists or who owns it.
 */
import fc from 'fast-check';
import { AppError } from '../src/errors';

// Mock prisma before importing ownership helpers
jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import {
  verifyRobotOwnership,
  verifyWeaponOwnership,
  verifyFacilityOwnership,
} from '../src/middleware/ownership';

/**
 * Creates a mock Prisma transaction client with configurable findUnique responses.
 */
function createMockTx(overrides: {
  robotResult?: { userId: number } | null;
  weaponResult?: { userId: number } | null;
  facilityResult?: { userId: number } | null;
}) {
  return {
    robot: {
      findUnique: jest.fn().mockResolvedValue(overrides.robotResult ?? null),
    },
    weaponInventory: {
      findUnique: jest.fn().mockResolvedValue(overrides.weaponResult ?? null),
    },
    facility: {
      findUnique: jest.fn().mockResolvedValue(overrides.facilityResult ?? null),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('Feature: security-audit-guardrails, Property 8: Ownership verification returns generic 403', () => {
  it('verifyRobotOwnership throws generic 403 when user does not own the robot', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),  // robotId
        fc.integer({ min: 1, max: 100000 }),  // ownerId (actual owner)
        fc.integer({ min: 1, max: 100000 }),  // requesterId (different user)
        async (robotId, ownerId, requesterId) => {
          // Ensure requester is different from owner
          fc.pre(ownerId !== requesterId);

          const tx = createMockTx({ robotResult: { userId: ownerId } });

          try {
            await verifyRobotOwnership(tx, robotId, requesterId);
            // Should not reach here
            expect(true).toBe(false);
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(403);
            expect(appErr.code).toBe('FORBIDDEN');
            expect(appErr.message).toBe('Access denied');
            // Must NOT reveal resource existence or owner info
            expect(appErr.details).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifyRobotOwnership throws generic 403 when robot does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),  // robotId (non-existent)
        fc.integer({ min: 1, max: 100000 }),  // requesterId
        async (robotId, requesterId) => {
          const tx = createMockTx({ robotResult: null });

          try {
            await verifyRobotOwnership(tx, robotId, requesterId);
            expect(true).toBe(false);
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(403);
            expect(appErr.code).toBe('FORBIDDEN');
            expect(appErr.message).toBe('Access denied');
            expect(appErr.details).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifyRobotOwnership succeeds when user owns the robot', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),  // robotId
        fc.integer({ min: 1, max: 100000 }),  // userId (owner = requester)
        async (robotId, userId) => {
          const tx = createMockTx({ robotResult: { userId } });
          // Should not throw
          await expect(verifyRobotOwnership(tx, robotId, userId)).resolves.toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifyWeaponOwnership throws generic 403 when user does not own the weapon', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),  // inventoryId
        fc.integer({ min: 1, max: 100000 }),  // ownerId
        fc.integer({ min: 1, max: 100000 }),  // requesterId
        async (inventoryId, ownerId, requesterId) => {
          fc.pre(ownerId !== requesterId);

          const tx = createMockTx({ weaponResult: { userId: ownerId } });

          try {
            await verifyWeaponOwnership(tx, inventoryId, requesterId);
            expect(true).toBe(false);
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(403);
            expect(appErr.code).toBe('FORBIDDEN');
            expect(appErr.message).toBe('Access denied');
            expect(appErr.details).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifyWeaponOwnership throws generic 403 when weapon does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        async (inventoryId, requesterId) => {
          const tx = createMockTx({ weaponResult: null });

          try {
            await verifyWeaponOwnership(tx, inventoryId, requesterId);
            expect(true).toBe(false);
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(403);
            expect(appErr.code).toBe('FORBIDDEN');
            expect(appErr.message).toBe('Access denied');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifyFacilityOwnership throws generic 403 when user does not own the facility', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),  // facilityId
        fc.integer({ min: 1, max: 100000 }),  // ownerId
        fc.integer({ min: 1, max: 100000 }),  // requesterId
        async (facilityId, ownerId, requesterId) => {
          fc.pre(ownerId !== requesterId);

          const tx = createMockTx({ facilityResult: { userId: ownerId } });

          try {
            await verifyFacilityOwnership(tx, facilityId, requesterId);
            expect(true).toBe(false);
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(403);
            expect(appErr.code).toBe('FORBIDDEN');
            expect(appErr.message).toBe('Access denied');
            expect(appErr.details).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verifyFacilityOwnership throws generic 403 when facility does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        async (facilityId, requesterId) => {
          const tx = createMockTx({ facilityResult: null });

          try {
            await verifyFacilityOwnership(tx, facilityId, requesterId);
            expect(true).toBe(false);
          } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            const appErr = err as AppError;
            expect(appErr.statusCode).toBe(403);
            expect(appErr.code).toBe('FORBIDDEN');
            expect(appErr.message).toBe('Access denied');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-existent and wrong-owner produce identical error responses (no enumeration)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000 }),  // resourceId
        fc.integer({ min: 1, max: 100000 }),  // ownerId
        fc.integer({ min: 1, max: 100000 }),  // requesterId
        async (resourceId, ownerId, requesterId) => {
          fc.pre(ownerId !== requesterId);

          // Case 1: Resource exists but owned by someone else
          const txExists = createMockTx({ robotResult: { userId: ownerId } });
          let errExists: AppError | null = null;
          try {
            await verifyRobotOwnership(txExists, resourceId, requesterId);
          } catch (err) {
            errExists = err as AppError;
          }

          // Case 2: Resource does not exist
          const txMissing = createMockTx({ robotResult: null });
          let errMissing: AppError | null = null;
          try {
            await verifyRobotOwnership(txMissing, resourceId, requesterId);
          } catch (err) {
            errMissing = err as AppError;
          }

          // Both must produce identical error shape
          expect(errExists).not.toBeNull();
          expect(errMissing).not.toBeNull();
          expect(errExists!.statusCode).toBe(errMissing!.statusCode);
          expect(errExists!.code).toBe(errMissing!.code);
          expect(errExists!.message).toBe(errMissing!.message);
          expect(errExists!.details).toBe(errMissing!.details);
        }
      ),
      { numRuns: 100 }
    );
  });
});
