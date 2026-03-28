/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for CreateRobotPage onboarding integration
 *
 * Test coverage:
 * - Onboarding mode detection via URL param
 * - Onboarding banner display
 * - Navigation back to onboarding after robot creation
 * - Cancel button navigates to onboarding in onboarding mode
 * - Normal mode behavior preserved
 *
 * Requirements: 9.1-9.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CreateRobotPage from '../CreateRobotPage';
import { AuthProvider } from '../../contexts/AuthContext';
import apiClient from '../../utils/apiClient';

// Mock apiClient
vi.mock('../../utils/apiClient');

// Mock react-router-dom navigate and searchParams
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <nav data-testid="navigation">Navigation</nav>,
}));

describe('CreateRobotPage - Onboarding Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();

    // Mock localStorage to return a token so AuthProvider loads user
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === 'token') return 'mock-jwt-token';
      return null;
    });

    // Mock auth profile
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/user/profile') {
        return Promise.resolve({
          data: {
            id: 1,
            username: 'testuser',
            email: 'test@test.com',
            role: 'player',
            currency: 3000000,
            prestige: 0,
          },
        });
      }
      if (url === '/api/onboarding/state') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              currentStep: 5,
              hasCompletedOnboarding: false,
              onboardingSkipped: false,
              strategy: '1_mighty',
              choices: {},
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
  });

  const renderInOnboardingMode = () => {
    mockSearchParams = new URLSearchParams('onboarding=true');
    return render(
      <MemoryRouter initialEntries={['/robots/create?onboarding=true']}>
        <AuthProvider>
          <CreateRobotPage />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  const renderInNormalMode = () => {
    mockSearchParams = new URLSearchParams();
    return render(
      <MemoryRouter initialEntries={['/robots/create']}>
        <AuthProvider>
          <CreateRobotPage />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  describe('Onboarding Mode Detection', () => {
    it('should show onboarding banner when onboarding=true param is present', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText('Tutorial Step 5: Robot Creation')).toBeInTheDocument();
      });
    });

    it('should not show onboarding banner in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByText('Create New Robot')).toBeInTheDocument();
      });
      expect(screen.queryByText('Tutorial Step 5: Robot Creation')).not.toBeInTheDocument();
    });
  });

  describe('Navigation After Robot Creation', () => {
    it('should navigate to /onboarding after robot creation in onboarding mode', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { robot: { id: 42, name: 'TestBot' } },
      });

      renderInOnboardingMode();

      // Wait for user data to load and button to become enabled
      await waitFor(() => {
        const submitBtn = screen.getByRole('button', { name: /Create Robot/i });
        expect(submitBtn).not.toBeDisabled();
      });

      await user.type(screen.getByLabelText('Robot Name'), 'TestBot');
      await user.click(screen.getByRole('button', { name: /Create Robot/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      });
    });

    it('should navigate to robot detail page after creation in normal mode', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { robot: { id: 42, name: 'TestBot' } },
      });

      renderInNormalMode();

      // Wait for user data to load and button to become enabled
      await waitFor(() => {
        const submitBtn = screen.getByRole('button', { name: /Create Robot/i });
        expect(submitBtn).not.toBeDisabled();
      });

      await user.type(screen.getByLabelText('Robot Name'), 'TestBot');
      await user.click(screen.getByRole('button', { name: /Create Robot/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/robots/42');
      });
    });

    it('should update onboarding choices after robot creation in onboarding mode', async () => {
      const user = userEvent.setup();

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { robot: { id: 42, name: 'TestBot' } },
      });

      renderInOnboardingMode();

      // Wait for user data to load and button to become enabled
      await waitFor(() => {
        const submitBtn = screen.getByRole('button', { name: /Create Robot/i });
        expect(submitBtn).not.toBeDisabled();
      });

      await user.type(screen.getByLabelText('Robot Name'), 'TestBot');
      await user.click(screen.getByRole('button', { name: /Create Robot/i }));

      await waitFor(() => {
        // Should have called POST to create robot and POST to update onboarding state
        const postCalls = vi.mocked(apiClient.post).mock.calls;
        expect(postCalls.some(call => call[0] === '/api/robots')).toBe(true);
        expect(postCalls.some(call => call[0] === '/api/onboarding/state')).toBe(true);
      });
    });
  });

  describe('Cancel Button', () => {
    it('should show "Back to Tutorial" in onboarding mode', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Back to Tutorial/i })).toBeInTheDocument();
      });
    });

    it('should show "Cancel" in normal mode', async () => {
      renderInNormalMode();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });
    });

    it('should navigate to /onboarding when Cancel clicked in onboarding mode', async () => {
      const user = userEvent.setup();
      renderInOnboardingMode();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Back to Tutorial/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Back to Tutorial/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });

    it('should navigate to /robots when Cancel clicked in normal mode', async () => {
      const user = userEvent.setup();
      renderInNormalMode();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/robots');
    });
  });

  describe('Onboarding Banner Content', () => {
    it('should display tutorial guidance text', async () => {
      renderInOnboardingMode();
      await waitFor(() => {
        expect(screen.getByText(/Choose a name for your robot and confirm the purchase/)).toBeInTheDocument();
      });
    });
  });
});
