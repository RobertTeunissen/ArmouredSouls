/**
 * Stables tab (Spec #55, R11.2, R11.12, PLAYER_FACING_TEXT §6.3, task 10.2):
 * every Automaton with its progress, filter chips with counts (All · Active ·
 * Draft · Needs attention; `ToggleChip`, the selected one shows a check
 * mark), a toolbar (strategy filter, search, sort), the
 * result count, and Activate all drafts with confirmation. Filtering and
 * sorting are client-side over the full list (`stablesView.ts`); the state
 * lives in the URL (`AutomatonsPage`). A table from 768 px, cards below.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActivateAllOutcome, LibraryStrategy, ProfileListItem } from '../../../utils/automatonAdminApi';
import { ActionButton, ConfirmDialog, FOCUS_RING, Notice, ToggleChip } from './ui';
import { errorText } from './requestErrors';
import { deriveStablesView, strategyOptions, type StableSort, type StablesFilter } from './stablesView';
import { StablesToolbar } from './StablesToolbar';
import { StablesList } from './StablesList';

export type { StablesFilter } from './stablesView';

export interface StablesTabProps {
  profiles: ProfileListItem[] | null;
  strategies: LibraryStrategy[] | null;
  filter: StablesFilter;
  strategyFilter: string | null;
  query: string;
  sort: StableSort | null;
  onFilterChange: (filter: StablesFilter) => void;
  onStrategyChange: (key: string | null) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: StableSort | null) => void;
  onClearFilters: () => void;
  onOpenStable: (catalogueKey: string) => void;
  onActivateAll: () => Promise<ActivateAllOutcome[]>;
}

const CHIPS: readonly { key: StablesFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'attention', label: 'Needs attention' },
];

export function StablesTab({
  profiles, strategies, filter, strategyFilter, query, sort,
  onFilterChange, onStrategyChange, onQueryChange, onSortChange, onClearFilters, onOpenStable, onActivateAll,
}: StablesTabProps): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const view = useMemo(
    () => deriveStablesView(profiles, { filter, strategy: strategyFilter, query, sort }),
    [profiles, filter, strategyFilter, query, sort],
  );
  const options = useMemo(() => strategyOptions(profiles, strategies), [profiles, strategies]);
  const strategyLabel = options.find((s) => s.key === strategyFilter)?.displayName ?? strategyFilter;
  const draftCount = (profiles ?? []).filter((p) => p.status === 'draft').length;

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

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter stables">
          {CHIPS.map((chip) => (
            <ToggleChip key={chip.key} pressed={filter === chip.key} onClick={() => onFilterChange(chip.key)} className="px-3">
              {chip.label} · {view.counts[chip.key]}
            </ToggleChip>
          ))}
          {strategyFilter !== null && (
            <button type="button" onClick={() => onStrategyChange(null)} className={`min-h-11 px-3 rounded-full text-sm bg-surface-elevated text-white ${FOCUS_RING}`}>
              Strategy: {strategyLabel} <span aria-hidden="true">✕</span><span className="sr-only">, remove</span>
            </button>
          )}
        </div>
        <ActionButton variant="primary" className="w-full sm:w-auto" disabled={draftCount === 0} onClick={() => setConfirming(true)}>
          Activate all drafts
        </ActionButton>
      </div>

      <StablesToolbar
        strategies={options}
        strategy={strategyFilter}
        query={query}
        sort={sort}
        onStrategyChange={onStrategyChange}
        onQueryChange={onQueryChange}
        onSortChange={onSortChange}
      />

      {result && <Notice tone={result.tone}>{result.text}</Notice>}

      {profiles === null ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : (
        <>
          <p role="status" className="text-sm text-secondary">{view.rows.length} of {view.total} stables</p>
          {profiles.length === 0 ? (
            <p className="text-sm text-secondary">No stables yet.</p>
          ) : view.rows.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-secondary">No stables match these filters.</p>
              <ActionButton onClick={onClearFilters}>Clear filters</ActionButton>
            </div>
          ) : (
            <StablesList rows={view.rows} sort={sort} onSortChange={onSortChange} onOpenStable={onOpenStable} />
          )}
        </>
      )}

      <p className="text-xs text-secondary">A stable needs attention when its last cycle failed, its balance is negative, or it has bought nothing for 14 cycles or more.</p>
      <p className="text-xs text-secondary">Highest tier (any mode): the highest league tier one of the stable's robots or teams holds right now (not its peak this season), with the mode it is in. Only modes the stable has actually played count; tournaments have no tier.</p>

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
