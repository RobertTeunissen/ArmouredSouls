import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { FinanceHistoryView } from '../components/finance/FinanceHistoryView';
import { FinanceStatement } from '../components/finance/FinanceStatement';
import { FullDamageRepairReference } from '../components/finance/FullDamageRepairReference';
import { PrestigeEarningPower } from '../components/finance/PrestigeEarningPower';
import { PrestigeMilestoneForecast } from '../components/finance/PrestigeMilestoneForecast';
import { RevenueGrowthForecast } from '../components/finance/RevenueGrowthForecast';
import { RobotDeploymentView } from '../components/finance/RobotDeploymentView';
import { useFinanceReport } from '../hooks/useFinanceReport';
import { financePeriodKey } from '../utils/financeApi';
import { formatCurrency } from '../utils/formatters';
import { formatFinanceInstant, formatFinancePeriod } from '../utils/financeTime';
import type { FinancePeriodSelection, PresetReportScope } from '../utils/financeApi';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'robots', label: 'Robot deployment' },
] as const;

type FinanceTab = typeof TABS[number]['id'];
type CustomField = 'fromCycle' | 'toCycle';
type CustomErrors = Partial<Record<CustomField, string>>;

const PRESET_SCOPES: PresetReportScope[] = ['current', 'last_completed', 'last_seven', 'season_to_date'];
const MAX_FINANCE_REPORT_RANGE = 100;

function parsePositiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePeriod(searchParams: URLSearchParams): FinancePeriodSelection {
  const scope = searchParams.get('scope');
  const fromCycle = parsePositiveInteger(searchParams.get('fromCycle'));
  const toCycle = parsePositiveInteger(searchParams.get('toCycle'));
  if (
    scope === 'custom'
    && fromCycle !== null
    && toCycle !== null
    && fromCycle <= toCycle
    && toCycle - fromCycle + 1 <= MAX_FINANCE_REPORT_RANGE
  ) {
    return { scope: 'custom', fromCycle, toCycle };
  }
  if (PRESET_SCOPES.includes(scope as PresetReportScope)) {
    return { scope: scope as PresetReportScope };
  }
  if (searchParams.has('lastNCycles')) return { scope: 'last_seven' };
  return { scope: 'current' };
}

function parseTab(value: string | null): FinanceTab {
  return TABS.some((tab) => tab.id === value) ? value as FinanceTab : 'overview';
}

function scopeLabel(scope: FinancePeriodSelection['scope']): string {
  const labels: Record<FinancePeriodSelection['scope'], string> = {
    current: 'Current cycle',
    last_completed: 'Last completed cycle',
    last_seven: 'Last seven completed cycles',
    season_to_date: 'Season to date',
    custom: 'Custom completed-cycle range',
  };
  return labels[scope];
}

