import { useState } from 'react';
import { RecordTile } from './RecordTile';
import { RECORD_GROUP_HEADINGS, bestPlaceIn, boardColumns } from '../../utils/hallOfRecords';
import type { MyPlace, RecordDefinition, RecordGroupKey } from './types';

/** Tiles a collapsed group shows on phones before "Show all". */
const MOBILE_COLLAPSED_TILES = 2;

export interface RecordBoardProps {
  /** Records to show (already filtered to the active group and "only mine"). */
  records: RecordDefinition[];
  groups: readonly RecordGroupKey[];
  viewerId: number | null;
  places: MyPlace[];
  detailHref: (record: RecordDefinition) => string;
  /**
   * On phones, show only the first tiles of each group with a "Show all"
   * button. Used for the full board; a single group or "only mine" shows all.
   */
  collapseOnMobile?: boolean;
  /** Heading level of the group titles (3 when the board sits under its own h2). */
  headingLevel?: 2 | 3;
  /** The one-line group notes describe the live season; the archive hides them. */
  showNotes?: boolean;
}

/** Static class names, so Tailwind sees both. */
const XL_COLUMNS: Record<3 | 4, string> = { 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4' };

/**
 * The record board: one tile per record, grouped under a heading per group.
 * Groups without a record to show are left out.
 */
export function RecordBoard({
  records, groups, viewerId, places, detailHref, collapseOnMobile = false, headingLevel = 2, showNotes = true,
}: RecordBoardProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const [expanded, setExpanded] = useState<ReadonlySet<RecordGroupKey>>(new Set());

  return (
    <div className="space-y-10">
      {groups.map((group) => {
        const inGroup = records.filter((record) => record.group === group);
        if (inGroup.length === 0) return null;
        const heading = RECORD_GROUP_HEADINGS[group];
        const collapsed = collapseOnMobile && !expanded.has(group) && inGroup.length > MOBILE_COLLAPSED_TILES;
        const gridId = `record-grid-${group}`;
        return (
          <section key={group} aria-labelledby={`record-group-${group}`} data-testid={`record-group-${group}`}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Heading id={`record-group-${group}`} className="text-lg font-semibold text-white">{heading.title}</Heading>
              {showNotes && <p className="text-sm text-secondary">{heading.note}</p>}
            </div>
            <div
              id={gridId}
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-flow-row-dense ${XL_COLUMNS[boardColumns(inGroup)]}`}
            >
              {inGroup.map((record, index) => (
                <RecordTile
                  key={record.key}
                  record={record}
                  detailHref={detailHref(record)}
                  viewerId={viewerId}
                  myBest={bestPlaceIn(record, places)}
                  className={collapsed && index >= MOBILE_COLLAPSED_TILES ? 'max-md:hidden' : ''}
                />
              ))}
            </div>
            {collapseOnMobile && inGroup.length > MOBILE_COLLAPSED_TILES && (
              <button
                type="button"
                onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(group)) next.delete(group);
                  else next.add(group);
                  return next;
                })}
                aria-expanded={!collapsed}
                aria-controls={gridId}
                className="mt-3 min-h-[44px] w-full rounded-lg border border-white/10 bg-surface text-sm font-medium text-primary hover:bg-surface-elevated md:hidden"
                data-testid={`record-group-toggle-${group}`}
              >
                {collapsed ? `Show all ${inGroup.length} records` : 'Show fewer'}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
