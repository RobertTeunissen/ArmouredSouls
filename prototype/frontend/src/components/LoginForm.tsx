import { useState, FormEvent } from 'react';
import { isAxiosError } from 'axios';
import apiClient from '../utils/apiClient';
import type { UserProfile } from './RegistrationForm';

/** Shared input field styling that follows the design system (matches LoginPage). */
const INPUT_CLASS =
  'w-full px-4 py-3 bg-surface border border-tertiary rounded-lg ' +
  'text-primary placeholder-tertiary ' +
  'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ' +
  'disabled:bg-background disabled:border-tertiary/50 disabled:opacity-60 ' +
  'transition-all duration-150 ease-out';

/**
 * Props for the {@link LoginForm} component.
 * @property onSuccess - Callback invoked after a successful login with the JWT token and user profile
 */
export interface LoginFormProps {
  onSuccess: (token: string, user: UserProfile) => void;
}

/**
 * Login form component that accepts a username or email as the login identifier.
 *
 * Renders a form with an identifier field (username or email) and a password field.
 * Submits credentials to the `POST /api/auth/login` endpoint. Displays server
 * error messages in an accessible alert region and disables the submit button
 * while a request is in flight.
 *
 * State:
 * - `identifier` — Current value of the username/email input
 * - `password` — Current value of the password input
 * - `error` — Error message string to display (empty when no error)
 * - `loading` — Whether a login request is currently in progress
 *
 * @param props - Component props
 * @param props.onSuccess - Called with `(token, user)` on successful login
 *
 * @example
 * ```tsx
 * <LoginForm
 *   onSuccess={(token, user) => {
 *     localStorage.setItem('token', token);
 *     console.log('Logged in as', user.username);
 *   }}
 * />
 * ```
 */
function LoginForm({ onSuccess }: LoginFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handles form submission. Sends login credentials to the API.
   * On success, calls {@link LoginFormProps.onSuccess}. On failure,
   * displays the error message from the server response.
   * @param e - The form submission event
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post('/api/auth/login', {
        identifier,
        password,
      });

      const { token, user } = response.data;
      onSuccess(token, user);
    } catch (err) {
      // Display the server's error message (e.g. "Invalid credentials") when
      // available. For network errors or missing response bodies, show a
      // generic fallback so the user always sees something actionable.
      if (isAxiosError(err) && err.response) {
        setError(err.response.data.error || 'Login failed');
      } else {
        setError('Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-primary mb-6">Login</h2>

      {error && (
        <div
          className="bg-error/10 border border-error text-red-300 px-4 py-3 rounded-lg mb-4 animate-error-slide-in"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="login-identifier"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Username or Email
          </label>
          <input
            type="text"
            id="login-identifier"
            name="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Enter username or email"
            required
            aria-required="true"
            aria-invalid={!!error}
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Password
          </label>
          <input
            type="password"
            id="login-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASS}
            placeholder="Enter your password"
            required
            aria-required="true"
            aria-invalid={!!error}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="w-full bg-primary hover:bg-primary-light active:bg-primary-dark
                     disabled:bg-primary-dark disabled:opacity-60
                     text-white font-medium px-6 py-3 rounded-lg
                     transition-all duration-150 ease-out
                     motion-safe:hover:-translate-y-0.5 hover:shadow-lg
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                     min-h-[48px]"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default LoginForm;
