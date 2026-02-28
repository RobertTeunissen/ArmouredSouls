// Feature: user-registration-module, Property 12: Loading State During Submission
// **Validates: Requirements 4.5**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import RegistrationForm from '../RegistrationForm';

vi.mock('../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

const NUM_RUNS = 50;

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_-';

/**
 * Generates a valid username (3-20 alphanumeric/underscore/hyphen chars).
 */
const validUsernameArbitrary = () =>
  fc
    .array(fc.constantFrom(...VALID_CHARS.split('')), { minLength: 3, maxLength: 20 })
    .map((chars) => chars.join(''));

/**
 * Generates a valid email (3-20 alphanumeric/underscore/hyphen chars).
 */
const validEmailArbitrary = () =>
  fc
    .array(fc.constantFrom(...VALID_CHARS.split('')), { minLength: 3, maxLength: 20 })
    .map((chars) => chars.join(''));

/**
 * Generates a valid password (8-64 printable chars).
 */
const validPasswordArbitrary = () =>
  fc.string({ minLength: 8, maxLength: 64 }).filter((s) => s.trim().length >= 8);

describe('Property 12: Loading State During Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables submit button, shows loading text, and disables all fields while request is in progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArbitrary(),
        validEmailArbitrary(),
        validPasswordArbitrary(),
        async (username, email, password) => {
          cleanup();

          // Create a deferred promise so we control when the API call resolves
          let resolveRequest!: (value: unknown) => void;
          const pendingPromise = new Promise((resolve) => {
            resolveRequest = resolve;
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mockedApiClient.post.mockReturnValue(pendingPromise as any);

          const onSuccess = vi.fn();
          const user = userEvent.setup();

          render(<RegistrationForm onSuccess={onSuccess} />);

          // Fill in all form fields with valid data and matching passwords
          fireEvent.change(screen.getByLabelText(/username/i), { target: { value: username } });
          fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
          fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
          fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: password } });

          // Submit the form
          await user.click(screen.getByRole('button', { name: /create account/i }));

          // While the request is in progress, verify loading state
          const submitButton = screen.getByRole('button');

          // Submit button should be disabled
          expect(submitButton).toBeDisabled();

          // Button text should show loading indicator
          expect(submitButton).toHaveTextContent('Creating Account...');

          // All form fields should be disabled
          expect(screen.getByLabelText(/username/i)).toBeDisabled();
          expect(screen.getByLabelText(/email/i)).toBeDisabled();
          expect(screen.getByLabelText(/^password$/i)).toBeDisabled();
          expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();

          // Now resolve the promise and verify the button is re-enabled
          await act(async () => {
            resolveRequest({
              data: {
                token: 'test-token',
                user: {
                  id: '1',
                  username,
                  email,
                  currency: 1000,
                  prestige: 0,
                  role: 'player',
                },
              },
            });
          });

          await waitFor(() => {
            expect(screen.getByRole('button')).not.toBeDisabled();
          });

          cleanup();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
