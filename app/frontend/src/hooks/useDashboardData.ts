/**
 * Data loading for the Command Center dashboard.
 *
 * Extracted from DashboardPage.tsx, following the same pattern as
 * `useRobotDetail`. The page renders; this hook decides what to fetch.
 *
 * Covers the five reads the dashboard owns directly (tutorial state, unseen tier
 * changes, recent tournament winners, teams, tuning budgets) and triggers the
 * three shared Zustand stores that back the rest of the page. The stores own
 * their own caching, so calling their fetchers here is cheap.
 *
 * Every request fails silently. None of them is essential to the page: an alert
 * that cannot be computed is simply not shown, which beats replacing the whole
 * dashboard with an error for a missing "you could form a team" hint.
 */

import { useEffect, useState } from 'react';
import { getTutorialState, TutorialState } from '../utils/onboardingApi';
import { api } from '../utils/api';
import { getMyTeamBattles, TeamBattle } from '../utils/teamBattleApi';
import { fetchTuningAllocationSummaries, TuningAllocationSummary } from '../utils/robotApi';
import { fetchCycleProgressSummary, CycleProgressSummary } from '../utils/dashboardApi';
import { useRobotStore, useStableStore } from '../stores';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import type { RecentTournamentWinner, TierChange } from '../utils/dashboardNotifications';

/** Tournament wins are only celebrated for this long afterwards. */
const CHAMPION_WINDOW_MS = 48 * 60 * 60 * 1000;

interface CompletedTournament {
  id: number;
  name: string;
  participantType: string;
  completedAt: string | null;
  winner: {
    id: number;
    name: string;
    user: { id: number; username: string; stableName: string | null };
  } | null;
}

export interface DashboardData {
  tierChanges: TierChange[];
  recentChampions: RecentTournamentWinner[];
  teams: TeamBattle[];
  tuningSummaries: TuningAllocationSummary[];
  onboardingState: TutorialState | null;
  // ── Spec #48 ──
  /** Null while loading and on failure. Three tiles depend on it. */
  cycleProgress: CycleProgressSummary | null;
  cycleProgressLoading: boolean;
  cycleProgressError: string | null;
}

/**
 * @param refreshUser - Optional re-read of the authenticated user, invoked once on
 *        mount so the credit balance and prestige total describe the same moment as
 *        the Current_Cycle figures beside them (Spec #48 Requirement 3 criterion 10).
 *        Passed in rather than pulled from `useAuth` here, so this stays a
 *        data-fetching hook with explicit dependencies and no context coupling.
 */
export function useDashboardData(
  userId: number | undefined,
  refreshUser?: () => Promise<void>,
): DashboardData {
  const robotCount = useRobotStore(state => state.robots.length);
  const fetchRobots = useRobotStore(state => state.fetchRobots);
  const fetchStableData = useStableStore(state => state.fetchStableData);
  const fetchSubscriptionOverview = useSubscriptionStore(state => state.fetchOverview);

  const [tierChanges, setTierChanges] = useState<TierChange[]>([]);
  const [recentChampions, setRecentChampions] = useState<RecentTournamentWinner[]>([]);
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [tuningSummaries, setTuningSummaries] = useState<TuningAllocationSummary[]>([]);
  const [onboardingState, setOnboardingState] = useState<TutorialState | null>(null);
  const [cycleProgress, setCycleProgress] = useState<CycleProgressSummary | null>(null);
  const [cycleProgressLoading, setCycleProgressLoading] = useState(true);
  const [cycleProgressError, setCycleProgressError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;

    fetchRobots();
    fetchStableData();
    fetchSubscriptionOverview();

    // Spec #48 Requirement 3 criterion 10 and Requirement 6 criterion 12.
    //
    // `AuthContext` calls `refreshUser` once, when the application mounts, and never
    // again unless asked. Without this a player who navigates within the SPA across a
    // Battle_Slot boundary and then opens the Dashboard would see a prestige total and
    // credit balance from whenever the tab was opened, sitting beside Current_Cycle
    // figures that are current — and a Prestige_Gate progress bar computed from the
    // stale total.
    //
    // ONE call covers both figures (criterion 12 forbids a second request for the
    // balance alone), and a rejection is swallowed: the tiles fall back to the values
    // already in the context, because a stale total is more useful than no tile
    // (criteria 11 and 13). This differs from the Cycle_Progress_Summary read below,
    // whose failure IS surfaced, because three tiles depend on that one.
    refreshUser?.().catch(() => { /* a stale total beats an empty tile */ });

    setCycleProgressLoading(true);
    setCycleProgressError(null);
    fetchCycleProgressSummary()
      .then(summary => {
        if (cancelled) return;
        setCycleProgress(summary);
        setCycleProgressLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCycleProgress(null);
        setCycleProgressError("Today's figures are unavailable.");
        setCycleProgressLoading(false);
      });

    getTutorialState()
      .then(state => { if (!cancelled) setOnboardingState(state); })
      .catch(() => { if (!cancelled) setOnboardingState(null); });

    api.get<{ changes: TierChange[] }>('/api/leagues/tier-changes/unseen')
      .then(data => { if (!cancelled) setTierChanges(data.changes); })
      .catch(() => { /* an unseen-change banner is optional */ });

    api.get<{ tournaments: CompletedTournament[] }>('/api/tournaments', { params: { status: 'completed' } })
      .then(data => {
        if (cancelled) return;
        const cutoff = Date.now() - CHAMPION_WINDOW_MS;
        setRecentChampions(
          (data.tournaments ?? [])
            .filter(t => t.winner && t.completedAt && new Date(t.completedAt).getTime() > cutoff)
            .map(t => ({
              tournamentId: t.id,
              tournamentName: t.name,
              participantType: t.participantType,
              winnerName: t.winner!.name,
              isMyWin: t.winner!.user.id === userId,
            })),
        );
      })
      .catch(() => { /* champion celebrations are optional */ });

    getMyTeamBattles()
      .then(fetched => { if (!cancelled) setTeams(fetched); })
      .catch(() => { /* team hints are optional */ });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Tuning budgets are one request for the whole roster, but still keyed on the
  // roster size so a newly created robot picks up its allocation prompt without
  // a reload.
  useEffect(() => {
    if (robotCount === 0) {
      setTuningSummaries([]);
      return;
    }
    let cancelled = false;

    fetchTuningAllocationSummaries()
      .then(summaries => { if (!cancelled) setTuningSummaries(summaries); })
      .catch(() => { /* the tuning prompt is optional */ });

    return () => { cancelled = true; };
  }, [robotCount]);

  return {
    tierChanges,
    recentChampions,
    teams,
    tuningSummaries,
    onboardingState,
    cycleProgress,
    cycleProgressLoading,
    cycleProgressError,
  };
}
