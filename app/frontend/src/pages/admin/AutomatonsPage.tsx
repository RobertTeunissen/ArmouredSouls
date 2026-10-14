/**
 * AutomatonsPage — `/admin/automatons` (Spec #55, R11.9–R11.13,
 * PLAYER_FACING_TEXT §6.1, design §17.2, task 10.2).
 *
 * The Status_Bar sits above four sections — Stables, Strategies, Editor,
 * Catalogue — in the `TabLayout` pattern (`frontend-standards.md`): tabs at
 * ≥ 1024 px, the sections stacked from 320 px to 1023 px. The active tab and
 * the section state (filters, `q` search, `sort`, Strategies view, open draft, open stable) live
 * in the URL query, so they survive a refresh. Local state only; no store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  activateAllDrafts,
  getStatus,
  getStrategyLibrary,
  listAllProfiles,
  setProgramSwitch,
  type AutomatonStatusBar as StatusBarData,
  type LibraryStrategy,
  type ProfileListItem,
} from '../../utils/automatonAdminApi';
import { AutomatonStatusBar } from '../../components/admin/automatons/AutomatonStatusBar';
import { StablesTab, type StablesFilter } from '../../components/admin/automatons/StablesTab';
import { parseStableSort, serializeStableSort } from '../../components/admin/automatons/stablesView';
import { StrategiesTab, type StrategiesView } from '../../components/admin/automatons/StrategiesTab';
import { EditorTab } from '../../components/admin/automatons/EditorTab';
import { CatalogueTab } from '../../components/admin/automatons/CatalogueTab';
import { FOCUS_RING, Notice } from '../../components/admin/automatons/ui';
import { errorText } from '../../components/admin/automatons/requestErrors';
import { AdminPageHeader } from '../../components/admin/shared';

export type AutomatonsTab = 'stables' | 'strategies' | 'editor' | 'catalogue';

const AUTOMATON_TABS: readonly { id: AutomatonsTab; label: string }[] = [
  { id: 'stables', label: 'Stables' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'editor', label: 'Editor' },
  { id: 'catalogue', label: 'Catalogue' },
];

const FILTERS: readonly StablesFilter[] = ['all', 'active', 'draft', 'attention'];

function readTab(value: string | null): AutomatonsTab {
  return AUTOMATON_TABS.some((t) => t.id === value) ? (value as AutomatonsTab) : 'stables';
}

export default function AutomatonsPage(): ReactNode {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [params, setParams] = useSearchParams();
  const tab = readTab(params.get('tab'));
  const filter: StablesFilter = FILTERS.includes(params.get('filter') as StablesFilter) ? (params.get('filter') as StablesFilter) : 'all';
  const strategyFilter = params.get('strategy');
  const query = params.get('q') ?? '';
  const sortParam = params.get('sort');
  const sort = useMemo(() => parseStableSort(sortParam), [sortParam]);
  const strategiesView: StrategiesView = params.get('view') === 'library' ? 'library' : 'comparison';
  const draftParam = Number(params.get('draft'));
  const draftId = Number.isInteger(draftParam) && draftParam > 0 ? draftParam : null;
  const selectedKey = params.get('stable');

  const [status, setStatus] = useState<StatusBarData | null>(null);
  const [profiles, setProfiles] = useState<ProfileListItem[] | null>(null);
  const [library, setLibrary] = useState<LibraryStrategy[] | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tabRefs = useRef(new Map<AutomatonsTab, HTMLButtonElement>());

  const update = useCallback((patch: Record<string, string | null>): void => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoadError(null);
    const [statusResult, profilesResult, libraryResult] = await Promise.allSettled([getStatus(), listAllProfiles(), getStrategyLibrary()]);
    if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
    if (profilesResult.status === 'fulfilled') setProfiles(profilesResult.value);
    else setLoadError(errorText(profilesResult.reason, 'The stables could not be loaded.'));
    if (libraryResult.status === 'fulfilled') setLibrary(libraryResult.value.strategies);
    else setLibraryError(errorText(libraryResult.reason, 'The strategy library could not be loaded.'));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleProgram = async (turnsEnabled: boolean): Promise<void> => {
    await setProgramSwitch(turnsEnabled);
    setStatus(await getStatus());
  };

  const showNeedsAttention = (): void => update({ tab: 'stables', filter: 'attention', strategy: null, q: null });
  const openStable = (key: string | null): void => update({ tab: 'editor', stable: key });

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: AUTOMATON_TABS.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = AUTOMATON_TABS[(keys[event.key] + AUTOMATON_TABS.length) % AUTOMATON_TABS.length];
    update({ tab: next.id });
    tabRefs.current.get(next.id)?.focus();
  };

  const sections: Record<AutomatonsTab, ReactNode> = {
    stables: (
      <StablesTab
        profiles={profiles}
        strategies={library}
        filter={filter}
        strategyFilter={strategyFilter}
        query={query}
        sort={sort}
        onFilterChange={(f) => update({ filter: f === 'all' ? null : f })}
        onStrategyChange={(key) => update({ strategy: key })}
        onQueryChange={(q) => update({ q: q === '' ? null : q })}
        onSortChange={(s) => update({ sort: s === null ? null : serializeStableSort(s) })}
        onClearFilters={() => update({ filter: null, strategy: null, q: null })}
        onOpenStable={(key) => openStable(key)}
        onActivateAll={async () => {
          const { outcomes } = await activateAllDrafts();
          await refresh();
          return outcomes;
        }}
      />
    ),
    strategies: (
      <StrategiesTab
        view={strategiesView}
        draftId={draftId}
        strategies={library}
        libraryError={libraryError}
        profiles={profiles ?? []}
        onViewChange={(view) => update({ view: view === 'comparison' ? null : view })}
        onOpenDraft={(id) => update({ draft: id === null ? null : String(id), ...(id === null ? {} : { view: 'library' }) })}
        onOpenStrategy={(key) => update({ tab: 'stables', strategy: key, filter: null, q: null })}
        onChanged={() => void refresh()}
      />
    ),
    editor: (
      <EditorTab
        profiles={profiles ?? []}
        strategies={library ?? []}
        selectedKey={selectedKey}
        onSelect={(key) => update({ stable: key })}
        onChanged={() => void refresh()}
      />
    ),
    catalogue: <CatalogueTab profiles={profiles ?? []} selectedKey={selectedKey} />,
  };

  return (
    <div data-testid="automatons-page" className="space-y-4 min-w-0 max-w-full overflow-x-hidden">
      <AdminPageHeader title="Automaton Stables" subtitle="Computer-run stables that build and upgrade themselves after each settlement." />

      <AutomatonStatusBar status={status} onToggle={toggleProgram} onShowNeedsAttention={showNeedsAttention} />
      {loadError && <Notice tone="error">{loadError}</Notice>}

      {isDesktop ? (
        <div>
          <div role="tablist" aria-label="Automaton sections" className="flex border-b border-white/10 bg-surface-elevated mb-4">
            {AUTOMATON_TABS.map((t, index) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  ref={(el) => { if (el) tabRefs.current.set(t.id, el); else tabRefs.current.delete(t.id); }}
                  role="tab"
                  id={`automaton-tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`automaton-panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => update({ tab: t.id })}
                  onKeyDown={(e) => onTabKey(e, index)}
                  className={`px-4 py-3 min-h-11 text-sm font-medium transition-colors motion-reduce:transition-none ${FOCUS_RING} ${active ? 'text-primary border-b-2 border-primary' : 'text-secondary hover:text-primary/80'}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div role="tabpanel" id={`automaton-panel-${tab}`} aria-labelledby={`automaton-tab-${tab}`}>
            {sections[tab]}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {AUTOMATON_TABS.map((t) => (
            <section key={t.id} aria-labelledby={`automaton-section-${t.id}`} className="space-y-3 min-w-0">
              <h2 id={`automaton-section-${t.id}`} className="text-lg font-semibold text-white border-b border-white/10 pb-1">{t.label}</h2>
              {sections[t.id]}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
