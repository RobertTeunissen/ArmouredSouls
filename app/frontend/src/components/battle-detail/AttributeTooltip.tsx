import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { AttributeTooltipProps } from './types';

/**
 * AttributeTooltip — info icon that shows which robot attributes influence a combat stat.
 *
 * Renders an ℹ️ icon that displays a tooltip on hover (desktop) or tap (mobile)
 * with two groups: "Attacker" and "Defender", listing attribute names with
 * category color coding and increase/decrease effect direction.
 *
 * Uses a portal to render the tooltip at the document body level so it is never
 * clipped by overflow containers (e.g. horizontally scrollable tables).
 */

/* ── Types ──────────────────────────────────────────────────────────── */

export interface AttributeEntry {
  attribute: string;
  label: string;
  category: 'combat' | 'defense' | 'chassis' | 'ai' | 'team';
  effect: 'increases' | 'decreases';
}

export interface StatAttributeMapping {
  attackerAttributes: AttributeEntry[];
  defenderAttributes: AttributeEntry[];
  description?: string;
}

/* ── Category colors ────────────────────────────────────────────────── */

const CATEGORY_COLORS: Record<AttributeEntry['category'], string> = {
  combat: 'text-error',
  defense: 'text-primary',
  chassis: 'text-success',
  ai: 'text-warning',
  team: 'text-info',
};

const CATEGORY_LABELS: Record<AttributeEntry['category'], string> = {
  combat: 'Combat',
  defense: 'Defense',
  chassis: 'Chassis',
  ai: 'AI',
  team: 'Team',
};

/* ── Stat → Attribute mapping ───────────────────────────────────────── */

