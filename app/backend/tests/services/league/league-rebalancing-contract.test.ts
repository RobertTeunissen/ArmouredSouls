import { Standing, StandingsMode } from '../../../generated/prisma';

const mockStandingFindMany = jest.fn();
const mockStandingCount = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    standing: {
      findMany: mockStandingFindMany,
      count: mockStandingCount,
    },
    robot: { findUnique: jest.fn().mockResolvedValue(null) },
    teamBattle: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../src/services/league/leagueHistoryService', () => ({
  getCurrentCycleNumber: jest.fn().mockResolvedValue(1),
  recordTierChange: jest.fn().mockResolvedValue(undefined),
}));

import {
  LeagueAdapter,
  LeagueEngineConfig,
  rebalanceAllTiers,
} from '../../../src/services/league/leagueEngine';
import { getLeagueTierPreview } from '../../../src/services/league/league-rebalancing-preview';
import { HEAD_TO_HEAD_LEAGUE_RULES } from '../../../src/services/league/league-rules';
import {
  ROBOT_LEAGUE_CONFIG,
  robotAdapter,
} from '../../../src/services/league/leagueRebalancingService';
import {
  TEAM_BATTLE_LEAGUE_CONFIG,
  tagTeamLeagueAdapter,
  teamBattle2v2Adapter,
  teamBattle3v3Adapter,
} from '../../../src/services/team-battle/teamBattleAdapter';
import { TAG_TEAM_LEAGUE_CONFIG } from '../../../src/services/tag-team/tagTeamLeagueRebalancingService';

function standing(
  entityId: number,
  leagueInstanceId: string,
  leaguePoints: number,
): Standing {
  return {
    entityId,
    leagueInstanceId,
    leaguePoints,
    tier: 'silver',
    cyclesInTier: 5,
  } as unknown as Standing;
}

