import { useState } from 'react';
import { getCapForLevel } from '../../../../shared/utils/academyCaps';
import { calculateBaseCost } from '../../../../shared/utils/upgradeCosts';
import { calculateTrainingFacilityDiscount } from '../../../../shared/utils/discounts';
import type { OwnedRobot, WhatIfOverrides, AcademyLevels } from './types';
import { STANCE_OPTIONS } from './constants';
import { ConfigSelect } from './ConfigSelect';

/** Category config matching UpgradePlanner — with academy mapping */
const WHATIF_CATEGORIES: Record<string, {
  academy: string;
  icon: string;
  color: string;
  attributes: Array<{ key: string; label: string; icon: string }>;
}> = {
  'Combat Systems': {
    academy: 'combat_training_academy',
    icon: '⚔️',
    color: 'bg-red-900/30 text-error',
    attributes: [
      { key: 'combatPower', label: 'Combat Power', icon: '💥' },
      { key: 'targetingSystems', label: 'Targeting Systems', icon: '🎯' },
      { key: 'criticalSystems', label: 'Critical Systems', icon: '💢' },
      { key: 'penetration', label: 'Penetration', icon: '🔪' },
      { key: 'weaponControl', label: 'Weapon Control', icon: '🎮' },
      { key: 'attackSpeed', label: 'Attack Speed', icon: '⚡' },
    ],
  },
  'Defensive Systems': {
    academy: 'defense_training_academy',
    icon: '🛡️',
    color: 'bg-blue-900/30 text-primary',
    attributes: [
      { key: 'armorPlating', label: 'Armor Plating', icon: '🛡️' },
      { key: 'shieldCapacity', label: 'Shield Capacity', icon: '✨' },
      { key: 'evasionThrusters', label: 'Evasion Thrusters', icon: '💨' },
      { key: 'damageDampeners', label: 'Damage Dampeners', icon: '🔇' },
      { key: 'counterProtocols', label: 'Counter Protocols', icon: '↩️' },
    ],
  },
  'Chassis & Mobility': {
    academy: 'mobility_training_academy',
    icon: '⚙️',
    color: 'bg-green-900/30 text-success',
    attributes: [
      { key: 'hullIntegrity', label: 'Hull Integrity', icon: '🏗️' },
      { key: 'servoMotors', label: 'Servo Motors', icon: '⚙️' },
      { key: 'gyroStabilizers', label: 'Gyro Stabilizers', icon: '🔄' },
      { key: 'hydraulicSystems', label: 'Hydraulic Systems', icon: '💧' },
      { key: 'powerCore', label: 'Power Core', icon: '🔋' },
    ],
  },
  'AI Processing': {
    academy: 'ai_training_academy',
    icon: '🧠',
    color: 'bg-yellow-900/30 text-warning',
    attributes: [
      { key: 'combatAlgorithms', label: 'Combat Algorithms', icon: '🧮' },
      { key: 'threatAnalysis', label: 'Threat Analysis', icon: '🔍' },
      { key: 'adaptiveAI', label: 'Adaptive AI', icon: '🤖' },
      { key: 'logicCores', label: 'Logic Cores', icon: '💻' },
    ],
  },
  'Team Coordination': {
    academy: 'ai_training_academy',
    icon: '🤝',
    color: 'bg-purple-900/30 text-purple-400',
    attributes: [
      { key: 'syncProtocols', label: 'Sync Protocols', icon: '🔗' },
      { key: 'supportSystems', label: 'Support Systems', icon: '🆘' },
      { key: 'formationTactics', label: 'Formation Tactics', icon: '📐' },
    ],
  },
};

/** Sparse map of attribute name → tuning bonus value (only non-zero entries) */
export type TuningAllocations = Record<string, number>;

