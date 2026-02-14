import prisma from '../lib/prisma';

// Tag team league tiers in order
export const TAG_TEAM_LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type TagTeamLeagueTier = typeof TAG_TEAM_LEAGUE_TIERS[number];

// Maximum teams per league instance (Requirement 6.7)
export const MAX_TEAMS_PER_INSTANCE = 50;

// Threshold for triggering instance rebalancing (Requirement 6.8)
export const REBALANCE_THRESHOLD = 20;

export interface TagTeamLeagueInstance {
  leagueId: string;
  tier: TagTeamLeagueTier;
  instanceNumber: number;
  currentTeams: number;
  maxTeams: number;
  isFull: boolean;
}

export interface TagTeamLeagueInstanceStats {
  tier: TagTeamLeagueTier;
  instances: TagTeamLeagueInstance[];
  totalTeams: number;
  averagePerInstance: number;
  needsRebalancing: boolean;
}

/**
 * Get all instances for a specific tag team league tier
 */
export async function getInstancesForTier(tier: TagTeamLeagueTier): Promise<TagTeamLeagueInstance[]> {
  // Query tag teams grouped by tagTeamLeagueId for this tier
  const instances = await prisma.tagTeam.groupBy({
    by: ['tagTeamLeagueId'],
    where: {
      tagTeamLeague: tier,
    },
    _count: {
      id: true,
    },
  });

  // Parse instance data
  const leagueInstances: TagTeamLeagueInstance[] = instances.map((instance) => {
    const instanceNumber = parseInt(instance.tagTeamLeagueId.split('_')[1] || '1');
    const currentTeams = instance._count.id;

    return {
      leagueId: instance.tagTeamLeagueId,
      tier,
      instanceNumber,
      currentTeams,
      maxTeams: MAX_TEAMS_PER_INSTANCE,
      isFull: currentTeams >= MAX_TEAMS_PER_INSTANCE,
    };
  });

  // Sort by instance number
  return leagueInstances.sort((a, b) => a.instanceNumber - b.instanceNumber);
}

/**
 * Get statistics for a tag team league tier
 */
export async function getTagTeamLeagueInstanceStats(tier: TagTeamLeagueTier): Promise<TagTeamLeagueInstanceStats> {
  const instances = await getInstancesForTier(tier);
  const totalTeams = instances.reduce((sum, inst) => sum + inst.currentTeams, 0);
  const averagePerInstance = instances.length > 0 ? totalTeams / instances.length : 0;

  // Check if rebalancing is needed (Requirement 6.8):
  // 1. Any instance deviates more than threshold (20) from average
  // 2. Any instance exceeds the maximum team limit (50)
  const needsRebalancing = instances.some((inst) => 
    Math.abs(inst.currentTeams - averagePerInstance) > REBALANCE_THRESHOLD ||
    inst.currentTeams > MAX_TEAMS_PER_INSTANCE
  );

  return {
    tier,
    instances,
    totalTeams,
    averagePerInstance,
    needsRebalancing,
  };
}

/**
 * Assign a tag team to an appropriate league instance
 * Requirement 6.7: Maximum 50 teams per instance
 * Requirement 6.8: Create new instance when 51st team would be added
 * Places team in instance with most free spots
 * 
 * This function uses PostgreSQL advisory locks to prevent race conditions
 * when multiple teams are created concurrently. The lock ensures that only
 * one assignment operation can happen at a time for a given tier.
 */
export async function assignTagTeamLeagueInstance(tier: TagTeamLeagueTier): Promise<string> {
  // Use a transaction with advisory lock to ensure atomic read-check-assign operation
  return await prisma.$transaction(async (tx) => {
    // Acquire an advisory lock for this tier (using a hash of the tier name)
    // This ensures only one assignment can happen at a time for this tier
    const lockId = hashTierName(tier);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Query instances within the transaction to get the latest state
    const instances = await tx.tagTeam.groupBy({
      by: ['tagTeamLeagueId'],
      where: {
        tagTeamLeague: tier,
      },
      _count: {
        id: true,
      },
    });

    if (instances.length === 0) {
      // No instances exist yet, create first one
      return `${tier}_1`;
    }

    // Parse and sort instances by team count
    const leagueInstances = instances
      .map((instance) => {
        const instanceNumber = parseInt(instance.tagTeamLeagueId.split('_')[1] || '1');
        return {
          leagueId: instance.tagTeamLeagueId,
          instanceNumber,
          currentTeams: instance._count.id,
        };
      })
      .sort((a, b) => a.currentTeams - b.currentTeams);

    // Find instance with most free spots
    const leastFull = leagueInstances[0];

    if (leastFull.currentTeams >= MAX_TEAMS_PER_INSTANCE) {
      // All instances are full, create new one
      const nextInstanceNumber = Math.max(...leagueInstances.map((i) => i.instanceNumber)) + 1;
      return `${tier}_${nextInstanceNumber}`;
    }

    return leastFull.leagueId;
  });
  // Advisory lock is automatically released when transaction commits/rolls back
}

