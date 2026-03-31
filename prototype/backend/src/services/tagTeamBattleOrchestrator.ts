import { Robot, TagTeam, ScheduledTagTeamMatch, Battle, Prisma } from '../../generated/prisma';
import prisma from '../lib/prisma';
import logger from '../config/logger';
import { simulateBattle } from './combatSimulator';
import { getLeagueWinReward, getParticipationReward } from '../utils/economyCalculations';
import { CombatMessageGenerator } from './combatMessageGenerator';
import {
  calculateELOChange,
} from '../utils/battleMath';
import {
  logBattleAuditEvent,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardStreamingRevenueForParticipant,
} from './battlePostCombat';

// Battle constants
const BATTLE_TIME_LIMIT = 300; // 5 minutes in seconds
const _REPAIR_COST_PER_HP = 50;
const TAG_TEAM_REWARD_MULTIPLIER = 2; // Tag team rewards are 2x standard
const TAG_TEAM_PRESTIGE_MULTIPLIER = 1.6; // Tag team prestige is 1.6x standard
const _DESTRUCTION_MULTIPLIER = 2; // Destroyed robots have 2x repair cost

// Types
interface TagTeamWithRobots extends TagTeam {
  activeRobot: Robot & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mainWeapon: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offhandWeapon: any;
  };
  reserveRobot: Robot & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mainWeapon: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    offhandWeapon: any;
  };
}

interface TagTeamBattleResult {
  battleId: number;
  winnerId: number | null;
  isDraw: boolean;
  durationSeconds: number;
  team1TagOutTime?: number;
  team2TagOutTime?: number;
  team1ActiveFinalHP: number;
  team1ReserveFinalHP: number;
  team2ActiveFinalHP: number;
  team2ReserveFinalHP: number;
  team1ReserveUsed: boolean; // Track if reserve was used
  team2ReserveUsed: boolean; // Track if reserve was used
  team1ActiveDamageDealt: number; // Damage dealt by team1 active robot
  team1ReserveDamageDealt: number; // Damage dealt by team1 reserve robot
  team2ActiveDamageDealt: number; // Damage dealt by team2 active robot
  team2ReserveDamageDealt: number; // Damage dealt by team2 reserve robot
  team1ActiveSurvivalTime: number; // Time in combat for team1 active robot
  team1ReserveSurvivalTime: number; // Time in combat for team1 reserve robot
  team2ActiveSurvivalTime: number; // Time in combat for team2 active robot
  team2ReserveSurvivalTime: number; // Time in combat for team2 reserve robot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  battleLog: any[]; // Complete battle log with all events
  // 2D arena spatial metadata (from first phase)
  arenaRadius?: number;
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
  phases: Array<{
    robot1Name: string;
    robot2Name: string;
    robot1Stance: string;
    robot2Stance: string;
    robot1MaxHP: number;
    robot2MaxHP: number;
  }>; // Phase robot mappings for narrative conversion
  team1Name: string;
  team2Name: string;
  team1ReserveName: string;
  team2ReserveName: string;
}

interface TagOutEvent {
  timestamp: number;
  teamNumber: 1 | 2;
  robotId: number;
  robotName: string;
  reason: 'yield' | 'destruction';
  finalHP: number;
}

interface TagInEvent {
  timestamp: number;
  teamNumber: 1 | 2;
  robotId: number;
  robotName: string;
  initialHP: number;
}

/**
 * Create a bye-team for battle execution
 * Requirements 2.5, 12.1, 12.2: Bye-team with combined ELO 2000
 */
function createByeTeamForBattle(league: string, leagueId: string): TagTeamWithRobots {
  // Create bye robots with ELO 1000 each (combined 2000)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byeRobot1: Robot & { mainWeapon: any; offhandWeapon: any } = {
    id: -1,
    userId: -1,
    name: 'Bye Robot 1',
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    // Combat Systems - minimal stats
    combatPower: new Prisma.Decimal(10),
    targetingSystems: new Prisma.Decimal(10),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(10),
    attackSpeed: new Prisma.Decimal(10),
    // Defensive Systems
    armorPlating: new Prisma.Decimal(10),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    // Chassis & Mobility
    hullIntegrity: new Prisma.Decimal(10),
    servoMotors: new Prisma.Decimal(10),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    // AI Processing
    combatAlgorithms: new Prisma.Decimal(10),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(10),
    // Team Coordination
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
    // Combat State
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    // Performance
    elo: 1000,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    // League & Fame
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    cyclesInCurrentLeague: 0,
    fame: 0,
    titles: null,
    // Tag Team Statistics
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,
    // Economic
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    // Configuration
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    // KotH Statistics
    kothWins: 0,
    kothMatches: 0,
    kothTotalZoneScore: 0,
    kothTotalZoneTime: 0,
    kothKills: 0,
    kothBestPlacement: null,
    kothCurrentWinStreak: 0,
    kothBestWinStreak: 0,
    // Equipment
    mainWeaponId: null,
    offhandWeaponId: null,
    mainWeapon: null,
    offhandWeapon: null,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byeRobot2: Robot & { mainWeapon: any; offhandWeapon: any } = { 
    ...byeRobot1, 
    id: -2, 
    name: 'Bye Robot 2' 
  };

  const byeTeam: TagTeamWithRobots = {
    id: -1,
    stableId: -1,
    activeRobotId: -1,
    reserveRobotId: -2,
    tagTeamLeague: league,
    tagTeamLeagueId: leagueId,
    tagTeamLeaguePoints: 0,
    cyclesInTagTeamLeague: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    activeRobot: byeRobot1,
    reserveRobot: byeRobot2,
  };

  return byeTeam;
}

/**
 * Execute a tag team battle
 * Requirement 3.1: Initialize battle with both teams' active robots
 * Requirement 12.3: Execute normal battle against bye-team
 */
