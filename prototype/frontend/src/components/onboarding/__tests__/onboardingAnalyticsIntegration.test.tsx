/**
 * Tests for onboarding analytics integration.
 *
 * Verifies that the OnboardingContainer and step components
 * correctly call analytics tracking functions during the tutorial flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingContainer from '../OnboardingContainer';
import { OnboardingProvider } from '../../../contexts/OnboardingContext';
import apiClient from '../../../utils/apiClient';
import * as analytics from '../../../utils/onboardingAnalytics';

// Mock apiClient
vi.mock('../../../utils/apiClient');

// Mock analytics module
vi.mock('../../../utils/onboardingAnalytics', async () => {
  const actual = await vi.importActual<typeof analytics>('../../../utils/onboardingAnalytics');
  return {
    ...actual,
    trackStepStarted: vi.fn(),
    trackStepCompleted: vi.fn(),
    trackTutorialCompleted: vi.fn(),
    trackTutorialSkipped: vi.fn(),
    trackStrategySelected: vi.fn(),
    trackError: vi.fn(),
    flushEvents: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock formatCurrency utility
vi.mock('../../../utils/financialApi', () => ({
  formatCurrency: (value: number) => `₡${(value / 1000).toFixed(0)}K`,
}));

function makeTutorialState(step: number, extra: Record<string, unknown> = {}) {
  return {
    currentStep: step,
    hasCompletedOnboarding: false,
    onboardingSkipped: false,
    strategy: null,
    choices: {},
    ...extra,
  };
}

describe('Onboarding Analytics Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step tracking', () => {
    it('should call trackStepStarted when the tutorial loads on step 1', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: makeTutorialState(1) },
      });

      render(
        <OnboardingProvider>
          <OnboardingContainer />
        </OnboardingProvider>,
      );

      await waitFor(() => {
        expect(analytics.trackStepStarted).toHaveBeenCalledWith(1);
      });
    });

    it('should call trackStepCompleted and trackStepStarted when advancing to next step', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: makeTutorialState(1) },
      });

      // Mock advance step response
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: makeTutorialState(2) },
      });

      const user = userEvent.setup();

      render(
        <OnboardingProvider>
          <OnboardingContainer />
        </OnboardingProvider>,
      );

      // Wait for step 1 to render
      await waitFor(() => {
        expect(analytics.trackStepStarted).toHaveBeenCalledWith(1);
      });

      // Find and click the Next/Continue button on Step 1
      const nextButton = await screen.findByRole('button', { name: /begin|next|continue|start/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(analytics.trackStepCompleted).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Tutorial skip tracking', () => {
    it('should call trackTutorialSkipped when user confirms skip', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: { success: true, data: makeTutorialState(1) },
      });

      vi.mocked(apiClient.post).mockResolvedValue({
        data: { success: true, data: makeTutorialState(1, { onboardingSkipped: true, hasCompletedOnboarding: true }) },
      });

      const user = userEvent.setup();

      // Mock window.location.href
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, href: '' },
      });

      render(
        <OnboardingProvider>
          <OnboardingContainer />
        </OnboardingProvider>,
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip tutorial/i })).toBeInTheDocument();
      });

      // Click skip button
      await user.click(screen.getByRole('button', { name: /skip tutorial/i }));

      // Confirm skip in modal
      const confirmButton = await screen.findByRole('button', { name: /yes.*skip|confirm.*skip|skip.*anyway/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(analytics.trackTutorialSkipped).toHaveBeenCalledWith(1);
        expect(analytics.flushEvents).toHaveBeenCalled();
      });

      // Restore
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });
  });
});
