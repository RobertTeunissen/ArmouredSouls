import { useState, FormEvent } from 'react';
import { isAxiosError } from 'axios';
import apiClient from '../utils/apiClient';

/** Shared input field styling that follows the design system (matches LoginPage). */
const INPUT_CLASS =
  'w-full px-4 py-3 bg-surface border border-tertiary rounded-lg ' +
  'text-primary placeholder-tertiary ' +
  'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ' +
  'disabled:bg-background disabled:border-tertiary/50 disabled:opacity-60 ' +
  'transition-all duration-150 ease-out';

/**
 * User profile data returned by the registration and login API endpoints.
 * @property id - Unique identifier for the user
 * @property username - The user's chosen display name
 * @property email - The user's email address
 * @property currency - The user's in-game currency balance
 * @property prestige - The user's prestige score
 * @property role - The user's role (e.g. 'player')
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  currency: number;
  prestige: number;
  role: string;
}

/**
 * Props for the {@link RegistrationForm} component.
 * @property onSuccess - Callback invoked after a successful registration with the JWT token and user profile
 */
export interface RegistrationFormProps {
  onSuccess: (token: string, user: UserProfile) => void;
}

/**
 * Registration form component for creating new user accounts.
 *
 * Renders a form with username, email, password, and password confirmation fields.
 * Performs client-side validation (password confirmation match) before submitting
 * to the `POST /api/auth/register` endpoint. Displays API error messages in an
 * accessible alert region and disables the submit button while a request is in flight.
 *
 * State:
 * - `username` — Current value of the username input
 * - `email` — Current value of the email input
 * - `password` — Current value of the password input
 * - `passwordConfirmation` — Current value of the confirm-password input
 * - `isSubmitting` — Whether a registration request is currently in progress
 * - `errors` — Array of error messages to display (from client or server validation)
 *
 * @param props - Component props
 * @param props.onSuccess - Called with `(token, user)` on successful registration
 *
 * @example
 * ```tsx
 * <RegistrationForm
 *   onSuccess={(token, user) => {
 *     localStorage.setItem('token', token);
 *     console.log('Registered as', user.username);
 *   }}
 * />
 * ```
 */
function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  /** Clears displayed errors if any are present. Called on every input change. */
  const clearErrors = () => {
    // Only trigger a re-render when there are errors to clear, avoiding
    // unnecessary state updates on every keystroke.
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  /** Handles username input changes and clears any displayed errors. */
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    clearErrors();
  };

  /** Handles email input changes and clears any displayed errors. */
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearErrors();
  };

  /** Handles password input changes and clears any displayed errors. */
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    clearErrors();
  };

  /** Handles password confirmation input changes and clears any displayed errors. */
  const handlePasswordConfirmationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordConfirmation(e.target.value);
    clearErrors();
  };

  /**
   * Handles form submission. Validates that passwords match, then sends a
   * registration request to the API. On success, calls {@link RegistrationFormProps.onSuccess}.
   * On failure, displays the error message from the server response.
   * @param e - The form submission event
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Client-side password confirmation check — prevents a round-trip to the
    // server for a mismatch the user can fix immediately (Requirement 4.3).
    const validationErrors: string[] = [];

    if (password !== passwordConfirmation) {
      validationErrors.push('Passwords do not match');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const response = await apiClient.post('/api/auth/register', {
        username,
        email,
        password,
      });

      const { token, user } = response.data;
      onSuccess(token, user);
    } catch (error) {
      // Surface the server's error message when available (e.g. "Username is
      // already taken") so the user gets actionable feedback. Fall back to a
      // generic message for network failures or unexpected response shapes.
      if (isAxiosError(error) && error.response) {
        setErrors([error.response.data.error || 'Registration failed']);
      } else {
        setErrors(['Registration failed']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-primary mb-6">Register</h2>

      {errors.length > 0 && (
        <div
          className="bg-error/10 border border-error text-red-300 px-4 py-3 rounded-lg mb-4 animate-error-slide-in"
          role="alert"
        >
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="reg-username"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Username
          </label>
          <input
            type="text"
            id="reg-username"
            name="username"
            value={username}
            onChange={handleUsernameChange}
            className={INPUT_CLASS}
            placeholder="Choose a username"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="reg-email"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Email
          </label>
          <input
            type="email"
            id="reg-email"
            name="email"
            value={email}
            onChange={handleEmailChange}
            className={INPUT_CLASS}
            placeholder="Enter your email"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="reg-password"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Password
          </label>
          <input
            type="password"
            id="reg-password"
            name="password"
            value={password}
            onChange={handlePasswordChange}
            className={INPUT_CLASS}
            placeholder="Create a password"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="reg-password-confirmation"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Confirm Password
          </label>
          <input
            type="password"
            id="reg-password-confirmation"
            name="passwordConfirmation"
            value={passwordConfirmation}
            onChange={handlePasswordConfirmationChange}
            className={INPUT_CLASS}
            placeholder="Confirm your password"
            required
            aria-required="true"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full bg-primary hover:bg-primary-light active:bg-primary-dark
                     disabled:bg-primary-dark disabled:opacity-60
                     text-white font-medium px-6 py-3 rounded-lg
                     transition-all duration-150 ease-out
                     motion-safe:hover:-translate-y-0.5 hover:shadow-lg
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                     min-h-[48px]"
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}

/**
 * Describes the internal state shape of the {@link RegistrationForm} component.
 * Exported for use in property-based tests and external state inspection.
 * @property username - Current username input value
 * @property email - Current email input value
 * @property password - Current password input value
 * @property passwordConfirmation - Current password confirmation input value
 * @property isSubmitting - Whether a registration request is in flight
 * @property errors - Array of error messages currently displayed
 */
export interface RegistrationFormState {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  isSubmitting: boolean;
  errors: string[];
}

export default RegistrationForm;
