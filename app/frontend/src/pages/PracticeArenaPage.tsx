/**
 * PracticeArenaPage — Combat Simulation Lab
 *
 * Standalone 1v1 sandbox battle simulator. Players run consequence-free battles
 * against configurable AI sparring partners or their own robots. Reuses the
 * existing BattlePlaybackViewer for result display with "SIMULATION" styling.
 *
 * Requirements: 1.1, 1.2, 1.5, 3.1–3.6, 4.4, 6.2–6.4, 6.7, 7.1–7.7,
 *               8.1–8.8, 9.6, 11.2–11.10
 */

import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { BattlePlaybackViewer } from '../components/BattlePlaybackViewer/BattlePlaybackViewer';

import {
  BattleSlotPanel,
  BatchSummary,
  SimulationResultBanner,
  HistoryPanel,
  usePracticeArena,
} from '../components/practice-arena';

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function PracticeArenaPage() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;

  const {
    robots, sparringDefs, loadingInit,
    slot1, slot2, setSlot1, setSlot2,
    batchCount, setBatchCount, running, runProgress, canRun,
    handleRun, handleReRun,
    battleResult, batchResult, error, cycleOffline, ownedRobotName,
    historyResults, clearHistory,
    trainingLevel, academyLevels,
  } = usePracticeArena(userId);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary font-header tracking-tight">
            ⚡ Combat Simulation Lab
          </h1>
          <p className="text-secondary text-sm max-w-xl mx-auto">
            Run predictive combat simulations to test configurations before entering the real arena
          </p>
        </div>

        {/* Cycle Offline Banner */}
        {cycleOffline && (
          <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 text-center">
            <p className="text-amber-400 font-semibold">⚠️ Combat Simulation Lab is offline</p>
            <p className="text-amber-400/80 text-sm mt-1">
              Real arena battles are in progress. Simulations will resume shortly.
            </p>
            <p className="text-xs text-secondary mt-2">Auto-checking every 15 seconds...</p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loadingInit ? (
          <div className="text-center py-12 text-secondary">Loading simulation lab...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main content: 3 cols */}
            <div className="lg:col-span-3 space-y-6">
              {/* Battle Slots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BattleSlotPanel
                  label="🤖 Your Robot"
                  slot={slot1}
                  robots={robots}
                  sparringDefs={sparringDefs}
                  onSlotChange={setSlot1}
                  forceOwned={true}
                  trainingLevel={trainingLevel}
                  academyLevels={academyLevels}
                />
                <BattleSlotPanel
                  label="🎯 Opponent"
                  slot={slot2}
                  robots={robots}
                  sparringDefs={sparringDefs}
                  onSlotChange={setSlot2}
                  trainingLevel={trainingLevel}
                  academyLevels={academyLevels}
                />
              </div>

              {/* Run Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-secondary">Simulation runs:</label>
                  <select
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value))}
                    className="bg-surface border border-white/10 rounded px-3 py-2 text-sm text-primary"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleRun}
                  disabled={!canRun}
                  className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
                    canRun
                      ? 'bg-primary hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {running ? '⏳ Simulating...' : '⚡ Run Simulation'}
                </button>
              </div>

              {/* Loading Progress */}
              {running && (
                <div className="text-center text-secondary text-sm animate-pulse">
                  {runProgress}
                </div>
              )}

              {/* Batch Results */}
              {batchResult && batchResult.aggregate.totalBattles > 1 && (
                <BatchSummary batch={batchResult} ownedRobotName={ownedRobotName} />
              )}

              {/* Single Battle Result */}
              {battleResult && (!batchResult || batchResult.aggregate.totalBattles <= 1) && (
                <div className="space-y-3">
                  <SimulationResultBanner result={battleResult} ownedRobotName={ownedRobotName} />

                  <div className="bg-surface p-3 rounded-lg relative">
                    <div className="absolute top-2 right-2 bg-cyan-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
                      SIMULATION
                    </div>
                    <h2 className="text-lg font-bold mb-2">Battle Playback</h2>
                    <BattlePlaybackViewer
                      battleResult={battleResult.combatResult}
                      robot1Info={{
                        name: battleResult.robot1Info.name,
                        teamIndex: 0,
                        maxHP: battleResult.robot1Info.maxHP,
                        maxShield: battleResult.robot1Info.maxShield,
                      }}
                      robot2Info={{
                        name: battleResult.robot2Info.name,
                        teamIndex: 1,
                        maxHP: battleResult.robot2Info.maxHP,
                        maxShield: battleResult.robot2Info.maxShield,
                      }}
                      narrativeEvents={battleResult.battleLog}
                    />
                  </div>

                  <div className="text-center">
                    <button
                      onClick={handleReRun}
                      disabled={running}
                      className="px-6 py-2 bg-surface border border-primary/50 text-primary rounded-lg hover:bg-primary/10 transition-colors text-sm"
                    >
                      🔄 Re-Run Simulation
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar: History (1 col) */}
            <div className="lg:col-span-1">
              <div className="bg-surface-elevated rounded-lg border border-white/10 p-4 sticky top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <HistoryPanel results={historyResults} onClear={clearHistory} ownedRobotName={ownedRobotName} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PracticeArenaPage;
