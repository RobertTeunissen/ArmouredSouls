// Unit tests only: pure functions, no database, no supertest
// Runs with full parallelism for speed
//
// Convention: any test file matching the patterns below is a unit test.
// Integration tests live in tests/integration/ or tests/services/ and
// require the full jest.config.integration.js (with DB setup).
const base = require('./jest.config');

module.exports = {
  ...base,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.ts'],
  testMatch: undefined,
  // Match unit tests by location and naming convention:
  // - tests/unit/**         → explicit unit test directory
  // - tests/arena/**        → pure spatial/math tests
  // - tests/config/**       → environment/config tests
  // - tests/errors/**       → error class tests
  // - tests/middleware/**   → middleware tests (mocked)
  // - tests/routes/**       → route validation tests (schema-only)
  // - tests/utils/**        → utility tests
  // - tests/factories/**    → factory tests
  // - tests/guide/**        → content validation
  // - *.property.test.ts    → property-based tests (pure, no DB)
  // - *.unit.test.ts        → explicitly named unit tests
  // Plus legacy flat-directory tests that are known pure (no DB).
  testRegex: [
    'tests/(unit|arena|config|errors|middleware|routes|utils|factories|guide)/.+\\.test\\.ts$',
    'tests/[^/]+\\.(property|unit)\\.test\\.ts$',
    'tests/(adminRouteValidation|analyticsRouteValidation|financesRouteValidation|leaderboardsRouteValidation|onboardingRouteValidation)\\.test\\.ts$',
    'tests/(combatMessageGenerator|compute-seedings\\.unit|damageDampeners|discounts|distributeTiers|economyCalculations|stableNameGenerator|weaponSelection)\\.test\\.ts$',
    'tests/(jwtService|passwordService|notifications|onboardingAnalyticsService|storageCalculations|weaponProperties|rangeBands|weaponEquipValidation|weapon-bonus-rebalance)\\.test\\.ts$',
    'tests/(adminServices|robotServices|paginationQuery|sharedFormulas|sharedRepairCostParity|cronValidation|AppError|domainErrors|env)\\.test\\.ts$',
    'tests/(manualRepairDiscount|repairCostMultiRobot|kothApi)\\.test\\.ts$',
    'tests/(fileValidationService|imageProcessingService|fileStorageService|pendingUploadCache|imageUploadHandlers|orphanCleanupJob|adminUploadsHandler|changelogImageService)\\.test\\.ts$',
    'tests/(generate-changelog-drafts|tuningPoolConfig|tuningPoolService|tuningCombatIntegration|tuningPracticeArena)\\.test\\.ts$',
    'tests/(leagueHistoryEnrichment|leagueHistoryPublic|bookingOfficeMigration|teamCoordinationEffects|rosterEligibilityFilter|teamBattleEngine)\\.test\\.ts$',
    'tests/(notification-service|teamTournamentBattleOrchestrator|schedulingService)\\.test\\.ts$',
    'tests/(arenaLayout|positionTracker|servoStrain|vector2d)\\.test\\.ts$',
    'tests/(eventRegistry|teamBattleRewardService|teamMatchmakingUtils|prestigeFeatures\\.integration|weaponRefinement)\\.test\\.ts$',
  ],
  maxWorkers: '75%',
  testTimeout: 30000,
};
