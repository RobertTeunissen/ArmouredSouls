import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RegistrationForm from '../components/RegistrationForm';
import LoginForm from '../components/LoginForm';
import type { UserProfile } from '../components/RegistrationForm';
import logoD from '../assets/logos/logo-d.svg';

/** The two possible authentication views on the front page. */
type View = 'register' | 'login';

/**
 * Front page component that serves as the main authentication landing page.
 *
 * Displays the application branding and a tabbed interface for switching between
 * the login and registration forms. After a successful login or registration,
 * stores the JWT token in localStorage, refreshes the auth context, and
 * navigates to the dashboard.
 *
 * State:
 * - `view` — The currently active tab: `'login'` or `'register'`
 *
 * Uses {@link useAuth} to access `refreshUser` for updating the auth context
 * after authentication, and `useNavigate` for client-side routing.
 *
 * @example
 * ```tsx
 * // Typically rendered as a route:
 * <Route path="/" element={<FrontPage />} />
 * ```
 */
function FrontPage() {
  const [view, setView] = useState<View>('login');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  /**
   * Shared success handler for both login and registration forms.
   * Stores the JWT token, refreshes the user profile in AuthContext,
   * and navigates to the dashboard.
   * @param token - The JWT token returned by the API
   * @param _user - The user profile (unused; profile is refreshed from the server)
   */
  const handleSuccess = async (token: string, _user: UserProfile) => {
    // Persist token first so subsequent API calls (including refreshUser)
    // include it in the Authorization header.
    localStorage.setItem('token', token);
    // Refresh from server rather than using the _user param directly, so
    // AuthContext always holds the canonical server-side profile data.
    await refreshUser();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background text-primary flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src={logoD}
            alt="Armoured Souls"
            className="w-20 h-20 mx-auto mb-6 animate-fade-in"
          />
          <h1 className="text-4xl font-bold font-header tracking-tight animate-fade-in">
            ARMOURED SOULS
          </h1>
        </div>

        <div className="bg-surface-elevated border border-white/10 p-8 rounded-xl shadow-2xl animate-fade-in-delayed">
          <nav className="flex mb-6 border-b border-tertiary" aria-label="Authentication">
            <button
              type="button"
              onClick={() => setView('login')}
              className={`flex-1 pb-3 text-center font-medium transition-colors duration-150 ${
                view === 'login'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-tertiary hover:text-secondary'
              }`}
              aria-selected={view === 'login'}
              role="tab"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setView('register')}
              className={`flex-1 pb-3 text-center font-medium transition-colors duration-150 ${
                view === 'register'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-tertiary hover:text-secondary'
              }`}
              aria-selected={view === 'register'}
              role="tab"
            >
              Register
            </button>
          </nav>

          {view === 'login' && <LoginForm onSuccess={handleSuccess} />}
          {view === 'register' && <RegistrationForm onSuccess={handleSuccess} />}
        </div>
      </div>
    </div>
  );
}

export default FrontPage;
