import cron, { ScheduledTask } from 'node-cron';
import logger from '../../config/logger';
import { getConfig } from '../../config/env';
import { getNextCronOccurrence } from '../../utils/scheduleUtils';
import { repairAllRobots } from '../economy/repairService';
import { executeScheduledBattles } from '../league/leagueBattleOrchestrator';
import { executeScheduledKothBattles } from '../koth/kothBattleOrchestrator';
import { rebalanceLeagues } from '../league/leagueRebalancingService';
import { runMatchmaking } from '../analytics/matchmakingService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
} from '../tournament/tournamentService';
import { processTournamentBattle } from '../tournament/tournamentBattleOrchestrator';
import { executeScheduledTagTeamBattles } from '../tag-team/tagTeamBattleOrchestrator';
import { rebalanceTagTeamLeagues } from '../tag-team/tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from '../tag-team/tagTeamMatchmakingService';
import { runKothMatchmaking } from '../koth/kothMatchmakingService';
import prisma from '../../lib/prisma';
import { practiceArenaMetrics } from '../practice-arena/practiceArenaMetrics';
import { EventLogger, EventType } from '../common/eventLogger';
import { JobContext } from '../notifications/integration';
import { buildSuccessMessage, buildErrorMessage, getActiveIntegrations, dispatchNotification } from '../notifications/notification-service';

const eventLogger = new EventLogger();

// --- Interfaces ---

export interface SchedulerConfig {
  enabled: boolean;
  leagueSchedule: string;      // cron: default '0 8 * * *'
  tournamentSchedule: string;   // cron: default '0 10 * * *'
  tagTeamSchedule: string;      // cron: default '0 11 * * *'
  settlementSchedule: string;   // cron: default '0 0 * * *'
  kothSchedule: string;          // cron: default '0 13 * * *'
  // Reserved slots for future battle events
  team2v2LeagueSchedule: string;       // cron: default '0 9 * * *'
  team3v3LeagueSchedule: string;       // cron: default '0 14 * * *'
  team2v2TournamentSchedule: string;   // cron: default '0 15 * * *'
  team3v3TournamentSchedule: string;   // cron: default '0 18 * * *'
  grandMeleeSchedule: string;          // cron: default '0 17 * * *'
}

export interface JobState {
  name:
    | 'league'
    | 'tournament'
    | 'tagTeam'
    | 'settlement'
    | 'koth'
    | 'team2v2League'
    | 'team3v3League'
    | 'team2v2Tournament'
    | 'team3v3Tournament'
    | 'grandMelee';
  schedule: string;
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunStatus: 'success' | 'failed' | null;
  lastError: string | null;
  nextRunAt: Date | null;
}

export interface SchedulerState {
  active: boolean;
  runningJob: string | null;
  queue: string[];
  jobs: JobState[];
}

// --- In-memory state ---

let schedulerActive = false;

const jobStates: Map<JobState['name'], JobState> = new Map();

let runningJob: string | null = null;
const jobQueue: string[] = [];
let lockResolve: (() => void) | null = null;

// --- Concurrency lock (in-memory mutex with queue) ---

async function acquireLock(jobName: string): Promise<void> {
  if (runningJob === null) {
    runningJob = jobName;
    return;
  }

  // Another job is running — queue this one and wait
  jobQueue.push(jobName);
  logger.info(`Scheduler: job "${jobName}" queued (waiting for "${runningJob}" to finish)`);

  await new Promise<void>((resolve) => {
    const checkLock = () => {
      const idx = jobQueue.indexOf(jobName);
      if (runningJob === null && idx === 0) {
        jobQueue.shift();
        runningJob = jobName;
        resolve();
      }
    };

    // Store a reference so releaseLock can notify waiters
    const originalRelease = lockResolve;
    lockResolve = () => {
      if (originalRelease) originalRelease();
      checkLock();
    };

    // Check immediately in case lock was released between check and wait
    checkLock();
  });
}

