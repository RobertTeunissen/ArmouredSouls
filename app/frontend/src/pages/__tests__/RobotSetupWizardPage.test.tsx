import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RobotSetupWizardPage from '../RobotSetupWizardPage';
import { ApiError } from '../../utils/ApiError';

const mocks = vi.hoisted(() => ({ fetchMyRobots: vi.fn(), fetchSchedulingEligibility: vi.fn() }));
vi.mock('../../utils/robotApi', () => mocks);
vi.mock('../../components/robot-setup/RobotSetupWizard', () => ({
  default: ({ robotName, steps }: { robotName: string; steps: string[] }) => <div data-testid="wizard">{robotName}: {steps.join(',')}</div>,
}));

function report(weapon: boolean, events: boolean) {
  return {
    robotId: 5,
    isEligible: weapon && events,
    isFullyConfigured: false,
    gates: [
      { id: 'weapon_equipped', label: 'Equip a weapon', severity: 'hard', met: weapon, detail: null },
      { id: 'event_subscribed', label: 'Enter at least one battle event', severity: 'hard', met: events, detail: null },
      { id: 'tuning_allocated', label: 'Allocate your tuning points', severity: 'soft', met: false, detail: null },
    ],
  };
}

function renderAt(path = '/robots/5/setup') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/robots/:id/setup" element={<RobotSetupWizardPage />} />
        <Route path="/robots/:id/prepare" element={<div data-testid="workshop" />} />
        <Route path="/robots" element={<div data-testid="robots" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMyRobots.mockResolvedValue([{ id: 5, name: 'Bolt', loadoutType: 'single', imageUrl: null }]);
});

describe('RobotSetupWizardPage', () => {
  it('plans the steps a new robot needs', async () => {
    mocks.fetchSchedulingEligibility.mockResolvedValue(report(false, false));
    renderAt();
    expect(await screen.findByTestId('wizard')).toHaveTextContent('Bolt: portrait,weapon,events');
  });

  it('goes straight to the Workshop when the robot is already battle-ready', async () => {
    mocks.fetchSchedulingEligibility.mockResolvedValue(report(true, true));
    renderAt();
    expect(await screen.findByTestId('workshop')).toBeInTheDocument();
  });

  it('sends a robot outside the roster back to the robots list', async () => {
    mocks.fetchSchedulingEligibility.mockResolvedValue(report(false, false));
    mocks.fetchMyRobots.mockResolvedValue([]);
    renderAt();
    expect(await screen.findByTestId('robots')).toBeInTheDocument();
  });

  it('explains a load failure with a retry', async () => {
    mocks.fetchSchedulingEligibility.mockRejectedValue(new ApiError('Not found', 'ROBOT_NOT_FOUND', 404));
    renderAt();
    expect(await screen.findByRole('alert')).toHaveTextContent('Robot not found.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('rejects a malformed id', async () => {
    renderAt('/robots/abc/setup');
    expect(await screen.findByTestId('robots')).toBeInTheDocument();
    expect(mocks.fetchMyRobots).not.toHaveBeenCalled();
  });
});
