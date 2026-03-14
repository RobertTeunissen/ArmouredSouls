/**
 * LoadoutSelectorEducational component
 * Wraps the existing LoadoutSelector component with educational tooltips
 * and explanations for the onboarding tutorial.
 * 
 * Features:
 * - Reuse existing LoadoutSelector for teaching loadout types
 * - Add educational tooltips explaining each option
 * - Provide context about loadout bonuses and restrictions
 * 
 * Requirements: 7.1-7.13, 11.1-11.11
 */

import { useState } from 'react';
import LoadoutSelector from '../LoadoutSelector';

interface LoadoutSelectorEducationalProps {
  robotId: number;
  currentLoadout: string;
  onLoadoutChange: (newLoadout: string) => void;
  showEducationalContent?: boolean;
  onEducationComplete?: () => void;
}

// Educational content for each loadout type
const LOADOUT_EDUCATION: Record<string, {
  title: string;
  description: string;
  whenToUse: string;
  keyBenefits: string[];
  considerations: string[];
}> = {
  single: {
    title: 'Single Weapon Loadout',
    description: 'Equip one weapon with balanced bonuses. A versatile choice for beginners.',
    whenToUse: 'Good starting point for learning the game mechanics',
    keyBenefits: [
      '+10% Gyro (stability)',
      '+5% Servo (responsiveness)',
      'No penalties',
      'Simple to manage',
    ],
    considerations: [
      'Not specialized for any particular strategy',
      'Lower bonuses than specialized loadouts',
      'Good all-around choice',
    ],
  },
  weapon_shield: {
    title: 'Weapon + Shield Loadout',
    description: 'Combine a weapon with a shield for defensive play. Excellent for survival-focused strategies.',
    whenToUse: 'Best for defensive strategies and minimizing damage taken',
    keyBenefits: [
      '+20% Shield (regenerating protection)',
      '+15% Armor (damage reduction)',
      'Shields regenerate automatically',
      'Synergizes with Defense Training Academy',
    ],
    considerations: [
      '-15% Attack Speed (slower attacks)',
      'Requires purchasing a shield',
      'Shield must be in offhand slot',
      'Best with defensive battle stance',
    ],
  },
  two_handed: {
    title: 'Two-Handed Weapon Loadout',
    description: 'Wield a large weapon with both hands for maximum damage output.',
    whenToUse: 'Best for aggressive strategies focused on dealing high damage',
    keyBenefits: [
      '+10% Power (base damage)',
      '+20% Critical Hit (burst damage)',
      '1.10× damage multiplier',
      'Highest damage potential',
    ],
    considerations: [
      '-10% Evasion (easier to hit)',
      'Occupies both weapon slots',
      'Cannot use shields or dual-wield',
      'Best with offensive battle stance',
    ],
  },
  dual_wield: {
    title: 'Dual-Wield Loadout',
    description: 'Equip two one-handed weapons for rapid attacks and high control.',
    whenToUse: 'Best for strategies focused on attack speed and control',
    keyBenefits: [
      '+30% Attack Speed (more attacks)',
      '+15% Control (accuracy)',
      'Two weapons = double attribute bonuses',
      'High action economy',
    ],
    considerations: [
      '-20% Penetration (reduced armor piercing)',
      '-10% Power (lower base damage)',
      'Requires two one-handed weapons',
      'Cannot use shields or two-handed weapons',
    ],
  },
};

/**
 * EducationalTooltip component
 * Displays educational information about a loadout type.
 */
