/**
 * Tuning: how many robots are tuned, how much of the pool is used, points per
 * attribute group, and the attributes with the most points (top 10, or all
 * 23 on request). Moved here from the old `/admin/tuning` page.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { AdminPanel, ADMIN_FOCUS_RING } from '../shared';
import { attributeLabel, groupLabel } from '../../../utils/adminAttributesFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { formatPercentOf } from '../../../utils/adminMetaFormat';
import { BarRow, MetaStat, SectionLabel } from './metaParts';
import type { AttributeGroup, MetaTuning } from '@shared/types';

export interface TuningCardProps {
  tuning: MetaTuning | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const TOP_ATTRIBUTES = 10;

const GROUP_COLORS: Record<AttributeGroup, string> = {
  combat: 'bg-error',
  defence: 'bg-primary',
  chassis: 'bg-warning',
  ai: 'bg-info',
  team: 'bg-success',
};

/** Points with at most one decimal ("556", "12.5"). */
function formatPoints(points: number): string {
  return Number.isInteger(points) ? formatCount(points) : points.toFixed(1);
}

export function TuningCard({ tuning, loading, error = null, onRetry }: TuningCardProps): ReactNode {
  const [showAll, setShowAll] = useState(false);
  const groupTotal = tuning ? tuning.byGroup.reduce((sum, group) => sum + group.points, 0) : 0;
  const attributes = tuning ? tuning.attributes.filter((row) => row.points > 0) : [];
  const shown = showAll ? attributes : attributes.slice(0, TOP_ATTRIBUTES);
  const peak = attributes[0]?.points ?? 0;

  return (
    <AdminPanel
      headingLevel={3}
      title="Tuning"
      actions={<span className="text-xs text-secondary">Where tuning points go</span>}
      loading={loading && !tuning}
      error={error}
      onRetry={onRetry}
      skeletonRows={8}
    >
      {tuning && (tuning.totalRobots === 0 ? (
        <p className="p-5 text-sm text-tertiary">No robots</p>
      ) : (
        <div className="space-y-5 px-5 py-4">
          <dl className="grid grid-cols-2 gap-4">
            <MetaStat label="robots tuned" value={`${formatCount(tuning.robotsTuned)} of ${formatCount(tuning.totalRobots)}`} />
            <MetaStat
              label={`of the pool used · ${formatPoints(tuning.poolUsed)} of ${formatCount(tuning.poolTotal)} pts`}
              value={formatPercentOf(tuning.poolUsed, tuning.poolTotal)}
            />
          </dl>

          {groupTotal > 0 && (
            <div>
              <SectionLabel>Points by attribute group</SectionLabel>
              <div className="mt-2 flex h-3 overflow-hidden rounded bg-white/5" aria-hidden="true">
                {tuning.byGroup.filter((group) => group.points > 0).map((group) => (
                  <div key={group.group} className={`${GROUP_COLORS[group.group]} h-full`} style={{ width: `${(group.points / groupTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Tuning points by attribute group">
                {tuning.byGroup.map((group) => (
                  <li key={group.group} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${GROUP_COLORS[group.group]}`} />
                    <span className="text-white">{groupLabel(group.group)}</span>
                    <span className="tabular-nums text-secondary">{formatPoints(group.points)} ({formatPercentOf(group.points, groupTotal)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>{showAll ? 'All tuned attributes' : 'Top attributes'}</SectionLabel>
              <span className="text-xs text-secondary">points · robots</span>
            </div>
            {attributes.length === 0 ? (
              <p className="mt-2 text-sm text-tertiary">No tuning points allocated</p>
            ) : (
              <ul className="mt-2 space-y-1.5" aria-label="Tuning points per attribute">
                {shown.map((row) => (
                  <BarRow
                    key={row.attribute}
                    label={attributeLabel(row.attribute)}
                    share={peak > 0 ? row.points / peak : 0}
                    value={formatPoints(row.points)}
                    detail={`${formatCount(row.robots)}`}
                    srDetail={`points on ${formatCount(row.robots)} robots`}
                  />
                ))}
              </ul>
            )}
            {attributes.length > TOP_ATTRIBUTES && (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className={`mt-2 min-h-11 text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}
              >
                {showAll ? `Show top ${TOP_ATTRIBUTES}` : `Show all ${attributes.length} tuned attributes`}
              </button>
            )}
          </div>

          <p className="text-xs text-tertiary">Pool per robot: (Tuning Bay level + 1) × 10. Tuning Bay ownership is under Facilities.</p>
        </div>
      ))}
    </AdminPanel>
  );
}
