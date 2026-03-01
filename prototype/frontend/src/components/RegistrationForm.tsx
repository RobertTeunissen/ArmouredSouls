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

/** Input styling when the field has a validation error. */
const INPUT_ERROR_CLASS =
  'w-full px-4 py-3 bg-surface border border-error rounded-lg ' +
  'text-primary placeholder-tertiary ' +
  'focus:outline-none focus:border-error focus:ring-4 focus:ring-error/10 ' +
  'disabled:bg-background disabled:border-tertiary/50 disabled:opacity-60 ' +
  'transition-all duration-150 ease-out';

/**
 * User profile data returned by the registration and login API endpoints.
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
 */
export interface RegistrationFormProps {
  onSuccess: (token: string, user: UserProfile) => void;
}

/** Per-field error state for inline validation messages. */
interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
}

// --- Client-side validation (mirrors backend rules) ---

function validateUsername(username: string): string | undefined {
  if (username.length < 3) return 'Username must be at least 3 characters long';
  if (username.length > 20) return 'Username must not exceed 20 characters';
  if (!/^[a-zA-Z0-9_-]+$/.test(username))
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (email.length < 3) return 'Email must be at least 3 characters long';
  if (email.length > 50) return 'Email must not exceed 50 characters';
  if (!/^[a-zA-Z0-9._@-]+$/.test(email)) return 'Email contains invalid characters';
  if (!/^[^@]+@[^@]+$/.test(email))
    return 'Email must contain exactly one @ symbol with text on both sides';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (password.length > 128) return 'Password must not exceed 128 characters';
  return undefined;
}

/**
 * Maps a server error code to the field it belongs to, so we can show the
 * message inline next to the right input instead of in a generic banner.
 */
function mapServerErrorToField(
  code: string | undefined,
  message: string,
): { field: keyof FieldErrors | null; message: string } {
  switch (code) {
    case 'DUPLICATE_USERNAME':
      return { field: 'username', message };
    case 'DUPLICATE_EMAIL':
      return { field: 'email', message };
    case 'VALIDATION_ERROR': {
      // The backend joins multiple errors with ", ". Try to map to a field
      // by keyword. If it spans multiple fields, fall back to general.
      const lower = message.toLowerCase();
      if (lower.includes('username') && !lower.includes('email') && !lower.includes('password'))
        return { field: 'username', message };
      if (lower.includes('email') && !lower.includes('username') && !lower.includes('password'))
        return { field: 'email', message };
      if (lower.includes('password') && !lower.includes('username') && !lower.includes('email'))
        return { field: 'password', message };
      return { field: null, message };
    }
    default:
      return { field: null, message };
  }
}

/** Inline error message displayed below a form field. */
function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-error" role="alert">
      {message}
    </p>
  );
}

/**
 * Registration form component for creating new user accounts.
 *
 * Renders a form with username, email, password, and password confirmation fields.
 * Performs client-side validation before submitting to `POST /api/auth/register`.
 * Displays per-field inline error messages and a general banner for server errors
 * that can't be mapped to a specific field.
 */
function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  /** Clears errors for a specific field when the user starts editing it. */
  const clearFieldError = (field: keyof FieldErrors) => {
    if (fieldErrors[field] || generalError) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setGeneralError(null);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    clearFieldError('username');
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    clearFieldError('email');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    clearFieldError('password');
  };

  const handlePasswordConfirmationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordConfirmation(e.target.value);
    clearFieldError('passwordConfirmation');
  };

  /**
   * Runs all client-side validation and returns true if the form is valid.
   * Sets per-field errors for any failures.
   */
  const runClientValidation = (): boolean => {
    const errors: FieldErrors = {};

    const usernameErr = validateUsername(username);
    if (usernameErr) errors.username = usernameErr;

    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;

    const passwordErr = validatePassword(password);
    if (passwordErr) errors.password = passwordErr;

    if (password !== passwordConfirmation) {
      errors.passwordConfirmation = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Client-side validation first — avoids a round-trip for obvious issues.
    if (!runClientValidation()) return;

    setIsSubmitting(true);
    setFieldErrors({});
    setGeneralError(null);

    try {
      const response = await apiClient.post('/api/auth/register', {
        username,
        email,
        password,
      });

      const { token, user } = response.data;
      onSuccess(token, user);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        const { error: serverMessage, code } = error.response.data;
        const mapped = mapServerErrorToField(code, serverMessage || 'Registration failed');

        if (mapped.field) {
          setFieldErrors({ [mapped.field]: mapped.message });
        } else {
          setGeneralError(mapped.message);
        }
      } else {
        setGeneralError(
          'Unable to reach the server. Check your internet connection and try again.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-primary mb-6">Register</h2>

      {generalError && (
        <div
          className="bg-error/10 border border-error text-red-300 px-4 py-3 rounded-lg mb-4 animate-error-slide-in"
          role="alert"
        >
          <p>{generalError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
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
            className={fieldErrors.username ? INPUT_ERROR_CLASS : INPUT_CLASS}
            placeholder="Choose a username"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.username}
            aria-describedby={fieldErrors.username ? 'reg-username-error' : undefined}
            disabled={isSubmitting}
          />
          <FieldError message={fieldErrors.username} id="reg-username-error" />
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
            className={fieldErrors.email ? INPUT_ERROR_CLASS : INPUT_CLASS}
            placeholder="Enter your email"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
            disabled={isSubmitting}
          />
          <FieldError message={fieldErrors.email} id="reg-email-error" />
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
            className={fieldErrors.password ? INPUT_ERROR_CLASS : INPUT_CLASS}
            placeholder="Create a password"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
            disabled={isSubmitting}
          />
          <FieldError message={fieldErrors.password} id="reg-password-error" />
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
            className={fieldErrors.passwordConfirmation ? INPUT_ERROR_CLASS : INPUT_CLASS}
            placeholder="Confirm your password"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.passwordConfirmation}
            aria-describedby={
              fieldErrors.passwordConfirmation ? 'reg-password-confirm-error' : undefined
            }
            disabled={isSubmitting}
          />
          <FieldError
            message={fieldErrors.passwordConfirmation}
            id="reg-password-confirm-error"
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
 */
export interface RegistrationFormState {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  isSubmitting: boolean;
  fieldErrors: FieldErrors;
  generalError: string | null;
}

export default RegistrationForm;
