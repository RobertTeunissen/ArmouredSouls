// Unit tests only: pure functions, no database, no supertest
// Runs with full parallelism for speed
const base = require('./jest.config');

const unitTestFiles = [
  'backup\\.property\\.test\\.ts',
  'combatMessageGenerator\\.test\\.ts',
  'compute-seedings\\.unit\\.test\\.ts',
  'cors\\.property\\.test\\.ts',
  'damageDampeners\\.test\\.ts',
  'economyCalculations\\.test\\.ts',
  'envConfig\\.property\\.test\\.ts',
  'jwtService\\.test\\.ts',
  'notifications\\.property\\.test\\.ts',
  'onboardingAnalyticsService\\.test\\.ts',
  'passwordHashing\\.property\\.test\\.ts',
  'passwordService\\.test\\.ts',
  'recommendationEngine\\.test\\.ts',
  'manualRepairDiscount\\.property\\.test\\.ts',
  'manualRepairDiscount\\.test\\.ts',
  'repairCostMultiRobot\\.test\\.ts',
  'storageCalculations\\.test\\.ts',
  'streamingStudioOperatingCost\\.property\\.test\\.ts',
  'streamingStudioUpgradeCosts\\.property\\.test\\.ts',
  'tournament-bracket-seeding\\.property\\.test\\.ts',
  'validation\\.property\\.test\\.ts',
  'weapon-bonus-rebalance\\.test\\.ts',
];

module.exports = {
  ...base,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.unit.ts'],
  testMatch: undefined,
  testRegex: `(${unitTestFiles.join('|')})$`,
  maxWorkers: '75%',
  testTimeout: 30000,
};