/**
 * Hash a tier name to a consistent integer for advisory locking
 * Uses a simple hash function to convert tier names to lock IDs
 */
function hashTierName(tier: string): number {
  let hash = 0;
  for (let i = 0; i < tier.length; i++) {
    hash = ((hash << 5) - hash) + tier.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Ensure positive integer and within PostgreSQL advisory lock range
  return Math.abs(hash) % 2147483647;
}

/**
 * Create a tag team with proper instance assignment and concurrency control
 * This function wraps the entire team creation process in a transaction with
 * advisory locking to prevent race conditions.
 * 
 * @param teamData - The team data to create (without tagTeamLeagueId)
 * @param tier - The league tier for the team
 * @returns The created team with assigned instance
 */
export async function createTagTeamWithInstanceAssignment(
  teamData: {
    stableId: number;
    activeRobotId: number;
    reserveRobotId: number;
    tagTeamLeaguePoints?: number;
    cyclesInTagTeamLeague?: number;
  },
  tier: TagTeamLeagueTier
): Promise<any> {
  return await prisma.$transaction(async (tx) => {
    // Acquire an advisory lock for this tier
    const lockId = hashTierName(tier);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

    // Query instances within the transaction to get the latest state
    const instances = await tx.tagTeam.groupBy({
      by: ['tagTeamLeagueId'],
      where: {
        tagTeamLeague: tier,
      },
      _count: {
        id: true,
      },
    });

    let assignedLeagueId: string;

    if (instances.length === 0) {
      // No instances exist yet, create first one
      assignedLeagueId = `${tier}_1`;
    } else {
      // Parse and sort instances by team count
      const leagueInstances = instances
        .map((instance) => {
          const instanceNumber = parseInt(instance.tagTeamLeagueId.split('_')[1] || '1');
          return {
            leagueId: instance.tagTeamLeagueId,
            instanceNumber,
            currentTeams: instance._count.id,
          };
        })
        .sort((a, b) => a.currentTeams - b.currentTeams);

      // Find instance with most free spots
      const leastFull = leagueInstances[0];

      if (leastFull.currentTeams >= MAX_TEAMS_PER_INSTANCE) {
        // All instances are full, create new one
        const nextInstanceNumber = Math.max(...leagueInstances.map((i) => i.instanceNumber)) + 1;
        assignedLeagueId = `${tier}_${nextInstanceNumber}`;
      } else {
        assignedLeagueId = leastFull.leagueId;
      }
    }

    // Create the team within the same transaction
    const team = await tx.tagTeam.create({
      data: {
        ...teamData,
        tagTeamLeague: tier,
        tagTeamLeagueId: assignedLeagueId,
        tagTeamLeaguePoints: teamData.tagTeamLeaguePoints ?? 0,
        cyclesInTagTeamLeague: teamData.cyclesInTagTeamLeague ?? 0,
      },
    });

    return team;
  });
  // Advisory lock is automatically released when transaction commits/rolls back
}

/**
 * Rebalance tag teams across instances in a tier
 * Requirement 6.8: Balance teams across instances when deviation >20
 * Redistributes teams when deviation exceeds threshold
 */
export async function rebalanceTagTeamInstances(tier: TagTeamLeagueTier): Promise<void> {
  const stats = await getTagTeamLeagueInstanceStats(tier);

  if (!stats.needsRebalancing) {
    console.log(`[TagTeamLeagueInstance] ${tier} instances balanced, no action needed`);
    return;
  }

  console.log(`[TagTeamLeagueInstance] Rebalancing ${tier} instances...`);
  console.log(`  Total teams: ${stats.totalTeams}`);
  console.log(`  Instances: ${stats.instances.length}`);
  console.log(`  Average per instance: ${stats.averagePerInstance.toFixed(1)}`);

  // Get all teams in this tier
  const allTeams = await prisma.tagTeam.findMany({
    where: {
      tagTeamLeague: tier,
    },
    orderBy: [
      { tagTeamLeaguePoints: 'desc' },
      { id: 'asc' }, // Use ID as tiebreaker for consistency
    ],
  });

  // Calculate how many instances we need
  // Use at least the current number of instances to avoid consolidation during rebalancing
  const minInstanceCount = Math.ceil(stats.totalTeams / MAX_TEAMS_PER_INSTANCE);
  const targetInstanceCount = Math.max(minInstanceCount, stats.instances.length);
  const teamsPerInstance = Math.ceil(stats.totalTeams / targetInstanceCount);

  console.log(`  Target instances: ${targetInstanceCount}`);
  console.log(`  Teams per instance: ${teamsPerInstance}`);

  // Redistribute teams evenly
  const updates: Promise<any>[] = [];
  
  for (let i = 0; i < allTeams.length; i++) {
    const team = allTeams[i];
    const targetInstanceNumber = Math.floor(i / teamsPerInstance) + 1;
    const targetLeagueId = `${tier}_${targetInstanceNumber}`;

    if (team.tagTeamLeagueId !== targetLeagueId) {
      updates.push(
        prisma.tagTeam.update({
          where: { id: team.id },
          data: { tagTeamLeagueId: targetLeagueId },
        })
      );
    }
  }

  await Promise.all(updates);
  console.log(`[TagTeamLeagueInstance] Rebalanced ${updates.length} teams across ${targetInstanceCount} instances`);
}

/**
 * Get all teams in a specific instance
 */
export async function getTeamsInInstance(leagueId: string): Promise<any[]> {
  return prisma.tagTeam.findMany({
    where: { tagTeamLeagueId: leagueId },
    include: {
      activeRobot: {
        select: {
          id: true,
          name: true,
          elo: true,
        },
      },
      reserveRobot: {
        select: {
          id: true,
          name: true,
          elo: true,
        },
      },
    },
    orderBy: [
      { tagTeamLeaguePoints: 'desc' },
      { id: 'asc' },
    ],
  });
}

/**
 * Move team to a different instance (used during promotion/demotion)
 */
export async function moveTeamToInstance(teamId: number, newTier: TagTeamLeagueTier): Promise<void> {
  const targetLeagueId = await assignTagTeamLeagueInstance(newTier);
  
  await prisma.tagTeam.update({
    where: { id: teamId },
    data: {
      tagTeamLeague: newTier,
      tagTeamLeagueId: targetLeagueId,
    },
  });
}

/**
 * Get standings for a specific tag team league instance
 * Requirement 9.3: Sort by league points (descending), then ELO (descending)
 * Includes team rank calculation
 */
export async function getStandingsForInstance(leagueId: string): Promise<any[]> {
  const teams = await prisma.tagTeam.findMany({
    where: { tagTeamLeagueId: leagueId },
    include: {
      activeRobot: {
        select: {
          id: true,
          name: true,
          elo: true,
        },
      },
      reserveRobot: {
        select: {
          id: true,
          name: true,
          elo: true,
        },
      },
    },
  });

  // Calculate combined ELO for each team and sort
  const teamsWithELO = teams.map(team => ({
    ...team,
    combinedELO: team.activeRobot.elo + team.reserveRobot.elo,
  }));

  // Sort by league points (descending), then combined ELO (descending)
  teamsWithELO.sort((a, b) => {
    if (b.tagTeamLeaguePoints !== a.tagTeamLeaguePoints) {
      return b.tagTeamLeaguePoints - a.tagTeamLeaguePoints;
    }
    return b.combinedELO - a.combinedELO;
  });

  // Add rank to each team
  return teamsWithELO.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));
}