function signedCurrency(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}${formatCurrency(Math.abs(amount))}`;
}

export function FinanceCenterPage(): React.ReactElement {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const period = parsePeriod(searchParams);
  const legacyCycleCount = parsePositiveInteger(searchParams.get('lastNCycles'));
  const [controlScope, setControlScope] = useState<FinancePeriodSelection['scope']>(period.scope);
  const [fromDraft, setFromDraft] = useState(period.scope === 'custom' ? String(period.fromCycle) : '');
  const [toDraft, setToDraft] = useState(period.scope === 'custom' ? String(period.toCycle) : '');
  const [customErrors, setCustomErrors] = useState<CustomErrors>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusedHashRef = useRef<string | null>(null);
  const periodKey = financePeriodKey(period);
  const periodScope = period.scope;
  const customFromCycle = period.scope === 'custom' ? period.fromCycle : null;
  const customToCycle = period.scope === 'custom' ? period.toCycle : null;
  const { overview, history } = useFinanceReport(period, activeTab === 'history' && legacyCycleCount === null);

  useEffect(() => {
    setControlScope(periodScope);
    setCustomErrors({});
    if (customFromCycle !== null && customToCycle !== null) {
      setFromDraft(String(customFromCycle));
      setToDraft(String(customToCycle));
    }
  }, [customFromCycle, customToCycle, periodKey, periodScope]);

  useEffect(() => {
    if (legacyCycleCount === null || overview.data === null) return;
    const lastCompleted = overview.data.period.activeCycle - 1;
    const next = new URLSearchParams(searchParams);
    next.delete('lastNCycles');
    next.set('tab', 'history');
    if (lastCompleted < 1) {
      next.set('scope', 'last_seven');
      next.delete('fromCycle');
      next.delete('toCycle');
    } else {
      next.set('scope', 'custom');
      next.set('fromCycle', String(Math.max(1, lastCompleted - legacyCycleCount + 1)));
      next.set('toCycle', String(lastCompleted));
    }
    setSearchParams(next, { replace: true });
  }, [legacyCycleCount, overview.data, searchParams, setSearchParams]);

  const updateTab = (tab: FinanceTab): void => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      updateTab(TABS[index].id);
      return;
    } else return;

    event.preventDefault();
    updateTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  const selectScope = (scope: FinancePeriodSelection['scope']): void => {
    setControlScope(scope);
    setCustomErrors({});
    if (scope === 'custom') return;
    const next = new URLSearchParams(searchParams);
    next.set('scope', scope);
    next.delete('fromCycle');
    next.delete('toCycle');
    next.delete('lastNCycles');
    setSearchParams(next, { replace: true });
  };

  const applyCustomRange = (): void => {
    const fromCycle = parsePositiveInteger(fromDraft);
    const toCycle = parsePositiveInteger(toDraft);
    const errors: CustomErrors = {};
    const lastCompleted = overview.data ? overview.data.period.activeCycle - 1 : null;

    if (fromCycle === null) errors.fromCycle = 'From cycle is required and must be a positive whole number.';
    if (toCycle === null) errors.toCycle = 'To cycle is required and must be a positive whole number.';
    if (fromCycle !== null && toCycle !== null && fromCycle > toCycle) {
      errors.fromCycle = 'From cycle must not be after to cycle.';
    }
    if (fromCycle !== null && toCycle !== null && fromCycle <= toCycle) {
      if (toCycle - fromCycle + 1 > MAX_FINANCE_REPORT_RANGE) {
        errors.toCycle = `Cycle range cannot exceed ${MAX_FINANCE_REPORT_RANGE} cycles`;
      } else if (lastCompleted !== null && toCycle > lastCompleted) {
        errors.toCycle = `To cycle must be a completed cycle (Cycle ${lastCompleted} or earlier).`;
      }
    }

    setCustomErrors(errors);
    if (errors.fromCycle) {
      fromRef.current?.focus();
      return;
    }
    if (errors.toCycle) {
      toRef.current?.focus();
      return;
    }
    if (fromCycle === null || toCycle === null) return;

    const next = new URLSearchParams(searchParams);
    next.set('scope', 'custom');
    next.set('fromCycle', String(fromCycle));
    next.set('toCycle', String(toCycle));
    next.delete('lastNCycles');
    setSearchParams(next, { replace: true });
  };

  const refresh = (): void => {
    overview.refresh();
    if (activeTab === 'history') history.refresh();
    if (activeTab === 'robots') setRefreshToken((value) => value + 1);
  };

  const overviewResponse = overview.data;
  const statement = overviewResponse?.data.statement;
  const contextualBalance = overviewResponse === null || statement === undefined
    ? null
    : overviewResponse.period.containsCurrentCycle
      ? overviewResponse.reconciliation.currentCurrencyConfirmation
      : statement.closingBalance;
  const contextualBalanceLabel = overviewResponse?.period.containsCurrentCycle
    ? 'Current balance'
    : 'Closing balance';
  const preparation = overviewResponse?.period.phase === 'preparation';
  const provisional = overviewResponse?.period.finality === 'current_provisional';
  const earlySeason = overviewResponse !== null
    && overviewResponse.period.activeCycle === 1
    && overviewResponse.reconciliation.financialRecordCount === 0
    && overviewResponse.data.repairReference.activeRobotCount === 0
    && overviewResponse.data.prestigeForecast.status !== 'available';

  useEffect(() => {
    if (location.hash !== '#prestige-power-heading') {
      focusedHashRef.current = null;
      return;
    }
    if (overviewResponse === null || focusedHashRef.current === location.hash) return;

    const target = document.getElementById('prestige-power-heading');
    if (target === null) return;
    target.scrollIntoView?.({ block: 'start' });
    target.focus({ preventScroll: true });
    focusedHashRef.current = location.hash;
  }, [location.hash, overviewResponse]);

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-white">
      <Navigation />
      <main className="container mx-auto max-w-7xl px-3 py-6 pb-24 sm:px-4 lg:pb-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Finance Center</h1>
            <p className="mt-1 text-secondary">Read-only, time-bounded evidence for Credits movement and deployment results.</p>
            {overviewResponse ? (
              <div className="mt-2 space-y-1 text-sm text-secondary">
                <p>
                  Season {overviewResponse.period.seasonNumber} · Cycle {overviewResponse.period.fromCycle}{overviewResponse.period.toCycle === overviewResponse.period.fromCycle ? '' : `–${overviewResponse.period.toCycle}`}
                  {preparation ? ' · Preparation' : ''}{provisional ? ' · Provisional' : ' · Historical'}
                </p>
                <p>{formatFinancePeriod(overviewResponse.period.startsAt, overviewResponse.period.endsAt)}</p>
                <p>As of <time dateTime={overviewResponse.period.asOf}>{formatFinanceInstant(overviewResponse.period.asOf)}</time></p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {period.scope === 'current' ? (
              <button type="button" onClick={refresh} className="min-h-11 min-w-11 rounded-md border border-primary/50 px-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Refresh current cycle</button>
            ) : null}
            <Link to="/dashboard" className="inline-flex min-h-11 min-w-11 items-center rounded-md border border-white/20 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Dashboard</Link>
          </div>
        </header>

        <section className="mt-6 rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="report-period-heading">
          <h2 id="report-period-heading" className="font-medium">Report period</h2>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-secondary">Period</span>
              <select
                value={controlScope}
                onChange={(event) => selectScope(event.target.value as FinancePeriodSelection['scope'])}
                className="min-h-11 rounded-md border border-white/20 bg-background px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="current">Current cycle</option>
                <option value="last_completed">Last completed cycle</option>
                <option value="last_seven">Last seven completed cycles</option>
                <option value="season_to_date">Season to date</option>
                <option value="custom">Custom completed-cycle range</option>
              </select>
            </label>
            {controlScope === 'custom' ? (
              <>
                <div className="flex flex-1 flex-col gap-1 text-sm">
                  <label htmlFor="finance-from-cycle" className="text-secondary">From cycle</label>
                  <input id="finance-from-cycle" ref={fromRef} inputMode="numeric" value={fromDraft} onChange={(event) => setFromDraft(event.target.value)} aria-invalid={customErrors.fromCycle ? true : undefined} aria-describedby={customErrors.fromCycle ? 'from-cycle-error' : undefined} className="min-h-11 rounded-md border border-white/20 bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  {customErrors.fromCycle ? <span id="from-cycle-error" className="text-sm text-error">{customErrors.fromCycle}</span> : null}
                </div>
                <div className="flex flex-1 flex-col gap-1 text-sm">
                  <label htmlFor="finance-to-cycle" className="text-secondary">To cycle</label>
                  <input id="finance-to-cycle" ref={toRef} inputMode="numeric" value={toDraft} onChange={(event) => setToDraft(event.target.value)} aria-invalid={customErrors.toCycle ? true : undefined} aria-describedby={customErrors.toCycle ? 'to-cycle-error' : undefined} className="min-h-11 rounded-md border border-white/20 bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                  {customErrors.toCycle ? <span id="to-cycle-error" className="text-sm text-error">{customErrors.toCycle}</span> : null}
                </div>
                <button type="button" onClick={applyCustomRange} className="min-h-11 min-w-11 rounded-md bg-primary px-4 font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Apply range</button>
              </>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-tertiary">Selected: {scopeLabel(period.scope)}. Version 1 identifies the response schema, not the game season.</p>
        </section>

        <div className="mt-6 border-b border-white/10">
          <div className="overflow-x-auto" role="tablist" aria-label="Finance Center views">
            <div className="flex min-w-max gap-1 lg:min-w-0">
              {TABS.map((tab, index) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(element) => { tabRefs.current[index] = element; }}
                    type="button"
                    id={`finance-${tab.id}-tab`}
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`finance-${tab.id}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => updateTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`min-h-11 min-w-11 rounded-t-md border-b-2 px-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-secondary hover:text-white'}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <section id="finance-overview-panel" role="tabpanel" aria-labelledby="finance-overview-tab" hidden={activeTab !== 'overview'} className="mt-6 space-y-6">
          {overview.isLoading ? <div className="rounded-lg border border-gray-700 bg-surface-elevated p-6 text-secondary" aria-busy="true">Loading finance overview…</div> : null}
          {overview.error ? (
            <div className="rounded-lg border border-error/40 bg-error/10 p-4" role="alert"><p>{overview.error}</p><button type="button" onClick={overview.retry} className="mt-3 min-h-11 min-w-11 rounded-md border border-error/50 px-4">Retry overview</button></div>
          ) : null}
          {overviewResponse && statement ? (
            <>
              {earlySeason ? <div className="rounded-lg border border-primary/30 bg-primary/10 p-4"><h2 className="text-xl font-medium">Your first financial cycle is underway</h2><p className="mt-2 text-secondary">No identified events, active robots, completed history, or applicable prestige forecast are available yet. The report will fill in as evidence is recorded.</p></div> : null}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-700 bg-surface-elevated p-4"><p className="text-sm text-secondary">{contextualBalanceLabel}</p><p className="mt-1 text-xl font-bold tabular-nums">{contextualBalance === null ? 'Unavailable' : formatCurrency(contextualBalance)}</p></div>
                <div className="rounded-lg border border-gray-700 bg-surface-elevated p-4"><p className="text-sm text-secondary">Net cash movement</p><p className="mt-1 text-xl font-bold tabular-nums">{signedCurrency(statement.netCashMovement)}</p></div>
                <div className="rounded-lg border border-gray-700 bg-surface-elevated p-4"><p className="text-sm text-secondary">Operating result</p><p className="mt-1 text-xl font-bold tabular-nums">{signedCurrency(statement.earnedCredits - statement.runningCosts)}</p></div>
                <div className="rounded-lg border border-gray-700 bg-surface-elevated p-4"><p className="text-sm text-secondary">Investment purchases</p><p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(statement.investmentPurchases)}</p></div>
              </div>
              <FinanceStatement statement={statement} reconciliation={overviewResponse.reconciliation} limitations={overviewResponse.limitations} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <RevenueGrowthForecast growth={overviewResponse.data.revenueGrowth} />
                <FullDamageRepairReference reference={overviewResponse.data.repairReference} />
                <PrestigeMilestoneForecast forecast={overviewResponse.data.prestigeForecast} />
                <PrestigeEarningPower forecast={overviewResponse.data.prestigeForecast} />
              </div>
            </>
          ) : null}
        </section>

        <section id="finance-history-panel" role="tabpanel" aria-labelledby="finance-history-tab" hidden={activeTab !== 'history'} className="mt-6">
          {legacyCycleCount !== null ? <div className="rounded-lg border border-gray-700 bg-surface-elevated p-4 text-secondary" aria-busy="true">Translating the legacy cycle range…</div> : history.isLoading ? <div className="rounded-lg border border-gray-700 bg-surface-elevated p-6 text-secondary" aria-busy="true">Loading finance history…</div> : history.error ? <div className="rounded-lg border border-error/40 bg-error/10 p-4" role="alert"><p>{history.error}</p><button type="button" onClick={history.retry} className="mt-3 min-h-11 min-w-11 rounded-md border border-error/50 px-4">Retry history</button></div> : history.data ? <FinanceHistoryView response={history.data} /> : null}
        </section>

        <section id="finance-robots-panel" role="tabpanel" aria-labelledby="finance-robots-tab" hidden={activeTab !== 'robots'} className="mt-6">
          <RobotDeploymentView period={period} active={activeTab === 'robots'} refreshToken={refreshToken} />
        </section>
      </main>
    </div>
  );
}

export default FinanceCenterPage;
