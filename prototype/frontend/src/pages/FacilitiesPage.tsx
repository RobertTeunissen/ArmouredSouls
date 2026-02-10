import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import FacilityIcon from '../components/FacilityIcon';

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
  nextLevelPrestigeRequired?: number;
  hasPrestige?: boolean;
  canAfford?: boolean;
}

// Facility category definitions
interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  facilityTypes: string[];
}

const FACILITY_CATEGORIES: CategoryInfo[] = [
  {
    id: 'economy',
    name: 'Economy & Discounts',
    icon: '💰',
    description: 'Reduce operational costs and unlock passive income',
    facilityTypes: ['training_facility', 'weapons_workshop', 'repair_bay', 'income_generator']
  },
  {
    id: 'capacity',
    name: 'Capacity & Storage',
    icon: '📦',
    description: 'Expand stable capacity for robots and weapons',
    facilityTypes: ['roster_expansion', 'storage_facility']
  },
  {
    id: 'training',
    name: 'Training Academies',
    icon: '🎓',
    description: 'Increase attribute caps for robot development',
    facilityTypes: ['combat_training_academy', 'defense_training_academy', 'mobility_training_academy', 'ai_training_academy']
  },
  {
    id: 'advanced',
    name: 'Advanced Features',
    icon: '⭐',
    description: 'Unlock special features and advanced gameplay mechanics',
    facilityTypes: ['research_lab', 'medical_bay', 'coaching_staff', 'booking_office']
  }
];

function FacilitiesPage() {
  const { user, refreshUser } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [userPrestige, setUserPrestige] = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(['advanced']) // Advanced Features collapsed by default
  );

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/facilities');
      setFacilities(response.data.facilities || response.data);
      setUserPrestige(response.data.userPrestige || 0);
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
      if (err.response?.status === 403) {
        const { current, message } = err.response.data;
        setError(`${message}. You have ${current?.toLocaleString()} prestige.`);
      } else {
        setError(err.response?.data?.error || 'Upgrade failed');
      }
    } finally {
      setUpgrading(null);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const getCategoryFacilities = (categoryTypes: string[]) => {
    return facilities.filter(f => categoryTypes.includes(f.type));
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
          <div className="space-y-8">
            {FACILITY_CATEGORIES.map((category) => {
              const isCollapsed = collapsedCategories.has(category.id);
              const categoryFacilities = getCategoryFacilities(category.facilityTypes);

              return (
                <div key={category.id} className="space-y-4">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">{category.icon}</span>
                        <div>
                          <h3 className="text-xl font-semibold">{category.name}</h3>
                          <p className="text-sm text-gray-400 mt-1">{category.description}</p>
                        </div>
                      </div>
                      <span className="text-2xl text-gray-400">
                        {isCollapsed ? '▼' : '▲'}
                      </span>
                    </div>
                  </button>

                  {/* Category Facilities */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {categoryFacilities.map((facility) => (
                        <div 
                          key={facility.type} 
                          className={`bg-gray-800 p-6 rounded-lg relative ${
                            facility.implemented 
                              ? 'border border-green-700/30' 
                              : 'border border-yellow-600/50 opacity-90'
                          }`}
                        >
                          {/* Implementation Status Badge */}
                          {!facility.implemented && (
                            <div className="absolute top-4 right-4">
                              <span className="text-xs px-2 py-1 rounded bg-yellow-600 text-yellow-100">
                                ⚠ Coming Soon
                              </span>
                            </div>
                          )}

                          <div className="flex items-start mb-4">
                            {/* Facility Icon */}
                            <div className="mr-4 mt-1 flex-shrink-0">
                              <FacilityIcon 
                                facilityType={facility.type}
                                facilityName={facility.name}
                                size="medium"
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className="text-2xl font-semibold mb-2">{facility.name}</h3>
                              <p className="text-gray-400 text-sm">{facility.description}</p>
                            </div>
                          </div>

                          {/* Level Display with Progress Bar */}
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-400">Level Progress</span>
                              <span className="text-lg font-bold">
                                {facility.currentLevel}/{facility.maxLevel}
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${(facility.currentLevel / facility.maxLevel) * 100}%` }}
                              />
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

                          {facility.canUpgrade && facility.implemented && (
                            <>
                              <div className="mb-4 p-3 bg-gray-700/50 rounded border border-gray-600">
                                <div className="text-sm text-gray-400 mb-1">Next Level Benefit:</div>
                                <div className="text-blue-400">
                                  {facility.benefits[facility.currentLevel]}
                                </div>
                              </div>

                              {/* Prestige Requirement Display */}
                              {facility.nextLevelPrestigeRequired && facility.nextLevelPrestigeRequired > 0 && (
                                <div className={`mb-4 p-3 rounded border ${
                                  facility.hasPrestige 
                                    ? 'bg-green-900/20 border-green-700/50' 
                                    : 'bg-red-900/20 border-red-700/50'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      <span className="text-gray-400">Prestige Required: </span>
                                      <span className={facility.hasPrestige ? 'text-green-400' : 'text-red-400'}>
                                        {facility.nextLevelPrestigeRequired.toLocaleString()}
                                      </span>
                                    </div>
                                    <span className="text-xl">
                                      {facility.hasPrestige ? '✓' : '🔒'}
                                    </span>
                                  </div>
                                  {!facility.hasPrestige && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      Current: {userPrestige.toLocaleString()} prestige
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="flex justify-between items-center">
                                <div className="text-lg">
                                  Cost: <span className="text-green-400 font-semibold">
                                    ₡{facility.upgradeCost.toLocaleString()}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleUpgrade(facility.type)}
                                  disabled={
                                    upgrading !== null || 
                                    (user.currency < facility.upgradeCost) ||
                                    !!(facility.nextLevelPrestigeRequired && !facility.hasPrestige)
                                  }
                                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded transition-colors"
                                  title={
                                    facility.nextLevelPrestigeRequired && !facility.hasPrestige
                                      ? `Requires ${facility.nextLevelPrestigeRequired.toLocaleString()} prestige`
                                      : undefined
                                  }
                                >
                                  {upgrading === facility.type ? 'Upgrading...' : 'Upgrade'}
                                </button>
                              </div>

                              {user.currency < facility.upgradeCost && (
                                <div className="mt-2 text-sm text-red-400">
                                  Insufficient credits
                                </div>
                              )}
                              {facility.nextLevelPrestigeRequired && !facility.hasPrestige && (
                                <div className="mt-2 text-sm text-red-400">
                                  Insufficient prestige (need {facility.nextLevelPrestigeRequired.toLocaleString()})
                                </div>
                              )}
                            </>
                          )}

                          {facility.canUpgrade && !facility.implemented && (
                            <div className="text-center py-3 bg-gray-700/50 rounded border border-yellow-600/50">
                              <span className="text-yellow-400 font-semibold">Coming Soon</span>
                            </div>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FacilitiesPage;
