import React from 'react';

interface SummaryStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgELOChange: number;
  totalCreditsEarned: number;
  currentStreak?: { type: 'win' | 'loss'; count: number };
}

interface BattleHistorySummaryProps {
  stats: SummaryStats;
}

const BattleHistorySummary: React.FC<BattleHistorySummaryProps> = ({ stats }) => {
  return (
    <div className="bg-[#252b38] border border-gray-700 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Battles */}
        <div>
          <div className="text-sm text-[#8b949e]">Total Battles</div>
          <div className="text-2xl font-bold text-[#58a6ff]">{stats.totalBattles}</div>
        </div>
        
        {/* Record */}
        <div>
          <div className="text-sm text-[#8b949e]">Record</div>
          <div className="text-2xl font-bold">
            <span className="text-[#3fb950]">{stats.wins}W</span>
            {' / '}
            <span className="text-[#f85149]">{stats.losses}L</span>
            {stats.draws > 0 && (
              <>
                {' / '}
                <span className="text-[#57606a]">{stats.draws}D</span>
              </>
            )}
          </div>
          <div className="text-xs text-[#57606a]">
            {(stats.winRate * 100).toFixed(1)}% win rate
          </div>
        </div>
        
        {/* Average ELO Change */}
        <div>
          <div className="text-sm text-[#8b949e]">Avg ELO Change</div>
          <div className={`text-2xl font-bold ${stats.avgELOChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {stats.avgELOChange > 0 ? '+' : ''}{stats.avgELOChange.toFixed(1)}
          </div>
        </div>
        
        {/* Credits Earned */}
        <div>
          <div className="text-sm text-[#8b949e]">Credits Earned</div>
          <div className="text-2xl font-bold text-[#e6edf3]">₡{stats.totalCreditsEarned.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Current Streak */}
      {stats.currentStreak && stats.currentStreak.count >= 3 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
            ${stats.currentStreak.type === 'win' ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'}`}>
            <span>{stats.currentStreak.count}-game {stats.currentStreak.type} streak</span>
            {stats.currentStreak.type === 'win' && <span>🔥</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleHistorySummary;
