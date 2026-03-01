import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { isAxiosError } from 'axios';
import apiClient from '../utils/apiClient';

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
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
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

  /**
   * Clears all authentication state and removes the JWT token from localStorage.
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

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

    try {
      const response = await apiClient.get('/api/user/profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // If the profile fetch fails (expired/invalid token, server error),
      // clear auth state so the user is redirected to the login page
      // rather than stuck in a broken authenticated state.
      logout();
    } finally {
      setLoading(false);
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
      const response = await apiClient.post('/api/auth/login', {
        identifier,
        password,
      });

      const { token: newToken, user: userData } = response.data;
      
      // Persist token to localStorage before updating React state so that
      // any API calls triggered by re-renders already have the token available.
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      setLoading(false);
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Login failed');
      }
      throw new Error('Login failed');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
