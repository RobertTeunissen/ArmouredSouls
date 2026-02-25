import cron, { ScheduledTask } from 'node-cron';
import logger from '../config/logger';
import { repairAllRobots } from './repairService';
import { executeScheduledBattles } from './battleOrchestrator';
import { rebalanceLeagues } from './leagueRebalancingService';
import { runMatchmaking } from './matchmakingService';
import {
  getActiveTournaments,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
} from './tournamentService';
import { processTournamentBattle } from './tournamentBattleOrchestrator';
import { executeScheduledTagTeamBattles } from './tagTeamBattleOrchestrator';
import { rebalanceTagTeamLeagues } from './tagTeamLeagueRebalancingService';
import { runTagTeamMatchmaking } from './tagTeamMatchmakingService';
import prisma from '../lib/prisma';
import { EventLogger } from './eventLogger';

const eventLogger = new EventLogger();

// --- Interfaces ---

export interface SchedulerConfig {
  enabled: boolean;
  leagueSchedule: string;      // cron: default '0 20 * * *'
  tournamentSchedule: string;   // cron: default '0 8 * * *'
  tagTeamSchedule: string;      // cron: default '0 12 * * *'
  settlementSchedule: string;   // cron: default '0 23 * * *'
}

export interface JobState {
  name: 'league' | 'tournament' | 'tagTeam' | 'settlement';
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

async function executeLeagueCycle(): Promise<void> {
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
  logger.info('League Cycle: Step 4 — Scheduling league matchmaking (24h lead)');
  const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const matchesCreated = await runMatchmaking(scheduledFor);
  logger.info(`League Cycle: ${matchesCreated} matches scheduled for ${scheduledFor.toISOString()}`);
}

async function executeTournamentCycle(): Promise<void> {
  // Step 1: Repair all robots (always first per Requirement 24.24)
  logger.info('Tournament Cycle: Step 1 — Repairing all robots');
  await repairAllRobots(true);

  // Step 2: Execute/schedule tournament matches
  logger.info('Tournament Cycle: Step 2 — Executing tournament matches');
  let totalMatchesExecuted = 0;
  let totalRoundsExecuted = 0;
  let tournamentsCompleted = 0;

  const activeTournaments = await getActiveTournaments();

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
  }

  logger.info(`Tournament Cycle: ${activeTournaments.length} tournaments processed, ${totalRoundsExecuted} rounds, ${totalMatchesExecuted} matches executed, ${tournamentsCompleted} completed`);

  // Step 4: Auto-create next tournament if none active
  logger.info('Tournament Cycle: Step 4 — Auto-creating next tournament if needed');
  const nextTournament = await autoCreateNextTournament();
  if (nextTournament) {
    logger.info(`Tournament Cycle: Auto-created tournament "${nextTournament.name}"`);
  } else {
    logger.info('Tournament Cycle: No new tournament needed (active tournament exists or not enough participants)');
  }
}

async function executeTagTeamCycle(): Promise<void> {
  // Step 1: Repair all robots (always first per Requirement 24.24)
  logger.info('Tag Team Cycle: Step 1 — Repairing all robots');
  await repairAllRobots(true);

  // Get current cycle number from cycleMetadata to determine odd/even
  let cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  if (!cycleMetadata) {
    cycleMetadata = await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: 0 },
    });
  }
  const currentCycleNumber = cycleMetadata.totalCycles;
  const isOddCycle = currentCycleNumber % 2 === 1;

  if (!isOddCycle) {
    // Even cycle — skip battle execution (Requirement 24.9)
    logger.info(`Tag Team Cycle: Skipping battles on even cycle ${currentCycleNumber} — tag team battles only execute on odd cycles`);
    return;
  }

  // Odd cycle — execute full tag team cycle (Requirement 24.8)
  // Step 2: Execute tag team battles
  logger.info(`Tag Team Cycle: Step 2 — Executing tag team battles (odd cycle ${currentCycleNumber})`);
  const battleSummary = await executeScheduledTagTeamBattles(new Date());
  logger.info(`Tag Team Cycle: ${battleSummary.totalBattles} tag team battles executed`);

  // Step 3: Rebalance tag team leagues
  logger.info('Tag Team Cycle: Step 3 — Rebalancing tag team leagues');
  const rebalanceSummary = await rebalanceTagTeamLeagues();
  logger.info(`Tag Team Cycle: Rebalanced — ${rebalanceSummary.totalPromoted} promoted, ${rebalanceSummary.totalDemoted} demoted`);

  // Step 4: Schedule tag team matchmaking with 48h lead time
  logger.info('Tag Team Cycle: Step 4 — Scheduling tag team matchmaking (48h lead)');
  const scheduledFor = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const matchesCreated = await runTagTeamMatchmaking(scheduledFor);
  logger.info(`Tag Team Cycle: ${matchesCreated} tag team matches scheduled for ${scheduledFor.toISOString()}`);
}

