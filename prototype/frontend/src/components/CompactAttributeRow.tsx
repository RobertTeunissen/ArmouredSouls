// React imported for JSX transform (no longer needed in React 18)
import { calculateAttributeBonus } from '../utils/robotStats';

interface WeaponInventory {
  id: number;
  weapon: {
    [key: string]: any;
  };
}

interface CompactAttributeRowProps {
  attributeKey: string;
  label: string;
  robot: {
    [key: string]: any;
    mainWeapon?: WeaponInventory | null;
    offhandWeapon?: WeaponInventory | null;
  };
  cap: number;
  trainingLevel: number;
  currency: number;
  onUpgrade: (attribute: string, currentLevel: number) => void;
}

function CompactAttributeRow({
  attributeKey,
  label,
  robot,
  cap,
  trainingLevel,
  currency,
  onUpgrade,
}: CompactAttributeRowProps) {
  const currentLevel = Math.floor(robot[attributeKey] as number);
  const weaponBonus = calculateAttributeBonus(attributeKey, robot.mainWeapon, robot.offhandWeapon);
  const effectiveValue = (currentLevel + weaponBonus).toFixed(2);

  // Calculate upgrade cost
  const baseCost = (currentLevel + 1) * 1000;
  const discountPercent = trainingLevel * 5;
  const upgradeCost = Math.floor(baseCost * (1 - discountPercent / 100));

  const canUpgrade = currentLevel < 50 && currentLevel < cap;
  const canAfford = currency >= upgradeCost;
  const atCap = currentLevel >= cap;

  const formatCost = (cost: number) => {
    if (cost >= 1000000) return `₡${(cost / 1000000).toFixed(1)}M`;
    if (cost >= 1000) return `₡${(cost / 1000).toFixed(0)}K`;
    return `₡${cost}`;
  };

  return (
    <div className="bg-gray-700 p-3 rounded flex items-center justify-between hover:bg-gray-650">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-300">{label}:</span>
          <span className="text-blue-400">{currentLevel}</span>
          {weaponBonus !== 0 && (
            <>
              <span className="text-green-400">(+{weaponBonus})</span>
              <span className="text-gray-500">=</span>
              <span className="text-white">{effectiveValue}</span>
            </>
          )}
          {atCap && currentLevel < 50 && (
            <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded ml-2">
              Cap Reached
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onUpgrade(attributeKey, currentLevel)}
        disabled={!canUpgrade || !canAfford || atCap}
        className={`px-4 py-2 rounded font-semibold text-sm transition-colors whitespace-nowrap ${
          canUpgrade && canAfford && !atCap
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
        title={
          atCap && currentLevel < 50
            ? 'Upgrade academy to increase cap'
            : !canUpgrade
            ? 'Max level reached'
            : !canAfford
            ? `Need ${formatCost(upgradeCost - currency)} more`
            : discountPercent > 0
            ? `Upgrade for ${formatCost(upgradeCost)} (${discountPercent}% Training Facility discount applied from base cost of ${formatCost(baseCost)})`
            : `Upgrade for ${formatCost(upgradeCost)}`
        }
      >
        {atCap && currentLevel < 50
          ? 'Upgrade Academy'
          : !canUpgrade
          ? 'Max Level'
          : !canAfford
          ? 'Not Enough Credits'
          : formatCost(upgradeCost)}
      </button>
    </div>
  );
}

export default CompactAttributeRow;
