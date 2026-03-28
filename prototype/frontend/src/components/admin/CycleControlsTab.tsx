/**
 * CycleControlsTab - Individual cycle controls, bulk cycle runner, and session log.
 *
 * Extracted from AdminPage.tsx. Manages its own loading/message state and
 * delegates session-log mutations to the parent via props.
 *
 * Requirements: 3.1, 3.6
 */
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../utils/apiClient';
import type { SessionLogEntry } from './types';

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */

interface CycleResult {
  cycle: number;
  userGeneration?: {
    usersCreated: number;
    error?: string;
  };
  repair?: {
    robotsRepaired: number;
  };
  repair1?: {
    robotsRepaired: number;
    totalFinalCost: number;
  };
  repairPreTournament?: {
    robotsRepaired: number;
  };
  repairPreLeague?: {
    robotsRepaired: number;
  };
  repair2?: {
    robotsRepaired: number;
    totalFinalCost: number;
  };
  repair3?: {
    robotsRepaired: number;
    totalFinalCost: number;
  };
  matchmaking?: {
    matchesCreated: number;
  };
  battles?: {
    totalBattles: number;
    successfulBattles: number;
    failedBattles: number;
    byeBattles: number;
    errors: string[];
  };
  tournaments?: {
    executed?: number;
    completed?: number;
    failed?: number;
    tournamentsExecuted?: number;
    roundsExecuted?: number;
    matchesExecuted?: number;
    tournamentsCompleted?: number;
    tournamentsCreated?: number;
    errors?: string[];
    error?: string;
  };
  kothBattles?: {
    successfulMatches: number;
    failedMatches: number;
    totalMatches: number;
  };
  repairPostKoth?: {
    robotsRepaired: number;
    totalFinalCost: number;
  };
  kothMatchmaking?: {
    matchesCreated: number;
  };
  finances?: {
    usersProcessed: number;
    totalCostsDeducted: number;
    bankruptUsers: number;
  };
  rebalancing?: {
    summary: {
      totalPromoted: number;
      totalDemoted: number;
    };
  };
  duration: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CycleControlsTabProps {
  addSessionLog: (type: SessionLogEntry['type'], message: string, details?: unknown) => void;
  sessionLog: SessionLogEntry[];
  clearSessionLog: () => void;
  exportSessionLog: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CycleControlsTab({
  addSessionLog,
  sessionLog,
  clearSessionLog,
  exportSessionLog,
}: CycleControlsTabProps) {
  const { refreshUser } = useAuth();

  /* ---------- Local state ---------- */
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkCycles, setBulkCycles] = useState(1);
  const [autoRepair, setAutoRepair] = useState(true);
  const [includeTournaments, setIncludeTournaments] = useState(true);
  const [includeKoth, setIncludeKoth] = useState(true);
  const [includeDailyFinances, setIncludeDailyFinances] = useState(true);
  const [generateUsersPerCycle, setGenerateUsersPerCycle] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bulkResults, setBulkResults] = useState<any>(null);

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

  /* ---------- Bulk cycle runner ---------- */

