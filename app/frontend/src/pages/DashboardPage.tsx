import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getTutorialState, TutorialState } from '../utils/onboardingApi';
import { api } from '../utils/api';
import { getMyTeamBattles, TeamBattle } from '../utils/teamBattleApi';
import { fetchTuningAllocation, TuningAllocationState } from '../utils/robotApi';
import { getNextPrestigeThreshold, getUnlockedFacilityLevel } from '../../../shared/utils/prestigeGates';
import Navigation from '../components/Navigation';
import UpcomingMatches from '../components/UpcomingMatches';
import SeasonPhaseCard from '../components/season/SeasonPhaseCard';
import { useSeasonStore, selectSeason, selectShouldShowCountdown } from '../stores/seasonStore';
import RecentMatches from '../components/RecentMatches';
import FinancialSummary from '../components/FinancialSummary';
import RobotDashboardCard from '../components/RobotDashboardCard';
import StableStatistics from '../components/StableStatistics';
import LeagueStandingsSummary from '../components/LeagueStandingsSummary';
import ActiveTournamentCard from '../components/ActiveTournamentCard';
import DashboardNotification from '../components/DashboardNotification';
import ChangelogModal from '../components/ChangelogModal';
import { useRobotStore, useStableStore } from '../stores';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import type { DashboardNotificationProps } from '../components/DashboardNotification';

interface TierChange {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  changeType: 'promotion' | 'demotion';
  sourceTier: string;
  destinationTier: string;
  mode?: string;
}

