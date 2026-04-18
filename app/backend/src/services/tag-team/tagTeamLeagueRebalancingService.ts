import { TagTeam } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { LeagueError, LeagueErrorCode } from '../../errors/leagueErrors';

// NOTE: This service mirrors leagueRebalancingService.ts for 1v1 leagues.
// Both share identical promotion/demotion logic but operate on different Prisma models
// (TagTeam vs Robot) with different field names. If you change thresholds or logic here,
// apply the same change to the 1v1 version.
import { 
  assignTagTeamLeagueInstance, 
  rebalanceTagTeamInstances,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier 
} from './tagTeamLeagueInstanceService';
import { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// Promotion/Demotion thresholds
const PROMOTION_PERCENTAGE = 0.10; // Top 10%
const DEMOTION_PERCENTAGE = 0.10; // Bottom 10%
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5; // Must be in current league for 5+ cycles
const MIN_TEAMS_FOR_REBALANCING = 10;

// Re-export for consumers that need the helper
export { getMinLPForPromotion } from '../league/leaguePromotionThresholds';

// Re-export from instance service for convenience
export { TAG_TEAM_LEAGUE_TIERS, TagTeamLeagueTier };

export interface TagTeamRebalancingSummary {
  tier: TagTeamLeagueTier;
  teamsInTier: number;
  promoted: number;
  demoted: number;
  eligibleTeams: number;
}

export interface FullTagTeamRebalancingSummary {
  totalTeams: number;
  totalPromoted: number;
  totalDemoted: number;
  tierSummaries: TagTeamRebalancingSummary[];
  errors: string[];
}

/**
 * Determine which teams should be promoted from a SPECIFIC INSTANCE
 * Requirement 6.3: Promote top 10% of eligible teams (≥5 cycles in tier AND per-tier LP threshold)
 * LP thresholds: Bronze→Silver 25, Silver→Gold 50, Gold→Platinum 75, Platinum→Diamond 100, Diamond→Champion 125
 * @param instanceId - The specific league instance to evaluate (e.g., "bronze_1")
 * @param excludeTeamIds - Set of team IDs to exclude (already processed in this cycle)
 */
export async function determinePromotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TagTeam[]> {
  const tier = instanceId.split('_')[0] as TagTeamLeagueTier;
  
  // Champion tier has no promotions
  if (tier === 'champion') {
    return [];
  }

  // Get the per-tier LP threshold for promotion
  const minLP = getMinLPForPromotion(tier);

  // Get all teams in this INSTANCE with minimum cycles AND minimum league points
  const teamsWithMinPoints = await prisma.tagTeam.findMany({
    where: {
      tagTeamLeagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInTagTeamLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      tagTeamLeaguePoints: {
        gte: minLP,
      },
      NOT: {
        id: { in: Array.from(excludeTeamIds) },
      },
    },
    orderBy: [
      { tagTeamLeaguePoints: 'desc' },
      { id: 'asc' }, // Tiebreaker
    ],
  });

  // If no teams meet the minimum points threshold, skip
  if (teamsWithMinPoints.length === 0) {
    logger.info(
      `[TagTeamRebalancing] ${instanceId}: No teams with ≥${minLP} league points (${tier} tier threshold), skipping promotions`
    );
    return [];
  }

  // Get total eligible teams in this INSTANCE (for calculating top 10%)
  const totalEligibleTeams = await prisma.tagTeam.count({
    where: {
      tagTeamLeagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInTagTeamLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      NOT: {
        id: { in: Array.from(excludeTeamIds) },
      },
    },
  });

  // Skip if too few teams (Requirement 6.3: ≥10 teams in instance)
  if (totalEligibleTeams < MIN_TEAMS_FOR_REBALANCING) {
    logger.info(
      `[TagTeamRebalancing] ${instanceId}: Too few eligible teams (${totalEligibleTeams} < ${MIN_TEAMS_FOR_REBALANCING}), skipping promotions`
    );
    return [];
  }

  // Calculate top 10% of all eligible teams in this INSTANCE
  const promotionCount = Math.floor(totalEligibleTeams * PROMOTION_PERCENTAGE);

  if (promotionCount === 0) {
    logger.info(
      `[TagTeamRebalancing] ${instanceId}: Promotion count is 0 (${totalEligibleTeams} eligible teams), skipping`
    );
    return [];
  }

  // Take the top 10%, but only from teams meeting the per-tier LP threshold
  const toPromote = teamsWithMinPoints.slice(0, Math.min(promotionCount, teamsWithMinPoints.length));
  
  logger.info(
    `[TagTeamRebalancing] ${instanceId}: ${toPromote.length} teams eligible for promotion (top ${PROMOTION_PERCENTAGE * 100}% of ${totalEligibleTeams} AND ≥${minLP} league points [${tier} tier], ${teamsWithMinPoints.length} met points threshold)`
  );

  return toPromote;
}

/**
 * Determine which teams should be demoted from a SPECIFIC INSTANCE
 * Requirement 6.4: Demote bottom 10% of eligible teams (≥5 cycles in tier)
 * @param instanceId - The specific league instance to evaluate (e.g., "silver_1")
 * @param excludeTeamIds - Set of team IDs to exclude (already processed in this cycle)
 */
export async function determineDemotions(
  instanceId: string,
  excludeTeamIds: Set<number> = new Set()
): Promise<TagTeam[]> {
  const tier = instanceId.split('_')[0] as TagTeamLeagueTier;
  
  // Bronze tier has no demotions
  if (tier === 'bronze') {
    return [];
  }

  // Get all teams in this INSTANCE with minimum cycles in current league
  const teams = await prisma.tagTeam.findMany({
    where: {
      tagTeamLeagueId: instanceId, // CHANGED: Query by instance, not tier
      cyclesInTagTeamLeague: {
        gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING,
      },
      NOT: {
        id: { in: Array.from(excludeTeamIds) },
      },
    },
    orderBy: [
      { tagTeamLeaguePoints: 'asc' },
      { id: 'asc' }, // Tiebreaker
    ],
  });

  // Skip if too few teams (Requirement 6.4: ≥10 teams in instance)
  if (teams.length < MIN_TEAMS_FOR_REBALANCING) {
    logger.info(
      `[TagTeamRebalancing] ${instanceId}: Too few teams (${teams.length} < ${MIN_TEAMS_FOR_REBALANCING}), skipping demotions`
    );
    return [];
  }

  // Calculate bottom 10% of this INSTANCE
  const demotionCount = Math.floor(teams.length * DEMOTION_PERCENTAGE);

  if (demotionCount === 0) {
    logger.info(
      `[TagTeamRebalancing] ${instanceId}: Demotion count is 0 (${teams.length} teams), skipping`
    );
    return [];
  }

  const toDemote = teams.slice(0, demotionCount);
  logger.info(
    `[TagTeamRebalancing] ${instanceId}: ${toDemote.length} teams eligible for demotion (bottom ${DEMOTION_PERCENTAGE * 100}% of ${teams.length})`
  );

  return toDemote;
}

/**
 * Get the next tier up
 */
function getNextTierUp(currentTier: TagTeamLeagueTier): TagTeamLeagueTier | null {
  const currentIndex = TAG_TEAM_LEAGUE_TIERS.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === TAG_TEAM_LEAGUE_TIERS.length - 1) {
    return null; // Already at top
  }
  return TAG_TEAM_LEAGUE_TIERS[currentIndex + 1];
}