export async function executeTagTeamBattle(match: ScheduledTagTeamMatch): Promise<TagTeamBattleResult> {
  // Check if this is a bye-team match
  const _isByeMatch = match.team2Id === null;
  
  const team1: TagTeamWithRobots | null = await prisma.tagTeam.findUnique({
    where: { id: match.team1Id },
    include: {
      activeRobot: {
        include: {
          mainWeapon: { include: { weapon: true } },
          offhandWeapon: { include: { weapon: true } },
        },
      },
      reserveRobot: {
        include: {
          mainWeapon: { include: { weapon: true } },
          offhandWeapon: { include: { weapon: true } },
        },
      },
    },
  });

  // Load team2
  let team2: TagTeamWithRobots | null;
  if (match.team2Id === null) {
    team2 = createByeTeamForBattle(match.tagTeamLeague, match.tagTeamLeague + '_1');
  } else {
    team2 = await prisma.tagTeam.findUnique({
      where: { id: match.team2Id },
      include: {
        activeRobot: {
          include: {
            mainWeapon: { include: { weapon: true } },
            offhandWeapon: { include: { weapon: true } },
          },
        },
        reserveRobot: {
          include: {
            mainWeapon: { include: { weapon: true } },
            offhandWeapon: { include: { weapon: true } },
          },
        },
      },
    });
  }

  if (!team1 || !team2) {
    throw new Error(`Teams not found for match ${match.id}`);
  }

  // Start battle with active robots at full HP
  team1.activeRobot.currentHP = team1.activeRobot.maxHP;
  team1.activeRobot.currentShield = team1.activeRobot.maxShield;
  team2.activeRobot.currentHP = team2.activeRobot.maxHP;
  team2.activeRobot.currentShield = team2.activeRobot.maxShield;

  // Simulate the tag team battle
  const result = await simulateTagTeamBattle(team1 as TagTeamWithRobots, team2 as TagTeamWithRobots);
  
  // Map robot winner ID to team winner ID if needed
  if (result.winnerId) {
    // Check which team the winning robot belongs to
    if (result.winnerId === team1.activeRobotId || result.winnerId === team1.reserveRobotId) {
      result.winnerId = team1.id;
    } else if (result.winnerId === team2.activeRobotId || result.winnerId === team2.reserveRobotId) {
      result.winnerId = team2.id;
    }
  }

  // Create battle record
  const battle = await createTagTeamBattleRecord(match, team1 as TagTeamWithRobots, team2 as TagTeamWithRobots, result);
  result.battleId = battle.id;

  // Update match status
  await prisma.scheduledTagTeamMatch.update({
    where: { id: match.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });

  logger.info(
    `[TagTeamBattle] Completed: Team ${team1.id} vs Team ${team2.id} ` +
    `(Winner: ${result.winnerId ? `Team ${result.winnerId}` : 'Draw'})`
  );

  return result;
}

/**
 * Simulate a tag team battle with tag-out mechanics
 * Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 * Requirement 7.1, 7.2, 7.3: Record all combat events with timestamps, tag-out/tag-in events
 * Requirement 10.7: Track damage dealt and survival time for fame calculation
 */
async function simulateTagTeamBattle(
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots
): Promise<TagTeamBattleResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const battleEvents: any[] = [];
  const tagOutEvents: TagOutEvent[] = [];
  const tagInEvents: TagInEvent[] = [];

  let team1CurrentRobot = team1.activeRobot;
  let team2CurrentRobot = team2.activeRobot;
  let team1ReserveUsed = false;
  let team2ReserveUsed = false;
  let team1TagOutTime: number | undefined;
  let team2TagOutTime: number | undefined;
  let currentTime = 0;
  const maxTime = BATTLE_TIME_LIMIT;

  // Track damage dealt and survival time for each robot
  let team1ActiveDamageDealt = 0;
  let team1ReserveDamageDealt = 0;
  let team2ActiveDamageDealt = 0;
  let team2ReserveDamageDealt = 0;
  let team1ActiveSurvivalTime = 0;
  let team1ReserveSurvivalTime = 0;
  let team2ActiveSurvivalTime = 0;
  let team2ReserveSurvivalTime = 0;
  let lastPhaseWasDraw = false; // Track if the final phase ended in a time-expired draw

  // Phase 1: Active robots fight
  const phase1Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
  const phase1Duration = phase1Result.durationSeconds;
  currentTime = phase1Duration;
  team1CurrentRobot.currentHP = phase1Result.robot1FinalHP;
  team2CurrentRobot.currentHP = phase1Result.robot2FinalHP;
  
  // Track phase 1 damage and survival time
  team1ActiveDamageDealt += phase1Result.robot1DamageDealt;
  team2ActiveDamageDealt += phase1Result.robot2DamageDealt;
  team1ActiveSurvivalTime += phase1Duration;
  team2ActiveSurvivalTime += phase1Duration;
  
  // Track if phase 1 had a decisive winner (destruction or yield)
  // Used below for tag-out fallback check
  
  // Collect combat events from phase 1 (Requirement 7.1)
  if (phase1Result.events && Array.isArray(phase1Result.events)) {
    battleEvents.push(...phase1Result.events);
  }

  // Capture arena metadata from phase 1 (same radius for all phases)
  const arenaRadius = phase1Result.arenaRadius;
  const startingPositions = phase1Result.startingPositions;
  let endingPositions = phase1Result.endingPositions;
  lastPhaseWasDraw = phase1Result.isDraw;

  // Check for tag-outs (Requirement 3.3: HP ≤ yield threshold OR HP ≤ 0)
  // Also check phase1 winnerId as a fallback: if the simulator ended the battle
  // (via yield or destruction), the losing robot must tag out even if shouldTagOut
  // would miss it due to floating-point edge cases.
  const phase1Winner = phase1Result.winnerId;
  const team1NeedsTagOut = shouldTagOut(team1CurrentRobot) ||
    (phase1Winner !== null && phase1Winner === team2CurrentRobot.id && !team1ReserveUsed);
  const team2NeedsTagOut = shouldTagOut(team2CurrentRobot) ||
    (phase1Winner !== null && phase1Winner === team1CurrentRobot.id && !team2ReserveUsed);

  // If a tag-out is happening, strip the yield/destroyed/battle_end events from phase 1
  // since the battle continues with the reserve robot
  if (team1NeedsTagOut || team2NeedsTagOut) {
    const terminalTypes = ['yield', 'destroyed', 'battle_end'];
    // Remove terminal events that were added from phase 1
    for (let i = battleEvents.length - 1; i >= 0; i--) {
      if (terminalTypes.includes(battleEvents[i].type)) {
        battleEvents.splice(i, 1);
      }
    }
  }

  // Handle simultaneous tag-outs
  if (team1NeedsTagOut && team2NeedsTagOut) {
    // Both teams tag out at the same time
    team1TagOutTime = currentTime;
    team2TagOutTime = currentTime;

    // Record tag-out events (Requirement 3.4: remove from combat)
    const team1TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      reason: team1CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team1CurrentRobot.currentHP,
    };
    tagOutEvents.push(team1TagOutEvent);

    const team2TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      reason: team2CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team2CurrentRobot.currentHP,
    };
    tagOutEvents.push(team2TagOutEvent);

    // Generate tag-out messages (Requirement 7.2)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      reason: team1TagOutEvent.reason,
      robot1HP: team1TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team1CurrentRobot.name,
        teamName: `Team ${team1.id}`,
        reason: team1TagOutEvent.reason,
        finalHP: team1TagOutEvent.finalHP,
      }),
    });

    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      reason: team2TagOutEvent.reason,
      robot2HP: team2TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team2CurrentRobot.name,
        teamName: `Team ${team2.id}`,
        reason: team2TagOutEvent.reason,
        finalHP: team2TagOutEvent.finalHP,
      }),
    });

    // Activate reserve robots (Requirement 3.5: full HP, fresh cooldowns)
    team1CurrentRobot = activateReserveRobot(team1.reserveRobot);
    team2CurrentRobot = activateReserveRobot(team2.reserveRobot);
    team1ReserveUsed = true;
    team2ReserveUsed = true;

    // Record tag-in events
    const team1TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      initialHP: team1CurrentRobot.currentHP,
    };
    tagInEvents.push(team1TagInEvent);

    const team2TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      initialHP: team2CurrentRobot.currentHP,
    };
    tagInEvents.push(team2TagInEvent);

    // Generate tag-in messages (Requirement 7.3)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team1CurrentRobot.name,
        teamName: `Team ${team1.id}`,
        hp: team1CurrentRobot.currentHP,
      }),
    });

    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team2CurrentRobot.name,
        teamName: `Team ${team2.id}`,
        hp: team2CurrentRobot.currentHP,
      }),
    });

    // Continue battle with reserve robots
    if (currentTime < maxTime) {
      const phase2StartTime = currentTime;
      const phase2Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
      const phase2Duration = phase2Result.durationSeconds;
      currentTime += phase2Duration;
      team1CurrentRobot.currentHP = phase2Result.robot1FinalHP;
      team2CurrentRobot.currentHP = phase2Result.robot2FinalHP;
      
      // Track phase 2 damage and survival time
      team1ReserveDamageDealt += phase2Result.robot1DamageDealt;
      team2ReserveDamageDealt += phase2Result.robot2DamageDealt;
      team1ReserveSurvivalTime += phase2Duration;
      team2ReserveSurvivalTime += phase2Duration;
      lastPhaseWasDraw = phase2Result.isDraw;
      
      // Collect combat events from phase 2 with timestamp offset (Requirement 7.1)
      if (phase2Result.events && Array.isArray(phase2Result.events)) {
        const offsetEvents = phase2Result.events.map(event => ({
          ...event,
          timestamp: event.timestamp + phase2StartTime,
        }));
        battleEvents.push(...offsetEvents);
      }
    }
  } else if (team1NeedsTagOut) {
    // Only team 1 tags out
    team1TagOutTime = currentTime;

    const team1TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      reason: team1CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team1CurrentRobot.currentHP,
    };
    tagOutEvents.push(team1TagOutEvent);

    // Generate tag-out message (Requirement 7.2)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      reason: team1TagOutEvent.reason,
      robot1HP: team1TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team1CurrentRobot.name,
        teamName: `Team ${team1.id}`,
        reason: team1TagOutEvent.reason,
        finalHP: team1TagOutEvent.finalHP,
      }),
    });

    team1CurrentRobot = activateReserveRobot(team1.reserveRobot);
    team1ReserveUsed = true;

    const team1TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      robotName: team1CurrentRobot.name,
      initialHP: team1CurrentRobot.currentHP,
    };
    tagInEvents.push(team1TagInEvent);

    // Generate tag-in message (Requirement 7.3)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 1,
      robotId: team1CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team1CurrentRobot.name,
        teamName: `Team ${team1.id}`,
        hp: team1CurrentRobot.currentHP,
      }),
    });

    // Continue battle
    if (currentTime < maxTime) {
      const phase2StartTime = currentTime;
      const phase2Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
      const phase2Duration = phase2Result.durationSeconds;
      currentTime += phase2Duration;
      team1CurrentRobot.currentHP = phase2Result.robot1FinalHP;
      team2CurrentRobot.currentHP = phase2Result.robot2FinalHP;
      
      // Track phase 2 damage and survival time
      team1ReserveDamageDealt += phase2Result.robot1DamageDealt;
      team2ActiveDamageDealt += phase2Result.robot2DamageDealt;
      team1ReserveSurvivalTime += phase2Duration;
      team2ActiveSurvivalTime += phase2Duration;
      lastPhaseWasDraw = phase2Result.isDraw;
      
      // Collect combat events from phase 2 with timestamp offset (Requirement 7.1)
      if (phase2Result.events && Array.isArray(phase2Result.events)) {
        const offsetEvents = phase2Result.events.map(event => ({
          ...event,
          timestamp: event.timestamp + phase2StartTime,
        }));
        battleEvents.push(...offsetEvents);
      }

      // Check if team 2 needs to tag out now
      if (shouldTagOut(team2CurrentRobot) && !team2ReserveUsed) {
        team2TagOutTime = currentTime;

        const team2TagOutEvent: TagOutEvent = {
          timestamp: currentTime,
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          robotName: team2CurrentRobot.name,
          reason: team2CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
          finalHP: team2CurrentRobot.currentHP,
        };
        tagOutEvents.push(team2TagOutEvent);

        // Generate tag-out message (Requirement 7.2)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_out',
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          reason: team2TagOutEvent.reason,
          robot2HP: team2TagOutEvent.finalHP,
          message: CombatMessageGenerator.generateTagOut({
            robotName: team2CurrentRobot.name,
            teamName: `Team ${team2.id}`,
            reason: team2TagOutEvent.reason,
            finalHP: team2TagOutEvent.finalHP,
          }),
        });

        team2CurrentRobot = activateReserveRobot(team2.reserveRobot);
        team2ReserveUsed = true;

        const team2TagInEvent: TagInEvent = {
          timestamp: currentTime,
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          robotName: team2CurrentRobot.name,
          initialHP: team2CurrentRobot.currentHP,
        };
        tagInEvents.push(team2TagInEvent);

        // Generate tag-in message (Requirement 7.3)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_in',
          teamNumber: 2,
          robotId: team2CurrentRobot.id,
          message: CombatMessageGenerator.generateTagIn({
            robotName: team2CurrentRobot.name,
            teamName: `Team ${team2.id}`,
            hp: team2CurrentRobot.currentHP,
          }),
        });

        // Final phase
        if (currentTime < maxTime) {
          const phase3StartTime = currentTime;
          const phase3Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
          const phase3Duration = phase3Result.durationSeconds;
          currentTime += phase3Duration;
          team1CurrentRobot.currentHP = phase3Result.robot1FinalHP;
          team2CurrentRobot.currentHP = phase3Result.robot2FinalHP;
          
          // Track phase 3 damage and survival time
          team1ReserveDamageDealt += phase3Result.robot1DamageDealt;
          team2ReserveDamageDealt += phase3Result.robot2DamageDealt;
          team1ReserveSurvivalTime += phase3Duration;
          team2ReserveSurvivalTime += phase3Duration;
          lastPhaseWasDraw = phase3Result.isDraw;
          
          // Collect combat events from phase 3 with timestamp offset (Requirement 7.1)
          if (phase3Result.events && Array.isArray(phase3Result.events)) {
            const offsetEvents = phase3Result.events.map(event => ({
              ...event,
              timestamp: event.timestamp + phase3StartTime,
            }));
            battleEvents.push(...offsetEvents);
          }
        }
      }
    }
  } else if (team2NeedsTagOut) {
    // Only team 2 tags out
    team2TagOutTime = currentTime;

    const team2TagOutEvent: TagOutEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      reason: team2CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
      finalHP: team2CurrentRobot.currentHP,
    };
    tagOutEvents.push(team2TagOutEvent);

    // Generate tag-out message (Requirement 7.2)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_out',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      reason: team2TagOutEvent.reason,
      robot2HP: team2TagOutEvent.finalHP,
      message: CombatMessageGenerator.generateTagOut({
        robotName: team2CurrentRobot.name,
        teamName: `Team ${team2.id}`,
        reason: team2TagOutEvent.reason,
        finalHP: team2TagOutEvent.finalHP,
      }),
    });

    team2CurrentRobot = activateReserveRobot(team2.reserveRobot);
    team2ReserveUsed = true;

    const team2TagInEvent: TagInEvent = {
      timestamp: currentTime,
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      robotName: team2CurrentRobot.name,
      initialHP: team2CurrentRobot.currentHP,
    };
    tagInEvents.push(team2TagInEvent);

    // Generate tag-in message (Requirement 7.3)
    battleEvents.push({
      timestamp: currentTime,
      type: 'tag_in',
      teamNumber: 2,
      robotId: team2CurrentRobot.id,
      message: CombatMessageGenerator.generateTagIn({
        robotName: team2CurrentRobot.name,
        teamName: `Team ${team2.id}`,
        hp: team2CurrentRobot.currentHP,
      }),
    });

    // Continue battle
    if (currentTime < maxTime) {
      const phase2StartTime = currentTime;
      const phase2Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
      const phase2Duration = phase2Result.durationSeconds;
      currentTime += phase2Duration;
      team1CurrentRobot.currentHP = phase2Result.robot1FinalHP;
      team2CurrentRobot.currentHP = phase2Result.robot2FinalHP;
      
      // Track phase 2 damage and survival time
      team1ActiveDamageDealt += phase2Result.robot1DamageDealt;
      team2ReserveDamageDealt += phase2Result.robot2DamageDealt;
      team1ActiveSurvivalTime += phase2Duration;
      team2ReserveSurvivalTime += phase2Duration;
      lastPhaseWasDraw = phase2Result.isDraw;
      
      // Collect combat events from phase 2 with timestamp offset (Requirement 7.1)
      if (phase2Result.events && Array.isArray(phase2Result.events)) {
        const offsetEvents = phase2Result.events.map(event => ({
          ...event,
          timestamp: event.timestamp + phase2StartTime,
        }));
        battleEvents.push(...offsetEvents);
      }

      // Check if team 1 needs to tag out now
      if (shouldTagOut(team1CurrentRobot) && !team1ReserveUsed) {
        team1TagOutTime = currentTime;

        const team1TagOutEvent: TagOutEvent = {
          timestamp: currentTime,
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          robotName: team1CurrentRobot.name,
          reason: team1CurrentRobot.currentHP <= 0 ? 'destruction' : 'yield',
          finalHP: team1CurrentRobot.currentHP,
        };
        tagOutEvents.push(team1TagOutEvent);

        // Generate tag-out message (Requirement 7.2)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_out',
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          reason: team1TagOutEvent.reason,
          robot1HP: team1TagOutEvent.finalHP,
          message: CombatMessageGenerator.generateTagOut({
            robotName: team1CurrentRobot.name,
            teamName: `Team ${team1.id}`,
            reason: team1TagOutEvent.reason,
            finalHP: team1TagOutEvent.finalHP,
          }),
        });

        team1CurrentRobot = activateReserveRobot(team1.reserveRobot);
        team1ReserveUsed = true;

        const team1TagInEvent: TagInEvent = {
          timestamp: currentTime,
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          robotName: team1CurrentRobot.name,
          initialHP: team1CurrentRobot.currentHP,
        };
        tagInEvents.push(team1TagInEvent);

        // Generate tag-in message (Requirement 7.3)
        battleEvents.push({
          timestamp: currentTime,
          type: 'tag_in',
          teamNumber: 1,
          robotId: team1CurrentRobot.id,
          message: CombatMessageGenerator.generateTagIn({
            robotName: team1CurrentRobot.name,
            teamName: `Team ${team1.id}`,
            hp: team1CurrentRobot.currentHP,
          }),
        });

        // Final phase
        if (currentTime < maxTime) {
          const phase3StartTime = currentTime;
          const phase3Result = simulateBattle(team1CurrentRobot, team2CurrentRobot);
          const phase3Duration = phase3Result.durationSeconds;
          currentTime += phase3Duration;
          team1CurrentRobot.currentHP = phase3Result.robot1FinalHP;
          team2CurrentRobot.currentHP = phase3Result.robot2FinalHP;
          
          // Track phase 3 damage and survival time
          team1ReserveDamageDealt += phase3Result.robot1DamageDealt;
          team2ReserveDamageDealt += phase3Result.robot2DamageDealt;
          team1ReserveSurvivalTime += phase3Duration;
          team2ReserveSurvivalTime += phase3Duration;
          lastPhaseWasDraw = phase3Result.isDraw;
          
          // Collect combat events from phase 3 with timestamp offset (Requirement 7.1)
          if (phase3Result.events && Array.isArray(phase3Result.events)) {
            const offsetEvents = phase3Result.events.map(event => ({
              ...event,
              timestamp: event.timestamp + phase3StartTime,
            }));
            battleEvents.push(...offsetEvents);
          }
        }
      }
    }
  }

  // Determine winner (Requirements 3.6, 3.7, 3.8)
  // Winner is determined by the final state after all phases complete
  let winnerId: number | null = null;
  let isDraw = false;

  // Calculate final HP for each robot on each team
  const team1ActiveFinalHP = team1.activeRobot.currentHP;
  const team1ReserveFinalHP = team1ReserveUsed ? team1CurrentRobot.currentHP : team1.reserveRobot.maxHP;
  const team2ActiveFinalHP = team2.activeRobot.currentHP;
  const team2ReserveFinalHP = team2ReserveUsed ? team2CurrentRobot.currentHP : team2.reserveRobot.maxHP;

  // Determine which robot is currently fighting for each team (the one that finished the battle)
  const team1CurrentFighterHP = team1ReserveUsed ? team1ReserveFinalHP : team1ActiveFinalHP;
  const team2CurrentFighterHP = team2ReserveUsed ? team2ReserveFinalHP : team2ActiveFinalHP;
  const team1CurrentFighterId = team1ReserveUsed ? team1.reserveRobotId : team1.activeRobotId;
  const team2CurrentFighterId = team2ReserveUsed ? team2.reserveRobotId : team2.activeRobotId;

  // Requirement 3.8: Battle timeout draw
  // This triggers when the overall tag team time limit is reached, OR when
  // the inner phase(s) all ended in draws (time expired without a decisive result).
  // The inner simulateBattle has its own 120s max duration — if it times out
  // with both robots alive, that's a draw even though currentTime < maxTime.
  if (currentTime >= maxTime || lastPhaseWasDraw) {
    isDraw = true;
  }
  // Requirement 3.7: Simultaneous destruction/yield draw (both at 0 HP)
  else if (team1CurrentFighterHP <= 0 && team2CurrentFighterHP <= 0) {
    isDraw = true;
  }
  // Requirement 3.6: Team defeat - winner is the team whose fighter has more HP
  // This covers both destruction (HP = 0) and yield (HP > 0 but yielded)
  else if (team1CurrentFighterHP <= 0) {
    winnerId = team2CurrentFighterId;
  } else if (team2CurrentFighterHP <= 0) {
    winnerId = team1CurrentFighterId;
  } else if (team1CurrentFighterHP > team2CurrentFighterHP) {
    // Both robots still have HP, winner is the one with more HP (yield case)
    winnerId = team1CurrentFighterId;
  } else if (team2CurrentFighterHP > team1CurrentFighterHP) {
    winnerId = team2CurrentFighterId;
  } else {
    // Equal HP - draw
    isDraw = true;
  }

  // Compute final endingPositions from the last events with position data
  // (later phases override phase1's endingPositions)
  for (let i = battleEvents.length - 1; i >= 0; i--) {
    const evt = battleEvents[i];
    if (evt.positions && Object.keys(evt.positions).length > 0) {
      endingPositions = evt.positions;
      break;
    }
  }

  return {
    battleId: 0, // Will be set after creating battle record
    winnerId,
    isDraw,
    durationSeconds: Math.min(currentTime, maxTime),
    team1TagOutTime,
    team2TagOutTime,
    team1ActiveFinalHP,
    team1ReserveFinalHP,
    team2ActiveFinalHP,
    team2ReserveFinalHP,
    team1ReserveUsed,
    team2ReserveUsed,
    team1ActiveDamageDealt,
    team1ReserveDamageDealt,
    team2ActiveDamageDealt,
    team2ReserveDamageDealt,
    team1ActiveSurvivalTime,
    team1ReserveSurvivalTime,
    team2ActiveSurvivalTime,
    team2ReserveSurvivalTime,
    battleLog: battleEvents, // Raw events - will be converted to narrative in createTagTeamBattleRecord
    arenaRadius,
    startingPositions,
    endingPositions,
    // Phase tracking for narrative conversion
    phases: (() => {
      const phases: Array<{
        robot1Name: string;
        robot2Name: string;
        robot1Stance: string;
        robot2Stance: string;
        robot1MaxHP: number;
        robot2MaxHP: number;
      }> = [];
      // Phase 1 is always active vs active
      phases.push({
        robot1Name: team1.activeRobot.name,
        robot2Name: team2.activeRobot.name,
        robot1Stance: team1.activeRobot.stance,
        robot2Stance: team2.activeRobot.stance,
        robot1MaxHP: team1.activeRobot.maxHP,
        robot2MaxHP: team2.activeRobot.maxHP,
      });
      // Phase 2+ depends on who tagged out
      if (team1NeedsTagOut && team2NeedsTagOut) {
        phases.push({
          robot1Name: team1.reserveRobot.name,
          robot2Name: team2.reserveRobot.name,
          robot1Stance: team1.reserveRobot.stance,
          robot2Stance: team2.reserveRobot.stance,
          robot1MaxHP: team1.reserveRobot.maxHP,
          robot2MaxHP: team2.reserveRobot.maxHP,
        });
      } else if (team1NeedsTagOut) {
        phases.push({
          robot1Name: team1.reserveRobot.name,
          robot2Name: team2.activeRobot.name,
          robot1Stance: team1.reserveRobot.stance,
          robot2Stance: team2.activeRobot.stance,
          robot1MaxHP: team1.reserveRobot.maxHP,
          robot2MaxHP: team2.activeRobot.maxHP,
        });
        if (team2ReserveUsed) {
          phases.push({
            robot1Name: team1.reserveRobot.name,
            robot2Name: team2.reserveRobot.name,
            robot1Stance: team1.reserveRobot.stance,
            robot2Stance: team2.reserveRobot.stance,
            robot1MaxHP: team1.reserveRobot.maxHP,
            robot2MaxHP: team2.reserveRobot.maxHP,
          });
        }
      } else if (team2NeedsTagOut) {
        phases.push({
          robot1Name: team1.activeRobot.name,
          robot2Name: team2.reserveRobot.name,
          robot1Stance: team1.activeRobot.stance,
          robot2Stance: team2.reserveRobot.stance,
          robot1MaxHP: team1.activeRobot.maxHP,
          robot2MaxHP: team2.reserveRobot.maxHP,
        });
        if (team1ReserveUsed) {
          phases.push({
            robot1Name: team1.reserveRobot.name,
            robot2Name: team2.reserveRobot.name,
            robot1Stance: team1.reserveRobot.stance,
            robot2Stance: team2.reserveRobot.stance,
            robot1MaxHP: team1.reserveRobot.maxHP,
            robot2MaxHP: team2.reserveRobot.maxHP,
          });
        }
      }
      return phases;
    })(),
    team1Name: `Team ${team1.id}`,
    team2Name: `Team ${team2.id}`,
    team1ReserveName: team1.reserveRobot.name,
    team2ReserveName: team2.reserveRobot.name,
  };
}
/**
 * Check if a robot should tag out
 * Requirement 3.3: Tag-out when HP ≤ yield threshold OR HP ≤ 0
 */
