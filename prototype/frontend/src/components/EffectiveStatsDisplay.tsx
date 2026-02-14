import { useState } from 'react';
import { calculateAttributeBonus, getLoadoutBonus, getStanceModifier } from '../utils/robotStats';

interface EffectiveStatsDisplayProps {
  robot: {
    loadoutType: string;
    stance: string;
    mainWeapon?: any;
    offhandWeapon?: any;
    [key: string]: any;
  };
}

// Category colors matching the design system
const categoryColors = {
  'Combat Systems': { bg: 'bg-red-900/30', text: 'text-red-400', icon: '⚔️' },
  'Defensive Systems': { bg: 'bg-blue-900/30', text: 'text-blue-400', icon: '🛡️' },
  'Chassis & Mobility': { bg: 'bg-green-900/30', text: 'text-green-400', icon: '⚙️' },
  'AI Processing': { bg: 'bg-yellow-900/30', text: 'text-yellow-400', icon: '🧠' },
  'Team Coordination': { bg: 'bg-purple-900/30', text: 'text-purple-400', icon: '🤝' },
};

// Attribute categories with their attributes and icons
const attributeCategories = {
  'Combat Systems': [
    { key: 'combatPower', label: 'Combat Power', icon: '💥' },
    { key: 'targetingSystems', label: 'Targeting Systems', icon: '🎯' },
    { key: 'criticalSystems', label: 'Critical Systems', icon: '💢' },
    { key: 'penetration', label: 'Penetration', icon: '🔪' },
    { key: 'weaponControl', label: 'Weapon Control', icon: '🎮' },
    { key: 'attackSpeed', label: 'Attack Speed', icon: '⚡' },
  ],
  'Defensive Systems': [
    { key: 'armorPlating', label: 'Armor Plating', icon: '🛡️' },
    { key: 'shieldCapacity', label: 'Shield Capacity', icon: '✨' },
    { key: 'evasionThrusters', label: 'Evasion Thrusters', icon: '💨' },
    { key: 'damageDampeners', label: 'Damage Dampeners', icon: '🔇' },
    { key: 'counterProtocols', label: 'Counter Protocols', icon: '↩️' },
  ],
  'Chassis & Mobility': [
    { key: 'hullIntegrity', label: 'Hull Integrity', icon: '🏗️' },
    { key: 'servoMotors', label: 'Servo Motors', icon: '⚙️' },
    { key: 'gyroStabilizers', label: 'Gyro Stabilizers', icon: '🔄' },
    { key: 'hydraulicSystems', label: 'Hydraulic Systems', icon: '💧' },
    { key: 'powerCore', label: 'Power Core', icon: '🔋' },
  ],
  'AI Processing': [
    { key: 'combatAlgorithms', label: 'Combat Algorithms', icon: '🧮' },
    { key: 'threatAnalysis', label: 'Threat Analysis', icon: '🔍' },
    { key: 'adaptiveAI', label: 'Adaptive AI', icon: '🤖' },
    { key: 'logicCores', label: 'Logic Cores', icon: '💻' },
  ],
  'Team Coordination': [
    { key: 'syncProtocols', label: 'Sync Protocols', icon: '🔗' },
    { key: 'supportSystems', label: 'Support Systems', icon: '🆘' },
    { key: 'formationTactics', label: 'Formation Tactics', icon: '📐' },
  ],
};

