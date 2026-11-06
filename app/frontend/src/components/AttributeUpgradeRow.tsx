import { useId, type KeyboardEvent, type ReactNode } from 'react';

interface AttributeUpgradeRowProps {
  attributeKey: string;
  label: string;
  icon: string;
  /** What the attribute does; shown as a hover/focus tooltip on the label (#572). */
  description?: string;
  currentLevel: number;
  plannedLevel: number;
  cost: number;
  baseCost: number;
  cap: number;
  isAtCap: boolean;
  hasPlannedChange: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onMax?: () => void;
  compact?: boolean;
}

interface AttributeInfoProps {
  /** Accessible name of the focusable block (label plus current level). */
  ariaLabel: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps the attribute icon + name. When a description is given, the block is
 * focusable and reveals the description on hover, keyboard focus or tap.
 * The tooltip stays in the DOM so `aria-describedby` works for screen readers;
 * Escape dismisses it by blurring the trigger.
 */
function AttributeInfo({ ariaLabel, description, className = '', children }: AttributeInfoProps) {
  const tooltipId = useId();

  if (!description) {
    return <div className={className}>{children}</div>;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') event.currentTarget.blur();
  };

  return (
    <div
      className={`group relative cursor-help rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      aria-describedby={tooltipId}
      onKeyDown={handleKeyDown}
    >
      {children}
      <div
        id={tooltipId}
        role="tooltip"
        className="
          invisible opacity-0 group-hover:visible group-hover:opacity-100
          group-focus:visible group-focus:opacity-100
          absolute left-0 top-full z-30 pt-1 w-64 max-w-[80vw]
          transition-opacity duration-150 motion-reduce:transition-none
        "
      >
        <div className="bg-surface-elevated border border-white/10 rounded-lg shadow-lg px-3 py-2 text-xs leading-relaxed text-secondary">
          {description}
        </div>
      </div>
    </div>
  );
}

function AttributeUpgradeRow({
  label,
  icon,
  description,
  currentLevel,
  plannedLevel,
  cost,
  baseCost,
  cap,
  isAtCap,
  hasPlannedChange,
  onIncrement,
  onDecrement,
  onMax,
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
            : 'bg-surface/50 hover:bg-gray-750'
          }
        `}
      >
        {/* Left: Attribute Info */}
        <AttributeInfo
          ariaLabel={`${label}, level ${currentLevel} of ${cap}`}
          description={description}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <span className="text-base" aria-hidden={description ? true : undefined}>{icon}</span>
          <div className="flex flex-col min-w-0">
            <div className="text-secondary text-xs font-medium truncate">{label}</div>
            <div className="text-xs text-tertiary">
              {currentLevel}/{cap}
            </div>
          </div>
        </AttributeInfo>

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
                ? 'bg-surface-elevated hover:bg-gray-600 text-white cursor-pointer'
                : 'bg-surface text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>

          {/* Level Display */}
          <div className="w-12 text-center">
            {hasPlannedChange ? (
              <span className="text-primary font-bold text-sm">{plannedLevel}</span>
            ) : (
              <span className="text-secondary text-sm">{currentLevel}</span>
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
                ? 'bg-primary hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-surface text-gray-600 cursor-not-allowed'
              }
            `}
            aria-label={`Increase ${label}`}
            title={isAtCap ? `At cap (${cap})` : `Upgrade ${label}`}
          >
            +
          </button>

          {/* Max Button */}
          {onMax && (
            <button
              onClick={onMax}
              disabled={isAtCap}
              className={`
                px-1.5 h-6 rounded flex items-center justify-center font-semibold text-[10px]
                transition-colors
                ${!isAtCap
                  ? 'bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 cursor-pointer'
                  : 'bg-surface text-gray-600 cursor-not-allowed'
                }
              `}
              aria-label={`Maximize ${label}`}
              title={isAtCap ? `At cap (${cap})` : `Maximize ${label}`}
            >
              ⇈
            </button>
          )}

          {/* Cost Display */}
          <div className="w-16 text-right">
            {hasPlannedChange ? (
              <span className="text-warning font-semibold text-xs">
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
          : 'bg-surface/50 hover:bg-gray-750'
        }
        ${isCostEfficient && hasPlannedChange ? 'ring-1 ring-green-500/30' : ''}
      `}
    >
      {/* Attribute Info */}
      <AttributeInfo
        ariaLabel={`${label}, level ${currentLevel} of ${cap}`}
        description={description}
        className="flex items-center gap-3 flex-1"
      >
        <span className="text-xl w-6" aria-hidden={description ? true : undefined}>{icon}</span>
        <div className="flex flex-col">
          <span className="text-secondary text-sm min-w-[180px]">{label}</span>
          <span className="text-xs text-tertiary">
            Level {currentLevel} / {cap}
          </span>
        </div>
      </AttributeInfo>

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
              ? 'bg-surface-elevated hover:bg-gray-600 text-white cursor-pointer'
              : 'bg-surface text-gray-600 cursor-not-allowed'
            }
          `}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>

        {/* Planned Level Display */}
        {hasPlannedChange && (
          <div className="flex items-center gap-2">
            <span className="text-primary text-sm">→</span>
            <span className="text-primary font-bold text-lg min-w-[40px] text-center">
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
              ? 'bg-primary hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-surface text-gray-600 cursor-not-allowed'
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
                  <span className="text-tertiary text-xs line-through">
                    ₡{baseCost.toLocaleString()}
                  </span>
                  <span className="text-success text-xs font-semibold">
                    -{Math.round((1 - cost / baseCost) * 100)}%
                  </span>
                </div>
              )}
              
              {/* Final cost after discounts */}
              <div className="flex items-center gap-2">
                <span className="text-warning font-semibold text-sm">
                  ₡{cost.toLocaleString()}
                </span>
                {isCostEfficient && (
                  <span className="text-success text-xs" title="Cost efficient upgrade">
                    ⭐
                  </span>
                )}
              </div>
              
              {/* Cost per point */}
              <span className="text-secondary text-xs">
                ₡{costPerPoint.toFixed(0)}/pt
              </span>
            </div>
          ) : (
            <span className="text-tertiary text-sm">
              {isAtCap ? 'At Cap' : '—'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AttributeUpgradeRow;