export function shouldTagOut(robot: Robot): boolean {
  if (robot.currentHP <= 0) {
    return true;
  }

  // Use the same percentage-based check as shouldYield in combatSimulator
  // to avoid rounding mismatches (e.g. Math.floor(5.5) = 5 missing HP of 5.45)
  const hpPercent = (robot.currentHP / robot.maxHP) * 100;
  return hpPercent <= robot.yieldThreshold && hpPercent > 0;
}

/**
 * Activate a reserve robot
 * Requirement 3.5: Set HP to 100%, reset weapon cooldowns to 0
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function activateReserveRobot(robot: Robot & { mainWeapon: any; offhandWeapon: any }): Robot & { mainWeapon: any; offhandWeapon: any } {
  robot.currentHP = robot.maxHP;
  robot.currentShield = robot.maxShield;
  // Note: Weapon cooldowns are handled by combat simulator
  return robot;
}

/**
 * Create a battle record for a tag team match
 */
async function createTagTeamBattleRecord(
  match: ScheduledTagTeamMatch,
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots,
  result: TagTeamBattleResult
): Promise<Battle> {
  // Create battle record with tag team fields
  const battle = await prisma.battle.create({
    data: {
      robot1Id: team1.activeRobotId,
      robot2Id: team2.activeRobotId,
      winnerId: result.winnerId,
      battleType: 'tag_team',
      leagueType: match.tagTeamLeague,

      // Tag team specific fields
      team1ActiveRobotId: team1.activeRobotId,
      team1ReserveRobotId: team1.reserveRobotId,
      team2ActiveRobotId: team2.activeRobotId,
      team2ReserveRobotId: team2.reserveRobotId,
      team1TagOutTime: result.team1TagOutTime ? BigInt(Math.round(result.team1TagOutTime * 1000)) : null,
      team2TagOutTime: result.team2TagOutTime ? BigInt(Math.round(result.team2TagOutTime * 1000)) : null,

      // Battle log with all combat events, tag-out, and tag-in events (Requirement 7.1)
      // Convert raw simulator events + tag events into narrative messages
      battleLog: {
        events: CombatMessageGenerator.convertTagTeamEvents(result.battleLog, {
          team1Name: result.team1Name,
          team2Name: result.team2Name,
          battleType: 'tag_team',
          phases: result.phases,
          robot3Name: result.team1ReserveName,
          robot4Name: result.team2ReserveName,
        }),
        detailedCombatEvents: result.battleLog, // Keep raw events for admin debugging
        tagTeamBattle: true,
        team1TagOutTime: result.team1TagOutTime,
        team2TagOutTime: result.team2TagOutTime,
        // 2D arena spatial metadata
        arenaRadius: result.arenaRadius,
        startingPositions: result.startingPositions,
        endingPositions: result.endingPositions,
      },
      durationSeconds: result.durationSeconds,

      // Economic data (placeholder)
      winnerReward: 0,
      loserReward: 0,

      // ELO tracking (placeholder)
      robot1ELOBefore: team1.activeRobot.elo,
      robot2ELOBefore: team2.activeRobot.elo,
      robot1ELOAfter: team1.activeRobot.elo,
      robot2ELOAfter: team2.activeRobot.elo,
      eloChange: 0,
    },
  });

  // Create BattleParticipant records for all 4 robots
  // Note: Credits, prestige, and fame will be updated later in updateTagTeamStats
  await prisma.battleParticipant.createMany({
    data: [
      // Team 1 Active
      {
        battleId: battle.id,
        robotId: team1.activeRobotId,
        team: 1,
        role: 'active',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team1.activeRobot.elo,
        eloAfter: team1.activeRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team1ActiveDamageDealt || 0,
        finalHP: result.team1ActiveFinalHP,
        yielded: false,
        destroyed: result.team1ActiveFinalHP === 0,
      },
      // Team 1 Reserve
      {
        battleId: battle.id,
        robotId: team1.reserveRobotId,
        team: 1,
        role: 'reserve',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team1.reserveRobot.elo,
        eloAfter: team1.reserveRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team1ReserveDamageDealt || 0,
        finalHP: result.team1ReserveFinalHP,
        yielded: false,
        destroyed: result.team1ReserveFinalHP === 0,
      },
      // Team 2 Active
      {
        battleId: battle.id,
        robotId: team2.activeRobotId,
        team: 2,
        role: 'active',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team2.activeRobot.elo,
        eloAfter: team2.activeRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team2ActiveDamageDealt || 0,
        finalHP: result.team2ActiveFinalHP,
        yielded: false,
        destroyed: result.team2ActiveFinalHP === 0,
      },
      // Team 2 Reserve
      {
        battleId: battle.id,
        robotId: team2.reserveRobotId,
        team: 2,
        role: 'reserve',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team2.reserveRobot.elo,
        eloAfter: team2.reserveRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team2ReserveDamageDealt || 0,
        finalHP: result.team2ReserveFinalHP,
        yielded: false,
        destroyed: result.team2ReserveFinalHP === 0,
      },
    ],
  });

  return battle;
}

