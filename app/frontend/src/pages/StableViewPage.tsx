import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Navigation from '../components/Navigation';
import RobotDashboardCard from '../components/RobotDashboardCard';
import AchievementBadge from '../components/AchievementBadge';
import AchievementPinnerModal from '../components/AchievementPinnerModal';
import apiClient from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import { FACILITY_CATEGORIES } from '../utils/facilityCategories';
import type { AchievementWithProgress } from '../utils/achievementUtils';

interface StableUser {
  id: number;
  username: string;
  stableName: string | null;
  prestige: number;
  prestigeRank: string;
  championshipTitles: number;
}

interface PublicRobot {
  id: number;
  name: string;
  imageUrl: string | null;
  elo: number;
  currentLeague: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  fame: number;
  kills: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
}

interface FacilitySummary {
  type: string;
  name: string;
  level: number;
  maxLevel: number;
}

interface StableStats {
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  highestElo: number;
  activeRobots: number;
}

interface StableData {
  user: StableUser;
  robots: PublicRobot[];
  facilities: FacilitySummary[];
  stats: StableStats;
  achievements?: {
    pinned: Array<{
      id: string;
      name: string;
      tier: string;
      badgeIconFile: string;
      unlockedAt: string;
    }>;
    totalUnlocked: number;
    totalAvailable: number;
  };
}

type PageState = 'loading' | 'success' | 'not-found' | 'error';

function StableViewPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<StableData | null>(null);
  const [pinnerOpen, setPinnerOpen] = useState(false);
  const [pinnerAchievements, setPinnerAchievements] = useState<AchievementWithProgress[]>([]);

  const fetchStable = useCallback(async () => {
    setState('loading');
    setData(null);
    try {
      const response = await apiClient.get(`/api/stables/${userId}`);
      setData(response.data);
      setState('success');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setState('not-found');
      } else {
        setState('error');
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchStable();
  }, [fetchStable]);

  // --- Loading ---
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-xl text-secondary">Loading stable...</div>
        </div>
      </div>
    );
  }

  // --- Not Found ---
  if (state === 'not-found') {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Stable not found</h2>
          <button
            onClick={() => navigate(-1)}
            className="text-primary hover:underline min-h-[44px] min-w-[44px]"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  // --- Network Error ---
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Failed to load stable. Please try again.</h2>
          <button
            onClick={fetchStable}
            className="bg-primary hover:bg-blue-700 px-6 py-2 rounded transition-colors min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // --- Success ---
  const { user, robots, facilities, stats } = data!;
  const displayName = user.stableName || user.username;
  const isOwner = authUser?.id === user.id;
  const achievements = data!.achievements;

  const handleOpenPinner = async () => {
    try {
      const response = await apiClient.get('/api/achievements');
      setPinnerAchievements(response.data.achievements);
      setPinnerOpen(true);
    } catch {
      // Silently handle
    }
  };

  const handleUnpin = async (achievementId: string) => {
    if (!achievements) return;
    const newPinned = achievements.pinned
      .filter(p => p.id !== achievementId)
      .map(p => p.id);
    try {
      await apiClient.put('/api/achievements/pinned', { achievementIds: newPinned });
      setData(prev => {
        if (!prev || !prev.achievements) return prev;
        return {
          ...prev,
          achievements: {
            ...prev.achievements,
            pinned: prev.achievements.pinned.filter(p => p.id !== achievementId),
          },
        };
      });
    } catch {
      // Silently handle
    }
  };

  const handlePinnedChange = (_newPinnedIds: string[]) => {
    // Refresh stable data to get updated pinned achievements
    fetchStable();
  };

  // Group facilities by category
  const groupedFacilities = FACILITY_CATEGORIES.map((cat) => ({
    ...cat,
    facilities: facilities.filter((f) =>
      (cat.facilityTypes as readonly string[]).includes(f.type)
    ),
  })).filter((g) => g.facilities.length > 0);

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 text-primary hover:underline transition-colors min-h-[44px] min-w-[44px]"
        >
          ← Back
        </button>

        {/* Stable Header */}
        <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">{displayName}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:text-base">
            <div>
              <span className="text-secondary">Prestige:</span>{' '}
              <span className="font-semibold text-primary">{user.prestige.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-secondary">Rank:</span>{' '}
              <span className="font-semibold text-white">{user.prestigeRank}</span>
            </div>
            {user.championshipTitles > 0 && (
              <div>
                <span className="text-secondary">Championship Titles:</span>{' '}
                <span className="font-semibold text-amber-400">{user.championshipTitles}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stable Statistics */}
        <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Stable Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard label="Total Battles" value={stats.totalBattles.toLocaleString()} />
            <StatCard label="Total Wins" value={stats.totalWins.toLocaleString()} color="text-success" />
            <StatCard label="Total Losses" value={stats.totalLosses.toLocaleString()} color="text-error" />
            <StatCard label="Total Draws" value={stats.totalDraws.toLocaleString()} />
            <StatCard label="Win Rate" value={`${stats.winRate}%`} color="text-primary" />
            <StatCard label="Highest ELO" value={stats.highestElo.toLocaleString()} color="text-primary" />
            <StatCard label="Active Robots" value={String(stats.activeRobots)} />
          </div>
        </div>

        {/* Achievement Showcase */}
        {achievements && (
          <div className="bg-surface border border-white/10 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Achievement Showcase</h3>
            <div className="flex items-center gap-3 mb-4">
              {Array.from({ length: 6 }).map((_, i) => {
                const pinned = achievements.pinned[i];
                if (pinned) {
                  return (
                    <div key={pinned.id} className="relative group">
                      <AchievementBadge tier={pinned.tier} badgeIconFile={pinned.badgeIconFile} size={64} />
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-surface-elevated border border-white/10 rounded px-3 py-2 text-xs whitespace-nowrap shadow-lg">
                          <p className="font-bold text-white">{pinned.name}</p>
                          <p className="text-secondary">Unlocked {new Date(pinned.unlockedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {/* Unpin button (own stable only) */}
                      {isOwner && (
                        <button
                          onClick={() => handleUnpin(pinned.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-error/80 hover:bg-error rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Unpin"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                }
                // Empty slot
                return (
                  <div key={`empty-${i}`} className="w-16 h-16 flex items-center justify-center">
                    {isOwner ? (
                      <button
                        onClick={handleOpenPinner}
                        className="w-16 h-16 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center text-white/30 hover:border-white/40 hover:text-white/50 transition-colors"
                        title="Pin an achievement"
                      >
                        +
                      </button>
                    ) : (
                      <div className="w-16 h-16 border-2 border-dashed border-white/20 rounded-lg" />
                    )}
                  </div>
                );
              })}
            </div>
            <Link
              to="/achievements"
              className="text-sm text-primary hover:underline"
            >
              {achievements.totalUnlocked}/{achievements.totalAvailable} Achievements · View all →
            </Link>
          </div>
        )}

        {/* Pinner Modal */}
        {pinnerOpen && (
          <AchievementPinnerModal
            achievements={pinnerAchievements}
            currentPinned={achievements?.pinned.map(p => p.id) ?? []}
            onClose={() => setPinnerOpen(false)}
            onPinnedChange={handlePinnedChange}
          />
        )}

        {/* Robots Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Robots</h3>
          {robots.length === 0 ? (
            <div className="bg-surface border border-white/10 rounded-lg p-8 text-center text-secondary">
              This stable has no robots yet
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {robots.map((robot) => (
                <RobotDashboardCard
                  key={robot.id}
                  robot={{
                    ...robot,
                    currentHP: 0,
                    maxHP: 1,
                  }}
                  variant="public"
                />
              ))}
            </div>
          )}
        </div>

        {/* Facilities Section */}
        {groupedFacilities.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Facilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groupedFacilities.map((group) => (
                <div
                  key={group.id}
                  className="bg-surface border border-white/10 rounded-lg p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">{group.icon}</span>
                    <h4 className="text-lg font-semibold">{group.name}</h4>
                  </div>
                  <div className="space-y-3">
                    {group.facilities.map((facility) => (
                      <div key={facility.type} className="flex items-center justify-between">
                        <span className="text-sm text-white">{facility.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-secondary">
                            Level {facility.level}/{facility.maxLevel}
                          </span>
                          <div className="w-16 bg-surface-elevated rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{
                                width: `${facility.maxLevel > 0 ? (facility.level / facility.maxLevel) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-surface-elevated rounded-lg p-3">
      <div className="text-xs text-secondary mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default StableViewPage;
