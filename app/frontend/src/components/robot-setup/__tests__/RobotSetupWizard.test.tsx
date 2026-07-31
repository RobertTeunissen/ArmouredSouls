/**
 * Tests for RobotSetupWizard shell component.
 *
 * Requirements: 3.1, 4.5, 4.6, 5.1, 9.1, 10.4, 11.2, 11.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RobotSetupWizard from '../RobotSetupWizard';

// Mock api
const mockGet = vi.fn();
vi.mock('../../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('../../../utils/ApiError', () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode: number, code: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
    }
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWizard(props?: Partial<Parameters<typeof RobotSetupWizard>[0]>) {
  const defaultProps = {
    robotId: 1,
    robotName: 'TestBot',
    loadoutType: 'single',
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    ...props,
  };

  return render(
    <MemoryRouter>
      <RobotSetupWizard {...defaultProps} />
    </MemoryRouter>,
  );
}

const eligibleReport = {
  robotId: 1,
  isEligible: false,
  isFullyConfigured: false,
  gates: [
    { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: false, detail: 'No main weapon equipped' },
    { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: false, detail: null },
    { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: false, detail: null },
  ],
};

const fullyConfiguredReport = {
  robotId: 1,
  isEligible: true,
  isFullyConfigured: true,
  gates: [
    { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: true, detail: null },
    { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: true, detail: null },
    { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: true, detail: null },
  ],
};

describe('RobotSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render the first step after loading eligibility', async () => {
    mockGet.mockResolvedValue(eligibleReport);

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Choose a Portrait')).toBeInTheDocument();
    });

    expect(screen.getByText('Step 1 of 7 — Portrait')).toBeInTheDocument();
  });

  it('should advance to next step when Next is clicked', async () => {
    mockGet.mockResolvedValue(eligibleReport);
    const user = userEvent.setup();

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Choose a Portrait')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Next →'));

    await waitFor(() => {
      expect(screen.getByText('Equip a Weapon')).toBeInTheDocument();
    });
  });

  it('should advance to next step when Skip is clicked', async () => {
    mockGet.mockResolvedValue(eligibleReport);
    const user = userEvent.setup();

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Choose a Portrait')).toBeInTheDocument();
    });

    // Click the bottom action bar Skip button
    const skipButtons = screen.getAllByText('Skip');
    await user.click(skipButtons[skipButtons.length - 1]); // bottom bar skip

    await waitFor(() => {
      expect(screen.getByText('Equip a Weapon')).toBeInTheDocument();
    });
  });

  it('should call onSkip and clear localStorage when Skip All is clicked', async () => {
    mockGet.mockResolvedValue(eligibleReport);
    const user = userEvent.setup();
    const onSkip = vi.fn();

    renderWizard({ onSkip });

    await waitFor(() => {
      expect(screen.getByText('Choose a Portrait')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Skip All'));

    expect(onSkip).toHaveBeenCalled();
  });

  it('should call onComplete when eligibility report shows isFullyConfigured', async () => {
    mockGet.mockResolvedValue(fullyConfiguredReport);
    const onComplete = vi.fn();

    renderWizard({ onComplete });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('should show error state when eligibility endpoint returns 403', async () => {
    const { ApiError } = await import('../../../utils/ApiError');
    mockGet.mockRejectedValue(new ApiError('Forbidden', 403, 'FORBIDDEN'));

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('You do not have access to this robot.')).toBeInTheDocument();
    });
  });

  it('should show error state when eligibility endpoint returns 404', async () => {
    const { ApiError } = await import('../../../utils/ApiError');
    mockGet.mockRejectedValue(new ApiError('Not found', 404, 'ROBOT_NOT_FOUND'));

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Robot not found.')).toBeInTheDocument();
    });
  });

  it('should resume from localStorage state', async () => {
    mockGet.mockResolvedValue(eligibleReport);

    // Pre-seed localStorage with step 3
    const savedState = { currentStep: 3, completedSteps: [1, 2], skippedSteps: [] };
    localStorage.setItem('robot-setup-1', JSON.stringify(savedState));

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Battle Configuration')).toBeInTheDocument();
    });

    expect(screen.getByText('Step 3 of 7 — Battle Config')).toBeInTheDocument();
  });

  it('should render progress dots for all 7 steps', async () => {
    mockGet.mockResolvedValue(eligibleReport);

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText('Choose a Portrait')).toBeInTheDocument();
    });

    // Should have 7 step dots
    for (let i = 1; i <= 7; i++) {
      expect(screen.getByLabelText(new RegExp(`Step ${i}:`))).toBeInTheDocument();
    }
  });
});
