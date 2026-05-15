/**
 * CycleControlsPage — Scheduler status, manual trigger buttons with confirmation,
 * tournament management, bulk cycle testing, and session log panel.
 *
 * Migrated from CycleControlsTab.tsx into a standalone page using shared admin
 * UI components and useAdminStore for session log management.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 25.1, 25.2, 25.3, 25.4, 25.5
 */
import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '../../contexts/AuthContext';
import { AdminPageHeader, AdminStatCard } from '../../components/admin/shared';
import { useAdminStore } from '../../stores/adminStore';
import apiClient from '../../utils/apiClient';
import type { SchedulerState } from '../../stores/adminStore';

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface CycleResult {
  cycle: number;
  userGeneration?: { usersCreated: number; error?: string };
  repair?: { robotsRepaired: number };
  repair1?: { robotsRepaired: number; totalFinalCost: number };
  repair2?: { robotsRepaired: number; totalFinalCost: number };
  repair3?: { robotsRepaired: number; totalFinalCost: number };
  matchmaking?: { matchesCreated: number };
  battles?: { totalBattles: number; successfulBattles: number; failedBattles: number; byeBattles: number; errors: string[] };
  tournaments?: { executed?: number; completed?: number; failed?: number; tournamentsExecuted?: number; roundsExecuted?: number; matchesExecuted?: number; tournamentsCompleted?: number; tournamentsCreated?: number; errors?: string[]; error?: string };
  kothBattles?: { successfulMatches: number; failedMatches: number; totalMatches: number };
  repairPostKoth?: { robotsRepaired: number; totalFinalCost: number };
  kothMatchmaking?: { matchesCreated: number };
  finances?: { usersProcessed: number; totalCostsDeducted: number; bankruptUsers: number };
  rebalancing?: { summary: { totalPromoted: number; totalDemoted: number } };
  duration: number;
  error?: string;
}

interface ConfirmAction {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function CycleControlsPage() {
  const { refreshUser } = useAuth();
  const {
    schedulerStatus,
    fetchSchedulerStatus,
    sessionLog,
    addSessionLog,
    clearSessionLog,
    exportSessionLog,
  } = useAdminStore(useShallow((s) => ({
    schedulerStatus: s.schedulerStatus,
    fetchSchedulerStatus: s.fetchSchedulerStatus,
    sessionLog: s.sessionLog,
    addSessionLog: s.addSessionLog,
    clearSessionLog: s.clearSessionLog,
    exportSessionLog: s.exportSessionLog,
  })));

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [sessionLogOpen, setSessionLogOpen] = useState(false);

  // Bulk cycle state
  const [bulkCycles, setBulkCycles] = useState(1);
  const [includeTournaments, setIncludeTournaments] = useState(true);
  const [includeKoth, setIncludeKoth] = useState(true);
  const [includeDailyFinances, setIncludeDailyFinances] = useState(true);
  const [generateUsersPerCycle, setGenerateUsersPerCycle] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bulkResults, setBulkResults] = useState<any>(null);

  useEffect(() => {
    fetchSchedulerStatus();
  }, [fetchSchedulerStatus]);

  const showMessage = (type: 'success' | 'error', text: string): void => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  /* ---------- Individual cycle operations ---------- */

