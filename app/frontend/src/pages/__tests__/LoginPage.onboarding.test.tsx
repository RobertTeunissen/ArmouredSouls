/**
 * Tests for login flow onboarding redirect integration.
 *
 * Validates that after successful login, the app checks onboarding status
 * and redirects new players to /onboarding instead of /dashboard.
 *
 * Covers FrontPage (tabbed login/register).
 *
 * Requirements: 1.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FrontPage from '../FrontPage';

// --- Mocks ---

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockRefreshUser = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}));

const mockGetTutorialState = vi.fn();
vi.mock('../../utils/onboardingApi', () => ({
  getTutorialState: (...args: unknown[]) => mockGetTutorialState(...args),
}));

// Mock apiClient for FrontPage's LoginForm (which calls POST /api/auth/login directly)
vi.mock('../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// ============================================================
// FrontPage (tabbed login) tests
// ============================================================
describe('FrontPage - Onboarding Redirect on Login', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockRefreshUser.mockResolvedValue(undefined);

    // FrontPage uses LoginForm which calls apiClient.post directly
    const apiClient = (await import('../../utils/apiClient')).default;
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        token: 'mock-jwt-token',
        user: { id: 1, username: 'testuser', email: 'test@test.com', role: 'player', currency: 3000000, prestige: 0 },
      },
    });
  });

  it('should redirect to /onboarding when new player logs in via FrontPage', async () => {
    mockGetTutorialState.mockResolvedValue({
      currentStep: 1,
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
      strategy: null,
      choices: {},
      startedAt: null,
      completedAt: null,
    });

    render(<FrontPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username or email/i), 'newplayer');
    await user.type(screen.getByLabelText(/password/i), 'pass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');
  });

  it('should redirect to /dashboard when veteran player logs in via FrontPage', async () => {
    mockGetTutorialState.mockResolvedValue({
      currentStep: 9,
      hasCompletedOnboarding: true,
      onboardingSkipped: false,
      strategy: '2_average',
      choices: {},
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T01:00:00Z',
    });

    render(<FrontPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username or email/i), 'veteran');
    await user.type(screen.getByLabelText(/password/i), 'pass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/onboarding');
  });

  it('should redirect to /dashboard when onboarding check fails on FrontPage', async () => {
    mockGetTutorialState.mockRejectedValue(new Error('Server error'));

    render(<FrontPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'pass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
