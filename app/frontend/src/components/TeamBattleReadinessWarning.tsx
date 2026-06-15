/**
 * TeamBattleReadinessWarning Component
 *
 * Dashboard-level warning that checks if any of the player's 2v2/3v3 League
 * teams has an ineligible member (not subscribed, not battle-ready, or destroyed).
 *
 * Links to /team-battles management page for resolution.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyTeamBattles, TeamBattle } from '../utils/teamBattleApi';
import { createLogger } from '../utils/logger';

const log = createLogger('TeamBattleReadinessWarning');

interface TeamBattleReadinessWarningProps {
  compact?: boolean;
}

function TeamBattleReadinessWarning({ compact = false }: TeamBattleReadinessWarningProps) {
  const navigate = useNavigate();
  const [ineligibleTeams, setIneligibleTeams] = useState<TeamBattle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const teams = await getMyTeamBattles();
      const notEligible = teams.filter(team => team.eligibility === 'INELIGIBLE');
      setIneligibleTeams(notEligible);
    } catch (err) {
      log.error('Failed to fetch team battles for readiness check', { err });
    } finally {
      setLoading(false);
    }
  };

  if (loading || ineligibleTeams.length === 0) {
    return null;
  }

  if (compact) {
    const firstTeam = ineligibleTeams[0];
    const reasonText = firstTeam.ineligibilityReason === 'missing_subscription'
      ? `${firstTeam.teamName}: member missing subscription`
      : firstTeam.ineligibilityReason === 'incomplete_roster'
      ? `${firstTeam.teamName}: incomplete roster`
      : firstTeam.ineligibilityReason === 'member_destroyed'
      ? `${firstTeam.teamName}: member destroyed`
      : `${ineligibleTeams.length} team${ineligibleTeams.length > 1 ? 's' : ''} not eligible`;

    return (
      <div
        className="bg-warning/10 border-l-4 border-warning rounded-lg p-4 flex items-center justify-between cursor-pointer hover:bg-warning/15 transition-colors"
        onClick={() => navigate('/team-battles')}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <span className="text-warning font-semibold">
              {ineligibleTeams.length} team battle{ineligibleTeams.length > 1 ? 's' : ''} not eligible
            </span>
            <span className="text-warning/80 text-sm block">
              {reasonText}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate('/team-battles');
          }}
          className="bg-warning hover:bg-warning/90 text-gray-900 font-semibold py-2 px-4 rounded text-sm transition-colors"
        >
          Manage Teams
        </button>
      </div>
    );
  }

  return (
    <div className="bg-warning/10 border border-warning rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-warning text-xl">⚠️</span>
        <span className="text-warning font-semibold">Team Battle Eligibility Issues</span>
      </div>
      <div className="space-y-2">
        {ineligibleTeams.map((team) => (
          <div key={team.id} className="bg-surface rounded-lg p-3">
            <div className="font-semibold text-white mb-1">
              {team.teamName}
              <span className="text-secondary text-sm ml-2">
                ({team.teamSize}v{team.teamSize} League)
              </span>
            </div>
            <div className="text-sm text-warning ml-4">
              {team.ineligibilityReason === 'missing_subscription'
                ? `${team.ineligibilityDetail ?? 'A member'} is not subscribed to ${team.teamSize}v${team.teamSize} League. Subscribe via the Booking Office.`
                : team.ineligibilityReason === 'incomplete_roster'
                ? `Incomplete roster (${team.ineligibilityDetail ?? `${team.members.length}/${team.teamSize}`} members)`
                : team.ineligibilityReason === 'member_destroyed'
                ? `${team.ineligibilityDetail ?? 'A member'} has been destroyed (0 HP).`
                : team.members.length < team.teamSize
                ? `Incomplete roster (${team.members.length}/${team.teamSize} members)`
                : 'One or more members not battle-ready or missing subscription'}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate('/team-battles')}
        className="mt-3 w-full bg-warning hover:bg-warning/90 text-gray-900 font-semibold py-2 px-4 rounded-lg transition-colors"
      >
        Manage Teams
      </button>
    </div>
  );
}

export default TeamBattleReadinessWarning;
