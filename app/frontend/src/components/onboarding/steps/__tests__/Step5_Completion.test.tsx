/**
 * Tests for Step9_Completion — congratulations and complete tutorial
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockCompleteTutorial = vi.fn().mockResolvedValue(undefined);
const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    completeTutorial: mockCompleteTutorial,
    error: null,
  }),
}));

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
  }),
}));

describe('Step9_Completion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render congratulations heading', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Congratulations, Commander!')).toBeInTheDocument();
  });

  it('should render complete tutorial button', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Complete Tutorial & Start Playing')).toBeInTheDocument();
  });

  it('should show account reset reminder', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/reset your account/i)).toBeInTheDocument();
    expect(screen.getByText(/profile page/i)).toBeInTheDocument();
  });

  it('should call completeTutorial and refreshUser on button click', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    const user = userEvent.setup();
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByText('Complete Tutorial & Start Playing'));
    expect(mockCompleteTutorial).toHaveBeenCalled();
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('should show trophy emoji', async () => {
    const Step9 = (await import('../Step5_Completion')).default;
    render(<MemoryRouter><Step9 onNext={vi.fn()} onPrevious={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });
});
