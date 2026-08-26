import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { getNextPrestigeThreshold, getUnlockedFacilityLevel } from '../../../shared/utils/prestigeGates';
import Navigation from '../components/Navigation';
import UpcomingMatches from '../components/UpcomingMatches';
import SeasonPhaseCard from '../components/season/SeasonPhaseCard';
import { useSeasonStore, selectSeason, selectShouldShowCountdown } from '../stores/seasonStore';
import RecentBattles from '../components/RecentBattles';
import FinancialSummary from '../components/FinancialSummary';
import RobotDashboardCard from '../components/RobotDashboardCard';
import StableStatistics from '../components/StableStatistics';
import LeagueStandingsSummary from '../components/LeagueStandingsSummary';
import ActiveTournamentCard from '../components/ActiveTournamentCard';
import DashboardNotification from '../components/DashboardNotification';
import ChangelogModal from '../components/ChangelogModal';
import { useRobotStore } from '../stores';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useAcknowledgedPrestigeLevel } from '../hooks/useAcknowledgedPrestigeLevel';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  buildPrestigeUnlockNotification,
  buildRobotReadinessNotifications,
  buildTeamCreationNotifications,
  buildTeamSubscriptionGapNotification,
  buildTierChangeNotifications,
  buildTournamentChampionNotifications,
  type NotificationDescriptor,
} from '../utils/dashboardNotifications';

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const robots = useRobotStore(state => state.robots);
  const subscriptionOverview = useSubscriptionStore(state => state.overview);
  const season = useSeasonStore(selectSeason);
  const showSeasonCountdown = useSeasonStore(selectShouldShowCountdown(5));
  const dismissSeasonBanner = useSeasonStore(state => state.dismissBanner);
  const isPreparing = season?.phase === 'preparation';

  const { tierChanges, recentChampions, teams, tuningSummaries, onboardingState } =
    useDashboardData(user?.id);
  const { acknowledgedLevel, acknowledge } = useAcknowledgedPrestigeLevel(user?.id);

  // ── Derived notifications ──────────────────────────────────────────────────
  // Pure functions of the fetched data, so memos rather than state written from
  // an effect. Render order below is the display priority and is load-bearing.

  const eventNotifications = useMemo(
    () => [
      ...buildTierChangeNotifications(tierChanges),
      ...buildTournamentChampionNotifications(recentChampions),
    ],
    [tierChanges, recentChampions],
  );

  const prestigeNotification = useMemo(
    () =>
      user
        ? buildPrestigeUnlockNotification({
            prestige: user.prestige,
            acknowledgedLevel,
            getUnlockedFacilityLevel,
            getNextPrestigeThreshold,
          })
        : null,
    [user, acknowledgedLevel],
  );

  const robotNotifications = useMemo(
    () =>
      buildRobotReadinessNotifications({
        robots,
        subscriptionOverview,
        tuningStates: tuningSummaries,
        onboardingState,
      }),
    [robots, subscriptionOverview, tuningSummaries, onboardingState],
  );

  const teamNotifications = useMemo(() => {
    const gap = buildTeamSubscriptionGapNotification(teams);
    return [
      ...(gap ? [gap] : []),
      ...buildTeamCreationNotifications(robots.length, teams),
    ];
  }, [teams, robots.length]);

  /** Turns a descriptor's route into a navigate callback. */
  const renderNotification = (
    descriptor: NotificationDescriptor,
    onDismiss?: () => void,
  ) => {
    const { key, variant, icon, message, detail, action } = descriptor;
    return (
      <DashboardNotification
        key={key}
        variant={variant}
        icon={icon}
        message={message}
        detail={detail}
        actionLabel={action?.label}
        onAction={action ? () => navigate(action.to) : undefined}
        onDismiss={onDismiss}
      />
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <ChangelogModal />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Dashboard Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 pb-4 border-b border-white/10">
          <h1 className="text-3xl font-bold text-white">Command Center</h1>
          <div className="text-lg text-secondary">
            <span className="font-semibold text-white">{user.stableName || user.username}</span>&apos;s Stable
          </div>
        </div>

        {/* Season phase card — preparation state, cycle 1 notice, or cycle progress */}
        <SeasonPhaseCard />

        {/* Critical Notifications/Warnings - All alerts above overview blocks */}
        <div className="mb-6 space-y-3">
          {/* League tier changes and tournament champions (events — celebratory first) */}
          {eventNotifications.map(n => renderNotification(n))}

          {/* Season ending soon */}
          {showSeasonCountdown && season && (
            <DashboardNotification
              variant="warning"
              icon="⏳"
              message={`Season ${season.seasonNumber} ends in ${season.remainingCompetitiveCycles} cycle${season.remainingCompetitiveCycles === 1 ? '' : 's'}`}
              detail="All progress will be archived and reset. Spend credits and finalize builds now."
              onDismiss={dismissSeasonBanner}
            />
          )}

          {/* Prestige unlock — only once the player has crossed a new gate */}
          {prestigeNotification &&
            renderNotification(prestigeNotification, () =>
              acknowledge(prestigeNotification.unlockedLevel),
            )}

          {/* Robot readiness notifications (priority-ordered) */}
          {robotNotifications.map(n => renderNotification(n))}

          {/* Team subscription gaps and team creation suggestions */}
          {teamNotifications.map(n => renderNotification(n))}
        </div>

        {/* Top Row: Stable Statistics and Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Stable Statistics */}
          <StableStatistics />

          {/* Financial Summary */}
          <FinancialSummary />
        </div>

        {/* Matchmaking Section. Upcoming matches are omitted during a
            preparation window — none are scheduled, so an empty list would read
            as an error rather than as an expected state (Spec #45 R4.5). */}
        {robots.length > 0 && (
          <div className="space-y-6 mb-8">
            <RecentBattles userId={user?.id} />
            {!isPreparing && <UpcomingMatches />}
          </div>
        )}

        {/* Active Tournament Status */}
        {robots.length >= 1 && (
          <div className="mb-8">
            <ActiveTournamentCard />
          </div>
        )}

        {/* League Standings */}
        {robots.length >= 1 && (
          <div className="space-y-6 mb-8">
            <LeagueStandingsSummary />
          </div>
        )}

        {/* My Robots Section */}
        {robots.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">My Robots</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {robots.map((robot) => (
                <RobotDashboardCard key={robot.id} robot={{ ...robot, imageUrl: robot.imageUrl ?? null }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
