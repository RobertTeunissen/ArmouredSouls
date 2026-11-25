/**
 * Shape rules for account fields (username, email, passwords, stable name).
 * The backend enforces them; the registration and profile forms check them
 * before submitting, with the same wording. Each function returns every
 * failed rule's message, in order; an empty list means valid.
 *
 * Content rules (profanity, uniqueness) stay on the backend.
 */

/** Usernames: 3–20 characters, letters, digits, `_` and `-`. */
export function usernameErrors(username: string): string[] {
  const errors: string[] = [];
  if (username.length < 3) errors.push('Username must be at least 3 characters long');
  if (username.length > 20) errors.push('Username must not exceed 20 characters');
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  return errors;
}

/** Emails: 3–50 characters from `[a-zA-Z0-9._@-]`, one `@` with text on both sides. */
export function emailErrors(email: string): string[] {
  if (email.length < 3) return ['Email must be at least 3 characters long'];
  if (email.length > 50) return ['Email must not exceed 50 characters'];
  if (!/^[a-zA-Z0-9._@-]+$/.test(email)) return ['Email contains invalid characters'];
  if (!/^[^@]+@[^@]+$/.test(email)) return ['Email must contain exactly one @ symbol with text on both sides'];
  return [];
}

/** Registration passwords: 8–128 characters, any characters. */
export function registrationPasswordErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters long');
  if (password.length > 128) errors.push('Password must not exceed 128 characters');
  return errors;
}

/** A new password set on the Profile page: 8+ characters with an uppercase letter, a lowercase letter and a digit. */
export function newPasswordErrors(password: string): string[] {
  if (password.length < 8) return ['Password must be at least 8 characters'];
  if (!/[A-Z]/.test(password)) return ['Password must contain at least one uppercase letter'];
  if (!/[a-z]/.test(password)) return ['Password must contain at least one lowercase letter'];
  if (!/[0-9]/.test(password)) return ['Password must contain at least one number'];
  return [];
}

/** Stable names: 3–30 characters, letters, digits, spaces, `_` and `-`. */
export function stableNameErrors(name: string): string[] {
  if (name.length < 3) return ['Stable name must be at least 3 characters'];
  if (name.length > 30) return ['Stable name must be 30 characters or less'];
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    return ['Stable name can only contain letters, numbers, spaces, hyphens, and underscores'];
  }
  return [];
}

/** Characters allowed in robot names, team names and weapon custom names (the `safeName` primitive). */
export const SAFE_NAME_PATTERN = /^[a-zA-Z0-9 _\-'.!]+$/;

/** Longest robot, team or custom weapon name. */
export const SAFE_NAME_MAX_LENGTH = 50;
