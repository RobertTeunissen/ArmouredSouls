/**
 * Tests for Step9_Completion — congratulations and complete tutorial
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockCompleteTutorial = vi.fn().mockResolvedValue(undefined);
const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    tutorialState: { currentStep: 9, strategy: '1_mighty', choices: { robotsCreated: [1] } },
    completeTutorial: mockCompleteTutorial,
    error: null,
  }),
}));

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}));

// Mock the API — return robots and profile so the subscription picker renders,
// then the picker's own hooks are mocked to skip straight to done phase
vi.mock('../../../../utils/api', () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error('skip')),
    post: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Step9_Completion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render congratulations heading after subscription phase', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    // API mock rejects → component skips to 'done' phase
    await waitFor(() => {
      expect(screen.getByText('Congratulations, Commander!')).toBeInTheDocument();
    });
  });

  it('should render complete tutorial button', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Complete Tutorial & Start Playing')).toBeInTheDocument();
    });
  });

  it('should show account reset reminder', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/reset your account/i)).toBeInTheDocument();
    });
  });

  it('should call completeTutorial and refreshUser on button click', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    const user = userEvent.setup();
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Complete Tutorial & Start Playing')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Complete Tutorial & Start Playing'));
    expect(mockCompleteTutorial).toHaveBeenCalled();
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('should show trophy emoji', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('🏆')).toBeInTheDocument();
    });
  });
});
