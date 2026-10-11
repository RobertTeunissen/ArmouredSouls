// Integration tests: everything that needs a real database or supertest.
// Runs single-worker to avoid DB conflicts.
//
// Spec #51: test selection comes from jest.tiers.js. A file is in this tier
// precisely when it appears in the DB_DEPENDENT list there.
//
// This config previously derived its exclusions from jest.config.unit.js's
// testRegex by string-filtering, plus two hand-maintained literal path lists.
// That arrangement produced four suites that ran in no tier and ten that ran in
// two — see the header of jest.tiers.js for the mechanism. Do not reintroduce
// testPathIgnorePatterns here.
const base = require('./jest.config');
const { testMatchFor } = require('./jest.tiers');

module.exports = {
  ...base,
  testRegex: undefined,
  testMatch: testMatchFor('integration'),
  maxWorkers: 1,
  // In-band runs keep every suite's module registry alive (~30 MB per suite);
  // at 141 suites the tier reached the 4 GB V8 heap limit and crashed with an
  // OOM after all suites had passed. A memory limit makes Jest use one worker
  // process (still serialized: maxWorkers stays 1) and recycle it between
  // files once its heap exceeds the limit.
  workerIdleMemoryLimit: '1GB',
  testTimeout: 60000,
};
