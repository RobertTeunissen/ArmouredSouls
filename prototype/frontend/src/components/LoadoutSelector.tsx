import { useState } from 'react';
import axios from 'axios';
import { LOADOUT_BONUSES, formatLoadoutName, getLoadoutDescription } from '../utils/robotStats';

interface LoadoutSelectorProps {
  robotId: number;
  currentLoadout: string;
  onLoadoutChange: (newLoadout: string) => void;
}

const LOADOUT_TYPES = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];

// Loadout type icons (64×64px equivalent in emoji/text)
const LOADOUT_ICONS: Record<string, string> = {
  single: '⚔️',
  weapon_shield: '🛡️',
  two_handed: '🗡️',
  dual_wield: '⚔️⚔️',
};

function LoadoutSelector({ robotId, currentLoadout, onLoadoutChange }: LoadoutSelectorProps) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async (newLoadout: string) => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.put(`http://localhost:3001/api/robots/${robotId}/loadout-type`, {
        loadoutType: newLoadout,
      });

      if (response.data.robot) {
        onLoadoutChange(newLoadout);
      }
    } catch (err: any) {
      console.error('Failed to change loadout:', err);
      setError(err.response?.data?.error || 'Failed to change loadout type');
    } finally {
      setLoading(false);
    }
  };

  const formatBonus = (value: number): { text: string; isPositive: boolean } => {
    const percent = Math.round(value * 100);
    return {
      text: `${percent > 0 ? '+' : ''}${percent}%`,
      isPositive: value > 0,
    };
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-300 uppercase tracking-wide">
        Weapon Loadout
        <span className="text-sm text-gray-400 font-normal normal-case">
          (Loadout bonuses applied in combat)
        </span>
      </h3>
      
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LOADOUT_TYPES.map((loadoutType) => {
          const bonuses = LOADOUT_BONUSES[loadoutType];
          const isSelected = currentLoadout === loadoutType;
          const icon = LOADOUT_ICONS[loadoutType] || '⚔️';

          return (
            <div
              key={loadoutType}
              className={`border rounded-lg p-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-blue-500 bg-blue-900 bg-opacity-30 ring-2 ring-blue-500 shadow-lg'
                  : 'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-750 hover:border-gray-500 hover:bg-gray-650 hover:shadow-md'
              } ${loading ? 'opacity-50 cursor-wait' : ''}`}
              onClick={() => !loading && handleChange(loadoutType)}
            >
              {/* Loadout Icon */}
              <div className="text-center mb-2">
                <span className="text-4xl">{icon}</span>
              </div>
              
              <div className="mb-2">
                <h4 className="font-bold text-base text-center">
                  {formatLoadoutName(loadoutType)}
                </h4>
                {isSelected && (
                  <span className="text-xs text-blue-400 block text-center">✓ Active</span>
                )}
              </div>

              <p className="text-xs text-gray-400 mb-2 text-center">
                {getLoadoutDescription(loadoutType)}
              </p>

              {bonuses && Object.keys(bonuses).length > 0 && (
                <div className="space-y-1 border-t border-gray-600 pt-2 mt-2">
                  {Object.entries(bonuses).map(([attr, value]) => {
                    const bonus = formatBonus(value);
                    return (
                      <div key={attr} className="flex justify-between text-xs">
                        <span className="text-gray-400 capitalize">
                          {attr.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className={bonus.isPositive ? 'text-green-400' : 'text-red-400'}>
                          {bonus.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LoadoutSelector;
