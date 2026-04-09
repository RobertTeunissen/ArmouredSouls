/**
 * LoadoutDiagram component
 * Displays visual representation of weapon loadout types with slot configuration,
 * bonuses/penalties, and weapon compatibility restrictions.
 * 
 * Features:
 * - Display visual representation of each loadout type
 * - Show weapon slot configuration (main + offhand)
 * - Display loadout bonuses and penalties
 * - Highlight weapon compatibility restrictions
 * 
 * Requirements: 7.1-7.13, 10.1-10.14
 */

import { LOADOUT_BONUSES, formatLoadoutName, getLoadoutDescription } from '../../utils/robotStats';

export type LoadoutType = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';

interface LoadoutDiagramProps {
  loadoutType: LoadoutType;
  showDetails?: boolean;
  compact?: boolean;
}

// Loadout type icons
const LOADOUT_ICONS: Record<LoadoutType, string> = {
  single: '⚔️',
  weapon_shield: '🛡️',
  two_handed: '🗡️',
  dual_wield: '⚔️⚔️',
};

// Weapon slot configuration for each loadout type
const SLOT_CONFIGURATIONS: Record<LoadoutType, {
  mainSlot: string;
  offhandSlot: string;
  description: string;
  restrictions: string[];
}> = {
  single: {
    mainSlot: 'One-handed weapon',
    offhandSlot: 'Empty',
    description: 'One weapon equipped, balanced bonuses',
    restrictions: [
      'Main slot: Any one-handed weapon',
      'Offhand slot: Empty (no weapon)',
    ],
  },
  weapon_shield: {
    mainSlot: 'One-handed weapon',
    offhandSlot: 'Shield',
    description: 'Weapon + shield for defensive play',
    restrictions: [
      'Main slot: Any one-handed weapon',
      'Offhand slot: Shield ONLY',
      'Shields cannot be equipped in main slot',
    ],
  },
  two_handed: {
    mainSlot: 'Two-handed weapon',
    offhandSlot: 'Occupied by main weapon',
    description: 'Large weapon for high damage output',
    restrictions: [
      'Main slot: Two-handed weapon ONLY',
      'Offhand slot: Automatically occupied',
      'Cannot equip any other weapon',
    ],
  },
  dual_wield: {
    mainSlot: 'One-handed weapon',
    offhandSlot: 'One-handed weapon',
    description: 'Two weapons for fast attacks',
    restrictions: [
      'Main slot: One-handed weapon',
      'Offhand slot: One-handed weapon',
      'Both weapons must be one-handed',
      'Shields cannot be equipped',
    ],
  },
};

/**
 * WeaponSlotVisual component
 * Displays a visual representation of a weapon slot.
 */
const WeaponSlotVisual = ({ label, content, isOccupied }: { 
  label: string; 
  content: string; 
  isOccupied: boolean;
}) => {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-secondary mb-1">{label}</div>
      <div 
        className={`
          w-20 h-20 rounded-lg border-2 flex items-center justify-center text-2xl
          ${isOccupied 
            ? 'border-blue-500 bg-blue-900 bg-opacity-30' 
            : 'border-gray-600 bg-surface bg-opacity-50'
          }
        `}
      >
        {isOccupied ? content : '—'}
      </div>
      <div className="text-xs text-secondary mt-1 text-center max-w-[80px]">
        {content}
      </div>
    </div>
  );
};

/**
 * BonusDisplay component
 * Displays loadout bonuses and penalties.
 */
const BonusDisplay = ({ bonuses }: { bonuses: Record<string, number> }) => {
  const formatBonus = (value: number): { text: string; isPositive: boolean } => {
    const percent = Math.round(value * 100);
    return {
      text: `${percent > 0 ? '+' : ''}${percent}%`,
      isPositive: value > 0,
    };
  };

  return (
    <div className="space-y-1">
      {Object.entries(bonuses).map(([attr, value]) => {
        const bonus = formatBonus(value);
        return (
          <div key={attr} className="flex justify-between text-sm">
            <span className="text-secondary capitalize">
              {attr.replace(/([A-Z])/g, ' $1').trim()}:
            </span>
            <span className={`font-medium ${bonus.isPositive ? 'text-success' : 'text-error'}`}>
              {bonus.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * LoadoutDiagram component
 * Main component for displaying loadout type diagrams.
 */
const LoadoutDiagram = ({ loadoutType, showDetails = true, compact = false }: LoadoutDiagramProps) => {
  const icon = LOADOUT_ICONS[loadoutType];
  const config = SLOT_CONFIGURATIONS[loadoutType];
  const bonuses = LOADOUT_BONUSES[loadoutType];
  const name = formatLoadoutName(loadoutType);
  const description = getLoadoutDescription(loadoutType);

  // Determine which slots are occupied
  const mainOccupied = true; // Main slot always has something in these diagrams
  const offhandOccupied = loadoutType !== 'single';

  if (compact) {
    return (
      <div className="bg-surface rounded-lg border border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <h4 className="font-bold text-base">{name}</h4>
            <p className="text-xs text-secondary">{description}</p>
          </div>
        </div>

        {/* Weapon slots */}
        <div className="flex justify-center gap-4 mb-3">
          <WeaponSlotVisual 
            label="Main Hand" 
            content={config.mainSlot}
            isOccupied={mainOccupied}
          />
          <WeaponSlotVisual 
            label="Off Hand" 
            content={config.offhandSlot}
            isOccupied={offhandOccupied}
          />
        </div>

        {/* Bonuses */}
        {bonuses && Object.keys(bonuses).length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <h5 className="text-xs font-semibold text-secondary mb-2">Combat Bonuses</h5>
            <BonusDisplay bonuses={bonuses} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-white/10 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="text-5xl">{icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1">{name}</h3>
          <p className="text-sm text-secondary">{description}</p>
        </div>
      </div>

      {/* Weapon slot configuration */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-secondary mb-3">Weapon Slot Configuration</h4>
        <div className="flex justify-center gap-8 p-4 bg-surface bg-opacity-50 rounded-lg">
          <WeaponSlotVisual 
            label="Main Hand" 
            content={config.mainSlot}
            isOccupied={mainOccupied}
          />
          <div className="flex items-center text-gray-600 text-2xl">+</div>
          <WeaponSlotVisual 
            label="Off Hand" 
            content={config.offhandSlot}
            isOccupied={offhandOccupied}
          />
        </div>
        <p className="text-xs text-secondary mt-2 text-center">{config.description}</p>
      </div>

      {showDetails && (
        <>
          {/* Combat bonuses */}
          {bonuses && Object.keys(bonuses).length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-secondary mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Combat Bonuses & Penalties
              </h4>
              <div className="p-4 bg-surface bg-opacity-50 rounded-lg">
                <BonusDisplay bonuses={bonuses} />
              </div>
              <p className="text-xs text-secondary mt-2">
                These bonuses are applied during combat and scale with your robot's attributes.
              </p>
            </div>
          )}

          {/* Weapon compatibility restrictions */}
          <div>
            <h4 className="text-sm font-semibold text-secondary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Weapon Compatibility
            </h4>
            <div className="p-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg">
              <ul className="space-y-2">
                {config.restrictions.map((restriction, index) => (
                  <li key={index} className="text-sm text-secondary flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>{restriction}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LoadoutDiagram;
export { SLOT_CONFIGURATIONS };
