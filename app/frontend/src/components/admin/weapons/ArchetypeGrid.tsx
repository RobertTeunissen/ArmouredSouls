/**
 * Archetypes: main weapon range band (rows) × loadout (columns). Each cell is
 * the win-chance effect against an equally strong average robot, coloured only
 * when significant, with the share of all robots and of players' robots.
 */
import { LOADOUTS, RANGE_BANDS, type AnalysisColumn, type ArchetypeRow } from './types';
import { effectDescription, formatEffect } from '../../../utils/adminAttributesFormat';
import { archetypeLabel, bandLabel, effectCellClass as cellClass, formatUsage, loadoutLabel } from '../../../utils/adminWeaponsFormat';

export interface ArchetypeGridProps {
  archetypes: ArchetypeRow[];
  column: AnalysisColumn;
}

export function ArchetypeGrid({ archetypes, column }: ArchetypeGridProps): React.ReactElement {
  const byKey = new Map(archetypes.map((a) => [a.key, a]));
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <p className="text-xs text-secondary">
        Win-chance change (percentage points) against an equally strong robot: same points invested, same stance. Coloured when at least twice its error.
      </p>
      <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Effect of each range band and loadout combination on win chance, with its share of all robots and of players&apos; robots.</caption>
        <thead>
          <tr>
            <td className="w-14 sm:w-20" />
            {LOADOUTS.map((loadout) => (
              <th key={loadout} scope="col" className="pb-1 text-center text-xs font-normal text-secondary">
                <span className="sr-only sm:not-sr-only">{loadoutLabel(loadout)}</span>
                <span aria-hidden="true" className="sm:hidden">{loadoutLabel(loadout, true)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANGE_BANDS.map((band) => (
            <tr key={band}>
              <th scope="row" className="pr-1 text-left text-xs font-normal text-secondary sm:text-sm">{bandLabel(band)}</th>
              {LOADOUTS.map((loadout) => {
                const row = byKey.get(`${band}+${loadout}`);
                const result = row?.results[column];
                const estimate = result?.effect ?? { effect: null, se: null, significant: false };
                return (
                  <td
                    key={loadout}
                    data-testid={`archetype-${band}+${loadout}`}
                    title={`${archetypeLabel(`${band}+${loadout}`)}: ${effectDescription(estimate)}`}
                    className={`h-14 rounded-md px-1 text-center align-middle tabular-nums ${cellClass(estimate)}`}
                  >
                    <span className={`block text-sm ${estimate.significant ? 'font-semibold' : ''}`}>
                      {estimate.effect === null ? <span className="text-xs text-tertiary">too few</span> : formatEffect(estimate.effect).replace(' pp', '')}
                      {estimate.effect !== null && !estimate.significant && <span className="sr-only"> (not significant)</span>}
                    </span>
                    <span className="block text-[11px] text-secondary">
                      <span className="hidden sm:inline">{formatUsage(result?.share ?? 0)} · </span>
                      <span className="sr-only">players </span>
                      <span aria-hidden="true">P </span>{formatUsage(result?.playersShare ?? null)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-tertiary">Grey: within noise. &quot;6.1% · P 54%&quot;: share of all robots that fought / of players&apos; robots.</p>
    </div>
  );
}
