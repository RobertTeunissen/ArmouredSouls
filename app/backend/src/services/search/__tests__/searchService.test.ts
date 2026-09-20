import { AppError } from '../../../errors';
import {
  GuideSearchIndexProvider,
  RobotSearchRecord,
  SearchDatabase,
  SearchService,
  StableSearchRecord,
} from '../searchService';
import { GuideSearchSource, SearchResponse } from '../searchTypes';

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

function expectSafeResponseDtos(response: SearchResponse): void {
  for (const result of response.robots) {
    expect(Object.keys(result).sort()).toEqual(
      ['category', 'id', 'label', ...(result.subtitle === undefined ? [] : ['subtitle'])].sort(),
    );
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

describe('SearchService', () => {
  it('should return three empty groups without accessing any source for a short query', async () => {
    const { database, guideIndex } = createDependencies();
    const service = new SearchService({ database, guideIndex });

    await expect(service.search('  a ')).resolves.toEqual({
      robots: [],
      stables: [],
      guide: [],
    });
    expect(database.robot.findMany).not.toHaveBeenCalled();
    expect(database.user.findMany).not.toHaveBeenCalled();
    expect(guideIndex.getSearchIndex).not.toHaveBeenCalled();
  });

  it('should query only approved fields and return independently ranked safe groups', async () => {
    const { database, guideIndex } = createDependencies();
    const robotRecords: RobotSearchRecord[] = [
      { id: 2, name: 'Alpha Two', user: { stableName: '  Iron House ' } },
      { id: 1, name: 'Alpha', user: { stableName: null } },
    ];
    const stableRecords: StableSearchRecord[] = [
      { id: 8, stableName: '  Alpha Stable ' },
      { id: 9, stableName: 'Bravo Stable' },
    ];
    const guideSources = [
      guide({
        slug: 'alpha-guide',
        title: 'Alpha Guide',
        sectionSlug: 'combat',
        sectionTitle: 'Combat',
        bodyText: 'The alpha guide body',
      }),
    ];

    (database.robot.findMany as jest.Mock).mockResolvedValue(robotRecords);
    (database.user.findMany as jest.Mock).mockResolvedValue(stableRecords);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue(guideSources);

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
      robots: [
        { category: 'robots', id: 1, label: 'Alpha' },
        { category: 'robots', id: 2, label: 'Alpha Two', subtitle: 'Iron House' },
      ],
      stables: [{ category: 'stables', userId: 8, label: 'Alpha Stable' }],
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
    expect(result).toEqual(expect.not.objectContaining({ username: expect.anything() }));
    expectSafeResponseDtos(result);
  });

  it('should pass the normalized query as a parameter value rather than composing query syntax', async () => {
    const { database, guideIndex } = createDependencies();
    const query = "  alpha' OR 1=1 --  ";
    (database.robot.findMany as jest.Mock).mockResolvedValue([]);
    (database.user.findMany as jest.Mock).mockResolvedValue([]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    await new SearchService({ database, guideIndex }).search(query);

    expect(database.robot.findMany).toHaveBeenCalledWith({
      where: { name: { contains: query.trim(), mode: 'insensitive' } },
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
          { stableName: { contains: query.trim(), mode: 'insensitive' } },
        ],
      },
      select: { id: true, stableName: true },
      take: 10,
    });
    expect((database.robot.findMany as jest.Mock).mock.calls[0][0].where).not.toHaveProperty('$queryRaw');
    expect((database.user.findMany as jest.Mock).mock.calls[0][0].where).not.toHaveProperty('$queryRaw');
    expect(guideIndex.getSearchIndex).toHaveBeenCalledTimes(1);
  });

  it('should use the GuideService search index for title, description, and body matching', async () => {
    const { database, guideIndex } = createDependencies();
    const guideSources = [
      guide({ slug: 'body-match', title: 'Combat Manual', description: 'Guide reference', bodyText: 'Guide alpha details' }),
      guide({ slug: 'prefix-match', title: 'Combat Manual', description: 'Alpha starts here' }),
      guide({ slug: 'exact-match', title: 'ALPHA' }),
      guide({ slug: 'not-a-match', title: 'Combat Manual', description: 'Guide reference', bodyText: 'No matching term' }),
    ];

    (database.robot.findMany as jest.Mock).mockResolvedValue([]);
    (database.user.findMany as jest.Mock).mockResolvedValue([]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue(guideSources);

    const result = await new SearchService({ database, guideIndex }).search('alpha');

    expect(guideIndex.getSearchIndex).toHaveBeenCalledTimes(1);
    expect(result.guide.map((entry) => entry.articleSlug)).toEqual([
      'exact-match',
      'prefix-match',
      'body-match',
    ]);
    expectSafeResponseDtos(result);
    expect(JSON.stringify(result)).not.toContain('Guide reference');
    expect(JSON.stringify(result)).not.toContain('Guide alpha details');
  });

  it('should rank exact, prefix, and substring matches in every group before excluding non-matches', async () => {
    const { database, guideIndex } = createDependencies();
    (database.robot.findMany as jest.Mock).mockResolvedValue([
      { id: 30, name: 'Robot alpha', user: { stableName: null } },
      { id: 20, name: 'Alpha Bot', user: { stableName: null } },
      { id: 10, name: 'ALPHA', user: { stableName: null } },
      { id: 40, name: 'Aplha typo', user: { stableName: null } },
    ]);
    (database.user.findMany as jest.Mock).mockResolvedValue([
      { id: 30, stableName: 'Stable alpha' },
      { id: 20, stableName: 'Alpha Stable' },
      { id: 10, stableName: 'ALPHA' },
      { id: 40, stableName: 'Aplha typo' },
    ]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    const result = await new SearchService({ database, guideIndex }).search('alpha');

    expect(result.robots.map((entry) => entry.id)).toEqual([10, 20, 30]);
    expect(result.stables.map((entry) => entry.userId)).toEqual([10, 20, 30]);
  });

  it('should apply the category limit after ranking and preserve the fixed group order', async () => {
    const { database, guideIndex } = createDependencies();
    const robotRecords: RobotSearchRecord[] = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `Robot stable ${index + 1}`,
      user: { stableName: null },
    }));
    const stableRecords: StableSearchRecord[] = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      stableName: `Stable ${index + 1}`,
    }));
    const guideSources = Array.from({ length: 12 }, (_, index) =>
      guide({
        slug: `article-${index + 1}`,
        title: `Stable article ${index + 1}`,
        bodyText: 'guide content',
      }),
    );

    (database.robot.findMany as jest.Mock).mockResolvedValue(robotRecords);
    (database.user.findMany as jest.Mock).mockResolvedValue(stableRecords);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue(guideSources);

    const result = await new SearchService({ database, guideIndex }).search('stable');

    expect(Object.keys(result)).toEqual(['robots', 'stables', 'guide']);
    expect(result.robots).toHaveLength(10);
    expect(result.stables).toHaveLength(10);
    expect(result.guide).toHaveLength(10);
    expect(result.guide.every((entry) => entry.category === 'guide')).toBe(true);
    expect(result.robots.length + result.stables.length + result.guide.length).toBe(30);
    expectSafeResponseDtos(result);
  });

  it('should use the bounded Prisma raw-query path in production and keep test doubles on model methods', async () => {
    const { database, guideIndex } = createDependencies();
    const queryRaw = jest.fn()
      .mockResolvedValueOnce([
        { id: 1, name: 'Wildcard %_ Robot', stableName: 'Stable' },
      ])
      .mockResolvedValueOnce([
        { id: 2, stableName: 'Wildcard %_ Stable' },
      ]);
    database.$queryRaw = queryRaw;
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    const result = await new SearchService({ database, guideIndex }).search('%_');

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(queryRaw.mock.calls.every(([query]) => (
      query as unknown as { values?: unknown[] }
    ).values?.includes(10))).toBe(true);
    expect(database.robot.findMany).not.toHaveBeenCalled();
    expect(database.user.findMany).not.toHaveBeenCalled();
    expect(result.robots).toEqual([{ category: 'robots', id: 1, label: 'Wildcard %_ Robot', subtitle: 'Stable' }]);
    expect(result.stables).toEqual([{ category: 'stables', userId: 2, label: 'Wildcard %_ Stable' }]);
  });

  it('should bound raw-query candidate materialization for normal, wildcard, and adversarial inputs', async () => {
    const { database, guideIndex } = createDependencies();
    const queryRaw = jest.fn().mockResolvedValue([]);
    database.$queryRaw = queryRaw;
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    for (const query of ['alpha', '%_', "' OR 1=1 --"]) {
      await new SearchService({ database, guideIndex }).search(query);
    }

    expect(queryRaw).toHaveBeenCalledTimes(6);
    expect(queryRaw.mock.calls.every(([query]) => (
      query as unknown as { values?: unknown[] }
    ).values?.includes(10))).toBe(true);
    expect(database.robot.findMany).not.toHaveBeenCalled();
    expect(database.user.findMany).not.toHaveBeenCalled();
  });

  it('should convert source failures into a generic safe search error', async () => {
    const { database, guideIndex } = createDependencies();
    (database.robot.findMany as jest.Mock).mockRejectedValue(
      new Error('database query leaked ALPHA and private path details'),
    );
    (database.user.findMany as jest.Mock).mockResolvedValue([]);
    (guideIndex.getSearchIndex as jest.Mock).mockReturnValue([]);

    const error = await new SearchService({ database, guideIndex }).search('ALPHA').catch((value: unknown) => value);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      message: 'Search is temporarily unavailable',
    });
    expect((error as Error).message).not.toContain('ALPHA');
    expect((error as Error).message).not.toContain('private path');
  });
});
