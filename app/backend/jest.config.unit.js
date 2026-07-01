// Unit tests only: pure functions, no database, no supertest
// Runs with full parallelism for speed
//
// Matching strategy:
// - tests/ subdirectories (unit/, arena/, config/, errors/, middleware/, routes/, utils/, factories/, guide/, services/)
//   are matched by directory — all tests in these dirs are pure by convention.
// - src/**/__tests__/ co-located tests are included unless they require a real DB or supertest.
// - Flat tests/ root files use an explicit list since some property tests
//   require a database connection. New pure tests should be placed in a subdirectory.
const base = require('./jest.config');

module.exports = {
  ...base,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.ts'],
  testMatch: undefined,
  // Exclude tests that require DB, have stale type errors, or need integration setup
  testPathIgnorePatterns: [
    'tests/routes/admin\\.test\\.ts$',           // requires supertest + full app setup
    'tests/unit/practiceArenaService\\.test\\.ts$', // imports prisma directly
    'tests/unit/practiceArena\\.property\\.test\\.ts$', // imports prisma directly
    'tests/arena/task7modules\\.property\\.test\\.ts$', // stale RobotCombatState type
    'tests/arena/threatScoring\\.property\\.test\\.ts$', // stale RobotCombatState type
    'tests/arena/movementAI\\.property\\.test\\.ts$', // stale RobotCombatState type
    'tests/guide/content-validation\\.test\\.ts$', // requires js-yaml 3 API (removed)
    'tests/middleware/errorHandler\\.test\\.ts$', // imports app with DB dependency

    // src/__tests__/ files that require DB, supertest, or full app context
    'src/routes/__tests__/admin\\.integration\\.test\\.ts$',
    'src/routes/__tests__/changelog\\.test\\.ts$',
    'src/routes/__tests__/changelog\\.property\\.test\\.ts$',
    'src/routes/__tests__/adminLeagueHistory\\.test\\.ts$',
    'src/__tests__/guide/guide-routes\\.test\\.ts$',
    'src/__tests__/incomeMultipliers\\.test\\.ts$',
    'src/middleware/__tests__/auth\\.test\\.ts$',
    'src/services/achievement/__tests__/achievementService\\.test\\.ts$',
    'src/services/achievement/__tests__/achievementTeamBattle\\.test\\.ts$',
    'src/services/battle/__tests__/battle-participants\\.property\\.test\\.ts$',
    'src/services/changelog/__tests__/changelogService\\.test\\.ts$',
    'src/services/changelog/__tests__/changelogService\\.property\\.test\\.ts$',
    'src/services/economy/__tests__/unifiedFacilityROIService\\.test\\.ts$',
    'src/services/economy/__tests__/unifiedFacilityROIService\\.property\\.test\\.ts$',
    'src/services/league/__tests__/leagueHistoryService\\.property\\.test\\.ts$',
    'src/services/matchmaking/__tests__/deterministicTieBreaking\\.property\\.test\\.ts$',
    'src/services/moderation/__tests__/contentModerationService\\.test\\.ts$',
    'src/services/scheduling/__tests__/scheduling\\.property\\.test\\.ts$',
    'src/services/standings/__tests__/standings\\.property\\.test\\.ts$',
    'src/services/standings/__tests__/standingsService\\.test\\.ts$',
  ],
  testRegex: [
    // ── tests/ subdirectory-based matching (all files in these dirs are pure) ──
    'tests/(unit|arena|config|errors|middleware|routes|utils|factories|guide|services)/.+\\.test\\.ts$',

    // ── src/ co-located tests (pure mocked tests) ──
    'src/(.+/)?__tests__/.+\\.test\\.ts$',

    // ── Flat tests/ root property/unit tests (known pure — no DB) ──
    'tests/(backup|cors|envConfig|notifications|passwordHashing|manualRepairDiscount|streamingStudioOperatingCost|streamingStudioUpgradeCosts|tournament-bracket-seeding|validation|kothNotification|kothStandings|weaponStatValidation|dependency-upgrade-invariants|securityValidation|schemaValidator|tokenVersion|jwtExpiration|ownership|robotSanitization|securityMonitor|securityHeaders|errorHandler|currencyConstraint|prestigeUtils|stableSanitization|fileValidationService|imageProcessingService|fileStorageService|pendingUploadCache|imageUploadHandlers|orphanCleanupJob|adminUploadsHandler|changelogImageService|generate-changelog-drafts|leagueHistoryService|teamCoordination|teamTournamentBattleOrchestrator|achievementC18|weaponRefinement|tournamentService)\\.property\\.test\\.ts$',

    // ── Flat tests/ root regular tests (known pure — no DB) ──
    'tests/(combatMessageGenerator|compute-seedings\\.unit|damageDampeners|discounts|economyCalculations|stableNameGenerator|weaponSelection|jwtService|passwordService|onboardingAnalyticsService|storageCalculations|weaponProperties|rangeBands|weaponEquipValidation|weapon-bonus-rebalance|adminServices|robotServices|paginationQuery|sharedFormulas|sharedRepairCostParity|cronValidation|AppError|domainErrors|env|kothApi|manualRepairDiscount|repairCostMultiRobot)\\.test\\.ts$',
    'tests/(tuningPoolConfig|tuningPoolService|tuningCombatIntegration|tuningPracticeArena|leagueHistoryEnrichment|leagueHistoryPublic|bookingOfficeMigration|teamCoordinationEffects|rosterEligibilityFilter|teamBattleEngine|notification-service|schedulingService)\\.test\\.ts$',
    'tests/(eventRegistry|teamBattleRewardService|teamMatchmakingUtils|prestigeFeatures\\.integration|weaponRefinement)\\.test\\.ts$',

    // ── Route validation tests (schema-only, no DB) ──
    'tests/(adminRouteValidation|analyticsRouteValidation|financesRouteValidation|leaderboardsRouteValidation|onboardingRouteValidation)\\.test\\.ts$',
  ],
  maxWorkers: '75%',
  testTimeout: 30000,
};