  const runMatchmaking = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/admin/matchmaking/run', {});
      addSessionLog('success', `Matchmaking completed! Created ${response.data.matchesCreated} matches`);
      showMessage('success', `Matchmaking completed! Created ${response.data.matchesCreated} matches`);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Matchmaking failed';
      addSessionLog('error', `Matchmaking failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const executeBattles = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/admin/battles/run', {});
      const summary = response.data.summary;
      const text = `Battles executed! Total: ${summary.totalBattles}, Success: ${summary.successfulBattles}, Failed: ${summary.failedBattles}`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Battle execution failed';
      addSessionLog('error', `Battle execution failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const rebalanceLeagues = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/admin/leagues/rebalance', {});
      const summary = response.data.summary;
      const text = `League rebalancing completed! Promoted: ${summary.totalPromoted}, Demoted: ${summary.totalDemoted}`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'League rebalancing failed';
      addSessionLog('error', `League rebalancing failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const repairAllRobots = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/admin/repair/all', { deductCosts: true });
      const text = `Repaired ${response.data.robotsRepaired} robots`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Repair failed';
      addSessionLog('error', `Repair failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const processDailyFinances = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/admin/daily-finances/process', {});
      const summary = response.data.summary;
      const text = `Daily finances processed! ${summary.usersProcessed} users, ₡${summary.totalCostsDeducted.toLocaleString()} deducted${summary.bankruptUsers > 0 ? `, ${summary.bankruptUsers} bankruptcies` : ''}`;
      addSessionLog('success', text);
      showMessage('success', text);
      await refreshUser();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Daily finances failed';
      addSessionLog('error', `Daily finances failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerKothCycle = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.post('/api/admin/koth/trigger', {});
      const text = `KotH cycle triggered successfully!${response.data.message ? ` ${response.data.message}` : ''}`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'KotH cycle trigger failed';
      addSessionLog('error', `KotH cycle trigger failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerLeagueCycle = async (): Promise<void> => {
    setLoading(true);
    addSessionLog('info', 'Starting league cycle: Repair → Battles → Rebalance → Matchmaking');
    try {
      const repairRes = await apiClient.post('/api/admin/repair/all', { deductCosts: true });
      addSessionLog('info', `Step 1: Repaired ${repairRes.data.robotsRepaired} robots`);
      const battleRes = await apiClient.post('/api/admin/battles/run', {});
      const bs = battleRes.data.summary;
      addSessionLog(bs.failedBattles > 0 ? 'warning' : 'success', `Step 2: ${bs.successfulBattles}/${bs.totalBattles} battles executed`);
      const rebalRes = await apiClient.post('/api/admin/leagues/rebalance', {});
      const rs = rebalRes.data.summary;
      addSessionLog('success', `Step 3: ${rs.totalPromoted} promoted, ${rs.totalDemoted} demoted`);
      const matchRes = await apiClient.post('/api/admin/matchmaking/run', {});
      addSessionLog('success', `Step 4: ${matchRes.data.matchesCreated} matches scheduled`);
      showMessage('success', `League cycle complete: ${bs.successfulBattles} battles, ${matchRes.data.matchesCreated} matches scheduled`);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'League cycle failed';
      addSessionLog('error', `League cycle failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerTournamentCycle = async (): Promise<void> => {
    setLoading(true);
    addSessionLog('info', 'Starting tournament cycle');
    try {
      const response = await apiClient.post('/api/admin/cycles/bulk', { cycles: 0, includeTournaments: true, includeKoth: false, generateUsersPerCycle: false });
      const results = response.data.results?.[0]?.tournaments;
      const details = results ? [
        results.tournamentsExecuted ? `${results.tournamentsExecuted} tournament(s)` : null,
        results.roundsExecuted ? `${results.roundsExecuted} round(s)` : null,
        results.matchesExecuted ? `${results.matchesExecuted} match(es)` : null,
        results.tournamentsCompleted ? `${results.tournamentsCompleted} completed` : null,
        results.tournamentsCreated ? `${results.tournamentsCreated} created` : null,
      ].filter(Boolean).join(', ') : 'completed';
      addSessionLog('success', `Tournament cycle: ${details}`);
      showMessage('success', `Tournament cycle: ${details}`);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Tournament cycle failed';
      addSessionLog('error', `Tournament cycle failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerTagTeamCycle = async (): Promise<void> => {
    setLoading(true);
    addSessionLog('info', 'Starting tag team cycle: Repair → Battles → Rebalance → Matchmaking');
    try {
      const repairRes = await apiClient.post('/api/admin/repair/all', { deductCosts: true });
      addSessionLog('info', `Step 1: Repaired ${repairRes.data.robotsRepaired} robots`);
      const battleRes = await apiClient.post('/api/admin/tag-teams/battles', {});
      const bs = battleRes.data.summary;
      addSessionLog('success', `Step 2: ${bs.totalBattles} tag team battles executed`);
      const rebalRes = await apiClient.post('/api/admin/tag-teams/rebalance', {});
      const rs = rebalRes.data.summary;
      addSessionLog('success', `Step 3: ${rs.totalPromoted} promoted, ${rs.totalDemoted} demoted`);
      const matchRes = await apiClient.post('/api/admin/tag-teams/matchmaking', {});
      addSessionLog('success', `Step 4: ${matchRes.data.matchesCreated} tag team matches scheduled`);
      showMessage('success', `Tag team cycle complete: ${bs.totalBattles} battles, ${matchRes.data.matchesCreated} matches scheduled`);
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Tag team cycle failed';
      addSessionLog('error', `Tag team cycle failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Bulk cycle runner ---------- */

  const runBulkCycles = useCallback(async (): Promise<void> => {
    if (bulkCycles < 1 || bulkCycles > 100) {
      showMessage('error', 'Cycles must be between 1 and 100');
      return;
    }
    setLoading(true);
    setBulkResults(null);
    addSessionLog('info', `Starting bulk cycle run: ${bulkCycles} cycle(s)`, { includeTournaments, generateUsersPerCycle });

    try {
      const response = await apiClient.post('/api/admin/cycles/bulk', {
        cycles: bulkCycles,
        includeTournaments,
        generateUsersPerCycle,
        includeKoth,
        includeDailyFinances,
      });
      setBulkResults(response.data);

      if (response.data.results?.length > 0) {
        response.data.results.forEach((result: CycleResult) => {
          if (result.battles) {
            const { totalBattles, successfulBattles, failedBattles } = result.battles;
            addSessionLog(
              failedBattles > 0 ? 'warning' : 'success',
              `Cycle ${result.cycle}: ${totalBattles} battle(s) (${successfulBattles} successful, ${failedBattles} failed)`,
            );
          }
          if (result.rebalancing?.summary) {
            const { totalPromoted, totalDemoted } = result.rebalancing.summary;
            addSessionLog('info', `Cycle ${result.cycle}: Rebalanced: ${totalPromoted} promoted, ${totalDemoted} demoted`);
          }
        });
      }

      const completionMsg = `Bulk cycle run completed: ${response.data.cyclesCompleted} cycle(s) in ${(response.data.totalDuration / 1000)?.toFixed(2) || 0}s`;
      addSessionLog('success', completionMsg);
      showMessage('success', `Completed ${response.data.cyclesCompleted} cycles in ${(response.data.totalDuration / 1000)?.toFixed(2) || 0}s`);
      await refreshUser();
    } catch (error: unknown) {
      const errData = (error as { response?: { data?: { error?: string } } })?.response?.data;
      addSessionLog('error', 'Bulk cycle run failed', errData);
      showMessage('error', errData?.error || 'Bulk cycles failed');
    } finally {
      setLoading(false);
    }
  }, [bulkCycles, includeTournaments, includeKoth, includeDailyFinances, generateUsersPerCycle, addSessionLog, refreshUser]);

  /* ---------- Confirmation dialog handler ---------- */

  const requestConfirm = (label: string, description: string, onConfirm: () => Promise<void>) => {
    setConfirmAction({ label, description, onConfirm });
  };

  const handleConfirm = async () => {
    if (confirmAction) {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    }
  };

  /* ---------- Render ---------- */

  return (
    <div data-testid="cycle-controls-page" className="space-y-6">
      <AdminPageHeader
        title="Cycle Controls"
        subtitle="Scheduler status, manual triggers, and bulk testing"
        actions={
          <button
            type="button"
            onClick={() => fetchSchedulerStatus(true)}
            className="px-3 py-1.5 text-sm bg-surface-elevated text-secondary hover:text-white rounded transition-colors"
          >
            ↻ Refresh Status
          </button>
        }
      />

      {message && (
        <div className={`p-4 rounded ${message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Scheduler Status Panel */}
      <SchedulerStatusPanel status={schedulerStatus} />

      {/* Production Jobs (Manual Trigger) */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Production Jobs (Manual Trigger)</h2>
        <p className="text-sm text-secondary mb-4">Each button runs the same pipeline as the corresponding cron job.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <TriggerButton label="⚔️ Run League Cycle" color="bg-primary hover:bg-blue-700" disabled={loading} onClick={() => requestConfirm('Run League Cycle', 'Repair → Execute battles → Rebalance → Matchmaking. Continue?', triggerLeagueCycle)} />
          <TriggerButton label="🏆 Run Tournament Cycle" color="bg-yellow-600 hover:bg-yellow-700" disabled={loading} onClick={() => requestConfirm('Run Tournament Cycle', 'Repair → Execute rounds → Advance winners → Auto-create. Continue?', triggerTournamentCycle)} />
          <TriggerButton label="🤝 Run Tag Team Cycle" color="bg-cyan-600 hover:bg-cyan-700" disabled={loading} onClick={() => requestConfirm('Run Tag Team Cycle', 'Repair → Execute battles → Rebalance → Matchmaking. Continue?', triggerTagTeamCycle)} />
          <TriggerButton label="👑 Run KotH Cycle" color="bg-orange-600 hover:bg-orange-700" disabled={loading} onClick={() => requestConfirm('Run KotH Cycle', 'Execute KotH battles → Matchmaking for next round. Continue?', triggerKothCycle)} />
          <TriggerButton label="💰 Run Settlement" color="bg-green-600 hover:bg-green-700" disabled={loading} onClick={() => requestConfirm('Run Settlement', 'Passive income → Operating costs → Cycle counter → Snapshot. Continue?', processDailyFinances)} />
        </div>

        {/* Individual Step Controls (debugging) */}
        <details className="mt-4">
          <summary className="cursor-pointer text-secondary hover:text-white text-sm font-medium">
            🔧 Individual Step Controls (debugging)
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            <TriggerButton label="🔧 Repair All Robots" color="bg-surface-elevated hover:bg-white/10" disabled={loading} onClick={() => requestConfirm('Repair All Robots', 'Repair all damaged robots and deduct costs?', repairAllRobots)} />
            <TriggerButton label="🎯 Run Matchmaking (League)" color="bg-surface-elevated hover:bg-white/10" disabled={loading} onClick={() => requestConfirm('Run Matchmaking', 'Create new league match pairings?', runMatchmaking)} />
            <TriggerButton label="⚔️ Execute League Battles" color="bg-surface-elevated hover:bg-white/10" disabled={loading} onClick={() => requestConfirm('Execute Battles', 'Execute all pending league battles?', executeBattles)} />
            <TriggerButton label="📊 Rebalance Leagues" color="bg-surface-elevated hover:bg-white/10" disabled={loading} onClick={() => requestConfirm('Rebalance Leagues', 'Promote and demote robots?', rebalanceLeagues)} />
          </div>
        </details>
      </div>

      {/* Bulk Cycle Testing */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Bulk Cycle Testing</h2>
        <p className="text-sm text-secondary mb-4">
          Run multiple game cycles in sequence for testing purposes. This is intended for development/staging environments.
        </p>
        <div className="mb-4 space-y-3">
          <label className="block">
            Number of Cycles (1-100):
            <input type="number" min="1" max="100" value={bulkCycles} onChange={(e) => setBulkCycles(parseInt(e.target.value) || 1)} className="ml-2 bg-surface-elevated text-white px-3 py-1 rounded w-24" />
          </label>
          <label className="flex items-center">
            <input type="checkbox" checked={includeTournaments} onChange={(e) => setIncludeTournaments(e.target.checked)} className="mr-2" />
            Include tournament execution
          </label>
          <label className="flex items-center">
            <input type="checkbox" checked={includeKoth} onChange={(e) => setIncludeKoth(e.target.checked)} className="mr-2" />
            Include King of the Hill battles
          </label>
          <label className="flex items-center">
            <input type="checkbox" checked={includeDailyFinances} onChange={(e) => setIncludeDailyFinances(e.target.checked)} className="mr-2" />
            Include daily finances processing
          </label>
          <label className="flex items-center">
            <input type="checkbox" checked={generateUsersPerCycle} onChange={(e) => setGenerateUsersPerCycle(e.target.checked)} className="mr-2" />
            Generate users per cycle
          </label>
        </div>
        <button onClick={runBulkCycles} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors">
          🚀 Run {bulkCycles} Cycle{bulkCycles !== 1 ? 's' : ''}
        </button>

        {bulkResults && (
          <div className="mt-4 bg-surface-elevated rounded p-4">
            <h3 className="text-lg font-semibold mb-2">Bulk Cycle Results</h3>
            <p>Cycles Completed: {bulkResults.cyclesCompleted}</p>
            {bulkResults.totalCyclesInSystem && <p className="text-success">Total Cycles in System: {bulkResults.totalCyclesInSystem}</p>}
            <p>Total Duration: {(bulkResults.totalDuration / 1000)?.toFixed(2) || 0}s</p>
            <p>Average Cycle Duration: {(bulkResults.averageCycleDuration / 1000)?.toFixed(2) || 0}s</p>
          </div>
        )}
      </div>

      {/* Session Log Toggle */}
      <div className="bg-surface rounded-lg overflow-hidden">
        <button type="button" onClick={() => setSessionLogOpen((o) => !o)} className="w-full p-4 flex items-center gap-2 font-semibold text-lg hover:bg-surface-elevated transition-colors text-left">
          <span className="text-sm">{sessionLogOpen ? '▼' : '▶'}</span>
          <span>📋 Session Log ({sessionLog.length})</span>
        </button>
        {sessionLogOpen && (
          <div className="p-6 border-t border-white/10">
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={exportSessionLog} disabled={sessionLog.length === 0} className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold transition-colors text-sm">Export</button>
              <button onClick={clearSessionLog} disabled={sessionLog.length === 0} className="bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold transition-colors text-sm">Clear</button>
            </div>
            {sessionLog.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sessionLog.map((entry, idx) => (
                  <div key={idx} className={`p-3 rounded text-sm ${entry.type === 'success' ? 'bg-green-900/30 text-green-200' : entry.type === 'error' ? 'bg-red-900/30 text-red-200' : entry.type === 'warning' ? 'bg-yellow-900/30 text-yellow-200' : 'bg-blue-900/30 text-blue-200'}`}>
                    <div className="flex justify-between items-start">
                      <span className="font-semibold">
                        {entry.type === 'success' && '✓ '}{entry.type === 'error' && '✗ '}{entry.type === 'warning' && '⚠ '}{entry.type === 'info' && 'ℹ '}
                        {entry.message}
                      </span>
                      <span className="text-xs text-secondary ml-2">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-secondary text-center py-4">No log entries</p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full mx-4 border border-white/10">
            <h3 className="text-lg font-semibold mb-2">{confirmAction.label}</h3>
            <p className="text-secondary text-sm mb-6">{confirmAction.description}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-surface-elevated text-secondary hover:text-white rounded transition-colors">Cancel</button>
              <button onClick={handleConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SchedulerStatusPanel({ status }: { status: SchedulerState | null }) {
  if (!status) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Scheduler Status</h2>
        <p className="text-secondary">Loading scheduler status...</p>
      </div>
    );
  }

  return (
    <div data-testid="scheduler-status-panel">
      <h2 className="text-xl font-semibold mb-4">Scheduler Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <AdminStatCard label="Scheduler" value={status.active ? 'Active' : 'Inactive'} color={status.active ? 'success' : 'error'} icon={<span>{status.active ? '🟢' : '🔴'}</span>} />
        <AdminStatCard label="Running Job" value={status.runningJob || 'None'} color={status.runningJob ? 'warning' : 'info'} icon={<span>⚙️</span>} />
        <AdminStatCard label="Queue" value={status.queue.length} color="info" icon={<span>📋</span>} />
      </div>
      {status.jobs.length > 0 && (
        <div className="bg-surface rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-elevated">
                <th className="px-4 py-3 text-left text-secondary font-semibold">Job</th>
                <th className="px-4 py-3 text-left text-secondary font-semibold">Schedule</th>
                <th className="px-4 py-3 text-left text-secondary font-semibold">Last Run</th>
                <th className="px-4 py-3 text-left text-secondary font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-secondary font-semibold">Duration</th>
                <th className="px-4 py-3 text-left text-secondary font-semibold">Next Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {status.jobs.map((job) => (
                <tr key={job.name} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-medium">{job.name}</td>
                  <td className="px-4 py-3 text-secondary font-mono text-xs">{job.schedule}</td>
                  <td className="px-4 py-3 text-secondary">{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    {job.lastRunStatus === 'success' && <span className="text-success">✓ Success</span>}
                    {job.lastRunStatus === 'failed' && <span className="text-error">✗ Failed</span>}
                    {!job.lastRunStatus && <span className="text-secondary">—</span>}
                  </td>
                  <td className="px-4 py-3 text-secondary">{job.lastRunDurationMs != null ? `${(job.lastRunDurationMs / 1000).toFixed(2)}s` : '—'}</td>
                  <td className="px-4 py-3 text-secondary">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TriggerButton({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`${color} disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors`}>
      {label}
    </button>
  );
}

export default CycleControlsPage;
