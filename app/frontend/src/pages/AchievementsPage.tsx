import { useState, useEffect, useMemo, useCallback } from 'react';
import Navigation from '../components/Navigation';
import AchievementBadge from '../components/AchievementBadge';
import apiClient from '../utils/apiClient';
import {
  getTierColor,
  getTierLabel,
  getRarityLabel,
  filterAchievements,
  sortAchievements,
} from '../utils/achievementUtils';
import type {
  AchievementsResponse,
  AchievementWithProgress,
  AchievementFilters,
  AchievementSortOption,
  AchievementTier,
} from '../utils/achievementUtils';

const TIER_OPTIONS: Array<{ value: AchievementTier | 'all'; label: string }> = [
  { value: 'all', label: 'All Tiers' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'very_hard', label: 'Very Hard' },
  { value: 'secret', label: 'Secret' },
];

const STATUS_OPTIONS: Array<{ value: 'all' | 'locked' | 'unlocked'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'locked', label: 'Locked' },
  { value: 'unlocked', label: 'Unlocked' },
];

const SORT_OPTIONS: Array<{ value: AchievementSortOption; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'rarity_asc', label: 'Rarest First' },
  { value: 'rarity_desc', label: 'Most Common First' },
  { value: 'status_locked', label: 'Locked First' },
  { value: 'status_unlocked', label: 'Unlocked First' },
  { value: 'tier_hard', label: 'Hardest First' },
  { value: 'tier_easy', label: 'Easiest First' },
];

