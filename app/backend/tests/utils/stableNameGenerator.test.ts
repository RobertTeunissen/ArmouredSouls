import { generateStableName } from '../../src/utils/stableNameGenerator';
import { STABLE_ADJECTIVES, STABLE_NOUNS } from '../../src/utils/tierConfig';
import fc from 'fast-check';

describe('generateStableName', () => {
  describe('Unit Tests', () => {
    it('should generate a name with adjective and noun from word lists', () => {
      const name = generateStableName(new Set());
      const parts = name.split(' ');

      // Should have at least 2 parts (adjective + noun)
      expect(parts.length).toBeGreaterThanOrEqual(2);

      const adjective = parts[0];
      const noun = parts[1];

      expect(STABLE_ADJECTIVES).toContain(adjective);
      expect(STABLE_NOUNS).toContain(noun);
    });

    it('should append numeric suffix when base name already exists', () => {
      const existingNames = new Set(['Iron Industries']);

      // Mock Math.random to always return 0 (first adjective and noun)
      const originalRandom = Math.random;
      Math.random = () => 0;

      try {
        const name = generateStableName(existingNames);
        // First adjective is 'Iron', first noun is 'Industries'
        // Since 'Iron Industries' exists, should return 'Iron Industries 2'
        expect(name).toBe('Iron Industries 2');
      } finally {
        Math.random = originalRandom;
      }
    });

    it('should increment suffix when multiple collisions exist', () => {
      const existingNames = new Set([
        'Iron Industries',
        'Iron Industries 2',
        'Iron Industries 3',
      ]);

      const originalRandom = Math.random;
      Math.random = () => 0;

      try {
        const name = generateStableName(existingNames);
        expect(name).toBe('Iron Industries 4');
      } finally {
        Math.random = originalRandom;
      }
    });

    it('should return base name when no collision exists', () => {
      const existingNames = new Set(['Steel Dynamics', 'Shadow Robotics']);

      const originalRandom = Math.random;
      Math.random = () => 0;

      try {
        const name = generateStableName(existingNames);
        // First adjective is 'Iron', first noun is 'Industries'
        expect(name).toBe('Iron Industries');
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  /**
   * Property 8: Stable names are unique and use only neutral words
   * **Validates: Requirements 13.5, 13.6**
   *
   * For any set of generated stable names:
   * - All names are unique
   * - Each name is composed of a valid adjective + noun from word lists
   * - No name contains tier keywords ("Wimp", "Average", "Expert", "Bot")
   */
  describe('Property-Based Tests', () => {
    it('Property 8: Stable names are unique and use only neutral words', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (count) => {
            const existingNames = new Set<string>();
            const generatedNames: string[] = [];

            // Generate 'count' stable names
            for (let i = 0; i < count; i++) {
              const name = generateStableName(existingNames);
              generatedNames.push(name);
              existingNames.add(name);
            }

            // All names should be unique
            const uniqueNames = new Set(generatedNames);
            expect(uniqueNames.size).toBe(generatedNames.length);

            // Each name should be composed of valid adjective + noun
            for (const name of generatedNames) {
              const parts = name.split(' ');
              expect(parts.length).toBeGreaterThanOrEqual(2);

              const adjective = parts[0];
              const noun = parts[1];

              expect(STABLE_ADJECTIVES).toContain(adjective);
              expect(STABLE_NOUNS).toContain(noun);

              // If there's a suffix, it should be a number
              if (parts.length === 3) {
                const suffix = parseInt(parts[2], 10);
                expect(Number.isInteger(suffix)).toBe(true);
                expect(suffix).toBeGreaterThanOrEqual(2);
              }
            }

            // No name should contain tier keywords
            const tierKeywords = ['Wimp', 'Average', 'Expert', 'Bot'];
            for (const name of generatedNames) {
              for (const keyword of tierKeywords) {
                expect(name).not.toContain(keyword);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique names even with many collisions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 50, max: 200 }),
          (count) => {
            const existingNames = new Set<string>();
            const generatedNames: string[] = [];

            for (let i = 0; i < count; i++) {
              const name = generateStableName(existingNames);
              generatedNames.push(name);
              existingNames.add(name);
            }

            // All names should still be unique
            const uniqueNames = new Set(generatedNames);
            expect(uniqueNames.size).toBe(generatedNames.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should never generate names with tier keywords regardless of word list content', () => {
      // Verify the word lists themselves don't contain tier keywords
      const tierKeywords = ['Wimp', 'Average', 'Expert', 'Bot'];

      for (const adjective of STABLE_ADJECTIVES) {
        for (const keyword of tierKeywords) {
          expect(adjective).not.toContain(keyword);
        }
      }

      for (const noun of STABLE_NOUNS) {
        for (const keyword of tierKeywords) {
          expect(noun).not.toContain(keyword);
        }
      }
    });

    it('should handle exceeding 1600 base combinations with numeric suffixes', () => {
      // 40 adjectives × 40 nouns = 1600 base combinations
      const totalBaseCombinations = STABLE_ADJECTIVES.length * STABLE_NOUNS.length;
      expect(totalBaseCombinations).toBe(1600);

      // Pre-populate with all 1600 base combinations
      const existingNames = new Set<string>();
      for (const adj of STABLE_ADJECTIVES) {
        for (const noun of STABLE_NOUNS) {
          existingNames.add(`${adj} ${noun}`);
        }
      }
      expect(existingNames.size).toBe(1600);

      // Generate 100 more names - all should get numeric suffixes
      const newNames: string[] = [];
      for (let i = 0; i < 100; i++) {
        const name = generateStableName(existingNames);
        newNames.push(name);
        existingNames.add(name);
      }

      // All new names should be unique
      const uniqueNewNames = new Set(newNames);
      expect(uniqueNewNames.size).toBe(100);

      // All new names should have numeric suffix (3 parts: adjective, noun, number)
      for (const name of newNames) {
        const parts = name.split(' ');
        expect(parts.length).toBe(3);
        const suffix = parseInt(parts[2], 10);
        expect(Number.isInteger(suffix)).toBe(true);
        expect(suffix).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
