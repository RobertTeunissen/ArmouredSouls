import React from 'react';
import { calculateWeaponCooldown, ATTRIBUTE_LABELS } from '../utils/weaponConstants';
import { getWeaponImagePath } from '../utils/weaponImages';
import MeleeIcon from '../assets/icons/weapon-types/melee.svg?react';
import BallisticIcon from '../assets/icons/weapon-types/ballistic.svg?react';
import EnergyIcon from '../assets/icons/weapon-types/energy.svg?react';
import ShieldIcon from '../assets/icons/weapon-types/shield.svg?react';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  description: string;
  baseDamage: number;
  cost: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface WeaponDetailModalProps {
  weapon: Weapon;
  onClose: () => void;
  onPurchase: (weaponId: number, cost: number) => void;
  calculateDiscountedPrice: (cost: number) => number;
  userCredits: number;
  isFull: boolean;
  purchasing: boolean;
  hasDiscount: boolean;
  discountPercent: number;
  ownedCount?: number;
}

const WeaponDetailModal: React.FC<WeaponDetailModalProps> = ({
  weapon,
  onClose,
  onPurchase,
  calculateDiscountedPrice,
  userCredits,
  isFull,
  purchasing,
  hasDiscount,
  discountPercent,
  ownedCount = 0,
}) => {
  const discountedPrice = calculateDiscountedPrice(weapon.cost);
  const canAfford = userCredits >= discountedPrice;
  const canPurchase = canAfford && !isFull && !purchasing;
  const cooldown = calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage);
  const dps = weapon.baseDamage / parseFloat(cooldown);

  const getWeaponTypeIcon = (type: string) => {
    const iconClass = "w-8 h-8";
    switch (type.toLowerCase()) {
      case 'melee':
        return <MeleeIcon className={`${iconClass} text-red-400`} />;
      case 'ballistic':
        return <BallisticIcon className={`${iconClass} text-orange-400`} />;
      case 'energy':
        return <EnergyIcon className={`${iconClass} text-blue-400`} />;
      case 'shield':
        return <ShieldIcon className={`${iconClass} text-cyan-400`} />;
      default:
        return null;
    }
  };

  const getAttributeBonuses = () => {
    const bonuses: Array<{ label: string; value: number }> = [];
    ATTRIBUTE_LABELS.forEach(({ key, label }) => {
      const value = weapon[key] as number;
      if (value !== 0) {
        bonuses.push({ label, value });
      }
    });
    return bonuses;
  };

  const attributeBonuses = getAttributeBonuses();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            {getWeaponTypeIcon(weapon.weaponType)}
            <div>
              <h2 className="text-2xl font-bold">{weapon.name}</h2>
              <div className="flex gap-3 mt-1">
                <span className="text-sm text-gray-400 capitalize">{weapon.weaponType}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-400">
                  {weapon.loadoutType.replace(/_/g, ' ').split(' ').map(w => 
                    w.charAt(0).toUpperCase() + w.slice(1)
                  ).join(' ')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Owned Indicator */}
          {ownedCount > 0 && (
            <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-300 font-medium">
                Already Own ({ownedCount})
              </span>
            </div>
          )}

          {/* Weapon Image */}
          <div className="flex justify-center">
            <img
              src={getWeaponImagePath(weapon.name)}
              alt={weapon.name}
              className="w-64 h-64 object-contain"
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-gray-300">{weapon.description}</p>
          </div>

          {/* Combat Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Combat Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm text-gray-400">Base Damage</div>
                <div className="text-2xl font-bold">{weapon.baseDamage}</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm text-gray-400">Cooldown</div>
                <div className="text-2xl font-bold">{cooldown}s</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm text-gray-400">DPS</div>
                <div className="text-2xl font-bold text-blue-400">{Math.round(dps)}</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-sm text-gray-400">Total Attributes</div>
                <div className="text-2xl font-bold text-green-400">
                  +{attributeBonuses.reduce((sum, b) => sum + b.value, 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Attribute Bonuses */}
          {attributeBonuses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Attribute Bonuses</h3>
              <div className="grid grid-cols-2 gap-2">
                {attributeBonuses.map((bonus, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-700 rounded px-3 py-2">
                    <span className="text-sm text-gray-300">{bonus.label}</span>
                    <span className={`font-semibold ${bonus.value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {bonus.value > 0 ? '+' : ''}{bonus.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Cost</span>
              <div className="text-right">
                {hasDiscount && (
                  <div className="text-sm text-gray-500 line-through">
                    ₡{weapon.cost.toLocaleString()}
                  </div>
                )}
                <div className={`text-2xl font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                  ₡{discountedPrice.toLocaleString()}
                </div>
                {hasDiscount && (
                  <div className="text-sm text-gray-400">
                    (-{discountPercent}% Weapon Workshop discount)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-6 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Your Credits: <span className={canAfford ? 'text-green-400' : 'text-red-400'}>
              ₡{userCredits.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onPurchase(weapon.id, weapon.cost)}
              disabled={!canPurchase}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                isFull
                  ? 'bg-red-900 text-red-300 cursor-not-allowed'
                  : !canAfford
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : purchasing
                  ? 'bg-gray-700 text-gray-400 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isFull ? 'Storage Full' : !canAfford ? 'Insufficient Credits' : purchasing ? 'Purchasing...' : 'Purchase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeaponDetailModal;
