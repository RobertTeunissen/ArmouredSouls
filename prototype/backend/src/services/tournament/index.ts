// Tournament domain barrel file — re-exports the public API

export {
  processTournamentBattle,
} from './tournamentBattleOrchestrator';
export type {
  TournamentBattleResult,
} from './tournamentBattleOrchestrator';

export {
  getEligibleRobotsForTournament,
  seedRobotsByELO,
  generateStandardSeedOrder,
  computeSeedings,
  createSingleEliminationTournament,
  getActiveTournaments,
  getTournamentById,
  getCurrentRoundMatches,
  advanceWinnersToNextRound,
  autoCreateNextTournament,
} from './tournamentService';
export type {
  TournamentCreationResult,
  RoundExecutionSummary,
  SeedEntry,
  Round1Match,
  CompletedMatch,
} from './tournamentService';
