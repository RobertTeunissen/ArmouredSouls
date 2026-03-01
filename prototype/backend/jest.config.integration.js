// Integration tests: everything that needs a database or supertest
// Runs with limited parallelism to avoid DB conflicts
const base = require('./jest.config');

// Unit test files to exclude (must match full path segments)
const unitTestPatterns = [
  '/backup\\.property\\.test\\.ts$',
  '/combatMessageGenerator\\.test\\.ts$',
  '/cors\\.property\\.test\\.ts$',
  '/damageDampeners\\.test\\.ts$',
  '/economyCalculations\\.test\\.ts$',
  '/envConfig\\.property\\.test\\.ts$',
  '/jwtService\\.test\\.ts$',
  '/passwordHashing\\.property\\.test\\.ts$',
  '/passwordService\\.test\\.ts$',
  '/repairCostMultiRobot\\.test\\.ts$',
  '/storageCalculations\\.test\\.ts$',
  '/streamingStudioOperatingCost\\.property\\.test\\.ts$',
  '/streamingStudioUpgradeCosts\\.property\\.test\\.ts$',
  '/validation\\.property\\.test\\.ts$',
  '/validation\\.test\\.ts$',
];

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    '/node_modules/',
    ...unitTestPatterns,
  ],
  maxWorkers: 2,
  testTimeout: 60000,
};
