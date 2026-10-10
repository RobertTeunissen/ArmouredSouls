/**
 * Stables tab (Spec #55, R11.2, R11.12, PLAYER_FACING_TEXT §6.3, task 10.2):
 * every Automaton with its progress, filter chips with counts (All · Active ·
 * Draft · Needs attention), a strategy filter from the Strategies tab, and
 * Activate all drafts with confirmation. A table from 768 px, cards below.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActivateAllOutcome, ProfileListItem } from '../../../utils/automatonAdminApi';
import { ActionButton, ConfirmDialog, FOCUS_RING, Notice, Pill } from './ui';
import { errorText } from './requestErrors';
import { formatCredits, formatNumber, lastCycleText, needAttentionText, tierLabel } from './automatonText';

export type StablesFilter = 'all' | 'active' | 'draft' | 'attention';

export interface StablesTabProps {
  profiles: ProfileListItem[] | null;
  filter: StablesFilter;
  strategyFilter: string | null;
  onFilterChange: (filter: StablesFilter) => void;
  onClearStrategy: () => void;
  onOpenStable: (catalogueKey: string) => void;
  onActivateAll: () => Promise<ActivateAllOutcome[]>;
}

function matches(item: ProfileListItem, filter: StablesFilter): boolean {
  if (filter === 'active') return item.status === 'active';
  if (filter === 'draft') return item.status === 'draft';
  if (filter === 'attention') return item.needAttention.length > 0;
  return true;
}

function strategyName(item: ProfileListItem): string {
  return item.strategyDisplayName ?? item.strategyKey;
}

function robotsText(item: ProfileListItem): string {
  const target = item.robots.target === null ? '—' : String(item.robots.target);
  return item.status === 'draft' ? `— / ${target}` : `${item.robots.current} / ${target}`;
}

const dash = (value: number | null, format: (n: number) => string): string => (value === null ? '—' : format(value));

export function StablesTab({ profiles, filter, strategyFilter, onFilterChange, onClearStrategy, onOpenStable, onActivateAll }: StablesTabProps): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const scoped = useMemo(
    () => (profiles ?? []).filter((p) => strategyFilter === null || p.strategyKey === strategyFilter),
    [profiles, strategyFilter],
  );
  const counts: Record<StablesFilter, number> = {
    all: scoped.length,
    active: scoped.filter((p) => matches(p, 'active')).length,
    draft: scoped.filter((p) => matches(p, 'draft')).length,
    attention: scoped.filter((p) => matches(p, 'attention')).length,
  };
  const rows = scoped.filter((p) => matches(p, filter));
  const draftCount = (profiles ?? []).filter((p) => p.status === 'draft').length;

  const chips: { key: StablesFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: 'attention', label: 'Needs attention' },
  ];

  const activate = async (): Promise<void> => {
    setBusy(true);
    try {
      const outcomes = await onActivateAll();
      const activated = outcomes.filter((o) => o.outcome === 'activated').length;
      const rejected = outcomes.flatMap((o) => (o.outcome === 'rejected' ? [`${o.catalogueKey}: ${o.message}`] : []));
      setResult({
        tone: rejected.length > 0 ? 'error' : 'success',
        text: `Activated ${activated} stables.${rejected.length > 0 ? ` Not activated: ${rejected.join(' · ')}` : ''}`,
      });
      setConfirming(false);
    } catch (err) {
      setResult({ tone: 'error', text: errorText(err, 'The drafts could not be activated.') });
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const stableLink = (item: ProfileListItem): ReactNode => (
    <button type="button" onClick={() => onOpenStable(item.catalogueKey)} className={`min-h-11 text-left font-medium text-primary underline-offset-2 hover:underline ${FOCUS_RING}`}>
      {item.stableName}
    </button>
  );

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter stables">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={filter === chip.key}
              onClick={() => onFilterChange(chip.key)}
              className={`min-h-11 px-3 rounded-full text-sm font-medium ${FOCUS_RING} ${filter === chip.key ? 'bg-primary text-white' : 'bg-surface-elevated text-secondary hover:text-white'}`}
            >
              {chip.label} · {counts[chip.key]}
            </button>
          ))}
          {strategyFilter !== null && (
            <button type="button" onClick={onClearStrategy} className={`min-h-11 px-3 rounded-full text-sm bg-surface-elevated text-white ${FOCUS_RING}`}>
              Strategy: {strategyFilter} ✕
            </button>
          )}
        </div>
        <ActionButton variant="primary" className="w-full sm:w-auto" disabled={draftCount === 0} onClick={() => setConfirming(true)}>
          Activate all drafts
        </ActionButton>
      </div>

      {result && <Notice tone={result.tone}>{result.text}</Notice>}

      {profiles === null ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-secondary">No stables match this filter.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-secondary border-b border-white/10">
                  {['Stable', 'Strategy', 'Status', 'Robots', 'Credits', 'Prestige', 'Best tier', 'Last cycle', 'Needs attention'].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.catalogueKey} className="border-b border-white/5 align-top">
                    <td className="py-1 pr-3">{stableLink(item)}</td>
                    <td className="py-3 pr-3">{strategyName(item)}</td>
                    <td className="py-3 pr-3"><Pill tone={item.status}>{item.status === 'active' ? 'Active' : 'Draft'}</Pill></td>
                    <td className="py-3 pr-3 whitespace-nowrap">{robotsText(item)}</td>
                    <td className={`py-3 pr-3 whitespace-nowrap ${item.credits !== null && item.credits < 0 ? 'text-red-300' : ''}`}>{dash(item.credits, formatCredits)}</td>
                    <td className="py-3 pr-3">{dash(item.prestige, formatNumber)}</td>
                    <td className="py-3 pr-3">{item.status === 'draft' ? '—' : tierLabel(item.bestTier)}</td>
                    <td className="py-3 pr-3">{lastCycleText(item)}</td>
                    <td className="py-3 pr-3">{needAttentionText(item.needAttention)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-3" aria-label="Stables">
            {rows.map((item) => (
              <li key={item.catalogueKey} className="rounded-lg border border-white/10 bg-surface p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  {stableLink(item)}
                  <Pill tone={item.status}>{item.status === 'active' ? 'Active' : 'Draft'}</Pill>
                </div>
                <p className="text-secondary">{strategyName(item)}</p>
                <dl className="mt-2 space-y-1">
                  {item.status === 'active' && (
                    <>
                      <div className="flex justify-between gap-2"><dt className="text-secondary">Robots</dt><dd>{robotsText(item)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-secondary">Credits</dt><dd>{dash(item.credits, formatCredits)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-secondary">Prestige · tier</dt><dd>{dash(item.prestige, formatNumber)} · {tierLabel(item.bestTier)}</dd></div>
                    </>
                  )}
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Last cycle</dt><dd className="text-right">{lastCycleText(item)}</dd></div>
                  {item.needAttention.length > 0 && (
                    <div className="flex justify-between gap-2"><dt className="text-secondary">Needs attention</dt><dd className="text-right">{needAttentionText(item.needAttention)}</dd></div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-secondary">A stable needs attention when its last cycle failed, its balance is negative, or it has bought nothing for 14 cycles or more.</p>

      {confirming && (
        <ConfirmDialog
          title="Activate all drafts"
          message={`Activate ${draftCount} draft stables? Each one joins the game with ₡3,000,000 and starts building after the next settlement. Activation cannot be undone.`}
          confirmLabel="Activate all drafts"
          busy={busy}
          onConfirm={() => void activate()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
