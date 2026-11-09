import { Link, useNavigate } from 'react-router-dom';
import { getTierName, getTierColor, getTierIcon } from '../../utils/tierHelpers';
import { workshopPath } from '../../utils/robotRoutes';
import type { TeamBattle, TeamBattleMember } from '../../utils/teamBattleApi';

/**
 * Names of the members not subscribed to the given event.
 *
 * A team only fights a mode when every member is entered in it, so both the
 * badge state and the "who is missing" list come from this one answer. The check
 * used to be inlined six times, each copy also accepting a `pending` status that
 * no longer exists — subscriptions have a single state.
 */
function membersMissingEvent(team: TeamBattle, eventType: string): string[] {
  return team.members
    .filter((m) => !m.robot.subscriptions?.some((s) => s.eventType === eventType))
    .map((m) => m.robot.name);
}

interface TeamBattleCardProps {
  team: TeamBattle;
  onDisband: () => void;
  onRename: () => void;
  onSwap: (member: TeamBattleMember) => void;
  onSwapPositions: () => void;
}

function TeamBattleCard({ team, onDisband, onRename, onSwap, onSwapPositions }: TeamBattleCardProps) {
  const navigate = useNavigate();
  const totalMatches = team.totalLeagueWins + team.totalLeagueLosses + team.totalLeagueDraws;
  const combinedELO = team.members.reduce((sum, m) => sum + m.robot.elo, 0);
  const isLocked = team.isLockedForBattle;

  return (
    <div className="bg-surface-elevated border border-white/10 rounded-lg p-6 hover:border-primary/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-white mb-1 truncate">{team.teamName}</h3>
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

      {/* Members */}
      <div className={`grid grid-cols-1 ${team.teamSize === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 mb-4`}>
        {team.members.map((member) => (
          <div
            key={member.id}
            className="bg-surface border border-gray-600 rounded-lg p-4 relative group"
          >
            {/* The card body is a pointer target; the robot name link is the keyboard control. */}
            <div
              role="presentation"
              className="cursor-pointer"
              onClick={() => navigate(workshopPath(member.robot.id))}
            >
              <div className="text-xs text-secondary mb-1">
                {team.teamSize === 2
                  ? `Slot ${member.slotIndex + 1} · ${member.slotIndex === 0 ? 'Active' : 'Reserve'}`
                  : `Slot ${member.slotIndex + 1}`}
              </div>
              {team.teamSize === 2 && (
                <div className="text-[10px] text-secondary/70 mb-0.5">
                  {member.slotIndex === 0 ? 'Active (Tag Team)' : 'Reserve (Tag Team)'}
                </div>
              )}
              <div className="font-semibold text-primary mb-2 truncate">
                <Link to={workshopPath(member.robot.id)} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {member.robot.name}
                </Link>
              </div>
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
              title={isLocked ? 'Cannot swap while battle is scheduled' : 'Replace member'}
            >
              🔄
            </button>
          </div>
        ))}
      </div>

      {/* Swap Positions button (Active ↔ Reserve) — only for 2v2 teams */}
      {team.teamSize === 2 && team.members.length === 2 && (
        <div className="flex justify-center mb-4">
          <button
            onClick={onSwapPositions}
            disabled={isLocked}
            className="text-xs bg-surface border border-white/20 text-secondary hover:text-white hover:border-primary/50 px-3 py-1.5 rounded-lg transition-all min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title={isLocked ? 'Cannot swap while battle is scheduled' : 'Swap Active ↔ Reserve positions'}
          >
            <span>⇅</span> Swap Active / Reserve
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="pt-4 border-t border-white/10">
        {/* Combined ELO — shared across all modes */}
        {team.teamSize === 2 && (
          <div className="mb-4">
            <div className="text-center">
              <div className="text-xs text-secondary mb-1">Combined ELO</div>
              <div className="text-lg font-semibold text-white">{combinedELO}</div>
            </div>
          </div>
        )}

        {/* Desktop: side-by-side layout for 2v2 teams; Mobile: stacked */}
        <div className={team.teamSize === 2 ? 'flex flex-col lg:flex-row lg:gap-6' : ''}>
          {/* 2v2/3v3 League Stats */}
          <div className={team.teamSize === 2 ? 'flex-1' : ''}>
            {team.teamSize === 2 ? (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-secondary font-semibold uppercase tracking-wide">{team.teamSize}v{team.teamSize} League</span>
                <span className="text-sm">{getTierIcon(team.teamLeague)}</span>
                <span className={`text-xs font-semibold ${getTierColor(team.teamLeague)}`}>
                  {getTierName(team.teamLeague)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-secondary font-semibold uppercase tracking-wide">{team.teamSize}v{team.teamSize} League</span>
                <span className="text-sm">{getTierIcon(team.teamLeague)}</span>
                <span className={`text-xs font-semibold ${getTierColor(team.teamLeague)}`}>
                  {getTierName(team.teamLeague)}
                </span>
              </div>
            )}
            <div className={`grid ${team.teamSize === 2 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'} gap-4`}>
              {team.teamSize !== 2 && (
                <div className="text-center">
                  <div className="text-xs text-secondary mb-1">Combined ELO</div>
                  <div className="text-lg font-semibold text-white">{combinedELO}</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xs text-secondary mb-1">League Points</div>
                <div className="text-lg font-semibold text-primary">{team.teamLp ?? '—'}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-secondary mb-1">Record</div>
                <div className="text-sm font-semibold text-white">
                  {team.totalLeagueWins}W-{team.totalLeagueLosses}L-{team.totalLeagueDraws}D
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-secondary mb-1">Matches</div>
                <div className="text-lg font-semibold text-white">{totalMatches}</div>
              </div>
            </div>
          </div>

          {/* Tag Team Stats (only for 2v2 teams) */}
          {team.teamSize === 2 && (
            <div className="flex-1 mt-4 pt-4 border-t border-white/5 lg:mt-0 lg:pt-0 lg:border-t-0 lg:border-l lg:border-white/10 lg:pl-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-secondary font-semibold uppercase tracking-wide">Tag Team League</span>
                <span className="text-sm">{getTierIcon(team.tagTeamLeague)}</span>
                <span className={`text-xs font-semibold ${getTierColor(team.tagTeamLeague)}`}>
                  {getTierName(team.tagTeamLeague)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs text-secondary mb-1">Tag Team LP</div>
                  <div className="text-lg font-semibold text-primary">{team.tagTeamLp ?? '—'}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-secondary mb-1">Record</div>
                  <div className="text-sm font-semibold text-white">
                    {team.totalTagTeamWins}W-{team.totalTagTeamLosses}L-{team.totalTagTeamDraws}D
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-secondary mb-1">Matches</div>
                  <div className="text-lg font-semibold text-white">
                    {team.totalTagTeamWins + team.totalTagTeamLosses + team.totalTagTeamDraws}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode Eligibility */}
      <div className="pt-3 mt-3 border-t border-white/10">
        <div className="text-xs text-secondary mb-2">Subscribed Modes</div>
        <div className="flex flex-col gap-2">
          <ModeEligibilityBadge
            label={`${team.teamSize}v${team.teamSize} League`}
            eligible={membersMissingEvent(team, `league_${team.teamSize}v${team.teamSize}`).length === 0}
            missingMembers={membersMissingEvent(team, `league_${team.teamSize}v${team.teamSize}`)}
          />
          {team.teamSize === 2 && (
            <ModeEligibilityBadge
              label="Tag Team"
              eligible={membersMissingEvent(team, 'tag_team').length === 0}
              missingMembers={membersMissingEvent(team, 'tag_team')}
            />
          )}
          <ModeEligibilityBadge
            label={`${team.teamSize}v${team.teamSize} Tournament`}
            eligible={membersMissingEvent(team, `tournament_${team.teamSize}v${team.teamSize}`).length === 0}
            missingMembers={membersMissingEvent(team, `tournament_${team.teamSize}v${team.teamSize}`)}
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


export default TeamBattleCard;
