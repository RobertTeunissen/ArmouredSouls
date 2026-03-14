// Integration tests: everything that needs a database or supertest
// Runs with limited parallelism to avoid DB conflicts
const base = require('./jest.config');

// Unit test files to exclude (must match full path segments)
const unitTestPatterns = [
  '/backup\\.property\\.test\\.ts$',
  '/combatMessageGenerator\\.test\\.ts$',
  '/compute-seedings\\.unit\\.test\\.ts$',
  '/cors\\.property\\.test\\.ts$',
  '/damageDampeners\\.test\\.ts$',
  '/economyCalculations\\.test\\.ts$',
  '/envConfig\\.property\\.test\\.ts$',
  '/jwtService\\.test\\.ts$',
  '/notifications\\.property\\.test\\.ts$',
  '/onboardingAnalyticsService\\.test\\.ts$',
  '/passwordHashing\\.property\\.test\\.ts$',
  '/passwordService\\.test\\.ts$',
  '/recommendationEngine\\.test\\.ts$',
  '/repairCostMultiRobot\\.test\\.ts$',
  '/storageCalculations\\.test\\.ts$',
  '/streamingStudioOperatingCost\\.property\\.test\\.ts$',
  '/streamingStudioUpgradeCosts\\.property\\.test\\.ts$',
  '/tournament-bracket-seeding\\.property\\.test\\.ts$',
  '/validation\\.property\\.test\\.ts$',
];

// Heavy integration tests to exclude (run separately with jest.config.heavy.js)
const heavyTestPatterns = [
  '/integration/',                                          // tests/integration/ subfolder
  '/integration\\.test\\.ts$',                              // tests/integration.test.ts
  '/streamingRevenueFormula\\.property\\.test\\.ts$',       // 3147 lines, 36 assertions
  '/tagTeamBattleOrchestrator\\.property\\.test\\.ts$',     // 1328 lines, 47 assertions
  '/repairCostMultiRobot\\.property\\.test\\.ts$',          // 1439 lines, 29 assertions
  '/tagTeamValidation\\.property\\.test\\.ts$',             // 2293 lines, 15 assertions
  '/battleOrchestrator\\.test\\.ts$',                       // DB-heavy battle orchestration
  '/cycleSnapshot\\.property\\.test\\.ts$',                 // DB-heavy cycle snapshots
  '/tagTeamLeagueInstance\\.property\\.test\\.ts$',         // 32s+ DB-heavy tag team league
  '/tagTeamLeagueInstanceService\\.test\\.ts$',             // DB-heavy tag team service
  '/facilityRecommendation\\.property\\.test\\.ts$',        // 12s DB-heavy facility tests
  '/multiMatchScheduling\\.property\\.test\\.ts$',          // DB-heavy match scheduling
  '/financialReportStreamingRevenue\\.property\\.test\\.ts$', // DB-heavy financial reports
  '/leagueInstanceService\\.test\\.ts$',                    // DB-heavy league instance
];

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    '/node_modules/',
    ...unitTestPatterns,
    ...heavyTestPatterns,
  ],
  maxWorkers: 1,
  testTimeout: 60000,
};
