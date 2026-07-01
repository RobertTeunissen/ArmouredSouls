// Integration tests: everything that needs a real database or supertest
// Runs with limited parallelism to avoid DB conflicts
//
// Strategy: match all test files, then exclude:
// 1. Everything the unit config runs (derived from its testRegex)
// 2. Heavy tests (run separately with jest.config.heavy.js)
// 3. Files the unit config excludes from src/__tests__/ are kept here (they need DB)
const base = require('./jest.config');
const unitConfig = require('./jest.config.unit.js');

// Build exclusion patterns from unit config's testRegex (array or string)
const unitRegex = Array.isArray(unitConfig.testRegex)
  ? unitConfig.testRegex
  : [unitConfig.testRegex];

// The unit config excludes certain src/__tests__/ files via testPathIgnorePatterns.
// Those files match the broad src/__tests__ regex but are NOT run by the unit runner —
// they belong here in integration. The pureSrcTestPatterns list below explicitly excludes
// only the files the unit runner DOES run, keeping the DB-dependent ones for integration.
const unitPatternsWithoutSrc = unitRegex.filter((r) => !r.includes('__tests__') || r.startsWith('tests/'));

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

// Pure src/__tests__/ files that the unit config runs (exclude from integration)
const pureSrcTestPatterns = [
  '/src/__tests__/guide/guide-service\\.property\\.test\\.ts$',
  '/src/__tests__/guide/guide-service\\.test\\.ts$',
  '/src/__tests__/guide/markdown-parser\\.test\\.ts$',
  '/src/middleware/__tests__/authenticateToken\\.property\\.test\\.ts$',
  '/src/routes/__tests__/achievements\\.test\\.ts$',
  '/src/routes/__tests__/leagueHistoryPublic\\.test\\.ts$',
  '/src/services/achievement/__tests__/achievementConfig\\.test\\.ts$',
  '/src/services/achievement/__tests__/achievementService\\.property\\.test\\.ts$',
  '/src/services/admin/__tests__/adminAuditLogService\\.test\\.ts$',
  '/src/services/analytics/__tests__/byeRobotFabrication\\.property\\.test\\.ts$',
  '/src/services/changelog/__tests__/changelogImageService\\.property\\.test\\.ts$',
  '/src/services/changelog/__tests__/changelogImageService\\.test\\.ts$',
  '/src/services/financial/__tests__/financial-ledger\\.property\\.test\\.ts$',
  '/src/services/financial/__tests__/financialService\\.test\\.ts$',
  '/src/services/koth/__tests__/kothEligibility\\.property\\.test\\.ts$',
  '/src/services/koth/__tests__/kothLPBanding\\.property\\.test\\.ts$',
  '/src/services/koth/__tests__/kothPersistence\\.property\\.test\\.ts$',
  '/src/services/leaderboard/__tests__/leaderboard-cache\\.property\\.test\\.ts$',
  '/src/services/leaderboard/__tests__/leaderboardService\\.test\\.ts$',
  '/src/services/league/__tests__/leagueHistoryEnrichment\\.test\\.ts$',
  '/src/services/match/__tests__/matchHistoryService\\.test\\.ts$',
  '/src/services/matchmaking/__tests__/r47Fallback\\.property\\.test\\.ts$',
  '/src/services/matchmaking/__tests__/recentOpponentIsolation\\.property\\.test\\.ts$',
  '/src/services/matchmaking/__tests__/scheduledForDefault\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/adminUploadsHandler\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/adminUploadsHandler\\.test\\.ts$',
  '/src/services/moderation/__tests__/contentModerationService\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/fileStorageService\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/fileStorageService\\.test\\.ts$',
  '/src/services/moderation/__tests__/fileValidationService\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/fileValidationService\\.test\\.ts$',
  '/src/services/moderation/__tests__/imageProcessingService\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/imageProcessingService\\.test\\.ts$',
  '/src/services/moderation/__tests__/imageUploadHandlers\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/imageUploadHandlers\\.test\\.ts$',
  '/src/services/moderation/__tests__/orphanCleanupJob\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/orphanCleanupJob\\.test\\.ts$',
  '/src/services/moderation/__tests__/pendingUploadCache\\.property\\.test\\.ts$',
  '/src/services/moderation/__tests__/pendingUploadCache\\.test\\.ts$',
  '/src/services/monitoring/__tests__/dailyHealthReport\\.test\\.ts$',
  '/src/services/scheduling/__tests__/schedulingService\\.test\\.ts$',
  '/src/utils/__tests__/buildUserFilter\\.property\\.test\\.ts$',
  '/src/utils/__tests__/buildUserFilter\\.test\\.ts$',
  '/src/utils/__tests__/monitoringWebhook\\.test\\.ts$',
  '/src/utils/__tests__/startupSelfTest\\.test\\.ts$',
  '/src/utils/__tests__/systemHealth\\.test\\.ts$',
];

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    '/node_modules/',
    ...unitPatternsWithoutSrc,
    ...pureSrcTestPatterns,
    ...heavyTestPatterns,
  ],
  maxWorkers: 1,
  testTimeout: 60000,
};
