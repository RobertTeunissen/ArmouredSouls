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
  // Coverage thresholds — enforce 90% on services that already meet it,
  // set an achievable global floor to prevent regressions.
  coverageThreshold: {
    'src/services/auth/': { lines: 90 },
    'src/services/battle/combat-simulator/': { lines: 85 },
    'src/services/financial/': { lines: 95 },
    'src/services/scheduling/': { lines: 95 },
    'src/services/standings/': { lines: 95 },
    'src/services/leaderboard/': { lines: 90 },
    'src/services/team-battle/': { lines: 90 },
  },
};
