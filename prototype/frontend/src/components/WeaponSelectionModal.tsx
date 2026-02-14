import { useEffect, useState } from 'react';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  handsRequired: string;
  loadoutType: string;
  description: string | null;
  baseDamage: number;
  cost: number;
  combatPowerBonus: number;
  targetingSystemsBonus: number;
  criticalSystemsBonus: number;
  penetrationBonus: number;
  weaponControlBonus: number;
  attackSpeedBonus: number;
  armorPlatingBonus: number;
  shieldCapacityBonus: number;
  evasionThrustersBonus: number;
  counterProtocolsBonus: number;
  servoMotorsBonus: number;
  gyroStabilizersBonus: number;
  hydraulicSystemsBonus: number;
  powerCoreBonus: number;
  threatAnalysisBonus: number;
}

interface WeaponInventory {
  id: number;
  weapon: Weapon;
  robotsMain?: Array<{ id: number; name: string }>;
  robotsOffhand?: Array<{ id: number; name: string }>;
}

interface WeaponSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (weaponInventoryId: number) => void;
  weapons: WeaponInventory[];
  currentWeaponId?: number | null;
  currentRobotId?: number;
  title?: string;
  slot?: 'main' | 'offhand';
  robotLoadoutType?: string;
}

function WeaponSelectionModal({
  isOpen,
  onClose,
  onSelect,
  weapons,
  currentWeaponId,
  currentRobotId,
  title = 'Select Weapon',
  slot = 'main',
  robotLoadoutType = 'single',
}: WeaponSelectionModalProps) {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!isOpen) {
      setFilter('');
      setTypeFilter('all');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper function to check if weapon is equipped by another robot
  const isEquippedByOtherRobot = (inv: WeaponInventory): boolean => {
    const equippedRobots = [
      ...(inv.robotsMain || []),
      ...(inv.robotsOffhand || []),
    ];
    
    // Filter out the current robot - we only care if OTHER robots have it equipped
    const otherRobots = equippedRobots.filter(robot => robot.id !== currentRobotId);
    return otherRobots.length > 0;
  };

  // Helper function to check if weapon is compatible with slot and loadout
  const isWeaponCompatible = (weapon: Weapon): boolean => {
    // Shield weapons can only go in offhand slot
    if (weapon.handsRequired === 'shield') {
      if (slot !== 'offhand') return false;
      if (robotLoadoutType !== 'weapon_shield') return false;
      return true;
    }

    // Two-handed weapons can only go in main slot
    if (weapon.handsRequired === 'two') {
      if (slot !== 'main') return false;
      if (robotLoadoutType !== 'two_handed') return false;
      return true;
    }

    // One-handed weapons
    if (weapon.handsRequired === 'one') {
      if (slot === 'main') {
        // Can't use one-handed in main slot with two_handed loadout
        if (robotLoadoutType === 'two_handed') return false;
        return true;
      } else {
        // Offhand slot: Only dual_wield loadout can use one-handed weapons
        if (robotLoadoutType !== 'dual_wield') return false;
        return true;
      }
    }

    return false;
  };

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

  const getBonuses = (weapon: Weapon): Array<{ label: string; value: number }> => {
    const bonusMap: Array<{ key: keyof Weapon; label: string }> = [
      { key: 'combatPowerBonus', label: 'Combat Power' },
      { key: 'targetingSystemsBonus', label: 'Targeting' },
      { key: 'criticalSystemsBonus', label: 'Critical' },
      { key: 'penetrationBonus', label: 'Penetration' },
      { key: 'weaponControlBonus', label: 'Control' },
      { key: 'attackSpeedBonus', label: 'Speed' },
      { key: 'armorPlatingBonus', label: 'Armor' },
      { key: 'shieldCapacityBonus', label: 'Shield' },
      { key: 'evasionThrustersBonus', label: 'Evasion' },
      { key: 'counterProtocolsBonus', label: 'Counter' },
      { key: 'servoMotorsBonus', label: 'Servo' },
      { key: 'gyroStabilizersBonus', label: 'Gyro' },
      { key: 'hydraulicSystemsBonus', label: 'Hydraulic' },
      { key: 'powerCoreBonus', label: 'Power' },
      { key: 'threatAnalysisBonus', label: 'Threat' },
    ];

    return bonusMap
      .map(({ key, label }) => ({
        label,
        value: weapon[key] as number,
      }))
      .filter((bonus) => bonus.value !== 0);
  };

  const filteredWeapons = weapons.filter((inv) => {
    const matchesName = inv.weapon.name.toLowerCase().includes(filter.toLowerCase());
    const matchesType = typeFilter === 'all' || inv.weapon.weaponType === typeFilter;
    const isCompatible = isWeaponCompatible(inv.weapon);
    const notEquippedElsewhere = !isEquippedByOtherRobot(inv);
    return matchesName && matchesType && isCompatible && notEquippedElsewhere;
  });

  const availableTypes = Array.from(new Set(weapons.map((inv) => inv.weapon.weaponType)));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search weapons..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weapon List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredWeapons.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              No weapons found. Visit the Weapon Shop to purchase weapons.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWeapons.map((inv) => {
                const bonuses = getBonuses(inv.weapon);
                const isCurrentlyEquipped = currentWeaponId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className={`bg-gray-700 p-4 rounded-lg cursor-pointer transition-all ${
                      isCurrentlyEquipped
                        ? 'border-2 border-blue-500'
                        : 'border-2 border-transparent hover:border-gray-500'
                    }`}
                    onClick={() => {
                      onSelect(inv.id);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{inv.weapon.name}</h3>
                      <span className={`text-xs uppercase font-semibold ${getTypeColor(inv.weapon.weaponType)}`}>
                        {inv.weapon.weaponType}
                      </span>
                    </div>

                    {inv.weapon.description && (
                      <p className="text-sm text-gray-400 mb-2">{inv.weapon.description}</p>
                    )}

                    <div className="text-sm mb-3">
                      <span className="text-gray-400">Damage: </span>
                      <span className="text-white font-semibold">{inv.weapon.baseDamage}</span>
                    </div>

                    {bonuses.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {bonuses.map((bonus, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded ${
                              bonus.value > 0
                                ? 'bg-green-900 text-green-300'
                                : 'bg-red-900 text-red-300'
                            }`}
                          >
                            {bonus.label}: {bonus.value > 0 ? '+' : ''}
                            {bonus.value}
                          </span>
                        ))}
                      </div>
                    )}

                    {isCurrentlyEquipped && (
                      <div className="mt-2 text-xs text-blue-400 font-semibold">
                        ✓ Currently Equipped
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeaponSelectionModal;
