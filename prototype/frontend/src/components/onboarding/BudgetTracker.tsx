/**
 * BudgetTracker component
 * Compact two-column budget display for onboarding header.
 * Single column on mobile, two columns on desktop.
 */

import { useEffect, useState } from 'react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { formatCurrency } from '../../utils/financialApi';
import apiClient from '../../utils/apiClient';

interface UserCredits { currency: number }

const STARTING_BUDGET = 3_000_000;
const WARNING_HIGH = 600_000;
const WARNING_CRIT = 200_000;
const RESERVE = 50_000;

const BudgetTracker = () => {
  const { tutorialState } = useOnboarding();
  const [credits, setCredits] = useState(STARTING_BUDGET);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const r = await apiClient.get('/api/user/profile');
        if (ok) { setCredits((r.data as UserCredits).currency); setReady(true); }
      } catch { if (ok) setReady(true); }
    })();
    return () => { ok = false; };
  }, [tutorialState?.currentStep]);

  const spent = STARTING_BUDGET - credits;
  const pct = (credits / STARTING_BUDGET) * 100;
  const bs = tutorialState?.choices.budgetSpent || { facilities: 0, robots: 0, weapons: 0, attributes: 0 };
  const warn = credits < WARNING_CRIT ? 'critical' : credits < WARNING_HIGH ? 'warning' : 'normal';
  const color = warn === 'critical' ? 'text-red-500' : warn === 'warning' ? 'text-yellow-500' : 'text-green-500';
  const barColor = warn === 'critical' ? 'bg-red-500' : warn === 'warning' ? 'bg-yellow-500' : 'bg-green-500';

  if (!ready) return <div className="bg-surface px-3 py-1.5 rounded border border-white/10 text-xs text-secondary">Loading…</div>;

  return (
    <div className="bg-surface px-3 py-1.5 rounded border border-white/10" role="region" aria-label="Budget Tracker">
      {/* Balance + progress bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-sm font-bold whitespace-nowrap ${color}`} aria-live="polite">{formatCurrency(credits)}</span>
        <div className="flex-1 h-1.5 bg-surface-elevated rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Two-column layout on desktop, single on mobile */}
      <div className="sm:grid sm:grid-cols-2 sm:gap-x-4 text-xs">
        {/* Left column: totals */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-secondary"><span>Starting:</span><span className="font-medium">{formatCurrency(STARTING_BUDGET)}</span></div>
          <div className="flex justify-between text-secondary"><span>Spent:</span><span className="font-medium">{formatCurrency(spent)}</span></div>
        </div>

        {/* Right column: category breakdown */}
        {spent > 0 && (
          <div className="space-y-0.5 mt-0.5 sm:mt-0">
            {bs.facilities > 0 && <div className="flex justify-between text-secondary"><span>• Facilities:</span><span>{formatCurrency(bs.facilities)}</span></div>}
            {bs.robots > 0 && <div className="flex justify-between text-secondary"><span>• Robots:</span><span>{formatCurrency(bs.robots)}</span></div>}
            {bs.weapons > 0 && <div className="flex justify-between text-secondary"><span>• Weapons:</span><span>{formatCurrency(bs.weapons)}</span></div>}
            {bs.attributes > 0 && <div className="flex justify-between text-secondary"><span>• Attributes:</span><span>{formatCurrency(bs.attributes)}</span></div>}
          </div>
        )}
      </div>

      {/* Warnings — full width */}
      {warn === 'critical' && <div role="alert" className="text-xs p-1 rounded mt-1 bg-red-900/30 text-error border border-red-700">Critical: Only {formatCurrency(credits)} remaining!</div>}
      {warn === 'warning' && <div role="alert" className="text-xs p-1 rounded mt-1 bg-yellow-900/30 text-warning border border-yellow-700">Warning: {formatCurrency(credits)} remaining. Be careful.</div>}
      {credits < RESERVE * 2 && credits > RESERVE && <div className="text-xs p-1 rounded mt-1 bg-blue-900/30 text-primary border border-blue-700">Tip: Keep at least {formatCurrency(RESERVE)} for repairs.</div>}
    </div>
  );
};

export default BudgetTracker;
