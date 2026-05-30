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
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
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
  matchmaking?: { matchesCreated: number; subscriptionExclusions?: number };
  battles?: { totalBattles: number; successfulBattles: number; failedBattles: number; byeBattles: number; errors: string[] };
  tournaments?: { executed?: number; completed?: number; failed?: number; tournamentsExecuted?: number; roundsExecuted?: number; matchesExecuted?: number; tournamentsCompleted?: number; tournamentsCreated?: number; errors?: string[]; error?: string };
  kothBattles?: { successfulMatches: number; failedMatches: number; totalMatches: number };
  repairPostKoth?: { robotsRepaired: number; totalFinalCost: number };
  kothMatchmaking?: { matchesCreated: number; subscriptionExclusions?: number };
  finances?: { usersProcessed: number; totalCostsDeducted: number; bankruptUsers: number };
  rebalancing?: { summary: { totalPromoted: number; totalDemoted: number } };
  subscriptionExclusions?: { league: number; tournament: number; tagTeam: number; koth: number };
  duration: number;
  error?: string;
}

interface ConfirmAction {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Response shapes                                                    */
/* ------------------------------------------------------------------ */

interface MatchmakingResponse { matchesCreated: number; subscriptionExclusions?: number }
interface BattlesResponse { summary: { totalBattles: number; successfulBattles: number; failedBattles: number } }
interface RebalanceResponse { summary: { totalPromoted: number; totalDemoted: number } }
interface RepairResponse { robotsRepaired: number }
interface DailyFinancesResponse { summary: { usersProcessed: number; totalCostsDeducted: number; bankruptUsers: number } }
interface KothResponse { message?: string }
interface TagTeamBattlesResponse { summary: { totalBattles: number } }
interface BulkCyclesResponse {
  cyclesCompleted: number;
  totalDuration: number;
  averageCycleDuration: number;
  totalCyclesInSystem?: number;
  results?: CycleResult[];
}

/**
 * Extract a user-facing error message from an unknown thrown value.
 * Backend errors arriving as `ApiError` carry their structured message;
 * everything else falls back to the caller-supplied label.
 */
const errorMessage = (err: unknown, fallback: string): string =>
  (err instanceof ApiError && err.message) || fallback;

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
   
