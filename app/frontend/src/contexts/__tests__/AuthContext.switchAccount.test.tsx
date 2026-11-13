/**
 * AuthContext.switchAccount — token-swap account switching (Switch Account).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import { useRobotStore } from '../../stores/robotStore';
import { useStableStore } from '../../stores/stableStore';
import * as savedAccounts from '../../utils/savedAccounts';
import type { SavedAccount } from '../../utils/savedAccounts';

vi.mock('../../utils/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

const robotClear = vi.fn();
const stableClear = vi.fn();
const subscriptionClear = vi.fn();
vi.mock('../../stores/robotStore', () => ({
  useRobotStore: { getState: () => ({ clear: robotClear }) },
}));
vi.mock('../../stores/stableStore', () => ({
  useStableStore: { getState: () => ({ clear: stableClear }) },
}));
vi.mock('../../stores/subscriptionStore', () => ({
  useSubscriptionStore: { getState: () => ({ clear: subscriptionClear }) },
}));

const target: SavedAccount = {
  userId: 2,
  label: 'Steel Hawks',
  username: 'bob',
  token: 'tok-bob',
};

/** Test harness: exposes the current user and a switch trigger. */
function Harness() {
  const { user, switchAccount } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.username : 'none'}</span>
      <button
        onClick={() => {
          void switchAccount(target).catch((e: Error) => {
            const el = document.getElementById('err');
            if (el) el.textContent = e.message;
          });
        }}
      >
        switch
      </button>
      <span id="err" data-testid="err" />
    </div>
  );
}

function renderHarness() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

describe('AuthContext.switchAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The global setup mocks localStorage with bare vi.fn()s that don't store.
    // Install a working in-memory implementation for this suite so token swaps
    // are observable.
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
      },
    });
    // Default: no stored session on mount.
    vi.mocked(api.get).mockResolvedValue({} as never);
  });

  it('swaps the token, clears stores, and rehydrates the user on success', async () => {
    // Mount with no token so session restore does nothing, then make the
    // profile read for the switch succeed.
    vi.mocked(api.get).mockResolvedValue({
      id: 2,
      username: 'bob',
      email: null,
      role: 'user',
      currency: 500,
      prestige: 10,
      stableName: 'Steel Hawks',
    } as never);
    const saveSpy = vi.spyOn(savedAccounts, 'saveAccount').mockReturnValue([]);

    renderHarness();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));

    await act(async () => {
      screen.getByText('switch').click();
    });

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('bob'));
    expect(localStorage.getItem('token')).toBe('tok-bob');
    expect(robotClear).toHaveBeenCalled();
    expect(stableClear).toHaveBeenCalled();
    // The subscription overview is account-scoped and must be cleared too, or
    // B would see A's Booking Office data within the 30s TTL.
    expect(subscriptionClear).toHaveBeenCalled();
    // The switched-to account is re-saved with its fresh label/token.
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, label: 'Steel Hawks', token: 'tok-bob' }),
    );
    expect(useRobotStore.getState().clear).toBe(robotClear);
    expect(useStableStore.getState().clear).toBe(stableClear);
  });

  it('tears down the session and drops the dead account on a definitive backend 401', async () => {
    const removeSpy = vi.spyOn(savedAccounts, 'removeSavedAccount').mockReturnValue([]);
    // The switch's profile read fails with a structured backend 401.
    vi.mocked(api.get).mockRejectedValueOnce(
      new ApiError('Invalid or expired token', 'UNAUTHORIZED', 401),
    );

    renderHarness();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));

    await act(async () => {
      screen.getByText('switch').click();
    });

    // logout() clears the token; no stale user remains.
    await waitFor(() => expect(screen.getByTestId('err')).toHaveTextContent(/log in again/i));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem('token')).toBeNull();
    expect(removeSpy).toHaveBeenCalledWith(2);
  });

  it('remembers the account on a successful session restore (refreshUser path)', async () => {
    // Normal sign-in and session restore go through refreshUser, not login, so
    // refreshUser must be what populates the saved-accounts list.
    const saveSpy = vi.spyOn(savedAccounts, 'saveAccount').mockReturnValue([]);
    localStorage.setItem('token', 'tok-alice');
    vi.mocked(api.get).mockResolvedValue({
      id: 1,
      username: 'alice',
      email: null,
      role: 'user',
      currency: 100,
      prestige: 0,
      stableName: 'Iron Wolves',
    } as never);

    renderHarness();

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('alice'));
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, label: 'Iron Wolves', username: 'alice', token: 'tok-alice' }),
    );
  });

  it('keeps the saved account on a transient (non-definitive) failure', async () => {
    const removeSpy = vi.spyOn(savedAccounts, 'removeSavedAccount').mockReturnValue([]);
    // A proxy/WAF 401 (no structured backend code) or a network error does not
    // prove the token is dead, so the saved entry must survive for a retry.
    vi.mocked(api.get).mockRejectedValueOnce(
      new ApiError('Blocked', 'UNKNOWN_ERROR', 401),
    );

    renderHarness();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));

    await act(async () => {
      screen.getByText('switch').click();
    });

    await waitFor(() => expect(screen.getByTestId('err')).toHaveTextContent(/log in again/i));
    // Session is still torn down, but the saved account is NOT discarded.
    expect(localStorage.getItem('token')).toBeNull();
    expect(removeSpy).not.toHaveBeenCalled();
  });
});