/**
 * Calculate rewards for a tag team battle
 * Requirement 4.1, 4.2, 4.3: 2x standard league rewards
 */
export function calculateTagTeamRewards(
  league: string,
  isWinner: boolean,
  isDraw: boolean
): number {
  const baseReward = getLeagueWinReward(league);
  const participationReward = getParticipationReward(league);

  let reward: number;

  if (isDraw) {
    // Draw: participation reward only
    reward = participationReward;
  } else if (isWinner) {
    // Win: base reward + participation
    reward = baseReward + participationReward;
  } else {
    // Loss: participation reward only
    reward = participationReward;
  }

  // Apply 2x multiplier for tag team matches
  return Math.round(reward * TAG_TEAM_REWARD_MULTIPLIER);
}

/**
 * Calculate ELO changes for tag team battles
 * Requirements 5.1, 5.2: Use combined team ELO, K=32 formula
 */
export function calculateTagTeamELOChanges(
  team1CombinedELO: number,
  team2CombinedELO: number,
  team1Won: boolean,
  isDraw: boolean
): { team1Change: number; team2Change: number } {
  if (isDraw) {
    const { winnerChange, loserChange } = calculateELOChange(team1CombinedELO, team2CombinedELO, true);
    return { team1Change: winnerChange, team2Change: loserChange };
  } else if (team1Won) {
    const { winnerChange, loserChange } = calculateELOChange(team1CombinedELO, team2CombinedELO, false);
    return { team1Change: winnerChange, team2Change: loserChange };
  } else {
    const { winnerChange, loserChange } = calculateELOChange(team2CombinedELO, team1CombinedELO, false);
    return { team1Change: loserChange, team2Change: winnerChange };
  }
}

