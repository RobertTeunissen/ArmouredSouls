import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { useNavigate } from 'react-router-dom';
import {
  CombatRecords,
  UpsetRecords,
  CareerRecords,
  EconomicRecords,
  PrestigeRecords,
  KothRecords,
} from '../components/hall-of-records';
import type { RecordsData, CategoryKey } from '../components/hall-of-records';

const API_URL = import.meta.env.VITE_API_URL || '';

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
    { key: 'koth' as CategoryKey, label: 'King of the Hill', icon: '⛰️' },
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white pb-24 md:pb-8">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-warning mb-2">
            🏆 Hall of Records
          </h1>
          <p className="text-secondary text-lg">
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
                  ? category.key === 'koth'
                    ? 'bg-orange-500 text-gray-900'
                    : 'bg-yellow-500 text-gray-900'
                  : 'bg-surface text-secondary hover:bg-surface-elevated'
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
            <div className="text-secondary text-lg">Loading records...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-error">{error}</p>
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
            {activeCategory === 'combat' && (
              <CombatRecords records={records} formatDuration={formatDuration} formatDate={formatDate} onBattleClick={handleBattleClick} />
            )}
            {activeCategory === 'upsets' && (
              <UpsetRecords records={records} formatDate={formatDate} onBattleClick={handleBattleClick} />
            )}
            {activeCategory === 'career' && (
              <CareerRecords records={records} />
            )}
            {activeCategory === 'economic' && (
              <EconomicRecords records={records} />
            )}
            {activeCategory === 'prestige' && (
              <PrestigeRecords records={records} />
            )}
            {activeCategory === 'koth' && (
              <KothRecords records={records} formatDuration={formatDuration} />
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && records && (
          <div className="mt-8 text-center text-tertiary">
            <p className="text-sm">
              Records are updated in real-time. Keep battling to claim your spot in history!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HallOfRecordsPage;
