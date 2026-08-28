/**
 * Tag Team Battle Orchestrator — barrel re-export.
 * All logic lives in focused sub-modules in this directory.
 * This file exists to preserve existing import paths.
 */
export * from './tagTeamTypes';
// `tagTeamByeTeam` was deleted by Spec #49. Its only purpose was building a
// combat-ready Bye_Placeholder team for a simulation that no longer runs.
export * from './tagTeamSimulation';
export * from './tagTeamBattleRecord';
export * from './tagTeamRewards';
export * from './tagTeamScheduler';
export * from './tagTeamResultUpdater';