/**
 * Get standings for an entire tag team league tier (all instances combined)
 * Requirement 9.3: Sort by league points (descending), then ELO (descending)
 * Includes team rank calculation
 */
export async function getStandingsForTier(tier: TagTeamLeagueTier): Promise<any[]> {
  const teams = await prisma.tagTeam.findMany({
    where: { tagTeamLeague: tier },
    include: {
      activeRobot: {
        select: {
          id: true,
          name: true,
          elo: true,
        },
      },
      reserveRobot: {
        select: {
          id: true,
          name: true,
          elo: true,
        },
      },
      stable: {
        select: {
          stableName: true,
        },
      },
    },
  });

  // Calculate combined ELO for each team and sort
  const teamsWithELO = teams.map(team => ({
    ...team,
    combinedELO: team.activeRobot.elo + team.reserveRobot.elo,
  }));

  // Sort by league points (descending), then combined ELO (descending)
  teamsWithELO.sort((a, b) => {
    if (b.tagTeamLeaguePoints !== a.tagTeamLeaguePoints) {
      return b.tagTeamLeaguePoints - a.tagTeamLeaguePoints;
    }
    return b.combinedELO - a.combinedELO;
  });

  // Add rank to each team
  return teamsWithELO.map((team, index) => ({
    ...team,
    rank: index + 1,
  }));
}

