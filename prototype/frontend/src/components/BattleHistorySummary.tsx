import React, { useState } from 'react';

interface SummaryStats {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgELOChange: number;
  totalCreditsEarned: number;
  currentStreak?: { type: 'win' | 'loss'; count: number };
  // Battle type breakdown
  leagueStats?: {
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgELOChange: number;
  };
  tournamentStats?: {
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgELOChange: number;
  };
}

interface BattleHistorySummaryProps {
  stats: SummaryStats;
}

const BattleHistorySummary: React.FC<BattleHistorySummaryProps> = ({ stats }) => {
  const [view, setView] = useState<'overall' | 'league' | 'tournament'>('overall');
  
  const getDisplayStats = () => {
    if (view === 'league' && stats.leagueStats) {
      return {
        battles: stats.leagueStats.battles,
        wins: stats.leagueStats.wins,
        losses: stats.leagueStats.losses,
        draws: stats.leagueStats.draws,
        winRate: stats.leagueStats.winRate,
        avgELOChange: stats.leagueStats.avgELOChange,
      };
    }
    if (view === 'tournament' && stats.tournamentStats) {
      return {
        battles: stats.tournamentStats.battles,
        wins: stats.tournamentStats.wins,
        losses: stats.tournamentStats.losses,
        draws: stats.tournamentStats.draws,
        winRate: stats.tournamentStats.winRate,
        avgELOChange: stats.tournamentStats.avgELOChange,
      };
    }
    // Overall
    return {
      battles: stats.totalBattles,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      winRate: stats.winRate,
      avgELOChange: stats.avgELOChange,
    };
  };
  
  const displayStats = getDisplayStats();
  const hasBreakdown = stats.leagueStats && stats.tournamentStats;
  
  return (
    <div className="bg-[#252b38] border border-gray-700 rounded-lg p-4 mb-4">
      {/* View Toggle */}
      {hasBreakdown && (
        <div className="flex gap-2 mb-4 pb-3 border-b border-gray-700">
          <button
            onClick={() => setView('overall')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              view === 'overall' 
                ? 'bg-[#58a6ff] text-white' 
                : 'bg-[#1a1f29] text-[#8b949e] hover:bg-[#252b38]'
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setView('league')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              view === 'league' 
                ? 'bg-[#58a6ff] text-white' 
                : 'bg-[#1a1f29] text-[#8b949e] hover:bg-[#252b38]'
            }`}
          >
            ⚔️ League
          </button>
          <button
            onClick={() => setView('tournament')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              view === 'tournament' 
                ? 'bg-[#58a6ff] text-white' 
                : 'bg-[#1a1f29] text-[#8b949e] hover:bg-[#252b38]'
            }`}
          >
            🏆 Tournament
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Battles */}
        <div>
          <div className="text-sm text-[#8b949e]">
            {view === 'overall' ? 'Total Battles' : view === 'league' ? 'League Battles' : 'Tournament Battles'}
          </div>
          <div className="text-2xl font-bold text-[#58a6ff]">{displayStats.battles}</div>
        </div>
        
        {/* Record */}
        <div>
          <div className="text-sm text-[#8b949e]">Record</div>
          <div className="text-2xl font-bold">
            <span className="text-[#3fb950]">{displayStats.wins}W</span>
            {' / '}
            <span className="text-[#f85149]">{displayStats.losses}L</span>
            {displayStats.draws > 0 && (
              <>
                {' / '}
                <span className="text-[#57606a]">{displayStats.draws}D</span>
              </>
            )}
          </div>
          <div className="text-xs text-[#57606a]">
            {(displayStats.winRate * 100).toFixed(1)}% win rate
          </div>
        </div>
        
        {/* Average ELO Change */}
        <div>
          <div className="text-sm text-[#8b949e]">Avg ELO Change</div>
          <div className={`text-2xl font-bold ${displayStats.avgELOChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
            {displayStats.avgELOChange > 0 ? '+' : ''}{displayStats.avgELOChange.toFixed(1)}
          </div>
        </div>
        
        {/* Credits Earned */}
        {view === 'overall' && (
          <div>
            <div className="text-sm text-[#8b949e]">Credits Earned</div>
            <div className="text-2xl font-bold text-[#e6edf3]">₡{stats.totalCreditsEarned.toLocaleString()}</div>
          </div>
        )}
        
        {/* Battle Type Count for filtered views */}
        {view !== 'overall' && hasBreakdown && (
          <div>
            <div className="text-sm text-[#8b949e]">
              {view === 'league' ? 'Tournament Battles' : 'League Battles'}
            </div>
            <div className="text-xl font-medium text-[#8b949e]">
              {view === 'league' ? stats.tournamentStats!.battles : stats.leagueStats!.battles}
            </div>
          </div>
        )}
      </div>
      
      {/* Current Streak */}
      {view === 'overall' && stats.currentStreak && stats.currentStreak.count >= 3 && (
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
