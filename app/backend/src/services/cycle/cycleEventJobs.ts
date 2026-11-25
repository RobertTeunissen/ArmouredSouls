/**
 * Scheduled battle-event job bodies, one per cron slot.
 *
 * Each job runs its slot's shared step sequence (`eventSlotSteps`: repair →
 * execute → rebalance → matchmaking, the same steps the admin bulk runner
 * uses) and reports a JobContext. `cycleScheduler` registers them, runs them
 * under its lock, and gates them during a Preparation_Phase.
 *
 * @module services/cycle/cycleEventJobs
 */

import { JobContext } from '../notifications/integration';
import {
  createLoggingStepRunner,
  runGrandMeleeSlot,
  runKothSlot,
  runLeague1v1Slot,
  runSoloTournamentSlot,
  runTagTeamSlot,
  runTeamLeagueSlot,
  runTeamTournamentSlot,
} from './eventSlotSteps';

export async function executeLeagueCycle(): Promise<JobContext> {
  const { battles } = await runLeague1v1Slot(createLoggingStepRunner('League Cycle'));
  return { jobName: 'league', matchesCompleted: battles.totalBattles };
}

export async function executeTournamentCycle(): Promise<JobContext> {
  const { tournaments } = await runSoloTournamentSlot(createLoggingStepRunner('Tournament Cycle'));
  const lastTournament = tournaments?.lastTournament ?? null;
  const createdTournament = tournaments?.createdTournament ?? null;

  if (lastTournament) {
    return {
      jobName: 'tournament',
      tournamentName: lastTournament.name,
      tournamentRound: lastTournament.currentRound,
      tournamentMaxRounds: lastTournament.maxRounds,
      matchesCompleted: tournaments?.summary.matchesExecuted ?? 0,
    };
  }
  if (createdTournament) {
    return { jobName: 'tournament', tournamentName: createdTournament.name, tournamentScheduled: true };
  }
  return { jobName: 'tournament' };
}

export async function executeTagTeamCycle(): Promise<JobContext> {
  const { battles } = await runTagTeamSlot(createLoggingStepRunner('Tag Team Cycle'));
  return { jobName: 'tag-team', matchesCompleted: battles.totalBattles };
}

export async function executeKothCycle(): Promise<JobContext> {
  const { battles } = await runKothSlot(createLoggingStepRunner('KotH Cycle'));
  return { jobName: 'koth', matchesCompleted: battles.successfulMatches };
}

export async function executeGrandMeleeCycle(): Promise<JobContext> {
  const { battles } = await runGrandMeleeSlot(createLoggingStepRunner('Grand Melee Cycle'));
  return { jobName: 'grandMelee', matchesCompleted: battles.successfulMatches };
}

export async function executeTeam2v2LeagueCycle(): Promise<JobContext> {
  const { battles } = await runTeamLeagueSlot(createLoggingStepRunner('Team 2v2 League Cycle'), 2);
  return { jobName: 'team2v2League', matchesCompleted: battles.matchesCompleted };
}

export async function executeTeam3v3LeagueCycle(): Promise<JobContext> {
  const { battles } = await runTeamLeagueSlot(createLoggingStepRunner('Team 3v3 League Cycle'), 3);
  return { jobName: 'team3v3League', matchesCompleted: battles.matchesCompleted };
}

/**
 * Team 2v2 / 3v3 tournament job. Reports the processed round when one ran,
 * otherwise the tournament created this run (R1.6).
 */
async function executeTeamTournamentCycle(teamSize: 2 | 3): Promise<JobContext> {
  const jobName = teamSize === 2 ? 'team2v2Tournament' : 'team3v3Tournament';
  const { processed, created } = await runTeamTournamentSlot(
    createLoggingStepRunner(`Team ${teamSize}v${teamSize} Tournament Cycle`),
    teamSize,
  );
  if (processed) {
    return {
      jobName,
      matchesCompleted: processed.matchesExecuted,
      tournamentName: processed.name,
      tournamentRound: processed.currentRound,
      tournamentMaxRounds: processed.maxRounds,
    };
  }
  if (created) {
    return { jobName, tournamentName: created.name, tournamentScheduled: true };
  }
  return { jobName };
}

export async function executeTeam2v2TournamentCycle(): Promise<JobContext> {
  return executeTeamTournamentCycle(2);
}

export async function executeTeam3v3TournamentCycle(): Promise<JobContext> {
  return executeTeamTournamentCycle(3);
}
