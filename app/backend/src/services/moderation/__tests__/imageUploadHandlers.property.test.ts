/**
 * Property-based tests for imageUploadHandlers
 *
 * Properties 1, 2, 6, 10, 16 from the design document.
 */

// --- Module-level mocks ---
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    robot: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../common/eventLogger', () => ({
  eventLogger: { logEvent: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../security/securityMonitor', () => ({
  securityMonitor: {
    recordEvent: jest.fn(),
    trackRateLimitViolation: jest.fn(),
  },
}));

jest.mock('../../security/securityLogger', () => ({
  SecuritySeverity: { INFO: 'info', WARNING: 'warning', CRITICAL: 'critical' },
}));

jest.mock('../fileValidationService', () => ({
  fileValidationService: { validateImage: jest.fn() },
}));

jest.mock('../contentModerationService', () => ({
  contentModerationService: { classifyImage: jest.fn() },
}));

jest.mock('../imageProcessingService', () => ({
  imageProcessingService: { processImage: jest.fn() },
}));

jest.mock('../pendingUploadCache', () => ({
  pendingUploadCache: {
    store: jest.fn(),
    retrieve: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../fileStorageService', () => ({
  fileStorageService: {
    storeImage: jest.fn(),
    deleteImage: jest.fn(),
  },
}));

import * as fc from 'fast-check';
import { handleImagePreview, handleImageConfirm } from '../imageUploadHandlers';
import prisma from '../../../lib/prisma';
import { eventLogger } from '../../common/eventLogger';
import { securityMonitor } from '../../security/securityMonitor';
import { fileValidationService } from '../fileValidationService';
import { contentModerationService } from '../contentModerationService';
import { imageProcessingService } from '../imageProcessingService';
import { pendingUploadCache } from '../pendingUploadCache';
import { fileStorageService } from '../fileStorageService';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockEventLogger = eventLogger as jest.Mocked<typeof eventLogger>;
const mockSecurityMonitor = securityMonitor as unknown as { recordEvent: jest.Mock };
const mockFileValidation = fileValidationService as jest.Mocked<typeof fileValidationService>;
const mockModeration = contentModerationService as jest.Mocked<typeof contentModerationService>;
const mockImageProcessing = imageProcessingService as jest.Mocked<typeof imageProcessingService>;
const mockCache = pendingUploadCache as unknown as { store: jest.Mock; retrieve: jest.Mock; delete: jest.Mock };
const mockStorage = fileStorageService as jest.Mocked<typeof fileStorageService>;

function makeReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { userId: 1, username: 'testuser', role: 'user' },
    params: { id: '10' },
    query: {},
    body: {},
    file: {
      buffer: Buffer.from('fake-image'),
      mimetype: 'image/png',
      size: 1024,
    },
    ...overrides,
  };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

const NUM_RUNS = 20;

/**
 * Property 1: Ownership isolation
 * **Validates: Requirements 1.3**
 *
 * For any user ID that does not match the robot's owner, uploading (preview
 * or confirm) SHALL return 403 and produce no side effects.
 */
