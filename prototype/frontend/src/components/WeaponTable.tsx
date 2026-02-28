import React, { useState } from 'react';
import MeleeIcon from '../assets/icons/weapon-types/melee.svg?react';
import BallisticIcon from '../assets/icons/weapon-types/ballistic.svg?react';
import EnergyIcon from '../assets/icons/weapon-types/energy.svg?react';
import ShieldIcon from '../assets/icons/weapon-types/shield.svg?react';
import { calculateWeaponCooldown } from '../utils/weaponConstants';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  description: string;
  baseDamage: number;
  cost: number;
  // Attribute bonuses (add as needed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface WeaponTableProps {
  weapons: Weapon[];
  onPurchase: (weaponId: number, cost: number) => void;
  calculateDiscountedPrice: (cost: number) => number;
  userCredits: number;
  isFull: boolean;
  purchasing: number | null;
  hasDiscount: boolean;
  discountPercent: number;
  onWeaponClick?: (weapon: Weapon) => void;
  ownedWeapons?: Map<number, number>;
}

type SortField = 'name' | 'weaponType' | 'loadoutType' | 'baseDamage' | 'cooldown' | 'dps' | 'cost' | 'attributes';
type SortDirection = 'asc' | 'desc';

const WeaponTable: React.FC<WeaponTableProps> = ({
  weapons,
  onPurchase,
  calculateDiscountedPrice,
  userCredits,
  isFull,
  purchasing,
  hasDiscount,
  discountPercent,
  onWeaponClick,
  ownedWeapons,
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getWeaponTypeIcon = (type: string) => {
    const iconClass = "w-5 h-5";
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
        return <span className="w-5 h-5 text-gray-400">?</span>;
    }
  };

  const calculateDPS = (weapon: Weapon): number => {
    const cooldownStr = calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage);
    const cooldown = parseFloat(cooldownStr);
    return Math.round(weapon.baseDamage / cooldown);
  };

  const calculateAttributeTotal = (weapon: Weapon): number => {
    const attributeKeys = [
      'combatPowerBonus', 'targetingSystemsBonus', 'criticalSystemsBonus',
      'penetrationBonus', 'weaponControlBonus', 'attackSpeedBonus',
      'armorPlatingBonus', 'shieldCapacityBonus', 'evasionThrustersBonus',
      'counterProtocolsBonus', 'servoMotorsBonus', 'gyroStabilizersBonus',
      'hydraulicSystemsBonus', 'powerCoreBonus', 'threatAnalysisBonus'
    ];
    
    return attributeKeys.reduce((sum, key) => sum + (weapon[key] || 0), 0);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedWeapons = () => {
    return [...weapons].sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let aValue: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bValue: any;

      switch (sortField) {
        case 'cooldown':
          aValue = parseFloat(calculateWeaponCooldown(a.weaponType, a.baseDamage));
          bValue = parseFloat(calculateWeaponCooldown(b.weaponType, b.baseDamage));
          break;
        case 'dps':
          aValue = calculateDPS(a);
          bValue = calculateDPS(b);
          break;
        case 'cost':
          aValue = calculateDiscountedPrice(a.cost);
          bValue = calculateDiscountedPrice(b.cost);
          break;
        case 'attributes':
          aValue = calculateAttributeTotal(a);
          bValue = calculateAttributeTotal(b);
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedWeapons = getSortedWeapons();

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const formatLoadoutType = (type: string): string => {
    return type.replace(/_/g, ' ').split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-800 border-b border-gray-700">
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('name')}
            >
              Name <SortIndicator field="name" />
            </th>
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('loadoutType')}
            >
              Loadout <SortIndicator field="loadoutType" />
            </th>
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('weaponType')}
            >
              Type <SortIndicator field="weaponType" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('baseDamage')}
            >
              Damage <SortIndicator field="baseDamage" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('cooldown')}
            >
              Cooldown <SortIndicator field="cooldown" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('dps')}
            >
              DPS <SortIndicator field="dps" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('cost')}
            >
              Cost <SortIndicator field="cost" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white"
              onClick={() => handleSort('attributes')}
            >
              Attributes <SortIndicator field="attributes" />
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedWeapons.map((weapon) => {
            const discountedPrice = calculateDiscountedPrice(weapon.cost);
            const dps = calculateDPS(weapon);
            const cooldown = calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage);
            const attributeTotal = calculateAttributeTotal(weapon);
            const canAfford = userCredits >= discountedPrice;
            const canPurchase = canAfford && !isFull && purchasing !== weapon.id;

            return (
              <tr
                key={weapon.id}
                className={`border-b border-gray-700 hover:bg-gray-800 transition-colors ${
                  !canAfford ? 'opacity-60' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getWeaponTypeIcon(weapon.weaponType)}
                    <div className="flex flex-col">
                      <span 
                        className="font-medium cursor-pointer hover:text-blue-400 transition-colors"
                        onClick={() => onWeaponClick?.(weapon)}
                      >
                        {weapon.name}
                      </span>
                      {ownedWeapons && ownedWeapons.has(weapon.id) && (
                        <span className="text-xs text-green-400">
                          Own ({ownedWeapons.get(weapon.id)})
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{formatLoadoutType(weapon.loadoutType)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm capitalize">{weapon.weaponType}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono">{weapon.baseDamage}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-gray-400">{cooldown}s</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono">{dps}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end">
                    {hasDiscount && (
                      <span className="text-xs text-gray-500 line-through">
                        ₡{weapon.cost.toLocaleString()}
                      </span>
                    )}
                    <span className={`font-semibold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                      ₡{discountedPrice.toLocaleString()}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-gray-400">
                        (-{discountPercent}%)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-blue-400">+{attributeTotal}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onPurchase(weapon.id, weapon.cost)}
                    disabled={!canPurchase}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      isFull
                        ? 'bg-red-900 text-red-300 cursor-not-allowed'
                        : !canAfford
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : purchasing === weapon.id
                        ? 'bg-gray-700 text-gray-400 cursor-wait'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isFull
                      ? 'Full'
                      : purchasing === weapon.id
                      ? 'Buying...'
                      : !canAfford
                      ? 'Low ₡'
                      : 'Buy'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WeaponTable;
