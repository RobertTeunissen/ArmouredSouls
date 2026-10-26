/**
 * Attribute effects: a table of the 23 attributes × mode columns from `md`
 * up, one card per attribute (selected column) below it. Sorted by the
 * selected column's effect, or in group order.
 */
import { useMemo, useState } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { EffectValue } from './EffectCell';
import { ANALYSIS_COLUMNS, ATTRIBUTE_GROUPS, type AnalysisColumn, type AnalysisColumnSummary, type AttributeEffectRow } from './types';
import { attributeLabel, columnLabel, formatShare, groupLabel } from '../../../utils/adminAttributesFormat';

export interface AttributeHeatmapProps {
  attributes: AttributeEffectRow[];
  columns: AnalysisColumnSummary[];
  column: AnalysisColumn;
}

type SortOrder = 'effect' | 'group';

function sortRows(rows: AttributeEffectRow[], column: AnalysisColumn, order: SortOrder): AttributeEffectRow[] {
  const groupIndex = (row: AttributeEffectRow): number => ATTRIBUTE_GROUPS.indexOf(row.group);
  if (order === 'group') return [...rows].sort((a, b) => groupIndex(a) - groupIndex(b));
  return [...rows].sort((a, b) => {
    const ea = a.effects[column].effect;
    const eb = b.effects[column].effect;
    if (ea === null && eb === null) return groupIndex(a) - groupIndex(b);
    if (ea === null) return 1;
    if (eb === null) return -1;
    return eb - ea;
  });
}

export function AttributeHeatmap({ attributes, columns, column }: AttributeHeatmapProps): React.ReactElement {
  const [order, setOrder] = useState<SortOrder>('effect');
  const rows = useMemo(() => sortRows(attributes, column, order), [attributes, column, order]);
  const summary = (c: AnalysisColumn): AnalysisColumnSummary | undefined => columns.find((s) => s.column === c);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <p className="text-xs text-secondary">
          Win-chance change for moving 5 share points into the attribute, taken evenly from the others, against an opponent with the same total. Coloured when it is at least twice its error.
        </p>
        <div role="group" aria-label="Order" className="flex gap-1">
          {(['effect', 'group'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={order === value}
              onClick={() => setOrder(value)}
              className={`min-h-11 rounded-md px-3 text-xs ${ADMIN_FOCUS_RING} ${order === value ? 'bg-surface-elevated text-white' : 'text-secondary hover:text-white'}`}
            >
              {value === 'effect' ? `By effect (${columnLabel(column)})` : 'By group'}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Effect of each attribute on win chance in percentage points, per mode, with its standard error, and its average share of points.
          </caption>
          <thead className="bg-surface-elevated text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th scope="col" className="px-5 py-3 text-left">Attribute</th>
              <th scope="col" className="px-3 py-3 text-left">Group</th>
              {ANALYSIS_COLUMNS.map((c) => {
                const s = summary(c);
                return (
                  <th key={c} scope="col" className={`px-2 py-3 text-center ${c === column ? 'text-primary' : ''}`}>
                    {columnLabel(c)}
                    {s && !s.enough && <span className="block text-[10px] font-normal normal-case text-tertiary">too few battles</span>}
                  </th>
                );
              })}
              <th scope="col" className="px-3 py-3 text-right">Avg share</th>
              <th scope="col" className="px-5 py-3 text-right">Players&apos; share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.attribute} className="border-t border-white/5">
                <th scope="row" className="whitespace-nowrap px-5 py-1.5 text-left font-normal text-white">{attributeLabel(row.attribute)}</th>
                <td className="px-3 py-1.5 text-secondary">{groupLabel(row.group)}</td>
                {ANALYSIS_COLUMNS.map((c) => (
                  <td key={c} className={`px-2 py-1.5 text-center ${c === column ? 'bg-white/[0.03]' : ''}`}>
                    <EffectValue estimate={row.effects[c]} />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right tabular-nums text-secondary">{formatShare(row.avgShare)}</td>
                <td className="px-5 py-1.5 text-right tabular-nums text-secondary">{formatShare(row.playersAvgShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 px-4 pb-4 md:hidden" aria-label={`Attribute effects, ${columnLabel(column)}`}>
        {rows.map((row) => (
          <li key={row.attribute} className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{attributeLabel(row.attribute)}</p>
              <p className="text-xs text-secondary">
                {groupLabel(row.group)} · share {formatShare(row.avgShare)} · players {formatShare(row.playersAvgShare)}
              </p>
            </div>
            <EffectValue estimate={row.effects[column]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
