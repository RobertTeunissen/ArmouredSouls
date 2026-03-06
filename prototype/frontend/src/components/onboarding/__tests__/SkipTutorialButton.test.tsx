import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SkipTutorialButton from '../SkipTutorialButton';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the onboarding API
vi.mock('../../../utils/onboardingApi', () => ({
  skipTutorial: vi.fn(),
}));

import { skipTutorial } from '../../../utils/onboardingApi';

const renderButton = (props = {}) => {
  return render(
    <MemoryRouter>
      <SkipTutorialButton {...props} />
    </MemoryRouter>
  );
};

describe('SkipTutorialButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (skipTutorial as any).mockResolvedValue(undefined);
  });

  it('should render the Skip Tutorial button', () => {
    renderButton();
    expect(screen.getByText('Skip Tutorial')).toBeInTheDocument();
  });

  it('should show confirmation dialog when clicked', () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));

    expect(screen.getByText('Skip Tutorial?')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to skip the tutorial\? You can always replay it from your profile settings\./)
    ).toBeInTheDocument();
  });

  it('should show warning text in confirmation dialog', () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));

    expect(screen.getByText(/replay it from your profile settings/)).toBeInTheDocument();
  });

  it('should show Yes, Skip and Cancel buttons in confirmation', () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));

    expect(screen.getByText('Yes, Skip')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should close dialog without skipping when Cancel is clicked', () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));
    expect(screen.getByText('Skip Tutorial?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Skip Tutorial?')).not.toBeInTheDocument();
    expect(skipTutorial).not.toHaveBeenCalled();
  });

  it('should call skipTutorial API when Yes, Skip is clicked', async () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));
    fireEvent.click(screen.getByText('Yes, Skip'));

    await waitFor(() => {
      expect(skipTutorial).toHaveBeenCalledTimes(1);
    });
  });

  it('should navigate to /dashboard after skip by default', async () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));
    fireEvent.click(screen.getByText('Yes, Skip'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should call onSkipped callback instead of navigating when provided', async () => {
    const onSkipped = vi.fn();
    renderButton({ onSkipped });

    fireEvent.click(screen.getByText('Skip Tutorial'));
    fireEvent.click(screen.getByText('Yes, Skip'));

    await waitFor(() => {
      expect(onSkipped).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should show error message when skip API fails', async () => {
    (skipTutorial as any).mockRejectedValue(new Error('Network error'));

    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));
    fireEvent.click(screen.getByText('Yes, Skip'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    // Dialog should remain open on error
    expect(screen.getByText('Skip Tutorial?')).toBeInTheDocument();
  });

  it('should show Skipping... text while API call is in progress', async () => {
    let resolveSkip: () => void;
    (skipTutorial as any).mockImplementation(
      () => new Promise<void>((resolve) => { resolveSkip = resolve; })
    );

    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));
    fireEvent.click(screen.getByText('Yes, Skip'));

    expect(screen.getByText('Skipping...')).toBeInTheDocument();

    resolveSkip!();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should be disabled when disabled prop is true', () => {
    renderButton({ disabled: true });
    expect(screen.getByText('Skip Tutorial')).toBeDisabled();
  });

  it('should have accessible dialog attributes', () => {
    renderButton();
    fireEvent.click(screen.getByText('Skip Tutorial'));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'skip-tutorial-title');
  });
});
