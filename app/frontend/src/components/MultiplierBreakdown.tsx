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
      /** Roster mean, not a summed-roster figure (Spec #46 R10). */
      battleMultiplier: number;
      /** Roster mean, not a summed-roster figure (Spec #46 R10). */
      fameMultiplier: number;
      studioMultiplier?: number;
      totalBattles: number;
      totalFame: number;
      /** Exact per-robot awards — streaming is paid per robot per battle. */
      perRobot?: Array<{
        robotId: number;
        robotName: string;
        battles: number;
        fame: number;
        battleMultiplier: number;
        fameMultiplier: number;
        revenuePerBattle: number;
        formula: string;
      }>;
      total: number;
      formula: string;
      note?: string;
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
        <div className="text-xs text-tertiary mt-1">
          Formula: min(+50%, prestige / 50,000 × 100%)
        </div>
        {multiplierData.prestige.nextTier && (
          <div className="text-sm text-primary mt-1">
            Cap at {multiplierData.prestige.nextTier.threshold.toLocaleString()} prestige: {multiplierData.prestige.nextTier.bonus}
          </div>
        )}
        {!multiplierData.prestige.nextTier && (
          <div className="text-sm text-success mt-1">
            ✓ Maximum bonus reached!
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
            Base × (1 + battles/1,000) × (1 + fame/5,000) × (1 + studio level)
          </div>
          {multiplierData.streaming.note && (
            <p className="text-xs text-tertiary mt-2">{multiplierData.streaming.note}</p>
          )}
          {/*
            Spec #46 R10: streaming is awarded per robot per battle, so the
            per-robot rows are the figures that match what each robot is paid.
            The roster totals below are context only — feeding them into the
            multipliers is what previously inflated the display.
          */}
          {multiplierData.streaming.perRobot && multiplierData.streaming.perRobot.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid="streaming-per-robot">
              {multiplierData.streaming.perRobot.map((robot) => (
                <li key={robot.robotId} className="text-xs text-tertiary">
                  <span className="text-secondary">{robot.robotName}</span>
                  {' — '}
                  ₡{robot.revenuePerBattle.toLocaleString()} per battle
                  {' ('}
                  {robot.battles} battles, {robot.fame.toLocaleString()} fame
                  {')'}
                </li>
              ))}
            </ul>
          )}
          <div className="text-xs text-tertiary mt-2">
            Roster totals (context only): {multiplierData.streaming.totalBattles} battles | {multiplierData.streaming.totalFame.toLocaleString()} fame
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
