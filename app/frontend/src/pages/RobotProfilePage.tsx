/**
 * Public robot profile (`/robots/:id`, #504). One page, no tabs: who the
 * robot is, how it does in each mode this season, its form, history and
 * achievements. Attributes, tuning and configuration stay with the owner in
 * the Workshop (`/robots/:id/prepare`); opponents scout builds from battle
 * reports. Old `?tab=` links to owner tabs are sent to the Workshop.
 */
import { useMemo } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useRobotDetail } from '../hooks/useRobotDetail';
import { useRobotProfile } from '../components/robot-profile/useRobotProfile';
import { ProfileHeader } from '../components/robot-profile/ProfileHeader';
import { SeasonModeCards } from '../components/robot-profile/SeasonModeCards';
import { FormSection } from '../components/robot-profile/FormSection';
import { HistorySection } from '../components/robot-profile/HistorySection';
import { AchievementsSection } from '../components/robot-profile/AchievementsSection';
import { liveModeCells, tierSummary } from '../utils/stableViewFormat';
import { formItems } from '../utils/robotProfileFormat';
import { workshopPathForTab } from '../utils/robotRoutes';

function RobotProfilePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { robot, loading, isOwner, allModesBattleCount, battleReadiness } = useRobotDetail();
  const { profile, failed, reload } = useRobotProfile(robot?.id);

  const summary = useMemo(() => (profile ? tierSummary(liveModeCells(profile.standings)) : null), [profile]);
  const form = useMemo(() => (profile && robot ? formItems(profile.form, robot.id) : null), [profile, robot]);

  // Old deep links (`?tab=upgrades`, `?tab=battle-config`, …) and the onboarding tutorial.
  const legacy = workshopPathForTab(robot?.id, params.get('tab'), params.get('onboarding') === 'true');
  if (robot && isOwner && legacy) return <Navigate to={legacy} replace />;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-white"><div className="text-xl">Loading robot…</div></div>;
  }
  if (!robot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-white">
        <div className="text-center">
          <p className="mb-4 text-xl">Robot not found</p>
          <button onClick={() => navigate('/robots')} className="min-h-[44px] rounded bg-primary px-6 py-2 hover:bg-primary-dark">Back to Robots</button>
        </div>
      </div>
    );
  }

  const owner = robot.user
    ? { id: robot.userId, name: robot.user.stableName || robot.user.username, stableType: robot.user.stableType }
    : null;

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="container mx-auto space-y-8 px-4 py-6 pb-24 lg:pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => navigate(-1)} className="min-h-[44px] text-primary hover:underline">← Back</button>
          {isOwner && (
            <Link to={`/robots/${robot.id}/prepare`} className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-background hover:bg-primary-light">
              Workshop →
            </Link>
          )}
        </div>

        <ProfileHeader
          name={robot.name}
          imageUrl={robot.imageUrl}
          owner={owner}
          createdAt={robot.createdAt}
          summary={summary}
          accolades={profile?.accolades ?? []}
          achievementCount={profile?.achievements.length ?? 0}
          elo={robot.elo}
          fame={robot.fame}
          kills={robot.kills}
          battles={allModesBattleCount ?? robot.totalBattles}
          form={form ?? []}
        />

        <SeasonModeCards standings={profile?.standings ?? null} failed={failed} onRetry={reload} />
        <FormSection robotId={robot.id} form={form} failed={failed} onRetry={reload} isOwner={isOwner} battleReadiness={battleReadiness} />
        <HistorySection robotId={robot.id} standings={profile?.standings ?? null} />
        <AchievementsSection achievements={profile?.achievements ?? []} />
      </div>
    </div>
  );
}

export default RobotProfilePage;