function releaseLock(): void {
  runningJob = null;
  if (lockResolve) {
    const notify = lockResolve;
    lockResolve = null;
    notify();
  }
}

// --- Stub job handlers (to be implemented in tasks 9.2–9.5) ---

async function executeLeagueCycle(): Promise<JobContext> {
  // Step 1: Repair all robots (always first per Requirement 24.24)
  logger.info('League Cycle: Step 1 — Repairing all robots');
  await repairAllRobots(true);

  // Step 2: Execute scheduled league battles (1v1)
  logger.info('League Cycle: Step 2 — Executing scheduled league battles');
  const battleSummary = await executeScheduledBattles(new Date());
  logger.info(`League Cycle: ${battleSummary.totalBattles} league battles executed`);

  // Step 3: Rebalance leagues
  logger.info('League Cycle: Step 3 — Rebalancing leagues');
  const rebalanceSummary = await rebalanceLeagues();
  logger.info(`League Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Schedule matchmaking with 24h lead time
  // Round scheduledFor to the top of the hour to avoid millisecond race conditions
  // where executeScheduledBattles' lte filter misses matches by a few ms
  logger.info('League Cycle: Step 4 — Scheduling league matchmaking (24h lead)');
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  scheduledFor.setMinutes(0, 0, 0);
  const matchesCreated = await runMatchmaking(scheduledFor);
  logger.info(`League Cycle: ${matchesCreated} matches scheduled for ${scheduledFor.toISOString()}`);

  return { jobName: 'league' };
}

async function executeTournamentCycle(): Promise<JobContext> {
  // Step 1: Repair all robots (always first per Requirement 24.24)
  logger.info('Tournament Cycle: Step 1 — Repairing all robots');
  await repairAllRobots(true);

  // Step 2: Execute/schedule tournament matches
  logger.info('Tournament Cycle: Step 2 — Executing tournament matches');
  let totalMatchesExecuted = 0;
  let totalRoundsExecuted = 0;
  let tournamentsCompleted = 0;

  const activeTournaments = await getActiveTournaments();
  let lastTournament: { name: string; currentRound: number; maxRounds: number } | null = null;

  for (const tournament of activeTournaments) {
    const currentRoundMatches = await getCurrentRoundMatches(tournament.id);

    if (currentRoundMatches.length > 0) {
      for (const match of currentRoundMatches) {
        await processTournamentBattle(match);
        totalMatchesExecuted++;
      }

      // Step 3: Advance winners to next round
      logger.info(`Tournament Cycle: Step 3 — Advancing winners for tournament ${tournament.id}`);
      await advanceWinnersToNextRound(tournament.id);
      totalRoundsExecuted++;
    }

    // Check if tournament completed
    const updatedTournament = await prisma.tournament.findUnique({
      where: { id: tournament.id },
    });

    if (updatedTournament?.status === 'completed') {
      tournamentsCompleted++;
    }

    lastTournament = {
      name: tournament.name,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
    };
  }

  logger.info(`Tournament Cycle: ${activeTournaments.length} tournaments processed, ${totalRoundsExecuted} rounds, ${totalMatchesExecuted} matches executed, ${tournamentsCompleted} completed`);

  // Step 4: Auto-create next tournament if none active
  logger.info('Tournament Cycle: Step 4 — Auto-creating next tournament if needed');
  const nextTournament = await autoCreateNextTournament();
  if (nextTournament) {
    logger.info(`Tournament Cycle: Auto-created tournament "${nextTournament.name}"`);
    if (!lastTournament) {
      return {
        jobName: 'tournament',
        tournamentName: nextTournament.name,
        tournamentScheduled: true,
      };
    }
  } else {
    logger.info('Tournament Cycle: No new tournament needed (active tournament exists or not enough participants)');
  }

  if (lastTournament) {
    return {
      jobName: 'tournament',
      tournamentName: lastTournament.name,
      tournamentRound: lastTournament.currentRound,
      tournamentMaxRounds: lastTournament.maxRounds,
    };
  }

  return { jobName: 'tournament' };
}

async function executeTagTeamCycle(): Promise<JobContext> {
  // Step 1: Repair all robots (always first per Requirement 24.24)
  logger.info('Tag Team Cycle: Step 1 — Repairing all robots');
  await repairAllRobots(true);

  // Step 2: Execute tag team battles (daily cadence — no parity check)
  logger.info('Tag Team Cycle: Step 2 — Executing tag team battles');
  const battleSummary = await executeScheduledTagTeamBattles(new Date());
  logger.info(`Tag Team Cycle: ${battleSummary.totalBattles} tag team battles executed`);

  // Step 3: Rebalance tag team leagues
  logger.info('Tag Team Cycle: Step 3 — Rebalancing tag team leagues');
  const rebalanceSummary = await rebalanceTagTeamLeagues();
  logger.info(`Tag Team Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Schedule tag team matchmaking with 24h lead time (daily cadence)
  // Round scheduledFor to the top of the hour to avoid millisecond race conditions
  logger.info('Tag Team Cycle: Step 4 — Scheduling tag team matchmaking (24h lead)');
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  scheduledFor.setMinutes(0, 0, 0);
  const matchesCreated = await runTagTeamMatchmaking(scheduledFor);
  logger.info(`Tag Team Cycle: ${matchesCreated} tag team matches scheduled for ${scheduledFor.toISOString()}`);

  return { jobName: 'tag-team' };
}

async function executeSettlement(): Promise<JobContext> {
  const settlementStart = Date.now();

  // Get or create cycle metadata (singleton pattern)
  let cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  if (!cycleMetadata) {
    cycleMetadata = await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: 0 },
    });
  }
  const currentCycleNumber = cycleMetadata.totalCycles;

  // Log cycle start event (required for snapshot creation)
  await eventLogger.logCycleStart(currentCycleNumber, 'scheduled');

  // Step 1: Calculate and credit passive income for all users
  logger.info('Daily Settlement: Step 1 — Processing passive income');
  const { calculateMerchandisingIncome, calculateFacilityOperatingCost } = await import('../../utils/economyCalculations');

  const allUsers = await prisma.user.findMany({
    where: { NOT: { username: 'bye_robot_user' } },
    select: { id: true, prestige: true },
  });

  const userIds = allUsers.map(u => u.id);

  // Batch-load all facilities and robots for all users (2 queries instead of 2N)
  const [allFacilities, allRobots] = await Promise.all([
    prisma.facility.findMany({ where: { userId: { in: userIds } } }),
    prisma.robot.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true, totalBattles: true, fame: true, name: true },
    }),
  ]);

  // Group by userId in memory
  const facilitiesByUser = new Map<number, typeof allFacilities>();
  for (const f of allFacilities) {
    if (!facilitiesByUser.has(f.userId)) facilitiesByUser.set(f.userId, []);
    facilitiesByUser.get(f.userId)!.push(f);
  }
  const robotsByUser = new Map<number, typeof allRobots>();
  for (const r of allRobots) {
    if (!robotsByUser.has(r.userId)) robotsByUser.set(r.userId, []);
    robotsByUser.get(r.userId)!.push(r);
  }

  let totalPassiveIncome = 0;
  let totalOperatingCosts = 0;

  // Collect audit events for batch insertion
  const passiveIncomeEvents: Array<{
    eventType: typeof import('../common/eventLogger').EventType.PASSIVE_INCOME;
    payload: Record<string, unknown>;
    userId: number;
  }> = [];

  for (const user of allUsers) {
    const userFacilities = facilitiesByUser.get(user.id) || [];
    const merchHub = userFacilities.find(f => f.facilityType === 'merchandising_hub');
    const merchLevel = merchHub?.level || 0;

    const merchandising = calculateMerchandisingIncome(merchLevel, user.prestige);

    if (merchandising > 0) {
      const userRobots = robotsByUser.get(user.id) || [];
      const totalBattles = userRobots.reduce((sum, r) => sum + r.totalBattles, 0);
      const totalFame = userRobots.reduce((sum, r) => sum + r.fame, 0);

      passiveIncomeEvents.push({
        eventType: EventType.PASSIVE_INCOME,
        payload: {
          merchandising,
          streaming: 0,
          totalIncome: merchandising,
          facilityLevel: merchLevel,
          prestige: user.prestige,
          totalBattles,
          totalFame,
        },
        userId: user.id,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { currency: { increment: merchandising } },
      });

      totalPassiveIncome += merchandising;
    }
  }

  // Batch-insert passive income audit events
  if (passiveIncomeEvents.length > 0) {
    await eventLogger.logEventBatch(currentCycleNumber, passiveIncomeEvents);
  }
  logger.info(`Daily Settlement: Passive income credited — ₡${totalPassiveIncome.toLocaleString()}`);

  // Step 2: Calculate and debit operating costs for all users
  logger.info('Daily Settlement: Step 2 — Processing operating costs');

  const operatingCostEvents: Array<{
    eventType: typeof import('../common/eventLogger').EventType.OPERATING_COSTS;
    payload: Record<string, unknown>;
    userId: number;
  }> = [];

  for (const user of allUsers) {
    const userFacilities = facilitiesByUser.get(user.id) || [];
    const userRobots = robotsByUser.get(user.id) || [];

    const facilityCosts = userFacilities.map(f => ({
      facilityType: f.facilityType,
      level: f.level,
      cost: calculateFacilityOperatingCost(f.facilityType, f.level),
    }));

    let totalCost = facilityCosts.reduce((sum, f) => sum + f.cost, 0);

    if (userRobots.length > 1) {
      const rosterCost = (userRobots.length - 1) * 500;
      facilityCosts.push({
        facilityType: 'roster_expansion',
        level: 0,
        cost: rosterCost,
      });
      totalCost += rosterCost;
    }

    if (totalCost > 0) {
      operatingCostEvents.push({
        eventType: EventType.OPERATING_COSTS,
        payload: {
          costs: facilityCosts.filter(f => f.cost > 0),
          totalCost,
        },
        userId: user.id,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { currency: { decrement: totalCost } },
      });

      totalOperatingCosts += totalCost;
    }
  }

  // Batch-insert operating cost audit events
  if (operatingCostEvents.length > 0) {
    await eventLogger.logEventBatch(currentCycleNumber, operatingCostEvents);
  }
  logger.info(`Daily Settlement: Operating costs debited — ₡${totalOperatingCosts.toLocaleString()}`);

  // Check for bankrupt users and award daily_finances achievements
  try {
    const { achievementService } = await import('../achievement');
    const bankruptUsers = await prisma.user.findMany({
      where: {
        NOT: { username: 'bye_robot_user' },
        currency: { lt: 0 },
      },
      select: { id: true },
    });
    for (const user of bankruptUsers) {
      try {
        await achievementService.checkAndAward(user.id, null, {
          type: 'daily_finances',
          data: { bankrupt: true },
        });
      } catch (err) {
        logger.error(`[Settlement] Achievement check failed for bankrupt user ${user.id}: ${err}`);
      }
    }
  } catch (err) {
    logger.error(`[Settlement] Bankrupt achievement check failed: ${err}`);
  }

  // Step 3: Log end-of-cycle balances for all users (batch insert)
  logger.info('Daily Settlement: Step 3 — Logging end-of-cycle balances');
  const endOfCycleUsers = await prisma.user.findMany({
    where: { NOT: { username: 'bye_robot_user' } },
    select: { id: true, username: true, stableName: true, currency: true },
    orderBy: { id: 'asc' },
  });

  await eventLogger.logEventBatch(
    currentCycleNumber,
    endOfCycleUsers.map(user => ({
      eventType: EventType.CYCLE_END_BALANCE,
      payload: {
        username: user.username,
        stableName: user.stableName,
        balance: user.currency,
      },
      userId: user.id,
    })),
  );
  logger.info(`Daily Settlement: Balances logged for ${endOfCycleUsers.length} users`);

  // Step 4: Increment cycle counters (cycleMetadata.totalCycles + 1, lastCycleAt, robot/tagTeam counters)
  logger.info('Daily Settlement: Step 4 — Incrementing cycle counters');
  const newCycleNumber = currentCycleNumber + 1;

  await prisma.cycleMetadata.update({
    where: { id: 1 },
    data: {
      totalCycles: newCycleNumber,
      lastCycleAt: new Date(),
    },
  });

  await prisma.robot.updateMany({
    where: { NOT: { name: 'Bye Robot' } },
    data: { cyclesInCurrentLeague: { increment: 1 } },
  });

  await prisma.tagTeam.updateMany({
    data: { cyclesInTagTeamLeague: { increment: 1 } },
  });
  logger.info(`Daily Settlement: Cycle counters incremented — now at cycle ${newCycleNumber}`);

  // Step 5: Create analytics snapshot
  logger.info('Daily Settlement: Step 5 — Creating analytics snapshot');
  try {
    // Log cycle complete event (required for snapshot creation)
    const settlementDuration = Date.now() - settlementStart;
    await eventLogger.logCycleComplete(currentCycleNumber, settlementDuration);

    const { cycleSnapshotService } = await import('./cycleSnapshotService');
    await cycleSnapshotService.createSnapshot(currentCycleNumber);
    logger.info(`Daily Settlement: Analytics snapshot created for cycle ${currentCycleNumber}`);
  } catch (snapshotError) {
    logger.error(`Daily Settlement: Failed to create analytics snapshot — ${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}`);
  }

  // Step 6: Flush practice arena daily stats
  logger.info('Settlement: Flushing practice arena daily stats');
  try {
    await practiceArenaMetrics.flushAndReset();
    logger.info('Settlement: Flushed practice arena daily stats');
  } catch (practiceArenaError) {
    logger.error(`Settlement: Failed to flush practice arena daily stats — ${practiceArenaError instanceof Error ? practiceArenaError.message : String(practiceArenaError)}`);
  }

  // Step 7: Auto-generate users if needed
  logger.info('Daily Settlement: Step 7 — Auto-generating users');
  try {
    const { generateBattleReadyUsers } = await import('../../utils/userGeneration');
    const userGenSummary = await generateBattleReadyUsers(currentCycleNumber);
    logger.info(`Daily Settlement: Generated ${userGenSummary.usersCreated} users, ${userGenSummary.robotsCreated} robots`);
  } catch (userGenError) {
    logger.error(`Daily Settlement: Failed to auto-generate users — ${userGenError instanceof Error ? userGenError.message : String(userGenError)}`);
  }

  logger.info(`Daily Settlement: Completed — passive income ₡${totalPassiveIncome.toLocaleString()}, operating costs ₡${totalOperatingCosts.toLocaleString()}, ${endOfCycleUsers.length} users processed`);

  // Refresh achievement rarity cache after settlement
  try {
    const { achievementService } = await import('../achievement');
    await achievementService.refreshRarityCache();
    logger.info('Daily Settlement: Achievement rarity cache refreshed');
  } catch (err) {
    logger.error(`Daily Settlement: Failed to refresh achievement rarity cache — ${err instanceof Error ? err.message : String(err)}`);
  }

  return { jobName: 'settlement' };
}

