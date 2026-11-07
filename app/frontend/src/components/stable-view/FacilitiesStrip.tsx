import { useState } from 'react';
import { FACILITY_CATEGORIES } from '../../utils/facilityCategories';
import type { FacilitySummary } from './types';

interface FacilitiesStripProps {
  facilities: readonly FacilitySummary[];
}

const FACILITY_TYPE_COUNT = FACILITY_CATEGORIES.reduce((sum, c) => sum + c.facilityTypes.length, 0);

/** Built facilities as compact chips, highest level first. Collapsed on narrow screens. */
export function FacilitiesStrip({ facilities }: FacilitiesStripProps) {
  const [open, setOpen] = useState(false);
  const built = [...facilities]
    .filter((f) => f.level > 0)
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  const maxed = built.filter((f) => f.maxLevel > 0 && f.level >= f.maxLevel).length;
  const summary = `${built.length} of ${FACILITY_TYPE_COUNT} built${maxed > 0 ? ` · ${maxed} maxed` : ''}`;

  return (
    <section className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6" aria-labelledby="facilities-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="facilities-heading" className="text-lg font-semibold">
          Facilities <span className="ml-1 text-sm font-normal text-secondary">{summary}</span>
        </h3>
        {built.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="facility-chips"
            className="min-h-[44px] px-2 text-sm text-primary lg:hidden"
          >
            {open ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {built.length === 0 ? (
        <p className="mt-2 text-sm text-secondary">No facilities built yet.</p>
      ) : (
        <ul id="facility-chips" className={`${open ? 'flex' : 'hidden lg:flex'} mt-3 flex-wrap gap-2`}>
          {built.map((f) => {
            const isMax = f.maxLevel > 0 && f.level >= f.maxLevel;
            return (
              <li
                key={f.type}
                className="flex min-w-[10rem] items-center justify-between gap-3 rounded-md bg-surface-elevated px-3 py-1.5 text-xs"
                title={`Level ${f.level} of ${f.maxLevel}`}
              >
                <span>{f.name}</span>
                <span className={isMax ? 'font-bold text-success' : 'font-semibold'}>
                  {isMax ? 'MAX' : `Level ${f.level}/${f.maxLevel}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default FacilitiesStrip;