/**
 * Get the next tier down
 */
function getNextTierDown(currentTier: TagTeamLeagueTier): TagTeamLeagueTier | null {
  const currentIndex = TAG_TEAM_LEAGUE_TIERS.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === 0) {
    return null; // Already at bottom
  }
  return TAG_TEAM_LEAGUE_TIERS[currentIndex - 1];
}

/**
 * Promote a team to the next tier
 * CHANGED: LP retention - league points are NOT reset to 0
 * Requirement 6.6: Reset cycles counter to 0
 * Requirement 6.7, 6.8: Assign to appropriate instance
 */
export async function promoteTeam(team: TagTeam): Promise<void> {
  const nextTier = getNextTierUp(team.tagTeamLeague as TagTeamLeagueTier);

  if (!nextTier) {
    throw new LeagueError(
      LeagueErrorCode.PROMOTION_BLOCKED,
      `Cannot promote team ${team.id} from ${team.tagTeamLeague} - already at top tier`,
      400,
      { teamId: team.id, currentLeague: team.tagTeamLeague }
    );
  }

  // Assign to new instance (handles max 50 teams per instance)
  const newLeagueId = await assignTagTeamLeagueInstance(nextTier);

  // Update team - RETAIN league points
  await prisma.tagTeam.update({
    where: { id: team.id },
    data: {
      tagTeamLeague: nextTier,
      tagTeamLeagueId: newLeagueId,
      // tagTeamLeaguePoints: REMOVED - LP retained across promotions
      cyclesInTagTeamLeague: 0, // Reset cycles counter for new league
    },
  });

  logger.info(
    `[TagTeamRebalancing] Promoted: Team ${team.id} (${team.tagTeamLeague} → ${nextTier}, instance ${newLeagueId}, LP: ${team.tagTeamLeaguePoints} retained)`
  );
}

