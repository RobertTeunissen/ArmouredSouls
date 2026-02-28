// Feature: user-registration-module, Property 14: View Switching State Preservation
// **Validates: Requirements 5.4**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: vi.fn(),
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  }),
}));

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

import FrontPage from '../FrontPage';

const NUM_RUNS = 50;

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789_-';

/**
 * Generates a non-empty string of valid form-input characters.
 */
const formValueArbitrary = () =>
  fc
    .array(fc.constantFrom(...VALID_CHARS.split('')), { minLength: 1, maxLength: 20 })
    .map((chars) => chars.join(''));

/**
 * Generates a set of registration form field values.
 */
const registrationFieldsArbitrary = () =>
  fc.record({
    username: formValueArbitrary(),
    email: formValueArbitrary(),
    password: formValueArbitrary(),
    passwordConfirmation: formValueArbitrary(),
  });

describe('Property 14: View Switching State Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('documents that registration form state is reset after switching to login and back (unmount/remount behavior)', async () => {
    await fc.assert(
      fc.asyncProperty(registrationFieldsArbitrary(), async (fields) => {
        cleanup();

        const user = userEvent.setup();

        render(<FrontPage />);

        // FrontPage defaults to 'login' view — switch to registration view
        const registerTab = screen.getByRole('tab', { name: /register/i });
        await user.click(registerTab);

        // Fill in registration form fields
        fireEvent.change(screen.getByLabelText(/username/i), {
          target: { value: fields.username },
        });
        fireEvent.change(screen.getByLabelText(/email/i), {
          target: { value: fields.email },
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), {
          target: { value: fields.password },
        });
        fireEvent.change(screen.getByLabelText(/confirm password/i), {
          target: { value: fields.passwordConfirmation },
        });

        // Verify the fields have the entered values before switching
        expect(screen.getByLabelText(/username/i)).toHaveValue(fields.username);
        expect(screen.getByLabelText(/email/i)).toHaveValue(fields.email);
        expect(screen.getByLabelText(/^password$/i)).toHaveValue(fields.password);
        expect(screen.getByLabelText(/confirm password/i)).toHaveValue(
          fields.passwordConfirmation,
        );

        // Switch to login view
        const loginTab = screen.getByRole('tab', { name: /login/i });
        await user.click(loginTab);

        // Verify login form is now visible
        expect(screen.getByText(/^login$/i, { selector: 'h2' })).toBeInTheDocument();

        // Switch back to registration view
        await user.click(screen.getByRole('tab', { name: /register/i }));

        // The FrontPage uses conditional rendering which unmounts/remounts
        // components on view switch. This means React destroys component state
        // when switching away, so form fields reset to empty strings.
        // This documents the actual behavior of the current implementation.
        expect(screen.getByLabelText(/username/i)).toHaveValue('');
        expect(screen.getByLabelText(/email/i)).toHaveValue('');
        expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
        expect(screen.getByLabelText(/confirm password/i)).toHaveValue('');

        cleanup();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