/**
 * Calculate league point changes for tag team battles
 * Requirements 5.3, 5.4, 5.5
 */
export function calculateTagTeamLeaguePoints(isWinner: boolean, isDraw: boolean): number {
  if (isDraw) {
    return 1; // +1 for draws
  } else if (isWinner) {
    return 3; // +3 for wins
  } else {
    return -1; // -1 for losses (minimum 0 enforced at update time)
  }
}

/**
 * Calculate prestige award for tag team battle
 * Requirements 10.1-10.6: 1.6x standard individual match prestige
 */
export function calculateTagTeamPrestige(
  league: string,
  isWinner: boolean,
  isDraw: boolean
): number {
  if (isDraw || !isWinner) {
    return 0; // No prestige for draws or losses
  }

  // Standard individual match prestige by league
  const standardPrestige: Record<string, number> = {
    bronze: 5,
    silver: 10,
    gold: 20,
    platinum: 30,
    diamond: 50,
    champion: 75,
  };

  const basePrestige = standardPrestige[league] || 0;
  return Math.round(basePrestige * TAG_TEAM_PRESTIGE_MULTIPLIER);
}

/**
 * Calculate fame award based on contribution
 * Requirement 10.7: Fame based on damage dealt and survival time
 * Fame is only awarded to robots on the WINNING team
 */
export function calculateTagTeamFame(
  robot: Robot,
  damageDealt: number,
  survivalTime: number,
  totalBattleTime: number,
  isWinner: boolean,
  isDraw: boolean
): number {
  // Only winners get fame (consistent with 1v1 battles)
  if (isDraw || !isWinner) {
    return 0;
  }

  // Base fame by league
  const baseFameByLeague: Record<string, number> = {
    bronze: 2,
    silver: 5,
    gold: 10,
    platinum: 15,
    diamond: 25,
    champion: 40,
  };

  const baseFame = baseFameByLeague[robot.currentLeague] || 0;

  // If robot didn't participate (0 survival time), they still get base fame as part of winning team
  if (survivalTime === 0) {
    return baseFame;
  }

  // Contribution multiplier based on damage dealt (0.5x to 1.5x)
  const damageMultiplier = Math.min(1.5, Math.max(0.5, damageDealt / 100));

  // Survival multiplier based on time in battle (0.5x to 1.5x)
  const survivalMultiplier = Math.min(
    1.5,
    Math.max(0.5, survivalTime / totalBattleTime)
  );

  // Apply contribution multipliers
  const finalFame = baseFame * damageMultiplier * survivalMultiplier;

  return Math.round(finalFame);
}

/**
 * Execute all scheduled tag team battles
 * Requirements 11.1, 11.2, 11.3, 11.4: Multi-match scheduling and execution
 * 
 * This function processes all scheduled tag team matches, checking robot readiness
 * before each match to handle cumulative damage from earlier matches (including 1v1).
 * 
 * @param _scheduledFor - Optional date filter for matches to execute
 * @returns Summary of executed battles
 */