/**
 * Demote a team to the previous tier
 * CHANGED: LP retention - league points are NOT reset to 0
 * Requirement 6.6: Reset cycles counter to 0
 * Requirement 6.7, 6.8: Assign to appropriate instance
 */
export async function demoteTeam(team: TagTeam): Promise<void> {
  const previousTier = getNextTierDown(team.tagTeamLeague as TagTeamLeagueTier);

  if (!previousTier) {
    throw new LeagueError(
      LeagueErrorCode.RELEGATION_BLOCKED,
      `Cannot demote team ${team.id} from ${team.tagTeamLeague} - already at bottom tier`,
      400,
      { teamId: team.id, currentLeague: team.tagTeamLeague }
    );
  }

  // Assign to new instance (handles max 50 teams per instance)
  const newLeagueId = await assignTagTeamLeagueInstance(previousTier);

  // Update team - RETAIN league points
  await prisma.tagTeam.update({
    where: { id: team.id },
    data: {
      tagTeamLeague: previousTier,
      tagTeamLeagueId: newLeagueId,
      // tagTeamLeaguePoints: REMOVED - LP retained across demotions
      cyclesInTagTeamLeague: 0, // Reset cycles counter for new league
    },
  });

  logger.info(
    `[TagTeamRebalancing] Demoted: Team ${team.id} (${team.tagTeamLeague} → ${previousTier}, instance ${newLeagueId}, LP: ${team.tagTeamLeaguePoints} retained)`
  );
}

/**
 * Rebalance a single league tier - INSTANCE-BASED
 * CHANGED: Process each instance separately instead of entire tier
 * @param tier - The league tier to rebalance
 * @param excludeTeamIds - Set of team IDs already processed in this cycle
 */
