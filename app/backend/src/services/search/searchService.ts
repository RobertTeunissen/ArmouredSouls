import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import guideService from '../common/guide-service';
import { AppError } from '../../errors';
import {
  buildGuideSearchResult,
  buildRobotSearchResult,
  buildStableSearchResult,
} from './searchReferenceBuilder';
import {
  limitCategoryResults,
  normalizeSearchQuery,
  rankGuideSources,
  rankRobotSources,
  rankStableSources,
} from './searchRanking';
import {
  GuideSearchSource,
  MAX_TOTAL_RESULTS,
  MINIMUM_QUERY_LENGTH,
  RobotSearchSource,
  SearchResponse,
  StableSearchSource,
} from './searchTypes';

/** The selected robot fields returned by the search source query. */
export interface RobotSearchRecord {
  id: number;
  name: string;
  user: {
    stableName: string | null;
  };
}

/** The selected stable fields returned by the search source query. */
export interface StableSearchRecord {
  id: number;
  stableName: string | null;
}

/** The narrow database surface required by the search service. */
export interface SearchDatabase {
  robot: {
    findMany(args: {
      where: Prisma.RobotWhereInput;
      select: {
        id: true;
        name: true;
        user: { select: { stableName: true } };
      };
    }): Promise<RobotSearchRecord[]>;
  };
  user: {
    findMany(args: {
      where: Prisma.UserWhereInput;
      select: {
        id: true;
        stableName: true;
      };
    }): Promise<StableSearchRecord[]>;
  };
}

/** The guide-index surface required by the search service. */
export interface GuideSearchIndexProvider {
  getSearchIndex(): GuideSearchSource[];
}

export interface SearchServiceDependencies {
  database?: SearchDatabase;
  guideIndex?: GuideSearchIndexProvider;
}

const ROBOT_SELECT = {
  id: true,
  name: true,
  user: { select: { stableName: true } },
} as const;

const STABLE_SELECT = {
  id: true,
  stableName: true,
} as const;

function emptySearchResponse(): SearchResponse {
  return {
    robots: [],
    stables: [],
    guide: [],
  };
}

/**
 * Applies the response-wide bound without introducing a cross-category rank.
 * Category groups are already independently ranked and remain in fixed order.
 */
function limitTotalResults(response: SearchResponse): SearchResponse {
  let remaining = MAX_TOTAL_RESULTS;

  const take = <T>(results: T[]): T[] => {
    const count = Math.min(remaining, results.length);
    remaining -= count;
    return results.slice(0, count);
  };

  return {
    robots: take(response.robots),
    stables: take(response.stables),
    guide: take(response.guide),
  };
}

/**
 * Authenticated MVP search orchestration.
 *
 * Authentication and request identity are intentionally owned by the route
 * boundary. This service never accepts identity, ownership, visibility, or
 * arbitrary route data from the query and searches only the approved public
 * source fields.
 */
export class SearchService {
  private readonly database: SearchDatabase;
  private readonly guideIndex: GuideSearchIndexProvider;

  constructor(dependencies: SearchServiceDependencies = {}) {
    this.database = dependencies.database ?? (prisma as unknown as SearchDatabase);
    this.guideIndex = dependencies.guideIndex ?? guideService;
  }

  /**
   * Returns fixed, independently ranked robots/stables/guide groups.
   *
   * A valid short query returns before touching Prisma or the guide index.
   * Source failures are converted to a generic AppError so the existing error
   * boundary cannot expose database, filesystem, or query details.
   */
  async search(query: string): Promise<SearchResponse> {
    const normalizedQuery = normalizeSearchQuery(query);
    if (normalizedQuery.length < MINIMUM_QUERY_LENGTH) {
      return emptySearchResponse();
    }

    try {
      const [robotRecords, stableRecords, guideSources] = await Promise.all([
        this.database.robot.findMany({
          where: {
            name: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          select: ROBOT_SELECT,
        }),
        this.database.user.findMany({
          where: {
            AND: [
              { stableName: { not: null } },
              { stableName: { not: '' } },
              {
                stableName: {
                  contains: normalizedQuery,
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: STABLE_SELECT,
        }),
        Promise.resolve(this.guideIndex.getSearchIndex()),
      ]);

      const robotSources: RobotSearchSource[] = robotRecords.map((record) => ({
        id: record.id,
        name: record.name,
        stableName: record.user.stableName,
      }));
      const stableSources: StableSearchSource[] = stableRecords.map((record) => ({
        userId: record.id,
        stableName: record.stableName,
      }));

      return limitTotalResults({
        robots: limitCategoryResults(
          rankRobotSources(normalizedQuery, robotSources).map(({ source }) =>
            buildRobotSearchResult(source),
          ),
        ),
        stables: limitCategoryResults(
          rankStableSources(normalizedQuery, stableSources)
            .map(({ source }) => buildStableSearchResult(source))
            .filter((result): result is NonNullable<typeof result> => result !== null),
        ),
        guide: limitCategoryResults(
          rankGuideSources(normalizedQuery, guideSources).map(({ source }) =>
            buildGuideSearchResult(source),
          ),
        ),
      });
    } catch {
      throw new AppError('INTERNAL_ERROR', 'Search is temporarily unavailable', 500);
    }
  }
}

export const searchService = new SearchService();
export default searchService;
