import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetApiMocks, mockGlobalFetch, setupDefaultApiMocks } from './apiMocks';

// Setup before each test
beforeEach(() => {
  // Setup API mocks
  setupDefaultApiMocks();
  mockGlobalFetch();
  
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn((key: string) => {
      if (key === 'token') return 'mock-token';
      return null;
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.localStorage = localStorageMock as unknown as Storage;
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  resetApiMocks();
  vi.clearAllMocks();
});
