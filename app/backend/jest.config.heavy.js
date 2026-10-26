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
  // Same reason as jest.config.integration.js: in-band runs keep every suite's
  // module registry alive. After automatonMultiSeason (205 Automatons, a season
  // of bulk battles) the process held ~2.4 GB and the next suites slowed from
  // seconds to many minutes (multiMatchScheduling: 7 s alone, 958 s after it)
  // until they hit the test timeout. A memory limit makes Jest use one worker
  // process (still serialized) and recycle it between files.
  workerIdleMemoryLimit: '1GB',
  testTimeout: 120000,
};
