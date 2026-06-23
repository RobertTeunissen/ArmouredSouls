/**
 * TeamBattleLeagueHistory — Displays league history graphs for a robot's
 * team battle teams (2v2 and/or 3v3).
 *
 * Reuses the same LeagueTimeline chart component as 1v1 league history.
 *
 * Requirements: R9.3, R9.11, R9.15
 */
import { useState, useEffect } from 'react';
import { fetchRobotTeamBattleLeagueHistory, TeamBattleLeagueHistoryEntry } from '../utils/robotApi';
import LeagueTimeline from './LeagueTimeline';
import type { LeagueHistoryEntry } from './LeagueTimeline';

interface TeamBattleLeagueHistoryProps {
  robotId: number;
}

function TeamBattleLeagueHistory({ robotId }: TeamBattleLeagueHistoryProps) {
  const [teams, setTeams] = useState<TeamBattleLeagueHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchRobotTeamBattleLeagueHistory(robotId)
      .then((res) => {
        if (!cancelled) {
          setTeams(res.teams || []);
        }
      })
      .catch(() => {
        if (!cancelled) setTeams([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [robotId]);

  if (loading) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Team League History</h3>
        <div className="flex items-center justify-center py-8 text-secondary">
          Loading team league history...
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="bg-surface rounded-lg p-6" data-testid="team-league-history-empty">
        <h3 className="text-lg font-semibold text-white mb-4">Team League History</h3>
        <div className="flex flex-col items-center justify-center py-12 text-secondary">
          <span className="text-3xl mb-3" aria-hidden="true">📈</span>
          <p className="text-center">No team league history available.</p>
          <p className="text-center text-sm mt-1">
            Team tier changes will appear here once this robot&apos;s teams compete in league battles.
          </p>
        </div>
      </div>
    );
  }

  // Group teams by size
  const teams2v2 = teams.filter((t) => t.teamSize === 2);
  const teams3v3 = teams.filter((t) => t.teamSize === 3);

  return (
    <div className="space-y-6" data-testid="team-league-history">
      {teams2v2.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-1">2v2 League History</h3>
          {teams2v2.map((team) => (
            <TeamLeagueSection key={team.teamId} team={team} />
          ))}
        </div>
      )}

      {/* Tag Team League History (from 2v2 teams) */}
      {teams2v2.some((t) => t.tagTeamHistory && t.tagTeamHistory.length > 0) && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-1">Tag Team League History</h3>
          {teams2v2
            .filter((t) => t.tagTeamHistory && t.tagTeamHistory.length > 0)
            .map((team) => (
              <TagTeamLeagueSection key={`tag-${team.teamId}`} team={team} />
            ))}
        </div>
      )}

      {/* Show tag team current standing even without history */}
      {teams2v2.length > 0 && !teams2v2.some((t) => t.tagTeamHistory && t.tagTeamHistory.length > 0) && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-1">Tag Team League History</h3>
          {teams2v2.map((team) => (
            <TagTeamLeagueSection key={`tag-${team.teamId}`} team={team} />
          ))}
        </div>
      )}

      {teams3v3.length > 0 && (
        <div className="bg-surface rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-1">3v3 League History</h3>
          {teams3v3.map((team) => (
            <TeamLeagueSection key={team.teamId} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Team League Section                                                */
/* ------------------------------------------------------------------ */

function TeamLeagueSection({ team }: { team: TeamBattleLeagueHistoryEntry }) {
  const historyEntries: LeagueHistoryEntry[] = team.history.map((h) => ({
    cycleNumber: h.cycleNumber,
    destinationTier: h.destinationTier,
    changeType: h.changeType as 'promotion' | 'demotion',
    leaguePoints: h.leaguePoints,
  }));

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-white font-medium text-sm">{team.teamName}</span>
        <span className="text-xs text-secondary">
          <span className="font-medium text-white">{team.teamName}</span>
          {' '}is currently in <span className="capitalize font-medium text-white">{team.currentLeague}</span> league
          {' • LP: '}<span className="font-medium text-warning">{team.currentLp}</span>
        </span>
      </div>
      <LeagueTimeline
        history={historyEntries}
        currentTier={team.currentLeague}
        emptyMessage={`${team.teamName} is currently in ${team.currentLeague} league. No tier changes recorded yet.`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tag Team League Section                                            */
/* ------------------------------------------------------------------ */

function TagTeamLeagueSection({ team }: { team: TeamBattleLeagueHistoryEntry }) {
  const historyEntries: LeagueHistoryEntry[] = (team.tagTeamHistory || []).map((h) => ({
    cycleNumber: h.cycleNumber,
    destinationTier: h.destinationTier,
    changeType: h.changeType as 'promotion' | 'demotion',
    leaguePoints: h.leaguePoints,
  }));

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-white font-medium text-sm">{team.teamName}</span>
        <span className="text-xs text-secondary">
          <span className="font-medium text-white">{team.teamName}</span>
          {' '}is currently in <span className="capitalize font-medium text-white">{team.tagTeamCurrentLeague}</span> league
          {' • LP: '}<span className="font-medium text-warning">{team.tagTeamCurrentLp}</span>
        </span>
      </div>
      <LeagueTimeline
        history={historyEntries}
        currentTier={team.tagTeamCurrentLeague}
        emptyMessage={`${team.teamName} is currently in ${team.tagTeamCurrentLeague} tag team league. No tier changes recorded yet.`}
      />
    </div>
  );
}

export default TeamBattleLeagueHistory;
