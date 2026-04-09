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
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  transform: baseTransform,
  testTimeout: 60000,
  maxWorkers: 2,
};
