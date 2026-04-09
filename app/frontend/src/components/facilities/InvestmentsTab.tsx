/**
 * InvestmentsTab — Displays facility ROI performance and educational content.
 *
 * Extracted from FacilitiesPage.tsx during component splitting (Spec 18).
 */

import type { FacilityROI } from './types';

export interface InvestmentsTabProps {
  advisorLoading: boolean;
  facilityROIs: FacilityROI[];
  currentCycle: number;
  getFacilityDisplayName: (type: string) => string;
  getROIColor: (roiPercentage: number) => string;
}

export function InvestmentsTab({
  advisorLoading, facilityROIs, currentCycle,
  getFacilityDisplayName, getROIColor,
}: InvestmentsTabProps) {
  if (advisorLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-xl">Loading facility data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Facility Performance */}
      <div className="bg-surface rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Current Facility Performance</h2>
        <p className="text-secondary text-sm mb-6">
          Track the return on investment (ROI) for your Economy & Discounts facilities.
          Only facilities that generate income or reduce costs are shown here.
        </p>
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

                {/* Financial Metrics - Single Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-xs text-secondary">Investment</div>
                    <div className="font-semibold">₡{(roi.totalInvestment ?? 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-red-900 p-2 rounded">
                    <div className="text-xs text-secondary">Operating Costs</div>
                    <div className="font-semibold text-error">
                      ₡{(roi.totalOperatingCosts ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-green-900 p-2 rounded">
                    <div className="text-xs text-secondary">Returns</div>
                    <div className="font-semibold text-success">
                      ₡{(roi.totalReturns ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className={`p-2 rounded ${((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)) >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
                    <div className="text-xs text-secondary">Net Profit</div>
                    <div className={`font-semibold ${
                      ((roi.totalReturns ?? 0) - (roi.totalInvestment ?? 0) - (roi.totalOperatingCosts ?? 0)) >= 0 ? 'text-success' : 'text-error'
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
                        <span className="text-secondary">Breakeven:</span>
                        <span className="ml-2 font-semibold text-primary">
                          {currentCycle > 0 && roi.breakevenCycle <= currentCycle
                            ? `Achieved at cycle ${roi.breakevenCycle}`
                            : currentCycle > 0 && roi.breakevenCycle > currentCycle
                            ? `${roi.breakevenCycle - currentCycle} cycles remaining`
                            : `Cycle ${roi.breakevenCycle}`
                          }
                        </span>
                      </>
                    ) : (
                      <span className="text-warning">Not yet profitable</span>
                    )}
                  </div>
                  <div>
                    <span className="text-secondary">Owned for:</span>
                    <span className="ml-2 font-semibold">
                      {roi.cyclesSincePurchase ?? 0} cycles
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-tertiary text-center py-8">
            <p className="mb-2">No facility data available yet.</p>
            <p className="text-sm">Purchase Economy & Discounts facilities to see ROI analysis.</p>
          </div>
        )}
      </div>

      {/* What is ROI? */}
      <div className="bg-blue-900/20 border border-blue-700/50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-primary mb-3 flex items-center">
          <span className="mr-2">💡</span>
          Understanding ROI (Return on Investment)
        </h3>
        <div className="text-sm text-secondary space-y-2">
          <p>
            <strong className="text-blue-300">ROI</strong> shows how much profit you&apos;ve made compared to what you invested.
            A positive ROI means the facility has paid for itself and is generating profit.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="bg-surface/50 p-3 rounded">
              <div className="text-blue-300 font-semibold mb-1">Investment</div>
              <div className="text-xs">Total credits spent on upgrades</div>
            </div>
            <div className="bg-surface/50 p-3 rounded">
              <div className="text-green-300 font-semibold mb-1">Returns</div>
              <div className="text-xs">Income generated or costs saved</div>
            </div>
            <div className="bg-surface/50 p-3 rounded">
              <div className="text-red-300 font-semibold mb-1">Operating Costs</div>
              <div className="text-xs">Daily maintenance costs</div>
            </div>
            <div className="bg-surface/50 p-3 rounded">
              <div className="text-blue-300 font-semibold mb-1">Breakeven</div>
              <div className="text-xs">Cycle when facility pays for itself</div>
            </div>
          </div>
        </div>
      </div>

      {/* Facility Tips */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">📊 Facility Investment Tips</h3>
        <ul className="space-y-2 text-sm text-secondary">
          <li className="flex items-start">
            <span className="text-success mr-2 mt-0.5">•</span>
            <span>
              <strong className="text-green-300">Merchandising Hub</strong> provides passive merchandising income every cycle.
              Best for long-term stable growth.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2 mt-0.5">•</span>
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
            <span className="text-warning mr-2 mt-0.5">•</span>
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
    </div>
  );
}
