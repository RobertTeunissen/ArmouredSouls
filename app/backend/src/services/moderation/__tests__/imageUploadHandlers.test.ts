/**
 * Unit tests for imageUploadHandlers (preview + confirm)
 *
 * All downstream services are mocked at the module level.
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
const mockSecurityMonitor = securityMonitor as unknown as { recordEvent: jest.Mock; trackRateLimitViolation: jest.Mock };
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

function safeScores(overrides: Record<string, unknown> = {}) {
  return {
    safe: true,
    robotLikely: true,
    scores: { neutral: 0.4, drawing: 0.4, hentai: 0, porn: 0, sexy: 0 },
    robotLikenessScore: 0.8,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── handleImagePreview ───

describe('handleImagePreview', () => {
  it('should return 200 with preview and token on happy path', async () => {
    const req = makeReq();
    const res = makeRes();
    const processed = Buffer.from('processed-webp');

    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256, detectedMimeType: 'image/png' });
    mockModeration.classifyImage.mockResolvedValue(safeScores() as any);
    mockImageProcessing.processImage.mockResolvedValue(processed);

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.preview).toMatch(/^data:image\/webp;base64,/);
    expect(body.confirmationToken).toBeDefined();
    expect(mockCache.store).toHaveBeenCalledTimes(1);
  });

  it('should return 403 ROBOT_NOT_OWNED when user does not own robot', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 999 });

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROBOT_NOT_OWNED' }));
    expect(mockCache.store).not.toHaveBeenCalled();
  });

  it('should return 403 when robot not found', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue(null);

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 400 when no file is provided', async () => {
    const req = makeReq({ file: undefined });
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 INVALID_IMAGE on validation failure', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: false, error: 'Bad format' });

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_IMAGE' }));
  });

  it('should return 422 IMAGE_MODERATION_FAILED on NSFW and dual-log', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
    mockModeration.classifyImage.mockResolvedValue({
      safe: false, robotLikely: false,
      scores: { neutral: 0.1, drawing: 0.1, hentai: 0, porn: 0.5, sexy: 0 },
      robotLikenessScore: 0.2, reason: 'nsfw_content',
    } as any);

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'IMAGE_MODERATION_FAILED' }));
    // Dual audit log
    expect(mockEventLogger.logEvent).toHaveBeenCalledTimes(1);
    expect(mockSecurityMonitor.recordEvent).toHaveBeenCalledTimes(1);
    expect(mockSecurityMonitor.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'image_moderation_rejection', severity: 'warning' }),
    );
    // No scores in response
    const body = res.json.mock.calls[0][0];
    expect(body.scores).toBeUndefined();
  });

  it('should return 422 LOW_ROBOT_LIKENESS without acknowledge and log warning', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
    mockModeration.classifyImage.mockResolvedValue(safeScores({ robotLikely: false, robotLikenessScore: 0.3 }) as any);

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LOW_ROBOT_LIKENESS' }));
    expect(mockEventLogger.logEvent).toHaveBeenCalledWith(
      0, 'image_robot_likeness_warning', expect.anything(), expect.anything(),
    );
    expect(mockSecurityMonitor.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'image_robot_likeness_warning' }),
    );
  });

  it('should return 200 with acknowledgeRobotLikeness=true and log override', async () => {
    const req = makeReq({ query: { acknowledgeRobotLikeness: 'true' } });
    const res = makeRes();
    const processed = Buffer.from('processed');
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
    mockModeration.classifyImage.mockResolvedValue(safeScores({ robotLikely: false, robotLikenessScore: 0.3 }) as any);
    mockImageProcessing.processImage.mockResolvedValue(processed);

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockEventLogger.logEvent).toHaveBeenCalledWith(
      0, 'image_robot_likeness_override', expect.anything(), expect.anything(),
    );
    expect(mockSecurityMonitor.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'image_robot_likeness_override' }),
    );
  });

  it('should return 503 MODERATION_UNAVAILABLE when model is not ready', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
    mockModeration.classifyImage.mockResolvedValue({
      safe: false, robotLikely: false,
      scores: { neutral: 0, drawing: 0, hentai: 0, porn: 0, sexy: 0 },
      robotLikenessScore: 0, reason: 'moderation_unavailable',
    } as any);

    await handleImagePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'MODERATION_UNAVAILABLE' }));
  });

  it('should produce no disk writes during preview', async () => {
    const req = makeReq();
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockFileValidation.validateImage.mockResolvedValue({ valid: true, width: 256, height: 256 });
    mockModeration.classifyImage.mockResolvedValue(safeScores() as any);
    mockImageProcessing.processImage.mockResolvedValue(Buffer.from('processed'));

    await handleImagePreview(req, res);

    expect(mockStorage.storeImage).not.toHaveBeenCalled();
    expect(mockStorage.deleteImage).not.toHaveBeenCalled();
  });
});

// ─── handleImageConfirm ───

describe('handleImageConfirm', () => {
  it('should return 200 on happy path: store, update, delete old, remove cache', async () => {
    const req = makeReq({ body: { confirmationToken: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = makeRes();
    const pending = {
      processedBuffer: Buffer.from('processed'),
      userId: 1,
      robotId: 10,
      originalFileSize: 1024,
      originalDimensions: { width: 256, height: 256 },
      acknowledgedRobotLikeness: false,
      createdAt: Date.now(),
    };
    const updatedRobot = { id: 10, userId: 1, imageUrl: '/uploads/user-robots/1/new.webp' };

    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1, imageUrl: '/uploads/user-robots/1/old.webp' });
    mockCache.retrieve.mockReturnValue(pending);
    mockStorage.storeImage.mockResolvedValue('/uploads/user-robots/1/new.webp');
    (mockPrisma.robot.update as jest.Mock).mockResolvedValue(updatedRobot);

    await handleImageConfirm(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, robot: updatedRobot });
    expect(mockStorage.storeImage).toHaveBeenCalledWith(1, pending.processedBuffer);
    expect(mockStorage.deleteImage).toHaveBeenCalledWith('/uploads/user-robots/1/old.webp');
    expect(mockCache.delete).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(mockEventLogger.logEvent).toHaveBeenCalledTimes(1);
  });

  it('should not delete old image if it is a preset path', async () => {
    const req = makeReq({ body: { confirmationToken: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = makeRes();
    const pending = {
      processedBuffer: Buffer.from('processed'),
      userId: 1, robotId: 10,
      originalFileSize: 1024,
      originalDimensions: { width: 256, height: 256 },
      acknowledgedRobotLikeness: false,
      createdAt: Date.now(),
    };

    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1, imageUrl: '/assets/robots/default.webp' });
    mockCache.retrieve.mockReturnValue(pending);
    mockStorage.storeImage.mockResolvedValue('/uploads/user-robots/1/new.webp');
    (mockPrisma.robot.update as jest.Mock).mockResolvedValue({ id: 10, userId: 1, imageUrl: '/uploads/user-robots/1/new.webp' });

    await handleImageConfirm(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockStorage.deleteImage).not.toHaveBeenCalled();
  });

  it('should return 410 PREVIEW_EXPIRED when token is expired', async () => {
    const req = makeReq({ body: { confirmationToken: '550e8400-e29b-41d4-a716-446655440000' } });
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockCache.retrieve.mockReturnValue(null);

    await handleImageConfirm(req, res);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PREVIEW_EXPIRED' }));
  });

  it('should return 403 when robot not owned', async () => {
    const req = makeReq({ body: { confirmationToken: 'abc' } });
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 999 });

    await handleImageConfirm(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROBOT_NOT_OWNED' }));
  });

  it('should return 403 when pending entry userId/robotId mismatch', async () => {
    const req = makeReq({ body: { confirmationToken: 'abc' } });
    const res = makeRes();
    (mockPrisma.robot.findUnique as jest.Mock).mockResolvedValue({ id: 10, userId: 1 });
    mockCache.retrieve.mockReturnValue({
      processedBuffer: Buffer.from('x'),
      userId: 999, // different user
      robotId: 10,
      originalFileSize: 100,
      originalDimensions: { width: 64, height: 64 },
      acknowledgedRobotLikeness: false,
      createdAt: Date.now(),
    });

    await handleImageConfirm(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockStorage.storeImage).not.toHaveBeenCalled();
  });
});