// --- KotH cycle handler ---

async function executeKothCycle(): Promise<JobContext> {
  // Step 1: Repair all robots (always first - players can do manual repair with discount beforehand)
  logger.info('KotH Cycle: Step 1 — Repairing all robots');
  await repairAllRobots(true);

  // Step 2: Execute scheduled KotH battles
  logger.info('KotH Cycle: Step 2 — Executing scheduled KotH battles');
  const battleSummary = await executeScheduledKothBattles(new Date());
  logger.info(`KotH Cycle: ${battleSummary.successfulMatches} KotH matches executed (${battleSummary.failedMatches} failed)`);

  // Step 3: Schedule KotH matchmaking for next day (24h from now, rounded to the hour)
  logger.info('KotH Cycle: Step 3 — Scheduling KotH matchmaking');
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  scheduledFor.setMinutes(0, 0, 0);

  // Get current cycle number for zone rotation (cycle % 3 === 0 → rotatingZone)
  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  const cycleNumber = cycleMetadata?.totalCycles ?? 0;

  const matchesCreated = await runKothMatchmaking(scheduledFor, cycleNumber);
  logger.info(`KotH Cycle: ${matchesCreated} KotH matches scheduled for ${scheduledFor.toISOString()}`);

  return { jobName: 'koth', matchesCompleted: battleSummary.successfulMatches };
}

