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
}

export function useDashboardData(userId: number | undefined): DashboardData {
  const robotCount = useRobotStore(state => state.robots.length);
  const fetchRobots = useRobotStore(state => state.fetchRobots);
  const fetchStableData = useStableStore(state => state.fetchStableData);
  const fetchSubscriptionOverview = useSubscriptionStore(state => state.fetchOverview);

  const [tierChanges, setTierChanges] = useState<TierChange[]>([]);
  const [recentChampions, setRecentChampions] = useState<RecentTournamentWinner[]>([]);
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [tuningSummaries, setTuningSummaries] = useState<TuningAllocationSummary[]>([]);
  const [onboardingState, setOnboardingState] = useState<TutorialState | null>(null);

  useEffect(() => {
    if (userId === undefined) return;
    let cancelled = false;

    fetchRobots();
    fetchStableData();
    fetchSubscriptionOverview();

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

  return { tierChanges, recentChampions, teams, tuningSummaries, onboardingState };
}
