import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RecordsData {
  combat: {
    fastestVictory: FastestVictory | null;
    longestBattle: LongestBattle | null;
    mostDamageInBattle: MostDamageInBattle | null;
    narrowestVictory: NarrowestVictory | null;
  };
  upsets: {
    biggestUpset: BiggestUpset | null;
    biggestEloGain: BiggestEloGain | null;
    biggestEloLoss: BiggestEloLoss | null;
  };
  career: {
    mostBattles: MostBattles | null;
    highestWinRate: HighestWinRate | null;
    mostLifetimeDamage: MostLifetimeDamage | null;
    highestElo: HighestElo | null;
    mostKills: MostKills | null;
  };
  economic: {
    mostExpensiveBattle: MostExpensiveBattle | null;
    highestFame: HighestFame | null;
    richestStables: RichestStables | null;
  };
  prestige: {
    highestPrestige: HighestPrestige | null;
    mostTitles: MostTitles | null;
  };
  timestamp: string;
}

interface FastestVictory {
  battleId: number;
  durationSeconds: number;
  winner: { id: number; name: string; username: string };
  loser: { id: number; name: string; username: string };
  date: string;
}

interface LongestBattle {
  battleId: number;
  durationSeconds: number;
  winner: { id: number; name: string; username: string };
  loser: { id: number; name: string; username: string };
  date: string;
}

interface MostDamageInBattle {
  battleId: number;
  damageDealt: number;
  robot: { id: number; name: string; username: string };
  opponent: { id: number; name: string; username: string };
  durationSeconds: number;
  date: string;
}

interface NarrowestVictory {
  battleId: number;
  remainingHP: number;
  winner: { id: number; name: string; username: string };
  loser: { id: number; name: string; username: string };
  date: string;
}

interface BiggestUpset {
  battleId: number;
  eloDifference: number;
  underdog: { id: number; name: string; username: string; eloBefore: number };
  favorite: { id: number; name: string; username: string; eloBefore: number };
  date: string;
}

interface BiggestEloGain {
  battleId: number;
  eloChange: number;
  winner: { id: number; name: string; username: string; eloBefore: number; eloAfter: number };
  loser: { id: number; name: string; username: string; eloBefore: number };
  date: string;
}

interface BiggestEloLoss {
  battleId: number;
  eloChange: number;
  loser: { id: number; name: string; username: string; eloBefore: number; eloAfter: number };
  winner: { id: number; name: string; username: string };
  date: string;
}

interface MostBattles {
  robotId: number;
  robotName: string;
  username: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  elo: number;
}

interface HighestWinRate {
  robotId: number;
  robotName: string;
  username: string;
  totalBattles: number;
  wins: number;
  winRate: number;
  elo: number;
  league: string;
}

interface MostLifetimeDamage {
  robotId: number;
  robotName: string;
  username: string;
  damageDealt: number;
  totalBattles: number;
  avgDamagePerBattle: number;
}

interface HighestElo {
  robotId: number;
  robotName: string;
  username: string;
  elo: number;
  league: string;
  wins: number;
  losses: number;
  draws: number;
}

interface MostKills {
  robotId: number;
  robotName: string;
  username: string;
  kills: number;
  totalBattles: number;
  killRate: number;
}

interface MostExpensiveBattle {
  battleId: number;
  totalRepairCost: number;
  robot1: { id: number; name: string; username: string; repairCost: number };
  robot2: { id: number; name: string; username: string; repairCost: number };
  winnerId: number;
  date: string;
}

interface HighestFame {
  robotId: number;
  robotName: string;
  username: string;
  fame: number;
  league: string;
  elo: number;
}

interface RichestStables {
  userId: number;
  username: string;
  currency: number;
  totalBattles: number;
  prestige: number;
  robotCount: number;
}

interface HighestPrestige {
  userId: number;
  username: string;
  prestige: number;
  totalBattles: number;
  totalWins: number;
  championshipTitles: number;
  robotCount: number;
}

interface MostTitles {
  userId: number;
  username: string;
  championshipTitles: number;
  prestige: number;
  totalBattles: number;
  robotCount: number;
}

type CategoryKey = 'combat' | 'upsets' | 'career' | 'economic' | 'prestige';

function HallOfRecordsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('combat');

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get<RecordsData>(`${API_URL}/api/records`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      setRecords(response.data);
    } catch (err) {
      setError('Failed to load Hall of Records');
      console.error('Records error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `₡${amount.toLocaleString()}`;
  };

  const handleBattleClick = (battleId: number) => {
    navigate(`/battle-history?battle=${battleId}`);
  };

  const categories = [
    { key: 'combat' as CategoryKey, label: 'Combat', icon: '⚔️' },
    { key: 'upsets' as CategoryKey, label: 'Upsets', icon: '🎯' },
    { key: 'career' as CategoryKey, label: 'Career', icon: '🏅' },
    { key: 'economic' as CategoryKey, label: 'Economic', icon: '💰' },
    { key: 'prestige' as CategoryKey, label: 'Prestige', icon: '👑' },
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24 md:pb-8">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-yellow-400 mb-2">
            🏆 Hall of Records
          </h1>
          <p className="text-gray-400 text-lg">
            Legendary achievements and exceptional performances from across the arena
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex overflow-x-auto mb-8 space-x-2 pb-2">
          {categories.map((category) => (
            <button
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={`px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeCategory === category.key
                  ? 'bg-yellow-500 text-gray-900'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-gray-400 text-lg">Loading records...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchRecords}
              className="mt-4 px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            >
              Retry
            </button>
          </div>
        )}

        {/* Records Content */}
        {!loading && !error && records && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Combat Records */}
            {activeCategory === 'combat' && (
              <>
                {/* Fastest Victory */}
                {records.combat.fastestVictory && (
                  <RecordCard
                    title="⚡ Fastest Victory"
                    value={formatDuration(records.combat.fastestVictory.durationSeconds)}
                    description={`${records.combat.fastestVictory.winner.name} defeated ${records.combat.fastestVictory.loser.name}`}
                    details={[
                      `Winner: ${records.combat.fastestVictory.winner.username}`,
                      `Date: ${formatDate(records.combat.fastestVictory.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.combat.fastestVictory!.battleId)}
                  />
                )}

                {/* Longest Battle */}
                {records.combat.longestBattle && (
                  <RecordCard
                    title="⏱️ Longest Battle"
                    value={formatDuration(records.combat.longestBattle.durationSeconds)}
                    description={`${records.combat.longestBattle.winner.name} vs ${records.combat.longestBattle.loser.name}`}
                    details={[
                      `Winner: ${records.combat.longestBattle.winner.username}`,
                      `Date: ${formatDate(records.combat.longestBattle.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.combat.longestBattle!.battleId)}
                  />
                )}

                {/* Most Damage */}
                {records.combat.mostDamageInBattle && (
                  <RecordCard
                    title="💥 Most Damage in Single Battle"
                    value={`${records.combat.mostDamageInBattle.damageDealt.toLocaleString()} damage`}
                    description={`${records.combat.mostDamageInBattle.robot.name} vs ${records.combat.mostDamageInBattle.opponent.name}`}
                    details={[
                      `Robot: ${records.combat.mostDamageInBattle.robot.username}`,
                      `Duration: ${formatDuration(records.combat.mostDamageInBattle.durationSeconds)}`,
                      `Date: ${formatDate(records.combat.mostDamageInBattle.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.combat.mostDamageInBattle!.battleId)}
                  />
                )}

                {/* Narrowest Victory */
                {records.combat.narrowestVictory && (
                  <RecordCard
                    title="🎯 Narrowest Victory"
                    value={`${records.combat.narrowestVictory.remainingHP} HP remaining`}
                    description={`${records.combat.narrowestVictory.winner.name} barely survived against ${records.combat.narrowestVictory.loser.name}`}
                    details={[
                      `Winner: ${records.combat.narrowestVictory.winner.username}`,
                      `Date: ${formatDate(records.combat.narrowestVictory.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.combat.narrowestVictory!.battleId)}
                  />
                )}
              </>
            )}

            {/* Upset Records */}
            {activeCategory === 'upsets' && (
              <>
                {/* Biggest Upset */}
                {records.upsets.biggestUpset && (
                  <RecordCard
                    title="🎲 Biggest Upset"
                    value={`${records.upsets.biggestUpset.eloDifference} ELO underdog`}
                    description={`${records.upsets.biggestUpset.underdog.name} (${records.upsets.biggestUpset.underdog.eloBefore} ELO) defeated ${records.upsets.biggestUpset.favorite.name} (${records.upsets.biggestUpset.favorite.eloBefore} ELO)`}
                    details={[
                      `Underdog: ${records.upsets.biggestUpset.underdog.username}`,
                      `Date: ${formatDate(records.upsets.biggestUpset.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.upsets.biggestUpset!.battleId)}
                  />
                )}

                {/* Biggest ELO Gain */}
                {records.upsets.biggestEloGain && (
                  <RecordCard
                    title="📈 Biggest ELO Gain"
                    value={`+${records.upsets.biggestEloGain.eloChange} ELO`}
                    description={`${records.upsets.biggestEloGain.winner.name} (${records.upsets.biggestEloGain.winner.eloBefore} → ${records.upsets.biggestEloGain.winner.eloAfter})`}
                    details={[
                      `Winner: ${records.upsets.biggestEloGain.winner.username}`,
                      `Opponent ELO: ${records.upsets.biggestEloGain.loser.eloBefore}`,
                      `Date: ${formatDate(records.upsets.biggestEloGain.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.upsets.biggestEloGain!.battleId)}
                  />
                )}

                {/* Biggest ELO Loss */}
                {records.upsets.biggestEloLoss && (
                  <RecordCard
                    title="📉 Biggest ELO Loss"
                    value={`${records.upsets.biggestEloLoss.eloChange} ELO`}
                    description={`${records.upsets.biggestEloLoss.loser.name} (${records.upsets.biggestEloLoss.loser.eloBefore} → ${records.upsets.biggestEloLoss.loser.eloAfter})`}
                    details={[
                      `Lost to: ${records.upsets.biggestEloLoss.winner.username}`,
                      `Date: ${formatDate(records.upsets.biggestEloLoss.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.upsets.biggestEloLoss!.battleId)}
                  />
                )}
              </>
            )}

            {/* Career Records */}
            {activeCategory === 'career' && (
              <>
                {/* Most Battles */}
                {records.career.mostBattles && (
                  <RecordCard
                    title="🎖️ Most Battles Fought"
                    value={`${records.career.mostBattles.totalBattles} battles`}
                    description={`${records.career.mostBattles.robotName} by ${records.career.mostBattles.username}`}
                    details={[
                      `Record: ${records.career.mostBattles.wins}-${records.career.mostBattles.losses}-${records.career.mostBattles.draws}`,
                      `Win Rate: ${records.career.mostBattles.winRate}%`,
                      `Current ELO: ${records.career.mostBattles.elo}`,
                    ]}
                  />
                )}

                {/* Highest Win Rate */}
                {records.career.highestWinRate && (
                  <RecordCard
                    title="🏆 Highest Win Rate"
                    value={`${records.career.highestWinRate.winRate}%`}
                    description={`${records.career.highestWinRate.robotName} by ${records.career.highestWinRate.username}`}
                    details={[
                      `Wins: ${records.career.highestWinRate.wins} / ${records.career.highestWinRate.totalBattles}`,
                      `ELO: ${records.career.highestWinRate.elo}`,
                      `League: ${records.career.highestWinRate.league}`,
                    ]}
                  />
                )}

                {/* Most Lifetime Damage */}
                {records.career.mostLifetimeDamage && (
                  <RecordCard
                    title="💪 Most Lifetime Damage"
                    value={`${records.career.mostLifetimeDamage.damageDealt.toLocaleString()} damage`}
                    description={`${records.career.mostLifetimeDamage.robotName} by ${records.career.mostLifetimeDamage.username}`}
                    details={[
                      `Total Battles: ${records.career.mostLifetimeDamage.totalBattles}`,
                      `Avg per Battle: ${records.career.mostLifetimeDamage.avgDamagePerBattle.toLocaleString()}`,
                    ]}
                  />
                )}

                {/* Highest ELO */}
                {records.career.highestElo && (
                  <RecordCard
                    title="👑 Highest Current ELO"
                    value={`${records.career.highestElo.elo} ELO`}
                    description={`${records.career.highestElo.robotName} by ${records.career.highestElo.username}`}
                    details={[
                      `League: ${records.career.highestElo.league}`,
                      `Record: ${records.career.highestElo.wins}-${records.career.highestElo.losses}-${records.career.highestElo.draws}`,
                    ]}
                  />
                )}

                {/* Most Kills */}
                {records.career.mostKills && (
                  <RecordCard
                    title="☠️ Most Robot Destructions"
                    value={`${records.career.mostKills.kills} kills`}
                    description={`${records.career.mostKills.robotName} by ${records.career.mostKills.username}`}
                    details={[
                      `Total Battles: ${records.career.mostKills.totalBattles}`,
                      `Kill Rate: ${records.career.mostKills.killRate}%`,
                    ]}
                  />
                )}
              </>
            )}

            {/* Economic Records */}
            {activeCategory === 'economic' && (
              <>
                {/* Most Expensive Battle */}
                {records.economic.mostExpensiveBattle && (
                  <RecordCard
                    title="💸 Most Expensive Battle"
                    value={formatCurrency(records.economic.mostExpensiveBattle.totalRepairCost)}
                    description={`${records.economic.mostExpensiveBattle.robot1.name} vs ${records.economic.mostExpensiveBattle.robot2.name}`}
                    details={[
                      `${records.economic.mostExpensiveBattle.robot1.username}: ${formatCurrency(records.economic.mostExpensiveBattle.robot1.repairCost || 0)}`,
                      `${records.economic.mostExpensiveBattle.robot2.username}: ${formatCurrency(records.economic.mostExpensiveBattle.robot2.repairCost || 0)}`,
                      `Date: ${formatDate(records.economic.mostExpensiveBattle.date)}`,
                    ]}
                    onClick={() => handleBattleClick(records.economic.mostExpensiveBattle!.battleId)}
                  />
                )}

                {/* Highest Fame */}
                {records.economic.highestFame && (
                  <RecordCard
                    title="⭐ Highest Fame"
                    value={`${records.economic.highestFame.fame.toLocaleString()} fame`}
                    description={`${records.economic.highestFame.robotName} by ${records.economic.highestFame.username}`}
                    details={[
                      `League: ${records.economic.highestFame.league}`,
                      `ELO: ${records.economic.highestFame.elo}`,
                    ]}
                  />
                )}

                {/* Richest Stables */}
                {records.economic.richestStables && (
                  <RecordCard
                    title="💎 Richest Stable"
                    value={formatCurrency(records.economic.richestStables.currency)}
                    description={`${records.economic.richestStables.username}'s stable`}
                    details={[
                      `Robots: ${records.economic.richestStables.robotCount}`,
                      `Prestige: ${records.economic.richestStables.prestige.toLocaleString()}`,
                      `Total Battles: ${records.economic.richestStables.totalBattles}`,
                    ]}
                  />
                )}
              </>
            )}

            {/* Prestige Records */}
            {activeCategory === 'prestige' && (
              <>
                {/* Highest Prestige */}
                {records.prestige.highestPrestige && (
                  <RecordCard
                    title="🌟 Highest Prestige"
                    value={`${records.prestige.highestPrestige.prestige.toLocaleString()} prestige`}
                    description={`${records.prestige.highestPrestige.username}'s stable`}
                    details={[
                      `Robots: ${records.prestige.highestPrestige.robotCount}`,
                      `Total Battles: ${records.prestige.highestPrestige.totalBattles}`,
                      `Total Wins: ${records.prestige.highestPrestige.totalWins}`,
                      `Championships: ${records.prestige.highestPrestige.championshipTitles}`,
                    ]}
                  />
                )}

                {/* Most Titles */}
                {records.prestige.mostTitles && (
                  <RecordCard
                    title="🏅 Most Championship Titles"
                    value={`${records.prestige.mostTitles.championshipTitles} titles`}
                    description={`${records.prestige.mostTitles.username}'s stable`}
                    details={[
                      `Prestige: ${records.prestige.mostTitles.prestige.toLocaleString()}`,
                      `Robots: ${records.prestige.mostTitles.robotCount}`,
                      `Total Battles: ${records.prestige.mostTitles.totalBattles}`,
                    ]}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && records && (
          <div className="mt-8 text-center text-gray-500">
            <p className="text-sm">
              Records are updated in real-time. Keep battling to claim your spot in history!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface RecordCardProps {
  title: string;
  value: string;
  description: string;
  details?: string[];
  onClick?: () => void;
}

function RecordCard({ title, value, description, details, onClick }: RecordCardProps) {
  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-yellow-500/50 transition-all ${
        onClick ? 'cursor-pointer hover:bg-gray-750' : ''
      }`}
      onClick={onClick}
    >
      <h3 className="text-lg font-semibold text-gray-300 mb-3">{title}</h3>
      <div className="text-3xl font-bold text-yellow-400 mb-2">{value}</div>
      <p className="text-gray-400 mb-4">{description}</p>
      {details && details.length > 0 && (
        <div className="space-y-1">
          {details.map((detail, index) => (
            <p key={index} className="text-sm text-gray-500">
              {detail}
            </p>
          ))}
        </div>
      )}
      {onClick && (
        <div className="mt-4 text-sm text-yellow-500 hover:text-yellow-400">
          View Battle Details →
        </div>
      )}
    </div>
  );
}

export default HallOfRecordsPage;
