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
  testTimeout: 60000,
};
