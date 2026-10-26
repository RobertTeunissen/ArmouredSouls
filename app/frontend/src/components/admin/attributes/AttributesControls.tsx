/**
 * Controls of the Attributes page: date range, the mode column used for
 * sorting and the biggest-effects list, and the layer toggles. Everything goes
 * to the URL (see AttributesPage), so a view can be linked.
 */
import { useId, useState } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { ANALYSIS_COLUMNS, type AnalysisColumn, type AnalysisRange, type AttributeFilters, type LayerKey } from './types';
import {
  DEFAULT_ATTRIBUTE_FILTERS,
  LAYER_OPTIONS,
  RANGE_OPTIONS,
  columnDetail,
  columnLabel,
  layersSummary,
} from '../../../utils/adminAttributesFormat';

export interface AttributesControlsProps {
  filters: AttributeFilters;
  onChange: (next: Partial<AttributeFilters>) => void;
}

const SELECT = `min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-white ${ADMIN_FOCUS_RING}`;

function isDefault(filters: AttributeFilters): boolean {
  return filters.range === DEFAULT_ATTRIBUTE_FILTERS.range
    && filters.column === DEFAULT_ATTRIBUTE_FILTERS.column
    && LAYER_OPTIONS.every((o) => filters.toggles[o.key]);
}

export function AttributesControls({ filters, onChange }: AttributesControlsProps): React.ReactElement {
  const [layersOpen, setLayersOpen] = useState(false);
  const layersId = useId();
  const onCount = LAYER_OPTIONS.filter((o) => filters.toggles[o.key]).length;

  const toggleLayer = (key: LayerKey): void => onChange({ toggles: { ...filters.toggles, [key]: !filters.toggles[key] } });

  return (
    <section aria-label="Analysis settings" className="space-y-3 rounded-lg border border-white/10 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-secondary">
          <span>Battles from</span>
          <select
            value={filters.range}
            onChange={(e) => onChange({ range: e.target.value as AnalysisRange })}
            className={SELECT}
          >
            {RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>

        <div role="group" aria-labelledby={`${layersId}-column`} className="flex flex-wrap items-center gap-2">
          <span id={`${layersId}-column`} className="text-xs text-secondary">Sort by</span>
          {ANALYSIS_COLUMNS.map((column: AnalysisColumn) => {
            const active = filters.column === column;
            return (
              <button
                key={column}
                type="button"
                aria-pressed={active}
                title={columnDetail(column)}
                onClick={() => onChange({ column })}
                className={`min-h-11 rounded-full border px-4 text-xs font-semibold transition-colors motion-reduce:transition-none ${ADMIN_FOCUS_RING} ${
                  active ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/15 text-secondary hover:text-white'
                }`}
              >
                {columnLabel(column)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_ATTRIBUTE_FILTERS, toggles: { ...DEFAULT_ATTRIBUTE_FILTERS.toggles } })}
          disabled={isDefault(filters)}
          className={`ml-auto min-h-11 rounded px-2 text-sm text-primary hover:underline disabled:cursor-default disabled:text-tertiary disabled:no-underline ${ADMIN_FOCUS_RING}`}
        >
          Reset
        </button>
      </div>

      <div className="border-t border-white/5 pt-3">
        <button
          type="button"
          aria-expanded={layersOpen}
          aria-controls={layersId}
          onClick={() => setLayersOpen((open) => !open)}
          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded text-left text-sm text-white md:hidden ${ADMIN_FOCUS_RING}`}
        >
          <span>Layers <span className="text-secondary">({onCount}/{LAYER_OPTIONS.length} on)</span></span>
          <span aria-hidden="true" className="text-secondary">{layersOpen ? '▴' : '▾'}</span>
        </button>
        <fieldset id={layersId} className={`${layersOpen ? 'block' : 'hidden'} mt-2 md:mt-0 md:block`}>
          <legend className="mb-2 text-xs text-secondary">
            Attribute values used: <span className="text-white">{layersSummary(filters.toggles)}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center rounded-md border border-white/10 bg-background px-3 text-sm text-secondary" title="Always included">
              Base attributes
            </span>
            {LAYER_OPTIONS.map((o) => (
              <label
                key={o.key}
                title={o.description}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-2 focus-within:ring-primary ${
                  filters.toggles[o.key] ? 'border-primary/50 bg-primary/10 text-white' : 'border-white/10 text-secondary'
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters.toggles[o.key]}
                  onChange={() => toggleLayer(o.key)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span>+ {o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
