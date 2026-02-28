import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import apiClient from '../utils/apiClient';

function CreateRobotPage() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const ROBOT_CREATION_COST = 500000;

  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      const response = await apiClient.post('/api/robots', { name });

      const data = response.data;

      // Refresh user data to update currency
      await refreshUser();

      // Navigate to the newly created robot
      navigate(`/robots/${data.robot.id}`);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      setError(err.response?.data?.error || err.message || 'Failed to create robot');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canAfford = currency >= ROBOT_CREATION_COST;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Create New Robot</h2>

          <div className="bg-gray-800 p-8 rounded-lg mb-6">
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-4">Robot Frame Cost</h3>
              <div className="bg-gray-700 p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-400">Frame Cost:</span>
                  <span className="text-3xl font-bold text-yellow-400">
                    ₡{ROBOT_CREATION_COST.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Your Balance:</span>
                  <span className={`text-2xl font-semibold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                    ₡{currency.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-4">Robot Specifications</h3>
              <div className="bg-gray-700 p-6 rounded-lg">
                <p className="text-gray-300 mb-2">Your new robot will come with:</p>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
                  <li>All 23 attributes starting at Level 1</li>
                  <li>No weapon equipped (can be added later)</li>
                  <li>Ready for upgrades and customization</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            {!canAfford && (
              <div className="bg-yellow-900 border border-yellow-700 text-yellow-200 px-4 py-3 rounded mb-6">
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
                  className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  disabled={loading}
                  maxLength={50}
                  required
                />
                <p className="text-gray-400 text-sm mt-1">{name.length}/50 characters</p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/robots')}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg transition-colors font-semibold"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-6 py-3 rounded-lg transition-colors font-semibold ${
                    canAfford && !loading
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
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
