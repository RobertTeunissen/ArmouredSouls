/**
 * AdvisorTab — Investment advisor with recommendations and facility ROI analysis.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 */

import type { FacilityROI, FacilityRecommendation } from './types';

export interface AdvisorTabProps {
  advisorLoading: boolean;
  lastNCycles: number;
  setLastNCycles: (n: number) => void;
  recommendations: FacilityRecommendation[];
  facilityROIs: FacilityROI[];
  getFacilityDisplayName: (type: string) => string;
  getROIColor: (roiPercentage: number) => string;
  onRefresh: () => void;
}

export function AdvisorTab({
  advisorLoading, lastNCycles, setLastNCycles,
  recommendations, facilityROIs,
  getFacilityDisplayName, getROIColor, onRefresh,
}: AdvisorTabProps) {
  if (advisorLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-xl">Loading investment data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analysis Period Selector */}
      <div className="bg-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Analysis Period</h2>
        <div className="flex gap-4 items-center">
          <label className="text-sm font-medium text-secondary">Last N Cycles:</label>
          <select
            value={lastNCycles}
            onChange={(e) => setLastNCycles(parseInt(e.target.value))}
            className="bg-surface-elevated border border-gray-600 text-white rounded px-3 py-2"
          >
            <option value={5}>5 cycles</option>
            <option value={10}>10 cycles</option>
            <option value={20}>20 cycles</option>
            <option value={30}>30 cycles</option>
          </select>
          <button
            onClick={onRefresh}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Investment Recommendations */}
      <div className="bg-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Investment Recommendations</h2>
        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="border border-white/10 rounded-lg p-4 bg-gray-750 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {rec.facilityName || getFacilityDisplayName(rec.facilityType)}
                    </h3>
                    <p className="text-sm text-secondary">
                      Current Level: {rec.currentLevel} → Recommended Level: {rec.recommendedLevel}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      rec.priority === 'high' ? 'bg-green-900 text-green-300' :
                      rec.priority === 'medium' ? 'bg-blue-900 text-blue-300' :
                      'bg-surface-elevated text-secondary'
                    }`}
                  >
                    {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} Priority
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="bg-surface-elevated p-3 rounded">
                    <div className="text-sm text-secondary">Upgrade Cost</div>
                    <div className="text-xl font-bold text-warning">
                      ₡{(rec.upgradeCost ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-surface-elevated p-3 rounded">
                    <div className="text-sm text-secondary">
                      {rec.projectedPayoffCycles !== null && rec.projectedPayoffCycles !== undefined
                        ? 'Payoff Period'
                        : 'Projected ROI'}
                    </div>
                    <div className={`text-xl font-bold ${
                      rec.projectedPayoffCycles !== null && rec.projectedPayoffCycles !== undefined
                        ? (rec.projectedPayoffCycles <= 30 ? 'text-success' :
                           rec.projectedPayoffCycles <= 100 ? 'text-warning' : 'text-error')
                        : getROIColor((rec.projectedROI ?? 0) * 100)
                    }`}>
                      {rec.projectedPayoffCycles !== null && rec.projectedPayoffCycles !== undefined
                        ? `${rec.projectedPayoffCycles} cycles`
                        : `${((rec.projectedROI ?? 0) * 100).toFixed(1)}%`}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-secondary bg-blue-900 p-3 rounded">
                  <strong>Reason:</strong> {rec.reason}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-tertiary text-center py-8">
            No investment recommendations available. Continue playing to gather more data.
          </div>
        )}
      </div>

      {/* Current Facility ROI */}
      <div className="bg-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Current Facility Performance</h2>
        {facilityROIs.length > 0 ? (
          <div className="space-y-4">
            {facilityROIs.map((roi, idx) => (
              <div key={idx} className="border border-white/10 rounded-lg p-4 bg-gray-750">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {getFacilityDisplayName(roi.facilityType)}
                    </h3>
                    <p className="text-sm text-secondary">Level {roi.currentLevel}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-secondary">Net ROI</div>
                    <div className={`text-2xl font-bold ${getROIColor((roi.netROI ?? 0) * 100)}`}>
                      {((roi.netROI ?? 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-xs text-secondary">Investment</div>
                    <div className="font-semibold">₡{(roi.totalInvestment ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-green-900 p-2 rounded">
                    <div className="text-xs text-secondary">Returns</div>
                    <div className="font-semibold text-success">
                      ₡{(roi.totalReturns ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-red-900 p-2 rounded">
                    <div className="text-xs text-secondary">Operating Costs</div>
                    <div className="font-semibold text-error">
                      ₡{(roi.totalOperatingCosts ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="text-secondary">Net Profit:</span>
                    <span
                      className={`ml-2 font-semibold ${
                        ((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)) >= 0 ? 'text-success' : 'text-error'
                      }`}
                    >
                      ₡{((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    {roi.breakevenCycle !== null && roi.breakevenCycle !== undefined ? (
                      <>
                        <span className="text-secondary">Breakeven:</span>
                        <span className="ml-2 font-semibold text-primary">
                          Cycle {roi.breakevenCycle}
                        </span>
                      </>
                    ) : (
                      <span className="text-warning">{roi.isProfitable ? 'Profitable' : 'Not yet profitable'}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-secondary">Owned for:</span>
                    <span className="ml-2 font-semibold">
                      {roi.cyclesSincePurchase ?? 0} cycles
                    </span>
                  </div>
                </div>

                {/* ROI Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-secondary mb-1">
                    <span>ROI Progress</span>
                    <span>{((roi.netROI ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-2">
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
          <div className="text-tertiary text-center py-8">
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
    </div>
  );
}