async function rebalanceTier(
  tier: TagTeamLeagueTier,
  excludeTeamIds: Set<number>
): Promise<TagTeamRebalancingSummary> {
  logger.info(`\n[TagTeamRebalancing] Processing ${tier.toUpperCase()} league...`);

  // Count total teams in tier
  const totalInTier = await prisma.tagTeam.count({
    where: {
      tagTeamLeague: tier,
    },
  });

  const summary: TagTeamRebalancingSummary = {
    tier,
    teamsInTier: totalInTier,
    promoted: 0,
    demoted: 0,
    eligibleTeams: 0,
  };

  // Get all instances for this tier
  const instances = await prisma.tagTeam.findMany({
    where: { tagTeamLeague: tier },
    select: { tagTeamLeagueId: true },
    distinct: ['tagTeamLeagueId'],
  });

  const instanceIds = instances.map(i => i.tagTeamLeagueId);
  
  logger.info(`[TagTeamRebalancing] ${tier}: ${totalInTier} total teams across ${instanceIds.length} instances`);

  // Process each instance separately
  for (const instanceId of instanceIds) {
    logger.info(`[TagTeamRebalancing] Processing ${instanceId}...`);
    
    // Count eligible teams in this instance
    const eligibleInInstance = await prisma.tagTeam.count({
      where: {
        tagTeamLeagueId: instanceId,
        cyclesInTagTeamLeague: { gte: MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING },
        NOT: {
          id: { in: Array.from(excludeTeamIds) },
        },
      },
    });
    
    summary.eligibleTeams += eligibleInInstance;

    // Skip if too few teams in this instance
    if (eligibleInInstance < MIN_TEAMS_FOR_REBALANCING) {
      logger.info(`[TagTeamRebalancing] ${instanceId}: Skipping (${eligibleInInstance} eligible, need ${MIN_TEAMS_FOR_REBALANCING})`);
      continue;
    }

    // Determine promotions for this instance
    const toPromote = await determinePromotions(instanceId, excludeTeamIds);

    // Determine demotions for this instance
    const toDemote = await determineDemotions(instanceId, excludeTeamIds);

    // Execute promotions
    for (const team of toPromote) {
      try {
        await promoteTeam(team);
        excludeTeamIds.add(team.id); // Mark as processed
        summary.promoted++;
      } catch (error) {
        logger.error(`[TagTeamRebalancing] Error promoting team ${team.id}:`, error);
      }
    }

    // Execute demotions
    for (const team of toDemote) {
      try {
        await demoteTeam(team);
        excludeTeamIds.add(team.id); // Mark as processed
        summary.demoted++;
      } catch (error) {
        logger.error(`[TagTeamRebalancing] Error demoting team ${team.id}:`, error);
      }
    }
  }

  logger.info(
    `[TagTeamRebalancing] ${tier}: Promoted ${summary.promoted}, Demoted ${summary.demoted} across ${instanceIds.length} instances`
  );

  return summary;
}

/**
 * Rebalance all tag team league tiers
 * This should be called every other cycle (odd cycles only)
 */
export async function rebalanceTagTeamLeagues(): Promise<FullTagTeamRebalancingSummary> {
  logger.info('═'.repeat(60));
  logger.info('[TagTeamRebalancing] Starting tag team league rebalancing...');
  logger.info('═'.repeat(60));

  const fullSummary: FullTagTeamRebalancingSummary = {
    totalTeams: 0,
    totalPromoted: 0,
    totalDemoted: 0,
    tierSummaries: [],
    errors: [],
  };

  // Get total team count
  fullSummary.totalTeams = await prisma.tagTeam.count();

  logger.info(`[TagTeamRebalancing] Total teams in system: ${fullSummary.totalTeams}`);

  // Track which teams have already been processed in this cycle
  const processedTeamIds = new Set<number>();

  // Process each tier (bottom to top to avoid conflicts)
  for (const tier of TAG_TEAM_LEAGUE_TIERS) {
    try {
      const summary = await rebalanceTier(tier, processedTeamIds);
      fullSummary.tierSummaries.push(summary);
      fullSummary.totalPromoted += summary.promoted;
      fullSummary.totalDemoted += summary.demoted;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      fullSummary.errors.push(`${tier}: ${errorMsg}`);
      logger.error(`[TagTeamRebalancing] Error in tier ${tier}:`, error);
    }
  }

  logger.info('\n' + '═'.repeat(60));
  logger.info('[TagTeamRebalancing] Tag team league rebalancing complete!');
  logger.info(`  Total promoted: ${fullSummary.totalPromoted}`);
  logger.info(`  Total demoted: ${fullSummary.totalDemoted}`);
  logger.info(`  Errors: ${fullSummary.errors.length}`);
  logger.info('═'.repeat(60) + '\n');

  // Rebalance instances across all tiers (Requirement 6.8)
  logger.info('[TagTeamRebalancing] Rebalancing instances across all tiers...');
  for (const tier of TAG_TEAM_LEAGUE_TIERS) {
    try {
      await rebalanceTagTeamInstances(tier);
    } catch (error) {
      logger.error(`[TagTeamRebalancing] Error balancing ${tier} instances:`, error);
      fullSummary.errors.push(`Instance balancing for ${tier}: ${error}`);
    }
  }

  return fullSummary;
}