  const [bulkResults, setBulkResults] = useState<BulkCyclesResponse | null>(null);

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
      const data = await api.post<MatchmakingResponse>('/api/admin/matchmaking/run', {});
      const exclusionNote = data.subscriptionExclusions ? ` (${data.subscriptionExclusions} excluded by subscription)` : '';
      addSessionLog('success', `Matchmaking completed! Created ${data.matchesCreated} matches${exclusionNote}`);
      showMessage('success', `Matchmaking completed! Created ${data.matchesCreated} matches${exclusionNote}`);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Matchmaking failed');
      addSessionLog('error', `Matchmaking failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const executeBattles = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.post<BattlesResponse>('/api/admin/battles/run', {});
      const summary = data.summary;
      const text = `Battles executed! Total: ${summary.totalBattles}, Success: ${summary.successfulBattles}, Failed: ${summary.failedBattles}`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Battle execution failed');
      addSessionLog('error', `Battle execution failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const rebalanceLeagues = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.post<RebalanceResponse>('/api/admin/leagues/rebalance', {});
      const summary = data.summary;
      const text = `League rebalancing completed! Promoted: ${summary.totalPromoted}, Demoted: ${summary.totalDemoted}`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'League rebalancing failed');
      addSessionLog('error', `League rebalancing failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const repairAllRobots = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.post<RepairResponse>('/api/admin/repair/all', { deductCosts: true });
      const text = `Repaired ${data.robotsRepaired} robots`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Repair failed');
      addSessionLog('error', `Repair failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const processDailyFinances = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.post<DailyFinancesResponse>('/api/admin/daily-finances/process', {});
      const summary = data.summary;
      const text = `Daily finances processed! ${summary.usersProcessed} users, ₡${summary.totalCostsDeducted.toLocaleString()} deducted${summary.bankruptUsers > 0 ? `, ${summary.bankruptUsers} bankruptcies` : ''}`;
      addSessionLog('success', text);
      showMessage('success', text);
      await refreshUser();
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Daily finances failed');
      addSessionLog('error', `Daily finances failed: ${msg}`);
      showMessage('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerKothCycle = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await api.post<KothResponse>('/api/admin/koth/trigger', {});
      const text = `KotH cycle triggered successfully!${data.message ? ` ${data.message}` : ''}`;
      addSessionLog('success', text);
      showMessage('success', text);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'KotH cycle trigger failed');
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
      const repair = await api.post<RepairResponse>('/api/admin/repair/all', { deductCosts: true });
      addSessionLog('info', `Step 1: Repaired ${repair.robotsRepaired} robots`);
      const battles = await api.post<BattlesResponse>('/api/admin/battles/run', {});
      const bs = battles.summary;
      addSessionLog(bs.failedBattles > 0 ? 'warning' : 'success', `Step 2: ${bs.successfulBattles}/${bs.totalBattles} battles executed`);
      const rebal = await api.post<RebalanceResponse>('/api/admin/leagues/rebalance', {});
      const rs = rebal.summary;
      addSessionLog('success', `Step 3: ${rs.totalPromoted} promoted, ${rs.totalDemoted} demoted`);
      const match = await api.post<MatchmakingResponse>('/api/admin/matchmaking/run', {});
      addSessionLog('success', `Step 4: ${match.matchesCreated} matches scheduled`);
      showMessage('success', `League cycle complete: ${bs.successfulBattles} battles, ${match.matchesCreated} matches scheduled`);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'League cycle failed');
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
      const data = await api.post<BulkCyclesResponse>('/api/admin/cycles/bulk', { cycles: 0, includeTournaments: true, includeKoth: false, generateUsersPerCycle: false });
      const results = data.results?.[0]?.tournaments;
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
      const msg = errorMessage(error, 'Tournament cycle failed');
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
      const repair = await api.post<RepairResponse>('/api/admin/repair/all', { deductCosts: true });
      addSessionLog('info', `Step 1: Repaired ${repair.robotsRepaired} robots`);
      const battles = await api.post<TagTeamBattlesResponse>('/api/admin/tag-teams/battles', {});
      const bs = battles.summary;
      addSessionLog('success', `Step 2: ${bs.totalBattles} tag team battles executed`);
      const rebal = await api.post<RebalanceResponse>('/api/admin/tag-teams/rebalance', {});
      const rs = rebal.summary;
      addSessionLog('success', `Step 3: ${rs.totalPromoted} promoted, ${rs.totalDemoted} demoted`);
      const match = await api.post<MatchmakingResponse>('/api/admin/tag-teams/matchmaking', {});
      addSessionLog('success', `Step 4: ${match.matchesCreated} tag team matches scheduled`);
      showMessage('success', `Tag team cycle complete: ${bs.totalBattles} battles, ${match.matchesCreated} matches scheduled`);
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Tag team cycle failed');
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
      const data = await api.post<BulkCyclesResponse>('/api/admin/cycles/bulk', {
        cycles: bulkCycles,
        includeTournaments,
        generateUsersPerCycle,
        includeKoth,
        includeDailyFinances,
      });
      setBulkResults(data);

