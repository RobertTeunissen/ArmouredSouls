import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { createRobot } from '../utils/robotApi';
import { ApiError } from '../utils/ApiError';
import { useRobotStore } from '../stores';
import { ERROR_NOTICE, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/robot-setup/styles';

function CreateRobotPage() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rosterFull, setRosterFull] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isOnboarding = searchParams.get('onboarding') === 'true';

  const ROBOT_CREATION_COST = 500000;

  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRosterFull(false);

    if (!name.trim()) {
      setError('Robot name is required');
      return;
    }

    if (name.length > 50) {
      setError('Robot name must be 50 characters or less');
      return;
    }

    if (currency < ROBOT_CREATION_COST) {
      setError('Insufficient credits to create robot');
      return;
    }

    setLoading(true);

    try {
      const data = await createRobot(name);

      if (!isOnboarding) {
        // PlayerShell keeps Navigation mounted while the setup route loads;
        // refresh its shared robot source before navigating so the dropdown
        // includes the robot created in this flow.
        await useRobotStore.getState().fetchRobots();
      }

      // Refresh user data to update currency
      await refreshUser();

      if (isOnboarding) {
        // During onboarding: update onboarding choices with new robot ID, then return to onboarding
        try {
          const existingState = await api.get<{ data?: { choices?: Record<string, unknown> } }>('/api/onboarding/state');
          const currentChoices = (existingState?.data?.choices ?? {}) as Record<string, unknown>;
          const robotsCreated = (currentChoices.robotsCreated as number[] | undefined) ?? [];
          await api.post('/api/onboarding/state', {
            choices: {
              ...currentChoices,
              robotsCreated: [...robotsCreated, data.robot.id],
            },
          });
        } catch {
          // Non-critical: onboarding state update failed, continue anyway
        }
        navigate('/onboarding');
      } else {
        // Normal flow: navigate to the setup wizard for the newly created robot
        navigate(`/robots/${data.robot.id}/setup`, { replace: true });
      }
    } catch (err: unknown) {
      // A 401 already ended the session in the API client.
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to create robot');
        setRosterFull(err.code === 'MAX_ROBOTS_REACHED');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create robot');
      }
    } finally {
      setLoading(false);
    }
  };

  const canAfford = currency >= ROBOT_CREATION_COST;

  return (
    <div className="min-h-screen bg-background text-white">

      <div className="container mx-auto px-4 py-6 pb-24 lg:pb-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Create New Robot</h1>

          <div className="rounded-lg border border-white/10 bg-surface p-4 sm:p-6 mb-6">
            {/* Onboarding banner */}
            {isOnboarding && (
              <div className="rounded-lg border border-info/40 bg-info/10 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0" aria-hidden="true">🎓</span>
                  <div>
                    <p className="text-info font-semibold">Tutorial: Robot Creation</p>
                    <p className="text-sm text-secondary">
                      Choose a name for your robot and confirm the purchase. Your robot will start with all attributes at Level 1.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Robot Frame Cost</h2>
              <div className="bg-surface-elevated p-4 sm:p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-secondary">Frame Cost:</span>
                  <span className="text-3xl font-bold tabular-nums text-warning">
                    ₡{ROBOT_CREATION_COST.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary">Your Balance:</span>
                  <span className={`text-2xl font-semibold tabular-nums ${canAfford ? 'text-success' : 'text-error'}`}>
                    ₡{currency.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Robot Specifications</h2>
              <div className="bg-surface-elevated p-4 sm:p-6 rounded-lg">
                <p className="text-secondary mb-2">Your new robot will come with:</p>
                <ul className="list-disc list-inside text-secondary space-y-1">
                  <li>All 23 attributes starting at Level 1</li>
                  <li>No weapon equipped: the setup after this page buys and equips one</li>
                  <li>Ready for upgrades and customization</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className={`${ERROR_NOTICE} mb-6`} role="alert">
                {error}
                {rosterFull && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => navigate('/facilities#roster_expansion')}
                      className={SECONDARY_BUTTON}
                    >
                      Go to Facilities
                    </button>
                  </div>
                )}
              </div>
            )}

            {!canAfford && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning mb-6" role="status">
                Insufficient credits! You need ₡{(ROBOT_CREATION_COST - currency).toLocaleString()} more.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="name" className="block text-sm font-semibold mb-2">
                  Robot Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter robot name (1-50 characters)"
                  className="w-full bg-surface-elevated border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary min-h-[44px]"
                  disabled={loading}
                  maxLength={50}
                  required
                />
                <p className="text-secondary text-sm mt-1">{name.length}/50 characters</p>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate(isOnboarding ? '/onboarding' : '/robots')}
                  className={`${SECONDARY_BUTTON} flex-1`}
                  disabled={loading}
                >
                  {isOnboarding ? 'Back to Tutorial' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className={`${PRIMARY_BUTTON} flex-1`}
                  disabled={!canAfford || loading}
                >
                  {loading ? 'Creating...' : `Create Robot (₡${ROBOT_CREATION_COST.toLocaleString()})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateRobotPage;