interface RecentTournamentWinner {
  tournamentId: number;
  tournamentName: string;
  participantType: string;
  winnerName: string;
  isMyWin: boolean;
}

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const robots = useRobotStore(state => state.robots);
  const season = useSeasonStore(selectSeason);
  const isPreparing = season?.phase === 'preparation';
  const showSeasonCountdown = useSeasonStore(selectShouldShowCountdown(5));
  const dismissSeasonBanner = useSeasonStore(state => state.dismissBanner);
  const fetchRobots = useRobotStore(state => state.fetchRobots);
  const fetchStableData = useStableStore(state => state.fetchStableData);
  const subscriptionOverview = useSubscriptionStore(state => state.overview);
  const fetchSubscriptionOverview = useSubscriptionStore(state => state.fetchOverview);
  const [robotNotifications, setRobotNotifications] = useState<DashboardNotificationProps[]>([]);
  const [tierChanges, setTierChanges] = useState<TierChange[]>([]);
  const [recentChampions, setRecentChampions] = useState<RecentTournamentWinner[]>([]);
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [tuningStates, setTuningStates] = useState<TuningAllocationState[]>([]);
  const [onboardingState, setOnboardingState] = useState<TutorialState | null>(null);

  useEffect(() => {
    if (user) {
      fetchRobots();
      fetchStableData();
      fetchSubscriptionOverview();
      getTutorialState()
        .then(setOnboardingState)
        .catch(() => setOnboardingState(null));
      // Fetch unseen tier changes
      api.get<{ changes: TierChange[] }>('/api/leagues/tier-changes/unseen')
        .then((data) => setTierChanges(data.changes))
        .catch(() => { /* silent */ });
      // Fetch recently completed tournaments to celebrate winners
      api.get<{ tournaments: Array<{ id: number; name: string; participantType: string; completedAt: string | null; winner: { id: number; name: string; user: { id: number; username: string; stableName: string | null } } | null }> }>('/api/tournaments', { params: { status: 'completed' } })
        .then((data) => {
          const cutoff = Date.now() - 48 * 60 * 60 * 1000; // last 48h
          const recent = data.tournaments
            .filter(t => t.winner && t.completedAt && new Date(t.completedAt).getTime() > cutoff)
            .map(t => ({
              tournamentId: t.id,
              tournamentName: t.name,
              participantType: t.participantType,
              winnerName: t.winner!.name,
              isMyWin: t.winner!.user.id === user.id,
            }));
          setRecentChampions(recent);
        })
        .catch(() => { /* silent */ });
      // Fetch all teams
      getMyTeamBattles()
        .then(setTeams)
        .catch(() => { /* silent */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch tuning allocation for all robots once they're loaded
  useEffect(() => {
    if (robots.length === 0) return;
    Promise.all(
      robots.map(r => fetchTuningAllocation(r.id).catch(() => null))
    ).then(results => {
      setTuningStates(results.filter((r): r is TuningAllocationState => r !== null));
    });
  }, [robots]);

  // Generate priority-based robot notifications
  useEffect(() => {
    const alerts: DashboardNotificationProps[] = [];

    // ── No-robot states (welcome / onboarding / create first robot) ───────
    if (robots.length === 0) {
      const isNewUser = onboardingState &&
        !onboardingState.hasCompletedOnboarding &&
        !onboardingState.onboardingSkipped &&
        onboardingState.currentStep <= 1;

      const isResumeUser = onboardingState &&
        !onboardingState.hasCompletedOnboarding &&
        !onboardingState.onboardingSkipped &&
        onboardingState.currentStep > 1;

      if (isNewUser) {
        // First login ever — welcome
        alerts.push({
          variant: 'info',
          icon: '👋',
          message: 'Welcome to Armoured Souls!',
          detail: 'Start the interactive tutorial to learn the ropes in 5 guided steps',
          actionLabel: 'Begin Tutorial',
          onAction: () => navigate('/onboarding'),
        });
      } else if (isResumeUser) {
        // Onboarding started but not finished
        const displayStep = onboardingState!.currentStep <= 2 ? 1
          : onboardingState!.currentStep <= 5 ? 2
          : onboardingState!.currentStep <= 7 ? 3
          : onboardingState!.currentStep - 4;
        alerts.push({
          variant: 'info',
          icon: '🎓',
          message: `Tutorial in progress — step ${displayStep} of 5`,
          detail: 'Pick up where you left off',
          actionLabel: 'Resume Tutorial',
          onAction: () => navigate('/onboarding'),
        });
      }

      // Always show "create your first robot" when roster is empty
      alerts.push({
        variant: 'warning',
        icon: '🤖',
        message: 'You don\'t have any robots yet',
        detail: 'Create your first robot to start competing in battles',
        actionLabel: 'Create Robot',
        onAction: () => navigate('/robots'),
      });

      setRobotNotifications(alerts);
      return;
    }

    // ── Onboarding reminder (has robots but tutorial not finished) ─────────
    if (
      onboardingState &&
      !onboardingState.hasCompletedOnboarding &&
      !onboardingState.onboardingSkipped
    ) {
      const displayStep = onboardingState.currentStep <= 2 ? 1
        : onboardingState.currentStep <= 5 ? 2
        : onboardingState.currentStep <= 7 ? 3
        : onboardingState.currentStep - 4;
      alerts.push({
        variant: 'info',
        icon: '🎓',
        message: `Tutorial in progress — step ${displayStep} of 5`,
        detail: 'Pick up where you left off',
        actionLabel: 'Resume Tutorial',
        onAction: () => navigate('/onboarding'),
      });
    }

    // Priority 1: No weapon equipped (cannot be scheduled at all)
    const noWeaponRobots = robots.filter(r => !r.mainWeaponId);
    if (noWeaponRobots.length > 0) {
      const first = noWeaponRobots[0];
      const extra = noWeaponRobots.length > 1 ? ` (+${noWeaponRobots.length - 1} more)` : '';
      alerts.push({
        variant: 'danger',
        icon: '🔧',
        message: `${first.name} has no weapon equipped${extra}`,
        detail: 'Cannot be scheduled for any match without a weapon',
        actionLabel: 'Equip Weapon',
        onAction: () => navigate(`/robots/${first.id}`),
      });
    }

    // Priority 2: No subscriptions (has weapon but will never fight)
    if (subscriptionOverview) {
      const noSubRobots = robots.filter(r => {
        if (!r.mainWeaponId) return false; // already covered by P1
        const overview = subscriptionOverview.robots.find(or => or.robotId === r.id);
        return overview && overview.subscriptions.length === 0 && overview.heldSlots.length === 0;
      });
      if (noSubRobots.length > 0) {
        const first = noSubRobots[0];
        const extra = noSubRobots.length > 1 ? ` (+${noSubRobots.length - 1} more)` : '';
        alerts.push({
          variant: 'danger',
          icon: '📋',
          message: `${first.name} has no event subscriptions${extra}`,
          detail: 'Subscribe to at least one event to enter battles',
          actionLabel: 'Manage Subscriptions',
          onAction: () => navigate(`/robots/${first.id}`),
        });
      }

      // Priority 3a: Subscription slots available
      const slotsAvailableRobots = robots
        .filter(r => {
          if (!r.mainWeaponId) return false;
          const overview = subscriptionOverview.robots.find(or => or.robotId === r.id);
          if (!overview) return false;
          const occupied = overview.subscriptions.length + overview.heldSlots.length;
          return occupied > 0 && occupied < overview.cap;
        })
        .map(r => {
          const overview = subscriptionOverview.robots.find(or => or.robotId === r.id)!;
          const free = overview.cap - overview.subscriptions.length - overview.heldSlots.length;
          return { robot: r, free };
        })
        .sort((a, b) => b.free - a.free); // most slots free first

      if (slotsAvailableRobots.length > 0) {
        const { robot: first, free } = slotsAvailableRobots[0];
        const extra = slotsAvailableRobots.length > 1 ? ` (+${slotsAvailableRobots.length - 1} more)` : '';
        alerts.push({
          variant: 'warning',
          icon: '📬',
          message: `${first.name} has ${free} subscription slot${free > 1 ? 's' : ''} available${extra}`,
          detail: 'Subscribe to more events to fight more often',
          actionLabel: 'View Subscriptions',
          onAction: () => navigate(`/robots/${first.id}`),
        });
      }
    }

    // Priority 3b: Unallocated tuning points
    if (tuningStates.length > 0) {
      const unallocatedRobots = tuningStates
        .filter(t => t.remaining > 0 && t.poolSize > 0)
        .map(t => ({ tuning: t, robot: robots.find(r => r.id === t.robotId) }))
        .filter((entry): entry is { tuning: TuningAllocationState; robot: NonNullable<typeof entry.robot> } => !!entry.robot)
        .sort((a, b) => b.tuning.remaining - a.tuning.remaining);

      if (unallocatedRobots.length > 0) {
        const { robot: first, tuning } = unallocatedRobots[0];
        const extra = unallocatedRobots.length > 1 ? ` (+${unallocatedRobots.length - 1} more)` : '';
        alerts.push({
          variant: 'info',
          icon: '🎯',
          message: `${first.name} has ${tuning.remaining} unallocated tuning point${tuning.remaining > 1 ? 's' : ''}${extra}`,
          detail: 'Allocate tuning points to boost combat performance',
          actionLabel: 'Allocate Tuning',
          onAction: () => navigate(`/robots/${first.id}`),
        });
      }
    }

    // Priority 4: Robot damaged (cheaper repairs at higher HP)
    const damagedRobots = robots
      .filter(r => r.currentHP < r.maxHP && r.mainWeaponId) // only if weapon equipped (otherwise P1 covers it)
      .sort((a, b) => (a.currentHP / a.maxHP) - (b.currentHP / b.maxHP)); // most damaged first

    if (damagedRobots.length > 0) {
      const first = damagedRobots[0];
      const hpPercent = Math.round((first.currentHP / first.maxHP) * 100);
      const extra = damagedRobots.length > 1 ? ` (+${damagedRobots.length - 1} more)` : '';
      alerts.push({
        variant: 'warning',
        icon: '🔨',
        message: `${first.name} is damaged (${hpPercent}% HP)${extra}`,
        detail: 'Repair before the next battle to reduce costs',
        actionLabel: 'Repair',
        onAction: () => navigate(`/robots/${first.id}`),
      });
    }

    setRobotNotifications(alerts);
  }, [robots, subscriptionOverview, tuningStates, onboardingState, navigate]);

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
          {/* League Tier Change Notifications (events — celebratory first) */}
          {tierChanges.map((change) => (
            <DashboardNotification
              key={change.id}
              variant={change.changeType === 'promotion' ? 'success' : 'danger'}
              icon={change.changeType === 'promotion' ? '🏆' : '📉'}
              message={
                `${change.entityName} was ${change.changeType === 'promotion' ? 'promoted' : 'demoted'} from ${change.sourceTier} to ${change.destinationTier}` +
                (change.mode ? ` in ${change.mode === 'league_1v1' ? '1v1 League' : change.mode === 'koth' ? 'KotH' : change.mode === 'grand_melee' ? 'Grand Melee' : change.mode === 'tag_team' ? 'Tag Team' : change.mode === 'league_2v2' ? '2v2 League' : change.mode === 'league_3v3' ? '3v3 League' : change.mode}` : '') +
                '!'
              }
            />
          ))}

          {/* Tournament Champions */}
          {recentChampions.map((champ) => (
            <DashboardNotification
              key={champ.tournamentId}
              variant="success"
              icon="👑"
              message={
                champ.isMyWin
                  ? `${champ.winnerName} won ${champ.tournamentName}!`
                  : `${champ.winnerName} won ${champ.tournamentName}`
              }
              detail={champ.isMyWin ? 'Championship title awarded' : undefined}
              actionLabel="View Tournament"
              onAction={() => navigate(`/tournaments/${champ.tournamentId}`)}
            />
          ))}

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

          {/* Prestige unlock — show next facility tier threshold */}
          {(() => {
            const nextGate = getNextPrestigeThreshold(user.prestige);
            if (!nextGate) return null; // all levels unlocked
            const currentMax = getUnlockedFacilityLevel(user.prestige);
            // Only show if the player has crossed at least the first gate (L4 = 1000 prestige)
            if (currentMax <= 3) return null;
            return (
              <DashboardNotification
                variant="info"
                icon="⭐"
                message={`L${currentMax} facilities unlocked`}
                detail={`Next tier (L${nextGate.level}) requires ${nextGate.required.toLocaleString()} prestige — you have ${user.prestige.toLocaleString()}`}
                actionLabel="View Facilities"
                onAction={() => navigate('/facilities')}
              />
            );
          })()}

          {/* Robot readiness notifications (priority-ordered) */}
          {robotNotifications.map((notif, idx) => (
            <DashboardNotification key={idx} {...notif} />
          ))}

          {/* Team mode subscription gaps */}
          {(() => {
            const modeGaps: { team: TeamBattle; modeLabel: string; missing: string[] }[] = [];

            for (const team of teams) {
              const modes = team.teamSize === 2
                ? [
                    { event: 'league_2v2', label: '2v2 League' },
                    { event: 'tag_team', label: 'Tag Team' },
                    { event: 'tournament_2v2', label: '2v2 Tournament' },
                  ]
                : [
                    { event: 'league_3v3', label: '3v3 League' },
                    { event: 'tournament_3v3', label: '3v3 Tournament' },
                  ];

              for (const { event, label } of modes) {
                const missing = team.members
                  .filter(m => !m.robot.subscriptions?.some(s => s.eventType === event))
                  .map(m => m.robot.name);
                if (missing.length > 0) {
                  modeGaps.push({ team, modeLabel: label, missing });
                }
              }
            }

            if (modeGaps.length === 0) return null;

            const first = modeGaps[0];
            const extra = modeGaps.length > 1 ? ` (+${modeGaps.length - 1} more)` : '';
            return (
              <DashboardNotification
                variant="warning"
                icon="📋"
                message={`${first.team.teamName} missing ${first.modeLabel} subscription${extra}`}
                detail={`${first.missing.join(', ')} not subscribed`}
                actionLabel="Manage Teams"
                onAction={() => navigate('/team-battles')}
              />
            );
          })()}

          {/* Team creation suggestions */}
          {robots.length >= 2 && !teams.some(t => t.teamSize === 2) && (
            <DashboardNotification
              variant="info"
              icon="👥"
              message="You can form a 2v2 team"
              detail="Pair two robots for 2v2 League, Tag Team, and 2v2 Tournaments"
              actionLabel="Create Team"
              onAction={() => navigate('/team-battles')}
            />
          )}
          {robots.length >= 3 && !teams.some(t => t.teamSize === 3) && (
            <DashboardNotification
              variant="info"
              icon="👥"
              message="You can form a 3v3 team"
              detail="Group three robots for 3v3 League and 3v3 Tournaments"
              actionLabel="Create Team"
              onAction={() => navigate('/team-battles')}
            />
          )}
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
            <RecentMatches />
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
