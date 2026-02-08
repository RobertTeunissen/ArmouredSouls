import { getWeaponImagePath } from '../utils/weaponImages';
import { calculateWeaponCooldown } from '../utils/weaponConstants';
import meleeIcon from '../assets/icons/weapon-types/melee.svg';
import ballisticIcon from '../assets/icons/weapon-types/ballistic.svg';
import energyIcon from '../assets/icons/weapon-types/energy.svg';
import shieldIcon from '../assets/icons/weapon-types/shield.svg';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  description: string;
  baseDamage: number;
  cost: number;
  combatPowerBonus: number;
  targetingSystemsBonus: number;
  criticalSystemsBonus: number;
  penetrationBonus: number;
  weaponControlBonus: number;
  attackSpeedBonus: number;
  armorPlatingBonus: number;
  shieldCapacityBonus: number;
  evasionThrustersBonus: number;
  counterProtocolsBonus: number;
  servoMotorsBonus: number;
  gyroStabilizersBonus: number;
  hydraulicSystemsBonus: number;
  powerCoreBonus: number;
  threatAnalysisBonus: number;
}

interface ComparisonModalProps {
  weapons: Weapon[];
  onClose: () => void;
  onPurchase: (weaponId: number) => void;
  onRemove: (weaponId: number) => void;
  userCurrency: number;
  weaponWorkshopLevel: number;
  storageIsFull: boolean;
  purchasingId: number | null;
}

function calculateDiscount(weaponWorkshopLevel: number): number {
  return weaponWorkshopLevel * 0.05;
}

function applyDiscount(cost: number, discount: number): number {
  return Math.round(cost * (1 - discount));
}

function getTotalAttributes(weapon: Weapon): number {
  return (
    weapon.combatPowerBonus +
    weapon.targetingSystemsBonus +
    weapon.criticalSystemsBonus +
    weapon.penetrationBonus +
    weapon.weaponControlBonus +
    weapon.attackSpeedBonus +
    weapon.armorPlatingBonus +
    weapon.shieldCapacityBonus +
    weapon.evasionThrustersBonus +
    weapon.counterProtocolsBonus +
    weapon.servoMotorsBonus +
    weapon.gyroStabilizersBonus +
    weapon.hydraulicSystemsBonus +
    weapon.powerCoreBonus +
    weapon.threatAnalysisBonus
  );
}

function calculateValueMetrics(weapon: Weapon, discountedCost: number) {
  const cooldownStr = calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage);
  const cooldown = parseFloat(cooldownStr);
  const dps = cooldown > 0 ? weapon.baseDamage / cooldown : 0;
  const totalAttributes = getTotalAttributes(weapon);

  return {
    costPerDamage: weapon.baseDamage > 0 ? discountedCost / weapon.baseDamage : 0,
    dpsPerThousand: dps > 0 ? dps / (discountedCost / 1000) : 0,
    attributeEfficiency: totalAttributes > 0 ? totalAttributes / (discountedCost / 1000) : 0,
    dps,
  };
}

function getWeaponTypeIcon(weaponType: string): string {
  switch (weaponType.toLowerCase()) {
    case 'melee': return meleeIcon;
    case 'ballistic': return ballisticIcon;
    case 'energy': return energyIcon;
    case 'shield': return shieldIcon;
    default: return meleeIcon;
  }
}

