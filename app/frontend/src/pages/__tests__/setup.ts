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
   
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: localStorageMock,
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  resetApiMocks();
  vi.clearAllMocks();
});
