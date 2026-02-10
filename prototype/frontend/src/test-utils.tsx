import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock AuthContext for tests
export const mockAuthContext = {
  user: { id: 1, username: 'testuser', currency: 100000 },
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
};

// Custom render function that includes providers
export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => <BrowserRouter>{children}</BrowserRouter>,
    ...options,
  });
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { renderWithRouter as render };