// --- Reserved-slot stub handler factory ---

/**
 * Creates a no-op handler for a reserved cron slot.
 * The stub logs an info message with the event name and cycle number,
 * then returns successfully. It does NOT trigger monitoring alerts or
 * count as a failure — the notification system only dispatches for
 * known JobName values, so unknown names fall through silently.
 *
 * Future specs (e.g. Spec 37 for Team Battles) replace these stubs
 * with real handlers without modifying env.ts or the slot map.
 */
export function createReservedSlotHandler(eventName: string): () => Promise<JobContext> {
  return async (): Promise<JobContext> => {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const cycleNumber = cycleMetadata?.totalCycles ?? 0;
    logger.info(
      `Scheduler: reserved slot "${eventName}" fired (cycle ${cycleNumber}) — reserved slot, no handler implemented yet`
    );
    return { jobName: eventName as JobContext['jobName'] };
  };
}

// --- Job runner with concurrency lock, logging, and error handling ---

export async function runJob(jobName: JobState['name'], handler: () => Promise<JobContext | void>): Promise<void> {
  await acquireLock(jobName);

  const state = jobStates.get(jobName);
  const startTime = new Date();

  logger.info(`Scheduler: job "${jobName}" started at ${startTime.toISOString()}`);

  try {
    const jobContext = await handler();

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    if (state) {
      state.lastRunAt = startTime;
      state.lastRunDurationMs = durationMs;
      state.lastRunStatus = 'success';
      state.lastError = null;
    }

    logger.info(`Scheduler: job "${jobName}" completed at ${endTime.toISOString()} (duration: ${durationMs}ms)`);

    // Structured log entry for telemetry (R7.1)
    logger.info({
      event: 'battle_event_complete',
      eventName: jobName,
      startTimestamp: startTime.toISOString(),
      durationMs,
      matchesProcessed: jobContext?.matchesCompleted ?? 0,
      failures: 0,
    });

    // Dispatch success notification
    try {
      if (jobContext) {
        const appBaseUrl = getConfig().appBaseUrl ?? '';
        const message = buildSuccessMessage(jobContext, appBaseUrl);
        if (message) {
          const integrations = getActiveIntegrations();
          await dispatchNotification(message, integrations);
        }
      }
    } catch (notifyError) {
      logger.error(`Scheduler: notification dispatch failed for "${jobName}" — ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`);
    }
  } catch (error) {
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (state) {
      state.lastRunAt = startTime;
      state.lastRunDurationMs = durationMs;
      state.lastRunStatus = 'failed';
      state.lastError = errorMessage;
    }

    logger.error(`Scheduler: job "${jobName}" failed at ${endTime.toISOString()} (duration: ${durationMs}ms) — ${errorMessage}`);

    // Structured log entry for telemetry (R7.1, R7.4)
    logger.info({
      event: 'battle_event_complete',
      eventName: jobName,
      startTimestamp: startTime.toISOString(),
      durationMs,
      matchesProcessed: 0,
      failures: 1,
      error: errorMessage,
    });

    // Dispatch error notification
    try {
      const appBaseUrl = getConfig().appBaseUrl ?? '';
      const errorMsg = buildErrorMessage(jobName, appBaseUrl);
      const integrations = getActiveIntegrations();
      await dispatchNotification(errorMsg, integrations);
    } catch (notifyError) {
      logger.error(`Scheduler: error notification dispatch failed for "${jobName}" — ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`);
    }
  } finally {
    releaseLock();
  }
}

