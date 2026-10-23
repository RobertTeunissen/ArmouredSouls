/**
 * How the arena is used over the window: opponents (matchups), sparring
 * partner tiers, batch sizes and what-if overrides. Bars are labelled with
 * their share, so colour is never the only signal.
 */
import type { ReactNode } from 'react';
import type { PracticeMatchup, PracticeUsage as Usage } from '../../../utils/adminPracticeArenaApi';
import { MATCHUP_LABELS, formatCount, share } from '../../../utils/adminPracticeArenaFormat';
import { AdminPanel } from '../shared';

export interface PracticeUsageProps {
  usage: Usage | null;
  windowDays: number;
  loading: boolean;
}

function ShareRow({ label, value, total }: { label: string; value: number; total: number }): ReactNode {
  const width = total > 0 ? (value / total) * 100 : 0;
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm">
      <span className="truncate text-white">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </span>
      <span className="text-right tabular-nums text-secondary">{share(value, total)}</span>
    </li>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-tertiary">{title}</h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

export function PracticeUsage({ usage, windowDays, loading }: PracticeUsageProps): ReactNode {
  const tierTotal = usage ? Object.values(usage.botTiers).reduce((sum, value) => sum + value, 0) : 0;
  return (
    <AdminPanel
      title="How it is used"
      loading={loading && !usage}
      skeletonRows={5}
      actions={usage ? <span className="text-xs text-secondary">last {windowDays} days · {formatCount(usage.battles)} battles</span> : undefined}
    >
      {usage && (
        usage.requests === 0 ? (
          <p className="p-5 text-sm text-secondary">No practice battles recorded in the last {windowDays} days.</p>
        ) : (
          <div className="space-y-5 p-4 sm:p-5">
            <Group title="Opponent (battles)">
              {(Object.keys(MATCHUP_LABELS) as PracticeMatchup[]).map((matchup) => (
                <ShareRow key={matchup} label={MATCHUP_LABELS[matchup]} value={usage.matchups[matchup]} total={usage.battles} />
              ))}
            </Group>
            {tierTotal > 0 && (
              <Group title="Sparring partner tier (battles)">
                {Object.entries(usage.botTiers).map(([tier, value]) => <ShareRow key={tier} label={tier} value={value} total={tierTotal} />)}
              </Group>
            )}
            <Group title="Batch size (requests)">
              <ShareRow label="Single battle" value={usage.batchSizes.single} total={usage.requests} />
              <ShareRow label="2–5 battles" value={usage.batchSizes.small} total={usage.requests} />
              <ShareRow label="6–10 battles" value={usage.batchSizes.large} total={usage.requests} />
            </Group>
            <p className="text-sm text-secondary">
              What-if overrides (attributes, weapons, stance or yield changed on an own robot) in{' '}
              <span className="text-white">{share(usage.overridesRequests, usage.requests)}</span> of requests.
            </p>
          </div>
        )
      )}
    </AdminPanel>
  );
}
