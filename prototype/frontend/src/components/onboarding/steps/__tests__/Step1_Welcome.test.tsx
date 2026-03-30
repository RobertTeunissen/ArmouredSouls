/**
 * Tests for Step1_Welcome — merged welcome + strategy + robot creation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock dependencies
vi.mock('../../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    tutorialState: { currentStep: 1, strategy: null, choices: {} },
    updateStrategy: vi.fn(),
    setStep: vi.fn(),
    updateChoices: vi.fn(),
    refreshState: vi.fn(),
  }),
}));

vi.mock('../../../../utils/onboardingAnalytics', () => ({
  trackStrategySelected: vi.fn(),
}));

vi.mock('../../../../utils/apiClient', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { robot: { id: 1 }, weaponInventory: { id: 1 }, success: true, data: {} } }),
  },
}));

vi.mock('../../../RosterStrategyCard', () => ({
  default: ({ strategy, selected, onSelect }: { strategy: string; selected: boolean; onSelect: (s: string) => void }) => (
    <button data-testid={`strategy-${strategy}`} data-selected={selected} onClick={() => onSelect(strategy)}>
      {strategy}
    </button>
  ),
}));

vi.mock('../../../RobotNamingModal', () => ({
  default: ({ robotCount, onConfirm, onCancel }: { robotCount: number; onConfirm: (names: string[]) => void; onCancel: () => void }) => (
    <div data-testid="naming-modal">
      <span>Name {robotCount} robot(s)</span>
      <button onClick={() => onConfirm(Array(robotCount).fill('TestBot'))}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('Step1_Welcome', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render welcome heading', async () => {
    const Step1 = (await import('../Step1_Welcome')).default;
    render(<Step1 onNext={vi.fn()} />);
    expect(screen.getByText('Welcome to Armoured Souls, Commander')).toBeInTheDocument();
  });

  it('should render three strategy cards', async () => {
    const Step1 = (await import('../Step1_Welcome')).default;
    render(<Step1 onNext={vi.fn()} />);
    expect(screen.getByTestId('strategy-1_mighty')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-2_average')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-3_flimsy')).toBeInTheDocument();
  });

  it('should show "Create My Robot" button after selecting a strategy', async () => {
    const Step1 = (await import('../Step1_Welcome')).default;
    const user = userEvent.setup();
    render(<Step1 onNext={vi.fn()} />);
    await user.click(screen.getByTestId('strategy-1_mighty'));
    expect(screen.getByText('Create My Robot')).toBeInTheDocument();
  });

  it('should show "Create My Robots" for multi-robot strategies', async () => {
    const Step1 = (await import('../Step1_Welcome')).default;
    const user = userEvent.setup();
    render(<Step1 onNext={vi.fn()} />);
    await user.click(screen.getByTestId('strategy-2_average'));
    expect(screen.getByText('Create My Robots')).toBeInTheDocument();
  });

  it('should open naming modal when create button is clicked', async () => {
    const Step1 = (await import('../Step1_Welcome')).default;
    const user = userEvent.setup();
    render(<Step1 onNext={vi.fn()} />);
    await user.click(screen.getByTestId('strategy-1_mighty'));
    await user.click(screen.getByText('Create My Robot'));
    await waitFor(() => {
      expect(screen.getByTestId('naming-modal')).toBeInTheDocument();
    });
  });
});
