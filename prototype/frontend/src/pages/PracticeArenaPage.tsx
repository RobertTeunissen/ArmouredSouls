/**
 * PracticeArenaPage — Combat Simulation Lab
 *
 * Standalone 1v1 sandbox battle simulator. Players run consequence-free battles
 * against configurable AI sparring partners or their own robots. Reuses the
 * existing BattlePlaybackViewer for result display with "SIMULATION" styling.
 *
 * Requirements: 1.1, 1.2, 1.5, 3.1–3.6, 4.4, 6.2–6.4, 6.7, 7.1–7.7,
 *               8.1–8.8, 9.6, 11.2–11.10
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { BattlePlaybackViewer } from '../components/BattlePlaybackViewer/BattlePlaybackViewer';
import type {
  PlaybackCombatResult,
} from '../components/BattlePlaybackViewer/types';
import { usePracticeHistory, type PracticeHistoryEntry } from '../hooks/usePracticeHistory';
import RobotImage from '../components/RobotImage';
import apiClient from '../utils/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoadoutType = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
type Stance = 'offensive' | 'defensive' | 'balanced';
type RangeBand = 'melee' | 'short' | 'mid' | 'long';
type BotTier = 'WimpBot' | 'AverageBot' | 'ExpertBot' | 'UltimateBot';

interface OwnedRobot {
  id: number;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface SparringPartnerDef {
  botTier: BotTier;
  description: string;
  attributeLevel: number;
  priceTier: { min: number; max: number };
  loadoutOptions: string[];
  rangeBandOptions: string[];
  stanceOptions: string[];
}

interface SparringConfig {
  botTier: BotTier;
  loadoutType: LoadoutType;
  rangeBand: RangeBand;
  stance: Stance;
  yieldThreshold: number;
}

interface WhatIfOverrides {
  attributes?: Record<string, number>;
  loadoutType?: LoadoutType;
  stance?: Stance;
  yieldThreshold?: number;
  mainWeaponId?: number;
  offhandWeaponId?: number;
  /** Simulated academy level overrides (local to What-If, not sent to backend) */
  simulatedAcademyLevels?: Record<string, number>;
}

type SlotMode = 'owned' | 'sparring';

interface SlotState {
  mode: SlotMode;
  robotId: number | null;
  overrides: WhatIfOverrides;
  sparringConfig: SparringConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PracticeBattleResult {
  combatResult: PlaybackCombatResult;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  battleLog: any[];
  robot1Info: { name: string; maxHP: number; maxShield: number };
  robot2Info: { name: string; maxHP: number; maxShield: number };
}

interface PracticeBatchResult {
  results: PracticeBattleResult[];
  aggregate: {
    totalBattles: number;
    robot1Wins: number;
    robot2Wins: number;
    draws: number;
    avgDurationSeconds: number;
    avgRobot1DamageDealt: number;
    avgRobot2DamageDealt: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOT_TIER_DISPLAY: Record<BotTier, { name: string; emoji: string; color: string }> = {
  WimpBot: { name: 'WimpBot', emoji: '🤖', color: 'border-gray-500 bg-gray-800' },
  AverageBot: { name: 'AverageBot', emoji: '⚔️', color: 'border-blue-500 bg-blue-900/30' },
  ExpertBot: { name: 'ExpertBot', emoji: '🛡️', color: 'border-purple-500 bg-purple-900/30' },
  UltimateBot: { name: 'UltimateBot', emoji: '👑', color: 'border-yellow-500 bg-yellow-900/30' },
};

const LOADOUT_OPTIONS: { value: LoadoutType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'weapon_shield', label: 'Weapon & Shield' },
  { value: 'two_handed', label: 'Two-Handed' },
  { value: 'dual_wield', label: 'Dual Wield' },
];

const RANGE_OPTIONS: { value: RangeBand; label: string }[] = [
  { value: 'melee', label: 'Melee' },
  { value: 'short', label: 'Short' },
  { value: 'mid', label: 'Mid' },
  { value: 'long', label: 'Long' },
];

const STANCE_OPTIONS: { value: Stance; label: string; emoji: string }[] = [
  { value: 'offensive', label: 'Offensive', emoji: '⚡' },
  { value: 'defensive', label: 'Defensive', emoji: '🛡️' },
  { value: 'balanced', label: 'Balanced', emoji: '⚖️' },
];

const DEFAULT_SPARRING: SparringConfig = {
  botTier: 'AverageBot',
  loadoutType: 'single',
  rangeBand: 'melee',
  stance: 'balanced',
  yieldThreshold: 10,
};

function makeDefaultSlot(): SlotState {
  return {
    mode: 'owned',
    robotId: null,
    overrides: {},
    sparringConfig: { ...DEFAULT_SPARRING },
  };
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SlotToggle({ mode, onChange }: { mode: SlotMode; onChange: (m: SlotMode) => void }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      <button
        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          mode === 'owned' ? 'bg-primary text-white' : 'bg-surface text-secondary hover:bg-white/5'
        }`}
        onClick={() => onChange('owned')}
      >
        Deploy Robot
      </button>
      <button
        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
          mode === 'sparring' ? 'bg-primary text-white' : 'bg-surface text-secondary hover:bg-white/5'
        }`}
        onClick={() => onChange('sparring')}
      >
        Simulate Opponent
      </button>
    </div>
  );
}