export interface WhatIfPanelProps {
  robot: OwnedRobot;
  overrides: WhatIfOverrides;
  onChange: (o: WhatIfOverrides) => void;
  trainingLevel: number;
  academyLevels: AcademyLevels;
  /** Optional tuning allocations for the robot — displayed as read-only context */
  tuningAllocations?: TuningAllocations;
}

/** Build a label lookup from WHATIF_CATEGORIES for displaying tuning allocations */
const ATTRIBUTE_LABELS: Record<string, string> = {};
for (const config of Object.values(WHATIF_CATEGORIES)) {
  for (const attr of config.attributes) {
    ATTRIBUTE_LABELS[attr.key] = attr.label;
  }
}

export function WhatIfPanel({
  robot,
  overrides,
  onChange,
  trainingLevel,
  academyLevels,
  tuningAllocations,
}: WhatIfPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [tuningExpanded, setTuningExpanded] = useState(false);
  const hasOverrides = Object.keys(overrides.attributes || {}).length > 0 ||
    overrides.stance || overrides.yieldThreshold !== undefined ||
    Object.keys(overrides.simulatedAcademyLevels || {}).length > 0 ||
    Object.keys(overrides.tuningBonuses || {}).length > 0;
  const hasTuningOverrides = Object.keys(overrides.tuningBonuses || {}).length > 0;

  const trainingDiscountPercent = calculateTrainingFacilityDiscount(trainingLevel);
  const trainingDiscount = trainingDiscountPercent / 100;

  // Academy costs: [100K, 200K, ..., 1M] for levels 1-10
  const ACADEMY_COSTS = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000];

  // Effective academy level = real + simulated upgrades
  const getEffectiveAcademyLevel = (academyKey: string): number => {
    const real = academyLevels[academyKey as keyof AcademyLevels] || 0;
    return overrides.simulatedAcademyLevels?.[academyKey] ?? real;
  };

  // Cost to upgrade academy from real to simulated level
  const getAcademyCost = (academyKey: string): number => {
    const real = academyLevels[academyKey as keyof AcademyLevels] || 0;
    const simulated = overrides.simulatedAcademyLevels?.[academyKey] ?? real;
    let cost = 0;
    for (let level = real; level < simulated; level++) cost += ACADEMY_COSTS[level] || 0;
    return cost;
  };

  // Cost calculation with training facility discount (same as UpgradePlanner)
  const calculateDiscountedCost = (currentLevel: number): number => Math.floor(calculateBaseCost(currentLevel) * (1 - trainingDiscount));

  const getCategoryCost = (attrs: Array<{ key: string }>): { cost: number; baseCost: number } => {
    let cost = 0;
    let baseCost = 0;
    for (const { key } of attrs) {
      const current = Math.floor(Number(robot[key]) || 1);
      const target = overrides.attributes?.[key] ?? current;
      for (let level = current; level < target; level++) {
        baseCost += calculateBaseCost(level);
        cost += calculateDiscountedCost(level);
      }
    }
    return { cost, baseCost };
  };

  // Category-level increment: +1 to all attributes. Auto-upgrades academy if at cap.
  const handleIncrementCategory = (attrs: Array<{ key: string }>, academyKey: string) => {
    const effectiveLevel = getEffectiveAcademyLevel(academyKey);
    const cap = getCapForLevel(effectiveLevel);
    const allAtCap = attrs.every(({ key }) => (overrides.attributes?.[key] ?? Math.floor(Number(robot[key]) || 1)) >= cap);

    if (allAtCap && effectiveLevel < 10) {
      // Auto-upgrade academy and then increment
      const newSimLevels = { ...(overrides.simulatedAcademyLevels || {}) };
      newSimLevels[academyKey] = effectiveLevel + 1;
      const newCap = getCapForLevel(effectiveLevel + 1);
      const newAttrs = { ...(overrides.attributes || {}) };
      for (const { key } of attrs) {
        const current = Math.floor(Number(robot[key]) || 1);
        const planned = newAttrs[key] ?? current;
        if (planned < newCap) newAttrs[key] = planned + 1;
      }
      onChange({ ...overrides, attributes: Object.keys(newAttrs).length ? newAttrs : undefined, simulatedAcademyLevels: newSimLevels });
    } else if (!allAtCap) {
      const newAttrs = { ...(overrides.attributes || {}) };
      for (const { key } of attrs) {
        const current = Math.floor(Number(robot[key]) || 1);
        const planned = newAttrs[key] ?? current;
        if (planned < cap) newAttrs[key] = planned + 1;
      }
      onChange({ ...overrides, attributes: Object.keys(newAttrs).length ? newAttrs : undefined });
    }
  };

  // Category-level decrement: -1 from all attributes in the category
  const handleDecrementCategory = (attrs: Array<{ key: string }>) => {
    const newAttrs = { ...(overrides.attributes || {}) };
    for (const { key } of attrs) {
      const current = Math.floor(Number(robot[key]) || 1);
      const planned = newAttrs[key] ?? current;
      if (planned > current) {
        const newVal = planned - 1;
        if (newVal <= current) delete newAttrs[key]; else newAttrs[key] = newVal;
      }
    }
    onChange({ ...overrides, attributes: Object.keys(newAttrs).length ? newAttrs : undefined });
  };

  const categoryHasChanges = (attrs: Array<{ key: string }>): boolean =>
    attrs.some(({ key }) => (overrides.attributes?.[key] ?? Math.floor(Number(robot[key]) || 1)) > Math.floor(Number(robot[key]) || 1));

  // Total attribute cost
  const allAttrs = Object.values(WHATIF_CATEGORIES).flatMap(c => c.attributes);
  const { cost: totalAttrCost, baseCost: totalAttrBaseCost } = getCategoryCost(allAttrs);
  const totalAttrSavings = totalAttrBaseCost - totalAttrCost;

  // Total academy cost (deduplicated — AI Processing and Team Coordination share ai_training_academy)
  const seenAcademies = new Set<string>();
  let uniqueAcademyCost = 0;
  for (const config of Object.values(WHATIF_CATEGORIES)) {
    if (!seenAcademies.has(config.academy)) {
      seenAcademies.add(config.academy);
      uniqueAcademyCost += getAcademyCost(config.academy);
    }
  }
  const totalCost = totalAttrCost + uniqueAcademyCost;

  // Filter tuning allocations to non-zero entries
  const nonZeroTuning = tuningAllocations
    ? Object.entries(tuningAllocations).filter(([, v]) => v > 0)
    : [];
  const hasTuning = nonZeroTuning.length > 0;

  return (
    <div className="space-y-3">
      {/* Tuning Active — read-only summary of current tuning allocation */}
      {hasTuning && (
        <div className="bg-teal-900/20 border border-teal-700/50 rounded-lg px-3 py-2 space-y-1">
          <span className="text-teal-400 text-sm font-semibold">⚙️ Tuning Active</span>
          <p className="text-teal-300 text-xs">
            {nonZeroTuning
              .map(([key, val]) => `+${val} ${ATTRIBUTE_LABELS[key] || key}`)
              .join(', ')}
          </p>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm text-secondary hover:text-primary transition-colors"
      >
        <span>🔧 What-If Configuration {hasOverrides ? '(modified)' : ''}</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="bg-surface p-4 rounded-lg space-y-3">
          <p className="text-xs text-amber-400">⚠️ Simulation only — your robot is not modified</p>

          {/* Training Facility Discount Banner */}
          {trainingLevel > 0 && (
            <div className="bg-green-900/20 border border-green-700 text-green-300 px-3 py-2 rounded flex items-center justify-between text-xs">
              <span>Training Facility Discount:</span>
              <span className="font-semibold">{trainingDiscountPercent}%</span>
            </div>
          )}

          {/* Stance & Yield */}
          <div className="grid grid-cols-2 gap-3">
            <ConfigSelect
              label="Stance"
              value={overrides.stance || robot.stance || 'balanced'}
              options={STANCE_OPTIONS.map(s => ({ value: s.value, label: `${s.emoji} ${s.label}` }))}
              onChange={(v) => onChange({ ...overrides, stance: v })}
            />
            <div>
              <label className="block text-xs text-secondary mb-1">
                Yield: {overrides.yieldThreshold ?? robot.yieldThreshold ?? 10}%
              </label>
              <input
                type="range"
                min={0}
                max={50}
                value={overrides.yieldThreshold ?? robot.yieldThreshold ?? 10}
                onChange={(e) => onChange({ ...overrides, yieldThreshold: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Tuning Overrides */}
          <div className="border border-teal-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setTuningExpanded(!tuningExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 bg-teal-900/20 text-sm text-teal-400 hover:bg-teal-900/30 transition-colors"
            >
              <span>⚙️ Tuning Overrides {hasTuningOverrides ? '(modified)' : ''}</span>
              <span>{tuningExpanded ? '▼' : '▶'}</span>
            </button>
            {tuningExpanded && (
              <div className="p-3 space-y-2">
                <p className="text-xs text-teal-300/70 mb-2">Override tuning allocation for this simulation only</p>
                {Object.entries(WHATIF_CATEGORIES).map(([category, config]) => (
                  <div key={`tuning-${category}`}>
                    <div className="text-xs text-secondary font-semibold mb-1">{config.icon} {category}</div>
                    {config.attributes.map(({ key, label }) => {
                      const tuningValue = overrides.tuningBonuses?.[key] ?? tuningAllocations?.[key] ?? 0;
                      const maxTuning = 15; // Reasonable max for the slider — actual cap enforced server-side
                      return (
                        <div key={`tuning-${key}`} className="flex items-center gap-2 py-0.5">
                          <span className="text-xs text-secondary w-32 truncate">{label}</span>
                          <input
                            type="range"
                            min={0}
                            max={maxTuning}
                            step={1}
                            value={tuningValue}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const newTuning = { ...(overrides.tuningBonuses || tuningAllocations || {}) };
                              if (val === 0) {
                                delete newTuning[key];
                              } else {
                                newTuning[key] = val;
                              }
                              onChange({ ...overrides, tuningBonuses: Object.keys(newTuning).length > 0 ? newTuning : undefined });
                            }}
                            className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-teal-500 bg-teal-900/30"
                            aria-label={`Tuning override for ${label}`}
                          />
                          <span className={`text-xs w-6 text-right ${tuningValue > 0 ? 'text-teal-400 font-semibold' : 'text-gray-600'}`}>
                            {tuningValue > 0 ? `+${tuningValue}` : '0'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {hasTuningOverrides && (
                  <button
                    onClick={() => onChange({ ...overrides, tuningBonuses: undefined })}
                    className="text-xs text-error hover:text-red-400 transition-colors mt-1"
                  >
                    Reset Tuning Overrides
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Categories in rows — matching UpgradePlanner layout */}
          <div className="space-y-3">
            {Object.entries(WHATIF_CATEGORIES).map(([category, config]) => {
              const academyKey = config.academy;
              const realAcademyLevel = academyLevels[academyKey as keyof AcademyLevels] || 0;
              const effectiveAcademyLevel = getEffectiveAcademyLevel(academyKey);
              const cap = getCapForLevel(effectiveAcademyLevel);
              const hasChanges = categoryHasChanges(config.attributes);
              const { cost: catCost, baseCost: catBaseCost } = getCategoryCost(config.attributes);
              const catSavings = catBaseCost - catCost;
              const academyUpgraded = effectiveAcademyLevel > realAcademyLevel;
              const academyCostForCat = getAcademyCost(academyKey);
              const allAtCap = config.attributes.every(({ key }) =>
                ((overrides.attributes?.[key] ?? Math.floor(Number(robot[key]) || 1))) >= cap
              );
              const maxedOut = allAtCap && effectiveAcademyLevel >= 10;

              return (
                <div key={category} className="space-y-1">
                  {/* Category Header with +/- buttons */}
                  <div className={`${config.color} px-3 py-2 rounded-lg`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <span className="font-semibold text-sm">{category}</span>
                        <span className="text-xs text-secondary">
                          Cap: {cap}
                          {academyUpgraded
                            ? <span className="text-cyan-400"> (Academy Lv{realAcademyLevel} → {effectiveAcademyLevel})</span>
                            : ` (Academy Lv${realAcademyLevel})`
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(catCost > 0 || academyCostForCat > 0) && (
                          <span className="text-xs text-warning font-semibold">
                            {catSavings > 0 && <span className="line-through text-tertiary mr-1">₡{catBaseCost.toLocaleString()}</span>}
                            ₡{(catCost + academyCostForCat).toLocaleString()}
                          </span>
                        )}
                        <button
                          onClick={() => handleDecrementCategory(config.attributes)}
                          disabled={!hasChanges}
                          className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm transition-colors ${
                            hasChanges ? 'bg-surface-elevated hover:bg-gray-600 text-white' : 'bg-surface/50 text-gray-600 cursor-not-allowed'
                          }`}
                        >−</button>
                        <button
                          onClick={() => handleIncrementCategory(config.attributes, academyKey)}
                          disabled={maxedOut}
                          className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm transition-colors ${
                            !maxedOut ? 'bg-primary hover:bg-blue-700 text-white' : 'bg-surface/50 text-gray-600 cursor-not-allowed'
                          }`}
                        >+</button>
                      </div>
                    </div>
                  </div>

                  {/* Attribute rows — compact, showing current → planned */}
                  <div className="space-y-1">
                    {config.attributes.map(({ key, label, icon }) => {
                      const current = Math.floor(Number(robot[key]) || 1);
                      const planned = overrides.attributes?.[key] ?? current;
                      const hasChange = planned > current;
                      return (
                        <div key={key} className={`px-3 py-1 rounded flex items-center justify-between text-xs ${hasChange ? 'bg-blue-900/20' : ''}`}>
                          <div className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className={hasChange ? 'text-primary font-medium' : 'text-secondary'}>{label}</span>
                          </div>
                          <span className={hasChange ? 'text-primary font-bold' : 'text-tertiary'}>
                            {hasChange ? `${current} → ${planned}` : current}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Academy upgrade hint */}
                  {academyUpgraded && (
                    <div className="px-3 py-1 text-xs text-cyan-400">
                      🏫 Academy upgrade Lv{realAcademyLevel} → Lv{effectiveAcademyLevel}: ₡{academyCostForCat.toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cost Summary — matching UpgradePlanner bottom panel */}
          {totalCost > 0 && (
            <div className="border-t border-white/10 pt-3 space-y-2">
              {totalAttrSavings > 0 && (
                <div className="bg-green-900/20 border border-green-700 rounded p-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-secondary">Original Attribute Cost:</span>
                    <span className="text-secondary line-through">₡{totalAttrBaseCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-300 font-semibold">Training Savings:</span>
                    <span className="text-success font-bold">-₡{totalAttrSavings.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {totalAttrCost > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Attribute Upgrades:</span>
                  <span className="text-warning font-semibold">₡{totalAttrCost.toLocaleString()}</span>
                </div>
              )}
              {uniqueAcademyCost > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-secondary">Academy Upgrades:</span>
                  <span className="text-cyan-400 font-semibold">₡{uniqueAcademyCost.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t border-white/10 pt-2">
                <span className="text-sm text-secondary font-semibold">Total Estimated Cost:</span>
                <span className="text-warning font-bold text-lg">₡{totalCost.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <button
                  onClick={() => onChange({ ...overrides, attributes: undefined, simulatedAcademyLevels: undefined })}
                  className="text-xs text-error hover:text-red-400 transition-colors"
                >
                  Reset All
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
