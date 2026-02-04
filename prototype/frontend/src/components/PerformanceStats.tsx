import React from 'react';

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

  // Format large numbers
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        🏆 Performance & Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Combat Record */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-400">Combat Record</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Total Battles:</span>
              <span className="font-semibold text-white">{robot.totalBattles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Wins:</span>
              <span className="font-semibold text-green-400">{robot.wins}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Losses:</span>
              <span className="font-semibold text-red-400">{robot.losses}</span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-gray-300">Win Rate:</span>
              <span className="font-semibold text-white">{winRate}%</span>
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-purple-400">Rankings</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">ELO Rating:</span>
              <span className="font-semibold text-white">{robot.elo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">League:</span>
              <span className="font-semibold text-white capitalize">{robot.currentLeague}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">League Points:</span>
              <span className="font-semibold text-white">{robot.leaguePoints}</span>
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-gray-300">Fame:</span>
              <span className="font-semibold text-yellow-400">{robot.fame}</span>
            </div>
          </div>
        </div>

        {/* Damage Statistics */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-orange-400">Damage Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Damage Dealt:</span>
              <span className="font-semibold text-white">{formatNumber(robot.damageDealtLifetime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Damage Taken:</span>
              <span className="font-semibold text-white">{formatNumber(robot.damageTakenLifetime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Total Losses:</span>
              <span className="font-semibold text-green-400">{robot.kills}</span>
            </div>
            <div className="text-xs text-gray-400 italic -mt-1 mb-1">
              (Opponents destroyed)
            </div>
            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span className="text-gray-300">Destruction Ratio:</span>
              <span className="font-semibold text-white">{destructionRatio}</span>
            </div>
            <div className="text-xs text-gray-400 italic -mt-1">
              (Total losses ÷ match losses)
            </div>
          </div>
        </div>

        {/* Economic */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-green-400">Economic</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-300">Lifetime Repairs:</span>
              <span className="font-semibold text-white">₡{formatNumber(robot.totalRepairsPaid)}</span>
            </div>
          </div>
        </div>

        {/* Titles & Achievements */}
        {titlesList.length > 0 && (
          <div className="bg-gray-700 p-4 rounded-lg md:col-span-2">
            <h3 className="text-lg font-semibold mb-3 text-yellow-400">Titles & Achievements</h3>
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
