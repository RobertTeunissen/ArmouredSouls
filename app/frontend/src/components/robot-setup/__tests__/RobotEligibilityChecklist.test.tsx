/**
 * Tests for RobotEligibilityChecklist: one "Not ready for battle" warning for
 * unmet hard gates (single Finish setup action), a tuning recommendation.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RobotEligibilityChecklist from '../RobotEligibilityChecklist';
import type { SchedulingEligibilityReport } from '../types';

const mockFetch = vi.fn();
vi.mock('../../../utils/robotApi', () => ({
  fetchSchedulingEligibility: (...args: unknown[]) => mockFetch(...args),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function report(met: { weapon: boolean; events: boolean; tuning: boolean }): SchedulingEligibilityReport {
  return {
    robotId: 1,
    isEligible: met.weapon && met.events,
    isFullyConfigured: met.weapon && met.events && met.tuning,
    gates: [
      { id: 'weapon_equipped', label: 'Equip a weapon', severity: 'hard', met: met.weapon, detail: met.weapon ? null : 'No main weapon equipped' },
      { id: 'event_subscribed', label: 'Enter at least one battle event', severity: 'hard', met: met.events, detail: null },
      { id: 'tuning_allocated', label: 'Allocate your tuning points', severity: 'soft', met: met.tuning, detail: met.tuning ? null : '10 of 10 free tuning points unallocated' },
    ],
  };
}

function renderChecklist(showRecommendations = true) {
  return render(
    <MemoryRouter>
      <RobotEligibilityChecklist robotId={1} showRecommendations={showRecommendations} />
    </MemoryRouter>,
  );
}

describe('RobotEligibilityChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the unmet hard gates as tasks in one warning with a single action', async () => {
    mockFetch.mockResolvedValue(report({ weapon: false, events: false, tuning: false }));
    const user = userEvent.setup();
    renderChecklist();

    expect(await screen.findByText('Not ready for battle')).toBeInTheDocument();
    expect(screen.getByText('Equip a weapon · Enter at least one battle event')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Finish setup' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(mockNavigate).toHaveBeenCalledWith('/robots/1/setup');
  });

  it('shows the tuning recommendation with its point count and a link to the Build section', async () => {
    mockFetch.mockResolvedValue(report({ weapon: true, events: true, tuning: false }));
    const user = userEvent.setup();
    renderChecklist();

    expect(await screen.findByText('Allocate your tuning points')).toBeInTheDocument();
    expect(screen.getByText('10 of 10 free tuning points unallocated')).toBeInTheDocument();
    expect(screen.queryByText('Not ready for battle')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Allocate tuning' }));
    expect(mockNavigate).toHaveBeenCalledWith('/robots/1/prepare');
  });

  it('hides recommendations unless asked for them', async () => {
    mockFetch.mockResolvedValue(report({ weapon: true, events: true, tuning: false }));
    const { container } = renderChecklist(false);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(1, expect.any(AbortSignal)));
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the robot is fully configured', async () => {
    mockFetch.mockResolvedValue(report({ weapon: true, events: true, tuning: true }));
    const { container } = renderChecklist();

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the report cannot be loaded', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { container } = renderChecklist();

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
  });
});
