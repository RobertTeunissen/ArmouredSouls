// Feature: user-registration-module, Property 11: Error Message Display
// **Validates: Requirements 4.4, 9.4**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import RegistrationForm from '../RegistrationForm';

vi.mock('../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isAxiosError: (error: any) => error?.isAxiosError === true,
  };
});

import apiClient from '../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

const NUM_RUNS = 100;

const ERROR_MSG_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-_:;';

/**
 * Generates a random non-empty error message string (printable ASCII).
 */
const errorMessageArbitrary = () =>
  fc
    .array(fc.constantFrom(...ERROR_MSG_CHARS.split('')), { minLength: 1, maxLength: 100 })
    .map((chars) => chars.join('').trim())
    .filter((s) => s.length > 0);

describe('Property 11: Error Message Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the error message returned by the backend in the UI alert', async () => {
    await fc.assert(
      fc.asyncProperty(errorMessageArbitrary(), async (errorMessage) => {
        cleanup();

        const axiosError = {
          isAxiosError: true,
          response: { data: { error: errorMessage }, status: 400 },
        };
        mockedApiClient.post.mockRejectedValueOnce(axiosError);

        const onSuccess = vi.fn();
        const user = userEvent.setup();

        render(<RegistrationForm onSuccess={onSuccess} />);

        // Fill in all form fields with valid data and matching passwords
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'testemail' } });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });

        // Submit the form
        await user.click(screen.getByRole('button', { name: /create account/i }));

        // Wait for the error message to appear in the alert element
        await waitFor(() => {
          const alert = screen.getByRole('alert');
          expect(alert).toBeInTheDocument();
          expect(alert).toHaveTextContent(errorMessage);
        });

        // onSuccess should not have been called
        expect(onSuccess).not.toHaveBeenCalled();

        cleanup();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