  const runBulkCycles = async (): Promise<void> => {
    if (bulkCycles < 1 || bulkCycles > 100) {
      showMessage('error', 'Cycles must be between 1 and 100');
      return;
    }

    setLoading(true);
    setBulkResults(null);
    addSessionLog('info', `Starting bulk cycle run: ${bulkCycles} cycle(s)`, {
      includeTournaments,
      generateUsersPerCycle,
    });

    try {
      const response = await apiClient.post('/api/admin/cycles/bulk', {
        cycles: bulkCycles,
        includeTournaments,
        generateUsersPerCycle,
        includeKoth,
      });
      setBulkResults(response.data);

      // Add detailed session log entries for each cycle
      if (response.data.results && response.data.results.length > 0) {
        response.data.results.forEach((result: CycleResult) => {
          if (result.repair1) {
            addSessionLog('info', `Cycle ${result.cycle}: Step 1 - Repaired ${result.repair1.robotsRepaired} robot(s) for ₡${result.repair1.totalFinalCost.toLocaleString()}`);
          }
          if (result.tournaments) {
            if (result.tournaments.error) {
              addSessionLog('error', `Cycle ${result.cycle}: Step 2 - Tournament execution failed`, result.tournaments);
            } else {
              const t = result.tournaments;
              const details = [
                t.tournamentsExecuted ? `${t.tournamentsExecuted} tournament(s)` : null,
                t.roundsExecuted ? `${t.roundsExecuted} round(s)` : null,
                t.matchesExecuted ? `${t.matchesExecuted} match(es)` : null,
                t.tournamentsCompleted ? `${t.tournamentsCompleted} completed` : null,
                t.tournamentsCreated ? `${t.tournamentsCreated} created` : null,
              ].filter(Boolean).join(', ');
              if (details) {
                addSessionLog(
                  t.errors && t.errors.length > 0 ? 'warning' : 'success',
                  `Cycle ${result.cycle}: Step 2 - Tournaments: ${details}`,
                  t.errors && t.errors.length > 0 ? { errors: t.errors } : undefined
                );
              }
            }
          }
          if (result.repair2) {
            addSessionLog('info', `Cycle ${result.cycle}: Step 3 - Repaired ${result.repair2.robotsRepaired} robot(s) for ₡${result.repair2.totalFinalCost.toLocaleString()}`);
          }
          if (result.battles) {
            const { totalBattles, successfulBattles, failedBattles } = result.battles;
            addSessionLog(
              failedBattles > 0 ? 'warning' : 'success',
              `Cycle ${result.cycle}: Step 4 - Executed ${totalBattles} battle(s) (${successfulBattles} successful, ${failedBattles} failed)`
            );
          }
          if (result.rebalancing && result.rebalancing.summary) {
            const { totalPromoted, totalDemoted } = result.rebalancing.summary;
            addSessionLog('info', `Cycle ${result.cycle}: Step 5 - Rebalanced: ${totalPromoted} promoted, ${totalDemoted} demoted`);
          }
          if (result.userGeneration) {
            if (result.userGeneration.error) {
              addSessionLog('error', `Cycle ${result.cycle}: Step 6 - User generation failed`, result.userGeneration);
            } else {
              addSessionLog('success', `Cycle ${result.cycle}: Step 6 - Generated ${result.userGeneration.usersCreated} new user(s)`);
            }
          }
          if (result.repair3) {
            addSessionLog('info', `Cycle ${result.cycle}: Step 7 - Repaired ${result.repair3.robotsRepaired} robot(s) for ₡${result.repair3.totalFinalCost.toLocaleString()}`);
          }
          if (result.matchmaking) {
            addSessionLog('success', `Cycle ${result.cycle}: Step 8 - Created ${result.matchmaking.matchesCreated} match(es)`);
          }
          if (result.kothBattles) {
            const { successfulMatches, failedMatches, totalMatches } = result.kothBattles;
            addSessionLog(
              failedMatches > 0 ? 'warning' : 'success',
              `Cycle ${result.cycle}: KotH - ${successfulMatches}/${totalMatches} matches completed${failedMatches > 0 ? ` (${failedMatches} failed)` : ''}`
            );
          }
          if (result.kothMatchmaking) {
            addSessionLog('success', `Cycle ${result.cycle}: KotH Matchmaking - ${result.kothMatchmaking.matchesCreated} match(es) scheduled`);
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
  };

  /* ---------- Render ---------- */
  return (
    <div data-testid="cycle-controls-tab" className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded ${
            message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Cycle Controls */}
        <div className="bg-surface rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Daily Cycle Controls</h2>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={repairAllRobots}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
            >
              🔧 Auto-Repair All Robots
            </button>
            <button
              onClick={runMatchmaking}
              disabled={loading}
              className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
            >
              🎯 Run Matchmaking
            </button>
            <button
              onClick={executeBattles}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
            >
              ⚔️ Execute Battles
            </button>
            <button
              onClick={processDailyFinances}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
            >
              💰 Process Daily Finances
            </button>
            <button
              onClick={rebalanceLeagues}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
            >
              📊 Rebalance Leagues
            </button>
            <button
              onClick={triggerKothCycle}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
            >
              👑 Trigger KotH Cycle
            </button>
          </div>
        </div>

        {/* Bulk Cycle Testing */}
        <div className="bg-surface rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Bulk Cycle Testing</h2>
          <div className="mb-4 space-y-3">
            <label className="block">
              Number of Cycles (1-100):
              <input
                type="number"
                min="1"
                max="100"
                value={bulkCycles}
                onChange={(e) => setBulkCycles(parseInt(e.target.value) || 1)}
                className="ml-2 bg-surface-elevated text-white px-3 py-1 rounded w-24"
              />
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRepair}
                onChange={(e) => setAutoRepair(e.target.checked)}
                className="mr-2"
              />
              Auto-repair before each cycle
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeTournaments}
                onChange={(e) => setIncludeTournaments(e.target.checked)}
                className="mr-2"
              />
              Include tournament execution
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeKoth}
                onChange={(e) => setIncludeKoth(e.target.checked)}
                className="mr-2"
              />
              Include King of the Hill battles
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeDailyFinances}
                onChange={(e) => setIncludeDailyFinances(e.target.checked)}
                className="mr-2"
              />
              Include daily finances processing
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={generateUsersPerCycle}
                onChange={(e) => setGenerateUsersPerCycle(e.target.checked)}
                className="mr-2"
              />
              Generate users per cycle
              <span className="ml-2 text-sm text-secondary">
                (Adds N users each cycle: cycle 1 → 1 user, cycle 2 → 2 users, etc.)
              </span>
            </label>
          </div>
          <button
            onClick={runBulkCycles}
            disabled={loading}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-surface-elevated px-6 py-3 rounded font-semibold transition-colors"
          >
            🚀 Run {bulkCycles} Cycle{bulkCycles !== 1 ? 's' : ''}
          </button>

          {bulkResults && (
            <div className="mt-4 bg-surface-elevated rounded p-4">
              <h3 className="text-xl font-semibold mb-2">Bulk Cycle Results</h3>
              <p>Cycles Completed: {bulkResults.cyclesCompleted}</p>
              {bulkResults.totalCyclesInSystem && (
                <p className="text-success">Total Cycles in System: {bulkResults.totalCyclesInSystem}</p>
              )}
              <p>Total Duration: {(bulkResults.totalDuration / 1000)?.toFixed(2) || 0}s</p>
              <p>Average Cycle Duration: {(bulkResults.averageCycleDuration / 1000)?.toFixed(2) || 0}s</p>

              {bulkResults.results && bulkResults.results.length > 0 && (
                <div className="mt-4 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Cycle Details:</h4>
                  {bulkResults.results.map((result: CycleResult, idx: number) => (
                    <div key={idx} className="mb-2 p-2 bg-surface rounded text-sm">
                      <p className="font-semibold">Cycle {result.cycle}:</p>
                      {result.userGeneration && (
                        <div className="ml-2 text-success">
                          <p>- Users: {result.userGeneration.usersCreated} new users created</p>
                          {result.userGeneration.error && (
                            <p className="text-error ml-2">• ⚠️ Error: {result.userGeneration.error}</p>
                          )}
                        </div>
                      )}
                      {result.repair && <p>- Repaired: {result.repair.robotsRepaired} robots</p>}
                      {result.matchmaking && <p>- Matches: {result.matchmaking.matchesCreated} created</p>}
                      {result.battles && (
                        <p>
                          - Battles: {result.battles.successfulBattles}/
                          {result.battles.totalBattles} successful
                        </p>
                      )}
                      {result.finances && (
                        <div className="ml-2 text-warning">
                          <p>- Finances: ₡{result.finances.totalCostsDeducted.toLocaleString()} deducted</p>
                          <p className="ml-2">• {result.finances.usersProcessed} users processed</p>
                          {result.finances.bankruptUsers > 0 && (
                            <p className="ml-2 text-error">• ⚠️ {result.finances.bankruptUsers} bankruptcies!</p>
                          )}
                        </div>
                      )}
                      {result.rebalancing && (
                        <p>
                          - Rebalancing: {result.rebalancing.totalPromoted} promoted,{' '}
                          {result.rebalancing.totalDemoted} demoted
                        </p>
                      )}
                      {result.kothBattles && (
                        <p>
                          - KotH: {result.kothBattles.successfulMatches}/
                          {result.kothBattles.totalMatches} matches
                        </p>
                      )}
                      {result.kothMatchmaking && <p>- KotH Matches Scheduled: {result.kothMatchmaking.matchesCreated}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Full Session Log */}
      <div className="bg-surface rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Session Log</h2>
          <div className="flex gap-2">
            <button
              onClick={exportSessionLog}
              disabled={sessionLog.length === 0}
              className="bg-primary hover:bg-blue-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold transition-colors text-sm min-h-[44px]"
            >
              Export
            </button>
            <button
              onClick={clearSessionLog}
              disabled={sessionLog.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-surface-elevated px-4 py-2 rounded font-semibold transition-colors text-sm min-h-[44px]"
            >
              Clear
            </button>
          </div>
        </div>
        {sessionLog.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sessionLog.map((entry, idx) => (
              <div
                key={idx}
                className={`p-3 rounded text-sm ${
                  entry.type === 'success'
                    ? 'bg-green-900 bg-opacity-30 text-green-200'
                    : entry.type === 'error'
                    ? 'bg-red-900 bg-opacity-30 text-red-200'
                    : entry.type === 'warning'
                    ? 'bg-yellow-900 bg-opacity-30 text-yellow-200'
                    : 'bg-blue-900 bg-opacity-30 text-blue-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold">
                    {entry.type === 'success' && '✓ '}
                    {entry.type === 'error' && '✗ '}
                    {entry.type === 'warning' && '⚠ '}
                    {entry.type === 'info' && 'ℹ '}
                    {entry.message}
                  </span>
                  <span className="text-xs text-secondary ml-2">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                {entry.details !== undefined && entry.details !== null && (
                  <pre className="mt-2 text-xs text-secondary overflow-x-auto">
                    {typeof entry.details === 'string'
                      ? entry.details
                      : JSON.stringify(entry.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary text-center py-4">No log entries</p>
        )}
      </div>
    </div>
  );
}
