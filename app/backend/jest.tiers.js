// Spec #51 — single source of truth for Test_Tier membership.
//
// WHY THIS FILE EXISTS
// --------------------
// Tier membership used to be spread across three configs that disagreed with
// each other. `jest.config.integration.js` derived its exclusions from the unit
// config's `testRegex` by string-filtering, then layered two hand-maintained
// literal path lists on top. Both drifted, in opposite directions:
//
//   * The derived filter kept the whole `tests/{unit,middleware,routes,...}/`
//     directory pattern as an integration exclusion. So any file the unit tier
//     deliberately dropped for needing a database was dropped by BOTH tiers and
//     ran nowhere. Four files were in that state: errorHandler, routes/admin and
//     the two practiceArena suites. `tests/middleware/errorHandler.test.ts` is
//     the test for the middleware that shapes every `{ error, code, details }`
//     response body, and it had not run in any pipeline.
//
//   * `pureSrcTestPatterns` was ~50 literal paths that had to be edited whenever
//     a `src/**/__tests__/` test was added. Ten newer files were never added, so
//     they ran twice — once in unit, once in integration.
//
// Both failure modes were silent. Nothing checked the partition.
//
// HOW THIS FIXES IT
// -----------------
// Classification, not exclusion. Every test file is classified into exactly one
// tier by an ordered rule set — first match wins, so the tiers are mutually
// exclusive by construction rather than by maintenance:
//
//   1. HEAVY_TESTS   — full-cycle and bulk-DB suites
//   2. DB_DEPENDENT  — needs a real database or supertest
//   3. otherwise     — unit tier
//
// A new test therefore defaults to the unit tier. If it needs a database it
// fails immediately and loudly, which is the right failure direction: the old
// design failed silently in both directions. Add it to DB_DEPENDENT when that
// happens.
//
// WHAT MAKES A SUITE DB_DEPENDENT
// -------------------------------
// Exactly one thing: it uses the real `src/lib/prisma` singleton. A suite that
// calls `jest.mock('.../lib/prisma')` does not, whatever else it does — driving
// the app through supertest against a mocked client needs no database.
//
// This is a hard rule, not a guideline, because the integration tier's setup file
// is not inert. `tests/setup.ts` seeds weapons in a global `beforeAll` by calling
// `prisma.weapon.count()` on that singleton. Under a mock, `prisma.weapon` is
// `undefined`, so every test in the file dies in `beforeAll` with
// `Cannot read properties of undefined (reading 'count')` — a failure that names
// neither the suite's subject nor the real cause.
//
// Twenty-four suites were misclassified this way. Eleven failed outright and had
// done so for months; the other thirteen passed only because their mock happened
// to define the one property the setup file touches, which is a coincidence and
// not a contract. `scripts/verifyTiers.ts` now enforces the rule so the
// coincidence cannot be relied on again.
//
// `pnpm run test:tiers:verify` guards against anyone reintroducing bespoke
// `testPathIgnorePatterns` and re-splitting the source of truth.

const fs = require('fs');
const path = require('path');

/**
 * Suites that hit the real database with full game cycles or bulk operations.
 * Slow enough to warrant their own pipeline job.
 */
const HEAVY_TESTS = [
  'tests/battleOrchestrator.test.ts',
  'tests/cycleSnapshot.property.test.ts',
  'tests/facilityRecommendation.property.test.ts',
  'tests/integration.test.ts',
  'tests/integration/adminCycleGeneration.test.ts',
  'tests/integration/bronzeLeagueRebalancing.test.ts',
  'tests/integration/byeInvariant.test.ts',
  'tests/integration/byeScopeAndShape.test.ts',
  'tests/integration/seasonPurgeAndReset.test.ts',
  'tests/integration/seasonRollover.test.ts',
  'tests/integration/tagTeamAutoRepair.test.ts',
  'tests/integration/tagTeamByeHandling.test.ts',
  'tests/integration/tagTeamCompleteCycle.test.ts',
  'tests/integration/tagTeamLeagueRebalancing.test.ts',
  'tests/integration/tagTeamMultiMatchCycle.test.ts',
  'tests/integration/teamBattleCompleteCycle.test.ts',
  'tests/integration/teamBattleRaceCondition.test.ts',
  'tests/integration/tuningAllocationApi.test.ts',
  'tests/leagueInstanceService.test.ts',
  'tests/multiMatchScheduling.property.test.ts',
  'tests/repairCostMultiRobot.property.test.ts',
  'tests/streamingRevenueFormula.property.test.ts',
  'tests/tagTeamBattleOrchestrator.property.test.ts',
];

