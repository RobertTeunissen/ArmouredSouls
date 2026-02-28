// Feature: user-registration-module, Property 13: Successful Registration Flow
// **Validates: Requirements 4.6, 8.2**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fc from 'fast-check';

const mockNavigate = vi.fn();
const mockRefreshUser = vi.fn().mockResolvedValue(undefined);

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: mockRefreshUser,
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  }),
}));

// Mock apiClient
import apiClient from '../../utils/apiClient';
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

const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

const validUsernameArbitrary = () =>
  fc
    .array(fc.constantFrom(...VALID_CHARS.split('')), { minLength: 3, maxLength: 20 })
    .map((chars) => chars.join(''));

const validEmailArbitrary = () =>
  fc.tuple(
    fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 5 }).map((c) => c.join('')),
    fc.constantFrom('a', 'b', 'x'),
    fc.constantFrom('co', 'io')
  ).map(([l, d, t]) => `${l}@${d}.${t}`);

const validPasswordArbitrary = () =>
  fc.string({ minLength: 8, maxLength: 30 }).filter((s) => s.length >= 8);

const HEX_CHARS = '0123456789abcdef';
const jwtTokenArbitrary = () =>
  fc
    .tuple(
      fc.array(fc.constantFrom(...HEX_CHARS.split('')), { minLength: 10, maxLength: 20 }).map((c) => c.join('')),
      fc.array(fc.constantFrom(...HEX_CHARS.split('')), { minLength: 10, maxLength: 20 }).map((c) => c.join('')),
      fc.array(fc.constantFrom(...HEX_CHARS.split('')), { minLength: 10, maxLength: 20 }).map((c) => c.join('')),
    )
    .map(([h, p, s]) => `${h}.${p}.${s}`);

const userIdArbitrary = () => fc.integer({ min: 1, max: 100000 });

describe('Property 13: Successful Registration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockRefreshUser.mockClear().mockResolvedValue(undefined);
    (localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
  });

  it('for any successful registration, token is stored, AuthContext is updated, and user is navigated to dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArbitrary(),
        validEmailArbitrary(),
        validPasswordArbitrary(),
        jwtTokenArbitrary(),
        userIdArbitrary(),
        async (username, email, password, token, userId) => {
          cleanup();

          const mockUser = {
            id: userId,
            username,
            email,
            currency: 1000,
            prestige: 0,
            role: 'player',
          };

          // Mock apiClient.post to return a successful registration response
          (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            data: { token, user: mockUser },
          });

          const user = userEvent.setup();
          render(<FrontPage />);

          // Switch to registration view
          const registerTab = screen.getByRole('tab', { name: /register/i });
          await user.click(registerTab);

          // Fill in the registration form
          fireEvent.change(screen.getByLabelText(/username/i), {
            target: { value: username },
          });
          fireEvent.change(screen.getByLabelText(/email/i), {
            target: { value: email },
          });
          fireEvent.change(screen.getByLabelText(/^password$/i), {
            target: { value: password },
          });
          fireEvent.change(screen.getByLabelText(/confirm password/i), {
            target: { value: password },
          });

          // Submit the form
          const submitButton = screen.getByRole('button', { name: /create account/i });
          await user.click(submitButton);

          // Wait for the async success handler to complete
          await waitFor(() => {
            expect(localStorage.setItem).toHaveBeenCalledWith('token', token);
          });

          // Verify refreshUser was called (AuthContext update)
          expect(mockRefreshUser).toHaveBeenCalled();

          // Verify navigation to dashboard
          expect(mockNavigate).toHaveBeenCalledWith('/dashboard');

          cleanup();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
