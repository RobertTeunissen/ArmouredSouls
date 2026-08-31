// Heavy integration tests: full cycle execution, bulk operations.
// These hit the real database with full game cycles and run in their own job.
// Run with: pnpm run test:heavy
//
// Spec #51: test selection comes from jest.tiers.js (the HEAVY_TESTS list).
// Until Spec #51 this tier ran in NO pipeline — `test:heavy` appeared in
// package.json and in neither workflow — so suites collected only here had never
// executed in CI. `tests/integration/tagTeamByeHandling.test.ts` carried an
// assertion that could never pass and nothing caught it.
const base = require('./jest.config');
const { testMatchFor } = require('./jest.tiers');

module.exports = {
  ...base,
  testRegex: undefined,
  testMatch: testMatchFor('heavy'),
  maxWorkers: 1,
  testTimeout: 120000,
};
