import React, { useState } from 'react';
import MeleeIcon from '../assets/icons/weapon-types/melee.svg?react';
import BallisticIcon from '../assets/icons/weapon-types/ballistic.svg?react';
import EnergyIcon from '../assets/icons/weapon-types/energy.svg?react';
import ShieldIcon from '../assets/icons/weapon-types/shield.svg?react';
import { calculateDPS as calcDPS } from '../utils/weaponConstants';
import { getRangeBandLabel, getRangeBandColor, RangeBand } from '../utils/weaponRange';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  description: string;
  baseDamage: number;
  cost: number;
  [key: string]: unknown;
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

type SortField = 'name' | 'weaponType' | 'loadoutType' | 'rangeBand' | 'baseDamage' | 'cooldown' | 'dps' | 'cost' | 'attributes';
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
        return <MeleeIcon className={`${iconClass} text-error`} />;
      case 'ballistic':
        return <BallisticIcon className={`${iconClass} text-orange-400`} />;
      case 'energy':
        return <EnergyIcon className={`${iconClass} text-primary`} />;
      case 'shield':
        return <ShieldIcon className={`${iconClass} text-cyan-400`} />;
      default:
        return <span className="w-5 h-5 text-secondary">?</span>;
    }
  };

  const calculateDPS = (weapon: Weapon): string => {
    return calcDPS(weapon.baseDamage, weapon.cooldown as number);
  };

  const calculateAttributeTotal = (weapon: Weapon): number => {
    const attributeKeys = [
      'combatPowerBonus', 'targetingSystemsBonus', 'criticalSystemsBonus',
      'penetrationBonus', 'weaponControlBonus', 'attackSpeedBonus',
      'armorPlatingBonus', 'shieldCapacityBonus', 'evasionThrustersBonus',
      'counterProtocolsBonus', 'servoMotorsBonus', 'gyroStabilizersBonus',
      'hydraulicSystemsBonus', 'powerCoreBonus', 'threatAnalysisBonus'
    ];
    
    return attributeKeys.reduce((sum, key) => sum + ((weapon[key] as number) || 0), 0);
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
      let aValue: string | number;
      let bValue: string | number;

      const rangeBandOrder: Record<string, number> = { melee: 0, short: 1, mid: 2, long: 3 };

      switch (sortField) {
        case 'rangeBand':
          aValue = rangeBandOrder[a.rangeBand as string] ?? 99;
          bValue = rangeBandOrder[b.rangeBand as string] ?? 99;
          break;
        case 'cooldown':
          aValue = a.cooldown as number;
          bValue = b.cooldown as number;
          break;
        case 'dps':
          aValue = parseFloat(calculateDPS(a));
          bValue = parseFloat(calculateDPS(b));
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
          aValue = a[sortField] as string | number;
          bValue = b[sortField] as string | number;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = typeof bValue === 'string' ? bValue.toLowerCase() : bValue;
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
          <tr className="bg-surface border-b border-white/10">
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('name')}
            >
              Name <SortIndicator field="name" />
            </th>
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('loadoutType')}
            >
              Loadout <SortIndicator field="loadoutType" />
            </th>
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('weaponType')}
            >
              Type <SortIndicator field="weaponType" />
            </th>
            <th 
              className="px-4 py-3 text-left text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('rangeBand')}
            >
              Range <SortIndicator field="rangeBand" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('baseDamage')}
            >
              Damage <SortIndicator field="baseDamage" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('cooldown')}
            >
              Cooldown <SortIndicator field="cooldown" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('dps')}
            >
              DPS <SortIndicator field="dps" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('cost')}
            >
              Cost <SortIndicator field="cost" />
            </th>
            <th 
              className="px-4 py-3 text-right text-sm font-semibold text-secondary cursor-pointer hover:text-white"
              onClick={() => handleSort('attributes')}
            >
              Attributes <SortIndicator field="attributes" />
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-secondary">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedWeapons.map((weapon) => {
            const discountedPrice = calculateDiscountedPrice(weapon.cost);
            const dps = calculateDPS(weapon);
            const attributeTotal = calculateAttributeTotal(weapon);
            const canAfford = userCredits >= discountedPrice;
            const canPurchase = canAfford && !isFull && purchasing !== weapon.id;

            return (
              <tr
                key={weapon.id}
                className={`border-b border-white/10 hover:bg-surface transition-colors ${
                  !canAfford ? 'opacity-60' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getWeaponTypeIcon(weapon.weaponType)}
                    <div className="flex flex-col">
                      <span 
                        className="font-medium cursor-pointer hover:text-primary transition-colors"
                        onClick={() => onWeaponClick?.(weapon)}
                      >
                        {weapon.name}
                      </span>
                      {ownedWeapons && ownedWeapons.has(weapon.id) && (
                        <span className="text-xs text-success">
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
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${getRangeBandColor(weapon.rangeBand as RangeBand)}`}>
                    {getRangeBandLabel(weapon.rangeBand as RangeBand)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono">{weapon.baseDamage}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-secondary">{String(weapon.cooldown)}s</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono">{dps}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end">
                    {hasDiscount && (
                      <span className="text-xs text-tertiary line-through">
                        ₡{weapon.cost.toLocaleString()}
                      </span>
                    )}
                    <span className={`font-semibold ${canAfford ? 'text-success' : 'text-error'}`}>
                      ₡{discountedPrice.toLocaleString()}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-secondary">
                        (-{discountPercent}%)
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-primary">+{attributeTotal}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onPurchase(weapon.id, weapon.cost)}
                    disabled={!canPurchase}
                    className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      isFull
                        ? 'bg-red-900 text-red-300 cursor-not-allowed'
                        : !canAfford
                        ? 'bg-surface-elevated text-tertiary cursor-not-allowed'
                        : purchasing === weapon.id
                        ? 'bg-surface-elevated text-secondary cursor-wait'
                        : 'bg-primary hover:bg-blue-700 text-white'
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
