import {
  calculateAttributeBonus,
  getLoadoutBonus,
  calculateEffectiveStat,
} from '../utils/robotStats';
import type { RobotWithAttributes } from '../types/robot';

interface StatComparisonProps {
  robot: RobotWithAttributes;
  attributes: Array<{ key: string; label: string }>;
  showOnlyModified?: boolean;
}

function StatComparison({ robot, attributes, showOnlyModified = false }: StatComparisonProps) {
  const getStatBreakdown = (attributeKey: string) => {
    const baseValue = robot[attributeKey] as number;
    const weaponBonus = calculateAttributeBonus(attributeKey, robot.mainWeapon, robot.offhandWeapon);
    const loadoutBonus = getLoadoutBonus(robot.loadoutType, attributeKey);
    const effectiveValue = calculateEffectiveStat(baseValue, weaponBonus, loadoutBonus);

    return {
      base: baseValue,
      weapon: weaponBonus,
      loadout: loadoutBonus,
      effective: effectiveValue,
      hasWeaponBonus: weaponBonus !== 0,
      hasLoadoutBonus: loadoutBonus !== 0,
      isModified: weaponBonus !== 0 || loadoutBonus !== 0,
    };
  };

  const filteredAttributes = showOnlyModified
    ? attributes.filter((attr) => {
        const breakdown = getStatBreakdown(attr.key);
        return breakdown.isModified;
      })
    : attributes;

  if (filteredAttributes.length === 0 && showOnlyModified) {
    return (
      <div className="text-secondary text-sm italic text-center py-4">
        No attributes are currently modified by weapons or loadout
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredAttributes.map(({ key, label }) => {
        const breakdown = getStatBreakdown(key);

        return (
          <div
            key={key}
            className={`bg-surface-elevated p-3 rounded ${
              breakdown.isModified ? 'border-l-4 border-blue-500' : ''
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-secondary">{label}</span>
              <span className="text-lg font-bold text-white">{breakdown.effective}</span>
            </div>

            {breakdown.isModified && (
              <div className="text-xs text-secondary flex items-center gap-2 flex-wrap">
                <span className="text-primary">Base: {breakdown.base}</span>

                {breakdown.hasWeaponBonus && (
                  <span
                    className={`${
                      breakdown.weapon > 0 ? 'text-success' : 'text-error'
                    }`}
                  >
                    Weapon: {breakdown.weapon > 0 ? '+' : ''}
                    {breakdown.weapon}
                  </span>
                )}

                {breakdown.hasLoadoutBonus && (
                  <span
                    className={`${
                      breakdown.loadout > 0 ? 'text-success' : 'text-error'
                    }`}
                  >
                    Loadout: {breakdown.loadout > 0 ? '+' : ''}
                    {Math.round(breakdown.loadout * 100)}%
                  </span>
                )}

                <span className="text-tertiary">→</span>
                <span className="text-white font-semibold">
                  Effective: {breakdown.effective}
                </span>
              </div>
            )}

            {!breakdown.isModified && (
              <div className="text-xs text-tertiary">
                No modifications
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StatComparison;
