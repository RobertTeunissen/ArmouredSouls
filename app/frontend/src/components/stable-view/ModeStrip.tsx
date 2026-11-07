import { getTierColor, getTierName } from '../../utils/tierHelpers';
import { MODE_LONG_LABELS, MODE_SHORT_LABELS, tierLetter, type ModeCell } from '../../utils/stableViewFormat';

interface ModeStripProps {
  cells: readonly ModeCell[];
  /** Show the mode name above each cell (mobile rows have no column header). */
  showLabels?: boolean;
}

/**
 * Six cells, one per tiered mode, coloured by the robot's tier there. A dash
 * means the robot has not played that mode. The record and LP are in the
 * tooltip and the accessible label.
 */
export function ModeStrip({ cells, showLabels = false }: ModeStripProps) {
  return (
    <ul className="flex gap-1" aria-label="Tier per mode">
      {cells.map((cell) => {
        const mode = MODE_LONG_LABELS[cell.mode];
        const label = cell.tier
          ? `${mode}: ${getTierName(cell.tier)}${cell.detail ? `, ${cell.detail}` : ''}`
          : `${mode}: not played`;
        return (
          <li key={cell.mode} className="flex flex-col items-center gap-0.5">
            {showLabels && (
              <span className="text-[9px] uppercase leading-none text-tertiary" aria-hidden="true">
                {MODE_SHORT_LABELS[cell.mode]}
              </span>
            )}
            <span
              role="img"
              title={label}
              aria-label={label}
              data-testid={`mode-cell-${cell.mode}`}
              className={
                cell.tier
                  ? `flex h-5 w-7 items-center justify-center rounded bg-current/15 text-[11px] font-bold ${getTierColor(cell.tier)}`
                  : 'flex h-5 w-7 items-center justify-center rounded border border-dashed border-white/15 text-[11px] text-tertiary'
              }
            >
              <span aria-hidden="true">{cell.tier ? tierLetter(cell.tier) : '–'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default ModeStrip;
