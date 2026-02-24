import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Navigation from '../components/Navigation';
import FacilityIcon from '../components/FacilityIcon';

type TabType = 'facilities' | 'investments' | 'advisor';

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
  currentOperatingCost?: number;
  nextOperatingCost?: number;
}

interface FacilityROI {
  facilityType: string;
  currentLevel: number;
  totalInvestment: number;
  totalReturns: number;
  totalOperatingCosts: number;
  netROI: number;
  breakevenCycle: number | null;
  cyclesSincePurchase: number;
  isProfitable: boolean;
}

interface FacilityRecommendation {
  facilityType: string;
  facilityName: string;
  currentLevel: number;
  recommendedLevel: number;
  upgradeCost: number;
  projectedROI: number;
  projectedPayoffCycles: number | null;
  reason: string;
  priority: string;
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
    facilityTypes: ['training_facility', 'weapons_workshop', 'repair_bay', 'merchandising_hub', 'streaming_studio']
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
  const [activeTab, setActiveTab] = useState<TabType>('facilities');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [userPrestige, setUserPrestige] = useState(0);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(['advanced']) // Advanced Features collapsed by default
  );
  
  // Advisor tab state
  const [lastNCycles, setLastNCycles] = useState(10);
  const [facilityROIs, setFacilityROIs] = useState<FacilityROI[]>([]);
  const [recommendations, setRecommendations] = useState<FacilityRecommendation[]>([]);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [currentCycle, setCurrentCycle] = useState<number>(0);

  useEffect(() => {
    fetchFacilities();
  }, []);

  useEffect(() => {
    if ((activeTab === 'advisor' || activeTab === 'investments') && user) {
      fetchAdvisorData();
    }
  }, [activeTab, user, lastNCycles]);

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

  const fetchAdvisorData = async () => {
    if (!user) return;

    try {
      setAdvisorLoading(true);

      // Fetch current cycle
      let fetchedCurrentCycle = 0;
      try {
        const cycleResponse = await fetch('http://localhost:3001/api/analytics/cycle/current');
        if (cycleResponse.ok) {
          const cycleData = await cycleResponse.json();
          fetchedCurrentCycle = cycleData.cycleNumber;
          setCurrentCycle(fetchedCurrentCycle);
        }
      } catch (err) {
        console.error('Error fetching current cycle:', err);
      }

      // Fetch ROI data for all Economy & Discounts facilities
      const facilityTypes = ['merchandising_hub', 'streaming_studio', 'repair_bay', 'training_facility', 'weapons_workshop'];
      const roiPromises = facilityTypes.map(async (type) => {
        try {
          const response = await fetch(`http://localhost:3001/api/analytics/facility/${user.id}/roi?facilityType=${type}`);
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (err) {
          console.error(`Error fetching ROI for ${type}:`, err);
          return null;
        }
      });

      const roiData = (await Promise.all(roiPromises)).filter(Boolean);
      setFacilityROIs(roiData);

      // Fetch recommendations
      try {
        const recResponse = await fetch(
          `http://localhost:3001/api/analytics/facility/${user.id}/recommendations?lastNCycles=${lastNCycles}`
        );
        if (recResponse.ok) {
          const recData = await recResponse.json();
          setRecommendations(recData.recommendations || []);
        } else {
          setRecommendations([]);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setRecommendations([]);
      }
    } catch (err) {
      console.error('Error in fetchAdvisorData:', err);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const getFacilityDisplayName = (type: string): string => {
    const names: Record<string, string> = {
      merchandising_hub: 'Merchandising Hub',
      streaming_studio: 'Streaming Studio',
      repair_bay: 'Repair Bay',
      training_facility: 'Training Facility',
      weapons_workshop: 'Weapons Workshop',
    };
    return names[type] || type;
  };

  const getROIColor = (roiPercentage: number): string => {
    if (roiPercentage >= 50) return 'text-green-400';
    if (roiPercentage >= 20) return 'text-blue-400';
    if (roiPercentage >= 0) return 'text-yellow-400';
    return 'text-red-400';
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

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('facilities')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'facilities'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }
                `}
              >
                Facilities & Upgrades
              </button>
              <button
                onClick={() => setActiveTab('investments')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'investments'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }
                `}
              >
                Investments & ROI
              </button>
              <button
                onClick={() => setActiveTab('advisor')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'advisor'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                  }
                `}
              >
                Investment Advisor
              </button>
            </nav>
          </div>
        </div>

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
          <>
            {/* Facilities Tab */}
            {activeTab === 'facilities' && (
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
                                {facility.currentBenefit || facility.benefits[facility.currentLevel - 1]}
                              </div>
                              {facility.currentOperatingCost !== undefined && facility.currentOperatingCost > 0 && (
                                <div className="text-xs text-gray-400 mt-2">
                                  Operating Cost: <span className="text-red-400">₡{facility.currentOperatingCost.toLocaleString()}/day</span>
                                </div>
                              )}
                            </div>
                          )}

                          {facility.canUpgrade && facility.implemented && (
                            <>
                              <div className="mb-4 p-3 bg-gray-700/50 rounded border border-gray-600">
                                <div className="text-sm text-gray-400 mb-1">Next Level Benefit:</div>
                                <div className="text-blue-400">
                                  {facility.nextBenefit || facility.benefits[facility.currentLevel]}
                                </div>
                                {facility.nextOperatingCost !== undefined && facility.nextOperatingCost > 0 && (
                                  <div className="text-xs text-gray-400 mt-2">
                                    Operating Cost: <span className="text-red-400">₡{facility.nextOperatingCost.toLocaleString()}/day</span>
                                    {facility.currentOperatingCost !== undefined && facility.currentOperatingCost > 0 && (
                                      <span className="text-yellow-400 ml-2">
                                        (+₡{(facility.nextOperatingCost - facility.currentOperatingCost).toLocaleString()}/day)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Prestige Requirement Display */}
                              {!!(facility.nextLevelPrestigeRequired && facility.nextLevelPrestigeRequired > 0) && (
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
                              {!!(facility.nextLevelPrestigeRequired && !facility.hasPrestige) && (
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

            {/* Investments Tab */}
            {activeTab === 'investments' && (
              <div className="space-y-6">
                {advisorLoading ? (
                  <div className="text-center py-12">
                    <div className="text-xl">Loading facility data...</div>
                  </div>
                ) : (
                  <>
                    {/* Current Facility Performance */}
                    <div className="bg-gray-800 rounded-lg shadow p-6">
                      <h2 className="text-xl font-semibold mb-4">Current Facility Performance</h2>
                      <p className="text-gray-400 text-sm mb-6">
                        Track the return on investment (ROI) for your Economy & Discounts facilities. 
                        Only facilities that generate income or reduce costs are shown here.
                      </p>
                      {facilityROIs.length > 0 ? (
                        <div className="space-y-4">
                          {facilityROIs.map((roi, idx) => (
                            <div key={idx} className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="font-semibold text-lg">
                                    {getFacilityDisplayName(roi.facilityType)}
                                  </h3>
                                  <p className="text-sm text-gray-400">Level {roi.currentLevel}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-400">Net ROI</div>
                                  <div className={`text-2xl font-bold ${getROIColor((roi.netROI ?? 0) * 100)}`}>
                                    {((roi.netROI ?? 0) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>

                              {/* Financial Metrics - Single Row */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div className="bg-gray-700 p-2 rounded">
                                  <div className="text-xs text-gray-400">Investment</div>
                                  <div className="font-semibold">₡{(roi.totalInvestment ?? 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-red-900 p-2 rounded">
                                  <div className="text-xs text-gray-400">Operating Costs</div>
                                  <div className="font-semibold text-red-400">
                                    ₡{(roi.totalOperatingCosts ?? 0).toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-green-900 p-2 rounded">
                                  <div className="text-xs text-gray-400">Returns</div>
                                  <div className="font-semibold text-green-400">
                                    ₡{(roi.totalReturns ?? 0).toLocaleString()}
                                  </div>
                                </div>
                                <div className={`p-2 rounded ${((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)) >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
                                  <div className="text-xs text-gray-400">Net Profit</div>
                                  <div className={`font-semibold ${
                                    ((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)) >= 0 ? 'text-green-400' : 'text-red-400'
                                  }`}>
                                    ₡{((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)).toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* Breakeven and Ownership Info */}
                              <div className="flex justify-between items-center text-sm flex-wrap gap-2">
                                <div>
                                  {roi.breakevenCycle !== null && roi.breakevenCycle !== undefined ? (
                                    <>
                                      <span className="text-gray-400">Breakeven:</span>
                                      <span className="ml-2 font-semibold text-blue-400">
                                        {currentCycle > 0 && roi.breakevenCycle <= currentCycle 
                                          ? `Achieved at cycle ${roi.breakevenCycle}`
                                          : currentCycle > 0 && roi.breakevenCycle > currentCycle
                                          ? `${roi.breakevenCycle - currentCycle} cycles remaining`
                                          : `Cycle ${roi.breakevenCycle}`
                                        }
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-yellow-400">Not yet profitable</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-gray-400">Owned for:</span>
                                  <span className="ml-2 font-semibold">
                                    {roi.cyclesSincePurchase ?? 0} cycles
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-center py-8">
                          <p className="mb-2">No facility data available yet.</p>
                          <p className="text-sm">Purchase Economy & Discounts facilities to see ROI analysis.</p>
                        </div>
                      )}
                    </div>

                    {/* What is ROI? */}
                    <div className="bg-blue-900/20 border border-blue-700/50 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold text-blue-400 mb-3 flex items-center">
                        <span className="mr-2">💡</span>
                        Understanding ROI (Return on Investment)
                      </h3>
                      <div className="text-sm text-gray-300 space-y-2">
                        <p>
                          <strong className="text-blue-300">ROI</strong> shows how much profit you've made compared to what you invested.
                          A positive ROI means the facility has paid for itself and is generating profit.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div className="bg-gray-800/50 p-3 rounded">
                            <div className="text-blue-300 font-semibold mb-1">Investment</div>
                            <div className="text-xs">Total credits spent on upgrades</div>
                          </div>
                          <div className="bg-gray-800/50 p-3 rounded">
                            <div className="text-green-300 font-semibold mb-1">Returns</div>
                            <div className="text-xs">Income generated or costs saved</div>
                          </div>
                          <div className="bg-gray-800/50 p-3 rounded">
                            <div className="text-red-300 font-semibold mb-1">Operating Costs</div>
                            <div className="text-xs">Daily maintenance costs</div>
                          </div>
                          <div className="bg-gray-800/50 p-3 rounded">
                            <div className="text-blue-300 font-semibold mb-1">Breakeven</div>
                            <div className="text-xs">Cycle when facility pays for itself</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Facility Tips */}
                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3">📊 Facility Investment Tips</h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start">
                          <span className="text-green-400 mr-2 mt-0.5">•</span>
                          <span>
                            <strong className="text-green-300">Merchandising Hub</strong> provides passive merchandising income every cycle.
                            Best for long-term stable growth.
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-blue-400 mr-2 mt-0.5">•</span>
                          <span>
                            <strong className="text-blue-300">Streaming Studio</strong> increases streaming revenue earned after every battle.
                            Great if you battle frequently.
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-purple-400 mr-2 mt-0.5">•</span>
                          <span>
                            <strong className="text-purple-300">Repair Bay</strong> reduces repair costs for damaged robots.
                            Essential if you have high repair bills.
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-yellow-400 mr-2 mt-0.5">•</span>
                          <span>
                            <strong className="text-yellow-300">Training Facility</strong> reduces attribute upgrade costs.
                            Valuable if you frequently train your robots.
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-orange-400 mr-2 mt-0.5">•</span>
                          <span>
                            <strong className="text-orange-300">Weapons Workshop</strong> reduces weapon purchase costs.
                            Useful when building new loadouts.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Advisor Tab */}
            {activeTab === 'advisor' && (
              <div className="space-y-6">
                {advisorLoading ? (
                  <div className="text-center py-12">
                    <div className="text-xl">Loading investment data...</div>
                  </div>
                ) : (
                  <>
                    {/* Analysis Period Selector */}
                    <div className="bg-gray-800 rounded-lg shadow p-6">
                      <h2 className="text-xl font-semibold mb-4">Analysis Period</h2>
                      <div className="flex gap-4 items-center">
                        <label className="text-sm font-medium text-gray-300">Last N Cycles:</label>
                        <select
                          value={lastNCycles}
                          onChange={(e) => setLastNCycles(parseInt(e.target.value))}
                          className="bg-gray-700 border border-gray-600 text-white rounded px-3 py-2"
                        >
                          <option value={5}>5 cycles</option>
                          <option value={10}>10 cycles</option>
                          <option value={20}>20 cycles</option>
                          <option value={30}>30 cycles</option>
                        </select>
                        <button
                          onClick={fetchAdvisorData}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Investment Recommendations */}
                    <div className="bg-gray-800 rounded-lg shadow p-6">
                      <h2 className="text-xl font-semibold mb-4">Investment Recommendations</h2>
                      {recommendations.length > 0 ? (
                        <div className="space-y-4">
                          {recommendations.map((rec, idx) => (
                            <div
                              key={idx}
                              className="border border-gray-700 rounded-lg p-4 bg-gray-750 hover:shadow-md transition-shadow"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h3 className="font-semibold text-lg">
                                    {rec.facilityName || getFacilityDisplayName(rec.facilityType)}
                                  </h3>
                                  <p className="text-sm text-gray-400">
                                    Current Level: {rec.currentLevel} → Recommended Level: {rec.recommendedLevel}
                                  </p>
                                </div>
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    rec.priority === 'high' ? 'bg-green-900 text-green-300' :
                                    rec.priority === 'medium' ? 'bg-blue-900 text-blue-300' :
                                    'bg-gray-700 text-gray-300'
                                  }`}
                                >
                                  {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div className="bg-gray-700 p-3 rounded">
                                  <div className="text-sm text-gray-400">Upgrade Cost</div>
                                  <div className="text-xl font-bold text-yellow-400">
                                    ₡{(rec.upgradeCost ?? 0).toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-gray-700 p-3 rounded">
                                  <div className="text-sm text-gray-400">
                                    {rec.projectedPayoffCycles !== null && rec.projectedPayoffCycles !== undefined 
                                      ? 'Payoff Period' 
                                      : 'Projected ROI'}
                                  </div>
                                  <div className={`text-xl font-bold ${
                                    rec.projectedPayoffCycles !== null && rec.projectedPayoffCycles !== undefined
                                      ? (rec.projectedPayoffCycles <= 30 ? 'text-green-400' : 
                                         rec.projectedPayoffCycles <= 100 ? 'text-yellow-400' : 'text-red-400')
                                      : getROIColor((rec.projectedROI ?? 0) * 100)
                                  }`}>
                                    {rec.projectedPayoffCycles !== null && rec.projectedPayoffCycles !== undefined
                                      ? `${rec.projectedPayoffCycles} cycles`
                                      : `${((rec.projectedROI ?? 0) * 100).toFixed(1)}%`}
                                  </div>
                                </div>
                              </div>

                              <div className="text-sm text-gray-300 bg-blue-900 p-3 rounded">
                                <strong>Reason:</strong> {rec.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-center py-8">
                          No investment recommendations available. Continue playing to gather more data.
                        </div>
                      )}
                    </div>

                    {/* Current Facility ROI */}
                    <div className="bg-gray-800 rounded-lg shadow p-6">
                      <h2 className="text-xl font-semibold mb-4">Current Facility Performance</h2>
                      {facilityROIs.length > 0 ? (
                        <div className="space-y-4">
                          {facilityROIs.map((roi, idx) => (
                            <div key={idx} className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="font-semibold text-lg">
                                    {getFacilityDisplayName(roi.facilityType)}
                                  </h3>
                                  <p className="text-sm text-gray-400">Level {roi.currentLevel}</p>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-400">Net ROI</div>
                                  <div className={`text-2xl font-bold ${getROIColor((roi.netROI ?? 0) * 100)}`}>
                                    {((roi.netROI ?? 0) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                <div className="bg-gray-700 p-2 rounded">
                                  <div className="text-xs text-gray-400">Investment</div>
                                  <div className="font-semibold">₡{(roi.totalInvestment ?? 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-green-900 p-2 rounded">
                                  <div className="text-xs text-gray-400">Returns</div>
                                  <div className="font-semibold text-green-400">
                                    ₡{(roi.totalReturns ?? 0).toLocaleString()}
                                  </div>
                                </div>
                                <div className="bg-red-900 p-2 rounded">
                                  <div className="text-xs text-gray-400">Operating Costs</div>
                                  <div className="font-semibold text-red-400">
                                    ₡{(roi.totalOperatingCosts ?? 0).toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-sm">
                                <div>
                                  <span className="text-gray-400">Net Profit:</span>
                                  <span
                                    className={`ml-2 font-semibold ${
                                      ((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)) >= 0 ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    ₡{((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)).toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  {roi.breakevenCycle !== null && roi.breakevenCycle !== undefined ? (
                                    <>
                                      <span className="text-gray-400">Breakeven:</span>
                                      <span className="ml-2 font-semibold text-blue-400">
                                        Cycle {roi.breakevenCycle}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-yellow-400">{roi.isProfitable ? 'Profitable' : 'Not yet profitable'}</span>
                                  )}
                                </div>
                                <div>
                                  <span className="text-gray-400">Owned for:</span>
                                  <span className="ml-2 font-semibold">
                                    {roi.cyclesSincePurchase ?? 0} cycles
                                  </span>
                                </div>
                              </div>

                              {/* ROI Progress Bar */}
                              <div className="mt-3">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>ROI Progress</span>
                                  <span>{((roi.netROI ?? 0) * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      (roi.netROI ?? 0) >= 0 ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                                    style={{
                                      width: `${Math.min(Math.max((roi.netROI ?? 0) * 100, 0), 100)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-center py-8">
                          No facility data available. Purchase facilities to see ROI analysis.
                        </div>
                      )}
                    </div>

                    {/* Investment Tips */}
                    <div className="bg-blue-900 border border-blue-700 rounded-lg p-6">
                      <h3 className="font-semibold text-blue-300 mb-2">Investment Tips</h3>
                      <ul className="text-sm text-blue-200 space-y-1">
                        <li>• Focus on facilities with positive projected ROI and short payoff times</li>
                        <li>• Merchandising Hubs provide passive merchandising income every cycle</li>
                        <li>• Streaming Studios increase streaming revenue earned per battle</li>
                        <li>• Repair Bays reduce repair costs for your robots</li>
                        <li>• Training Facilities improve robot performance over time</li>
                        <li>• Higher priority recommendations offer better returns on investment</li>
                        <li>• Monitor ROI over multiple cycles to identify trends</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FacilitiesPage;