/**
 * Suites that use the real `src/lib/prisma` singleton and therefore need a
 * database. Everything not listed here and not in HEAVY_TESTS runs in the unit
 * tier.
 *
 * A suite that mocks `lib/prisma` must NOT appear here — see the header. That is
 * checked by `pnpm run test:tiers:verify`.
 */
const DB_DEPENDENT = [
  'tests/auditSequenceConcurrency.test.ts',
  'src/__tests__/guide/guide-routes.test.ts',
  'src/__tests__/incomeMultipliers.test.ts',
  'src/services/economy/__tests__/unifiedFacilityROI.bugcondition.property.test.ts',
  'src/services/economy/__tests__/unifiedFacilityROI.integration.test.ts',
  'src/services/economy/__tests__/unifiedFacilityROI.preservation.property.test.ts',
  'src/services/matchmaking/__tests__/deterministicTieBreaking.property.test.ts',
  'src/services/moderation/__tests__/contentModerationService.test.ts',
  'tests/adminRepairAuditLog.test.ts',
  'tests/adminRobotStats.test.ts',
  'tests/analyticsApi.test.ts',
  'tests/arenaLayout.test.ts',
  'tests/auth.test.ts',
  'tests/authOnboarding.test.ts',
  'tests/authenticationEquivalence.property.test.ts',
  'tests/battleEventLogging.test.ts',
  'tests/battleLogStreamingRevenue.property.test.ts',
  'tests/byeTeamBattles.property.test.ts',
  'tests/combatMessageGenerator.spatial.test.ts',
  'tests/combatSimulator.refinement.test.ts',
  'tests/combatSimulator.spatial.test.ts',
  'tests/creditChangeAuditTrail.property.test.ts',
  'tests/cycleCsvStreamingRevenue.property.test.ts',
  'tests/cycleExecutionTiming.test.ts',
  'tests/cyclePerformanceMonitoring.test.ts',
  'tests/cycleSnapshotService.test.ts',
  'tests/cycleStepDuration.property.test.ts',
  'tests/cycleSummaryStreamingRevenue.property.test.ts',
  'tests/dataIntegrityService.test.ts',
  'tests/databaseErrorHandling.property.test.ts',
  'tests/defaultAccountValues.property.test.ts',
  'tests/dualLoginSupport.property.test.ts',
  'tests/duplicateEmail.property.test.ts',
  'tests/duplicateUsername.property.test.ts',
  'tests/eloProgression.property.test.ts',
  'tests/enhancedLogin.integration.test.ts',
  'tests/eventLogger.integration.test.ts',
  'tests/eventLogger.property.test.ts',
  'tests/eventLogger.test.ts',
  'tests/eventQueryability.property.test.ts',
  'tests/facility.test.ts',
  'tests/facilityAdvisorStreamingStudio.test.ts',
  'tests/facilityAdvisorStreamingStudioROI.property.test.ts',
  'tests/facilityRecommendationService.test.ts',
  'tests/facilityTransactionLogging.test.ts',
  'tests/finances.test.ts',
  'tests/financialReportStreamingRevenue.test.ts',
  'tests/health.property.test.ts',
  'tests/hpTracking.pbt.test.ts',
  'tests/incomeGeneratorNoStreaming.property.test.ts',
  'tests/invalidLoginCredentials.property.test.ts',
  'tests/kothEngine.property.test.ts',
  'tests/kothEngine.test.ts',
  'tests/leaderboards.test.ts',
  'tests/leagueRebalancingService.test.ts',
  'tests/leagues.test.ts',
  'tests/logging.property.test.ts',
  'tests/loginResponseFormat.property.test.ts',
  'tests/matchListInclusion.property.test.ts',
  'tests/matches.test.ts',
  'tests/matchmakingService.test.ts',
  'tests/metricProgression.property.test.ts',
  'tests/middleware/errorHandler.test.ts',
  'tests/onboardingAnalyticsRoutes.test.ts',
  'tests/onboardingApi.test.ts',
  'tests/onboardingService.test.ts',
  'tests/performanceDegradation.property.test.ts',
  'tests/positionTracker.test.ts',
  'tests/prestigeGates.test.ts',
  'tests/profileApiResponse.property.test.ts',
  'tests/profileUpdate.property.test.ts',
  'tests/profileUpdate.test.ts',
  'tests/project-quality-audit.pbt.test.ts',
  'tests/project-quality-preservation.pbt.test.ts',
  'tests/queryService.test.ts',
  'tests/rateLimiter.property.test.ts',
  'tests/rateLimiting.integration.test.ts',
  'tests/rateLimiting.property.test.ts',
  'tests/records.test.ts',
  'tests/registrationEndpoint.integration.test.ts',
  'tests/registrationErrorHandling.test.ts',
  'tests/registrationResponseFormat.property.test.ts',
  'tests/resetService.test.ts',
  'tests/responseFormatConsistency.property.test.ts',
  'tests/robotCalculations.test.ts',
  'tests/robotNameUniqueness.test.ts',
  'tests/robotPerformanceService.test.ts',
  'tests/seed.property.test.ts',
  'tests/servoStrain.test.ts',
  'tests/stables.test.ts',
  'tests/stanceAndYield.test.ts',
  'tests/stanceAndYieldAPI.test.ts',
  'tests/statsUpdatedBeforeStreamingRevenue.property.test.ts',
  'tests/streamingStudioPrestigeRequirements.property.test.ts',
  'tests/streamingStudioPrestigeValidation.test.ts',
  'tests/tagTeamBattleLogCompleteness.property.test.ts',
  'tests/tagTeamTagOut.test.ts',
  'tests/teamBattle.property.test.ts',
  'tests/teamBattleEngine.property.test.ts',
  'tests/terminalLogStreamingRevenue.property.test.ts',
  'tests/trainingAcademyCaps.test.ts',
  'tests/unexpectedErrorHandling.property.test.ts',
  'tests/userGeneration.test.ts',
  'tests/userService.test.ts',
  'tests/userStableStats.test.ts',
  'tests/validRegistration.property.test.ts',
  'tests/validation.test.ts',
  'tests/validationErrorSpecificity.property.test.ts',
  'tests/vector2d.test.ts',
  'tests/weaponInventory.test.ts',
  'tests/weaponRangeBand.property.test.ts',
  'tests/weaponValidation.test.ts',
  'tests/weapons.test.ts',
];

