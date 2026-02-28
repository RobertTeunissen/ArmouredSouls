import {
  calculateAttributeBonus,
  getLoadoutBonus,
  calculateEffectiveStat,
} from '../utils/robotStats';

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

interface StatComparisonProps {
  robot: {
    loadoutType: string;
    mainWeapon?: WeaponInventory | null;
    offhandWeapon?: WeaponInventory | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
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
      <div className="text-gray-400 text-sm italic text-center py-4">
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
            className={`bg-gray-700 p-3 rounded ${
              breakdown.isModified ? 'border-l-4 border-blue-500' : ''
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-gray-300">{label}</span>
              <span className="text-lg font-bold text-white">{breakdown.effective}</span>
            </div>

            {breakdown.isModified && (
              <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                <span className="text-blue-400">Base: {breakdown.base}</span>

                {breakdown.hasWeaponBonus && (
                  <span
                    className={`${
                      breakdown.weapon > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    Weapon: {breakdown.weapon > 0 ? '+' : ''}
                    {breakdown.weapon}
                  </span>
                )}

                {breakdown.hasLoadoutBonus && (
                  <span
                    className={`${
                      breakdown.loadout > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    Loadout: {breakdown.loadout > 0 ? '+' : ''}
                    {Math.round(breakdown.loadout * 100)}%
                  </span>
                )}

                <span className="text-gray-500">→</span>
                <span className="text-white font-semibold">
                  Effective: {breakdown.effective}
                </span>
              </div>
            )}

            {!breakdown.isModified && (
              <div className="text-xs text-gray-500">
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