export const STAT_ATTRIBUTE_MAP: Record<string, StatAttributeMapping> = {
  hitRate: {
    attackerAttributes: [
      { attribute: 'targetingSystems', label: 'Targeting Systems', category: 'combat', effect: 'increases' },
      { attribute: 'combatAlgorithms', label: 'Combat Algorithms', category: 'ai', effect: 'increases' },
      { attribute: 'adaptiveAI', label: 'Adaptive AI', category: 'ai', effect: 'increases' },
      { attribute: 'logicCores', label: 'Logic Cores', category: 'ai', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'evasionThrusters', label: 'Evasion Thrusters', category: 'defense', effect: 'decreases' },
      { attribute: 'gyroStabilizers', label: 'Gyro Stabilizers', category: 'chassis', effect: 'decreases' },
    ],
  },
  critRate: {
    attackerAttributes: [
      { attribute: 'criticalSystems', label: 'Critical Systems', category: 'combat', effect: 'increases' },
      { attribute: 'targetingSystems', label: 'Targeting Systems', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [],
  },
  critDamage: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'damageDampeners', label: 'Damage Dampeners', category: 'defense', effect: 'decreases' },
    ],
  },
  damage: {
    attackerAttributes: [
      { attribute: 'combatPower', label: 'Combat Power', category: 'combat', effect: 'increases' },
      { attribute: 'weaponControl', label: 'Weapon Control', category: 'combat', effect: 'increases' },
      { attribute: 'hydraulicSystems', label: 'Hydraulic Systems', category: 'chassis', effect: 'increases' },
      { attribute: 'adaptiveAI', label: 'Adaptive AI', category: 'ai', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'armorPlating', label: 'Armor Plating', category: 'defense', effect: 'decreases' },
      { attribute: 'shieldCapacity', label: 'Shield Capacity', category: 'defense', effect: 'decreases' },
      { attribute: 'damageDampeners', label: 'Damage Dampeners', category: 'defense', effect: 'decreases' },
    ],
  },
  malfunction: {
    attackerAttributes: [
      { attribute: 'weaponControl', label: 'Weapon Control', category: 'combat', effect: 'decreases' },
    ],
    defenderAttributes: [],
  },
  counterChance: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'counterProtocols', label: 'Counter Protocols', category: 'defense', effect: 'increases' },
    ],
  },
  attackSpeed: {
    attackerAttributes: [
      { attribute: 'attackSpeed', label: 'Attack Speed', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [],
    description: 'Reduces cooldown between attacks. Offhand cooldown is 40% longer.',
  },
  offhandHitRate: {
    attackerAttributes: [
      { attribute: 'targetingSystems', label: 'Targeting Systems', category: 'combat', effect: 'increases' },
      { attribute: 'combatAlgorithms', label: 'Combat Algorithms', category: 'ai', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'evasionThrusters', label: 'Evasion Thrusters', category: 'defense', effect: 'decreases' },
      { attribute: 'gyroStabilizers', label: 'Gyro Stabilizers', category: 'chassis', effect: 'decreases' },
    ],
    description: 'Offhand base hit chance is 50% (vs 70% for main hand).',
  },
  shieldRegen: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'powerCore', label: 'Power Core', category: 'chassis', effect: 'increases' },
    ],
    description: 'Defensive stance increases regen rate.',
  },
  shieldCapacity: {
    attackerAttributes: [],
    defenderAttributes: [
      { attribute: 'shieldCapacity', label: 'Shield Capacity', category: 'defense', effect: 'increases' },
    ],
    description: 'Shield absorbs damage before HP is affected.',
  },
  hitSeverity: {
    attackerAttributes: [
      { attribute: 'combatPower', label: 'Combat Power', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [],
    description: 'Glancing → Solid → Heavy → Devastating. Based on damage relative to defender max HP.',
  },
  penetration: {
    attackerAttributes: [
      { attribute: 'penetration', label: 'Penetration', category: 'combat', effect: 'increases' },
    ],
    defenderAttributes: [
      { attribute: 'armorPlating', label: 'Armor Plating', category: 'defense', effect: 'decreases' },
    ],
  },
};

/* ── Component ──────────────────────────────────────────────────────── */

export function AttributeTooltip({ statName }: AttributeTooltipProps) {
  const mapping = STAT_ATTRIBUTE_MAP[statName];
  if (!mapping) return null;

  const hasAttacker = mapping.attackerAttributes.length > 0;
  const hasDefender = mapping.defenderAttributes.length > 0;
  if (!hasAttacker && !hasDefender) return null;

  return <TooltipTrigger mapping={mapping} hasAttacker={hasAttacker} hasDefender={hasDefender} />;
}

/* ── Tooltip trigger + portal panel ─────────────────────────────────── */

function TooltipTrigger({
  mapping,
  hasAttacker,
  hasDefender,
}: {
  mapping: StatAttributeMapping;
  hasAttacker: boolean;
  hasDefender: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const panelWidth = panelRect.width || 224;
    const panelHeight = panelRect.height || 100;

    // Try above the trigger first
    let top = triggerRect.top - panelHeight - 6;
    // If it would go off the top, place below instead
    if (top < 8) {
      top = triggerRect.bottom + 6;
    }

    // Center horizontally on the trigger, clamp to viewport
    let left = triggerRect.left + triggerRect.width / 2 - panelWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

    setStyle({ position: 'fixed', top, left });
  }, []);

  // Position on open and reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    // Defer to next frame so panelRef is mounted and has dimensions
    const raf = requestAnimationFrame(updatePosition);

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="text-tertiary hover:text-secondary transition-colors duration-150 ease-out cursor-help p-0.5 inline-flex items-center"
        onClick={() => setIsOpen(prev => !prev)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        aria-label="Show attribute info"
      >
        <span className="text-xs" aria-hidden="true">ℹ️</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="z-[9999] w-56 bg-surface-elevated border border-tertiary/30 rounded-lg shadow-lg p-2.5 text-xs"
          style={style}
          role="tooltip"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          {mapping.description && (
            <div className={hasAttacker || hasDefender ? 'mb-2 text-secondary leading-relaxed' : 'text-secondary leading-relaxed'}>
              {mapping.description}
            </div>
          )}

          {hasAttacker && (
            <div className={hasDefender ? 'mb-2' : ''}>
              <div className="font-bold text-white mb-1">⚔️ Attacker</div>
              <ul className="space-y-0.5">
                {mapping.attackerAttributes.map(attr => (
                  <AttributeRow key={attr.attribute} entry={attr} />
                ))}
              </ul>
            </div>
          )}

          {hasDefender && (
            <div>
              <div className="font-bold text-white mb-1">🛡️ Defender</div>
              <ul className="space-y-0.5">
                {mapping.defenderAttributes.map(attr => (
                  <AttributeRow key={attr.attribute} entry={attr} />
                ))}
              </ul>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ── Attribute row ──────────────────────────────────────────────────── */

function AttributeRow({ entry }: { entry: AttributeEntry }) {
  const colorClass = CATEGORY_COLORS[entry.category];
  const categoryLabel = CATEGORY_LABELS[entry.category];
  const effectIcon = entry.effect === 'increases' ? '▲' : '▼';
  const effectColor = entry.effect === 'increases' ? 'text-success' : 'text-error';

  return (
    <li className="flex items-center gap-1.5">
      <span className={`${effectColor} text-[10px] leading-none`}>{effectIcon}</span>
      <span className={`${colorClass} font-medium`}>{entry.label}</span>
      <span className="text-tertiary ml-auto text-[10px]">{categoryLabel}</span>
    </li>
  );
}
