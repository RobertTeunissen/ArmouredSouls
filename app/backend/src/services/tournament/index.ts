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
  seedParticipantsByELO,
  generateStandardSeedOrder,
  computeSeedings,
  createTournament,
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
  TournamentParticipant,
  CreateTournamentOptions,
} from './tournamentService';

export {
  getEligibleTeamsForTournament,
  createTeamTournament,
  autoCreateNextTeamTournament,
} from './teamTournamentService';

export {
  processTeamTournamentBattle,
  executeTeamTournamentRound,
} from './teamTournamentBattleOrchestrator';
export type {
  TeamTournamentBattleResult,
  RoundExecutionResult,
} from './teamTournamentBattleOrchestrator';
