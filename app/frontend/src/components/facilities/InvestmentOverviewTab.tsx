/**
 * InvestmentOverviewTab — Consolidated investment performance and upgrade recommendations.
 *
 * Replaces the old InvestmentsTab and AdvisorTab with a single unified view.
 * Shows lifetime ROI data for the 5 economic facilities and upgrade recommendations.
 *
 * Created in Spec 30 (Fix Investment Advisor).
 */

import type { UnifiedFacilityROI, FacilityRecommendation } from './types';

export interface InvestmentOverviewTabProps {
  loading: boolean;
  facilityROIs: UnifiedFacilityROI[];
  recommendations: FacilityRecommendation[];
  getFacilityDisplayName: (type: string) => string;
}

export function InvestmentOverviewTab({
  loading,
  facilityROIs,
  recommendations,
  getFacilityDisplayName,
}: InvestmentOverviewTabProps) {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-xl">Loading investment data...</div>
      </div>
    );
  }

  if (facilityROIs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-xl text-tertiary mb-2">No economic facilities owned</div>
        <p className="text-secondary text-sm">
          Purchase economic facilities to see investment performance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Investment Performance */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Investment Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {facilityROIs.map((roi) => (
            <div
              key={roi.facilityType}
              className="bg-surface rounded-lg p-5 border border-white/10"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-primary">
                    {getFacilityDisplayName(roi.facilityType)}
                  </h3>
                  <p className="text-sm text-secondary">Level {roi.currentLevel}</p>
                </div>
                <StatusBadge roi={roi} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-surface-elevated p-2 rounded">
                  <div className="text-xs text-secondary">Investment</div>
                  <div className="font-semibold text-sm">
                    ₡{roi.totalInvestment.toLocaleString()}
                  </div>
                </div>
                <div className="bg-surface-elevated p-2 rounded">
                  <div className="text-xs text-secondary">Returns</div>
                  <div className="font-semibold text-sm text-success">
                    ₡{roi.totalReturns.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="text-secondary">Net ROI: </span>
                  <span
                    className={`font-semibold ${
                      roi.netROI >= 0 ? 'text-success' : 'text-error'
                    }`}
                  >
                    {(roi.netROI * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-tertiary">
                  {roi.cyclesSincePurchase} cycles owned
                </div>
              </div>

              {roi.dataSource === 'estimate' && (
                <div className="mt-2 text-xs text-warning">
                  ⚠ Estimated (no snapshot data)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Upgrade Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Upgrade Recommendations</h2>
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="bg-surface rounded-lg p-4 border border-white/10"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-primary">
                      {rec.facilityName || getFacilityDisplayName(rec.facilityType)}
                    </h3>
                    <p className="text-sm text-secondary">
                      Level {rec.currentLevel} → {rec.recommendedLevel}
                    </p>
                  </div>
                  <PriorityBadge priority={rec.priority} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-xs text-secondary">Upgrade Cost</div>
                    <div className="font-semibold text-sm text-warning">
                      ₡{(rec.upgradeCost ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-xs text-secondary">Payoff Period</div>
                    <div className="font-semibold text-sm">
                      {rec.projectedPayoffCycles != null
                        ? `${rec.projectedPayoffCycles} cycles`
                        : 'N/A'}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-secondary">{rec.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ roi }: { roi: UnifiedFacilityROI }) {
  if (roi.paidOff) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-900 text-success">
        Paid Off ✓
      </span>
    );
  }

  if (roi.projectedPayoffCycles != null) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-900 text-warning">
        {roi.projectedPayoffCycles} cycles to payoff
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-900 text-error">
      Not yet profitable
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-green-900 text-green-300',
    medium: 'bg-blue-900 text-blue-300',
    low: 'bg-surface-elevated text-secondary',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[priority] || styles.low
      }`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
    </span>
  );
}
