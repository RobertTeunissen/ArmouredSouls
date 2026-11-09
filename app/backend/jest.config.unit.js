// Unit tests: pure functions with mocked dependencies. No database, no supertest.
// Runs with full parallelism for speed.
//
// Spec #51: test selection comes from jest.tiers.js, the single source of truth
// for Test_Tier membership. This config no longer carries a testRegex or a
// testPathIgnorePatterns list — a file is in this tier precisely when
// jest.tiers.js classifies it as 'unit', which it does for anything not listed
// in HEAVY_TESTS or DB_DEPENDENT.
//
// Do not add testPathIgnorePatterns here. Excluding a file here without adding
// it to DB_DEPENDENT is exactly how four suites ended up running in no tier at
// all. `pnpm run test:tiers:verify` will fail the build if that happens.
const base = require('./jest.config');
const { testMatchFor } = require('./jest.tiers');

module.exports = {
  ...base,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.ts'],
  testRegex: undefined,
  testMatch: testMatchFor('unit'),
  maxWorkers: '75%',
  testTimeout: 30000,
  // Coverage floors, enforced in CI by `pnpm run test:unit:coverage`. Until
  // Nov 2026 CI ran the unit tier without --coverage, so none of these were
  // checked. Measured 9 Nov 2026 (unit tier only, test files excluded). Jest
  // computes `global` over the files no directory entry below matches: there it
  // was statements 59.9%, branches 48.7%, functions 53.9%, lines 60.8%. The
  // directories: auth 95.9%, combat-simulator 90.9%, financial 79.8%,
  // scheduling 61.6%, standings 97.6%, leaderboard 98.4%, team-battle 95.9%.
  //
  // financial/ and scheduling/ were set to 95% when they held only pure code.
  // They now also hold database-backed services (thinInstanceByes,
  // financeReportQueryService, economicRequestReplayService) that the
  // integration tier covers, so their floors sit at the measured unit-tier
  // value. Raise a floor when unit coverage grows; never lower one silently.
  coverageThreshold: {
    global: { statements: 58, branches: 47, functions: 52, lines: 59 },
    'src/services/auth/': { lines: 90 },
    'src/services/battle/combat-simulator/': { lines: 85 },
    'src/services/financial/': { lines: 79 },
    'src/services/scheduling/': { lines: 60 },
    'src/services/standings/': { lines: 95 },
    'src/services/leaderboard/': { lines: 90 },
    'src/services/team-battle/': { lines: 90 },
  },
};