// --- Scheduler initialization ---

const scheduledTasks: ScheduledTask[] = [];

export function initScheduler(config: SchedulerConfig): void {
  if (!config.enabled) {
    schedulerActive = false;
    logger.info('Scheduler: automated scheduling is disabled (SCHEDULER_ENABLED is not true)');
    return;
  }

  schedulerActive = true;

  // Define all 10 jobs in canonical slot map order (R1.1)
  const jobs: Array<{ name: JobState['name']; schedule: string; handler: () => Promise<JobContext> }> = [
    { name: 'league', schedule: config.leagueSchedule, handler: executeLeagueCycle },                           // 08:00
    { name: 'team2v2League', schedule: config.team2v2LeagueSchedule, handler: createReservedSlotHandler('team2v2League') }, // 09:00
    { name: 'tournament', schedule: config.tournamentSchedule, handler: executeTournamentCycle },                // 10:00
    { name: 'tagTeam', schedule: config.tagTeamSchedule, handler: executeTagTeamCycle },                        // 11:00
    { name: 'koth', schedule: config.kothSchedule, handler: executeKothCycle },                                 // 13:00
    { name: 'team3v3League', schedule: config.team3v3LeagueSchedule, handler: createReservedSlotHandler('team3v3League') }, // 14:00
    { name: 'team2v2Tournament', schedule: config.team2v2TournamentSchedule, handler: createReservedSlotHandler('team2v2Tournament') }, // 15:00
    { name: 'grandMelee', schedule: config.grandMeleeSchedule, handler: createReservedSlotHandler('grandMelee') },         // 17:00
    { name: 'team3v3Tournament', schedule: config.team3v3TournamentSchedule, handler: createReservedSlotHandler('team3v3Tournament') }, // 18:00
    { name: 'settlement', schedule: config.settlementSchedule, handler: executeSettlement },                     // 00:00
  ];

  for (const job of jobs) {
    // Initialize job state
    jobStates.set(job.name, {
      name: job.name,
      schedule: job.schedule,
      lastRunAt: null,
      lastRunDurationMs: null,
      lastRunStatus: null,
      lastError: null,
      nextRunAt: null,
    });

    // Register cron job (UTC timezone)
    const task = cron.schedule(job.schedule, () => {
      runJob(job.name, job.handler);
    }, {
      timezone: 'UTC',
      name: job.name,
    });

    scheduledTasks.push(task);

    logger.info(`Scheduler: registered "${job.name}" job with schedule "${job.schedule}" (UTC)`);
  }

  logger.info('Scheduler: all 10 jobs registered and active');
}

// --- State query ---

export function getSchedulerState(): SchedulerState {
  // Compute nextRunAt dynamically from each job's cron schedule
  const jobs = Array.from(jobStates.values()).map(job => ({
    ...job,
    nextRunAt: schedulerActive ? getNextCronOccurrence(job.schedule) : null,
  }));

  return {
    active: schedulerActive,
    runningJob,
    queue: [...jobQueue],
    jobs,
  };
}

// --- Reset (for testing) ---

export function resetScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  jobStates.clear();
  runningJob = null;
  jobQueue.length = 0;
  lockResolve = null;
  schedulerActive = false;
}
