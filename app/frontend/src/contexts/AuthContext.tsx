import { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { api } from '../utils/api';
import { ApiError } from '../utils/ApiError';
import { createLogger } from '../utils/logger';
import { useRobotStore } from '../stores/robotStore';
import { useStableStore } from '../stores/stableStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import {
  saveAccount,
  removeSavedAccount,
  type SavedAccount,
} from '../utils/savedAccounts';

const log = createLogger('AuthContext');

/**
 * Represents an authenticated user's profile data.
 * @property id - Unique numeric identifier for the user
 * @property username - The user's chosen display name
 * @property email - The user's email address, or null for legacy accounts
 * @property role - The user's role (e.g. 'player', 'admin')
 * @property currency - The user's in-game currency balance
 * @property prestige - The user's prestige score
 * @property stableName - Optional name of the user's stable
 */
interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  currency: number;
  prestige: number;
  stableName?: string | null;
  stableNote?: string | null;
}

/**
 * Shape of the authentication context value provided to consumers.
 * @property user - The currently authenticated user, or null if not logged in
 * @property token - The current JWT token, or null if not authenticated
 * @property login - Authenticates a user with an identifier (username or email) and password
 * @property logout - Clears authentication state and removes the stored token
 * @property loading - Whether an authentication operation is in progress
 * @property refreshUser - Re-fetches the current user's profile from the server
 */
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: (options?: { keepSavedAccount?: boolean }) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
  /**
   * Switch to a previously-saved account by swapping in its token and
   * rehydrating state. Resolves when the switch succeeds. Rejects (and leaves
   * no stale session) when the saved token is expired or revoked — the caller
   * should then send the player to the login form for that account.
   */
  switchAccount: (account: SavedAccount) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Custom hook to access the authentication context.
 * Must be used within an {@link AuthProvider} component tree.
 *
 * @returns The current authentication context value
 * @throws {Error} If called outside of an AuthProvider
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { user, logout } = useAuth();
 *   return <p>Welcome, {user?.username}! <button onClick={logout}>Logout</button></p>;
 * }
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/**
 * Props for the {@link AuthProvider} component.
 * @property children - Child components that will have access to the auth context
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides authentication state and actions to the component tree.
 *
 * Manages user session state including the JWT token (persisted in localStorage),
 * user profile data, and loading status. On mount, it attempts to restore a
 * previous session by reading the token from localStorage and fetching the
 * user profile.
 *
 * State:
 * - `user` — The authenticated user's profile, or null
 * - `token` — The JWT token string, or null
 * - `loading` — True while the initial session restore or a login request is in progress
 *
 * @param props - Component props
 * @param props.children - Child components to wrap with the auth context
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  // Initialize token from localStorage so the app can attempt session
  // restoration on mount without requiring a fresh login.
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Monotonic session id. Bumped on every logout and account switch so a
  // profile/robot/stable request started under an earlier session can tell it
  // has been superseded and drop its result instead of committing another
  // account's data. Guards against stale success, failure, and cleanup
  // callbacks after switching or logging out.
  const sessionGeneration = useRef(0);

  /** Reset every account-scoped Zustand store so no data bleeds across sessions. */
  const clearSessionStores = () => {
    useRobotStore.getState().clear();
    useStableStore.getState().clear();
    // The subscription overview is account-scoped and has a 30s TTL plus a
    // shared in-flight promise; a plain invalidate would let that promise
    // repopulate it with the previous account's data, so clear it fully.
    useSubscriptionStore.getState().clear();
  };

  /**
   * Clears all authentication state and removes the JWT token from localStorage.
   *
   * By default this also forgets the account's saved switch credential — an
   * explicit Logout should not leave a reusable bearer token behind for the next
   * person at the browser. The "Add account" flow, which only detaches the
   * current session to sign into another stable, passes `keepSavedAccount` so
   * the player can still switch back.
   */
  const logout = (options?: { keepSavedAccount?: boolean }) => {
    // Supersede any in-flight account-scoped request.
    sessionGeneration.current += 1;

    const loggingOut = user;
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    clearSessionStores();

    if (!options?.keepSavedAccount && loggingOut) {
      try {
        removeSavedAccount(loggingOut.id);
      } catch {
        /* storage failure here is non-fatal */
      }
    }
  };

  /**
   * Persist an account to the saved-accounts list for one-tap switching.
   * Best-effort: a storage failure is swallowed so it never breaks auth.
   */
  const rememberAccount = (account: User, accountToken: string) => {
    try {
      saveAccount({
        userId: account.id,
        label: account.stableName || account.username,
        username: account.username,
        token: accountToken,
      });
    } catch (error) {
      log.warn('Could not save account for switching', { error });
    }
  };

  /**
   * True only for a definitive backend authentication rejection: a 401 whose
   * body carried our structured error contract. A 401 with `UNKNOWN_ERROR`
   * comes from a proxy/WAF/DDoS layer with a non-JSON body and does NOT prove
   * the token is invalid, so it must not end a session or discard a saved
   * account. Mirrors the check `refreshUser` has always used.
   */
  const isDefinitiveAuthRejection = (error: unknown): boolean =>
    error instanceof ApiError && error.statusCode === 401 && error.code !== 'UNKNOWN_ERROR';

  /**
   * Fetches the current user's profile from the server using the stored token.
   * If no token is present or the request fails, the user is logged out.
   */
  const refreshUser = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      setLoading(false);
      return;
    }

    // Snapshot the session this request belongs to. If a logout or switch bumps
    // the generation while the request is in flight, its result is stale and
    // must not overwrite the now-active session.
    const generation = sessionGeneration.current;
    const isStale = () => sessionGeneration.current !== generation;

    try {
      const userData = await api.get<User>('/api/user/profile');
      if (isStale()) return;
      setUser(userData);
      // Remember the account so Switch Account has a target. This runs here (not
      // only in `login`) because normal sign-in and session restore go through
      // `refreshUser` via FrontPage, bypassing `login` entirely.
      rememberAccount(userData, currentToken);
    } catch (error) {
      if (isStale()) return;
      // Only logout on definitive auth failures from our own backend, which
      // always answers a bad token with 401 (a 403 is a permission answer).
      // Proxy/WAF/DDoS layers may return 401 with non-JSON bodies; those
      // arrive here as `ApiError` with `code === 'UNKNOWN_ERROR'` (the typed
      // wrapper falls back to that when the response body lacks a `code`
      // field). They should NOT destroy the session since the token may
      // still be valid.
      if (error instanceof ApiError && error.statusCode === 401) {
        const isBackendAuthError = error.code !== 'UNKNOWN_ERROR';

        if (isBackendAuthError) {
          log.error('Auth token rejected by backend, logging out', { error });
          logout();
        } else {
          log.warn(
            'Non-backend 401 during profile fetch (possible proxy/WAF block), keeping session',
            { error },
          );
        }
      } else {
        log.warn('Failed to fetch user profile (keeping session)', { error });
      }
    } finally {
      // A superseded refresh must not clear the loading state the active
      // session may have set (e.g. a switch in progress).
      if (!isStale()) setLoading(false);
    }
  };

  // Restore session on mount: if a token exists in localStorage, fetch the
  // user profile to rehydrate auth state. This avoids forcing a re-login
  // on page refresh while the token is still valid.
  useEffect(() => {
    const initAuth = async () => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        setToken(currentToken);
        await refreshUser();
      } else {
        setLoading(false);
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Authenticates a user by sending credentials to the login endpoint.
   * On success, stores the JWT token in localStorage and updates context state.
   *
   * @param identifier - The user's username or email address
   * @param password - The user's password
   * @throws {Error} With the server error message on authentication failure,
   *   or a generic 'Login failed' message on network errors
   */
  const login = async (identifier: string, password: string) => {
    try {
      const { token: newToken, user: userData } = await api.post<{
        token: string;
        user: User;
      }>('/api/auth/login', { identifier, password });

      // Persist token to localStorage before updating React state so that
      // any API calls triggered by re-renders already have the token available.
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      setLoading(false);

      // Remember this account so the player can switch back to it later. The
      // login response carries no stableName, so the label falls back to the
      // username here; a later refreshUser upgrades the label if a stable name
      // is set. Best-effort — a storage failure must not break login.
      rememberAccount(userData, newToken);
    } catch (error) {
      // Re-throw as a plain Error so LoginForm's existing UI logic keeps
      // working (it expects `error.message`, not the structured ApiError
      // shape). The original message — typically the server's
      // 'Invalid credentials' string — is preserved.
      if (error instanceof ApiError) {
        throw new Error(error.message || 'Login failed', { cause: error });
      }
      throw new Error('Login failed', { cause: error });
    }
  };

  /**
   * Switch to a saved account. The model is a scripted token swap, not a
   * server-side session change: there is one active token in localStorage, so a
   * switch clears the outgoing session's cached data, installs the saved token,
   * and re-reads the profile.
   *
   * A blocking loading state is entered BEFORE the token is swapped and released
   * only when the switch settles. While `loading` is true `ProtectedRoute`
   * unmounts the outgoing page, so the previous account's screen cannot stay
   * interactive against the new account's credentials (e.g. saving A's edited
   * note while the token is already B's).
   *
   * On failure (the saved token is expired or `tokenVersion`-revoked, so
   * `/api/user/profile` answers a definitive 401), the half-applied session is
   * torn down with `logout()`, the dead entry is dropped, and the error is
   * re-thrown so the caller can route the player to the login form. A
   * non-definitive failure (network/proxy) keeps the saved entry so a transient
   * outage does not force re-entering the password.
   */
  const switchAccount = async (account: SavedAccount) => {
    // New session: supersede any in-flight request from the outgoing account so
    // a late-completing refresh/robot/stable fetch cannot commit A's data over B.
    sessionGeneration.current += 1;
    const generation = sessionGeneration.current;
    const isStale = () => sessionGeneration.current !== generation;

    // Block the UI for the transition and clear the outgoing session's cached
    // store data (robots, stable, subscriptions) to prevent cross-account bleed.
    setLoading(true);
    clearSessionStores();

    // Install the saved token as the active one, then rehydrate from the server.
    localStorage.setItem('token', account.token);
    setToken(account.token);

    try {
      const userData = await api.get<User>('/api/user/profile');
      // A newer switch/logout started while this was in flight: abandon.
      if (isStale()) return;
      setUser(userData);
      setToken(account.token);
      // Refresh the saved entry with the latest token and label (the stable name
      // may have changed since it was last saved).
      rememberAccount(userData, account.token);
    } catch (error) {
      if (isStale()) throw error;
      // Tear the session down so nothing stale is left, then decide whether the
      // saved entry is dead. Only a definitive backend 401 proves the token is
      // invalid; a network/proxy failure keeps the entry for a retry.
      log.warn('Saved account switch failed; falling back to login', { userId: account.userId });
      logout();
      if (isDefinitiveAuthRejection(error)) {
        try {
          removeSavedAccount(account.userId);
        } catch {
          /* storage failure here is non-fatal */
        }
      }
      throw error instanceof ApiError
        ? new Error('Could not switch to that account. Please log in again.', { cause: error })
        : new Error('Could not switch account. Please log in again.', { cause: error });
    } finally {
      if (!isStale()) setLoading(false);
    }
  };
  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshUser, switchAccount }}>
      {children}
    </AuthContext.Provider>
  );
};
