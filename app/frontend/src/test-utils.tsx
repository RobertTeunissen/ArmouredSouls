import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock AuthContext for tests
export const mockAuthContext = {
  user: { 
    id: 1, 
    username: 'testuser', 
    email: 'testuser@test.com',
    role: 'user',
    currency: 100000,
    prestige: 0,
  },
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
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { renderWithRouter as render };
