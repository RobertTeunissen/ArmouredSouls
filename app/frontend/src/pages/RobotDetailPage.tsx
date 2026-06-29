import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchRobotLeagueHistory, fetchRobotKothStanding, KothStandingData } from '../utils/robotApi';
import { api } from '../utils/api';
import Navigation from '../components/Navigation';
import TabNavigation from '../components/TabNavigation';
import BattleConfigTab from '../components/BattleConfigTab';
import EffectiveStatsDisplay from '../components/EffectiveStatsDisplay';
import RobotImage from '../components/RobotImage';
import RobotImageSelector from '../components/RobotImageSelector';
import StatisticalRankings from '../components/StatisticalRankings';
import PerformanceByContext from '../components/PerformanceByContext';
import RecentBattles from '../components/RecentBattles';
import UpcomingMatches from '../components/UpcomingMatches';
import UpgradePlanner from '../components/UpgradePlanner';
import Toast from '../components/Toast';
import RobotPerformanceAnalytics from '../components/RobotPerformanceAnalytics';
import TuningPoolEditor from '../components/TuningPoolEditor';
import LeagueTimeline from '../components/LeagueTimeline';
import type { LeagueHistoryEntry } from '../components/LeagueTimeline';
import TeamBattleLeagueHistory from '../components/TeamBattleLeagueHistory';
import type { BattleHistory } from '../utils/matchmakingApi';
import { getProfile } from '../utils/userApi';
import type { RobotWithAttributes } from '../types/robot';
import { useRobotDetail } from '../hooks/useRobotDetail';

