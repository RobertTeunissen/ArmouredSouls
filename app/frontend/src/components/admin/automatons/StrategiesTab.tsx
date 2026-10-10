/**
 * Strategies tab (Spec #55, R6.6, R6.9–R6.14, R11.13, PLAYER_FACING_TEXT
 * §6.4–§6.4b, design §17.2, task 10.4): two views, Comparison and Library;
 * the Strategy_Builder opens as a sub-view of the Library.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createStrategyDraft,
  getStrategyComparison,
  listStrategyDrafts,
  type DraftSummary,
  type LibraryStrategy,
  type ProfileListItem,
  type StrategyComparison,
} from '../../../utils/automatonAdminApi';
import { FOCUS_RING } from './ui';
import { errorText } from './requestErrors';
import { StrategyComparisonTable } from './StrategyComparisonTable';
import { StrategyLibrary } from './StrategyLibrary';
import { StrategyBuilder } from './StrategyBuilder';
import { StrategyUpgradeDialog } from './StrategyUpgradeDialog';

export type StrategiesView = 'comparison' | 'library';

export interface StrategiesTabProps {
  view: StrategiesView;
  draftId: number | null;
  strategies: LibraryStrategy[] | null;
  libraryError: string | null;
  profiles: ProfileListItem[];
  onViewChange: (view: StrategiesView) => void;
  onOpenDraft: (draftId: number | null) => void;
  onOpenStrategy: (strategyKey: string) => void;
  /** Profiles or the library changed (an upgrade). */
  onChanged: () => void;
}

export function StrategiesTab({ view, draftId, strategies, libraryError, profiles, onViewChange, onOpenDraft, onOpenStrategy, onChanged }: StrategiesTabProps): ReactNode {
  const [comparison, setComparison] = useState<StrategyComparison | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [upgrading, setUpgrading] = useState<LibraryStrategy | null>(null);

  const loadDrafts = useCallback((): void => {
    listStrategyDrafts().then((r) => setDrafts(r.drafts)).catch(() => setDrafts([]));
  }, []);

  useEffect(() => {
    if (view !== 'comparison') return;
    let cancelled = false;
    getStrategyComparison()
      .then((c) => { if (!cancelled) setComparison(c); })
      .catch((err: unknown) => { if (!cancelled) setComparisonError(errorText(err, 'The comparison could not be loaded.')); });
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => {
    if (view === 'library') loadDrafts();
  }, [view, loadDrafts]);

  const views: { key: StrategiesView; label: string }[] = [
    { key: 'comparison', label: 'Comparison' },
    { key: 'library', label: 'Library' },
  ];

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Strategies view">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => { onOpenDraft(null); onViewChange(v.key); }}
            className={`min-h-11 px-4 rounded-full text-sm font-medium ${FOCUS_RING} ${view === v.key ? 'bg-primary text-white' : 'bg-surface-elevated text-secondary hover:text-white'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'comparison' && (
        <StrategyComparisonTable comparison={comparison} error={comparisonError} onOpenStrategy={onOpenStrategy} />
      )}

      {view === 'library' && draftId !== null && (
        <StrategyBuilder draftId={draftId} profiles={profiles} onBack={() => onOpenDraft(null)} onChanged={loadDrafts} />
      )}

      {view === 'library' && draftId === null && (
        <StrategyLibrary
          strategies={strategies}
          drafts={drafts}
          error={libraryError}
          onNewStrategy={async ({ key, displayName }) => {
            const draft = await createStrategyDraft({ key, ...(displayName ? { displayName } : {}) });
            loadDrafts();
            onOpenDraft(draft.id);
          }}
          onNewVersion={async (strategy) => {
            const draft = await createStrategyDraft({ basedOn: `${strategy.key}.v${strategy.latestVersion}` });
            loadDrafts();
            onOpenDraft(draft.id);
          }}
          onUpgrade={setUpgrading}
          onOpenDraft={onOpenDraft}
        />
      )}

      {upgrading && (
        <StrategyUpgradeDialog strategy={upgrading} onClose={() => setUpgrading(null)} onUpgraded={onChanged} />
      )}
    </div>
  );
}
