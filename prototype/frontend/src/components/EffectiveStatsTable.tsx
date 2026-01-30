import React from 'react';
import { calculateAttributeBonus, getLoadoutBonus } from '../utils/robotStats';
import { getStanceModifier } from '../utils/robotStats';

interface WeaponInventory {
  id: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    combatPowerBonus?: number;
    targetingSystemsBonus?: number;
    criticalSystemsBonus?: number;
    penetrationBonus?: number;
    weaponControlBonus?: number;
    attackSpeedBonus?: number;
    armorPlatingBonus?: number;
    shieldCapacityBonus?: number;
    evasionThrustersBonus?: number;
    damageDampenersBonus?: number;
    counterProtocolsBonus?: number;
    hullIntegrityBonus?: number;
    servoMotorsBonus?: number;
    gyroStabilizersBonus?: number;
    hydraulicSystemsBonus?: number;
    powerCoreBonus?: number;
    combatAlgorithmsBonus?: number;
    threatAnalysisBonus?: number;
    adaptiveAIBonus?: number;
    logicCoresBonus?: number;
    syncProtocolsBonus?: number;
    supportSystemsBonus?: number;
    formationTacticsBonus?: number;
  };
}

interface EffectiveStatsTableProps {
  robot: {
    loadoutType: string;
    stance: string;
    mainWeapon?: WeaponInventory | null;
    offhandWeapon?: WeaponInventory | null;
    [key: string]: any;
  };
}

// Attribute categories with their attributes
const attributeCategories = {
  'Combat Systems': [
    { key: 'combatPower', label: 'Combat Power' },
    { key: 'targetingSystems', label: 'Targeting Systems' },
    { key: 'criticalSystems', label: 'Critical Systems' },
    { key: 'penetration', label: 'Penetration' },
    { key: 'weaponControl', label: 'Weapon Control' },
    { key: 'attackSpeed', label: 'Attack Speed' },
  ],
  'Defensive Systems': [
    { key: 'armorPlating', label: 'Armor Plating' },
    { key: 'shieldCapacity', label: 'Shield Capacity' },
    { key: 'evasionThrusters', label: 'Evasion Thrusters' },
    { key: 'damageDampeners', label: 'Damage Dampeners' },
    { key: 'counterProtocols', label: 'Counter Protocols' },
  ],
  'Chassis & Mobility': [
    { key: 'hullIntegrity', label: 'Hull Integrity' },
    { key: 'servoMotors', label: 'Servo Motors' },
    { key: 'gyroStabilizers', label: 'Gyro Stabilizers' },
    { key: 'hydraulicSystems', label: 'Hydraulic Systems' },
    { key: 'powerCore', label: 'Power Core' },
  ],
  'AI Processing': [
    { key: 'combatAlgorithms', label: 'Combat Algorithms' },
    { key: 'threatAnalysis', label: 'Threat Analysis' },
    { key: 'adaptiveAI', label: 'Adaptive AI' },
    { key: 'logicCores', label: 'Logic Cores' },
  ],
  'Team Coordination': [
    { key: 'syncProtocols', label: 'Sync Protocols' },
    { key: 'supportSystems', label: 'Support Systems' },
    { key: 'formationTactics', label: 'Formation Tactics' },
  ],
};

function EffectiveStatsTable({ robot }: EffectiveStatsTableProps) {
  const getEffectiveStat = (attributeKey: string) => {
    const baseValue = robot[attributeKey] as number;
    // Convert string to number if it's a Decimal from the API
    const numericBase = typeof baseValue === 'string' ? parseFloat(baseValue) : baseValue;
    
    const weaponBonus = calculateAttributeBonus(attributeKey, robot.mainWeapon, robot.offhandWeapon);
    const loadoutBonus = getLoadoutBonus(robot.loadoutType, attributeKey);
    const stanceBonus = getStanceModifier(robot.stance, attributeKey);

    // Calculate effective value: (base + weapon) × (1 + loadout) × (1 + stance)
    const effectiveValue = (numericBase + weaponBonus) * (1 + loadoutBonus) * (1 + stanceBonus);

    return {
      base: Math.floor(numericBase), // Base is always integer
      weapon: weaponBonus, // Weapon bonuses are integers
      loadout: loadoutBonus,
      stance: stanceBonus,
      total: effectiveValue, // Total can have decimals
    };
  };

  const formatModifier = (value: number, isPercentage: boolean = false) => {
    if (value === 0) return '-';
    if (isPercentage) {
      const percent = Math.round(value * 100);
      return `${percent > 0 ? '+' : ''}${percent}%`;
    }
    return value > 0 ? `+${value}` : `${value}`;
  };

  const getModifierColor = (value: number) => {
    if (value === 0) return 'text-gray-400';
    return value > 0 ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        📊 Effective Stats Overview
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-2 text-gray-300 font-semibold">Attribute</th>
              <th className="text-center py-3 px-2 text-gray-300 font-semibold">Base</th>
              <th className="text-center py-3 px-2 text-gray-300 font-semibold">Weapons</th>
              <th className="text-center py-3 px-2 text-gray-300 font-semibold">Loadout</th>
              <th className="text-center py-3 px-2 text-gray-300 font-semibold">Stance</th>
              <th className="text-center py-3 px-2 text-white font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(attributeCategories).map(([category, attributes]) => (
              <React.Fragment key={category}>
                {/* Category Header */}
                <tr className="bg-gray-700">
                  <td colSpan={6} className="py-2 px-2 font-semibold text-blue-400">
                    {category}
                  </td>
                </tr>
                {/* Attributes in Category */}
                {attributes.map(({ key, label }) => {
                  const stats = getEffectiveStat(key);
                  return (
                    <tr key={key} className="border-b border-gray-800 hover:bg-gray-750">
                      <td className="py-2 px-2 text-gray-300">{label}</td>
                      <td className="py-2 px-2 text-center text-white">{stats.base}</td>
                      <td className={`py-2 px-2 text-center ${getModifierColor(stats.weapon)}`}>
                        {formatModifier(stats.weapon)}
                      </td>
                      <td className={`py-2 px-2 text-center ${getModifierColor(stats.loadout)}`}>
                        {formatModifier(stats.loadout, true)}
                      </td>
                      <td className={`py-2 px-2 text-center ${getModifierColor(stats.stance)}`}>
                        {formatModifier(stats.stance, true)}
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-white">
                        {stats.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        <p>
          <strong>Formula:</strong> Total = (Base + Weapons) × (1 + Loadout) × (1 + Stance)
        </p>
        <p className="mt-1">
          <span className="text-green-400">Green</span> = Positive modifier | 
          <span className="text-red-400 ml-2">Red</span> = Negative modifier
        </p>
      </div>
    </div>
  );
}

export default EffectiveStatsTable;
