import { useState } from 'react';
import { getWeaponImagePath } from '../utils/weaponImages';

interface WeaponInventory {
  id: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    description: string | null;
    baseDamage: number;
  };
}

interface WeaponSlotProps {
  label: string;
  weapon: WeaponInventory | null;
  onEquip: () => void;
  onUnequip: () => void;
  disabled?: boolean;
}

function WeaponSlot({ label, weapon, onEquip, onUnequip, disabled }: WeaponSlotProps) {
  const [imageError, setImageError] = useState(false);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'energy':
        return 'text-blue-400';
      case 'ballistic':
        return 'text-orange-400';
      case 'melee':
        return 'text-red-400';
      case 'explosive':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getWeaponIcon = (type: string): string => {
    switch (type) {
      case 'energy':
        return '⚡';
      case 'ballistic':
        return '🔫';
      case 'melee':
        return '⚔️';
      case 'explosive':
        return '💣';
      default:
        return '⚙️';
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-700 to-gray-750 p-4 rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-150">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-gray-300 uppercase tracking-wide text-sm">{label}</h4>
        {weapon ? (
          <button
            onClick={onUnequip}
            disabled={disabled}
            className="text-sm text-red-400 hover:text-red-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            Unequip
          </button>
        ) : (
          <button
            onClick={onEquip}
            disabled={disabled}
            className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            Equip Weapon
          </button>
        )}
      </div>

      {weapon ? (
        <div>
          {/* Weapon Thumbnail (128×128px equivalent) */}
          <div className="flex items-center gap-4 mb-3">
            <div className="w-24 h-24 bg-gray-800 rounded-lg border-2 border-gray-600 flex items-center justify-center overflow-hidden">
              {!imageError ? (
                <img
                  src={getWeaponImagePath(weapon.weapon.name)}
                  alt={weapon.weapon.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-5xl">{getWeaponIcon(weapon.weapon.weaponType)}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-white text-lg">{weapon.weapon.name}</span>
              </div>
              <span className={`text-xs uppercase font-semibold px-2 py-1 rounded ${getTypeColor(weapon.weapon.weaponType)} bg-gray-800`}>
                {weapon.weapon.weaponType}
              </span>
            </div>
          </div>
          
          {weapon.weapon.description && (
            <p className="text-sm text-gray-400 mb-2">{weapon.weapon.description}</p>
          )}
          <div className="text-sm text-gray-400 bg-gray-800 p-2 rounded">
            Base Damage: <span className="text-white font-semibold">{weapon.weapon.baseDamage}</span>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-sm italic text-center py-8">
          <div className="text-4xl mb-2">⚙️</div>
          No weapon equipped
        </div>
      )}
    </div>
  );
}

export default WeaponSlot;
