/**
 * What a rollover would do now: stables by type (kept and reset, or deleted),
 * retained images, and the rows it empties in three groups that expand to the
 * per-table counts.
 */
import type { ReactNode } from 'react';
import type { RolloverPreview, StableTypeCounts } from '../../../utils/seasonApi';
import { formatCount, groupPurgeTables } from '../../../utils/adminSeasonFormat';
import { ADMIN_FOCUS_RING } from '../shared';

function StableTile({ label, counts, effect, tone }: { label: string; counts: StableTypeCounts; effect: string; tone: 'keep' | 'delete' }): ReactNode {
  return (
    <div className={`min-w-0 rounded-lg border px-4 py-3 ${tone === 'delete' ? 'border-error/30 bg-error/[0.05]' : 'border-white/10 bg-surface-elevated'}`}>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-white">
        {formatCount(counts.stables)} <span className="text-sm font-normal text-secondary">stables · {formatCount(counts.robots)} robots</span>
      </dd>
      <dd className={`mt-0.5 text-xs ${tone === 'delete' ? 'text-error' : 'text-success'}`}>
        <span aria-hidden="true">{tone === 'delete' ? '✗ ' : '✓ '}</span>{effect}
      </dd>
    </div>
  );
}

/** Human stables with no login this season: archived, then deleted. */
function DormantStables({ dormant }: { dormant: RolloverPreview['dormantHumanStables'] }): ReactNode {
  if (dormant.count === 0) {
    return <p className="text-xs text-secondary">Every human stable has logged in this season; none is deleted as dormant.</p>;
  }
  const more = dormant.count - dormant.names.length;
  return (
    <details data-testid="rollover-dormant" className="group rounded-lg border border-error/30 bg-error/[0.05]">
      <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm ${ADMIN_FOCUS_RING}`}>
        <span className="flex items-center gap-2 text-white">
          <span aria-hidden="true" className="text-secondary group-open:rotate-90">▸</span>
          Dormant human stables
        </span>
        <span className="text-error">
          <span aria-hidden="true">✗ </span>{formatCount(dormant.count)} deleted: no login this season
        </span>
      </summary>
      <div className="border-t border-white/10 px-4 py-2 text-xs text-secondary">
        <p className="mb-1">Archived like every stable, then the accounts are deleted. Admins are never deleted. Players can register again.</p>
        <p className="text-white">{dormant.names.join(', ')}{more > 0 ? ` and ${formatCount(more)} more` : ''}</p>
      </div>
    </details>
  );
}

export function RolloverPreviewView({ preview }: { preview: RolloverPreview }): ReactNode {
  const groups = groupPurgeTables(preview.rowsToPurge);
  const totalRows = groups.reduce((sum, group) => sum + group.total, 0);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StableTile label="Human players" counts={preview.breakdown.human} tone="keep" effect="Archived, then reset to starting credits (dormant ones deleted, below)" />
        <StableTile label="Automatons" counts={preview.breakdown.automaton} tone="keep" effect="Archived, reset, then take an opening turn" />
        <StableTile label="Generated stables" counts={preview.breakdown.generated} tone="delete" effect="Deleted; their results stay in the archive" />
      </dl>
      <DormantStables dormant={preview.dormantHumanStables} />
      <p className="text-xs text-secondary">
        {formatCount(preview.imagesRetained)} uploaded robot image{preview.imagesRetained === 1 ? '' : 's'} kept in the image library
        {preview.imagesDeleted > 0 ? `, ${formatCount(preview.imagesDeleted)} deleted` : ', none deleted'}.
      </p>
      <div>
        <h3 className="mb-2 text-sm font-medium text-white">
          Rows emptied <span className="font-normal text-secondary">· {formatCount(totalRows)} in total</span>
        </h3>
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.label}>
              <details className="group rounded-lg border border-white/10 bg-surface-elevated">
                <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2 text-sm hover:bg-white/5 ${ADMIN_FOCUS_RING}`}>
                  <span className="flex items-center gap-2 text-white">
                    <span aria-hidden="true" className="text-secondary group-open:rotate-90 motion-reduce:transition-none">▸</span>
                    {group.label}
                  </span>
                  <span className="tabular-nums text-secondary">{formatCount(group.total)} rows</span>
                </summary>
                <dl className="grid grid-cols-1 gap-x-6 border-t border-white/10 px-4 py-2 text-xs sm:grid-cols-2">
                  {group.tables.map((row) => (
                    <div key={row.table} className="flex justify-between gap-3 border-b border-white/5 py-1 last:border-b-0">
                      <dt className="truncate font-mono text-secondary">{row.table}</dt>
                      <dd className="tabular-nums text-white">{formatCount(row.rows)}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
