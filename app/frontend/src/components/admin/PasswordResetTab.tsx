/**
 * PasswordResetTab — Admin tab for searching users and resetting their passwords.
 *
 * Self-contained component with local useState. Calls:
 * - GET /api/admin/users/search?q=... for user lookup
 * - POST /api/admin/users/:id/reset-password for password reset
 *
 * Password validation replicates the same rules as RegistrationForm.tsx
 * (8+ chars, uppercase, lowercase, number) — inline, following the existing
 * frontend pattern where no shared validation module exists.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import apiClient from '../../utils/apiClient';

interface SearchUser {
  id: number;
  username: string;
  email: string;
  stableName: string | null;
}

interface SearchResponse {
  users: SearchUser[];
}

/* ------------------------------------------------------------------ */
/*  Password validation — same rules as backend validatePassword()     */
/* ------------------------------------------------------------------ */

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return undefined;
}

export function PasswordResetTab(): JSX.Element {
  /* ---------- Search state ---------- */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /* ---------- Selected user + form state ---------- */
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ---------- Search handler ---------- */
  const handleSearch = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setSelectedUser(null);
    setSuccessMessage(null);
    setSubmitError(null);

    try {
      const response = await apiClient.get<SearchResponse>('/api/admin/users/search', {
        params: { q: trimmed },
      });
      setSearchResults(response.data.users);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setSearchError(message || 'Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  /* ---------- User selection ---------- */
  const handleSelectUser = (user: SearchUser): void => {
    setSelectedUser(user);
    setPassword('');
    setConfirmPassword('');
    setPasswordError(undefined);
    setConfirmError(undefined);
    setSuccessMessage(null);
    setSubmitError(null);
  };

  /* ---------- Form submission ---------- */
  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedUser) return;

    // Client-side validation
    const pwErr = validatePassword(password);
    setPasswordError(pwErr);

    const cfErr = password !== confirmPassword ? 'Passwords do not match' : undefined;
    setConfirmError(cfErr);

    if (pwErr || cfErr) return;

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await apiClient.post(`/api/admin/users/${selectedUser.id}/reset-password`, {
        password,
      });
      setSuccessMessage(`Password successfully reset for ${selectedUser.username}`);
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setSubmitError(message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Render ---------- */
  return (
    <div data-testid="password-reset-tab" className="space-y-6">
      {/* User Search Section */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">🔑 Password Reset</h2>
        <form onSubmit={handleSearch} className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, email, or user ID"
              className="w-full bg-surface-elevated text-white px-4 py-2 rounded min-h-[44px]"
              aria-label="Search users"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated disabled:text-secondary px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Search error */}
        {searchError && (
          <p className="mt-3 text-error text-sm">{searchError}</p>
        )}

        {/* Search results */}
        {searchResults !== null && searchResults.length === 0 && (
          <p className="mt-4 text-secondary text-sm">No users found</p>
        )}

        {searchResults !== null && searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className={`w-full text-left px-4 py-3 rounded transition-colors ${
                  selectedUser?.id === user.id
                    ? 'bg-primary/20 border border-primary'
                    : 'bg-surface-elevated hover:bg-surface-elevated/80'
                }`}
              >
                <span className="font-semibold">{user.username}</span>
                {user.stableName && (
                  <span className="text-secondary ml-2">({user.stableName})</span>
                )}
                <span className="text-secondary ml-2">· {user.email}</span>
                <span className="text-tertiary ml-2">· ID: {user.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Password Reset Form — visible after selecting a user */}
      {selectedUser && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Reset Password</h3>

          {/* Selected user details */}
          <div className="bg-surface-elevated rounded p-4 mb-4 text-sm">
            <p><span className="text-secondary">User ID:</span> {selectedUser.id}</p>
            <p><span className="text-secondary">Username:</span> {selectedUser.username}</p>
            {selectedUser.stableName && (
              <p><span className="text-secondary">Stable Name:</span> {selectedUser.stableName}</p>
            )}
          </div>

          {/* Success message */}
          {successMessage && (
            <div className="bg-green-900/30 border border-green-700 rounded p-3 mb-4 text-success text-sm">
              {successMessage}
            </div>
          )}

          {/* Error message */}
          {submitError && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4 text-error text-sm">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Password field */}
            <div>
              <label htmlFor="reset-password" className="block text-sm text-secondary mb-1">
                New Password
              </label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(undefined);
                }}
                className="w-full bg-surface-elevated text-white px-4 py-2 rounded min-h-[44px]"
                aria-describedby={passwordError ? 'password-error' : undefined}
              />
              {passwordError && (
                <p id="password-error" className="mt-1 text-error text-sm">{passwordError}</p>
              )}
            </div>

            {/* Confirm password field */}
            <div>
              <label htmlFor="reset-confirm-password" className="block text-sm text-secondary mb-1">
                Confirm Password
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmError(undefined);
                }}
                className="w-full bg-surface-elevated text-white px-4 py-2 rounded min-h-[44px]"
                aria-describedby={confirmError ? 'confirm-error' : undefined}
              />
              {confirmError && (
                <p id="confirm-error" className="mt-1 text-error text-sm">{confirmError}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated disabled:text-secondary px-6 py-2 rounded font-semibold transition-colors min-h-[44px]"
            >
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