const HEAVY_SET = new Set(HEAVY_TESTS);
const DB_SET = new Set(DB_DEPENDENT);

/** Recursively collect every `*.test.ts` under a root, as repo-relative paths. */
function collect(root) {
  const abs = path.join(__dirname, root);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.test.ts')) continue;
    const full = path.join(entry.parentPath || entry.path, entry.name);
    out.push(path.relative(__dirname, full));
  }
  return out;
}

/** Every test file Jest could collect, from either root. */
function allTestFiles() {
  return [...collect('tests'), ...collect('src')].sort();
}

/**
 * Classify one file. Ordered — first match wins, which is what makes the tiers
 * disjoint. Returns 'heavy' | 'integration' | 'unit'.
 */
function classify(relPath) {
  if (HEAVY_SET.has(relPath)) return 'heavy';
  if (DB_SET.has(relPath)) return 'integration';
  return 'unit';
}

/** The three tier membership lists, computed from the filesystem. */
function tiers() {
  const result = { unit: [], integration: [], heavy: [] };
  for (const f of allTestFiles()) result[classify(f)].push(f);
  return result;
}

/**
 * Jest `testMatch` entries for a tier. Exact relative paths are valid globs, so
 * this pins each tier to precisely its members and nothing else.
 */
function testMatchFor(tier) {
  return tiers()[tier].map((f) => `<rootDir>/${f}`);
}

module.exports = { HEAVY_TESTS, DB_DEPENDENT, allTestFiles, classify, tiers, testMatchFor };
