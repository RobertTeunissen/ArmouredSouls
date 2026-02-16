import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';

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

/**
 * Facility Investment Advisor Page
 * 
 * Displays current facility ROI, investment recommendations, and ROI projection charts.
 * Validates: Requirements 8.2, 8.3, 8.5, 12.3
 */
const FacilityInvestmentAdvisorPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lastNCycles, setLastNCycles] = useState(10);
  const [facilityROIs, setFacilityROIs] = useState<FacilityROI[]>([]);
  const [recommendations, setRecommendations] = useState<FacilityRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvestmentData();
    }
  }, [user, lastNCycles]);

  const fetchInvestmentData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch ROI data for all facility types
      const facilityTypes = ['income_generator', 'repair_bay', 'training_facility'];
      const roiPromises = facilityTypes.map(async (type) => {
        try {
          const response = await fetch(`http://localhost:3001/api/analytics/facility/${user.id}/roi?facilityType=${type}`);
          if (response.ok) {
            return await response.json();
          }
          // 404 is expected if user hasn't purchased this facility
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
        if (!recResponse.ok) {
          // No recommendations available is normal for new users
          setRecommendations([]);
        } else {
          const recData = await recResponse.json();
          // API returns { recommendations: [...] }, extract the array
          setRecommendations(recData.recommendations || []);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setRecommendations([]);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error in fetchInvestmentData:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const getFacilityDisplayName = (type: string): string => {
    const names: Record<string, string> = {
      income_generator: 'Income Generator',
      repair_bay: 'Repair Bay',
      training_facility: 'Training Facility',
    };
    return names[type] || type;
  };

  const getROIColor = (roiPercentage: number): string => {
    if (roiPercentage >= 50) return 'text-green-400';
    if (roiPercentage >= 20) return 'text-blue-400';
    if (roiPercentage >= 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPriorityBadge = (priority: number): string => {
    if (priority >= 80) return 'bg-green-900 text-green-300';
    if (priority >= 60) return 'bg-blue-900 text-blue-300';
    if (priority >= 40) return 'bg-yellow-900 text-yellow-300';
    return 'bg-gray-700 text-gray-300';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Please log in to view investment advisor</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading investment data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
            Error: {error}
          </div>
          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Facility Investment Advisor</h1>

      {/* Analysis Period Selector */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
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
            onClick={fetchInvestmentData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Investment Recommendations */}
      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
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
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-6 mt-6">
        <h3 className="font-semibold text-blue-300 mb-2">Investment Tips</h3>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Focus on facilities with positive projected ROI and short payoff times</li>
          <li>• Income Generators provide passive income every cycle</li>
          <li>• Repair Bays reduce repair costs for your robots</li>
          <li>• Training Facilities improve robot performance over time</li>
          <li>• Higher priority recommendations offer better returns on investment</li>
          <li>• Monitor ROI over multiple cycles to identify trends</li>
        </ul>
      </div>
      </div>
    </div>
  );
};

export default FacilityInvestmentAdvisorPage;
