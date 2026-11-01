/**
 * Headline numbers of the Achievements page: the catalogue, how many were
 * unlocked by someone, how many by nobody, and unlocks per stable.
 */
import type { ReactNode } from 'react';
import type { AchievementAnalytics } from '../../../utils/adminAchievementsApi';
import { formatCount } from '../../../utils/adminDashboardFormat';

function Card({ label, value, detail }: { label: string; value: string; detail: string }): ReactNode {
  return (
    <div className="rounded-lg border border-white/10 bg-surface px-4 py-3">
      <dt className="text-sm text-white">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</dd>
      <dd className="mt-0.5 text-xs text-secondary">{detail}</dd>
    </div>
  );
}

export function AchievementSummary({ data }: { data: AchievementAnalytics }): ReactNode {
  const who = data.stables === 'players' ? 'active player' : 'stable';
  const secret = data.achievements.filter((row) => row.tier === 'secret').length;
  const perStable = data.population > 0 ? Math.round(data.unlocks / data.population) : 0;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card label="Achievements" value={formatCount(data.totalAchievements)} detail={`in the catalogue (incl. ${secret} secret)`} />
      <Card label="Unlocked by someone" value={formatCount(data.unlockedBySomeone)} detail={`by at least one ${who}`} />
      <Card label="Never unlocked" value={formatCount(data.totalAchievements - data.unlockedBySomeone)} detail={`by any ${who} this season`} />
      <Card label="Unlocks" value={formatCount(data.unlocks)} detail={`${formatCount(perStable)} per ${who}`} />
    </dl>
  );
}