function EffectiveStatsDisplay({ robot }: EffectiveStatsDisplayProps) {
  const [expandedAttribute, setExpandedAttribute] = useState<string | null>(null);

  const getEffectiveStat = (attributeKey: string) => {
    const baseValue = robot[attributeKey] as number;
    const numericBase = typeof baseValue === 'string' ? parseFloat(baseValue) : baseValue;
    
    const weaponBonus = calculateAttributeBonus(attributeKey, robot.mainWeapon, robot.offhandWeapon);
    const loadoutBonus = getLoadoutBonus(robot.loadoutType, attributeKey);
    const stanceBonus = getStanceModifier(robot.stance, attributeKey);

    // Calculate total modifier percentage
    const totalModifier = loadoutBonus + stanceBonus;
    
    // Calculate effective value: (base + weapon) × (1 + loadout) × (1 + stance)
    const effectiveValue = (numericBase + weaponBonus) * (1 + loadoutBonus) * (1 + stanceBonus);

    return {
      base: Math.floor(numericBase),
      weapon: weaponBonus,
      loadout: loadoutBonus,
      stance: stanceBonus,
      totalModifier,
      effective: effectiveValue,
    };
  };

  const formatModifier = (value: number) => {
    if (value === 0) return '0%';
    const percent = Math.round(value * 100);
    return `${percent > 0 ? '+' : ''}${percent}%`;
  };

  const getModifierColor = (value: number) => {
    if (value === 0) return 'text-gray-400';
    return value > 0 ? 'text-green-400' : 'text-red-400';
  };

  const toggleExpand = (attributeKey: string) => {
    setExpandedAttribute(expandedAttribute === attributeKey ? null : attributeKey);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        📈 Effective Stats
      </h2>

      {/* Attributes by Category - Grid Layout with Fixed Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        {Object.entries(attributeCategories).map(([category, attributes]) => {
          const colors = categoryColors[category as keyof typeof categoryColors];
          const maxAttributes = 6;
          const attributeHeight = 'h-[42px]';
          
          return (
            <div key={category} className="space-y-2">
              {/* Category Header */}
              <div className={`${colors.bg} ${colors.text} px-3 py-2 rounded-lg`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{colors.icon}</span>
                  <span className="font-semibold text-sm">{category}</span>
                </div>
              </div>

              {/* Attributes in Category - Fixed Height Grid */}
              <div className="space-y-2">
                {attributes.map(({ key, label, icon }) => {
                  const stats = getEffectiveStat(key);
                  const isExpanded = expandedAttribute === key;
                  const isSignificant = Math.abs(stats.totalModifier) > 0.20;

                  return (
                    <div key={key} className={attributeHeight}>
                      {/* Compact Attribute Row */}
                      <div
                        className={`
                          px-3 py-2 rounded flex items-center justify-between gap-3
                          hover:bg-gray-750 cursor-pointer transition-colors h-full
                          ${isSignificant ? 'bg-yellow-900/20 border border-yellow-500' : 'bg-gray-800/50'}
                        `}
                        onClick={() => toggleExpand(key)}
                        title="Click to see breakdown"
                      >
                        {/* Left: Attribute Info */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-base">{icon}</span>
                          <div className="flex flex-col min-w-0">
                            <div className="text-gray-300 text-xs font-medium truncate">{label}</div>
                            <div className="text-xs text-gray-500">
                              Base: {stats.base}
                            </div>
                          </div>
                        </div>

                        {/* Right: Modifier and Effective Value */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-medium ${getModifierColor(stats.totalModifier)}`}>
                            {formatModifier(stats.totalModifier)}
                          </span>
                          <span className="text-white font-bold text-sm min-w-[40px] text-right">
                            {stats.effective.toFixed(1)}
                          </span>
                          <span className="text-gray-400 text-xs w-3">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Details - Overlay */}
                      {isExpanded && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setExpandedAttribute(null)}>
                          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border-2 border-gray-600" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="text-2xl">{icon}</span>
                              <h3 className="text-xl font-semibold text-white">{label}</h3>
                            </div>
                            
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                <span className="text-gray-400">Base Value:</span>
                                <span className="text-white font-semibold">{stats.base}</span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                <span className="text-gray-400">Weapon Bonus:</span>
                                <span className={getModifierColor(stats.weapon)}>
                                  {stats.weapon > 0 ? `+${stats.weapon}` : stats.weapon || '0'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                <span className="text-gray-400">Loadout Modifier:</span>
                                <span className={getModifierColor(stats.loadout)}>
                                  {formatModifier(stats.loadout)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                <span className="text-gray-400">Stance Modifier:</span>
                                <span className={getModifierColor(stats.stance)}>
                                  {formatModifier(stats.stance)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-2 bg-gray-900/50 rounded px-3">
                                <span className="text-gray-300 font-semibold">Effective Value:</span>
                                <span className="text-white font-bold text-lg">{stats.effective.toFixed(2)}</span>
                              </div>
                              
                              <div className="mt-4 pt-3 border-t border-gray-700">
                                <span className="text-gray-500 text-xs font-mono block">
                                  ({stats.base} + {stats.weapon}) × (1 {formatModifier(stats.loadout)}) × (1 {formatModifier(stats.stance)})
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => setExpandedAttribute(null)}
                              className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Add empty spacers to maintain alignment */}
                {Array.from({ length: maxAttributes - attributes.length }).map((_, i) => (
                  <div key={`spacer-${i}`} className={attributeHeight} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-sm text-gray-400 space-y-1">
        <p>
          <span className="text-green-400">Green</span> = Positive modifier | 
          <span className="text-red-400 ml-2">Red</span> = Negative modifier
        </p>
        <p>
          <span className="text-yellow-500">Highlighted</span> = Significant modifier (&gt;20%)
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Click any attribute to see detailed breakdown
        </p>
      </div>
    </div>
  );
}

export default EffectiveStatsDisplay;
