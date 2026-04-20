import type { TagTeamInfoProps } from './types';

export function TagTeamInfo({ battleLog }: TagTeamInfoProps) {
  if (battleLog.battleType !== 'tag_team' || !battleLog.tagTeam) return null;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🤝 Tag Team Battle</h3>
      <div className="grid grid-cols-2 gap-4 text-xs">
        {/* Team 1 */}
        <div className="space-y-1">
          <div className="font-semibold text-white text-base">
            {battleLog.tagTeam.team1.stableName || `Team ${battleLog.tagTeam.team1.teamId}`}
          </div>
          {battleLog.tagTeam.team1.activeRobot && (
            <div className="text-secondary">
              <span className="text-primary">Active:</span> {battleLog.tagTeam.team1.activeRobot.name}
            </div>
          )}
          {battleLog.tagTeam.team1.reserveRobot && (
            <div className="text-secondary">
              <span className="text-white">Reserve:</span> {battleLog.tagTeam.team1.reserveRobot.name}
            </div>
          )}
          {battleLog.tagTeam.team1.tagOutTime != null && (
            <div className="text-xs text-primary">
              Tagged out at {battleLog.tagTeam.team1.tagOutTime.toFixed(1)}s
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div className="space-y-1">
          <div className="font-semibold text-white text-base">
            {battleLog.tagTeam.team2.stableName || `Team ${battleLog.tagTeam.team2.teamId}`}
          </div>
          {battleLog.tagTeam.team2.activeRobot && (
            <div className="text-secondary">
              <span className="text-primary">Active:</span> {battleLog.tagTeam.team2.activeRobot.name}
            </div>
          )}
          {battleLog.tagTeam.team2.reserveRobot && (
            <div className="text-secondary">
              <span className="text-white">Reserve:</span> {battleLog.tagTeam.team2.reserveRobot.name}
            </div>
          )}
          {battleLog.tagTeam.team2.tagOutTime != null && (
            <div className="text-xs text-primary">
              Tagged out at {battleLog.tagTeam.team2.tagOutTime.toFixed(1)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
