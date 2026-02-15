import { Robot, TagTeam } from '@prisma/client';
import prisma from '../lib/prisma';
import { checkBattleReadiness } from './matchmakingService';
import { assignTagTeamLeagueInstance } from './tagTeamLeagueInstanceService';


export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface TeamCreationResult {
  success: boolean;
  team?: TagTeam;
  errors?: string[];
}

export interface RobotReadinessStatus {
  isReady: boolean;
  reasons: string[];
}

export interface TeamReadinessResult {
  isReady: boolean;
  activeRobotStatus: RobotReadinessStatus;
  reserveRobotStatus: RobotReadinessStatus;
}

// Type for TagTeam with included robot details
export type TagTeamWithRobots = TagTeam & {
  activeRobot: Robot;
  reserveRobot: Robot;
  stable?: {
    stableName: string | null;
  };
};

/**
 * Validate that two robots can form a tag team
 * Requirements:
 * - Both robots must be from the same stable
 * - Both robots must meet battle readiness (HP ≥75%, HP > yield threshold, weapons equipped)
 * - No duplicate teams (same robot pair)
 * - Roster limit not exceeded (max teams = roster size / 2)
 */
export async function validateTeam(
  activeRobotId: number,
  reserveRobotId: number
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Fetch both robots
  const [activeRobot, reserveRobot] = await Promise.all([
    prisma.robot.findUnique({ where: { id: activeRobotId } }),
    prisma.robot.findUnique({ where: { id: reserveRobotId } }),
  ]);

  // Check if robots exist
  if (!activeRobot) {
    errors.push('Active robot not found');
  }
  if (!reserveRobot) {
    errors.push('Reserve robot not found');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Requirement 1.2: Both robots must be from same stable
  if (activeRobot!.userId !== reserveRobot!.userId) {
    errors.push('Robots must be from the same stable');
  }

  // Requirement 1.3: Both robots must meet battle readiness
  const activeReadiness = checkBattleReadiness(activeRobot!);
  const reserveReadiness = checkBattleReadiness(reserveRobot!);

  if (!activeReadiness.isReady) {
    errors.push(`Active robot not ready: ${activeReadiness.reasons.join(', ')}`);
  }

  if (!reserveReadiness.isReady) {
    errors.push(`Reserve robot not ready: ${reserveReadiness.reasons.join(', ')}`);
  }

  // Check if either robot is already in ANY team
  const activeRobotInTeam = await prisma.tagTeam.findFirst({
    where: {
      OR: [
        { activeRobotId: activeRobotId },
        { reserveRobotId: activeRobotId },
      ],
    },
  });

  if (activeRobotInTeam) {
    errors.push(`${activeRobot!.name} is already in another tag team`);
  }

  const reserveRobotInTeam = await prisma.tagTeam.findFirst({
    where: {
      OR: [
        { activeRobotId: reserveRobotId },
        { reserveRobotId: reserveRobotId },
      ],
    },
  });

  if (reserveRobotInTeam) {
    errors.push(`${reserveRobot!.name} is already in another tag team`);
  }

  // Requirement 1.5: Check roster limit (max teams = roster size / 2)
  const stableId = activeRobot!.userId;
  const [totalRobots, existingTeams] = await Promise.all([
    prisma.robot.count({ where: { userId: stableId } }),
    prisma.tagTeam.count({ where: { stableId } }),
  ]);

  const maxTeams = Math.floor(totalRobots / 2);
  if (existingTeams >= maxTeams) {
    errors.push(`Maximum number of teams reached (${maxTeams} teams for ${totalRobots} robots)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new tag team
 * Requirement 1.4: Save team configuration with designated active and reserve positions
 */
export async function createTeam(
  stableId: number,
  activeRobotId: number,
  reserveRobotId: number
): Promise<TeamCreationResult> {
  // Validate the team
  const validation = await validateTeam(activeRobotId, reserveRobotId);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  // Verify stable ownership
  const activeRobot = await prisma.robot.findUnique({
    where: { id: activeRobotId },
  });

  if (!activeRobot || activeRobot.userId !== stableId) {
    return {
      success: false,
      errors: ['You do not own these robots'],
    };
  }

  // Create the team
  try {
    // Requirement 6.7, 6.8: Assign to appropriate instance (max 50 teams per instance)
    const tagTeamLeagueId = await assignTagTeamLeagueInstance('bronze');

    const team = await prisma.tagTeam.create({
      data: {
        stableId,
        activeRobotId,
        reserveRobotId,
        tagTeamLeague: 'bronze',
        tagTeamLeagueId,
        tagTeamLeaguePoints: 0,
        cyclesInTagTeamLeague: 0,
        totalTagTeamWins: 0,
        totalTagTeamLosses: 0,
        totalTagTeamDraws: 0,
      },
    });

    console.log(`[TagTeam] Created team ${team.id} for stable ${stableId} in instance ${tagTeamLeagueId}`);

    return {
      success: true,
      team,
    };
  } catch (error) {
    console.error('[TagTeam] Error creating team:', error);
    return {
      success: false,
      errors: ['Failed to create team'],
    };
  }
}

/**
 * Get a team by ID
 * Requirement 9.2: Include robot details in responses
 */
export async function getTeamById(teamId: number): Promise<TagTeamWithRobots | null> {
  return prisma.tagTeam.findUnique({
    where: { id: teamId },
    include: {
      activeRobot: true,
      reserveRobot: true,
      stable: {
        select: {
          stableName: true,
        },
      },
    },
  });
}

/**
 * Get all teams for a stable
 * Requirement 9.1: Display all configured tag teams with robot details
 */
export async function getTeamsByStable(stableId: number): Promise<TagTeamWithRobots[]> {
  return prisma.tagTeam.findMany({
    where: { stableId },
    include: {
      activeRobot: true,
      reserveRobot: true,
      stable: {
        select: {
          stableName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Disband a team
 */
export async function disbandTeam(teamId: number, stableId: number): Promise<boolean> {
  try {
    // Verify ownership
    const team = await prisma.tagTeam.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      console.error(`[TagTeam] Team ${teamId} not found`);
      return false;
    }

    if (team.stableId !== stableId) {
      console.error(`[TagTeam] Stable ${stableId} does not own team ${teamId}`);
      return false;
    }

    // Delete the team
    await prisma.tagTeam.delete({
      where: { id: teamId },
    });

    console.log(`[TagTeam] Disbanded team ${teamId}`);
    return true;
  } catch (error) {
    console.error('[TagTeam] Error disbanding team:', error);
    return false;
  }
}

/**
 * Check team readiness for battle
 * Requirements 8.1, 8.2, 8.3:
 * - Both robots must have HP ≥75%
 * - Both robots must have HP > yield threshold
 * - Both robots must have all required weapons equipped
 */
export async function checkTeamReadiness(teamId: number): Promise<TeamReadinessResult> {
  const team = await prisma.tagTeam.findUnique({
    where: { id: teamId },
    include: {
      activeRobot: true,
      reserveRobot: true,
    },
  });

  if (!team) {
    return {
      isReady: false,
      activeRobotStatus: { isReady: false, reasons: ['Team not found'] },
      reserveRobotStatus: { isReady: false, reasons: ['Team not found'] },
    };
  }

  // Check readiness for both robots
  const activeReadiness = checkBattleReadiness(team.activeRobot);
  const reserveReadiness = checkBattleReadiness(team.reserveRobot);

  return {
    isReady: activeReadiness.isReady && reserveReadiness.isReady,
    activeRobotStatus: activeReadiness,
    reserveRobotStatus: reserveReadiness,
  };
}

/**
 * Calculate combined ELO for a tag team
 * Requirement 2.1: Sum active robot ELO + reserve robot ELO
 */
export async function calculateCombinedELO(teamId: number): Promise<number> {
  const team = await prisma.tagTeam.findUnique({
    where: { id: teamId },
    include: {
      activeRobot: true,
      reserveRobot: true,
    },
  });

  if (!team) {
    throw new Error(`Team ${teamId} not found`);
  }

  return team.activeRobot.elo + team.reserveRobot.elo;
}
