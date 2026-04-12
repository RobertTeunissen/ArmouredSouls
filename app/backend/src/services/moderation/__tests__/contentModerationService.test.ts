/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for ContentModerationService
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5, 4.1, 4.2
 */

// Helper: build a predictions array from a partial score object.
// nsfwjs returns PascalCase classNames; the service lowercases them.
function makePredictions(scores: {
  neutral?: number;
  drawing?: number;
  hentai?: number;
  porn?: number;
  sexy?: number;
}): { className: string; probability: number }[] {
  return [
    { className: 'Neutral', probability: scores.neutral ?? 0 },
    { className: 'Drawing', probability: scores.drawing ?? 0 },
    { className: 'Hentai', probability: scores.hentai ?? 0 },
    { className: 'Porn', probability: scores.porn ?? 0 },
    { className: 'Sexy', probability: scores.sexy ?? 0 },
  ];
}

// Shared mock references — reassigned per isolateModules call
let mockClassify: jest.Mock;
let mockDispose: jest.Mock;
let mockLoad: jest.Mock;
let mockDecodeImage: jest.Mock;

/**
 * Creates a fresh, isolated ContentModerationService instance.
 * Each call gets its own module scope so the singleton doesn't leak between tests.
 */
async function createService(options?: { failLoad?: boolean }) {
  mockClassify = jest.fn();
  mockDispose = jest.fn();
  mockLoad = jest.fn();
  mockDecodeImage = jest.fn();

  if (options?.failLoad) {
    mockLoad.mockRejectedValue(new Error('Model load failed'));
  } else {
    mockLoad.mockResolvedValue({ classify: mockClassify });
  }

  mockDecodeImage.mockReturnValue({ dispose: mockDispose });

  let service: any;

  jest.isolateModules(() => {
    // Set up mocks inside the isolated scope
    jest.doMock('nsfwjs', () => ({ load: mockLoad }));
    jest.doMock('@tensorflow/tfjs-node', () => ({
      node: { decodeImage: mockDecodeImage },
    }));
    jest.doMock('../../../config/logger', () => ({
      __esModule: true,
      default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../contentModerationService');
    service = mod.contentModerationService;
  });

  await service.initialize();
  return service;
}

describe('ContentModerationService', () => {
  describe('NSFW threshold logic', () => {
    it('should mark image as unsafe when porn score is exactly 0.3 (at threshold)', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0.3, hentai: 0, sexy: 0, neutral: 0.5, drawing: 0.2 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('nsfw_content');
    });

    it('should mark image as safe when porn score is 0.29 (below threshold)', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0.29, hentai: 0, sexy: 0, neutral: 0.5, drawing: 0.21 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(true);
    });

    it('should mark image as unsafe when hentai score is exactly 0.3 (at threshold)', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0.3, sexy: 0, neutral: 0.5, drawing: 0.2 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('nsfw_content');
    });

    it('should mark image as safe when hentai score is 0.29 (below threshold)', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0.29, sexy: 0, neutral: 0.5, drawing: 0.21 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(true);
    });

    it('should mark image as unsafe when sexy score is exactly 0.5 (at threshold)', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0.5, neutral: 0.3, drawing: 0.2 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('nsfw_content');
    });

    it('should mark image as safe when sexy score is 0.49 (below threshold)', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0.49, neutral: 0.3, drawing: 0.21 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(true);
    });

    it('should return all five category scores in the result', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0.1, hentai: 0.1, sexy: 0.1, neutral: 0.4, drawing: 0.3 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.scores).toEqual({
        neutral: 0.4,
        drawing: 0.3,
        hentai: 0.1,
        porn: 0.1,
        sexy: 0.1,
      });
    });
  });

  describe('robot-likeness threshold logic', () => {
    it('should flag robotLikely as false when drawing + neutral < 0.6', async () => {
      const service = await createService();
      // drawing (0.2) + neutral (0.3) = 0.5 < 0.6
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0.1, neutral: 0.3, drawing: 0.2 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(true);
      expect(result.robotLikely).toBe(false);
      expect(result.robotLikenessScore).toBeCloseTo(0.5);
      expect(result.reason).toBe('low_robot_likeness');
    });

    it('should flag robotLikely as true when drawing + neutral >= 0.6', async () => {
      const service = await createService();
      // drawing (0.3) + neutral (0.3) = 0.6 >= 0.6
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0.1, neutral: 0.3, drawing: 0.3 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(true);
      expect(result.robotLikely).toBe(true);
      expect(result.robotLikenessScore).toBeCloseTo(0.6);
      expect(result.reason).toBeUndefined();
    });

    it('should flag robotLikely as true when drawing + neutral is well above 0.6', async () => {
      const service = await createService();
      // drawing (0.5) + neutral (0.4) = 0.9
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0.05, neutral: 0.4, drawing: 0.5 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(true);
      expect(result.robotLikely).toBe(true);
      expect(result.robotLikenessScore).toBeCloseTo(0.9);
    });

    it('should compute robotLikenessScore as drawing + neutral', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0, neutral: 0.25, drawing: 0.15 })
      );

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.robotLikenessScore).toBeCloseTo(0.4);
    });
  });

  describe('model unavailable (fail-closed)', () => {
    it('should return safe: false with reason moderation_unavailable when model fails to load', async () => {
      const service = await createService({ failLoad: true });

      const result = await service.classifyImage(Buffer.from('test'));

      expect(result.safe).toBe(false);
      expect(result.reason).toBe('moderation_unavailable');
      expect(result.robotLikely).toBe(false);
    });

    it('should report isReady() as false when model fails to load', async () => {
      const service = await createService({ failLoad: true });

      expect(service.isReady()).toBe(false);
    });

    it('should report isReady() as true when model loads successfully', async () => {
      const service = await createService();

      expect(service.isReady()).toBe(true);
    });
  });

  describe('tensor disposal', () => {
    it('should dispose the image tensor after successful classification', async () => {
      const service = await createService();
      mockClassify.mockResolvedValue(
        makePredictions({ porn: 0, hentai: 0, sexy: 0, neutral: 0.5, drawing: 0.5 })
      );

      await service.classifyImage(Buffer.from('test'));

      expect(mockDispose).toHaveBeenCalledTimes(1);
    });

    it('should dispose the image tensor even when classification throws an error', async () => {
      const service = await createService();
      mockClassify.mockRejectedValue(new Error('Classification failed'));

      const result = await service.classifyImage(Buffer.from('test'));

      expect(mockDispose).toHaveBeenCalledTimes(1);
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('moderation_unavailable');
    });
  });
});
