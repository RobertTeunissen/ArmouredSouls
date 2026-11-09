import { useState } from 'react';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useAuth } from '../../contexts/AuthContext';
import { useStableOverview } from '../../hooks/useSubscriptions';
import ConfirmationModal from '../ConfirmationModal';
import TeamBattleCard from './TeamBattleCard';
import RegisterTeamModal from './RegisterTeamModal';
import RenameTeamModal from './RenameTeamModal';
import SwapMemberModal from './SwapMemberModal';
import { ApiError } from '../../utils/ApiError';
import {
  getMyTeamBattles,
  disbandTeamBattle,
  type TeamBattle,
  type TeamBattleMember,
} from '../../utils/teamBattleApi';

interface TeamBattleManagementContentProps {
  teamSize: 2 | 3;
}

/**
 * Team Battle management content for 2v2 or 3v3 League tab.
 * Shows current teams with members, stats, and CRUD actions.
 * Requirements: R9.8, R9.10, R9.18
 */
function TeamBattleManagementContent({ teamSize }: TeamBattleManagementContentProps) {
  const { user } = useAuth();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [teamToDisband, setTeamToDisband] = useState<TeamBattle | null>(null);
  const [disbanding, setDisbanding] = useState(false);
  const [teamToRename, setTeamToRename] = useState<TeamBattle | null>(null);
  const [teamToSwap, setTeamToSwap] = useState<{ team: TeamBattle; member: TeamBattleMember } | null>(null);
  const { data: stableOverview, refetch: refetchOverview } = useStableOverview();

  const modeLabel = `${teamSize}v${teamSize}`;

  // Get all robots in the stable for team registration (subscriptions are independent of team formation)
  const allRobots = stableOverview?.robots ?? [];

  // A 401 ends the session in the API client; this screen only reports other failures.
  const teamsQuery = useApiQuery(
    (signal) => getMyTeamBattles(teamSize, signal),
    [teamSize],
    { enabled: Boolean(user) },
  );
  const teams = teamsQuery.data ?? [];
  const setTeams = teamsQuery.setData;
  const fetchTeams = teamsQuery.refetch;
  const loading = teamsQuery.loading && teamsQuery.data === null;
  const error = teamsQuery.error
    ? (teamsQuery.error instanceof ApiError && teamsQuery.error.message) || `Failed to load ${modeLabel} teams`
    : null;

  const handleDisband = async () => {
    if (!teamToDisband) return;
    try {
      setDisbanding(true);
      await disbandTeamBattle(teamToDisband.id);
      setTeams(teams.filter((t) => t.id !== teamToDisband.id));
      setTeamToDisband(null);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      alert(message || 'Failed to disband team');
    } finally {
      setDisbanding(false);
    }
  };

  const handleRegisterComplete = () => {
    setShowRegisterModal(false);
    fetchTeams();
    refetchOverview();
  };

  const handleSwapComplete = () => {
    setTeamToSwap(null);
    fetchTeams();
    refetchOverview();
  };

  const handleRenameComplete = () => {
    setTeamToRename(null);
    fetchTeams();
  };

  if (!user) return null;

  return (
    <>
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">{modeLabel} Teams</h2>
          <p className="text-secondary mt-1">
            Manage your {modeLabel} teams
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-6 rounded-lg transition-colors min-h-[44px]"
        >
          + Register a Team
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-secondary">Loading teams...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error rounded-lg p-4 mb-6">
          <p className="text-error">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && teams.length === 0 && (
        <div className="bg-surface-elevated p-8 rounded-lg border border-white/10 text-center">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-4">No {modeLabel} Teams Yet</h3>
            <p className="text-secondary mb-6">
              Register your first {modeLabel} team to compete in {teamSize}-robot battles!
              {allRobots.length < teamSize && (
                <span className="block mt-2 text-warning">
                  You need at least {teamSize} robots in your stable to form a team.
                  Currently available: {allRobots.length}.
                </span>
              )}
            </p>
            <button
              onClick={() => setShowRegisterModal(true)}
              disabled={allRobots.length < teamSize}
              className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Register Your First Team
            </button>
          </div>
        </div>
      )}

      {/* Teams Grid */}
      {!loading && !error && teams.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {teams.map((team) => (
            <TeamBattleCard
              key={team.id}
              team={team}
              onDisband={() => setTeamToDisband(team)}
              onRename={() => setTeamToRename(team)}
              onSwap={(member) => setTeamToSwap({ team, member })}
              onSwapPositions={async () => {
                try {
                  const { swapTeamBattlePositions } = await import('../../utils/teamBattleApi');
                  await swapTeamBattlePositions(team.id);
                  fetchTeams();
                } catch (err: unknown) {
                  const message = err instanceof ApiError ? err.message : 'Failed to swap positions';
                  alert(message);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Register Team Modal */}
      {showRegisterModal && (
        <RegisterTeamModal
          teamSize={teamSize}
          candidateRobots={allRobots}
          existingTeams={teams}
          onClose={() => setShowRegisterModal(false)}
          onComplete={handleRegisterComplete}
        />
      )}

      {/* Rename Modal */}
      {teamToRename && (
        <RenameTeamModal
          team={teamToRename}
          onClose={() => setTeamToRename(null)}
          onComplete={handleRenameComplete}
        />
      )}

      {/* Swap Member Modal */}
      {teamToSwap && (
        <SwapMemberModal
          team={teamToSwap.team}
          memberToSwap={teamToSwap.member}
          candidateRobots={allRobots}
          existingTeams={teams}
          onClose={() => setTeamToSwap(null)}
          onComplete={handleSwapComplete}
        />
      )}

      {/* Disband Confirmation Modal */}
      {teamToDisband && (
        <ConfirmationModal
          title={`Disband ${modeLabel} Team`}
          message={`Are you sure you want to disband "${teamToDisband.teamName}"? This action cannot be undone. The team's league progress will be lost.`}
          confirmLabel="Disband Team"
          cancelLabel="Cancel"
          onConfirm={handleDisband}
          onCancel={() => setTeamToDisband(null)}
          isDestructive={true}
          isLoading={disbanding}
        />
      )}
    </>
  );
}


export default TeamBattleManagementContent;
