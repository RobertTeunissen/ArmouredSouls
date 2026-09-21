import {
  classifyMatch,
  getBestMatchRank,
  getGuideMatchRank,
  limitCategoryResults,
  normalizeSearchQuery,
  rankGuideSources,
  rankRobotSources,
  rankStableSources,
} from '../searchRanking';
import {
  GuideSearchSource,
  MAX_RESULTS_PER_CATEGORY,
  MAX_TOTAL_RESULTS,
  RobotSearchSource,
  StableSearchSource,
} from '../searchTypes';

function guide(overrides: Partial<GuideSearchSource> = {}): GuideSearchSource {
  return {
    slug: 'article',
    title: 'Article title',
    sectionSlug: 'section',
    sectionTitle: 'Section title',
    description: 'Article description',
    bodyText: 'Article body',
    ...overrides,
  };
}

describe('searchRanking', () => {
  describe('normalization and classification', () => {
    it('should trim only edge whitespace while preserving internal whitespace', () => {
      expect(normalizeSearchQuery('\t alpha  beta \n')).toBe('alpha  beta');
      expect(normalizeSearchQuery('alpha\tbeta')).toBe('alpha\tbeta');
    });

    it('should handle empty and short values without turning an empty query into a match', () => {
      expect(normalizeSearchQuery(' \t\n')).toBe('');
      expect(normalizeSearchQuery(' a ')).toBe('a');
      expect(classifyMatch(' ', 'alpha')).toBeNull();
      expect(classifyMatch('a', 'alpha')).toBe('prefix');
      expect(classifyMatch('a', 'bravo')).toBe('substring');
    });

    it('should classify exact, prefix, substring, and non-matches case-insensitively', () => {
      expect(classifyMatch('  ALPHA ', 'alpha')).toBe('exact');
      expect(classifyMatch('alp', 'Alpha robot')).toBe('prefix');
      expect(classifyMatch('bot', 'Alpha robot')).toBe('substring');
      expect(classifyMatch('alpha', 'bravo')).toBeNull();
      expect(classifyMatch('', 'alpha')).toBeNull();
    });

    it('should preserve meaningful internal whitespace during matching', () => {
      expect(classifyMatch('alpha beta', 'Alpha Beta robot')).toBe('prefix');
      expect(classifyMatch('alpha beta', 'Alpha  Beta robot')).toBeNull();
      expect(classifyMatch('alpha  beta', 'Alpha  Beta robot')).toBe('prefix');
    });

    it('should keep exact, prefix, and substring boundaries distinct', () => {
      expect(classifyMatch('alpha', 'alpha')).toBe('exact');
      expect(classifyMatch('alpha', 'alpha squad')).toBe('prefix');
      expect(classifyMatch('alpha', 'squad alpha')).toBe('substring');
      expect(classifyMatch('alpha', 'alpah')).toBeNull();
    });

    it('should choose the strongest guide rank across title, description, and body', () => {
      const source = guide({
        title: 'Robot tactics',
        description: 'robot',
        bodyText: 'Learn about robot in detail',
      });

      expect(getGuideMatchRank('robot', source)).toBe('exact');
      expect(getGuideMatchRank('robo', source)).toBe('prefix');
      expect(getGuideMatchRank('bot', source)).toBe('substring');
      expect(getBestMatchRank('detail', [source.bodyText])).toBe('substring');
    });
  });

  describe('category ranking', () => {
    it('should rank robots by match rank, lower-case name, and numeric id', () => {
      const sources: RobotSearchSource[] = [
        { id: 3, name: 'Alpha Two', stableName: null },
        { id: 2, name: 'alpha one', stableName: null },
        { id: 1, name: 'X Alpha', stableName: null },
        { id: 4, name: 'ALPHA', stableName: null },
      ];

      expect(rankRobotSources('alpha', sources).map(({ source, rank }) => [source.id, rank])).toEqual([
        [4, 'exact'],
        [2, 'prefix'],
        [3, 'prefix'],
        [1, 'substring'],
      ]);
    });

    it('should use numeric id when robot names differ only by case', () => {
      const sources: RobotSearchSource[] = [
        { id: 9, name: 'ALPHA', stableName: null },
        { id: 2, name: 'alpha', stableName: null },
        { id: 5, name: 'Alpha', stableName: null },
      ];

      expect(rankRobotSources('alpha', sources).map(({ source }) => source.id)).toEqual([2, 5, 9]);
    });

    it('should rank stable names after trimming and exclude missing names', () => {
      const sources: StableSearchSource[] = [
        { userId: 3, stableName: '  Alpha Two ' },
        { userId: 2, stableName: 'alpha one' },
        { userId: 1, stableName: null },
        { userId: 4, stableName: '   ' },
      ];

      expect(rankStableSources('alpha', sources).map(({ source }) => source.userId)).toEqual([2, 3]);
    });

    it('should use numeric userId when trimmed stable names differ only by case or whitespace', () => {
      const sources: StableSearchSource[] = [
        { userId: 9, stableName: ' ALPHA ' },
        { userId: 2, stableName: 'alpha' },
        { userId: 5, stableName: 'Alpha' },
      ];

      expect(rankStableSources('alpha', sources).map(({ source }) => source.userId)).toEqual([2, 5, 9]);
    });

    it('should use title, section slug, and article slug for guide ties', () => {
      const sources: GuideSearchSource[] = [
        guide({ slug: 'zulu', title: 'Alpha', sectionSlug: 'combat' }),
        guide({ slug: 'alpha', title: 'alpha', sectionSlug: 'combat' }),
        guide({ slug: 'bravo', title: 'Alpha', sectionSlug: 'basics' }),
      ];

      expect(rankGuideSources('alpha', sources).map(({ source }) => `${source.sectionSlug}/${source.slug}`)).toEqual([
        'basics/bravo',
        'combat/alpha',
        'combat/zulu',
      ]);
    });

    it('should order exact, prefix, and substring matches independently in every category', () => {
      const robots: RobotSearchSource[] = [
        { id: 3, name: 'Scout Beacon', stableName: null },
        { id: 2, name: 'Beacon Mk II', stableName: null },
        { id: 1, name: 'BEACON', stableName: null },
      ];
      const stables: StableSearchSource[] = [
        { userId: 3, stableName: 'Scout Beacon' },
        { userId: 2, stableName: 'Beacon Mk II' },
        { userId: 1, stableName: 'BEACON' },
      ];
      const guides: GuideSearchSource[] = [
        guide({ slug: 'substring', title: 'Guide to Beacon' }),
        guide({ slug: 'prefix', title: 'Beacon Mk II' }),
        guide({ slug: 'exact', title: 'BEACON' }),
      ];

      expect(rankRobotSources('beacon', robots).map(({ rank }) => rank)).toEqual(['exact', 'prefix', 'substring']);
      expect(rankStableSources('beacon', stables).map(({ rank }) => rank)).toEqual(['exact', 'prefix', 'substring']);
      expect(rankGuideSources('beacon', guides).map(({ rank }) => rank)).toEqual(['exact', 'prefix', 'substring']);
    });

    it('should return no fuzzy match for misspellings or non-contiguous characters', () => {
      const sources: RobotSearchSource[] = [{ id: 1, name: 'Alpha robot', stableName: null }];

      expect(classifyMatch('alhpa', 'alpha')).toBeNull();
      expect(classifyMatch('robt', 'robot')).toBeNull();
      expect(rankRobotSources('alhpa', sources)).toEqual([]);
    });

    it('should produce the same order for permuted sources in every category and not mutate input', () => {
      const robots: RobotSearchSource[] = [
        { id: 4, name: 'Pilot', stableName: null },
        { id: 2, name: 'Pilot', stableName: null },
        { id: 3, name: 'X Pilot', stableName: null },
      ];
      const stables: StableSearchSource[] = [
        { userId: 4, stableName: 'Pilot' },
        { userId: 2, stableName: 'Pilot' },
        { userId: 3, stableName: 'X Pilot' },
      ];
      const guides: GuideSearchSource[] = [
        guide({ slug: 'zulu', title: 'Pilot', sectionSlug: 'combat' }),
        guide({ slug: 'alpha', title: 'Pilot', sectionSlug: 'combat' }),
        guide({ slug: 'bravo', title: 'X Pilot', sectionSlug: 'combat' }),
      ];
      const robotOriginal = [...robots];
      const stableOriginal = [...stables];
      const guideOriginal = [...guides];
      const robotPermutation = [robots[2], robots[0], robots[1]];
      const stablePermutation = [stables[2], stables[0], stables[1]];
      const guidePermutation = [guides[2], guides[0], guides[1]];

      expect(rankRobotSources('pilot', robots)).toEqual(rankRobotSources('pilot', robotPermutation));
      expect(rankStableSources('pilot', stables)).toEqual(rankStableSources('pilot', stablePermutation));
      expect(rankGuideSources('pilot', guides)).toEqual(rankGuideSources('pilot', guidePermutation));
      expect(robots).toEqual(robotOriginal);
      expect(stables).toEqual(stableOriginal);
      expect(guides).toEqual(guideOriginal);
    });
  });

  describe('limits', () => {
    it('should cap a category after ranking without mutating the ranked input', () => {
      const ranked = Array.from({ length: 12 }, (_, index) => index);
      const limited = limitCategoryResults(ranked, 12);

      expect(limited).toHaveLength(MAX_RESULTS_PER_CATEGORY);
      expect(limited).toEqual(ranked.slice(0, MAX_RESULTS_PER_CATEGORY));
      expect(ranked).toHaveLength(12);
    });

    it('should clamp lower and fractional requested limits to safe boundaries', () => {
      const ranked = [0, 1, 2, 3];

      expect(limitCategoryResults(ranked, -1)).toEqual([]);
      expect(limitCategoryResults(ranked, 0)).toEqual([]);
      expect(limitCategoryResults(ranked, 2.9)).toEqual([0, 1]);

      const moreThanCategoryLimit = Array.from({ length: 12 }, (_, index) => index);
      expect(limitCategoryResults(moreThanCategoryLimit)).toHaveLength(MAX_RESULTS_PER_CATEGORY);
    });

    it('should apply limits independently and keep the combined category total bounded', () => {
      const robots = Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        name: `Alpha robot ${index + 1}`,
        stableName: null,
      }));
      const stables = Array.from({ length: 12 }, (_, index) => ({
        userId: index + 1,
        stableName: `Alpha stable ${index + 1}`,
      }));
      const guides = Array.from({ length: 12 }, (_, index) =>
        guide({ slug: `article-${index + 1}`, title: `Alpha article ${index + 1}` }),
      );

      const limitedGroups = [
        limitCategoryResults(rankRobotSources('alpha', robots)),
        limitCategoryResults(rankStableSources('alpha', stables)),
        limitCategoryResults(rankGuideSources('alpha', guides)),
      ];

      expect(limitedGroups.map((group) => group.length)).toEqual([
        MAX_RESULTS_PER_CATEGORY,
        MAX_RESULTS_PER_CATEGORY,
        MAX_RESULTS_PER_CATEGORY,
      ]);
      expect(limitedGroups.reduce((total, group) => total + group.length, 0)).toBeLessThanOrEqual(
        MAX_TOTAL_RESULTS,
      );
    });
  });
});
