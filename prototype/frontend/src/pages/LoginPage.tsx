import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import logoD from '../assets/logos/logo-d.svg';

// Shared input field styling that follows design system
const INPUT_CLASS = 
  'w-full px-4 py-3 bg-surface border border-tertiary rounded-lg ' +
  'text-primary placeholder-tertiary ' +
  'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 ' +
  'disabled:bg-background disabled:border-tertiary/50 disabled:opacity-60 ' +
  'transition-all duration-150 ease-out';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
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
                htmlFor="username" 
                className="block text-sm font-medium text-secondary mb-2"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Enter your username"
                required
                aria-required="true"
                aria-invalid={!!error}
                disabled={loading}
              />
            </div>

            <div className="mb-6">
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-secondary mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
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
      </div>
    </div>
  );
}

export default LoginPage;