export default function ComparisonModal({
  weapons,
  onClose,
  onPurchase,
  onRemove,
  userCurrency,
  weaponWorkshopLevel,
  storageIsFull,
  purchasingId,
}: ComparisonModalProps) {
  const discount = calculateDiscount(weaponWorkshopLevel);
  
  // Calculate value metrics for all weapons
  const weaponsWithMetrics = weapons.map(weapon => {
    const discountedCost = applyDiscount(weapon.cost, discount);
    const metrics = calculateValueMetrics(weapon, discountedCost);
    return { weapon, discountedCost, metrics };
  });

  // Find best values
  const bestDamageValue = weaponsWithMetrics.reduce((best, current) => 
    current.metrics.costPerDamage > 0 && (best.metrics.costPerDamage === 0 || current.metrics.costPerDamage < best.metrics.costPerDamage) 
      ? current : best
  );

  const bestDPSValue = weaponsWithMetrics.reduce((best, current) => 
    current.metrics.dpsPerThousand > best.metrics.dpsPerThousand ? current : best
  );

  const bestAttributeValue = weaponsWithMetrics.reduce((best, current) => 
    current.metrics.attributeEfficiency > best.metrics.attributeEfficiency ? current : best
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Compare Weapons</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Comparison Grid */}
        <div className="p-6">
          <div className={`grid ${weapons.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-6`}>
            {weaponsWithMetrics.map(({ weapon, discountedCost, metrics }) => {
              const canAfford = userCurrency >= discountedCost;
              const cooldownStr = calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage);
              const cooldown = parseFloat(cooldownStr);
              const totalAttributes = getTotalAttributes(weapon);

              const isBestDamageValue = bestDamageValue.weapon.id === weapon.id && metrics.costPerDamage > 0;
              const isBestDPSValue = bestDPSValue.weapon.id === weapon.id && metrics.dpsPerThousand > 0;
              const isBestAttributeValue = bestAttributeValue.weapon.id === weapon.id && metrics.attributeEfficiency > 0;

              return (
                <div key={weapon.id} className="bg-gray-800 rounded-lg overflow-hidden">
                  {/* Weapon Image */}
                  <div className="bg-gray-700 p-4 flex items-center justify-center">
                    <img
                      src={getWeaponImagePath(weapon.name)}
                      alt={weapon.name}
                      className="w-32 h-32 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>

                  {/* Weapon Info */}
                  <div className="p-4 space-y-3">
                    {/* Name and Type */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <img src={getWeaponTypeIcon(weapon.weaponType)} alt="" className="w-5 h-5" />
                        <h3 className="text-lg font-bold text-white">{weapon.name}</h3>
                      </div>
                      <p className="text-sm text-gray-400">{weapon.weaponType} • {weapon.loadoutType}</p>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Base Damage:</span>
                        <span className="text-white font-semibold">{weapon.baseDamage}</span>
                      </div>
                      {cooldown > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Cooldown:</span>
                            <span className="text-white">{cooldownStr}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">DPS:</span>
                            <span className="text-white font-semibold">{metrics.dps.toFixed(1)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-400">Attributes:</span>
                        <span className="text-white">+{totalAttributes}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Cost:</span>
                        <div className="text-right">
                          {discount > 0 && (
                            <div className="text-xs text-gray-500 line-through">
                              ₡{weapon.cost.toLocaleString()}
                            </div>
                          )}
                          <div className={`font-semibold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                            ₡{discountedCost.toLocaleString()}
                            {discount > 0 && <span className="text-xs ml-1">(-{(discount * 100).toFixed(0)}%)</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Value Metrics */}
                    <div className="border-t border-gray-700 pt-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase">Value Analysis</p>
                      {metrics.costPerDamage > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">Cost/Damage:</span>
                          <span className={isBestDamageValue ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                            ₡{metrics.costPerDamage.toFixed(0)}
                            {isBestDamageValue && ' ⭐'}
                          </span>
                        </div>
                      )}
                      {metrics.dpsPerThousand > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">DPS/₡1K:</span>
                          <span className={isBestDPSValue ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                            {metrics.dpsPerThousand.toFixed(2)}
                            {isBestDPSValue && ' ⭐'}
                          </span>
                        </div>
                      )}
                      {metrics.attributeEfficiency > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400">Attrs/₡1K:</span>
                          <span className={isBestAttributeValue ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                            {metrics.attributeEfficiency.toFixed(2)}
                            {isBestAttributeValue && ' ⭐'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => onPurchase(weapon.id)}
                        disabled={!canAfford || storageIsFull || purchasingId === weapon.id}
                        className={`w-full py-2 px-4 rounded font-semibold ${
                          canAfford && !storageIsFull
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {purchasingId === weapon.id
                          ? 'Purchasing...'
                          : !canAfford
                          ? 'Insufficient Funds'
                          : storageIsFull
                          ? 'Storage Full'
                          : `Buy ₡${discountedCost.toLocaleString()}`}
                      </button>
                      <button
                        onClick={() => onRemove(weapon.id)}
                        className="w-full py-1 px-4 text-sm text-gray-400 hover:text-white underline"
                      >
                        Remove from comparison
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
