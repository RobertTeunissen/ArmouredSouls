/**
 * BattleLogLegend — Visual indicators legend for the battle logs table.
 * Extracted from BattleLogsTab to reduce component size.
 */

export function BattleLogLegend(): JSX.Element {
  return (
    <div className="mb-4 p-4 bg-surface-elevated rounded-lg">
      <h3 className="text-sm font-semibold mb-2 text-secondary">Visual Indicators:</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="text-success">Clear Victory</span>
          <span className="text-secondary">(HP &gt; 50)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">💪</span>
          <span className="text-warning">Narrow Victory</span>
          <span className="text-secondary">(HP 1-50)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚖️</span>
          <span className="text-secondary">Draw</span>
          <span className="text-secondary">(No winner)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-red-500"></span>
          <span className="text-secondary">Draw</span>
          <span className="text-secondary">(rare event)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-yellow-500"></span>
          <span className="text-secondary">Long Battle</span>
          <span className="text-secondary">(&gt;90s)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-primary-dark"></span>
          <span className="text-secondary">Big ELO Swing</span>
          <span className="text-secondary">(&gt;50 points)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-orange-500"></span>
          <span className="text-secondary">KotH Battle</span>
          <span className="text-secondary">(zone control)</span>
        </div>
      </div>
    </div>
  );
}