describe('canonical league rebalancing contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should combine split-instance candidates before applying the empty-tier cohort rule', async () => {
    const standings = [
      ...Array.from({ length: 10 }, (_, index) => standing(index + 1, 'silver_1', 100 - index)),
      ...Array.from({ length: 20 }, (_, index) => standing(index + 11, 'silver_2', 100 - index)),
    ];
    mockStandingFindMany.mockResolvedValue(standings);
    mockStandingCount.mockResolvedValue(0);

    const preview = await getLeagueTierPreview(
      StandingsMode.league_1v1,
      'silver',
      HEAD_TO_HEAD_LEAGUE_RULES,
      'silver_1',
    );

    expect(mockStandingFindMany).toHaveBeenCalledWith({
      where: { mode: StandingsMode.league_1v1, tier: 'silver' },
    });
    expect(preview.instancePlansById.get('silver_1')?.promotionCandidates).toHaveLength(1);
    expect(preview.instancePlansById.get('silver_2')?.promotionCandidates).toHaveLength(2);
    expect(preview.plan.promotionCandidates).toHaveLength(3);
    expect(preview.plan.promotionBlockReason).toBeNull();
    expect(preview.effectivePromotionEntityIds).toEqual(new Set([1, 11, 12]));
  });

  it('should snapshot every tier before executing any movement', async () => {
    interface TestEntity {
      id: number;
      tier: string;
      leagueInstanceId: string;
      leaguePoints: number;
      cyclesInTier: number;
    }

    const bronze = Array.from({ length: 30 }, (_, index): TestEntity => ({
      id: index + 1,
      tier: 'bronze',
      leagueInstanceId: 'bronze_1',
      leaguePoints: 100 - index,
      cyclesInTier: 5,
    }));
    const silver = Array.from({ length: 10 }, (_, index): TestEntity => ({
      id: index + 101,
      tier: 'silver',
      leagueInstanceId: 'silver_1',
      leaguePoints: 100 - index,
      cyclesInTier: 5,
    }));
    const populations = new Map<string, TestEntity[]>([
      ['bronze_1', bronze],
      ['silver_1', silver],
    ]);
    const updates: Array<{ entityId: number; newTier: string }> = [];
    const updateCountsSeenWhilePlanning: number[] = [];

    const adapter: LeagueAdapter<TestEntity> = {
      entityType: 'robot',
      mode: 'league_1v1',
      async getEntitiesInInstance(instanceId): Promise<TestEntity[]> {
        updateCountsSeenWhilePlanning.push(updates.length);
        return [...(populations.get(instanceId) ?? [])];
      },
      async getInstancesForTier(tier): Promise<Array<{ leagueId: string }>> {
        return [{ leagueId: `${tier}_1` }];
      },
      async countEntitiesInTier(tier): Promise<number> {
        return populations.get(`${tier}_1`)?.length ?? 0;
      },
      async countEntitiesInDestinationTier(tier): Promise<number> {
        return populations.get(`${tier}_1`)?.length ?? 0;
      },
      async assignInstance(tier): Promise<string> {
        return `${tier}_1`;
      },
      async updateEntityLeague(entityId, newTier, newLeagueId): Promise<void> {
        let moved: TestEntity | undefined;
        for (const rows of populations.values()) {
          const index = rows.findIndex((entity) => entity.id === entityId);
          if (index >= 0) {
            [moved] = rows.splice(index, 1);
            break;
          }
        }
        if (!moved) throw new Error(`Missing entity ${entityId}`);
        populations.get(newLeagueId)?.push({
          ...moved,
          tier: newTier,
          leagueInstanceId: newLeagueId,
          cyclesInTier: 0,
        });
        updates.push({ entityId, newTier });
      },
      getEntityCurrentTier: (entity): string => entity.tier,
      getEntityLeagueId: (entity): string => entity.leagueInstanceId,
      getEntityLeaguePoints: (entity): number => entity.leaguePoints,
      getEntityCyclesInTier: (entity): number => entity.cyclesInTier,
      getEntityOwnerId: (entity): number => entity.id,
      getEntityDisplayName: (entity): string => `Entity ${entity.id}`,
      async rebalanceInstances(): Promise<void> {},
      async countAllEntities(): Promise<number> { return 40; },
    };
    const config: LeagueEngineConfig = {
      ...HEAD_TO_HEAD_LEAGUE_RULES,
      tiers: ['bronze', 'silver'],
      logPrefix: 'SnapshotTest',
      entityLabel: 'entity',
    };

    const result = await rebalanceAllTiers(config, adapter);

    expect(updateCountsSeenWhilePlanning).toEqual([0, 0]);
    expect(updates).toEqual([
      { entityId: 1, newTier: 'silver' },
      { entityId: 2, newTier: 'silver' },
      { entityId: 3, newTier: 'silver' },
      { entityId: 110, newTier: 'bronze' },
    ]);
    expect(result.totalPromoted).toBe(3);
    expect(result.totalDemoted).toBe(1);
  });

  it('should wire all four head-to-head modes to the same policy', () => {
    const modeWiring = [
      { mode: 'league_1v1', adapter: robotAdapter, config: ROBOT_LEAGUE_CONFIG },
      { mode: 'league_2v2', adapter: teamBattle2v2Adapter, config: TEAM_BATTLE_LEAGUE_CONFIG },
      { mode: 'league_3v3', adapter: teamBattle3v3Adapter, config: TEAM_BATTLE_LEAGUE_CONFIG },
      { mode: 'tag_team', adapter: tagTeamLeagueAdapter, config: TAG_TEAM_LEAGUE_CONFIG },
    ];

    expect(TEAM_BATTLE_LEAGUE_CONFIG.logPrefix).toBe('TeamBattleRebalancing');
    expect(TAG_TEAM_LEAGUE_CONFIG.logPrefix).toBe('TagTeamRebalancing');
    expect(TAG_TEAM_LEAGUE_CONFIG).not.toBe(TEAM_BATTLE_LEAGUE_CONFIG);
    for (const wiring of modeWiring) {
      expect(wiring.adapter.mode).toBe(wiring.mode);
      expect({
        promotionPercentage: wiring.config.promotionPercentage,
        demotionPercentage: wiring.config.demotionPercentage,
        minCyclesForRebalancing: wiring.config.minCyclesForRebalancing,
        minEntitiesForRebalancing: wiring.config.minEntitiesForRebalancing,
        minCohortForNewTier: wiring.config.minCohortForNewTier,
        tiers: wiring.config.tiers,
      }).toEqual(HEAD_TO_HEAD_LEAGUE_RULES);
    }
  });
});
