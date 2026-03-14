// Heavy integration tests: full cycle execution, bulk operations
// These tests hit the real database with full game cycles and should be run separately
// Run with: npm run test:heavy
const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: undefined,
  testRegex: [
    'tests/integration/.+\\.test\\.ts$',
    'tests/integration\\.test\\.ts$',
    'streamingRevenueFormula\\.property\\.test\\.ts$',
    'tagTeamBattleOrchestrator\\.property\\.test\\.ts$',
    'repairCostMultiRobot\\.property\\.test\\.ts$',
    'tagTeamValidation\\.property\\.test\\.ts$',
    'battleOrchestrator\\.test\\.ts$',
    'cycleSnapshot\\.property\\.test\\.ts$',
    'tagTeamLeagueInstance\\.property\\.test\\.ts$',
    'tagTeamLeagueInstanceService\\.test\\.ts$',
    'facilityRecommendation\\.property\\.test\\.ts$',
    'multiMatchScheduling\\.property\\.test\\.ts$',
    'financialReportStreamingRevenue\\.property\\.test\\.ts$',
    'leagueInstanceService\\.test\\.ts$',
  ],
  maxWorkers: 1,
  testTimeout: 120000,
};
