import { useState } from 'react';
import axios from 'axios';

interface StanceSelectorProps {
  robotId: number;
  currentStance: string;
  onStanceChange: (newStance: string) => void;
}

const STANCES = [
  {
    id: 'offensive',
    name: 'Offensive',
    emoji: '⚔️',
    icon: '⚡', // Additional icon for 64×64px equivalent
    description: 'Prioritize attacks and aggressive positioning',
    bonuses: [
      { attr: 'Combat Power', value: '+15%', positive: true },
      { attr: 'Attack Speed', value: '+10%', positive: true },
      { attr: 'Counter Protocols', value: '-10%', positive: false },
      { attr: 'Evasion Thrusters', value: '-10%', positive: false },
    ],
  },
  {
    id: 'defensive',
    name: 'Defensive',
    emoji: '🛡️',
    icon: '🛡️', // Shield icon for 64×64px equivalent
    description: 'Prioritize survival and cautious positioning',
    bonuses: [
      { attr: 'Armor Plating', value: '+15%', positive: true },
      { attr: 'Counter Protocols', value: '+15%', positive: true },
      { attr: 'Shield Regen', value: '+20%', positive: true },
      { attr: 'Combat Power', value: '-10%', positive: false },
      { attr: 'Attack Speed', value: '-10%', positive: false },
    ],
  },
  {
    id: 'balanced',
    name: 'Balanced',
    emoji: '⚖️',
    icon: '⚖️', // Balance scales icon for 64×64px equivalent
    description: 'Adaptive tactics based on situation',
    bonuses: [
      { attr: 'No stat modifiers', value: '', positive: true },
      { attr: 'AI-driven decisions', value: '', positive: true },
    ],
  },
];

function StanceSelector({ robotId, currentStance, onStanceChange }: StanceSelectorProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStanceChange = async (newStance: string) => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.patch(
        `http://localhost:3001/api/robots/${robotId}/stance`,
        { stance: newStance },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.data) {
        onStanceChange(newStance);
      }
    } catch (err: any) {
      console.error('Failed to change stance:', err);
      setError(err.response?.data?.error || 'Failed to change stance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-300 uppercase tracking-wide">
        Battle Stance
        <span className="text-sm text-gray-400 font-normal normal-case">
          (Applied before battle)
        </span>
      </h3>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STANCES.map((stance) => {
          const isSelected = currentStance === stance.id;

          return (
            <div
              key={stance.id}
              className={`border rounded-lg p-4 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-blue-500 bg-blue-900 bg-opacity-30 ring-2 ring-blue-500 shadow-lg'
                  : 'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-750 hover:border-gray-500 hover:bg-gray-650 hover:shadow-md'
              } ${loading ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => !loading && handleStanceChange(stance.id)}
            >
              {/* Stance Header with Icon */}
              <div className="flex flex-col items-center gap-2 mb-3">
                <span className="text-5xl">{stance.icon}</span>
                <div className="text-center">
                  <h4 className="font-bold text-lg">{stance.name}</h4>
                  {isSelected && (
                    <span className="text-xs text-blue-400">✓ Active</span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-300 mb-3 text-center">{stance.description}</p>

              {/* Bonuses */}
              <div className="space-y-1 border-t border-gray-600 pt-3">
                {stance.bonuses.map((bonus, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {bonus.value && (
                      <span
                        className={`font-mono font-semibold ${
                          bonus.positive ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {bonus.value}
                      </span>
                    )}
                    <span className="text-gray-300">{bonus.attr}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="mt-3 text-center text-sm text-gray-400">
          Updating stance...
        </div>
      )}
    </div>
  );
}

export default StanceSelector;