function RobotDetailPage() {
  const {
    robot,
    weapons,
    currency,
    loading,
    error,
    successMessage,
    trainingLevel,
    repairBayLevel,
    activeRobotCount,
    academyLevels,
    recentBattles,
    battleReadiness,
    leagueRank,
    activeTab,
    handleTabChange,
    showImageSelector,
    setShowImageSelector,
    handleAppearanceChange,
    handleCommitUpgrades,
    handleEquipWeapon,
    handleUnequipWeapon,
    handleRobotUpdate,
    toast,
    setToast,
    isOwner,
    isOnboarding,
    navigate,
  } = useRobotDetail();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <div className="text-xl">Loading robot details...</div>
      </div>
    );
  }

  if (!robot) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Robot not found</p>
          <button
            onClick={() => navigate('/robots')}
            className="bg-primary hover:bg-blue-700 px-6 py-2 rounded"
          >
            Back to Robots
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Onboarding banner */}
        {isOnboarding && (
          <div
            className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6"
            role="region"
            aria-label="Onboarding guidance"
            data-testid="onboarding-banner"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0" aria-hidden="true">🎓</span>
              <div className="flex-1">
                <p className="text-primary font-semibold mb-1">Tutorial: Equip Your Weapon</p>
                <p className="text-secondary text-sm">
                  Navigate to the Battle Config tab below to equip the weapon you purchased.
                  Once equipped, your robot will gain weapon attribute bonuses and be battle-ready!
                </p>
              </div>
              <button
                onClick={() => navigate('/onboarding')}
                className="text-sm text-secondary hover:text-white transition-colors whitespace-nowrap"
                aria-label="Return to tutorial"
                data-testid="return-to-tutorial"
              >
                Return to Tutorial
              </button>
            </div>
          </div>
        )}

        {/* Robot Header */}
        <div className="mb-8">
          <div className="mb-4">
            <button
              onClick={() => navigate('/robots')}
              className="text-primary hover:text-blue-300"
            >
              ← Back to Robots
            </button>
          </div>
          
          {/* Robot Header Card */}
          <div className="bg-surface p-4 sm:p-6 rounded-lg">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <RobotImage
                imageUrl={robot.imageUrl}
                robotName={robot.name}
                size="hero"
                showEdit={isOwner ?? false}
                onEditClick={() => setShowImageSelector(true)}
              />
              
              <div className="flex-1 w-full min-w-0">
                <div className="flex flex-col sm:flex-row items-center sm:items-start sm:justify-between mb-3 gap-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left">{robot.name}</h1>
                  {robot.user && (
                    <div className="text-center sm:text-right text-sm">
                      <div className="text-secondary">Owner</div>
                      <div className="text-white font-semibold">
                        {robot.user.stableName || robot.user.username}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">ELO:</span>
                    <span className="text-white font-semibold">{robot.elo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">Current League:</span>
                    <span className="text-white font-semibold capitalize">
                      {robot.currentLeague} {robot.leagueId ? robot.leagueId.split('_')[1] : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">Win Rate:</span>
                    <span className="text-white font-semibold">
                      {robot.totalBattles > 0 
                        ? ((robot.wins / robot.totalBattles) * 100).toFixed(1) 
                        : '0.0'}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">Battles:</span>
                    <span className="text-white font-semibold">{robot.totalBattles}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary">Record:</span>
                    <span className="text-white font-semibold">
                      {robot.wins}W - {robot.losses}L - {robot.draws}D
                    </span>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-secondary mb-1">League Points</div>
                    <div className="text-white font-semibold">
                      {robot.leaguePoints}
                      {leagueRank && (
                        <span className="text-secondary text-xs ml-1">
                          (#{leagueRank.rank}/{leagueRank.total}, Top {leagueRank.percentile.toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-secondary mb-1">Fame</div>
                    <div className="text-warning font-semibold">{robot.fame}</div>
                  </div>
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-secondary mb-1">Damage (Dealt / Taken)</div>
                    <div className="text-white font-semibold">
                      {robot.damageDealtLifetime.toLocaleString()} / {robot.damageTakenLifetime.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-secondary mb-1">Destroyed / Ratio</div>
                    <div className="text-success font-semibold">
                      {robot.kills} / {robot.losses > 0 
                        ? (robot.kills / robot.losses).toFixed(2) 
                        : robot.kills.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-surface-elevated p-2 rounded">
                    <div className="text-secondary mb-1">Lifetime Repairs</div>
                    <div className="text-white font-semibold">₡{robot.totalRepairsPaid.toLocaleString()}</div>
                  </div>
                  {robot.titles && robot.titles.trim() && (
                    <div className="bg-surface-elevated p-2 rounded">
                      <div className="text-secondary mb-1">Titles</div>
                      <div className="text-warning font-semibold text-xs truncate">
                        {robot.titles.split(',').length} earned
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <TabNavigation 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isOwner={isOwner ?? false}
        />

        {/* Tab Content */}
        <div role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`} className="animate-fade-in">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <StatisticalRankings robotId={robot.id} />
              <PerformanceByContext robotId={robot.id} />
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="space-y-6">
              <RecentBattles battles={recentBattles as BattleHistory[]} robotId={robot.id} />
              <UpcomingMatches robotId={robot.id} battleReadiness={battleReadiness} />
            </div>
          )}

          {activeTab === 'analytics' && (
            <RobotPerformanceAnalytics robotId={robot.id} lastNCycles={10} />
          )}

          {activeTab === 'battle-config' && isOwner && (
            <BattleConfigTab
              robot={robot as unknown as RobotWithAttributes}
              weapons={weapons}
              repairBayLevel={repairBayLevel}
              activeRobotCount={activeRobotCount}
              onRobotUpdate={handleRobotUpdate}
              onEquipWeapon={handleEquipWeapon}
              onUnequipWeapon={handleUnequipWeapon}
            />
          )}

          {activeTab === 'upgrades' && isOwner && (
            <UpgradePlanner
              robot={robot as unknown as RobotWithAttributes}
              currentCredits={currency}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
              onCommit={handleCommitUpgrades}
              onNavigateToFacilities={() => navigate('/facilities')}
            />
          )}

          {activeTab === 'tuning' && isOwner && (
            <TuningPoolEditor
              robotId={robot.id}
              robot={robot as unknown as RobotWithAttributes}
            />
          )}

          {activeTab === 'stats' && (
            <div className="mb-6">
              <EffectiveStatsDisplay robot={robot as unknown as RobotWithAttributes} />
            </div>
          )}

          {activeTab === 'league-history' && (
            <div className="space-y-6" data-testid="league-history-tab">
              <LeagueHistoryTab robotId={robot.id} currentTier={robot.currentLeague} currentLp={robot.leaguePoints} robotName={robot.name} />
              <TeamBattleLeagueHistory robotId={robot.id} />
              <ChampionshipWinsSection userId={robot.userId} />
            </div>
          )}

          {/* Non-Owner View for owner-only tabs */}
          {!isOwner && (activeTab === 'battle-config' || activeTab === 'upgrades' || activeTab === 'tuning' || activeTab === 'stats') && (
            <div className="bg-surface p-6 rounded-lg text-center">
              <p className="text-secondary text-lg">
                {activeTab === 'stats' 
                  ? 'Detailed stats are only visible to the robot owner.'
                  : 'You can only view battle configuration and upgrades for your own robots.'}
              </p>
              <button
                onClick={() => navigate('/robots')}
                className="mt-4 bg-primary hover:bg-blue-700 px-6 py-2 rounded"
              >
                View My Robots
              </button>
            </div>
          )}
        </div>

        {/* Robot Image Selector Modal */}
        {isOwner && (
          <RobotImageSelector
            isOpen={showImageSelector}
            currentImageUrl={robot.imageUrl}
            onSelect={handleAppearanceChange}
            onClose={() => setShowImageSelector(false)}
            robotId={robot.id}
          />
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default RobotDetailPage;

/* ------------------------------------------------------------------ */
/*  League History Tab                                                  */
/* ------------------------------------------------------------------ */

function LeagueHistoryTab({ robotId, currentTier, currentLp, robotName }: { robotId: number; currentTier: string; currentLp: number; robotName: string }) {
  const [allHistory, setAllHistory] = useState<LeagueHistoryEntry[]>([]);
  const [kothStanding, setKothStanding] = useState<KothStandingData | null>(null);
  const [grandMeleeStanding, setGrandMeleeStanding] = useState<KothStandingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchRobotLeagueHistory(robotId).then(res => res.data || res).catch(() => []),
      fetchRobotKothStanding(robotId).then(res => res.standing).catch(() => null),
      api.get<{ standing: KothStandingData | null }>(`/api/robots/${robotId}/grand-melee-standing`).then(res => res.standing).catch(() => null),
    ]).then(([historyData, koth, grandMelee]) => {
      if (cancelled) return;
      setAllHistory(
        (historyData as Array<{ cycleNumber: number; destinationTier: string; changeType: string; leaguePoints: number; mode?: string | null }>).map((r) => ({
          cycleNumber: r.cycleNumber,
          destinationTier: r.destinationTier,
          changeType: r.changeType as 'promotion' | 'demotion',
          leaguePoints: r.leaguePoints,
          mode: r.mode,
        }))
      );
      setKothStanding(koth);
      setGrandMeleeStanding(grandMelee);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [robotId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-secondary">
        Loading league history...
      </div>
    );
  }

  // Filter history by mode
  // Legacy records (mode=null) are attributed to league_1v1 since that was the only
  // robot-level mode that recorded history before Spec #44 added the mode column.
  const league1v1History = allHistory.filter(h => h.mode === 'league_1v1' || !h.mode);
  const kothHistory = allHistory.filter(h => h.mode === 'koth');
  const grandMeleeHistory = allHistory.filter(h => h.mode === 'grand_melee');

  return (
    <div className="space-y-6">
      {/* 1v1 League */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">⚔️ 1v1 League History</h3>
        <div className="mb-4 text-sm text-secondary">
          <span className="font-medium text-white">{robotName}</span>
          {' '}is currently in <span className="capitalize font-medium text-white">{currentTier}</span> league
          {' • LP: '}<span className="font-medium text-warning">{currentLp}</span>
        </div>
        <LeagueTimeline
          history={league1v1History}
          currentTier={currentTier}
          emptyMessage={`${robotName} is in ${currentTier} league. No tier changes recorded yet.`}
        />
      </div>

      {/* KotH League */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">👑 KotH League History</h3>
        {kothStanding ? (
          <>
            <div className="mb-4 text-sm text-secondary">
              <span className="font-medium text-white">{robotName}</span>
              {' '}is currently in <span className="capitalize font-medium text-white">{kothStanding.tier}</span> league
              {' • LP: '}<span className="font-medium text-warning">{kothStanding.leaguePoints}</span>
              {' • Wins: '}<span className="font-medium text-white">{kothStanding.wins}</span>
              {' • Matches: '}<span className="font-medium text-white">{kothStanding.totalMatches ?? 0}</span>
            </div>
            <LeagueTimeline
              history={kothHistory}
              currentTier={kothStanding.tier}
              emptyMessage={`${robotName} is in ${kothStanding.tier} KotH league. No tier changes recorded yet.`}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-secondary">
            <span className="text-2xl mb-2">👑</span>
            <p className="text-sm">Not subscribed to KotH.</p>
          </div>
        )}
      </div>

      {/* Grand Melee League */}
      <div className="bg-surface p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">💀 Grand Melee League History</h3>
        {grandMeleeStanding ? (
          <>
            <div className="mb-4 text-sm text-secondary">
              <span className="font-medium text-white">{robotName}</span>
              {' '}is currently in <span className="capitalize font-medium text-white">{grandMeleeStanding.tier}</span> league
              {' • LP: '}<span className="font-medium text-warning">{grandMeleeStanding.leaguePoints}</span>
              {' • Wins: '}<span className="font-medium text-white">{grandMeleeStanding.wins}</span>
              {' • Matches: '}<span className="font-medium text-white">{grandMeleeStanding.totalMatches ?? 0}</span>
            </div>
            <LeagueTimeline
              history={grandMeleeHistory}
              currentTier={grandMeleeStanding.tier}
              emptyMessage={`${robotName} is in ${grandMeleeStanding.tier} Grand Melee league. No tier changes recorded yet.`}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-secondary">
            <span className="text-2xl mb-2">💀</span>
            <p className="text-sm">Not subscribed to Grand Melee.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Championship Wins Section                                          */
/* ------------------------------------------------------------------ */

function ChampionshipWinsSection({ userId }: { userId: number }) {
  const { user } = useAuth();
  const [titles, setTitles] = useState<{ titles1v1: number; titles2v2: number; titles3v3: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.id !== userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getProfile()
      .then((profile) => {
        if (!cancelled) {
          setTitles({
            titles1v1: profile.championshipTitles1v1 ?? 0,
            titles2v2: profile.championshipTitles2v2 ?? 0,
            titles3v3: profile.championshipTitles3v3 ?? 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setTitles(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, userId]);

  if (loading) {
    return null;
  }

  if (!titles) {
    return null;
  }

  const totalTitles = titles.titles1v1 + titles.titles2v2 + titles.titles3v3;
  if (totalTitles === 0) {
    return null;
  }

  return (
    <div className="bg-surface rounded-lg p-6" data-testid="championship-wins-section">
      <h3 className="text-lg font-semibold text-white mb-4">🏆 Championship Titles</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {titles.titles1v1 > 0 && (
          <div className="bg-surface-elevated rounded-lg p-4 flex items-center gap-3 min-h-[44px]">
            <span className="text-2xl" aria-hidden="true">🥇</span>
            <div>
              <div className="text-white font-semibold">{titles.titles1v1}× 1v1 🏆</div>
              <div className="text-xs text-secondary">Tournament Champion</div>
            </div>
          </div>
        )}
        {titles.titles2v2 > 0 && (
          <div className="bg-surface-elevated rounded-lg p-4 flex items-center gap-3 min-h-[44px]">
            <span className="text-2xl" aria-hidden="true">🥇</span>
            <div>
              <div className="text-white font-semibold">{titles.titles2v2}× 2v2 🏆</div>
              <div className="text-xs text-secondary">Team Tournament Champion</div>
            </div>
          </div>
        )}
        {titles.titles3v3 > 0 && (
          <div className="bg-surface-elevated rounded-lg p-4 flex items-center gap-3 min-h-[44px]">
            <span className="text-2xl" aria-hidden="true">🥇</span>
            <div>
              <div className="text-white font-semibold">{titles.titles3v3}× 3v3 🏆</div>
              <div className="text-xs text-secondary">Team Tournament Champion</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
