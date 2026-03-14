/**
 * FacilityROICalculator Component
 * Calculator to estimate ROI for facility upgrades
 */

import { useState } from 'react';
import { calculateFacilityROI, FacilityROIData, formatCurrency } from '../utils/financialApi';

// Facility options for the calculator
const FACILITY_OPTIONS = [
  { type: 'merchandising_hub', name: 'Merchandising Hub' },
  { type: 'streaming_studio', name: 'Streaming Studio' },
  { type: 'training_facility', name: 'Training Facility' },
  { type: 'repair_bay', name: 'Repair Bay' },
  { type: 'weapons_workshop', name: 'Weapons Workshop' },
  { type: 'medical_bay', name: 'Medical Bay' },
  { type: 'research_lab', name: 'Research Lab' },
  { type: 'roster_expansion', name: 'Roster Expansion' },
  { type: 'storage_facility', name: 'Storage Facility' },
  { type: 'coaching_staff', name: 'Coaching Staff' },
  { type: 'booking_office', name: 'Booking Office' },
  { type: 'combat_training_academy', name: 'Combat Training Academy' },
  { type: 'defense_training_academy', name: 'Defense Training Academy' },
  { type: 'mobility_training_academy', name: 'Mobility Training Academy' },
  { type: 'ai_training_academy', name: 'AI Training Academy' },
];

function FacilityROICalculator() {
  const [selectedFacility, setSelectedFacility] = useState<string>('merchandising_hub');
  const [targetLevel, setTargetLevel] = useState<number>(1);
  const [roiData, setRoiData] = useState<FacilityROIData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await calculateFacilityROI(selectedFacility, targetLevel);
      setRoiData(data);
    } catch (err) {
      console.error('ROI calculation error:', err);
      setError('Failed to calculate ROI. Please try again.');
      setRoiData(null);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = (type: string): string => {
    switch (type) {
      case 'excellent':
        return 'text-success bg-green-900/20 border-green-700';
      case 'good':
        return 'text-primary bg-blue-900/20 border-blue-700';
      case 'neutral':
        return 'text-warning bg-yellow-900/20 border-yellow-700';
      case 'poor':
        return 'text-orange-400 bg-orange-900/20 border-orange-700';
      case 'not_affordable':
        return 'text-error bg-red-900/20 border-red-700';
      default:
        return 'text-secondary bg-background/20 border-white/10';
    }
  };

  const getRecommendationIcon = (type: string): string => {
    switch (type) {
      case 'excellent':
        return '🎯';
      case 'good':
        return '✅';
      case 'neutral':
        return 'ℹ️';
      case 'poor':
        return '⚠️';
      case 'not_affordable':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Facility ROI Calculator</h2>
      <p className="text-secondary text-sm mb-6">
        Calculate the return on investment for upgrading facilities. See upgrade costs, daily changes, and break-even time.
      </p>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            Facility Type
          </label>
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
            className="w-full bg-surface-elevated border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          >
            {FACILITY_OPTIONS.map((option) => (
              <option key={option.type} value={option.type}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            Target Level
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={targetLevel}
            onChange={(e) => setTargetLevel(parseInt(e.target.value) || 1)}
            className="w-full bg-surface-elevated border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleCalculate}
            disabled={loading}
            className={`w-full px-6 py-2 rounded font-semibold transition-colors ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-primary hover:bg-blue-700'
            }`}
          >
            {loading ? 'Calculating...' : 'Calculate ROI'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 text-error p-4 rounded mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {roiData && (
        <div className="space-y-6">
          {/* Upgrade Summary */}
          <div className="bg-surface-elevated p-4 rounded">
            <h3 className="text-lg font-semibold mb-3">Upgrade Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-secondary">Current Level</div>
                <div className="text-xl font-bold text-gray-200">{roiData.currentLevel}</div>
              </div>
              <div>
                <div className="text-secondary">Target Level</div>
                <div className="text-xl font-bold text-primary">{roiData.targetLevel}</div>
              </div>
              <div>
                <div className="text-secondary">Upgrade Cost</div>
                <div className="text-xl font-bold text-warning">
                  {formatCurrency(roiData.upgradeCost)}
                </div>
              </div>
              <div>
                <div className="text-secondary">Affordable?</div>
                <div className={`text-xl font-bold ${roiData.affordable ? 'text-success' : 'text-error'}`}>
                  {roiData.affordable ? 'Yes ✓' : 'No ✗'}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Changes */}
          <div className="bg-surface-elevated p-4 rounded">
            <h3 className="text-lg font-semibold mb-3">Daily Financial Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-secondary">Daily Cost Increase</div>
                <div className="text-xl font-bold text-error">
                  {roiData.dailyCostIncrease > 0 ? '+' : ''}{formatCurrency(roiData.dailyCostIncrease)}
                </div>
              </div>
              <div>
                <div className="text-secondary">Daily Benefit Increase</div>
                <div className="text-xl font-bold text-success">
                  {roiData.dailyBenefitIncrease > 0 ? '+' : ''}{formatCurrency(roiData.dailyBenefitIncrease)}
                </div>
              </div>
              <div>
                <div className="text-secondary">Net Daily Change</div>
                <div className={`text-xl font-bold ${roiData.netDailyChange >= 0 ? 'text-success' : 'text-error'}`}>
                  {roiData.netDailyChange >= 0 ? '+' : ''}{formatCurrency(roiData.netDailyChange)}
                </div>
              </div>
            </div>
          </div>

          {/* Break-even Analysis */}
          {roiData.breakevenDays !== null && (
            <div className="bg-surface-elevated p-4 rounded">
              <h3 className="text-lg font-semibold mb-3">Break-Even Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-secondary">Break-Even Time</div>
                  <div className="text-xl font-bold text-primary">
                    {roiData.breakevenDays} days
                  </div>
                  <div className="text-xs text-tertiary mt-1">
                    ~{Math.round(roiData.breakevenDays / 30)} months
                  </div>
                </div>
                <div>
                  <div className="text-secondary">Net (30 days)</div>
                  <div className={`text-xl font-bold ${roiData.net30Days >= 0 ? 'text-success' : 'text-error'}`}>
                    {roiData.net30Days >= 0 ? '+' : ''}{formatCurrency(roiData.net30Days)}
                  </div>
                </div>
                <div>
                  <div className="text-secondary">Net (90 days)</div>
                  <div className={`text-xl font-bold ${roiData.net90Days >= 0 ? 'text-success' : 'text-error'}`}>
                    {roiData.net90Days >= 0 ? '+' : ''}{formatCurrency(roiData.net90Days)}
                  </div>
                </div>
                <div>
                  <div className="text-secondary">Net (180 days)</div>
                  <div className={`text-xl font-bold ${roiData.net180Days >= 0 ? 'text-success' : 'text-error'}`}>
                    {roiData.net180Days >= 0 ? '+' : ''}{formatCurrency(roiData.net180Days)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className={`p-4 rounded border ${getRecommendationColor(roiData.recommendationType)}`}>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <span>{getRecommendationIcon(roiData.recommendationType)}</span>
              Recommendation
            </h3>
            <p>{roiData.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacilityROICalculator;
