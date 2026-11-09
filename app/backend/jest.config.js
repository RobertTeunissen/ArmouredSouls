// Shared base config
const baseTransform = {
  '^.+\\.tsx?$': ['ts-jest', {
    tsconfig: {
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  }],
};

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // Test files are not product code: counting them inflated the executed
    // ones to 100% and the other tiers' files (never run here) to 0%.
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
  ],
  transform: baseTransform,
  testTimeout: 60000,
  maxWorkers: 2,
};
