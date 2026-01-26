import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';

interface Facility {
  type: string;
  name: string;
  description: string;
  maxLevel: number;
  costs: number[];
  benefits: string[];
  currentLevel: number;
  upgradeCost: number;
  canUpgrade: boolean;
  implemented: boolean;
}

function FacilitiesPage() {
  const { user, refreshUser } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/facilities');
      setFacilities(response.data);
    } catch (err) {
      setError('Failed to load facilities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (facilityType: string) => {
    setUpgrading(facilityType);
    setError('');

    try {
      await axios.post('http://localhost:3001/api/facilities/upgrade', {
        facilityType,
      });

      // Refresh facilities and user data
      await Promise.all([fetchFacilities(), refreshUser()]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upgrade failed');
    } finally {
      setUpgrading(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Stable Facilities</h2>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="text-xl">Loading facilities...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {facilities.map((facility) => (
              <div key={facility.type} className="bg-gray-800 p-6 rounded-lg relative">
                {!facility.implemented && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-yellow-600 text-xs px-2 py-1 rounded">
                      Effect not yet implemented
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div className="pr-4">
                    <h3 className="text-2xl font-semibold mb-2">{facility.name}</h3>
                    <p className="text-gray-400 text-sm">{facility.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm text-gray-400">Level</div>
                    <div className="text-2xl font-bold">
                      {facility.currentLevel}/{facility.maxLevel}
                    </div>
                  </div>
                </div>

                {facility.currentLevel > 0 && (
                  <div className="mb-4 p-3 bg-gray-700 rounded">
                    <div className="text-sm text-gray-400 mb-1">Current Benefit:</div>
                    <div className="text-green-400">
                      {facility.benefits[facility.currentLevel - 1]}
                    </div>
                  </div>
                )}

                {facility.canUpgrade && (
                  <>
                    <div className="mb-4 p-3 bg-gray-700/50 rounded border border-gray-600">
                      <div className="text-sm text-gray-400 mb-1">Next Level Benefit:</div>
                      <div className="text-blue-400">
                        {facility.benefits[facility.currentLevel]}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-lg">
                        Cost: <span className="text-green-400 font-semibold">
                          ₡{facility.upgradeCost.toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUpgrade(facility.type)}
                        disabled={upgrading !== null || user.currency < facility.upgradeCost}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded transition-colors"
                      >
                        {upgrading === facility.type ? 'Upgrading...' : 'Upgrade'}
                      </button>
                    </div>

                    {user.currency < facility.upgradeCost && (
                      <div className="mt-2 text-sm text-red-400">
                        Insufficient credits
                      </div>
                    )}
                  </>
                )}

                {!facility.canUpgrade && (
                  <div className="text-center py-3 bg-gray-700 rounded">
                    <span className="text-green-400 font-semibold">Maximum Level Reached</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FacilitiesPage;
