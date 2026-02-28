// Feature: user-registration-module, Property 10: Password Confirmation Mismatch
// **Validates: Requirements 4.3**

import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';
import RegistrationForm from '../RegistrationForm';

const NUM_RUNS = 100;

/**
 * Generates a non-empty password string.
 */
const passwordArbitrary = () =>
  fc.string({ minLength: 1, maxLength: 64 });

/**
 * Generates two distinct non-empty password strings.
 */
const differentPasswordsArbitrary = () =>
  fc
    .tuple(passwordArbitrary(), passwordArbitrary())
    .filter(([a, b]) => a !== b);

describe('Property 10: Password Confirmation Mismatch', () => {
  it('displays error and prevents submission when password and confirmation differ', async () => {
    await fc.assert(
      fc.asyncProperty(differentPasswordsArbitrary(), async ([password, confirmation]) => {
        // Clean up any previous renders to avoid stale DOM elements
        cleanup();

        const onSuccess = vi.fn();
        const user = userEvent.setup();

        render(<RegistrationForm onSuccess={onSuccess} />);

        // Fill all required fields using fireEvent.change for speed,
        // since the property under test is password mismatch validation, not typing.
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test-email' } });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: confirmation } });

        // Submit the form using userEvent for realistic interaction
        await user.click(screen.getByRole('button', { name: /create account/i }));

        // Verify error message is displayed
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

        // Verify form was not submitted (onSuccess was not called)
        expect(onSuccess).not.toHaveBeenCalled();

        cleanup();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