      if (data.results && data.results.length > 0) {
        data.results.forEach((result: CycleResult) => {
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

      const completionMsg = `Bulk cycle run completed: ${data.cyclesCompleted} cycle(s) in ${(data.totalDuration / 1000)?.toFixed(2) || 0}s`;
      addSessionLog('success', completionMsg);
      showMessage('success', `Completed ${data.cyclesCompleted} cycles in ${(data.totalDuration / 1000)?.toFixed(2) || 0}s`);
      await refreshUser();
    } catch (error: unknown) {
      const msg = errorMessage(error, 'Bulk cycles failed');
      addSessionLog('error', 'Bulk cycle run failed', error instanceof ApiError ? { code: error.code, statusCode: error.statusCode, details: error.details } : undefined);
      showMessage('error', msg);
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

  /* ---------- Scheduler panel "Run" button handler ---------- */

  const handleSchedulerJobTrigger = (jobName: string): void => {
    const triggerMap: Record<string, { label: string; description: string; handler: () => Promise<void> }> = {
      league: { label: 'Run League Cycle', description: 'Repair → Execute battles → Rebalance → Matchmaking. Continue?', handler: triggerLeagueCycle },
      tournament: { label: 'Run Tournament Cycle', description: 'Repair → Execute rounds → Advance winners → Auto-create. Continue?', handler: triggerTournamentCycle },
      tagTeam: { label: 'Run Tag Team Cycle', description: 'Repair → Execute battles → Rebalance → Matchmaking. Continue?', handler: triggerTagTeamCycle },
      koth: { label: 'Run KotH Cycle', description: 'Execute KotH battles → Matchmaking for next round. Continue?', handler: triggerKothCycle },
      settlement: { label: 'Run Settlement', description: 'User generation → Passive income → Operating costs → Cycle counter → Snapshot. Continue?', handler: processDailyFinances },
    };
    const action = triggerMap[jobName];
    if (action) {
      requestConfirm(action.label, action.description, action.handler);
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
      <SchedulerStatusPanel status={schedulerStatus} onTriggerJob={handleSchedulerJobTrigger} />

      {/* Bulk Cycle Testing */}
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Bulk Cycle Testing</h2>
        <p className="text-sm text-secondary mb-4">
          Run complete game cycles (all 10 slots in order). Intended for development/staging.
        </p>
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-secondary">Cycles:</span>
            <input type="number" min="1" max="100" value={bulkCycles} onChange={(e) => setBulkCycles(parseInt(e.target.value) || 1)} className="bg-surface-elevated text-white px-3 py-1 rounded w-20" />
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

            {/* Subscription Exclusion Summary */}
            {bulkResults.results && bulkResults.results.some(r => r.subscriptionExclusions) && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <h4 className="text-sm font-semibold text-secondary mb-2">📋 Subscription Exclusions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(() => {
                    const totals = { league: 0, tournament: 0, tagTeam: 0, koth: 0 };
                    bulkResults.results?.forEach(r => {
                      if (r.subscriptionExclusions) {
                        totals.league += r.subscriptionExclusions.league;
                        totals.tournament += r.subscriptionExclusions.tournament;
                        totals.tagTeam += r.subscriptionExclusions.tagTeam;
                        totals.koth += r.subscriptionExclusions.koth;
                      }
                    });
                    return (
                      <>
                        <div className="bg-surface rounded p-2 text-center">
                          <p className="text-sm font-bold text-amber-400">{totals.league}</p>
                          <p className="text-xs text-secondary">League</p>
                        </div>
                        <div className="bg-surface rounded p-2 text-center">
                          <p className="text-sm font-bold text-amber-400">{totals.tournament}</p>
                          <p className="text-xs text-secondary">Tournament</p>
                        </div>
                        <div className="bg-surface rounded p-2 text-center">
                          <p className="text-sm font-bold text-amber-400">{totals.tagTeam}</p>
                          <p className="text-xs text-secondary">Tag Team</p>
                        </div>
                        <div className="bg-surface rounded p-2 text-center">
                          <p className="text-sm font-bold text-amber-400">{totals.koth}</p>
                          <p className="text-xs text-secondary">KotH</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <p className="text-xs text-tertiary mt-2">Robots excluded from matchmaking due to missing event subscriptions</p>
              </div>
            )}
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

/* ------------------------------------------------------------------ */
/*  Scheduler slot map constants                                       */
/* ------------------------------------------------------------------ */

/** Reserved slot job names — these have no real handler yet */
const RESERVED_SLOTS = new Set([
  'team2v2League',
  'team3v3League',
  'team2v2Tournament',
  'team3v3Tournament',
  'grandMelee',
]);

/** Human-readable display names for all scheduler jobs */
const JOB_DISPLAY_NAMES: Record<string, string> = {
  league: '1v1 League',
  team2v2League: 'Team 2v2 League',
  tournament: '1v1 Tournament',
  tagTeam: 'Tag Team',
  koth: 'King of the Hill',
  team3v3League: 'Team 3v3 League',
  team2v2Tournament: 'Team 2v2 Tournament',
  grandMelee: 'Grand Melee',
  team3v3Tournament: 'Team 3v3 Tournament',
  settlement: 'Settlement',
};

/** Static slot map defaults — shown when scheduler is inactive (e.g. local dev) */
const SLOT_MAP_DEFAULTS: Array<{ name: string; schedule: string }> = [
  { name: 'league', schedule: '0 8 * * *' },
  { name: 'team2v2League', schedule: '0 9 * * *' },
  { name: 'tournament', schedule: '0 10 * * *' },
  { name: 'tagTeam', schedule: '0 11 * * *' },
  { name: 'koth', schedule: '0 13 * * *' },
  { name: 'team3v3League', schedule: '0 14 * * *' },
  { name: 'team2v2Tournament', schedule: '0 15 * * *' },
  { name: 'grandMelee', schedule: '0 17 * * *' },
  { name: 'team3v3Tournament', schedule: '0 18 * * *' },
  { name: 'settlement', schedule: '0 0 * * *' },
];

function SchedulerStatusPanel({ status, onTriggerJob }: { status: SchedulerState | null; onTriggerJob?: (jobName: string) => void }) {
  if (!status) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Scheduler Status</h2>
        <p className="text-secondary">Loading scheduler status...</p>
      </div>
    );
  }

  // Use live job data if available, otherwise show static slot map defaults
  const jobs = status.jobs.length > 0
    ? status.jobs
    : SLOT_MAP_DEFAULTS.map((slot) => ({
        name: slot.name,
        schedule: slot.schedule,
        lastRunAt: null,
        lastRunDurationMs: null,
        lastRunStatus: null as 'success' | 'failed' | null,
        lastError: null,
        nextRunAt: null,
      }));

  return (
    <div data-testid="scheduler-status-panel">
      <h2 className="text-xl font-semibold mb-4">Scheduler Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        <AdminStatCard label="Scheduler" value={status.active ? 'Active' : 'Inactive'} color={status.active ? 'success' : 'error'} icon={<span>{status.active ? '🟢' : '🔴'}</span>} />
        <AdminStatCard label="Running Job" value={status.runningJob || 'None'} color={status.runningJob ? 'warning' : 'info'} icon={<span>⚙️</span>} />
        <AdminStatCard label="Queue" value={status.queue.length} color="info" icon={<span>📋</span>} />
      </div>
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
              <th className="px-4 py-3 text-left text-secondary font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {jobs.map((job) => {
              const isReserved = RESERVED_SLOTS.has(job.name);
              const displayName = JOB_DISPLAY_NAMES[job.name] || job.name;
              return (
                <tr key={job.name} className={isReserved ? 'opacity-60' : 'hover:bg-white/5'}>
                  <td className="px-4 py-3">
                    <span className={isReserved ? 'text-tertiary font-medium' : 'text-white font-medium'}>
                      {displayName}
                    </span>
                    {isReserved && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-tertiary">
                        Reserved
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary font-mono text-xs">{job.schedule}</td>
                  <td className="px-4 py-3 text-secondary">{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    {job.lastRunStatus === 'success' && <span className="text-success">✓ Success</span>}
                    {job.lastRunStatus === 'failed' && (
                      <span className="text-error" title={job.lastError || undefined}>
                        ✗ Failed
                        {job.lastError && (
                          <span className="block text-xs text-error/70 mt-0.5 max-w-[300px] truncate">
                            {job.lastError}
                          </span>
                        )}
                      </span>
                    )}
                    {!job.lastRunStatus && <span className="text-secondary">—</span>}
                  </td>
                  <td className="px-4 py-3 text-secondary">{job.lastRunDurationMs != null ? `${(job.lastRunDurationMs / 1000).toFixed(2)}s` : '—'}</td>
                  <td className="px-4 py-3 text-secondary">{job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    {!isReserved && onTriggerJob && (
                      <button
                        type="button"
                        onClick={() => onTriggerJob(job.name)}
                        className="px-3 py-1 text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 rounded transition-colors"
                      >
                        Run
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