async function executeSettlement(): Promise<void> {
  // Get or create cycle metadata (singleton pattern)
  let cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  if (!cycleMetadata) {
    cycleMetadata = await prisma.cycleMetadata.create({
      data: { id: 1, totalCycles: 0 },
    });
  }
  const currentCycleNumber = cycleMetadata.totalCycles;

  // Step 1: Calculate and credit passive income for all users
  logger.info('Daily Settlement: Step 1 — Processing passive income');
  const { calculateDailyPassiveIncome, calculateFacilityOperatingCost } = await import('../utils/economyCalculations');

  const allUsers = await prisma.user.findMany({
    where: { NOT: { username: 'bye_robot_user' } },
    select: { id: true, prestige: true },
  });

  let totalPassiveIncome = 0;
  let totalOperatingCosts = 0;

  for (const user of allUsers) {
    const passiveIncome = await calculateDailyPassiveIncome(user.id);

    if (passiveIncome.total > 0) {
      const userRobots = await prisma.robot.findMany({
        where: { userId: user.id },
        select: { totalBattles: true, fame: true },
      });
      const totalBattles = userRobots.reduce((sum, r) => sum + r.totalBattles, 0);
      const totalFame = userRobots.reduce((sum, r) => sum + r.fame, 0);

      const incomeGenerator = await prisma.facility.findUnique({
        where: {
          userId_facilityType: {
            userId: user.id,
            facilityType: 'merchandising_hub',
          },
        },
      });

      await eventLogger.logPassiveIncome(
        currentCycleNumber,
        user.id,
        passiveIncome.merchandising,
        0,
        incomeGenerator?.level || 0,
        user.prestige,
        totalBattles,
        totalFame
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { currency: { increment: passiveIncome.total } },
      });

      totalPassiveIncome += passiveIncome.total;
    }
  }
  logger.info(`Daily Settlement: Passive income credited — ₡${totalPassiveIncome.toLocaleString()}`);

  // Step 2: Calculate and debit operating costs for all users
  logger.info('Daily Settlement: Step 2 — Processing operating costs');

  for (const user of allUsers) {
    const facilities = await prisma.facility.findMany({
      where: { userId: user.id },
    });

    const userRobots = await prisma.robot.findMany({
      where: { userId: user.id },
      select: { totalBattles: true, fame: true },
    });

    const facilityCosts = facilities.map(f => ({
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
      await eventLogger.logOperatingCosts(
        currentCycleNumber,
        user.id,
        facilityCosts.filter(f => f.cost > 0),
        totalCost
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { currency: { decrement: totalCost } },
      });

      totalOperatingCosts += totalCost;
    }
  }
  logger.info(`Daily Settlement: Operating costs debited — ₡${totalOperatingCosts.toLocaleString()}`);

  // Step 3: Log end-of-cycle balances for all users
  logger.info('Daily Settlement: Step 3 — Logging end-of-cycle balances');
  const endOfCycleUsers = await prisma.user.findMany({
    where: { NOT: { username: 'bye_robot_user' } },
    select: { id: true, username: true, stableName: true, currency: true },
    orderBy: { id: 'asc' },
  });

  for (const user of endOfCycleUsers) {
    await eventLogger.logCycleEndBalance(
      currentCycleNumber,
      user.id,
      user.username,
      user.stableName,
      user.currency
    );
  }
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
    const { cycleSnapshotService } = await import('./cycleSnapshotService');
    await cycleSnapshotService.createSnapshot(currentCycleNumber);
    logger.info(`Daily Settlement: Analytics snapshot created for cycle ${currentCycleNumber}`);
  } catch (snapshotError) {
    logger.error(`Daily Settlement: Failed to create analytics snapshot — ${snapshotError instanceof Error ? snapshotError.message : String(snapshotError)}`);
  }

  // Step 6: Auto-generate users if needed
  logger.info('Daily Settlement: Step 6 — Auto-generating users');
  try {
    const { generateBattleReadyUsers } = await import('../utils/userGeneration');
    const userGenSummary = await generateBattleReadyUsers(currentCycleNumber);
    logger.info(`Daily Settlement: Generated ${userGenSummary.usersCreated} users, ${userGenSummary.robotsCreated} robots`);
  } catch (userGenError) {
    logger.error(`Daily Settlement: Failed to auto-generate users — ${userGenError instanceof Error ? userGenError.message : String(userGenError)}`);
  }

  logger.info(`Daily Settlement: Completed — passive income ₡${totalPassiveIncome.toLocaleString()}, operating costs ₡${totalOperatingCosts.toLocaleString()}, ${endOfCycleUsers.length} users processed`);
}

// --- Job runner with concurrency lock, logging, and error handling ---

export async function runJob(jobName: JobState['name'], handler: () => Promise<void>): Promise<void> {
  await acquireLock(jobName);

  const state = jobStates.get(jobName);
  const startTime = new Date();

  logger.info(`Scheduler: job "${jobName}" started at ${startTime.toISOString()}`);

  try {
    await handler();

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    if (state) {
      state.lastRunAt = startTime;
      state.lastRunDurationMs = durationMs;
      state.lastRunStatus = 'success';
      state.lastError = null;
    }

    logger.info(`Scheduler: job "${jobName}" completed at ${endTime.toISOString()} (duration: ${durationMs}ms)`);
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

  // Define the 4 jobs with their schedules and handlers
  const jobs: Array<{ name: JobState['name']; schedule: string; handler: () => Promise<void> }> = [
    { name: 'league', schedule: config.leagueSchedule, handler: executeLeagueCycle },
    { name: 'tournament', schedule: config.tournamentSchedule, handler: executeTournamentCycle },
    { name: 'tagTeam', schedule: config.tagTeamSchedule, handler: executeTagTeamCycle },
    { name: 'settlement', schedule: config.settlementSchedule, handler: executeSettlement },
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

  logger.info('Scheduler: all 4 jobs registered and active');
}

// --- State query ---

export function getSchedulerState(): SchedulerState {
  return {
    active: schedulerActive,
    runningJob,
    queue: [...jobQueue],
    jobs: Array.from(jobStates.values()),
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
