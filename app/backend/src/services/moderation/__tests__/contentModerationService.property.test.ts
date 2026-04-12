/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Property-based tests for ContentModerationService.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 5: NSFW threshold consistency
 * For any set of five NSFW category scores, the service SHALL mark the image
 * as safe if and only if porn < 0.3 AND hentai < 0.3 AND sexy < 0.5.
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * Property 7: Robot-likeness is a soft warning with override
 * For any NSFW-safe scores, `robotLikely` is true iff `drawing + neutral >= 0.6`.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import * as fc from 'fast-check';

// Shared mock references — reassigned per isolateModules call
let mockClassify: jest.Mock;
let mockDispose: jest.Mock;
let mockLoad: jest.Mock;
let mockDecodeImage: jest.Mock;

/**
 * Build a predictions array from a score object.
 * nsfwjs returns PascalCase classNames; the service lowercases them.
 */
function makePredictions(scores: {
  neutral: number;
  drawing: number;
  hentai: number;
  porn: number;
  sexy: number;
}): { className: string; probability: number }[] {
  return [
    { className: 'Neutral', probability: scores.neutral },
    { className: 'Drawing', probability: scores.drawing },
    { className: 'Hentai', probability: scores.hentai },
    { className: 'Porn', probability: scores.porn },
    { className: 'Sexy', probability: scores.sexy },
  ];
}

/**
 * Creates a fresh, isolated ContentModerationService instance.
 * Each call gets its own module scope so the singleton doesn't leak between tests.
 */
async function createService(): Promise<any> {
  mockClassify = jest.fn();
  mockDispose = jest.fn();
  mockLoad = jest.fn();
  mockDecodeImage = jest.fn();

  mockLoad.mockResolvedValue({ classify: mockClassify });
  mockDecodeImage.mockReturnValue({ dispose: mockDispose });

  let service: any;

  jest.isolateModules(() => {
    jest.doMock('nsfwjs', () => ({ load: mockLoad }));
    jest.doMock('@tensorflow/tfjs', () => ({
      tensor3d: () => ({ dispose: mockDispose }),
    }));
    jest.doMock('sharp', () => {
      const mockSharp = () => ({
        resize: () => mockSharp(),
        removeAlpha: () => mockSharp(),
        raw: () => mockSharp(),
        toBuffer: jest.fn().mockResolvedValue({
          data: Buffer.alloc(224 * 224 * 3),
          info: { height: 224, width: 224, channels: 3 },
        }),
      });
      return { __esModule: true, default: mockSharp };
    });
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

/**
 * Generator: produces 5 non-negative floats that sum to ~1.0.
 * Uses fc.tuple of fc.double, then normalizes to sum to 1.0.
 * Maps to { neutral, drawing, hentai, porn, sexy }.
 */
const scoreDistribution = fc
  .tuple(
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.double({ min: 0, max: 1, noNaN: true })
  )
  .filter(([a, b, c, d, e]) => a + b + c + d + e > 0)
  .map(([a, b, c, d, e]) => {
    const sum = a + b + c + d + e;
    return {
      neutral: a / sum,
      drawing: b / sum,
      hentai: c / sum,
      porn: d / sum,
      sexy: e / sum,
    };
  });

describe('ContentModerationService Property Tests', () => {
  /**
   * Property 5: NSFW threshold consistency
   * **Validates: Requirements 3.1, 3.2**
   */
  describe('Property 5: NSFW threshold consistency', () => {
    it('should mark image as safe iff porn < 0.3 AND hentai < 0.3 AND sexy < 0.5', async () => {
      const service = await createService();

      await fc.assert(
        fc.asyncProperty(scoreDistribution, async (scores) => {
          mockClassify.mockResolvedValue(makePredictions(scores));

          const result = await service.classifyImage(Buffer.from('test'));

          const expectedSafe =
            scores.porn < 0.3 && scores.hentai < 0.3 && scores.sexy < 0.5;

          expect(result.safe).toBe(expectedSafe);

          // Result must always contain all five category scores
          expect(result.scores).toEqual(
            expect.objectContaining({
              neutral: expect.any(Number),
              drawing: expect.any(Number),
              hentai: expect.any(Number),
              porn: expect.any(Number),
              sexy: expect.any(Number),
            })
          );

          // Result must always contain robotLikenessScore
          expect(typeof result.robotLikenessScore).toBe('number');
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * Property 7: Robot-likeness is a soft warning with override
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  describe('Property 7: Robot-likeness is a soft warning with override', () => {
    /**
     * Generator: produces NSFW-safe score sets where porn < 0.3, hentai < 0.3, sexy < 0.5.
     * Varies drawing + neutral around the 0.6 boundary.
     */
    const nsfwSafeScores = fc
      .record({
        porn: fc.double({ min: 0, max: 0.29, noNaN: true }),
        hentai: fc.double({ min: 0, max: 0.29, noNaN: true }),
        sexy: fc.double({ min: 0, max: 0.49, noNaN: true }),
        drawing: fc.double({ min: 0, max: 1, noNaN: true }),
        neutral: fc.double({ min: 0, max: 1, noNaN: true }),
      })
      .filter((s) => {
        const total = s.porn + s.hentai + s.sexy + s.drawing + s.neutral;
        return total > 0;
      })
      .map((s) => {
        // Normalize to sum to ~1.0
        const total = s.porn + s.hentai + s.sexy + s.drawing + s.neutral;
        const normalized = {
          porn: s.porn / total,
          hentai: s.hentai / total,
          sexy: s.sexy / total,
          drawing: s.drawing / total,
          neutral: s.neutral / total,
        };
        // After normalization, NSFW scores may exceed thresholds.
        // Only keep if still NSFW-safe.
        return normalized;
      })
      .filter(
        (s) => s.porn < 0.3 && s.hentai < 0.3 && s.sexy < 0.5
      );

    it('should set robotLikely to true iff drawing + neutral >= 0.6 for NSFW-safe images', async () => {
      const service = await createService();

      await fc.assert(
        fc.asyncProperty(nsfwSafeScores, async (scores) => {
          mockClassify.mockResolvedValue(makePredictions(scores));

          const result = await service.classifyImage(Buffer.from('test'));

          // Precondition: image must be NSFW-safe
          expect(result.safe).toBe(true);

          const expectedRobotLikely = scores.drawing + scores.neutral >= 0.6;
          expect(result.robotLikely).toBe(expectedRobotLikely);

          // robotLikenessScore should equal drawing + neutral
          expect(result.robotLikenessScore).toBeCloseTo(
            scores.drawing + scores.neutral,
            10
          );
        }),
        { numRuns: 200 }
      );
    });
  });
});
