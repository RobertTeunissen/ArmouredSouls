import { AppError } from '../../../errors';
import {
  GuideSearchIndexProvider,
  RobotSearchRecord,
  SearchDatabase,
  SearchService,
  StableSearchRecord,
} from '../searchService';
import { GuideSearchSource, SearchResponse } from '../searchTypes';

type RobotFixture = RobotSearchRecord & {
  username: string;
  team: string;
  weapon: string;
  battleHistory: string;
  route: string;
};

type StableFixture = StableSearchRecord & {
  username: string;
  profileVisibility: string;
  isGenerated: boolean;
  route: string;
};

type GuideFixture = GuideSearchSource & {
  body: string;
  privateMetadata: string;
  route: string;
};

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

function createDependencies(): {
  database: SearchDatabase;
  guideIndex: GuideSearchIndexProvider;
} {
  return {
    database: {
      robot: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    },
    guideIndex: { getSearchIndex: jest.fn() },
  };
}

function expectFixedResponseShape(response: SearchResponse): void {
  expect(Object.keys(response)).toEqual(['robots', 'stables', 'guide']);
  expect(response.robots.every((result) => result.category === 'robots')).toBe(true);
  expect(response.stables.every((result) => result.category === 'stables')).toBe(true);
  expect(response.guide.every((result) => result.category === 'guide')).toBe(true);

  for (const result of response.robots) {
    expect(Object.keys(result).sort()).toEqual(['category', 'id', 'label', ...(result.subtitle ? ['subtitle'] : [])].sort());
  }
  for (const result of response.stables) {
    expect(Object.keys(result).sort()).toEqual(['category', 'label', 'userId'].sort());
  }
  for (const result of response.guide) {
    expect(Object.keys(result).sort()).toEqual(
      ['articleSlug', 'category', 'sectionSlug', 'sectionTitle', 'title'].sort(),
    );
  }
}

