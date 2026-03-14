// React imported for JSX transform (no longer needed in React 18)
import { formatNumber } from '../utils/formatters';

interface PerformanceStatsProps {
  robot: {
    totalBattles: number;
    wins: number;
    losses: number;
    elo: number;
    currentLeague: string;
    leaguePoints: number;
    fame: number;
    damageDealtLifetime: number;
    damageTakenLifetime: number;
    kills: number;
    totalRepairsPaid: number;
    titles: string | null;
  };
}

function PerformanceStats({ robot }: PerformanceStatsProps) {
  // Calculate win rate
  const winRate = robot.totalBattles > 0 
    ? ((robot.wins / robot.totalBattles) * 100).toFixed(1) 
    : '0.0';

  // Calculate Destruction Ratio (Total Losses inflicted / Match Losses taken)
  const destructionRatio = robot.losses > 0 
    ? (robot.kills / robot.losses).toFixed(2) 
    : robot.kills.toFixed(2);

  // Parse titles (comma-separated string)
  const titlesList = robot.titles 
    ? robot.titles.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];

  // formatNumber imported from shared utils

  return (
    <div className="bg-surface p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        🏆 Performance & Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Combat Record */}
        <div className="bg-surface-elevated p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-primary">Combat Record</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary">Total Battles:</span>
              <span className="font-semibold text-white">{robot.totalBattles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Wins:</span>
              <span className="font-semibold text-success">{robot.wins}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Losses:</span>
              <span className="font-semibold text-error">{robot.losses}</span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-secondary">Win Rate:</span>
              <span className="font-semibold text-white">{winRate}%</span>
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div className="bg-surface-elevated p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-purple-400">Rankings</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary">ELO Rating:</span>
              <span className="font-semibold text-white">{robot.elo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">League:</span>
              <span className="font-semibold text-white capitalize">{robot.currentLeague}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">League Points:</span>
              <span className="font-semibold text-white">{robot.leaguePoints}</span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-secondary">Fame:</span>
              <span className="font-semibold text-warning">{robot.fame}</span>
            </div>
          </div>
        </div>

        {/* Damage Statistics */}
        <div className="bg-surface-elevated p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-orange-400">Damage Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary">Damage Dealt:</span>
              <span className="font-semibold text-white">{formatNumber(robot.damageDealtLifetime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Damage Taken:</span>
              <span className="font-semibold text-white">{formatNumber(robot.damageTakenLifetime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Total Losses:</span>
              <span className="font-semibold text-success">{robot.kills}</span>
            </div>
            <div className="text-xs text-secondary italic -mt-1 mb-1">
              (Opponents destroyed)
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-secondary">Destruction Ratio:</span>
              <span className="font-semibold text-white">{destructionRatio}</span>
            </div>
            <div className="text-xs text-secondary italic -mt-1">
              (Total losses ÷ match losses)
            </div>
          </div>
        </div>

        {/* Economic */}
        <div className="bg-surface-elevated p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-success">Economic</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-secondary">Lifetime Repairs:</span>
              <span className="font-semibold text-white">₡{formatNumber(robot.totalRepairsPaid)}</span>
            </div>
          </div>
        </div>

        {/* Titles & Achievements */}
        {titlesList.length > 0 && (
          <div className="bg-surface-elevated p-4 rounded-lg md:col-span-2">
            <h3 className="text-lg font-semibold mb-3 text-warning">Titles & Achievements</h3>
            <div className="flex flex-wrap gap-2">
              {titlesList.map((title, index) => (
                <span
                  key={index}
                  className="bg-yellow-900 text-yellow-200 px-3 py-1 rounded-full text-sm"
                >
                  {title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PerformanceStats;
