import { Robot, TagTeam, TagTeamMatch, Battle, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { simulateBattle } from './combatSimulator';
import { getLeagueBaseReward, getParticipationReward } from '../utils/economyCalculations';
import { CombatMessageGenerator } from './combatMessageGenerator';
import { repairAllRobots } from './repairService';
import { calculateRepairCost, calculateAttributeSum } from '../utils/robotCalculations';
import { calculateTagTeamStreamingRevenue, awardStreamingRevenue } from './streamingRevenueService';
import { getCurrentCycleNumber } from './battleOrchestrator';
import { EventLogger, EventType } from './eventLogger';

// Battle constants
const BATTLE_TIME_LIMIT = 300; // 5 minutes in seconds
const REPAIR_COST_PER_HP = 50;
const TAG_TEAM_REWARD_MULTIPLIER = 2; // Tag team rewards are 2x standard
const TAG_TEAM_PRESTIGE_MULTIPLIER = 1.6; // Tag team prestige is 1.6x standard
const DESTRUCTION_MULTIPLIER = 2; // Destroyed robots have 2x repair cost
const ELO_K_FACTOR = 32; // ELO calculation constant

// Types
interface TagTeamWithRobots extends TagTeam {
  activeRobot: Robot & {
    mainWeapon: any;
    offhandWeapon: any;
  };
  reserveRobot: Robot & {
    mainWeapon: any;
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
  battleLog: any[]; // Complete battle log with all events
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
    // Equipment
    mainWeaponId: null,
    offhandWeaponId: null,
    mainWeapon: null,
    offhandWeapon: null,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
export async function executeTagTeamBattle(match: TagTeamMatch): Promise<TagTeamBattleResult> {
  // Check if this is a bye-team match
  const isByeMatch = match.team2Id === null;
  
  let team1: TagTeamWithRobots | null;
  let team2: TagTeamWithRobots | null;

  // Load team1
  team1 = await prisma.tagTeam.findUnique({
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
  await prisma.tagTeamMatch.update({
    where: { id: match.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });

  console.log(
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
  let phase1Winner: number | null = phase1Result.winnerId;
  
  // Collect combat events from phase 1 (Requirement 7.1)
  if (phase1Result.events && Array.isArray(phase1Result.events)) {
    battleEvents.push(...phase1Result.events);
  }

  // Check for tag-outs (Requirement 3.3: HP ≤ yield threshold OR HP ≤ 0)
  const team1NeedsTagOut = shouldTagOut(team1CurrentRobot);
  const team2NeedsTagOut = shouldTagOut(team2CurrentRobot);

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
  if (currentTime >= maxTime) {
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
    battleLog: battleEvents, // Complete battle log with all events (Requirement 7.1)
  };
}
/**
 * Check if a robot should tag out
 * Requirement 3.3: Tag-out when HP ≤ yield threshold OR HP ≤ 0
 */
function shouldTagOut(robot: Robot): boolean {
  if (robot.currentHP <= 0) {
    return true;
  }

  const yieldThresholdHP = Math.floor((robot.yieldThreshold / 100) * robot.maxHP);
  return robot.currentHP <= yieldThresholdHP;
}

/**
 * Activate a reserve robot
 * Requirement 3.5: Set HP to 100%, reset weapon cooldowns to 0
 */
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
  match: TagTeamMatch,
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots,
  result: TagTeamBattleResult
): Promise<Battle> {
  // Create battle record with tag team fields
  const battle = await prisma.battle.create({
    data: {
      userId: team1.stableId,
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
      battleLog: {
        events: result.battleLog,
        tagTeamBattle: true,
        team1TagOutTime: result.team1TagOutTime,
        team2TagOutTime: result.team2TagOutTime,
      },
      durationSeconds: result.durationSeconds,

      // Economic data (placeholder)
      winnerReward: 0,
      loserReward: 0,
      robot1RepairCost: 0,
      robot2RepairCost: 0,

      // Final state - store the HP of the robots that were fighting at the end
      // For tag team battles, this could be either active or reserve robots
      robot1FinalHP: result.team1ReserveUsed ? result.team1ReserveFinalHP : result.team1ActiveFinalHP,
      robot2FinalHP: result.team2ReserveUsed ? result.team2ReserveFinalHP : result.team2ActiveFinalHP,
      robot1FinalShield: 0,
      robot2FinalShield: 0,
      robot1Yielded: result.winnerId !== team1.id && (result.team1ReserveUsed ? result.team1ReserveFinalHP : result.team1ActiveFinalHP) > 0,
      robot2Yielded: result.winnerId !== team2.id && (result.team2ReserveUsed ? result.team2ReserveFinalHP : result.team2ActiveFinalHP) > 0,
      robot1Destroyed: result.team1ReserveUsed ? result.team1ReserveFinalHP === 0 : result.team1ActiveFinalHP === 0,
      robot2Destroyed: result.team2ReserveUsed ? result.team2ReserveFinalHP === 0 : result.team2ActiveFinalHP === 0,

      // Damage tracking (placeholder)
      robot1DamageDealt: 0,
      robot2DamageDealt: 0,

      // ELO tracking (placeholder)
      robot1ELOBefore: team1.activeRobot.elo,
      robot2ELOBefore: team2.activeRobot.elo,
      robot1ELOAfter: team1.activeRobot.elo,
      robot2ELOAfter: team2.activeRobot.elo,
      eloChange: 0,
    },
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
  const baseRewardData = getLeagueBaseReward(league);
  const baseReward = baseRewardData.midpoint;
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
 * Calculate expected ELO score
 */
function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
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
  const expectedTeam1 = calculateExpectedScore(team1CombinedELO, team2CombinedELO);
  const expectedTeam2 = calculateExpectedScore(team2CombinedELO, team1CombinedELO);

  if (isDraw) {
    // Draw: both get 0.5 actual score
    const team1Change = Math.round(ELO_K_FACTOR * (0.5 - expectedTeam1));
    const team2Change = Math.round(ELO_K_FACTOR * (0.5 - expectedTeam2));
    return { team1Change, team2Change };
  } else {
    // Win/Loss: winner gets 1, loser gets 0
    const actualTeam1 = team1Won ? 1 : 0;
    const actualTeam2 = team1Won ? 0 : 1;

    const team1Change = Math.round(ELO_K_FACTOR * (actualTeam1 - expectedTeam1));
    const team2Change = Math.round(ELO_K_FACTOR * (actualTeam2 - expectedTeam2));

    return { team1Change, team2Change };
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

  let baseFame = baseFameByLeague[robot.currentLeague] || 0;

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
 * @param scheduledFor - Optional date filter for matches to execute
 * @returns Summary of executed battles
 */
export async function executeScheduledTagTeamBattles(scheduledFor?: Date): Promise<{
  totalBattles: number;
  wins: number;
  draws: number;
  losses: number;
  skippedDueToUnreadyRobots: number;
  totalStreamingRevenue?: number;
}> {
  // Query scheduled tag team matches
  const whereClause: any = {
    status: 'scheduled',
  };

  if (scheduledFor) {
    whereClause.scheduledFor = {
      lte: scheduledFor,
    };
  }

  const scheduledMatches = await prisma.tagTeamMatch.findMany({
    where: whereClause,
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

  console.log(`[TagTeamBattles] Found ${scheduledMatches.length} scheduled tag team matches`);

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
          console.log(
            `[TagTeamBattles] Skipping match ${match.id}: ` +
            `Team ${match.team1Id} ready: ${team1Ready}, Team ${match.team2Id} ready: ${team2Ready}`
          );
          
          // Mark match as cancelled
          await prisma.tagTeamMatch.update({
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

      // Track streaming revenue from audit log
      if (!isByeMatch) {
        const battleCompleteEvent = await prisma.auditLog.findFirst({
          where: {
            eventType: 'tag_team_battle',
            payload: {
              path: ['battleId'],
              equals: result.battleId,
            },
          },
          orderBy: { id: 'desc' },
        });
        
        if (battleCompleteEvent) {
          const payload = battleCompleteEvent.payload as any;
          const streamingRevenue1 = payload?.streamingRevenue1 || 0;
          const streamingRevenue2 = payload?.streamingRevenue2 || 0;
          totalStreamingRevenue += streamingRevenue1 + streamingRevenue2;
        }
      }

      // Update robot stats and apply rewards
      await updateTagTeamBattleResults(match, result);

    } catch (error) {
      console.error(`[TagTeamBattles] Error executing match ${match.id}:`, error);
      
      // Mark match as cancelled on error
      await prisma.tagTeamMatch.update({
        where: { id: match.id },
        data: { status: 'cancelled' },
      });
    }
  }

  console.log(
    `[TagTeamBattles] Execution complete: ${totalBattles} battles, ` +
    `${wins} wins, ${draws} draws, ${losses} losses, ` +
    `${skippedDueToUnreadyRobots} skipped due to unready robots`
  );
  if (totalStreamingRevenue > 0) {
    console.log(`[TagTeamBattles] Streaming Revenue: ₡${totalStreamingRevenue.toLocaleString()} total earned`);
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
 * Requirement 8.1, 8.2, 8.3: Both robots must have HP ≥75%, HP > yield threshold, all weapons equipped
 * Requirement 11.3: Dynamic eligibility checking after earlier matches
 */
async function checkTeamReadinessForBattle(team: {
  activeRobot: Robot;
  reserveRobot: Robot;
}): Promise<boolean> {
  const BATTLE_READINESS_HP_THRESHOLD = 75;

  // Check active robot
  const activeRobotHPPercent = (team.activeRobot.currentHP / team.activeRobot.maxHP) * 100;
  const activeYieldThresholdHP = Math.floor((team.activeRobot.yieldThreshold / 100) * team.activeRobot.maxHP);
  
  if (activeRobotHPPercent < BATTLE_READINESS_HP_THRESHOLD) {
    return false;
  }
  
  if (team.activeRobot.currentHP <= activeYieldThresholdHP) {
    return false;
  }
  
  if (!team.activeRobot.mainWeaponId) {
    return false;
  }

  // Check reserve robot
  const reserveRobotHPPercent = (team.reserveRobot.currentHP / team.reserveRobot.maxHP) * 100;
  const reserveYieldThresholdHP = Math.floor((team.reserveRobot.yieldThreshold / 100) * team.reserveRobot.maxHP);
  
  if (reserveRobotHPPercent < BATTLE_READINESS_HP_THRESHOLD) {
    return false;
  }
  
  if (team.reserveRobot.currentHP <= reserveYieldThresholdHP) {
    return false;
  }
  
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
  match: TagTeamMatch,
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
    const activeRobotCount = await prisma.robot.count({
      where: {
        userId: realTeam.stableId,
        NOT: { name: 'Bye Robot' }
      }
    });

    const repairBayLevel = repairBay ? repairBay.level : 0;
    const medicalBayLevel = medicalBay ? medicalBay.level : 0;

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

    // Update stable
    // Note: Repair costs are deducted separately by RepairService, not here
    await prisma.user.update({
      where: { id: realTeam.stableId },
      data: {
        currency: { increment: realTeamRewards },
        prestige: { increment: prestige },
      },
    });

    // Update battle record with actual values
    const winnerReward = realTeamWon ? realTeamRewards : 0;
    const loserReward = !realTeamWon && !isDraw ? realTeamRewards : 0;
    
    await prisma.battle.update({
      where: { id: result.battleId },
      data: {
        winnerReward,
        loserReward,
        robot1RepairCost: 0, // Deprecated: repair costs calculated by RepairService
        robot2RepairCost: 0, // Deprecated: repair costs calculated by RepairService
        robot1PrestigeAwarded: team1IsBye ? 0 : prestige,
        robot2PrestigeAwarded: team2IsBye ? 0 : prestige,
        robot1ELOAfter: team1IsBye ? 1000 : realTeam.activeRobot.elo + realTeamELOChange,
        robot2ELOAfter: team2IsBye ? 1000 : realTeam.activeRobot.elo + realTeamELOChange,
        eloChange: Math.abs(realTeamELOChange),
      },
    });

    console.log(
      `[TagTeamBattles] Updated bye-match results for match ${match.id}: ` +
      `Team ${realTeam.id} ELO ${realTeamELOChange > 0 ? '+' : ''}${realTeamELOChange}`
    );

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

  const team1ActiveRobotCount = await prisma.robot.count({
    where: {
      userId: team1.stableId,
      NOT: { name: 'Bye Robot' }
    }
  });
  const team2ActiveRobotCount = await prisma.robot.count({
    where: {
      userId: team2.stableId,
      NOT: { name: 'Bye Robot' }
    }
  });

  const team1RepairBayLevel = team1RepairBay ? team1RepairBay.level : 0;
  const team2RepairBayLevel = team2RepairBay ? team2RepairBay.level : 0;
  const team1MedicalBayLevel = team1MedicalBay ? team1MedicalBay.level : 0;
  const team2MedicalBayLevel = team2MedicalBay ? team2MedicalBay.level : 0;

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

  // Update stables (currency, prestige)
  // Note: Repair costs are deducted separately by RepairService, not here
  await prisma.user.update({
    where: { id: team1.stableId },
    data: {
      currency: { increment: team1Rewards },
      prestige: { increment: team1Prestige },
    },
  });

  await prisma.user.update({
    where: { id: team2.stableId },
    data: {
      currency: { increment: team2Rewards },
      prestige: { increment: team2Prestige },
    },
  });

  // Update battle record with actual values
  await prisma.battle.update({
    where: { id: result.battleId },
    data: {
      winnerReward: team1Won ? team1Rewards : team2Won ? team2Rewards : 0,
      loserReward: team1Won ? team2Rewards : team2Won ? team1Rewards : (isDraw ? team1Rewards : 0),
      robot1RepairCost: 0, // Deprecated: repair costs calculated by RepairService
      robot2RepairCost: 0, // Deprecated: repair costs calculated by RepairService
      robot1PrestigeAwarded: team1Prestige,
      robot2PrestigeAwarded: team2Prestige,
      robot1FameAwarded: team1ActiveFame + team1ReserveFame,
      robot2FameAwarded: team2ActiveFame + team2ReserveFame,
      robot1ELOAfter: team1.activeRobot.elo + eloChanges.team1Change,
      robot2ELOAfter: team2.activeRobot.elo + eloChanges.team2Change,
      eloChange: Math.abs(eloChanges.team1Change),
      robot1DamageDealt: result.team1ActiveDamageDealt + result.team1ReserveDamageDealt,
      robot2DamageDealt: result.team2ActiveDamageDealt + result.team2ReserveDamageDealt,
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

  console.log(
    `[TagTeamBattles] Updated results for match ${match.id}: ` +
    `Team ${team1.id} ELO ${eloChanges.team1Change > 0 ? '+' : ''}${eloChanges.team1Change}, ` +
    `Team ${team2.id} ELO ${eloChanges.team2Change > 0 ? '+' : ''}${eloChanges.team2Change}`
  );
  
  // Log fame awards
  if (team1ActiveFame > 0 || team1ReserveFame > 0) {
    console.log(
      `[TagTeamBattles] Fame awarded - Team ${team1.id}: ` +
      `${team1.activeRobot.name} +${team1ActiveFame}, ${team1.reserveRobot.name} +${team1ReserveFame}`
    );
  }
  if (team2ActiveFame > 0 || team2ReserveFame > 0) {
    console.log(
      `[TagTeamBattles] Fame awarded - Team ${team2.id}: ` +
      `${team2.activeRobot.name} +${team2ActiveFame}, ${team2.reserveRobot.name} +${team2ReserveFame}`
    );
  }

  // Calculate and award streaming revenue for both teams
  // Requirements 7.1-7.6: Use highest battle count and highest fame from each team
  const streamingRevenue = await calculateTagTeamStreamingRevenue(
    [team1.activeRobotId, team1.reserveRobotId],
    team1.stableId,
    [team2.activeRobotId, team2.reserveRobotId],
    team2.stableId
  );

  // Get current cycle number for analytics tracking
  const cycleNumber = await getCurrentCycleNumber();

  // Award streaming revenue to both teams
  await awardStreamingRevenue(team1.stableId, streamingRevenue.team1Revenue, cycleNumber);
  await awardStreamingRevenue(team2.stableId, streamingRevenue.team2Revenue, cycleNumber);

  // Log streaming revenue with details about which robots' stats were used
  console.log(
    `[Streaming] Team ${team1.id} earned ₡${streamingRevenue.team1Revenue.totalRevenue.toLocaleString()} ` +
    `(Battles from ${streamingRevenue.team1MaxBattlesRobot.name}, Fame from ${streamingRevenue.team1MaxFameRobot.name})`
  );
  console.log(
    `[Streaming] Team ${team2.id} earned ₡${streamingRevenue.team2Revenue.totalRevenue.toLocaleString()} ` +
    `(Battles from ${streamingRevenue.team2MaxBattlesRobot.name}, Fame from ${streamingRevenue.team2MaxFameRobot.name})`
  );

  // Log battle_complete event to audit log for tag team battles
  // Fetch the updated battle record to get all the data
  const battle = await prisma.battle.findUnique({
    where: { id: result.battleId },
  });

  if (battle) {
    const eventLogger = new EventLogger();
    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: battle.id,
        robot1Id: battle.robot1Id,
        robot2Id: battle.robot2Id,
        winnerId: battle.winnerId,
        
        // ELO tracking
        robot1ELOBefore: battle.robot1ELOBefore,
        robot1ELOAfter: battle.robot1ELOAfter,
        robot2ELOBefore: battle.robot2ELOBefore,
        robot2ELOAfter: battle.robot2ELOAfter,
        eloChange: battle.eloChange,
        
        // Damage tracking
        robot1DamageDealt: battle.robot1DamageDealt,
        robot2DamageDealt: battle.robot2DamageDealt,
        robot1FinalHP: battle.robot1FinalHP,
        robot2FinalHP: battle.robot2FinalHP,
        robot1FinalShield: battle.robot1FinalShield,
        robot2FinalShield: battle.robot2FinalShield,
        
        // Rewards
        winnerReward: battle.winnerReward,
        loserReward: battle.loserReward,
        robot1PrestigeAwarded: battle.robot1PrestigeAwarded,
        robot2PrestigeAwarded: battle.robot2PrestigeAwarded,
        robot1FameAwarded: battle.robot1FameAwarded,
        robot2FameAwarded: battle.robot2FameAwarded,
        
        // Streaming revenue
        streamingRevenue1: streamingRevenue.team1Revenue.totalRevenue,
        streamingRevenue2: streamingRevenue.team2Revenue.totalRevenue,
        streamingRevenueDetails1: {
          baseAmount: streamingRevenue.team1Revenue.baseAmount,
          battleMultiplier: streamingRevenue.team1Revenue.battleMultiplier,
          fameMultiplier: streamingRevenue.team1Revenue.fameMultiplier,
          studioMultiplier: streamingRevenue.team1Revenue.studioMultiplier,
          robotBattles: streamingRevenue.team1Revenue.robotBattles,
          robotFame: streamingRevenue.team1Revenue.robotFame,
          studioLevel: streamingRevenue.team1Revenue.studioLevel,
        },
        streamingRevenueDetails2: {
          baseAmount: streamingRevenue.team2Revenue.baseAmount,
          battleMultiplier: streamingRevenue.team2Revenue.battleMultiplier,
          fameMultiplier: streamingRevenue.team2Revenue.fameMultiplier,
          studioMultiplier: streamingRevenue.team2Revenue.studioMultiplier,
          robotBattles: streamingRevenue.team2Revenue.robotBattles,
          robotFame: streamingRevenue.team2Revenue.robotFame,
          studioLevel: streamingRevenue.team2Revenue.studioLevel,
        },
        
        // Battle metadata
        battleType: 'tag_team',
        leagueType: battle.leagueType,
        durationSeconds: battle.durationSeconds,
      }
    );
  }
}