function AchievementsPage() {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AchievementFilters>({ tier: 'all', status: 'all' });
  const [sortOption, setSortOption] = useState<AchievementSortOption>('default');

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const response = await apiClient.get('/api/achievements');
        setData(response.data);
      } catch {
        setError('Failed to load achievements.');
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  const displayedAchievements = useMemo(() => {
    if (!data) return [];
    const filtered = filterAchievements(data.achievements, filters);
    return sortAchievements(filtered, sortOption, data.rarity.counts, data.rarity.totalActivePlayers);
  }, [data, filters, sortOption]);

  const handlePinToggle = useCallback(async (achievementId: string) => {
    if (!data) return;
    const currentPinned = data.achievements.filter(a => a.isPinned).map(a => a.id);
    const isPinned = currentPinned.includes(achievementId);
    const newPinned = isPinned
      ? currentPinned.filter(id => id !== achievementId)
      : [...currentPinned, achievementId];

    if (newPinned.length > 6) return;

    try {
      await apiClient.put('/api/achievements/pinned', { achievementIds: newPinned });
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          achievements: prev.achievements.map(a => ({
            ...a,
            isPinned: newPinned.includes(a.id),
          })),
        };
      });
    } catch {
      // Silently handle
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <div className="text-xl text-secondary">Loading achievements...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">{error || 'Failed to load achievements.'}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <h1 className="text-3xl font-bold mb-6">Achievements</h1>

        {/* Summary */}
        <AchievementSummary summary={data.summary} />

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filters.tier}
            onChange={e => setFilters(prev => ({ ...prev, tier: e.target.value as AchievementTier | 'all' }))}
            className="bg-surface border border-white/10 rounded px-3 py-2 text-sm text-white"
          >
            {TIER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value as 'all' | 'locked' | 'unlocked' }))}
            className="bg-surface border border-white/10 rounded px-3 py-2 text-sm text-white"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={sortOption}
            onChange={e => setSortOption(e.target.value as AchievementSortOption)}
            className="bg-surface border border-white/10 rounded px-3 py-2 text-sm text-white"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Achievement List */}
        <div className="space-y-3">
          {displayedAchievements.length === 0 ? (
            <div className="bg-surface border border-white/10 rounded-lg p-8 text-center text-secondary">
              No achievements match your filters.
            </div>
          ) : (
            displayedAchievements.map(achievement => (
              <AchievementCard
                key={achievement.id}
                achievement={achievement}
                rarityCounts={data.rarity.counts}
                totalActivePlayers={data.rarity.totalActivePlayers}
                onPinToggle={handlePinToggle}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function AchievementSummary({ summary }: { summary: AchievementsResponse['summary'] }) {
  const tiers = ['easy', 'medium', 'hard', 'very_hard', 'secret'] as const;

  return (
    <div className="bg-surface border border-white/10 rounded-lg p-6 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold">Progress</h2>
        <span className="text-2xl font-bold text-primary">
          {summary.unlocked} / {summary.total}
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {tiers.map(tier => {
          const tierData = summary.byTier[tier];
          if (!tierData) return null;
          return (
            <div
              key={tier}
              className="flex items-center gap-2 bg-surface-elevated rounded px-3 py-1.5"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: getTierColor(tier) }}
              />
              <span className="text-sm text-white">{getTierLabel(tier)}</span>
              <span className="text-sm text-secondary">
                {tierData.unlocked}/{tierData.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementCard({
  achievement,
  rarityCounts,
  totalActivePlayers,
  onPinToggle,
}: {
  achievement: AchievementWithProgress;
  rarityCounts: Record<string, number>;
  totalActivePlayers: number;
  onPinToggle: (id: string) => void;
}) {
  const isSecret = achievement.hidden && !achievement.unlocked;
  const tierColor = getTierColor(achievement.tier);
  const earnerCount = rarityCounts[achievement.id] ?? 0;
  const rarityPct = totalActivePlayers > 0 ? (earnerCount / totalActivePlayers) * 100 : 0;
  const rarity = getRarityLabel(rarityPct);

  return (
    <div className="bg-surface border border-white/10 rounded-lg p-4 flex gap-4 items-start">
      {/* Badge */}
      <div className="shrink-0">
        <AchievementBadge
          tier={achievement.tier}
          badgeIconFile={achievement.badgeIconFile}
          locked={!achievement.unlocked}
          secret={achievement.hidden}
          size={64}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-white">
              {isSecret ? '???' : achievement.name}
            </h3>
            <p className="text-sm text-secondary">
              {isSecret ? 'Secret achievement' : achievement.description}
            </p>
          </div>

          {/* Pin toggle — only for unlocked achievements */}
          {achievement.unlocked && (
            <button
              onClick={() => onPinToggle(achievement.id)}
              className={`shrink-0 text-lg transition-colors ${
                achievement.isPinned ? 'text-primary' : 'text-secondary hover:text-white'
              }`}
              title={achievement.isPinned ? 'Unpin from stable' : 'Pin to stable'}
            >
              {achievement.isPinned ? '⭐' : '☆'}
            </button>
          )}
        </div>

        {/* Progress bar */}
        {!isSecret && achievement.progress && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-secondary">
                {achievement.progress.current.toLocaleString()} / {achievement.progress.target.toLocaleString()} {achievement.progress.label}
                {achievement.progress.bestRobotName && (
                  <span className="text-secondary"> (best: {achievement.progress.bestRobotName})</span>
                )}
              </span>
              <span className="text-secondary">
                {Math.min(100, Math.round((achievement.progress.current / achievement.progress.target) * 100))}%
              </span>
            </div>
            <div className="w-full bg-surface-elevated rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (achievement.progress.current / achievement.progress.target) * 100)}%`,
                  backgroundColor: tierColor,
                }}
              />
            </div>
          </div>
        )}

        {/* Status line: "Not yet achieved" for boolean achievements without progress */}
        {!isSecret && !achievement.progress && !achievement.unlocked && (
          <div className="mt-2 text-xs text-secondary">
            Not yet achieved
          </div>
        )}

        {/* Reward, unlock date, and rarity — always in the same row */}
        {!isSecret && (
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
            <span className={achievement.unlocked ? 'text-success' : 'text-secondary'}>
              ₡{achievement.rewardCredits.toLocaleString()} + {achievement.rewardPrestige} prestige
            </span>
            {achievement.unlocked && achievement.unlockedAt && (
              <span className="text-secondary">
                Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
              </span>
            )}
            {totalActivePlayers > 0 && (
              <span className={rarity.color}>
                {rarity.label} · {earnerCount} of {totalActivePlayers} player{totalActivePlayers !== 1 ? 's' : ''} ({rarityPct.toFixed(0)}%)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AchievementsPage;
