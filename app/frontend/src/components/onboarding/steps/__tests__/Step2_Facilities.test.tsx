/**
 * Tests for Step3_FacilityTiming — strategic facility investment
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    tutorialState: { currentStep: 3, strategy: '1_mighty', choices: {} },
    refreshState: vi.fn(),
  }),
}));

vi.mock('../../../../utils/apiClient', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
  },
}));

describe('Step3_FacilityTiming', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render investment heading', async () => {
    const Step3 = (await import('../Step2_Facilities')).default;
    render(<Step3 />);
    expect(screen.getByText('Where Do You Want to Invest?')).toBeInTheDocument();
  });

  it('should show strategy-specific recommendation note', async () => {
    const Step3 = (await import('../Step2_Facilities')).default;
    render(<Step3 />);
    expect(screen.getByText(/plenty of budget/i)).toBeInTheDocument();
  });

  it('should have Invest and Do Not Invest buttons', async () => {
    const Step3 = (await import('../Step2_Facilities')).default;
    render(<Step3 />);
    expect(screen.getByText('Invest')).toBeInTheDocument();
    expect(screen.getByText('Do Not Invest')).toBeInTheDocument();
  });

  it('should have Previous button that shows revert confirmation', async () => {
    const Step3 = (await import('../Step2_Facilities')).default;
    const user = userEvent.setup();
    render(<Step3 />);
    await user.click(screen.getByText('Previous'));
    expect(screen.getByText('Go Back to Strategy Selection?')).toBeInTheDocument();
  });

  it('should show repair bay option', async () => {
    const Step3 = (await import('../Step2_Facilities')).default;
    render(<Step3 />);
    expect(screen.getByText('I Want Less Repair Costs')).toBeInTheDocument();
  });
});