describe('SearchService API contract', () => {
  it('should query only approved sources and return only safe grouped references', async () => {
    const { database, guideIndex } = createDependencies();
    const robotRecord: RobotFixture = {
      id: 11,
      name: 'Alpha Robot',
      user: { stableName: '  Iron House  ' },
      username: 'private-account',
      team: 'secret-team',
      weapon: 'secret-weapon',
      battleHistory: 'private-battle-history',
      route: '/arbitrary-route',
    };
    const stableRecord: StableFixture = {
      id: 12,
      stableName: '  Alpha Stable  ',
      username: 'private-account',
      profileVisibility: 'private',
      isGenerated: true,
      route: '/arbitrary-route',
    };
    const guideSource: GuideFixture = {
      ...guide({
        slug: 'alpha-guide',
        title: 'Alpha Guide',
        sectionSlug: 'combat',
        sectionTitle: 'Combat',
        description: 'Private description used only for matching',
        bodyText: 'Private article body used only for matching',
      }),
      body: 'forbidden body alias',
      privateMetadata: 'forbidden metadata',
      route: '/arbitrary-route',
    };

    (database.robot.findMany as jest.Mock).mockResolvedValue([robotRecord]);
    (database.user.findMany as jest.Mock).mockResolvedValue([stableRecord]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([guideSource]);

    const result = await new SearchService({ database, guideIndex }).search(' ALPHA ');

    expect(database.robot.findMany).toHaveBeenCalledWith({
      where: { name: { contains: 'ALPHA', mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        user: { select: { stableName: true } },
      },
      take: 10,
    });
    expect(database.user.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { stableName: { not: null } },
          { stableName: { not: '' } },
          { stableName: { contains: 'ALPHA', mode: 'insensitive' } },
        ],
      },
      select: { id: true, stableName: true },
      take: 10,
    });
    expect(guideIndex.getSearchIndex).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      robots: [{ category: 'robots', id: 11, label: 'Alpha Robot', subtitle: 'Iron House' }],
      stables: [{ category: 'stables', userId: 12, label: 'Alpha Stable' }],
      guide: [
        {
          category: 'guide',
          title: 'Alpha Guide',
          sectionTitle: 'Combat',
          sectionSlug: 'combat',
          articleSlug: 'alpha-guide',
        },
      ],
    });
    expectFixedResponseShape(result);

    const serialized = JSON.stringify(result);
    for (const forbiddenField of [
      'username',
      'team',
      'weapon',
      'battleHistory',
      'profileVisibility',
      'isGenerated',
      'privateMetadata',
      'route',
      'bodyText',
      'description',
    ]) {
      expect(serialized).not.toContain(forbiddenField);
    }
    for (const forbiddenValue of [
      'private-account',
      'secret-team',
      'secret-weapon',
      'private-battle-history',
      'forbidden metadata',
      '/arbitrary-route',
      'Private article body used only for matching',
    ]) {
      expect(serialized).not.toContain(forbiddenValue);
    }
  });

  it('should pass normalized query text as a parameter value rather than composing query syntax', async () => {
    const { database, guideIndex } = createDependencies();
    const query = "  alpha' OR 1=1 --  ";
    (database.robot.findMany as jest.Mock).mockResolvedValue([]);
    (database.user.findMany as jest.Mock).mockResolvedValue([]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    await new SearchService({ database, guideIndex }).search(query);

    expect(database.robot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: query.trim(), mode: 'insensitive' } },
      }),
    );
    expect(database.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { stableName: { not: null } },
            { stableName: { not: '' } },
            { stableName: { contains: query.trim(), mode: 'insensitive' } },
          ],
        },
      }),
    );
    expect((database.robot.findMany as jest.Mock).mock.calls[0][0].where).not.toHaveProperty('$queryRaw');
    expect((database.user.findMany as jest.Mock).mock.calls[0][0].where).not.toHaveProperty('$queryRaw');
  });

  it('should rank exact, prefix, and substring matches independently and exclude non-matches', async () => {
    const { database, guideIndex } = createDependencies();
    (database.robot.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Robot alpha', user: { stableName: null } },
      { id: 2, name: 'Alpha Bot', user: { stableName: null } },
      { id: 3, name: 'ALPHA', user: { stableName: null } },
      { id: 4, name: 'Aplha typo', user: { stableName: null } },
    ]);
    (database.user.findMany as jest.Mock).mockResolvedValue([
      { id: 1, stableName: 'Stable alpha' },
      { id: 2, stableName: 'Alpha Stable' },
      { id: 3, stableName: 'ALPHA' },
      { id: 4, stableName: 'Aplha typo' },
    ]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([
      guide({ slug: 'substring', title: 'Guide alpha' }),
      guide({ slug: 'prefix', title: 'Alpha guide' }),
      guide({ slug: 'exact', title: 'ALPHA' }),
      guide({ slug: 'no-match', title: 'Aplha typo' }),
    ]);

    const result = await new SearchService({ database, guideIndex }).search('alpha');

    expect(result.robots.map((resultItem) => resultItem.id)).toEqual([3, 2, 1]);
    expect(result.stables.map((resultItem) => resultItem.userId)).toEqual([3, 2, 1]);
    expect(result.guide.map((resultItem) => resultItem.articleSlug)).toEqual(['exact', 'prefix', 'substring']);
  });

  it('should enforce per-category and total response bounds', async () => {
    const { database, guideIndex } = createDependencies();
    (database.robot.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        name: `Robot stable ${index + 1}`,
        user: { stableName: null },
      })),
    );
    (database.user.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        stableName: `Stable ${index + 1}`,
      })),
    );
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue(
      Array.from({ length: 12 }, (_, index) =>
        guide({ slug: `article-${index + 1}`, title: `Stable article ${index + 1}` }),
      ),
    );

    const result = await new SearchService({ database, guideIndex }).search('stable');

    expectFixedResponseShape(result);
    expect(result.robots).toHaveLength(10);
    expect(result.stables).toHaveLength(10);
    expect(result.guide).toHaveLength(10);
    expect(result.robots.length + result.stables.length + result.guide.length).toBeLessThanOrEqual(30);
  });

  it('should convert dependency failures to a safe error without exposing query or source details', async () => {
    const { database, guideIndex } = createDependencies();
    const query = 'private search phrase';
    (database.robot.findMany as jest.Mock).mockRejectedValue(
      new Error(`database query failed for ${query} at /private/database/path`),
    );
    (database.user.findMany as jest.Mock).mockResolvedValue([]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    const error = await new SearchService({ database, guideIndex }).search(query).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      message: 'Search is temporarily unavailable',
    });
    expect(JSON.stringify(error)).not.toContain(query);
    expect(JSON.stringify(error)).not.toContain('/private/database/path');
  });
});
