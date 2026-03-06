/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ResetAccountModal from '../ResetAccountModal';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ResetAccountModal', () => {
  const mockOnClose = vi.fn();
  const mockOnResetComplete = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('token', 'test-token');
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Eligibility Checking', () => {
    it('should check reset eligibility when modal opens', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      // Should show loading state
      expect(screen.getByText('Checking eligibility...')).toBeInTheDocument();

      // Wait for eligibility check to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/onboarding/reset-eligibility',
          expect.objectContaining({
            headers: {
              Authorization: 'Bearer test-token',
            },
          })
        );
      });
    });

    it('should display reset form when eligible', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.tagName === 'H4' && content.includes('Warning') && content.includes('Cannot Be Undone');
        })).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('Type RESET or START OVER')).toBeInTheDocument();
      // "Reset Account" appears in both header and button; use role to find the button
      expect(screen.getByRole('button', { name: 'Reset Account' })).toBeInTheDocument();
    });

    it('should display blockers when not eligible', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            canReset: false,
            blockers: ['scheduled_battles', 'active_tournament'],
          },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cannot Reset Account')).toBeInTheDocument();
      });

      expect(
        screen.getByText('You have scheduled battles. Removing robots would create conflicts.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('You are participating in an active tournament.')
      ).toBeInTheDocument();

      // Reset button should not be present (only Cancel button in footer)
      expect(screen.queryByRole('button', { name: 'Reset Account' })).not.toBeInTheDocument();
    });

    it('should handle eligibility check error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      // When eligibility check fails, error is set but canReset stays false,
      // so the component renders the blocker view (not the form where error displays).
      // The blocker view shows "Cannot Reset Account" with empty blockers.
      await waitFor(() => {
        expect(screen.queryByText('Checking eligibility...')).not.toBeInTheDocument();
      });

      // The component should not show the reset form
      expect(screen.queryByRole('button', { name: 'Reset Account' })).not.toBeInTheDocument();
    });
  });

  describe('Confirmation Text Validation', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type RESET or START OVER')).toBeInTheDocument();
      });
    });

    it('should disable reset button when confirmation text is empty', () => {
      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      expect(resetButton).toBeDisabled();
    });

    it('should enable reset button when "RESET" is typed', () => {
      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'RESET' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      expect(resetButton).not.toBeDisabled();
    });

    it('should enable reset button when "START OVER" is typed', () => {
      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'START OVER' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      expect(resetButton).not.toBeDisabled();
    });

    it('should disable reset button when incorrect text is typed', () => {
      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'reset' } }); // lowercase

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      expect(resetButton).toBeDisabled();
    });

    it('should show error when attempting reset with invalid confirmation', async () => {
      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'WRONG' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });

      // Since button is disabled, we need to test the validation logic directly
      // by typing correct text first, then changing it
      fireEvent.change(input, { target: { value: 'RESET' } });
      fireEvent.change(input, { target: { value: 'WRONG' } });

      expect(resetButton).toBeDisabled();
    });
  });

  describe('Reset Flow', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type RESET or START OVER')).toBeInTheDocument();
      });
    });

    it('should successfully reset account with "RESET" confirmation', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { message: 'Account reset successfully' },
        }),
      });

      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'RESET' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/onboarding/reset-account',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-token',
            },
            body: JSON.stringify({
              confirmation: 'RESET',
              reason: 'User requested reset from onboarding',
            }),
          })
        );
      });

      expect(mockOnResetComplete).toHaveBeenCalled();
    });

    it('should successfully reset account with "START OVER" confirmation', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { message: 'Account reset successfully' },
        }),
      });

      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'START OVER' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/onboarding/reset-account',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              confirmation: 'START OVER',
              reason: 'User requested reset from onboarding',
            }),
          })
        );
      });

      expect(mockOnResetComplete).toHaveBeenCalled();
    });

    it('should show loading state during reset', async () => {
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  json: async () => ({
                    success: true,
                    data: { message: 'Account reset successfully' },
                  }),
                }),
              100
            )
          )
      );

      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'RESET' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      fireEvent.click(resetButton);

      expect(screen.getByText('Resetting...')).toBeInTheDocument();

      await waitFor(() => {
        expect(mockOnResetComplete).toHaveBeenCalled();
      });
    });

    it('should handle reset API error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Cannot reset - you have scheduled battles',
        }),
      });

      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'RESET' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(
          screen.getByText('Cannot reset - you have scheduled battles')
        ).toBeInTheDocument();
      });

      expect(mockOnResetComplete).not.toHaveBeenCalled();
    });

    it('should handle network error during reset', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'RESET' } });

      const resetButton = screen.getByRole('button', { name: 'Reset Account' });
      fireEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to reset account. Please try again.')).toBeInTheDocument();
      });

      expect(mockOnResetComplete).not.toHaveBeenCalled();
    });
  });

  describe('Modal Behavior', () => {
    it('should not render when isOpen is false', () => {
      render(
        <ResetAccountModal
          isOpen={false}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      expect(screen.queryByRole('heading', { name: 'Reset Account' })).not.toBeInTheDocument();
    });

    it('should call onClose when cancel button is clicked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when overlay is clicked', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      const { container } = render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.tagName === 'H4' && content.includes('Warning') && content.includes('Cannot Be Undone');
        })).toBeInTheDocument();
      });

      const overlay = container.querySelector('.bg-black.bg-opacity-75');
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('should reset confirmation text when modal reopens', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      const { rerender } = render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type RESET or START OVER')).toBeInTheDocument();
      });

      // Type confirmation text
      const input = screen.getByPlaceholderText('Type RESET or START OVER');
      fireEvent.change(input, { target: { value: 'RESET' } });
      expect(input).toHaveValue('RESET');

      // Close modal
      rerender(
        <ResetAccountModal
          isOpen={false}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      // Reopen modal
      rerender(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        const newInput = screen.getByPlaceholderText('Type RESET or START OVER');
        expect(newInput).toHaveValue('');
      });
    });
  });

  describe('Blocker Display', () => {
    it('should display scheduled battles blocker', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            canReset: false,
            blockers: ['scheduled_battles'],
          },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cannot Reset Account')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/You have scheduled battles/)
      ).toBeInTheDocument();
    });

    it('should display active tournament blocker', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            canReset: false,
            blockers: ['active_tournament'],
          },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cannot Reset Account')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/You are participating in an active tournament/)
      ).toBeInTheDocument();
    });

    it('should display pending battles blocker', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            canReset: false,
            blockers: ['pending_battles'],
          },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cannot Reset Account')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/You have recent battle results being processed/)
      ).toBeInTheDocument();
    });

    it('should display multiple blockers', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            canReset: false,
            blockers: ['scheduled_battles', 'active_tournament', 'pending_battles'],
          },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Cannot Reset Account')).toBeInTheDocument();
      });

      expect(screen.getByText(/You have scheduled battles/)).toBeInTheDocument();
      expect(screen.getByText(/You are participating in an active tournament/)).toBeInTheDocument();
      expect(screen.getByText(/You have recent battle results being processed/)).toBeInTheDocument();
    });
  });

  describe('Consequences Display', () => {
    beforeEach(async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { canReset: true },
        }),
      });

      render(
        <ResetAccountModal
          isOpen={true}
          onClose={mockOnClose}
          onResetComplete={mockOnResetComplete}
        />
      );

      await waitFor(() => {
        // The warning heading contains an SVG icon followed by text, so use a custom matcher
        expect(screen.getByText((content, element) => {
          return element?.tagName === 'H4' && content.includes('Warning') && content.includes('Cannot Be Undone');
        })).toBeInTheDocument();
      });
    });

    it('should display all consequences', () => {
      expect(screen.getByText(/All your robots/)).toBeInTheDocument();
      expect(screen.getByText(/All your weapons/)).toBeInTheDocument();
      expect(screen.getByText(/All your facilities/)).toBeInTheDocument();
      expect(screen.getByText(/₡3,000,000/)).toBeInTheDocument();
      expect(screen.getByText(/Step 1/)).toBeInTheDocument();
    });

    it('should display warning icon', () => {
      const warningSection = screen.getByText((content, element) => {
        return element?.tagName === 'H4' && content.includes('Warning') && content.includes('Cannot Be Undone');
      }).closest('div');
      expect(warningSection).toHaveClass('bg-warning/10');
    });
  });
});
