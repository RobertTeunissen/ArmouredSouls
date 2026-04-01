import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

interface LeaguePerformance {
  leagueName: string;
  leagueIcon: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
  damageDealt: number;
  damageTaken: number;
  eloChange: number;
  battlesPlayed: number;
}

interface TournamentPerformance {
  tournamentId: number;
  tournamentName: string;
  tournamentDate: string;
  placement: number;
  totalParticipants: number;
  wins: number;
  losses: number;
  damageDealt: number;
  damageTaken: number;
}

interface TagTeamPerformance {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
  damageDealt: number;
  damageTaken: number;
}

interface PerformanceByContextProps {
  robotId: number;
}

function PerformanceByContext({ robotId }: PerformanceByContextProps) {
  const [leagues, setLeagues] = useState<LeaguePerformance[]>([]);
  const [tournaments, setTournaments] = useState<TournamentPerformance[]>([]);
  const [tagTeam, setTagTeam] = useState<TagTeamPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPerformanceContext = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/robots/${robotId}/performance-context`);
        setLeagues(response.data.leagues);
        setTournaments(response.data.tournaments);
        setTagTeam(response.data.tagTeam);
      } catch (err) {
        setError('Failed to load performance data');
        console.error('Performance context fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceContext();
  }, [robotId]);

  const getPlacementBadge = (placement: number) => {
    if (placement === 1) {
      return <span className="text-warning text-xl">🥇</span>;
    } else if (placement === 2) {
      return <span className="text-secondary text-xl">🥈</span>;
    } else if (placement === 3) {
      return <span className="text-amber-700 text-xl">🥉</span>;
    } else {
      return <span className="text-secondary font-semibold">#{placement}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-4">
        <h3 className="text-base font-semibold mb-3">Battle Performance</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface-elevated rounded p-2 animate-pulse">
              <div className="h-4 bg-gray-600 rounded mb-1 w-1/3"></div>
              <div className="h-3 bg-gray-600 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg p-4">
        <h3 className="text-base font-semibold mb-3">Battle Performance</h3>
        <p className="text-error text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-4">
      <h3 className="text-base font-semibold mb-3">Battle Performance</h3>

      <div className="flex items-center gap-3 mb-2 text-[10px] text-tertiary">
        <div className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded"></span>
          <span>Damage Dealt</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded"></span>
          <span>Damage Taken</span>
        </div>
      </div>

      <div className="space-y-2">
        {/* Leagues Section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">🏆</span>
            <h4 className="text-xs font-semibold text-secondary">Leagues</h4>
            {leagues.length === 0 && <span className="text-xs text-tertiary">No battles yet</span>}
          </div>
          
          {leagues.length > 0 && (
            <div className="space-y-1.5">
              {leagues.map((league, index) => (
                <div key={`${league.leagueName}-${index}`} className="ml-5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs capitalize text-secondary">{league.leagueName}</span>
                    <div className="text-xs">
                      <span className="text-success">{league.wins}W</span>
                      <span className="text-tertiary mx-0.5">-</span>
                      <span className="text-error">{league.losses}L</span>
                      {league.draws > 0 && (
                        <>
                          <span className="text-tertiary mx-0.5">-</span>
                          <span className="text-amber-400">{league.draws}D</span>
                        </>
                      )}
                      <span className="text-tertiary ml-1">({league.winRate}%)</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 h-1.5">
                    <div
                      className="bg-green-500 rounded"
                      style={{
                        width: `${(league.damageDealt / (league.damageDealt + league.damageTaken)) * 100}%`,
                      }}
                      title={`Dealt: ${league.damageDealt.toLocaleString()}`}
                    ></div>
                    <div
                      className="bg-red-500 rounded"
                      style={{
                        width: `${(league.damageTaken / (league.damageDealt + league.damageTaken)) * 100}%`,
                      }}
                      title={`Taken: ${league.damageTaken.toLocaleString()}`}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tournaments Section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">🏅</span>
            <h4 className="text-xs font-semibold text-secondary">Tournaments</h4>
            {tournaments.length === 0 && <span className="text-xs text-tertiary">No battles yet</span>}
          </div>
          
          {tournaments.length > 0 && (
            <div className="space-y-1.5">
              {tournaments.map((tournament) => (
                <div key={tournament.tournamentId} className="ml-5">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-secondary">{tournament.tournamentName}</span>
                      {getPlacementBadge(tournament.placement)}
                    </div>
                    <div className="text-xs">
                      <span className="text-success">{tournament.wins}W</span>
                      <span className="text-tertiary mx-0.5">-</span>
                      <span className="text-error">{tournament.losses}L</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 h-1.5">
                    <div
                      className="bg-green-500 rounded"
                      style={{
                        width: `${(tournament.damageDealt / (tournament.damageDealt + tournament.damageTaken)) * 100}%`,
                      }}
                      title={`Dealt: ${tournament.damageDealt.toLocaleString()}`}
                    ></div>
                    <div
                      className="bg-red-500 rounded"
                      style={{
                        width: `${(tournament.damageTaken / (tournament.damageDealt + tournament.damageTaken)) * 100}%`,
                      }}
                      title={`Taken: ${tournament.damageTaken.toLocaleString()}`}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tag Team Section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">👥</span>
            <h4 className="text-xs font-semibold text-secondary">Tag Team</h4>
            {(!tagTeam || tagTeam.totalBattles === 0) && <span className="text-xs text-tertiary">No battles yet</span>}
          </div>
          
          {tagTeam && tagTeam.totalBattles > 0 && (
            <div className="ml-5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-secondary">{tagTeam.totalBattles} battles</span>
                <div className="text-xs">
                  <span className="text-success">{tagTeam.wins}W</span>
                  <span className="text-tertiary mx-0.5">-</span>
                  <span className="text-error">{tagTeam.losses}L</span>
                  {tagTeam.draws > 0 && (
                    <>
                      <span className="text-tertiary mx-0.5">-</span>
                      <span className="text-amber-400">{tagTeam.draws}D</span>
                    </>
                  )}
                  <span className="text-tertiary ml-1">({tagTeam.winRate}%)</span>
                </div>
              </div>
              <div className="flex gap-0.5 h-1.5">
                <div
                  className="bg-green-500 rounded"
                  style={{
                    width: `${(tagTeam.damageDealt / (tagTeam.damageDealt + tagTeam.damageTaken)) * 100}%`,
                  }}
                  title={`Dealt: ${tagTeam.damageDealt.toLocaleString()}`}
                ></div>
                <div
                  className="bg-red-500 rounded"
                  style={{
                    width: `${(tagTeam.damageTaken / (tagTeam.damageDealt + tagTeam.damageTaken)) * 100}%`,
                  }}
                  title={`Taken: ${tagTeam.damageTaken.toLocaleString()}`}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PerformanceByContext;