describe('Property 1: Ownership isolation', () => {
  it('preview returns 403 for any non-owner userId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 100_000 }), // non-owner userId
        fc.integer({ min: 1, max: 100_000 }), // owner userId
        async (nonOwnerUserId, ownerUserId) => {
          fc.pre(nonOwnerUserId !== ownerUserId);
          jest.clearAllMocks();

          const req = makeReq({ user: { userId: nonOwnerUserId, username: 'x', role: 'user' } });
          const res = makeRes();
          (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: ownerUserId });

          await handleImagePreview(req, res);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROBOT_NOT_OWNED' }));
          expect(mockCache.store).not.toHaveBeenCalled();
          expect(mockStorage.storeImage).not.toHaveBeenCalled();
          expect(mockEventLogger.logEvent).not.toHaveBeenCalled();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('confirm returns 403 for any non-owner userId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        async (nonOwnerUserId, ownerUserId) => {
          fc.pre(nonOwnerUserId !== ownerUserId);
          jest.clearAllMocks();

          const req = makeReq({
            user: { userId: nonOwnerUserId, username: 'x', role: 'user' },
            body: { confirmationToken: '550e8400-e29b-41d4-a716-446655440000' },
          });
          const res = makeRes();
          (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: ownerUserId });

          await handleImageConfirm(req, res);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(mockStorage.storeImage).not.toHaveBeenCalled();
          expect(mockCache.delete).not.toHaveBeenCalled();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Property 2: Preview produces no disk writes
 * **Validates: Requirements 1.1, 1.8**
 *
 * For any preview request outcome (success, validation failure, moderation
 * rejection), no image file SHALL be written to uploads/.
 */
describe('Property 2: Preview produces no disk writes', () => {
  it('no disk writes for any preview outcome', async () => {
    // Outcome generator: 0=success, 1=validation fail, 2=NSFW reject, 3=robot-likeness warn
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }),
        async (outcome) => {
          jest.clearAllMocks();

          const req = makeReq();
          const res = makeRes();
          (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });

          if (outcome === 1) {
            mockFileValidation.validateImage.mockResolvedValue({ valid: false, error: 'Bad' });
          } else {
            mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
          }

          if (outcome === 2) {
            mockModeration.classifyImage.mockResolvedValue({
              safe: false, robotLikely: false,
              scores: { neutral: 0, drawing: 0, hentai: 0, porn: 0.5, sexy: 0 },
              robotLikenessScore: 0, reason: 'nsfw_content',
            } as any);
          } else if (outcome === 3) {
            mockModeration.classifyImage.mockResolvedValue({
              safe: true, robotLikely: false,
              scores: { neutral: 0.1, drawing: 0.1, hentai: 0, porn: 0, sexy: 0 },
              robotLikenessScore: 0.2,
            } as any);
          } else {
            mockModeration.classifyImage.mockResolvedValue({
              safe: true, robotLikely: true,
              scores: { neutral: 0.4, drawing: 0.4, hentai: 0, porn: 0, sexy: 0 },
              robotLikenessScore: 0.8,
            } as any);
          }

          mockImageProcessing.processImage.mockResolvedValue(Buffer.from('processed'));

          await handleImagePreview(req, res);

          // The invariant: no disk writes ever
          expect(mockStorage.storeImage).not.toHaveBeenCalled();
          expect(mockStorage.deleteImage).not.toHaveBeenCalled();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Property 6: No score leakage
 * **Validates: Requirements 3.3, 4.3**
 *
 * For any NSFW rejection or robot-likeness warning, the response body SHALL
 * NOT contain any NSFW category scores or numeric robot-likeness score.
 */
describe('Property 6: No score leakage', () => {
  it('NSFW rejection response contains no scores', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.3, max: 1, noNaN: true }), // porn score that triggers rejection
        async (pornScore) => {
          jest.clearAllMocks();

          const req = makeReq();
          const res = makeRes();
          (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
          mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
          mockModeration.classifyImage.mockResolvedValue({
            safe: false, robotLikely: false,
            scores: { neutral: 0.1, drawing: 0.1, hentai: 0, porn: pornScore, sexy: 0 },
            robotLikenessScore: 0.2, reason: 'nsfw_content',
          } as any);

          await handleImagePreview(req, res);

          expect(res.status).toHaveBeenCalledWith(422);
          const body = res.json.mock.calls[0][0];
          expect(body.scores).toBeUndefined();
          expect(body.robotLikenessScore).toBeUndefined();
          expect(body.porn).toBeUndefined();
          expect(body.hentai).toBeUndefined();
          expect(body.sexy).toBeUndefined();
          expect(body.neutral).toBeUndefined();
          expect(body.drawing).toBeUndefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('robot-likeness warning response contains no scores', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0, max: 0.59, noNaN: true }), // low robot-likeness
        async (robotScore) => {
          jest.clearAllMocks();

          const req = makeReq();
          const res = makeRes();
          (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
          mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
          mockModeration.classifyImage.mockResolvedValue({
            safe: true, robotLikely: false,
            scores: { neutral: robotScore / 2, drawing: robotScore / 2, hentai: 0, porn: 0, sexy: 0 },
            robotLikenessScore: robotScore,
          } as any);

          await handleImagePreview(req, res);

          expect(res.status).toHaveBeenCalledWith(422);
          const body = res.json.mock.calls[0][0];
          expect(body.scores).toBeUndefined();
          expect(body.robotLikenessScore).toBeUndefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Property 10: Dual audit logging for NSFW rejections
 * **Validates: Requirements 7.1, 7.4**
 *
 * For any NSFW rejection, BOTH an AuditLog entry (event type
 * image_moderation_rejection) AND a SecurityMonitor event (severity medium)
 * SHALL be created with userId, robotId, and reason.
 */
describe('Property 10: Dual audit logging for NSFW rejections', () => {
  it('every NSFW rejection triggers both AuditLog and SecurityMonitor', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100_000 }), // userId
        fc.integer({ min: 1, max: 100_000 }), // robotId
        async (userId, robotId) => {
          jest.clearAllMocks();

          const req = makeReq({
            user: { userId, username: 'x', role: 'user' },
            params: { id: String(robotId) },
          });
          const res = makeRes();
          (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: robotId, userId });
          mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
          mockModeration.classifyImage.mockResolvedValue({
            safe: false, robotLikely: false,
            scores: { neutral: 0, drawing: 0, hentai: 0, porn: 0.5, sexy: 0 },
            robotLikenessScore: 0, reason: 'nsfw_content',
          } as any);

          await handleImagePreview(req, res);

          expect(res.status).toHaveBeenCalledWith(422);

          // AuditLog entry
          expect(mockEventLogger.logEvent).toHaveBeenCalledTimes(1);
          const [, eventType, payload, options] = mockEventLogger.logEvent.mock.calls[0];
          expect(eventType).toBe('image_moderation_rejection');
          expect(payload).toEqual(expect.objectContaining({ robotId, reason: 'nsfw_content' }));
          expect(options).toEqual(expect.objectContaining({ userId }));

          // SecurityMonitor event
          expect(mockSecurityMonitor.recordEvent).toHaveBeenCalledTimes(1);
          const smEvent = mockSecurityMonitor.recordEvent.mock.calls[0][0];
          expect(smEvent.eventType).toBe('image_moderation_rejection');
          expect(smEvent.severity).toBe('warning');
          expect(smEvent.userId).toBe(userId);
          expect(smEvent.details.robotId).toBe(robotId);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Property 16: Robot-likeness override still enforces NSFW
 * **Validates: Requirements 4.4, 3.3**
 *
 * For any upload with ?acknowledgeRobotLikeness=true where NSFW fails, the
 * handler SHALL still return 422 IMAGE_MODERATION_FAILED. The acknowledge
 * flag SHALL only bypass robot-likeness, never NSFW.
 */
describe('Property 16: Robot-likeness override still enforces NSFW', () => {
  it('NSFW is enforced even with acknowledgeRobotLikeness=true', async () => {
    // Generate NSFW-failing scores: at least one of porn>=0.3, hentai>=0.3, sexy>=0.5
    const nsfwScoreArb = fc.record({
      porn: fc.double({ min: 0, max: 1, noNaN: true }),
      hentai: fc.double({ min: 0, max: 1, noNaN: true }),
      sexy: fc.double({ min: 0, max: 1, noNaN: true }),
    }).filter(s => s.porn >= 0.3 || s.hentai >= 0.3 || s.sexy >= 0.5);

    await fc.assert(
      fc.asyncProperty(nsfwScoreArb, async (scores) => {
        jest.clearAllMocks();

        const req = makeReq({ query: { acknowledgeRobotLikeness: 'true' } });
        const res = makeRes();
        (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
        mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
        mockModeration.classifyImage.mockResolvedValue({
          safe: false, robotLikely: false,
          scores: { neutral: 0, drawing: 0, ...scores },
          robotLikenessScore: 0, reason: 'nsfw_content',
        } as any);

        await handleImagePreview(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'IMAGE_MODERATION_FAILED' }),
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