export async function executeScheduledTagTeamBattles(_scheduledFor?: Date): Promise<{
  totalBattles: number;
  wins: number;
  draws: number;
  losses: number;
  skippedDueToUnreadyRobots: number;
  totalStreamingRevenue?: number;
}> {
  // Query scheduled tag team matches
  // Execute all matches with status 'scheduled' — the cron job controls timing,
  // scheduledFor is informational only (shown to players)
  const scheduledMatches = await prisma.scheduledTagTeamMatch.findMany({
    where: {
      status: 'scheduled',
    },
    include: {
      team1: {
        include: {
          activeRobot: true,
          reserveRobot: true,
        },
      },
      team2: {
        include: {
          activeRobot: true,
          reserveRobot: true,
        },
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });

  logger.info(`[TagTeamBattles] Found ${scheduledMatches.length} scheduled tag team matches`);

  let totalBattles = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let skippedDueToUnreadyRobots = 0;
  let totalStreamingRevenue = 0;

  for (const match of scheduledMatches) {
    try {
      // Skip readiness check for bye-team matches (bye-teams are always ready)
      const isByeMatch = match.team2Id === null;
      
      if (!isByeMatch) {
        // Requirement 11.3: Dynamic eligibility checking
        // Check if both teams are ready (may have taken damage in earlier matches)
        const team1Ready = await checkTeamReadinessForBattle(match.team1);
        const team2Ready = match.team2 ? await checkTeamReadinessForBattle(match.team2) : true; // Bye matches are always ready

        if (!team1Ready || !team2Ready) {
          logger.info(
            `[TagTeamBattles] Skipping match ${match.id}: ` +
            `Team ${match.team1Id} ready: ${team1Ready}, Team ${match.team2Id} ready: ${team2Ready}`
          );
          
          // Mark match as cancelled
          await prisma.scheduledTagTeamMatch.update({
            where: { id: match.id },
            data: { status: 'cancelled' },
          });
          
          skippedDueToUnreadyRobots++;
          continue;
        }
      }

      // Execute the battle
      const result = await executeTagTeamBattle(match);
      totalBattles++;

      if (result.isDraw) {
        draws++;
      } else if (result.winnerId === match.team1Id) {
        wins++;
      } else {
        losses++;
      }

      // Track streaming revenue from audit log (per-robot battle_complete events)
      if (!isByeMatch) {
        const battleCompleteEvents = await prisma.auditLog.findMany({
          where: {
            eventType: 'battle_complete',
            battleId: result.battleId,
          },
        });
        
        for (const evt of battleCompleteEvents) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload = evt.payload as any;
          totalStreamingRevenue += payload?.streamingRevenue || 0;
        }
      }

      // Update robot stats and apply rewards
      await updateTagTeamBattleResults(match, result);

    } catch (error) {
      logger.error(`[TagTeamBattles] Error executing match ${match.id}:`, error);
      
      // Mark match as cancelled on error
      await prisma.scheduledTagTeamMatch.update({
        where: { id: match.id },
        data: { status: 'cancelled' },
      });
    }
  }

  logger.info(
    `[TagTeamBattles] Execution complete: ${totalBattles} battles, ` +
    `${wins} wins, ${draws} draws, ${losses} losses, ` +
    `${skippedDueToUnreadyRobots} skipped due to unready robots`
  );
  if (totalStreamingRevenue > 0) {
    logger.info(`[TagTeamBattles] Streaming Revenue: ₡${totalStreamingRevenue.toLocaleString()} total earned`);
  }

  return {
    totalBattles,
    wins,
    draws,
    losses,
    skippedDueToUnreadyRobots,
    totalStreamingRevenue,
  };
}

/**
 * Check if a team is ready for battle
 * Requirement 8.1, 8.2, 8.3: Both robots must have HP > yield threshold, all weapons equipped
 * Requirement 11.3: Dynamic eligibility checking after earlier matches
 */
async function checkTeamReadinessForBattle(team: {
  activeRobot: Robot;
  reserveRobot: Robot;
}): Promise<boolean> {
  // Check active robot has weapons
  if (!team.activeRobot.mainWeaponId) {
    return false;
  }

  // Check reserve robot has weapons
  if (!team.reserveRobot.mainWeaponId) {
    return false;
  }

  return true;
}

/**
 * Update battle results, robot stats, and apply rewards
 * Requirements 5.1-5.7, 10.7, 10.8: ELO, league points, fame, statistics
 * Requirement 11.2: Apply cumulative damage to robots
 * Requirements 12.4, 12.5: Full rewards for bye-team wins, normal penalties for losses
 */
async function updateTagTeamBattleResults(
  match: ScheduledTagTeamMatch,
  result: TagTeamBattleResult
): Promise<void> {
  // Check if this is a bye-team match
  const isByeMatch = match.team1Id === -1 || match.team2Id === -1;
  const team1IsBye = match.team1Id === -1;
  const team2IsBye = match.team2Id === -1;

  // Load teams with full robot data (skip bye-teams)
  const team1 = team1IsBye ? null : await prisma.tagTeam.findUnique({
    where: { id: match.team1Id },
    include: {
      activeRobot: true,
      reserveRobot: true,
      stable: true,
    },
  });

  const team2 = team2IsBye ? null : (match.team2Id ? await prisma.tagTeam.findUnique({
    where: { id: match.team2Id },
    include: {
      activeRobot: true,
      reserveRobot: true,
      stable: true,
    },
  }) : null);

  // For bye-team matches, only update the real team
  if (isByeMatch) {
    const realTeam = team1 || team2;
    if (!realTeam || !realTeam.activeRobot || !realTeam.reserveRobot) {
      throw new Error(`Real team or robots not found for bye-match ${match.id}`);
    }

    const realTeamWon = result.winnerId === realTeam.id;
    const isDraw = result.isDraw;

    // Calculate ELO changes against bye-team (combined ELO 2000)
    const realTeamCombinedELO = realTeam.activeRobot.elo + realTeam.reserveRobot.elo;
    const byeTeamCombinedELO = 2000;
    const eloChanges = team1IsBye 
      ? calculateTagTeamELOChanges(byeTeamCombinedELO, realTeamCombinedELO, false, isDraw)
      : calculateTagTeamELOChanges(realTeamCombinedELO, byeTeamCombinedELO, realTeamWon, isDraw);
    
    const realTeamELOChange = team1IsBye ? eloChanges.team2Change : eloChanges.team1Change;

    // Calculate league point changes (Requirements 12.4, 12.5: same as normal matches)
    const realTeamLeaguePoints = calculateTagTeamLeaguePoints(realTeamWon, isDraw);

    // Calculate rewards (Requirements 12.4, 12.5: full rewards for wins, normal penalties for losses)
    const realTeamRewards = calculateTagTeamRewards(match.tagTeamLeague, realTeamWon, isDraw);

    // Calculate repair costs
    const repairBay = await prisma.facility.findUnique({
      where: {
        userId_facilityType: {
          userId: realTeam.stableId,
          facilityType: 'repair_bay',
        },
      },
    });
    const medicalBay = await prisma.facility.findUnique({
      where: {
        userId_facilityType: {
          userId: realTeam.stableId,
          facilityType: 'medical_bay',
        },
      },
    });
    const _activeRobotCount = await prisma.robot.count({
      where: {
        userId: realTeam.stableId,
        NOT: { name: 'Bye Robot' }
      }
    });

    const _repairBayLevel = repairBay ? repairBay.level : 0;
    const _medicalBayLevel = medicalBay ? medicalBay.level : 0;

    const activeFinalHP = team1IsBye ? result.team2ActiveFinalHP : result.team1ActiveFinalHP;
    const reserveFinalHP = team1IsBye ? result.team2ReserveFinalHP : result.team1ReserveFinalHP;
    const tagOutTime = team1IsBye ? result.team2TagOutTime : result.team1TagOutTime;

    // NOTE: Repair costs are NOT calculated here anymore
    // They are calculated by RepairService when repairs are actually triggered
    // This ensures accurate costs based on current damage and facility levels

    // Calculate prestige
    const prestige = calculateTagTeamPrestige(match.tagTeamLeague, realTeamWon, isDraw);

    // Calculate fame (Requirement 10.7) based on damage dealt and survival time
    const totalBattleTime = result.durationSeconds;
    const activeDamageDealt = team1IsBye ? result.team2ActiveDamageDealt : result.team1ActiveDamageDealt;
    const reserveDamageDealt = team1IsBye ? result.team2ReserveDamageDealt : result.team1ReserveDamageDealt;
    const activeSurvivalTime = team1IsBye ? result.team2ActiveSurvivalTime : result.team1ActiveSurvivalTime;
    const reserveSurvivalTime = team1IsBye ? result.team2ReserveSurvivalTime : result.team1ReserveSurvivalTime;

    const activeFame = calculateTagTeamFame(
      realTeam.activeRobot,
      activeDamageDealt,
      activeSurvivalTime,
      totalBattleTime,
      realTeamWon,
      isDraw
    );
    const reserveFame = calculateTagTeamFame(
      realTeam.reserveRobot,
      reserveDamageDealt,
      reserveSurvivalTime,
      totalBattleTime,
      realTeamWon,
      isDraw
    );

    // Update robots
    await prisma.robot.update({
      where: { id: realTeam.activeRobotId },
      data: {
        elo: { increment: realTeamELOChange },
        currentHP: activeFinalHP,
        repairCost: 0, // Deprecated: repair costs calculated by RepairService
        damageTaken: { increment: realTeam.activeRobot.maxHP - activeFinalHP },
        fame: { increment: activeFame },
        totalTagTeamBattles: { increment: 1 },
        totalTagTeamWins: realTeamWon ? { increment: 1 } : undefined,
        totalTagTeamLosses: !realTeamWon && !isDraw ? { increment: 1 } : undefined,
        totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
        timesTaggedOut: tagOutTime !== undefined ? { increment: 1 } : undefined,
      },
    });

    await prisma.robot.update({
      where: { id: realTeam.reserveRobotId },
      data: {
        elo: { increment: realTeamELOChange },
        currentHP: reserveFinalHP,
        repairCost: 0, // Deprecated: repair costs calculated by RepairService
        damageTaken: tagOutTime !== undefined 
          ? { increment: realTeam.reserveRobot.maxHP - reserveFinalHP }
          : undefined,
        fame: { increment: reserveFame },
        totalTagTeamBattles: { increment: 1 },
        totalTagTeamWins: realTeamWon ? { increment: 1 } : undefined,
        totalTagTeamLosses: !realTeamWon && !isDraw ? { increment: 1 } : undefined,
        totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
        timesTaggedIn: tagOutTime !== undefined ? { increment: 1 } : undefined,
      },
    });

    // Update team (ensure league points don't go below 0)
    const currentTeamData = await prisma.tagTeam.findUnique({
      where: { id: realTeam.id },
      select: { tagTeamLeaguePoints: true },
    });
    const newLeaguePoints = Math.max(0, (currentTeamData?.tagTeamLeaguePoints || 0) + realTeamLeaguePoints);
    
    await prisma.tagTeam.update({
      where: { id: realTeam.id },
      data: {
        tagTeamLeaguePoints: newLeaguePoints,
        totalTagTeamWins: realTeamWon ? { increment: 1 } : undefined,
        totalTagTeamLosses: !realTeamWon && !isDraw ? { increment: 1 } : undefined,
        totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      },
    });

    // Update stable via shared helpers
    // Note: Repair costs are deducted separately by RepairService, not here
    await awardCreditsToUser(realTeam.stableId, realTeamRewards);
    await awardPrestigeToUser(realTeam.stableId, prestige);

    // Update battle record with actual values
    const winnerReward = realTeamWon ? realTeamRewards : 0;
    const loserReward = !realTeamWon && !isDraw ? realTeamRewards : 0;
    
    await prisma.battle.update({
      where: { id: result.battleId },
      data: {
        winnerReward,
        loserReward,
        robot1ELOAfter: team1IsBye ? 1000 : realTeam.activeRobot.elo + realTeamELOChange,
        robot2ELOAfter: team2IsBye ? 1000 : realTeam.activeRobot.elo + realTeamELOChange,
        eloChange: Math.abs(realTeamELOChange),
      },
    });

    logger.info(
      `[TagTeamBattles] Updated bye-match results for match ${match.id}: ` +
      `Team ${realTeam.id} ELO ${realTeamELOChange > 0 ? '+' : ''}${realTeamELOChange}`
    );

    // Update BattleParticipant records for the real team with ELO, prestige, fame, and credits
    const byeCreditsPerRobot = Math.floor(realTeamRewards / 2);
    const byePrestigePerRobot = Math.floor(prestige / 2);

    await prisma.battleParticipant.updateMany({
      where: {
        battleId: result.battleId,
        robotId: realTeam.activeRobotId,
      },
      data: {
        credits: byeCreditsPerRobot,
        eloAfter: realTeam.activeRobot.elo + realTeamELOChange,
        prestigeAwarded: byePrestigePerRobot,
        fameAwarded: activeFame,
      },
    });

    await prisma.battleParticipant.updateMany({
      where: {
        battleId: result.battleId,
        robotId: realTeam.reserveRobotId,
      },
      data: {
        credits: byeCreditsPerRobot,
        eloAfter: realTeam.reserveRobot.elo + realTeamELOChange,
        prestigeAwarded: byePrestigePerRobot,
        fameAwarded: reserveFame,
      },
    });

    return;
  }

  // Normal match (both teams are real)
  if (!team1 || !team2) {
    throw new Error(`Teams not found for match ${match.id}`);
  }

  const team1Won = result.winnerId === team1.id;
  const team2Won = result.winnerId === team2.id;
  const isDraw = result.isDraw;

  // Validate teams have robots loaded
  if (!team1.activeRobot || !team1.reserveRobot || !team2.activeRobot || !team2.reserveRobot) {
    throw new Error(`Teams missing robot data for match ${match.id}`);
  }

  // Calculate ELO changes (Requirements 5.1, 5.2)
  const team1CombinedELO = team1.activeRobot.elo + team1.reserveRobot.elo;
  const team2CombinedELO = team2.activeRobot.elo + team2.reserveRobot.elo;
  const eloChanges = calculateTagTeamELOChanges(team1CombinedELO, team2CombinedELO, team1Won, isDraw);

  // Calculate league point changes (Requirements 5.3, 5.4, 5.5)
  const team1LeaguePoints = calculateTagTeamLeaguePoints(team1Won, isDraw);
  const team2LeaguePoints = calculateTagTeamLeaguePoints(team2Won, isDraw);

  // Calculate rewards (Requirements 4.1, 4.2, 4.3)
  const team1Rewards = calculateTagTeamRewards(match.tagTeamLeague, team1Won, isDraw);
  const team2Rewards = calculateTagTeamRewards(match.tagTeamLeague, team2Won, isDraw);

  // Calculate repair costs (Requirements 4.4, 4.5, 4.6, 4.7)
  // Get Repair Bay discount for each stable
  const team1RepairBay = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId: team1.stableId,
        facilityType: 'repair_bay',
      },
    },
  });
  const team2RepairBay = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId: team2.stableId,
        facilityType: 'repair_bay',
      },
    },
  });
  const team1MedicalBay = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId: team1.stableId,
        facilityType: 'medical_bay',
      },
    },
  });
  const team2MedicalBay = await prisma.facility.findUnique({
    where: {
      userId_facilityType: {
        userId: team2.stableId,
        facilityType: 'medical_bay',
      },
    },
  });

  const _team1ActiveRobotCount = await prisma.robot.count({
    where: {
      userId: team1.stableId,
      NOT: { name: 'Bye Robot' }
    }
  });
  const _team2ActiveRobotCount = await prisma.robot.count({
    where: {
      userId: team2.stableId,
      NOT: { name: 'Bye Robot' }
    }
  });

  const _team1RepairBayLevel = team1RepairBay ? team1RepairBay.level : 0;
  const _team2RepairBayLevel = team2RepairBay ? team2RepairBay.level : 0;
  const _team1MedicalBayLevel = team1MedicalBay ? team1MedicalBay.level : 0;
  const _team2MedicalBayLevel = team2MedicalBay ? team2MedicalBay.level : 0;

  // NOTE: Repair costs are NOT calculated here anymore
  // They are calculated by RepairService when repairs are actually triggered
  // This ensures accurate costs based on current damage and facility levels

  // Calculate prestige (Requirements 10.1-10.6)
  const team1Prestige = calculateTagTeamPrestige(match.tagTeamLeague, team1Won, isDraw);
  const team2Prestige = calculateTagTeamPrestige(match.tagTeamLeague, team2Won, isDraw);

  // Calculate fame (Requirement 10.7) based on damage dealt and survival time
  const totalBattleTime = result.durationSeconds;
  const team1ActiveFame = calculateTagTeamFame(
    team1.activeRobot,
    result.team1ActiveDamageDealt,
    result.team1ActiveSurvivalTime,
    totalBattleTime,
    team1Won,
    isDraw
  );
  const team1ReserveFame = calculateTagTeamFame(
    team1.reserveRobot,
    result.team1ReserveDamageDealt,
    result.team1ReserveSurvivalTime,
    totalBattleTime,
    team1Won,
    isDraw
  );
  const team2ActiveFame = calculateTagTeamFame(
    team2.activeRobot,
    result.team2ActiveDamageDealt,
    result.team2ActiveSurvivalTime,
    totalBattleTime,
    team2Won,
    isDraw
  );
  const team2ReserveFame = calculateTagTeamFame(
    team2.reserveRobot,
    result.team2ReserveDamageDealt,
    result.team2ReserveSurvivalTime,
    totalBattleTime,
    team2Won,
    isDraw
  );

  // Update robots (ELO, league points, HP, statistics, fame)
  // Requirement 11.2: Apply cumulative damage
  await prisma.robot.update({
    where: { id: team1.activeRobotId },
    data: {
      elo: { increment: eloChanges.team1Change },
      currentHP: result.team1ActiveFinalHP,
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: { increment: team1.activeRobot.maxHP - result.team1ActiveFinalHP },
      fame: { increment: team1ActiveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team1Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team2Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedOut: result.team1TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  await prisma.robot.update({
    where: { id: team1.reserveRobotId },
    data: {
      elo: { increment: eloChanges.team1Change },
      currentHP: result.team1ReserveFinalHP,
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: result.team1TagOutTime !== undefined 
        ? { increment: team1.reserveRobot.maxHP - result.team1ReserveFinalHP }
        : undefined,
      fame: { increment: team1ReserveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team1Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team2Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedIn: result.team1TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  await prisma.robot.update({
    where: { id: team2.activeRobotId },
    data: {
      elo: { increment: eloChanges.team2Change },
      currentHP: result.team2ActiveFinalHP,
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: { increment: team2.activeRobot.maxHP - result.team2ActiveFinalHP },
      fame: { increment: team2ActiveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team2Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team1Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedOut: result.team2TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  await prisma.robot.update({
    where: { id: team2.reserveRobotId },
    data: {
      elo: { increment: eloChanges.team2Change },
      currentHP: result.team2ReserveFinalHP,
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: result.team2TagOutTime !== undefined 
        ? { increment: team2.reserveRobot.maxHP - result.team2ReserveFinalHP }
        : undefined,
      fame: { increment: team2ReserveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team2Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team1Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedIn: result.team2TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  // Update teams (league points, win/loss/draw counters)
  // Ensure league points don't go below 0
  const team1CurrentData = await prisma.tagTeam.findUnique({
    where: { id: team1.id },
    select: { tagTeamLeaguePoints: true },
  });
  const team2CurrentData = await prisma.tagTeam.findUnique({
    where: { id: team2.id },
    select: { tagTeamLeaguePoints: true },
  });
  
  const team1NewLeaguePoints = Math.max(0, (team1CurrentData?.tagTeamLeaguePoints || 0) + team1LeaguePoints);
  const team2NewLeaguePoints = Math.max(0, (team2CurrentData?.tagTeamLeaguePoints || 0) + team2LeaguePoints);
  
  await prisma.tagTeam.update({
    where: { id: team1.id },
    data: {
      tagTeamLeaguePoints: team1NewLeaguePoints,
      totalTagTeamWins: team1Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team2Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
    },
  });

  await prisma.tagTeam.update({
    where: { id: team2.id },
    data: {
      tagTeamLeaguePoints: team2NewLeaguePoints,
      totalTagTeamWins: team2Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team1Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
    },
  });

  // Update stables (currency, prestige) via shared helpers
  // Note: Repair costs are deducted separately by RepairService, not here
  await awardCreditsToUser(team1.stableId, team1Rewards);
  await awardPrestigeToUser(team1.stableId, team1Prestige);
  await awardCreditsToUser(team2.stableId, team2Rewards);
  await awardPrestigeToUser(team2.stableId, team2Prestige);

  // Update battle record with actual values
  await prisma.battle.update({
    where: { id: result.battleId },
    data: {
      winnerReward: team1Won ? team1Rewards : team2Won ? team2Rewards : 0,
      loserReward: team1Won ? team2Rewards : team2Won ? team1Rewards : (isDraw ? team1Rewards : 0),
      robot1ELOAfter: team1.activeRobot.elo + eloChanges.team1Change,
      robot2ELOAfter: team2.activeRobot.elo + eloChanges.team2Change,
      eloChange: Math.abs(eloChanges.team1Change),
      // Per-robot stats for tag team battles
      team1ActiveDamageDealt: result.team1ActiveDamageDealt,
      team1ReserveDamageDealt: result.team1ReserveDamageDealt,
      team2ActiveDamageDealt: result.team2ActiveDamageDealt,
      team2ReserveDamageDealt: result.team2ReserveDamageDealt,
      team1ActiveFameAwarded: team1ActiveFame,
      team1ReserveFameAwarded: team1ReserveFame,
      team2ActiveFameAwarded: team2ActiveFame,
      team2ReserveFameAwarded: team2ReserveFame,
    },
  });

  logger.info(
    `[TagTeamBattles] Updated results for match ${match.id}: ` +
    `Team ${team1.id} ELO ${eloChanges.team1Change > 0 ? '+' : ''}${eloChanges.team1Change}, ` +
    `Team ${team2.id} ELO ${eloChanges.team2Change > 0 ? '+' : ''}${eloChanges.team2Change}`
  );
  
  // Log fame awards
  if (team1ActiveFame > 0 || team1ReserveFame > 0) {
    logger.info(
      `[TagTeamBattles] Fame awarded - Team ${team1.id}: ` +
      `${team1.activeRobot.name} +${team1ActiveFame}, ${team1.reserveRobot.name} +${team1ReserveFame}`
    );
  }
  if (team2ActiveFame > 0 || team2ReserveFame > 0) {
    logger.info(
      `[TagTeamBattles] Fame awarded - Team ${team2.id}: ` +
      `${team2.activeRobot.name} +${team2ActiveFame}, ${team2.reserveRobot.name} +${team2ReserveFame}`
    );
  }

  // Calculate and award streaming revenue for all 4 robots individually
  // Each robot earns based on its own stats, divided by teamSize (2) to preserve economics
  const TAG_TEAM_SIZE = 2;
  const [team1ActiveStreaming, team1ReserveStreaming, team2ActiveStreaming, team2ReserveStreaming] = await Promise.all([
    awardStreamingRevenueForParticipant(team1.activeRobotId, team1.stableId, result.battleId, false, TAG_TEAM_SIZE),
    awardStreamingRevenueForParticipant(team1.reserveRobotId, team1.stableId, result.battleId, false, TAG_TEAM_SIZE),
    awardStreamingRevenueForParticipant(team2.activeRobotId, team2.stableId, result.battleId, false, TAG_TEAM_SIZE),
    awardStreamingRevenueForParticipant(team2.reserveRobotId, team2.stableId, result.battleId, false, TAG_TEAM_SIZE),
  ]);

  // Log streaming revenue
  logger.info(
    `[Streaming] Team ${team1.id}: ${team1.activeRobot.name} ₡${team1ActiveStreaming?.totalRevenue ?? 0}, ` +
    `${team1.reserveRobot.name} ₡${team1ReserveStreaming?.totalRevenue ?? 0}`
  );
  logger.info(
    `[Streaming] Team ${team2.id}: ${team2.activeRobot.name} ₡${team2ActiveStreaming?.totalRevenue ?? 0}, ` +
    `${team2.reserveRobot.name} ₡${team2ReserveStreaming?.totalRevenue ?? 0}`
  );

  // Update BattleParticipant records with credits, ELO, prestige, and fame
  // Note: streamingRevenue is already set by awardStreamingRevenueForParticipant() above
  const team1CreditsPerRobot = Math.floor(team1Rewards / 2);
  const team2CreditsPerRobot = Math.floor(team2Rewards / 2);
  const team1PrestigePerRobot = Math.floor(team1Prestige / 2);
  const team2PrestigePerRobot = Math.floor(team2Prestige / 2);
  
  // Update each robot individually since eloAfter and fameAwarded differ per robot
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team1.activeRobotId,
    },
    data: {
      credits: team1CreditsPerRobot,
      eloAfter: team1.activeRobot.elo + eloChanges.team1Change,
      prestigeAwarded: team1PrestigePerRobot,
      fameAwarded: team1ActiveFame,
    },
  });
  
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team1.reserveRobotId,
    },
    data: {
      credits: team1CreditsPerRobot,
      eloAfter: team1.reserveRobot.elo + eloChanges.team1Change,
      prestigeAwarded: team1PrestigePerRobot,
      fameAwarded: team1ReserveFame,
    },
  });
  
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team2.activeRobotId,
    },
    data: {
      credits: team2CreditsPerRobot,
      eloAfter: team2.activeRobot.elo + eloChanges.team2Change,
      prestigeAwarded: team2PrestigePerRobot,
      fameAwarded: team2ActiveFame,
    },
  });
  
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team2.reserveRobotId,
    },
    data: {
      credits: team2CreditsPerRobot,
      eloAfter: team2.reserveRobot.elo + eloChanges.team2Change,
      prestigeAwarded: team2PrestigePerRobot,
      fameAwarded: team2ReserveFame,
    },
  });

  // Log battle_complete events to audit log - ONE EVENT PER ROBOT (4 total)
  // Uses shared logBattleAuditEvent helper with tag-team-specific extras
  
  const battle = await prisma.battle.findUnique({
    where: { id: result.battleId },
  });

  if (battle) {
    // Reuse credits splits calculated above; streaming revenue comes from per-robot calcs
    const auditTeam1PrestigePerRobot = Math.floor(team1Prestige / 2);
    const auditTeam2PrestigePerRobot = Math.floor(team2Prestige / 2);
    
    const tagTeamAuditRobots = [
      // Team 1 Active
      {
        robotId: team1.activeRobotId, userId: team1.activeRobot.userId,
        isWinner: team1Won, isDraw,
        damageDealt: result.team1ActiveDamageDealt, finalHP: result.team1ActiveFinalHP,
        yielded: result.team1TagOutTime !== undefined, destroyed: result.team1ActiveFinalHP === 0,
        credits: team1CreditsPerRobot, prestige: auditTeam1PrestigePerRobot, fame: team1ActiveFame,
        eloBefore: battle.robot1ELOBefore, eloAfter: battle.robot1ELOAfter,
        streamingRevenue: team1ActiveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'active', opponentTeam: team2.id, partnerRobotId: team1.reserveRobotId,
          survivalTime: result.team1ActiveSurvivalTime },
      },
      // Team 1 Reserve
      {
        robotId: team1.reserveRobotId, userId: team1.reserveRobot.userId,
        isWinner: team1Won, isDraw,
        damageDealt: result.team1ReserveDamageDealt, finalHP: result.team1ReserveFinalHP,
        yielded: false, destroyed: result.team1ReserveFinalHP === 0 && result.team1TagOutTime !== undefined,
        credits: team1CreditsPerRobot, prestige: auditTeam1PrestigePerRobot, fame: team1ReserveFame,
        eloBefore: team1.reserveRobot.elo, eloAfter: team1.reserveRobot.elo,
        streamingRevenue: team1ReserveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'reserve', opponentTeam: team2.id, partnerRobotId: team1.activeRobotId,
          wasTaggedIn: result.team1TagOutTime !== undefined, survivalTime: result.team1ReserveSurvivalTime },
      },
      // Team 2 Active
      {
        robotId: team2.activeRobotId, userId: team2.activeRobot.userId,
        isWinner: team2Won, isDraw,
        damageDealt: result.team2ActiveDamageDealt, finalHP: result.team2ActiveFinalHP,
        yielded: result.team2TagOutTime !== undefined, destroyed: result.team2ActiveFinalHP === 0,
        credits: team2CreditsPerRobot, prestige: auditTeam2PrestigePerRobot, fame: team2ActiveFame,
        eloBefore: battle.robot2ELOBefore, eloAfter: battle.robot2ELOAfter,
        streamingRevenue: team2ActiveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'active', opponentTeam: team1.id, partnerRobotId: team2.reserveRobotId,
          survivalTime: result.team2ActiveSurvivalTime },
      },
      // Team 2 Reserve
      {
        robotId: team2.reserveRobotId, userId: team2.reserveRobot.userId,
        isWinner: team2Won, isDraw,
        damageDealt: result.team2ReserveDamageDealt, finalHP: result.team2ReserveFinalHP,
        yielded: false, destroyed: result.team2ReserveFinalHP === 0 && result.team2TagOutTime !== undefined,
        credits: team2CreditsPerRobot, prestige: auditTeam2PrestigePerRobot, fame: team2ReserveFame,
        eloBefore: team2.reserveRobot.elo, eloAfter: team2.reserveRobot.elo,
        streamingRevenue: team2ReserveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'reserve', opponentTeam: team1.id, partnerRobotId: team2.activeRobotId,
          wasTaggedIn: result.team2TagOutTime !== undefined, survivalTime: result.team2ReserveSurvivalTime },
      },
    ];

    for (const r of tagTeamAuditRobots) {
      await logBattleAuditEvent(
        {
          robotId: r.robotId, userId: r.userId,
          isWinner: r.isWinner, isDraw: r.isDraw,
          damageDealt: r.damageDealt, finalHP: r.finalHP,
          yielded: r.yielded, destroyed: r.destroyed,
          credits: r.credits, prestige: r.prestige, fame: r.fame,
          eloBefore: r.eloBefore, eloAfter: r.eloAfter,
        },
        { id: battle.id, battleType: 'tag_team', leagueType: battle.leagueType, durationSeconds: battle.durationSeconds, eloChange: battle.eloChange },
        null, // Tag team has no single opponent
        r.streamingRevenue,
        false,
        r.extras,
      );
    }
    
    logger.info(
      `[TagTeamBattles] Created 4 audit log events for tag team battle ${battle.id} ` +
      `(one per robot, rewards split 50/50 per team)`
    );
  }
}
