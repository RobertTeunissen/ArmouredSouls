import { useState } from 'react';
import { calculateAttributeBonus } from '../utils/robotStats';
import { formatCost } from '../utils/formatters';

interface WeaponInventory {
  id: number;
  weapon: {
    [key: string]: any;
  };
}

interface AttributeCategory {
  category: string;
  attributes: Array<{
    key: string;
    label: string;
  }>;
  cap: number;
  academyLevel: number;
}

interface CompactUpgradeSectionProps {
  categories: AttributeCategory[];
  robot: {
    [key: string]: any;
    mainWeapon?: WeaponInventory | null;
    offhandWeapon?: WeaponInventory | null;
  };
  trainingLevel: number;
  currency: number;
  onUpgrade: (attribute: string, currentLevel: number) => void;
  onNavigateToFacilities: () => void;
}

function CompactUpgradeSection({
  categories,
  robot,
  trainingLevel,
  currency,
  onUpgrade,
  onNavigateToFacilities,
}: CompactUpgradeSectionProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(categories[0]?.category || null);

  // formatCost imported from shared utils

  const getAttributeInfo = (attributeKey: string) => {
    const currentLevel = Math.floor(robot[attributeKey] as number);
    const weaponBonus = calculateAttributeBonus(attributeKey, robot.mainWeapon, robot.offhandWeapon);
    const baseCost = (currentLevel + 1) * 1500;
    const discountPercent = trainingLevel * 10;
    const upgradeCost = Math.floor(baseCost * (1 - discountPercent / 100));

    return {
      currentLevel,
      weaponBonus,
      upgradeCost,
      discountPercent,
    };
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        ⬆️ Upgrade Robot
      </h2>

      <div className="space-y-4">
        {categories.map(({ category, attributes, cap, academyLevel }) => {
          const isExpanded = expandedCategory === category;

          return (
            <div key={category} className="border border-gray-700 rounded-lg overflow-hidden">
              {/* Category Header - Clickable to expand/collapse */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full flex justify-between items-center p-4 bg-gray-750 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xl transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <h3 className="text-lg font-semibold text-blue-400">{category}</h3>
                  <span className="text-sm text-gray-400">
                    ({attributes.length} attributes)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className="text-gray-400">Cap: </span>
                    <span className="text-white font-semibold">{cap}/50</span>
                  </div>
                  {academyLevel < 10 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToFacilities();
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
                    >
                      Upgrade Academy
                    </button>
                  )}
                </div>
              </button>

              {/* Attributes Grid - Shown when expanded */}
              {isExpanded && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {attributes.map(({ key, label }) => {
                    const info = getAttributeInfo(key);
                    const nextLevel = info.currentLevel + 1;
                    const canUpgrade = nextLevel <= 50 && nextLevel <= cap;
                    const canAfford = currency >= info.upgradeCost;
                    const atCap = nextLevel > cap;

                    // Debug logging
                    if (key === 'combatPower' || key === 'armorPlating') {
                      console.log(`[${label}] current: ${info.currentLevel}, next: ${nextLevel}, cap: ${cap}, canUpgrade: ${canUpgrade}, atCap: ${atCap}`);
                    }

                    return (
                      <div
                        key={key}
                        className="bg-gray-700 p-3 rounded-lg hover:bg-gray-650 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-gray-300">{label}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-blue-400 font-bold">{info.currentLevel}</span>
                              {info.weaponBonus > 0 && (
                                <>
                                  <span className="text-green-400 text-xs">+{info.weaponBonus}</span>
                                  <span className="text-gray-500 text-xs">=</span>
                                  <span className="text-white text-xs">
                                    {(info.currentLevel + info.weaponBonus).toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {atCap && info.currentLevel < 50 && (
                            <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded">
                              Cap
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => onUpgrade(key, info.currentLevel)}
                          disabled={!canUpgrade || !canAfford || atCap}
                          className={`w-full px-3 py-2 rounded text-sm font-semibold transition-colors ${
                            canUpgrade && canAfford && !atCap
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                          title={
                            atCap && info.currentLevel < 50
                              ? 'Upgrade academy to increase cap'
                              : !canUpgrade
                              ? 'Max level reached'
                              : !canAfford
                              ? `Need ${formatCost(info.upgradeCost - currency)} more`
                              : info.discountPercent > 0
                              ? `Training Facility discount: ${info.discountPercent}% off`
                              : 'Upgrade attribute'
                          }
                        >
                          {atCap && info.currentLevel < 50
                            ? 'At Cap'
                            : !canUpgrade
                            ? 'Max'
                            : !canAfford
                            ? 'Not Enough'
                            : formatCost(info.upgradeCost)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CompactUpgradeSection;
