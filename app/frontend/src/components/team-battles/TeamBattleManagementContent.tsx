import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useStableOverview } from '../../hooks/useSubscriptions';
import ConfirmationModal from '../ConfirmationModal';
import { ApiError } from '../../utils/ApiError';
import { getTierName, getTierColor, getTierIcon } from '../../utils/tierHelpers';
import {
  getMyTeamBattles,
  registerTeamBattle,
  swapTeamBattleMember,
  renameTeamBattle,
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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamBattle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [teamToDisband, setTeamToDisband] = useState<TeamBattle | null>(null);
  const [disbanding, setDisbanding] = useState(false);
  const [teamToRename, setTeamToRename] = useState<TeamBattle | null>(null);
  const [teamToSwap, setTeamToSwap] = useState<{ team: TeamBattle; member: TeamBattleMember } | null>(null);
  const { data: stableOverview, refetch: refetchOverview } = useStableOverview();

  const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  const modeLabel = `${teamSize}v${teamSize}`;

  // Get robots subscribed to this event type
  const subscribedRobots = stableOverview?.robots.filter(
    (r) => r.subscriptions.some((s) => s.eventType === eventType),
  ) ?? [];

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }
      const data = await getMyTeamBattles(teamSize);
      setTeams(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.statusCode === 401) {
        logout();
        navigate('/login');
        return;
      }
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || `Failed to load ${modeLabel} teams`);
    } finally {
      setLoading(false);
    }
  }, [teamSize, modeLabel, logout, navigate]);

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user, fetchTeams]);

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
          <h2 className="text-2xl font-bold text-white">{modeLabel} League Teams</h2>
          <p className="text-secondary mt-1">
            Manage your {modeLabel} battle teams
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
              Register your first {modeLabel} team to compete in {teamSize}-robot simultaneous battles!
              {subscribedRobots.length < teamSize && (
                <span className="block mt-2 text-warning">
                  You need at least {teamSize} robots subscribed to {modeLabel} League via the Booking Office.
                  Currently subscribed: {subscribedRobots.length}.
                </span>
              )}
            </p>
            <button
              onClick={() => setShowRegisterModal(true)}
              disabled={subscribedRobots.length < teamSize}
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
            />
          ))}
        </div>
      )}

      {/* Register Team Modal */}
      {showRegisterModal && (
        <RegisterTeamModal
          teamSize={teamSize}
          subscribedRobots={subscribedRobots}
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
          subscribedRobots={subscribedRobots}
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

/* ------------------------------------------------------------------ */
/*  Team Battle Card                                                    */
/* ------------------------------------------------------------------ */

interface TeamBattleCardProps {
  team: TeamBattle;
  onDisband: () => void;
  onRename: () => void;
  onSwap: (member: TeamBattleMember) => void;
}

function TeamBattleCard({ team, onDisband, onRename, onSwap }: TeamBattleCardProps) {
  const navigate = useNavigate();
  const tierColor = getTierColor(team.teamLeague);
  const tierName = getTierName(team.teamLeague);
  const tierIcon = getTierIcon(team.teamLeague);
  const totalMatches = team.totalWins + team.totalLosses + team.totalDraws;
  const combinedELO = team.members.reduce((sum, m) => sum + m.robot.elo, 0);
  const isLocked = team.isLockedForBattle;

  return (
    <div className="bg-surface-elevated border border-white/10 rounded-lg p-6 hover:border-primary/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-white mb-1 truncate">{team.teamName}</h3>
          <div className="flex items-center gap-2">
            <span className="text-lg">{tierIcon}</span>
            <span className={`text-sm font-semibold ${tierColor}`}>
              {tierName} League
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRename}
            className="text-secondary hover:text-white text-sm font-semibold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Rename team"
          >
            ✏️
          </button>
          <button
            onClick={onDisband}
            disabled={isLocked}
            className="text-error hover:text-error/80 text-sm font-semibold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            title={isLocked ? 'Cannot disband while battle is scheduled' : 'Disband team'}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Lock Warning */}
      {isLocked && (
        <div className="bg-warning/10 border border-warning rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-warning">🔒</span>
            <span className="text-warning text-sm font-semibold">
              Team locked — battle scheduled
            </span>
          </div>
        </div>
      )}

      {/* Eligibility Warning */}
      {team.eligibility === 'INELIGIBLE' && (
        <div className="bg-warning/10 border-l-4 border-warning rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-warning shrink-0">⚠️</span>
            <span className="text-warning text-sm font-semibold">
              {team.ineligibilityReason === 'missing_subscription'
                ? `Ineligible — ${team.ineligibilityDetail ?? 'A member'} is not subscribed to ${team.teamSize}v${team.teamSize} League. Subscribe via the Booking Office.`
                : team.ineligibilityReason === 'incomplete_roster'
                ? `Ineligible — Team needs ${team.teamSize} members but only has ${team.ineligibilityDetail?.split('/')[0] ?? team.members.length}.`
                : team.ineligibilityReason === 'member_destroyed'
                ? `Ineligible — ${team.ineligibilityDetail ?? 'A member'} has been destroyed (0 HP).`
                : 'Ineligible — check member subscriptions'}
            </span>
          </div>
        </div>
      )}

      {/* Members */}
      <div className={`grid grid-cols-1 ${team.teamSize === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 mb-4`}>
        {team.members.map((member) => (
          <div
            key={member.id}
            className="bg-surface border border-gray-600 rounded-lg p-4 relative group"
          >
            <div
              className="cursor-pointer"
              onClick={() => navigate(`/robots/${member.robot.id}`)}
            >
              <div className="text-xs text-secondary mb-1">Slot {member.slotIndex + 1}</div>
              <div className="font-semibold text-primary mb-2 truncate">{member.robot.name}</div>
              <div className="text-sm text-secondary space-y-1">
                <div>ELO: {member.robot.elo}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">HP:</span>
                  <div className="flex-1 bg-surface-elevated rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        member.robot.currentHP >= member.robot.maxHP * 0.75
                          ? 'bg-success'
                          : member.robot.currentHP >= member.robot.maxHP * 0.5
                          ? 'bg-warning'
                          : 'bg-error'
                      }`}
                      style={{ width: `${(member.robot.currentHP / member.robot.maxHP) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Swap button */}
            <button
              onClick={(e) => { e.stopPropagation(); onSwap(member); }}
              disabled={isLocked}
              className="absolute top-2 right-2 text-xs bg-surface-elevated border border-white/20 text-secondary hover:text-white hover:border-primary/50 px-2 py-1 rounded transition-all min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed"
              title={isLocked ? 'Cannot swap while battle is scheduled' : 'Swap member'}
            >
              🔄
            </button>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="text-xs text-secondary mb-1">Combined ELO</div>
          <div className="text-lg font-semibold text-white">{combinedELO}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-secondary mb-1">League Points</div>
          <div className="text-lg font-semibold text-primary">{team.teamLp}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-secondary mb-1">Record</div>
          <div className="text-sm font-semibold text-white">
            {team.totalWins}W-{team.totalLosses}L-{team.totalDraws}D
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-secondary mb-1">Matches</div>
          <div className="text-lg font-semibold text-white">{totalMatches}</div>
        </div>
      </div>

      {/* Mode Eligibility */}
      <div className="pt-3 mt-3 border-t border-white/10">
        <div className="text-xs text-secondary mb-2">Subscribed Modes</div>
        <div className="flex flex-col gap-2">
          <ModeEligibilityBadge
            label={`${team.teamSize}v${team.teamSize} League`}
            eligible={team.members.every(m => m.robot.subscriptions?.some((s: { eventType: string; status: string }) => s.eventType === `league_${team.teamSize}v${team.teamSize}` && (s.status === 'active' || s.status === 'pending')))}
            missingMembers={team.members.filter(m => !m.robot.subscriptions?.some((s: { eventType: string; status: string }) => s.eventType === `league_${team.teamSize}v${team.teamSize}` && (s.status === 'active' || s.status === 'pending'))).map(m => m.robot.name)}
          />
          <ModeEligibilityBadge
            label={`${team.teamSize}v${team.teamSize} Tournament`}
            eligible={team.members.every(m => m.robot.subscriptions?.some((s: { eventType: string; status: string }) => s.eventType === `tournament_${team.teamSize}v${team.teamSize}` && (s.status === 'active' || s.status === 'pending')))}
            missingMembers={team.members.filter(m => !m.robot.subscriptions?.some((s: { eventType: string; status: string }) => s.eventType === `tournament_${team.teamSize}v${team.teamSize}` && (s.status === 'active' || s.status === 'pending'))).map(m => m.robot.name)}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mode Eligibility Badge                                              */
/* ------------------------------------------------------------------ */

function ModeEligibilityBadge({ label, eligible, missingMembers }: { label: string; eligible: boolean; missingMembers?: string[] }) {
  return (
    <div
      className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${
        eligible
          ? 'bg-success/10 text-success border border-success/30'
          : 'bg-error/5 text-secondary border border-white/10'
      }`}
    >
      <span className="shrink-0">{eligible ? '✅' : '❌'}</span>
      <span className="font-medium">{label}</span>
      {eligible && <span className="text-success/70 ml-auto">(all members subscribed)</span>}
      {!eligible && missingMembers && missingMembers.length > 0 && (
        <span className="text-error/80 ml-auto">({missingMembers.join(', ')} not subscribed)</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Register Team Modal                                                 */
/* ------------------------------------------------------------------ */

interface RegisterTeamModalProps {
  teamSize: 2 | 3;
  subscribedRobots: { robotId: number; robotName: string; subscriptions: { eventType: string; status: string }[] }[];
  existingTeams: TeamBattle[];
  onClose: () => void;
  onComplete: () => void;
}

function RegisterTeamModal({ teamSize, subscribedRobots, existingTeams, onClose, onComplete }: RegisterTeamModalProps) {
  const [teamName, setTeamName] = useState('');
  const [selectedRobotIds, setSelectedRobotIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modeLabel = `${teamSize}v${teamSize}`;

  // Filter out robots already on a team of this size
  const robotsOnTeams = new Set(
    existingTeams.flatMap((t) => t.members.map((m) => m.robotId)),
  );
  const availableRobots = subscribedRobots.filter(
    (r) => !robotsOnTeams.has(r.robotId),
  );

  const toggleRobot = (robotId: number) => {
    setSelectedRobotIds((prev) => {
      if (prev.includes(robotId)) {
        return prev.filter((id) => id !== robotId);
      }
      if (prev.length >= teamSize) return prev;
      return [...prev, robotId];
    });
  };

  const isNameValid = teamName.length >= 3 && teamName.length <= 32;
  const canSubmit = isNameValid && selectedRobotIds.length === teamSize && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError(null);
      await registerTeamBattle(selectedRobotIds, teamName, teamSize);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || `Failed to register ${modeLabel} team`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-75" onClick={onClose} />
      <div className="relative bg-surface rounded-lg shadow-2xl max-w-lg w-full mx-4 border border-white/10 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">Register {modeLabel} Team</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Team Name (3–32 characters)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={32}
              placeholder="Enter team name..."
              className="w-full bg-surface-elevated border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary min-h-[44px]"
            />
            {teamName.length > 0 && !isNameValid && (
              <p className="text-error text-xs mt-1">Name must be 3–32 characters</p>
            )}
          </div>

          {/* Robot Picker */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Select {teamSize} Robots ({selectedRobotIds.length}/{teamSize})
            </label>
            {availableRobots.length === 0 ? (
              <p className="text-warning text-sm">
                No available robots subscribed to {modeLabel} League. Subscribe robots via the Booking Office first.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableRobots.map((robot) => {
                  const isSelected = selectedRobotIds.includes(robot.robotId);
                  const isDisabled = !isSelected && selectedRobotIds.length >= teamSize;
                  return (
                    <button
                      key={robot.robotId}
                      type="button"
                      onClick={() => toggleRobot(robot.robotId)}
                      disabled={isDisabled}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all min-h-[44px] ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-white'
                          : isDisabled
                          ? 'border-white/5 bg-surface-elevated text-gray-500 cursor-not-allowed'
                          : 'border-white/10 bg-surface-elevated text-secondary hover:border-primary/50 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{robot.robotName}</span>
                        {isSelected && <span className="text-primary">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error/10 border border-error rounded-lg p-3">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-surface-elevated text-secondary hover:bg-gray-600 transition-colors font-medium min-h-[44px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Registering...' : 'Register Team'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rename Team Modal                                                   */
/* ------------------------------------------------------------------ */

interface RenameTeamModalProps {
  team: TeamBattle;
  onClose: () => void;
  onComplete: () => void;
}

function RenameTeamModal({ team, onClose, onComplete }: RenameTeamModalProps) {
  const [newName, setNewName] = useState(team.teamName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNameValid = newName.length >= 3 && newName.length <= 32;
  const hasChanged = newName !== team.teamName;
  const canSubmit = isNameValid && hasChanged && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError(null);
      await renameTeamBattle(team.id, newName);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || 'Failed to rename team');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-75" onClick={onClose} />
      <div className="relative bg-surface rounded-lg shadow-2xl max-w-md w-full mx-4 border border-white/10 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">Rename Team</h3>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              New Team Name (3–32 characters)
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={32}
              className="w-full bg-surface-elevated border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary min-h-[44px]"
            />
            {newName.length > 0 && !isNameValid && (
              <p className="text-error text-xs mt-1">Name must be 3–32 characters</p>
            )}
          </div>
          {error && (
            <div className="bg-error/10 border border-error rounded-lg p-3">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-surface-elevated text-secondary hover:bg-gray-600 transition-colors font-medium min-h-[44px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Swap Member Modal                                                   */
/* ------------------------------------------------------------------ */

interface SwapMemberModalProps {
  team: TeamBattle;
  memberToSwap: TeamBattleMember;
  subscribedRobots: { robotId: number; robotName: string; subscriptions: { eventType: string; status: string }[] }[];
  existingTeams: TeamBattle[];
  onClose: () => void;
  onComplete: () => void;
}

function SwapMemberModal({ team, memberToSwap, subscribedRobots, existingTeams, onClose, onComplete }: SwapMemberModalProps) {
  const [selectedRobotId, setSelectedRobotId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter: subscribed robots not already on a team of this size
  const robotsOnTeams = new Set(
    existingTeams.flatMap((t) => t.members.map((m) => m.robotId)),
  );
  // Also exclude current team members (except the one being swapped)
  const currentTeamRobotIds = new Set(
    team.members.filter((m) => m.id !== memberToSwap.id).map((m) => m.robotId),
  );

  const availableRobots = subscribedRobots.filter(
    (r) =>
      r.robotId !== memberToSwap.robotId &&
      !currentTeamRobotIds.has(r.robotId) &&
      !robotsOnTeams.has(r.robotId),
  );

  const canSubmit = selectedRobotId !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedRobotId) return;
    try {
      setSubmitting(true);
      setError(null);
      await swapTeamBattleMember(team.id, memberToSwap.robotId, selectedRobotId);
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || 'Failed to swap team member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-75" onClick={onClose} />
      <div className="relative bg-surface rounded-lg shadow-2xl max-w-lg w-full mx-4 border border-white/10 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">Swap Team Member</h3>
          <p className="text-secondary text-sm mt-1">
            Replace <span className="text-primary font-semibold">{memberToSwap.robot.name}</span> with another robot
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {availableRobots.length === 0 ? (
            <p className="text-warning text-sm">
              No other robots available. Subscribe more robots to this league via the Booking Office.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableRobots.map((robot) => {
                const isSelected = selectedRobotId === robot.robotId;
                return (
                  <button
                    key={robot.robotId}
                    type="button"
                    onClick={() => setSelectedRobotId(robot.robotId)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all min-h-[44px] ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-white'
                        : 'border-white/10 bg-surface-elevated text-secondary hover:border-primary/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{robot.robotName}</span>
                      {isSelected && <span className="text-primary">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <div className="bg-error/10 border border-error rounded-lg p-3">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-surface-elevated text-secondary hover:bg-gray-600 transition-colors font-medium min-h-[44px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors font-medium min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Swapping...' : 'Swap Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TeamBattleManagementContent;
