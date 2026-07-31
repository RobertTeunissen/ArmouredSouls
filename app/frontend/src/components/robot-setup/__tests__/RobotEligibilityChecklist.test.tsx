/**
 * Tests for RobotEligibilityChecklist component.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 9.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RobotEligibilityChecklist from '../RobotEligibilityChecklist';

// Mock api
const mockGet = vi.fn();
vi.mock('../../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderChecklist(props?: Partial<Parameters<typeof RobotEligibilityChecklist>[0]>) {
  return render(
    <MemoryRouter>
      <RobotEligibilityChecklist robotId={1} {...props} />
    </MemoryRouter>,
  );
}

describe('RobotEligibilityChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render hard-gate warnings when hard gates are unmet', async () => {
    mockGet.mockResolvedValue({
      robotId: 1,
      isEligible: false,
      isFullyConfigured: false,
      gates: [
        { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: false, detail: 'No main weapon equipped' },
        { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: false, detail: 'No event subscriptions' },
        { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: false, detail: null },
      ],
    });

    renderChecklist({ showRecommendations: true });

    await waitFor(() => {
      expect(screen.getByText('Robot Not Eligible for Battles')).toBeInTheDocument();
    });

    expect(screen.getByText('Weapon equipped')).toBeInTheDocument();
    expect(screen.getByText('Subscribed to events')).toBeInTheDocument();
    expect(screen.getByText('No main weapon equipped')).toBeInTheDocument();
    expect(screen.getByText('Complete Setup')).toBeInTheDocument();
  });

  it('should render soft recommendations when showRecommendations is true', async () => {
    mockGet.mockResolvedValue({
      robotId: 1,
      isEligible: true,
      isFullyConfigured: false,
      gates: [
        { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: true, detail: null },
        { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: true, detail: null },
        { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: false, detail: 'Free stat bonuses available' },
      ],
    });

    renderChecklist({ showRecommendations: true });

    await waitFor(() => {
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
    });

    expect(screen.getByText('Tuning allocated')).toBeInTheDocument();
    expect(screen.getByText('Free stat bonuses available')).toBeInTheDocument();
  });

  it('should not render when isFullyConfigured is true', async () => {
    mockGet.mockResolvedValue({
      robotId: 1,
      isEligible: true,
      isFullyConfigured: true,
      gates: [
        { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: true, detail: null },
        { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: true, detail: null },
        { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: true, detail: null },
      ],
    });

    const { container } = renderChecklist({ showRecommendations: true });

    await waitFor(() => {
      // Give it time to load and decide not to render
      expect(mockGet).toHaveBeenCalled();
    });

    // Should render nothing
    expect(container.querySelector('.bg-warning\\/10')).not.toBeInTheDocument();
    expect(container.querySelector('.bg-primary\\/10')).not.toBeInTheDocument();
  });

  it('should not render soft gates when showRecommendations is false and robot is eligible', async () => {
    mockGet.mockResolvedValue({
      robotId: 1,
      isEligible: true,
      isFullyConfigured: false,
      gates: [
        { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: true, detail: null },
        { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: true, detail: null },
        { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: false, detail: 'Free bonuses' },
      ],
    });

    const { container } = renderChecklist({ showRecommendations: false });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // Should not show anything — eligible + no recommendations flag
    expect(container.querySelector('.bg-primary\\/10')).not.toBeInTheDocument();
  });

  it('should navigate to setup wizard when Complete Setup is clicked', async () => {
    mockGet.mockResolvedValue({
      robotId: 1,
      isEligible: false,
      isFullyConfigured: false,
      gates: [
        { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: false, detail: 'No weapon' },
        { id: 'event_subscribed', label: 'Subscribed', severity: 'hard', met: true, detail: null },
        { id: 'tuning_allocated', label: 'Tuning', severity: 'soft', met: true, detail: null },
      ],
    });

    const user = userEvent.setup();
    renderChecklist();

    await waitFor(() => {
      expect(screen.getByText('Complete Setup')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Complete Setup'));

    expect(mockNavigate).toHaveBeenCalledWith('/robots/1/setup');
  });

  it('should not render when API call fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { container } = renderChecklist();

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // Allow a tick for state to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(container.querySelector('.bg-warning\\/10')).not.toBeInTheDocument();
  });

  it('should render action buttons for each unmet gate', async () => {
    mockGet.mockResolvedValue({
      robotId: 1,
      isEligible: false,
      isFullyConfigured: false,
      gates: [
        { id: 'weapon_equipped', label: 'Weapon equipped', severity: 'hard', met: false, detail: null },
        { id: 'event_subscribed', label: 'Subscribed to events', severity: 'hard', met: false, detail: null },
        { id: 'tuning_allocated', label: 'Tuning allocated', severity: 'soft', met: false, detail: null },
      ],
    });

    renderChecklist({ showRecommendations: true });

    await waitFor(() => {
      expect(screen.getByText('Equip Weapon')).toBeInTheDocument();
      expect(screen.getByText('Subscribe to Events')).toBeInTheDocument();
      expect(screen.getByText('Allocate Tuning')).toBeInTheDocument();
    });
  });
});
