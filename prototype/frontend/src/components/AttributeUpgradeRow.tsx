interface AttributeUpgradeRowProps {
  attributeKey: string;
  label: string;
  icon: string;
  currentLevel: number;
  plannedLevel: number;
  cost: number;
  baseCost: number;
  cap: number;
  isAtCap: boolean;
  hasPlannedChange: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  compact?: boolean;
}

function AttributeUpgradeRow({
  label,
  icon,
  currentLevel,
  plannedLevel,
  cost,
  baseCost,
  cap,
  isAtCap,
  hasPlannedChange,
  onIncrement,
  onDecrement,
  compact = false,
}: AttributeUpgradeRowProps) {
  if (compact) {
    // Compact mode for grid layout - single row design
    return (
      <div
        className={`
          px-3 py-2 rounded flex items-center justify-between gap-3
          transition-colors
          ${hasPlannedChange 
            ? 'bg-blue-900/30 border border-blue-500' 
            : 'bg-gray-800/50 hover:bg-gray-750'
          }
        `}
      >
        {/* Left: Attribute Info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-base">{icon}</span>
          <div className="flex flex-col min-w-0">
            <div className="text-gray-300 text-xs font-medium truncate">{label}</div>
            <div className="text-xs text-gray-500">
              {currentLevel}/{cap}
            </div>
          </div>
        </div>

        {/* Right: Controls and Cost */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Decrement Button */}
          <button
            onClick={onDecrement}
            disabled={!hasPlannedChange}
            className={`
              w-6 h-6 rounded flex items-center justify-center font-bold text-sm
              transition-colors
              ${hasPlannedChange
                ? 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>

          {/* Level Display */}
          <div className="w-12 text-center">
            {hasPlannedChange ? (
              <span className="text-blue-400 font-bold text-sm">{plannedLevel}</span>
            ) : (
              <span className="text-gray-400 text-sm">{currentLevel}</span>
            )}
          </div>

          {/* Increment Button */}
          <button
            onClick={onIncrement}
            disabled={isAtCap}
            className={`
              w-6 h-6 rounded flex items-center justify-center font-bold text-sm
              transition-colors
              ${!isAtCap
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label={`Increase ${label}`}
            title={isAtCap ? `At cap (${cap})` : `Upgrade ${label}`}
          >
            +
          </button>

          {/* Cost Display */}
          <div className="w-16 text-right">
            {hasPlannedChange ? (
              <span className="text-yellow-400 font-semibold text-xs">
                ₡{cost.toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-600 text-xs">—</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Original full-width mode (kept for backwards compatibility)
  const costPerPoint = hasPlannedChange ? cost / (plannedLevel - currentLevel) : 0;
  const averageCostPerPoint = 1500;
  const isCostEfficient = costPerPoint < averageCostPerPoint * 0.8;
  // Show discount info if there's a difference between base and final cost
  const hasDiscounts = baseCost > cost;

  return (
    <div
      className={`
        px-4 py-3 rounded flex items-center justify-between
        transition-colors
        ${hasPlannedChange 
          ? 'bg-blue-900/30 border-l-2 border-blue-500' 
          : 'bg-gray-800/50 hover:bg-gray-750'
        }
        ${isCostEfficient && hasPlannedChange ? 'ring-1 ring-green-500/30' : ''}
      `}
    >
      {/* Attribute Info */}
      <div className="flex items-center gap-3 flex-1">
        <span className="text-xl w-6">{icon}</span>
        <div className="flex flex-col">
          <span className="text-gray-300 text-sm min-w-[180px]">{label}</span>
          <span className="text-xs text-gray-500">
            Level {currentLevel} / {cap}
          </span>
        </div>
      </div>

      {/* Controls and Display */}
      <div className="flex items-center gap-4">
        {/* Decrement Button */}
        <button
          onClick={onDecrement}
          disabled={!hasPlannedChange}
          className={`
            w-8 h-8 rounded flex items-center justify-center font-bold text-lg
            transition-colors
            ${hasPlannedChange
              ? 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>

        {/* Planned Level Display */}
        {hasPlannedChange && (
          <div className="flex items-center gap-2">
            <span className="text-blue-400 text-sm">→</span>
            <span className="text-blue-400 font-bold text-lg min-w-[40px] text-center">
              {plannedLevel}
            </span>
          </div>
        )}

        {/* Increment Button */}
        <button
          onClick={onIncrement}
          disabled={isAtCap}
          className={`
            w-8 h-8 rounded flex items-center justify-center font-bold text-lg
            transition-colors
            ${!isAtCap
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }
          `}
          aria-label={`Increase ${label}`}
          title={isAtCap ? `At academy cap (${cap})` : `Upgrade ${label}`}
        >
          +
        </button>

        {/* Cost Display */}
        <div className="min-w-[200px] text-right">
          {hasPlannedChange ? (
            <div className="flex flex-col items-end gap-1">
              {/* Show original cost with strikethrough if discounts apply */}
              {hasDiscounts && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs line-through">
                    ₡{baseCost.toLocaleString()}
                  </span>
                  <span className="text-green-400 text-xs font-semibold">
                    -{Math.round((1 - cost / baseCost) * 100)}%
                  </span>
                </div>
              )}
              
              {/* Final cost after discounts */}
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-semibold text-sm">
                  ₡{cost.toLocaleString()}
                </span>
                {isCostEfficient && (
                  <span className="text-green-400 text-xs" title="Cost efficient upgrade">
                    ⭐
                  </span>
                )}
              </div>
              
              {/* Cost per point */}
              <span className="text-gray-400 text-xs">
                ₡{costPerPoint.toFixed(0)}/pt
              </span>
            </div>
          ) : (
            <span className="text-gray-500 text-sm">
              {isAtCap ? 'At Cap' : '—'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttributeUpgradeRow;