function BotTierSelector({
  selected,
  definitions,
  onSelect,
}: {
  selected: BotTier;
  definitions: SparringPartnerDef[];
  onSelect: (t: BotTier) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {definitions.map((def) => {
        const display = BOT_TIER_DISPLAY[def.botTier as BotTier] ?? { name: def.botTier, emoji: '🤖', color: 'border-gray-500 bg-gray-800' };
        const isSelected = selected === def.botTier;
        return (
          <button
            key={def.botTier}
            onClick={() => onSelect(def.botTier)}
            className={`p-3 rounded-lg border-2 transition-all text-left ${
              isSelected
                ? `${display.color} ring-2 ring-primary`
                : 'border-white/10 bg-surface hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{display.emoji}</span>
              <span className="font-semibold text-sm">{display.name}</span>
            </div>
            <p className="text-xs text-secondary">Attr Level: {def.attributeLevel}</p>
            <p className="text-xs text-secondary">
              {def.botTier === 'WimpBot' ? 'Budget Tier Weapons' : def.botTier === 'AverageBot' ? 'Standard Tier Weapons' : def.botTier === 'ExpertBot' ? 'Premium Tier Weapons' : 'Luxury Tier Weapons'}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ConfigSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-surface border border-white/10 rounded px-3 py-2 text-sm text-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SparringConfigPanel({
  config,
  definitions,
  onChange,
}: {
  config: SparringConfig;
  definitions: SparringPartnerDef[];
  onChange: (c: SparringConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <BotTierSelector
        selected={config.botTier}
        definitions={definitions}
        onSelect={(t) => onChange({ ...config, botTier: t })}
      />
      <div className="grid grid-cols-2 gap-3">
        <ConfigSelect
          label="Loadout Type"
          value={config.loadoutType}
          options={LOADOUT_OPTIONS}
          onChange={(v) => onChange({ ...config, loadoutType: v })}
        />
        <ConfigSelect
          label="Range Band"
          value={config.rangeBand}
          options={RANGE_OPTIONS}
          onChange={(v) => onChange({ ...config, rangeBand: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ConfigSelect
          label="Stance"
          value={config.stance}
          options={STANCE_OPTIONS.map(s => ({ value: s.value, label: `${s.emoji} ${s.label}` }))}
          onChange={(v) => onChange({ ...config, stance: v })}
        />
        <div>
          <label className="block text-xs text-secondary mb-1">
            Yield Threshold: {config.yieldThreshold}%
          </label>
          <input
            type="range"
            min={0}
            max={50}
            value={config.yieldThreshold}
            onChange={(e) => onChange({ ...config, yieldThreshold: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
      <p className="text-xs text-secondary italic">
        🤖 AI-assigned loadout — weapons auto-selected based on tier and config
      </p>
    </div>
  );
}

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

/** Academy level → attribute cap */
const getCapForLevel = (level: number): number => {
  const capMap: Record<number, number> = { 0: 10, 1: 15, 2: 20, 3: 25, 4: 30, 5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50 };
  return capMap[level] || 10;
};

function WhatIfPanel({
  robot,
  overrides,
  onChange,
  trainingLevel,
  academyLevels,
}: {
  robot: OwnedRobot;
  overrides: WhatIfOverrides;
  onChange: (o: WhatIfOverrides) => void;
  trainingLevel: number;
  academyLevels: { combat_training_academy: number; defense_training_academy: number; mobility_training_academy: number; ai_training_academy: number };
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOverrides = Object.keys(overrides.attributes || {}).length > 0 ||
    overrides.stance || overrides.yieldThreshold !== undefined ||
    Object.keys(overrides.simulatedAcademyLevels || {}).length > 0;

  const trainingDiscountPercent = Math.min(trainingLevel * 10, 90);
  const trainingDiscount = trainingDiscountPercent / 100;

  // Academy costs: [100K, 200K, ..., 1M] for levels 1-10
  const ACADEMY_COSTS = [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000];

  // Effective academy level = real + simulated upgrades
  const getEffectiveAcademyLevel = (academyKey: string): number => {
    const real = academyLevels[academyKey as keyof typeof academyLevels] || 0;
    return overrides.simulatedAcademyLevels?.[academyKey] ?? real;
  };

  // Cost to upgrade academy from real to simulated level
  const getAcademyCost = (academyKey: string): number => {
    const real = academyLevels[academyKey as keyof typeof academyLevels] || 0;
    const simulated = overrides.simulatedAcademyLevels?.[academyKey] ?? real;
    let cost = 0;
    for (let level = real; level < simulated; level++) cost += ACADEMY_COSTS[level] || 0;
    return cost;
  };

  // Cost calculation with training facility discount (same as UpgradePlanner)
  const calculateBaseCost = (currentLevel: number): number => (Math.floor(currentLevel) + 1) * 1500;
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

  return (
    <div className="space-y-3">
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

          {/* Categories in rows — matching UpgradePlanner layout */}
          <div className="space-y-3">
            {Object.entries(WHATIF_CATEGORIES).map(([category, config]) => {
              const academyKey = config.academy;
              const realAcademyLevel = academyLevels[academyKey as keyof typeof academyLevels] || 0;
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


// ---------------------------------------------------------------------------
// Battle Slot Panel
// ---------------------------------------------------------------------------

function BattleSlotPanel({
  label,
  slot,
  robots,
  sparringDefs,
  onSlotChange,
  forceOwned = false,
  trainingLevel = 0,
  academyLevels = { combat_training_academy: 0, defense_training_academy: 0, mobility_training_academy: 0, ai_training_academy: 0 },
}: {
  label: string;
  slot: SlotState;
  robots: OwnedRobot[];
  sparringDefs: SparringPartnerDef[];
  onSlotChange: (s: SlotState) => void;
  forceOwned?: boolean;
  trainingLevel?: number;
  academyLevels?: { combat_training_academy: number; defense_training_academy: number; mobility_training_academy: number; ai_training_academy: number };
}) {
  const selectedRobot = robots.find((r) => r.id === slot.robotId) || null;

  return (
    <div className="bg-surface-elevated rounded-lg border border-white/10 p-4 space-y-4">
      <h3 className="text-lg font-semibold text-primary">{label}</h3>

      {!forceOwned && (
        <SlotToggle
          mode={slot.mode}
          onChange={(m) => onSlotChange({ ...slot, mode: m })}
        />
      )}

      {slot.mode === 'owned' ? (
        <div className="space-y-3">
          {/* Robot image grid selector */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {robots.map((r) => {
              const isSelected = slot.robotId === r.id;
              const hasNoWeapon = !r.mainWeaponId;
              return (
                <button
                  key={r.id}
                  onClick={() => onSlotChange({ ...slot, robotId: r.id, overrides: {} })}
                  className={`relative rounded-lg p-1 transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary bg-primary/10'
                      : 'hover:bg-white/5 border border-transparent hover:border-white/10'
                  }`}
                  title={hasNoWeapon ? `${r.name} — no weapon equipped` : r.name}
                >
                  <RobotImage
                    imageUrl={r.imageUrl ?? null}
                    robotName={r.name}
                    size="small"
                  />
                  <p className="text-xs text-center mt-1 truncate text-secondary">{r.name}</p>
                  {hasNoWeapon && (
                    <div className="absolute top-0 right-0 bg-error text-white text-xs rounded-full w-4 h-4 flex items-center justify-center" title="No weapon">!</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Weapon validation warning — shown immediately on selection */}
          {selectedRobot && !selectedRobot.mainWeaponId && (
            <div className="bg-red-900/30 border border-red-500/50 rounded p-3 text-sm text-red-400">
              ⚠️ {selectedRobot.name} has no weapon equipped. Equip a weapon before running a simulation.
            </div>
          )}

          {selectedRobot && selectedRobot.mainWeaponId && (
            <WhatIfPanel
              robot={selectedRobot}
              overrides={slot.overrides}
              onChange={(o) => onSlotChange({ ...slot, overrides: o })}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
            />
          )}
        </div>
      ) : (
        <SparringConfigPanel
          config={slot.sparringConfig}
          definitions={sparringDefs}
          onChange={(c) => onSlotChange({ ...slot, sparringConfig: c })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Banner — matches BattleDetailPage's result banner
// ---------------------------------------------------------------------------

function SimulationResultBanner({
  result,
  ownedRobotName,
}: {
  result: PracticeBattleResult;
  ownedRobotName?: string;
}) {
  const { combatResult, robot1Info, robot2Info } = result;
  const robot1Won = combatResult.robot1FinalHP > combatResult.robot2FinalHP;
  const winnerName = combatResult.isDraw ? null : (robot1Won ? robot1Info.name : robot2Info.name);

  let bannerText = '⚖️ DRAW';
  let bannerBg = 'bg-yellow-900/20 border-yellow-600';
  if (!combatResult.isDraw && ownedRobotName) {
    const playerWon = winnerName === ownedRobotName;
    bannerText = playerWon ? `🏆 ${winnerName} WINS` : `💀 ${winnerName} WINS`;
    bannerBg = playerWon ? 'bg-green-900/20 border-green-600' : 'bg-red-900/20 border-red-600';
  } else if (!combatResult.isDraw) {
    bannerText = `🏆 ${winnerName} WINS`;
    bannerBg = 'bg-green-900/20 border-green-600';
  }

  return (
    <div className={`p-3 rounded-lg text-center border-2 ${bannerBg}`}>
      <div className="text-2xl font-bold mb-1">{bannerText}</div>
      <div className="text-secondary text-sm">
        Simulation • Duration: {combatResult.durationSeconds}s
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch Summary — compact win/loss overview for batch runs
// ---------------------------------------------------------------------------

function BatchSummary({
  batch,
  ownedRobotName,
}: {
  batch: PracticeBatchResult;
  ownedRobotName?: string;
}) {
  const { aggregate } = batch;
  const robot1Name = batch.results[0]?.robot1Info.name || 'Robot 1';
  const robot2Name = batch.results[0]?.robot2Info.name || 'Robot 2';
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Determine win counts from player's perspective
  const playerName = ownedRobotName || robot1Name;
  const playerWins = batch.results.filter(r => {
    if (r.combatResult.isDraw) return false;
    const r1Won = r.combatResult.robot1FinalHP > r.combatResult.robot2FinalHP;
    const winner = r1Won ? r.robot1Info.name : r.robot2Info.name;
    return winner === playerName;
  }).length;
  const opponentWins = aggregate.totalBattles - playerWins - aggregate.draws;

  return (
    <div className="space-y-3">
      <div className="bg-surface rounded-lg p-3">
        <h3 className="text-lg font-semibold text-primary mb-2">
          📊 Batch Results ({aggregate.totalBattles} simulations)
        </h3>
        <div className="grid grid-cols-3 gap-3 text-sm text-center">
          <div className="bg-green-900/20 rounded p-2">
            <p className="text-success font-bold text-xl">{playerWins}</p>
            <p className="text-xs text-secondary">Wins</p>
          </div>
          <div className="bg-red-900/20 rounded p-2">
            <p className="text-error font-bold text-xl">{opponentWins}</p>
            <p className="text-xs text-secondary">Losses</p>
          </div>
          <div className="bg-surface-elevated rounded p-2">
            <p className="text-secondary font-bold text-xl">{aggregate.draws}</p>
            <p className="text-xs text-secondary">Draws</p>
          </div>
        </div>
        <p className="text-xs text-secondary text-center mt-2">
          Avg duration: {aggregate.avgDurationSeconds.toFixed(1)}s
        </p>
      </div>

      {/* Individual results — expandable, each shows the full BattlePlaybackViewer */}
      <div className="space-y-1">
        {batch.results.map((r, idx) => {
          const r1Won = r.combatResult.robot1FinalHP > r.combatResult.robot2FinalHP;
          const winnerIsPlayer = !r.combatResult.isDraw && (r1Won ? r.robot1Info.name : r.robot2Info.name) === playerName;
          return (
            <div key={idx} className="border border-white/10 rounded">
              <button
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/5 transition-colors"
              >
                <span>
                  {r.combatResult.isDraw ? '🤝' : winnerIsPlayer ? '🏆' : '💀'} Battle {idx + 1}
                </span>
                <span className="text-secondary">{r.combatResult.durationSeconds}s {expandedIdx === idx ? '▼' : '▶'}</span>
              </button>
              {expandedIdx === idx && (
                <div className="p-3 border-t border-white/10">
                  <BattlePlaybackViewer
                    battleResult={r.combatResult}
                    robot1Info={{
                      name: r.robot1Info.name,
                      teamIndex: 0,
                      maxHP: r.robot1Info.maxHP,
                      maxShield: r.robot1Info.maxShield,
                    }}
                    robot2Info={{
                      name: r.robot2Info.name,
                      teamIndex: 1,
                      maxHP: r.robot2Info.maxHP,
                      maxShield: r.robot2Info.maxShield,
                    }}
                    narrativeEvents={r.battleLog}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Panel
// ---------------------------------------------------------------------------

function HistoryPanel({
  results,
  onClear,
  ownedRobotName,
}: {
  results: PracticeHistoryEntry[];
  onClear: () => void;
  ownedRobotName?: string;
}) {
  if (results.length === 0) {
    return (
      <div className="text-sm text-secondary text-center py-4">
        No recent simulations
      </div>
    );
  }

  const getWinnerName = (entry: PracticeHistoryEntry): string | null => {
    if (entry.combatResult.isDraw) return null;
    // Use winnerId if available, fall back to HP comparison
    if (entry.combatResult.winnerId != null) {
      // winnerId is the robot's actual ID — negative for sparring partners
      // Since we don't store IDs in history, use HP comparison
    }
    if (entry.combatResult.robot1FinalHP > entry.combatResult.robot2FinalHP) return entry.robot1.name;
    if (entry.combatResult.robot2FinalHP > entry.combatResult.robot1FinalHP) return entry.robot2.name;
    // Both 0 or equal — treat as draw
    return null;
  };

  const getResultIcon = (entry: PracticeHistoryEntry): string => {
    if (entry.combatResult.isDraw) return '🤝';
    const winner = getWinnerName(entry);
    if (!winner) return '🤝';
    if (!ownedRobotName) return '🏆';
    return winner === ownedRobotName ? '🏆' : '💀';
  };

  const getResultColor = (entry: PracticeHistoryEntry): string => {
    if (entry.combatResult.isDraw) return 'text-secondary';
    const winner = getWinnerName(entry);
    if (!winner) return 'text-secondary';
    if (!ownedRobotName) return 'text-success';
    return winner === ownedRobotName ? 'text-success' : 'text-error';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wide">
          Recent Simulations
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-error hover:text-red-400 transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {[...results].reverse().map((entry, idx) => {
          const icon = getResultIcon(entry);
          const color = getResultColor(entry);
          const opponent = entry.robot1.name === ownedRobotName ? entry.robot2.name : entry.robot1.name;
          return (
            <div
              key={idx}
              className="bg-surface rounded p-2 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={color}>{icon}</span>
                <span className="text-primary truncate">vs {opponent}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-tertiary">{entry.combatResult.durationSeconds}s</span>
                <span className="text-secondary">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function PracticeArenaPage() {
  const { user } = useAuth();
  const userId = user?.id ?? 0;
  const { results: historyResults, addResult, clearHistory } = usePracticeHistory(userId);

  // Data
  const [robots, setRobots] = useState<OwnedRobot[]>([]);
  const [sparringDefs, setSparringDefs] = useState<SparringPartnerDef[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // Slots
  const [slot1, setSlot1] = useState<SlotState>(makeDefaultSlot());
  const [slot2, setSlot2] = useState<SlotState>(() => ({
    ...makeDefaultSlot(),
    mode: 'sparring',
  }));

  // Battle
  const [batchCount, setBatchCount] = useState(1);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [battleResult, setBattleResult] = useState<PracticeBattleResult | null>(null);
  const [batchResult, setBatchResult] = useState<PracticeBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cycle unavailability
  const [cycleOffline, setCycleOffline] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Facilities (for What-If cost calculations)
  const [trainingLevel, setTrainingLevel] = useState(0);
  const [academyLevels, setAcademyLevels] = useState({
    combat_training_academy: 0,
    defense_training_academy: 0,
    mobility_training_academy: 0,
    ai_training_academy: 0,
  });

  // Last config for re-run
  const lastConfigRef = useRef<{ slot1: SlotState; slot2: SlotState; count: number } | null>(null);

  // ---- Fetch initial data ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [robotsRes, sparringRes, facilitiesRes] = await Promise.all([
          apiClient.get('/api/robots'),
          apiClient.get('/api/practice-arena/sparring-partners'),
          apiClient.get('/api/facilities').catch(() => ({ data: [] })),
        ]);
        setRobots(robotsRes.data);
        const defs = sparringRes.data.sparringPartners || sparringRes.data;
        setSparringDefs(Array.isArray(defs) ? defs : []);

        // Parse facility levels for cost calculations
        const facilitiesData = facilitiesRes.data?.facilities || facilitiesRes.data;
        const facilities = Array.isArray(facilitiesData) ? facilitiesData : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tf = facilities.find((f: any) => f.type === 'training_facility');
        setTrainingLevel(tf?.currentLevel || 0);
        setAcademyLevels({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          combat_training_academy: facilities.find((f: any) => f.type === 'combat_training_academy')?.currentLevel || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          defense_training_academy: facilities.find((f: any) => f.type === 'defense_training_academy')?.currentLevel || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mobility_training_academy: facilities.find((f: any) => f.type === 'mobility_training_academy')?.currentLevel || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ai_training_academy: facilities.find((f: any) => f.type === 'ai_training_academy')?.currentLevel || 0,
        });
      } catch {
        // Silently handle — user can still configure sparring partners manually
      } finally {
        setLoadingInit(false);
      }
    };
    fetchData();
  }, []);

  // ---- Cycle polling cleanup ----
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const startCyclePoll = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        // Try a lightweight request to see if cycle is done
        await apiClient.get('/api/practice-arena/sparring-partners');
        setCycleOffline(false);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch {
        // Still offline
      }
    }, 15000);
  }, []);

  // ---- Build request payload ----
  const buildSlotPayload = (slot: SlotState) => {
    if (slot.mode === 'owned') {
      const payload: Record<string, unknown> = { type: 'owned', robotId: slot.robotId };
      const o = slot.overrides;
      if (o && (o.attributes || o.loadoutType || o.stance || o.yieldThreshold !== undefined || o.mainWeaponId || o.offhandWeaponId)) {
        // Strip simulatedAcademyLevels — it's local to the What-If UI, not sent to backend
        const { simulatedAcademyLevels: _ignored, ...backendOverrides } = o;
        payload.overrides = backendOverrides;
      }
      return payload;
    }
    return { type: 'sparring', config: slot.sparringConfig };
  };

  const isSlotValid = (slot: SlotState): boolean => {
    if (slot.mode === 'owned') {
      if (slot.robotId === null) return false;
      const robot = robots.find(r => r.id === slot.robotId);
      return !!robot?.mainWeaponId;
    }
    return true; // sparring always valid
  };

  const canRun = isSlotValid(slot1) && isSlotValid(slot2) && !running && !cycleOffline
    && (slot1.mode === 'owned' || slot2.mode === 'owned'); // At least one must be an owned robot

  // Get the owned robot's name for win/loss perspective
  const getOwnedRobotName = (): string | undefined => {
    if (slot1.mode === 'owned' && slot1.robotId) {
      return robots.find(r => r.id === slot1.robotId)?.name;
    }
    if (slot2.mode === 'owned' && slot2.robotId) {
      return robots.find(r => r.id === slot2.robotId)?.name;
    }
    return undefined;
  };
  const ownedRobotName = getOwnedRobotName();

  // ---- Run simulation ----
  const runSimulation = useCallback(async (s1: SlotState, s2: SlotState, count: number) => {
    setRunning(true);
    setError(null);
    setBattleResult(null);
    setBatchResult(null);
    setRunProgress(count > 1 ? `Simulating battle 1 of ${count}...` : 'Running combat simulation...');
    lastConfigRef.current = { slot1: s1, slot2: s2, count };

    try {
      const payload = {
        robot1: buildSlotPayload(s1),
        robot2: buildSlotPayload(s2),
        count,
      };

      const res = await apiClient.post('/api/practice-arena/battle', payload);
      const data = res.data;

      if (count > 1 && data.results) {
        // Batch result
        const batch = data as PracticeBatchResult;
        setBatchResult(batch);
        setBattleResult(batch.results[0] || null);

        // Store each result in history (up to cap)
        batch.results.forEach((r) => {
          addResult({
            timestamp: new Date().toISOString(),
            combatResult: {
              winnerId: r.combatResult.winnerId,
              robot1FinalHP: r.combatResult.robot1FinalHP,
              robot2FinalHP: r.combatResult.robot2FinalHP,
              robot1FinalShield: r.combatResult.robot1FinalShield ?? 0,
              robot2FinalShield: r.combatResult.robot2FinalShield ?? 0,
              robot1Damage: r.combatResult.robot1Damage ?? 0,
              robot2Damage: r.combatResult.robot2Damage ?? 0,
              robot1DamageDealt: r.combatResult.robot1DamageDealt ?? 0,
              robot2DamageDealt: r.combatResult.robot2DamageDealt ?? 0,
              durationSeconds: r.combatResult.durationSeconds,
              isDraw: r.combatResult.isDraw,
            },
            robot1: r.robot1Info,
            robot2: r.robot2Info,
          });
        });
      } else {
        // Single result
        const single = (data.results ? data.results[0] : data) as PracticeBattleResult;
        setBattleResult(single);

        addResult({
          timestamp: new Date().toISOString(),
          combatResult: {
            winnerId: single.combatResult.winnerId,
            robot1FinalHP: single.combatResult.robot1FinalHP,
            robot2FinalHP: single.combatResult.robot2FinalHP,
            robot1FinalShield: single.combatResult.robot1FinalShield ?? 0,
            robot2FinalShield: single.combatResult.robot2FinalShield ?? 0,
            robot1Damage: single.combatResult.robot1Damage ?? 0,
            robot2Damage: single.combatResult.robot2Damage ?? 0,
            robot1DamageDealt: single.combatResult.robot1DamageDealt ?? 0,
            robot2DamageDealt: single.combatResult.robot2DamageDealt ?? 0,
            durationSeconds: single.combatResult.durationSeconds,
            isDraw: single.combatResult.isDraw,
          },
          robot1: single.robot1Info,
          robot2: single.robot2Info,
        });
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const axiosErr = err as any;
        const status = axiosErr.response?.status;
        const data = axiosErr.response?.data;

        if (status === 503 && data?.code === 'CYCLE_IN_PROGRESS') {
          setCycleOffline(true);
          startCyclePoll();
          setError(null);
        } else if (status === 429) {
          const retrySeconds = data?.retryAfter || 900;
          const minutes = Math.ceil(retrySeconds / 60);
          const remaining = data?.remaining ?? 0;
          setError(`Rate limit reached (${remaining} battles remaining). Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
        } else {
          setError(data?.error || 'Simulation failed. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setRunning(false);
      setRunProgress('');
    }
  }, [addResult, startCyclePoll]);

  const handleRun = () => runSimulation(slot1, slot2, batchCount);

  const handleReRun = () => {
    if (lastConfigRef.current) {
      runSimulation(lastConfigRef.current.slot1, lastConfigRef.current.slot2, lastConfigRef.current.count);
    }
  };

  if (!user) return null;

  // ---- Render ----
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-primary font-header tracking-tight">
            ⚡ Combat Simulation Lab
          </h1>
          <p className="text-secondary text-sm max-w-xl mx-auto">
            Run predictive combat simulations to test configurations before entering the real arena
          </p>
        </div>

        {/* Cycle Offline Banner */}
        {cycleOffline && (
          <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 text-center">
            <p className="text-amber-400 font-semibold">
              ⚠️ Combat Simulation Lab is offline
            </p>
            <p className="text-amber-400/80 text-sm mt-1">
              Real arena battles are in progress. Simulations will resume shortly.
            </p>
            <p className="text-xs text-secondary mt-2">Auto-checking every 15 seconds...</p>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loadingInit ? (
          <div className="text-center py-12 text-secondary">Loading simulation lab...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main content: 3 cols */}
            <div className="lg:col-span-3 space-y-6">
              {/* Battle Slots */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BattleSlotPanel
                  label="🤖 Your Robot"
                  slot={slot1}
                  robots={robots}
                  sparringDefs={sparringDefs}
                  onSlotChange={setSlot1}
                  forceOwned={true}
                  trainingLevel={trainingLevel}
                  academyLevels={academyLevels}
                />
                <BattleSlotPanel
                  label="🎯 Opponent"
                  slot={slot2}
                  robots={robots}
                  sparringDefs={sparringDefs}
                  onSlotChange={setSlot2}
                  trainingLevel={trainingLevel}
                  academyLevels={academyLevels}
                />
              </div>

              {/* Run Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-secondary">Simulation runs:</label>
                  <select
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value))}
                    className="bg-surface border border-white/10 rounded px-3 py-2 text-sm text-primary"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleRun}
                  disabled={!canRun}
                  className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
                    canRun
                      ? 'bg-primary hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {running ? '⏳ Simulating...' : '⚡ Run Simulation'}
                </button>
              </div>

              {/* Loading Progress */}
              {running && (
                <div className="text-center text-secondary text-sm animate-pulse">
                  {runProgress}
                </div>
              )}

              {/* Batch Results */}
              {batchResult && batchResult.aggregate.totalBattles > 1 && (
                <BatchSummary batch={batchResult} ownedRobotName={ownedRobotName} />
              )}

              {/* Single Battle Result — reuses BattlePlaybackViewer exactly like BattleDetailPage */}
              {battleResult && (!batchResult || batchResult.aggregate.totalBattles <= 1) && (
                <div className="space-y-3">
                  <SimulationResultBanner result={battleResult} ownedRobotName={ownedRobotName} />

                  <div className="bg-surface p-3 rounded-lg relative">
                    <div className="absolute top-2 right-2 bg-cyan-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
                      SIMULATION
                    </div>
                    <h2 className="text-lg font-bold mb-2">Battle Playback</h2>
                    <BattlePlaybackViewer
                      battleResult={battleResult.combatResult}
                      robot1Info={{
                        name: battleResult.robot1Info.name,
                        teamIndex: 0,
                        maxHP: battleResult.robot1Info.maxHP,
                        maxShield: battleResult.robot1Info.maxShield,
                      }}
                      robot2Info={{
                        name: battleResult.robot2Info.name,
                        teamIndex: 1,
                        maxHP: battleResult.robot2Info.maxHP,
                        maxShield: battleResult.robot2Info.maxShield,
                      }}
                      narrativeEvents={battleResult.battleLog}
                    />
                  </div>

                  <div className="text-center">
                    <button
                      onClick={handleReRun}
                      disabled={running}
                      className="px-6 py-2 bg-surface border border-primary/50 text-primary rounded-lg hover:bg-primary/10 transition-colors text-sm"
                    >
                      🔄 Re-Run Simulation
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar: History (1 col) */}
            <div className="lg:col-span-1">
              <div className="bg-surface-elevated rounded-lg border border-white/10 p-4 sticky top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <HistoryPanel results={historyResults} onClear={clearHistory} ownedRobotName={ownedRobotName} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PracticeArenaPage;