const EducationalTooltip = ({ loadoutType }: { loadoutType: string }) => {
  const education = LOADOUT_EDUCATION[loadoutType];
  
  if (!education) return null;

  return (
    <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="text-primary mt-1">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-blue-300 mb-2">{education.title}</h4>
          <p className="text-sm text-secondary mb-3">{education.description}</p>
          
          <div className="mb-3">
            <div className="text-xs font-semibold text-secondary mb-1">When to Use:</div>
            <p className="text-xs text-secondary">{education.whenToUse}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-success mb-1">Key Benefits:</div>
              <ul className="space-y-1">
                {education.keyBenefits.map((benefit, index) => (
                  <li key={index} className="text-xs text-secondary flex items-start gap-1">
                    <span className="text-green-500">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold text-warning mb-1">Considerations:</div>
              <ul className="space-y-1">
                {education.considerations.map((consideration, index) => (
                  <li key={index} className="text-xs text-secondary flex items-start gap-1">
                    <span className="text-yellow-500">•</span>
                    <span>{consideration}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * LoadoutSelectorEducational component
 * Main wrapper component that adds educational content to LoadoutSelector.
 */
const LoadoutSelectorEducational = ({
  robotId,
  currentLoadout,
  onLoadoutChange,
  showEducationalContent = true,
  onEducationComplete,
}: LoadoutSelectorEducationalProps) => {
  const [selectedForEducation, setSelectedForEducation] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleLoadoutChange = (newLoadout: string) => {
    setHasInteracted(true);
    setSelectedForEducation(newLoadout);
    onLoadoutChange(newLoadout);
  };

  const handleContinue = () => {
    if (onEducationComplete) {
      onEducationComplete();
    }
  };

  return (
    <div className="space-y-6">
      {/* Educational introduction */}
      {showEducationalContent && (
        <div className="bg-surface rounded-lg border border-white/10 p-6">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            Understanding Loadout Types
          </h3>
          <p className="text-sm text-secondary mb-4">
            Your loadout type determines how weapons are equipped and what bonuses you receive in combat.
            Each loadout type has different strengths and is suited for different strategies.
          </p>
          
          <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-300 mb-2">💡 Key Concepts:</h4>
            <ul className="space-y-2 text-sm text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Main Hand:</strong> Primary weapon slot (always equipped)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Off Hand:</strong> Secondary slot (depends on loadout type)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Bonuses:</strong> Percentage increases applied to your robot's attributes during combat</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>Compatibility:</strong> Some weapons can only be used with specific loadout types</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Show educational tooltip for selected loadout */}
      {showEducationalContent && (selectedForEducation || currentLoadout) && (
        <EducationalTooltip loadoutType={selectedForEducation || currentLoadout} />
      )}

      {/* Existing LoadoutSelector component */}
      <div className="bg-surface rounded-lg border border-white/10 p-6">
        <LoadoutSelector
          robotId={robotId}
          currentLoadout={currentLoadout}
          onLoadoutChange={handleLoadoutChange}
        />
      </div>

      {/* Educational summary */}
      {showEducationalContent && (
        <div className="bg-surface rounded-lg border border-white/10 p-6">
          <h4 className="text-lg font-semibold mb-3">📋 Loadout Selection Tips</h4>
          <div className="space-y-3 text-sm text-secondary">
            <div className="flex items-start gap-2">
              <span className="text-success mt-1">✓</span>
              <div>
                <strong>For Beginners:</strong> Start with <strong>Single</strong> or <strong>Weapon+Shield</strong> loadouts.
                They're easier to manage and provide good survivability.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary mt-1">ℹ️</span>
              <div>
                <strong>Weapon Type Doesn't Matter:</strong> Energy, Ballistic, Melee, and Shield types are cosmetic.
                What matters is the <strong>loadout type</strong> and <strong>attribute bonuses</strong>.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-warning mt-1">⚠️</span>
              <div>
                <strong>Loadout Restrictions:</strong> Make sure your weapons are compatible with your chosen loadout.
                For example, shields can ONLY be equipped with Weapon+Shield loadout.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400 mt-1">💡</span>
              <div>
                <strong>Synergies:</strong> Combine your loadout with matching facilities (e.g., Defense Training Academy
                with Weapon+Shield) and battle stances for maximum effectiveness.
              </div>
            </div>
          </div>

          {/* Continue button */}
          {hasInteracted && onEducationComplete && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <button
                onClick={handleContinue}
                className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Continue to Weapon Selection →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick reference card */}
      {showEducationalContent && (
        <div className="bg-surface bg-opacity-50 rounded-lg border border-white/10 p-4">
          <h5 className="text-sm font-semibold text-secondary mb-3">Quick Reference: Loadout Types</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚔️</span>
              <div>
                <strong className="text-secondary">Single:</strong>
                <span className="text-secondary"> Balanced, beginner-friendly</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🛡️</span>
              <div>
                <strong className="text-secondary">Weapon+Shield:</strong>
                <span className="text-secondary"> Defensive, high survivability</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">🗡️</span>
              <div>
                <strong className="text-secondary">Two-Handed:</strong>
                <span className="text-secondary"> Aggressive, maximum damage</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg">⚔️⚔️</span>
              <div>
                <strong className="text-secondary">Dual-Wield:</strong>
                <span className="text-secondary"> Fast attacks, high control</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadoutSelectorEducational;
export { LOADOUT_EDUCATION };
