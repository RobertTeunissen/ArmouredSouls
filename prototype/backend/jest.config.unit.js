// Unit tests only: pure functions, no database, no supertest
// Runs with full parallelism for speed
const base = require('./jest.config');

const unitTestFiles = [
  'backup\\.property\\.test\\.ts',
  'combatMessageGenerator\\.test\\.ts',
  'cors\\.property\\.test\\.ts',
  'damageDampeners\\.test\\.ts',
  'economyCalculations\\.test\\.ts',
  'envConfig\\.property\\.test\\.ts',
  'jwtService\\.test\\.ts',
  'passwordHashing\\.property\\.test\\.ts',
  'passwordService\\.test\\.ts',
  'repairCostMultiRobot\\.test\\.ts',
  'storageCalculations\\.test\\.ts',
  'streamingStudioOperatingCost\\.property\\.test\\.ts',
  'streamingStudioUpgradeCosts\\.property\\.test\\.ts',
  'validation\\.property\\.test\\.ts',
];

module.exports = {
  ...base,
  testMatch: undefined,
  testRegex: `(${unitTestFiles.join('|')})$`,
  maxWorkers: '75%',
  testTimeout: 30000,
};
