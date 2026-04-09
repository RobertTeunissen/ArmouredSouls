/**
 * MultiplierBreakdown Component
 * Displays prestige and fame income multiplier breakdowns
 */

interface MultiplierBreakdownProps {
  multiplierData: {
    prestige: {
      current: number;
      multiplier: number;
      bonusPercent: number;
      nextTier: { threshold: number; bonus: string } | null;
    };
    merchandising: {
      baseRate: number;
      prestigeMultiplier: number;
      total: number;
      formula: string;
    };
    streaming: {
      baseRate: number;
      battleMultiplier: number;
      fameMultiplier: number;
      totalBattles: number;
      totalFame: number;
      total: number;
      formula: string;
    };
  };
}

export default function MultiplierBreakdown({ multiplierData }: MultiplierBreakdownProps) {
  return (
    <div className="bg-surface p-6 rounded-lg">
      <h3 className="text-xl font-semibold mb-4">💰 Income Multipliers</h3>
      
      {/* Prestige Bonus */}
      <div className="mb-4 p-4 bg-surface-elevated rounded">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Battle Winnings Prestige Bonus</span>
          <span className="text-success font-bold">+{multiplierData.prestige.bonusPercent}%</span>
        </div>
        <div className="text-sm text-secondary">
          Current Prestige: {multiplierData.prestige.current.toLocaleString()}
        </div>
        {multiplierData.prestige.nextTier && (
          <div className="text-sm text-primary mt-1">
            Next tier at {multiplierData.prestige.nextTier.threshold.toLocaleString()} prestige: {multiplierData.prestige.nextTier.bonus}
          </div>
        )}
        {!multiplierData.prestige.nextTier && (
          <div className="text-sm text-success mt-1">
            ✓ Maximum tier reached!
          </div>
        )}
      </div>
      
      {/* Merchandising */}
      {multiplierData.merchandising.total > 0 && (
        <div className="mb-4 p-4 bg-surface-elevated rounded">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Merchandising Income</span>
            <span className="text-success font-bold">₡{multiplierData.merchandising.total.toLocaleString()}/day</span>
          </div>
          <div className="text-sm text-secondary">
            Formula: {multiplierData.merchandising.formula}
          </div>
          <div className="text-xs text-tertiary mt-1">
            Base rate × (1 + prestige/10,000)
          </div>
        </div>
      )}
      
      {/* Streaming */}
      {multiplierData.streaming.total > 0 && (
        <div className="mb-4 p-4 bg-surface-elevated rounded">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold">Streaming Revenue</span>
            <span className="text-success font-bold">₡{multiplierData.streaming.total.toLocaleString()}/day</span>
          </div>
          <div className="text-sm text-secondary">
            Formula: {multiplierData.streaming.formula}
          </div>
          <div className="text-xs text-tertiary mt-1">
            Base × (1 + battles/1,000) × (1 + fame/5,000)
          </div>
          <div className="text-xs text-tertiary">
            Total Battles: {multiplierData.streaming.totalBattles} | Total Fame: {multiplierData.streaming.totalFame.toLocaleString()}
          </div>
        </div>
      )}

      {/* No passive income message */}
      {multiplierData.merchandising.total === 0 && multiplierData.streaming.total === 0 && (
        <div className="p-4 bg-surface-elevated/50 rounded border border-gray-600 text-center">
          <div className="text-secondary mb-2">No passive income streams active</div>
          <div className="text-sm text-tertiary">
            Upgrade Merchandising Hub facility to unlock merchandising and streaming revenue
          </div>
        </div>
      )}
    </div>
  );
}
