import { useState, FormEvent } from 'react';
import { api } from '../utils/api';
import { ApiError } from '../utils/ApiError';
import { emailErrors, registrationPasswordErrors, stableNameErrors, usernameErrors } from '@shared/utils/accountRules';

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
  stableName: string;
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
  stableName?: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
}

// --- Client-side validation: the backend's rules and wording (shared/utils/accountRules) ---

const validateUsername = (username: string): string | undefined => usernameErrors(username)[0];
const validateEmail = (email: string): string | undefined => emailErrors(email)[0];
const validatePassword = (password: string): string | undefined => registrationPasswordErrors(password)[0];
const validateStableName = (stableName: string): string | undefined => stableNameErrors(stableName)[0];

const SERVER_FIELDS = ['username', 'email', 'password', 'stableName'] as const;
type ServerField = (typeof SERVER_FIELDS)[number];

/**
 * Field messages from a rejected registration: duplicates by code, validation
 * failures from `details.fields` (one message per field, the first wins).
 * Returns null when nothing maps to a field, so the banner shows the message.
 */
function serverFieldErrors(error: ApiError): Partial<Record<ServerField, string>> | null {
  const message = error.message || 'Registration failed';
  switch (error.code) {
    case 'DUPLICATE_USERNAME':
      return { username: message };
    case 'DUPLICATE_EMAIL':
      return { email: message };
    case 'DUPLICATE_STABLE_NAME':
      return { stableName: message };
    case 'VALIDATION_ERROR': {
      const fields = (error.details as { fields?: Array<{ field: string; message: string }> } | undefined)?.fields ?? [];
      const mapped: Partial<Record<ServerField, string>> = {};
      for (const { field, message: fieldMessage } of fields) {
        if ((SERVER_FIELDS as readonly string[]).includes(field) && !mapped[field as ServerField]) {
          mapped[field as ServerField] = fieldMessage;
        }
      }
      return Object.keys(mapped).length > 0 ? mapped : null;
    }
    default:
      return null;
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
  const [stableName, setStableName] = useState('');
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

  const handleStableNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStableName(e.target.value);
    clearFieldError('stableName');
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

    const stableNameErr = validateStableName(stableName);
    if (stableNameErr) errors.stableName = stableNameErr;

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
      const { token, user } = await api.post<{ token: string; user: UserProfile }>(
        '/api/auth/register',
        { username, stableName, email, password },
      );
      onSuccess(token, user);
    } catch (error) {
      if (error instanceof ApiError && error.code !== 'NETWORK_ERROR') {
        // Backend gave us a structured response: show it under its fields,
        // falling back to the general error banner.
        const mapped = serverFieldErrors(error);
        if (mapped) {
          setFieldErrors(mapped);
        } else {
          setGeneralError(error.message || 'Registration failed');
        }
      } else {
        // Network error (no response) — connectivity message.
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
            placeholder="Choose a username (private, for login only)"
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
            htmlFor="reg-stable-name"
            className="block text-sm font-medium text-secondary mb-2"
          >
            Stable Name
          </label>
          <input
            type="text"
            id="reg-stable-name"
            name="stableName"
            value={stableName}
            onChange={handleStableNameChange}
            className={fieldErrors.stableName ? INPUT_ERROR_CLASS : INPUT_CLASS}
            placeholder="Your public name shown in-game"
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.stableName}
            aria-describedby={fieldErrors.stableName ? 'reg-stable-name-error' : undefined}
            disabled={isSubmitting}
          />
          <FieldError message={fieldErrors.stableName} id="reg-stable-name-error" />
          <p className="mt-1 text-xs text-tertiary">
            This is how other players will see you. Your username stays private.
          </p>
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

export default RegistrationForm;
