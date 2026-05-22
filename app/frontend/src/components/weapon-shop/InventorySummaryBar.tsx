/**
 * InventorySummaryBar — At-a-glance stats for the My Inventory tab.
 *
 * Shows total inventory count, count available to sell, and aggregate resale
 * value at the current Workshop level. Updates live via prop changes.
 *
 * Spec #33 R5.8.
 */

interface InventorySummaryBarProps {
  totalCount: number;
  availableCount: number;
  totalResaleValue: number;
  workshopLevel: number;
  resaleRate: number;
}

export function InventorySummaryBar({
  totalCount,
  availableCount,
  totalResaleValue,
  workshopLevel,
  resaleRate,
}: InventorySummaryBarProps) {
  return (
    <div className="bg-surface rounded-lg p-4 mb-6 flex flex-wrap gap-6 items-center">
      <div className="flex flex-col">
        <span className="text-xs text-secondary uppercase tracking-wide">Total Owned</span>
        <span className="text-2xl font-semibold">{totalCount}</span>
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-secondary uppercase tracking-wide">Available to Sell</span>
        <span className="text-2xl font-semibold">{availableCount}</span>
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-secondary uppercase tracking-wide">Total Resale Value</span>
        <span className="text-2xl font-semibold text-emerald-400">
          ₡{totalResaleValue.toLocaleString()}
        </span>
      </div>

      <div className="ml-auto">
        <span className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-600/50 px-3 py-1.5 rounded-full text-sm">
          <span className="text-blue-300">Workshop L{workshopLevel}</span>
          <span className="text-blue-400">·</span>
          <span className="text-blue-200 font-semibold">{resaleRate}% resale</span>
        </span>
      </div>
    </div>
  );
}
