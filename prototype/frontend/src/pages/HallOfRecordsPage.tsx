import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RecordsData {
  combat: {
    fastestVictory: FastestVictory[];
    longestBattle: LongestBattle[];
    mostDamageInBattle: MostDamageInBattle[];
    narrowestVictory: NarrowestVictory[];
  };
  upsets: {
    biggestUpset: BiggestUpset[];
    biggestEloGain: BiggestEloGain[];
    biggestEloLoss: BiggestEloLoss[];
  };
  career: {
    mostBattles: MostBattles[];
    highestWinRate: HighestWinRate[];
    mostLifetimeDamage: MostLifetimeDamage[];
    highestElo: HighestElo[];
    mostKills: MostKills[];
  };
  economic: {
    mostExpensiveBattle: MostExpensiveBattle[];
    highestFame: HighestFame[];
    richestStables: RichestStables[];
  };
  prestige: {
    highestPrestige: HighestPrestige[];
    mostTitles: MostTitles[];
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

  const handleBattleClick = (battleId: number) => {
    navigate(`/battle/${battleId}`);
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
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
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
          <div className="space-y-8">
            {/* Combat Records */}
            {activeCategory === 'combat' && (
              <>
                {/* Fastest Victory */}
                {records.combat.fastestVictory.length > 0 && (
                  <RecordSection title="⚡ Fastest Victory">
                    {records.combat.fastestVictory.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={formatDuration(record.durationSeconds)}
                        description={`${record.winner.name} defeated ${record.loser.name}`}
                        details={[
                          `Winner: ${record.winner.username}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Longest Battle */}
                {records.combat.longestBattle.length > 0 && (
                  <RecordSection title="⏱️ Longest Battle">
                    {records.combat.longestBattle.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={formatDuration(record.durationSeconds)}
                        description={`${record.winner.name} vs ${record.loser.name}`}
                        details={[
                          `Winner: ${record.winner.username}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Most Damage */}
                {records.combat.mostDamageInBattle.length > 0 && (
                  <RecordSection title="💥 Most Damage in Single Battle">
                    {records.combat.mostDamageInBattle.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={`${record.damageDealt.toLocaleString()} damage`}
                        description={`${record.robot.name} vs ${record.opponent.name}`}
                        details={[
                          `Robot: ${record.robot.username}`,
                          `Duration: ${formatDuration(record.durationSeconds)}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Narrowest Victory */}
                {records.combat.narrowestVictory.length > 0 && (
                  <RecordSection title="🎯 Narrowest Victory">
                    {records.combat.narrowestVictory.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={`${record.remainingHP} HP remaining`}
                        description={`${record.winner.name} barely survived against ${record.loser.name}`}
                        details={[
                          `Winner: ${record.winner.username}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}
              </>
            )}

            {/* Upset Records */}
            {activeCategory === 'upsets' && (
              <>
                {/* Biggest Upset */}
                {records.upsets.biggestUpset.length > 0 && (
                  <RecordSection title="🎲 Biggest Upset">
                    {records.upsets.biggestUpset.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={`${record.eloDifference} ELO underdog`}
                        description={`${record.underdog.name} (${record.underdog.eloBefore} ELO) defeated ${record.favorite.name} (${record.favorite.eloBefore} ELO)`}
                        details={[
                          `Underdog: ${record.underdog.username}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Biggest ELO Gain */}
                {records.upsets.biggestEloGain.length > 0 && (
                  <RecordSection title="📈 Biggest ELO Gain">
                    {records.upsets.biggestEloGain.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={`+${record.eloChange} ELO`}
                        description={`${record.winner.name} (${record.winner.eloBefore} → ${record.winner.eloAfter})`}
                        details={[
                          `Winner: ${record.winner.username}`,
                          `Opponent ELO: ${record.loser.eloBefore}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Biggest ELO Loss */}
                {records.upsets.biggestEloLoss.length > 0 && (
                  <RecordSection title="📉 Biggest ELO Loss">
                    {records.upsets.biggestEloLoss.map((record, index) => (
                      <RecordCard
                        key={record.battleId}
                        rank={index + 1}
                        value={`-${record.eloChange} ELO`}
                        description={`${record.loser.name} (${record.loser.eloBefore} → ${record.loser.eloAfter})`}
                        details={[
                          `Lost to: ${record.winner.username}`,
                          `Date: ${formatDate(record.date)}`,
                        ]}
                        onClick={() => handleBattleClick(record.battleId)}
                      />
                    ))}
                  </RecordSection>
                )}
              </>
            )}

            {/* Career Records */}
            {activeCategory === 'career' && (
              <>
                {/* Most Battles */}
                {records.career.mostBattles.length > 0 && (
                  <RecordSection title="🎖️ Most Battles Fought">
                    {records.career.mostBattles.map((record, index) => (
                      <RecordCard
                        key={record.robotId}
                        rank={index + 1}
                        value={`${record.totalBattles} battles`}
                        description={`${record.robotName} by ${record.username}`}
                        details={[
                          `Record: ${record.wins}-${record.losses}-${record.draws}`,
                          `Win Rate: ${record.winRate}%`,
                          `Current ELO: ${record.elo}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Highest Win Rate */}
                {records.career.highestWinRate.length > 0 && (
                  <RecordSection title="🏆 Highest Win Rate">
                    {records.career.highestWinRate.map((record, index) => (
                      <RecordCard
                        key={record.robotId}
                        rank={index + 1}
                        value={`${record.winRate}%`}
                        description={`${record.robotName} by ${record.username}`}
                        details={[
                          `Wins: ${record.wins} / ${record.totalBattles}`,
                          `ELO: ${record.elo}`,
                          `League: ${record.league}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Most Lifetime Damage */}
                {records.career.mostLifetimeDamage.length > 0 && (
                  <RecordSection title="💪 Most Lifetime Damage">
                    {records.career.mostLifetimeDamage.map((record, index) => (
                      <RecordCard
                        key={record.robotId}
                        rank={index + 1}
                        value={`${record.damageDealt.toLocaleString()} damage`}
                        description={`${record.robotName} by ${record.username}`}
                        details={[
                          `Total Battles: ${record.totalBattles}`,
                          `Avg per Battle: ${record.avgDamagePerBattle.toLocaleString()}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Highest ELO */}
                {records.career.highestElo.length > 0 && (
                  <RecordSection title="👑 Highest Current ELO">
                    {records.career.highestElo.map((record, index) => (
                      <RecordCard
                        key={record.robotId}
                        rank={index + 1}
                        value={`${record.elo} ELO`}
                        description={`${record.robotName} by ${record.username}`}
                        details={[
                          `League: ${record.league}`,
                          `Record: ${record.wins}-${record.losses}-${record.draws}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Most Kills */}
                {records.career.mostKills.length > 0 && (
                  <RecordSection title="☠️ Most Robot Destructions">
                    {records.career.mostKills.map((record, index) => (
                      <RecordCard
                        key={record.robotId}
                        rank={index + 1}
                        value={`${record.kills} kills`}
                        description={`${record.robotName} by ${record.username}`}
                        details={[
                          `Total Battles: ${record.totalBattles}`,
                          `Kill Rate: ${record.killRate}%`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}
              </>
            )}

            {/* Economic Records */}
            {activeCategory === 'economic' && (
              <>
                {/* Highest Fame */}
                {records.economic.highestFame.length > 0 && (
                  <RecordSection title="⭐ Highest Fame">
                    {records.economic.highestFame.map((record, index) => (
                      <RecordCard
                        key={record.robotId}
                        rank={index + 1}
                        value={`${record.fame.toLocaleString()} fame`}
                        description={`${record.robotName} by ${record.username}`}
                        details={[
                          `League: ${record.league}`,
                          `ELO: ${record.elo}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Richest Stables */}
                {records.economic.richestStables.length > 0 && (
                  <RecordSection title="💎 Richest Stable">
                    {records.economic.richestStables.map((record, index) => (
                      <RecordCard
                        key={record.userId}
                        rank={index + 1}
                        value={formatCurrency(record.currency)}
                        description={`${record.username}'s stable`}
                        details={[
                          `Robots: ${record.robotCount}`,
                          `Prestige: ${record.prestige.toLocaleString()}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}
              </>
            )}

            {/* Prestige Records */}
            {activeCategory === 'prestige' && (
              <>
                {/* Highest Prestige */}
                {records.prestige.highestPrestige.length > 0 && (
                  <RecordSection title="🌟 Highest Prestige">
                    {records.prestige.highestPrestige.map((record, index) => (
                      <RecordCard
                        key={record.userId}
                        rank={index + 1}
                        value={`${record.prestige.toLocaleString()} prestige`}
                        description={`${record.username}'s stable`}
                        details={[
                          `Robots: ${record.robotCount}`,
                          `Championships: ${record.championshipTitles}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
                )}

                {/* Most Titles */}
                {records.prestige.mostTitles.length > 0 && (
                  <RecordSection title="🏅 Most Championship Titles">
                    {records.prestige.mostTitles.map((record, index) => (
                      <RecordCard
                        key={record.userId}
                        rank={index + 1}
                        value={`${record.championshipTitles} titles`}
                        description={`${record.username}'s stable`}
                        details={[
                          `Prestige: ${record.prestige.toLocaleString()}`,
                          `Robots: ${record.robotCount}`,
                        ]}
                      />
                    ))}
                  </RecordSection>
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

interface RecordSectionProps {
  title: string;
  children: React.ReactNode;
}

function RecordSection({ title, children }: RecordSectionProps) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold text-gray-200 mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

interface RecordCardProps {
  rank: number;
  value: string;
  description: string;
  details?: string[];
  onClick?: () => void;
}

function RecordCard({ rank, value, description, details, onClick }: RecordCardProps) {
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-gray-500';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  // Different sizes for top 3 vs rest
  const isTop3 = rank <= 3;
  const isFirst = rank === 1;
  
  const cardClasses = isFirst
    ? 'md:col-span-2 lg:col-span-3 p-6' // First place spans full width
    : isTop3
    ? 'md:col-span-1 lg:col-span-1 p-5' // 2nd and 3rd normal size
    : 'md:col-span-1 lg:col-span-1 p-4'; // Rest smaller

  const valueSize = isFirst ? 'text-4xl' : isTop3 ? 'text-2xl' : 'text-xl';
  const rankSize = isFirst ? 'text-4xl' : isTop3 ? 'text-3xl' : 'text-2xl';
  const descSize = isFirst ? 'text-lg' : isTop3 ? 'text-base' : 'text-sm';

  return (
    <div
      className={`bg-gray-800 border ${
        isFirst ? 'border-yellow-500/70' : 'border-gray-700'
      } rounded-lg hover:border-yellow-500/50 transition-all flex items-start gap-4 ${cardClasses} ${
        onClick ? 'cursor-pointer hover:bg-gray-750' : ''
      }`}
      onClick={onClick}
    >
      {/* Rank Badge */}
      <div className={`${rankSize} font-bold ${getRankColor(rank)} ${isFirst ? 'min-w-[4rem]' : 'min-w-[3rem]'} text-center flex-shrink-0`}>
        {getRankBadge(rank)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`${valueSize} font-bold text-yellow-400 mb-1`}>{value}</div>
        <p className={`text-gray-300 mb-2 ${descSize}`}>{description}</p>
        {details && details.length > 0 && (
          <div className={`space-y-1 ${isFirst ? '' : 'text-sm'}`}>
            {details.map((detail, index) => (
              <p key={index} className="text-gray-500">
                {detail}
              </p>
            ))}
          </div>
        )}
        {onClick && (
          <div className={`mt-2 text-yellow-500 hover:text-yellow-400 ${isFirst ? 'text-base' : 'text-sm'}`}>
            View Battle Details →
          </div>
        )}
      </div>
    </div>
  );
}

export default HallOfRecordsPage;
