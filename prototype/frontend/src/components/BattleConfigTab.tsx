import { useState } from 'react';
import LoadoutSelector from './LoadoutSelector';
import WeaponSlot from './WeaponSlot';
import StanceSelector from './StanceSelector';
import YieldThresholdSlider from './YieldThresholdSlider';
import WeaponSelectionModal from './WeaponSelectionModal';

interface Robot {
  id: number;
  name: string;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  battleReadiness: number;
  repairCost: number;
  loadoutType: string;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  stance: string;
  yieldThreshold: number;
  mainWeapon: WeaponInventory | null;
  offhandWeapon: WeaponInventory | null;
  [key: string]: any; // For other robot attributes
}

interface WeaponInventory {
  id: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    description: string | null;
    baseDamage: number;
  };
}

interface BattleConfigTabProps {
  robot: Robot;
  weapons: WeaponInventory[];
  onRobotUpdate: (updatedRobot: Partial<Robot>) => void;
  onEquipWeapon: (slot: 'main' | 'offhand', weaponInventoryId: number) => Promise<void>;
  onUnequipWeapon: (slot: 'main' | 'offhand') => Promise<void>;
}

function BattleConfigTab({ robot, weapons, onRobotUpdate, onEquipWeapon, onUnequipWeapon }: BattleConfigTabProps) {
  const [showWeaponModal, setShowWeaponModal] = useState(false);
  const [weaponSlotToEquip, setWeaponSlotToEquip] = useState<'main' | 'offhand'>('main');

  // Calculate HP percentage for color coding
  const hpPercent = (robot.currentHP / robot.maxHP) * 100;
  const getHPColor = (percent: number): string => {
    if (percent >= 70) return '#3fb950'; // Green
    if (percent >= 30) return '#d29922'; // Amber
    return '#f85149'; // Red
  };

  // Calculate shield percentage for color coding
  const shieldPercent = robot.maxShield > 0 ? (robot.currentShield / robot.maxShield) * 100 : 0;
  const getShieldColor = (percent: number): string => {
    if (percent >= 70) return '#3fb950'; // Green
    if (percent >= 30) return '#d29922'; // Amber
    return '#f85149'; // Red
  };

  // Battle readiness indicator
  const getBattleReadinessStatus = (): { text: string; color: string; icon: string } => {
    if (robot.battleReadiness >= 80) {
      return { text: 'Combat Ready', color: 'text-green-400', icon: '✓' };
    } else if (robot.battleReadiness >= 50) {
      return { text: 'Operational', color: 'text-yellow-400', icon: '⚠' };
    } else {
      return { text: 'Not Ready', color: 'text-red-400', icon: '✗' };
    }
  };

  const readinessStatus = getBattleReadinessStatus();

  const handleLoadoutChange = (newLoadout: string) => {
    onRobotUpdate({ loadoutType: newLoadout });
  };

  const handleStanceChange = (newStance: string) => {
    onRobotUpdate({ stance: newStance });
  };

  const handleThresholdChange = (newThreshold: number) => {
    onRobotUpdate({ yieldThreshold: newThreshold });
  };

  const handleEquipWeapon = async (weaponInventoryId: number) => {
    await onEquipWeapon(weaponSlotToEquip, weaponInventoryId);
    setShowWeaponModal(false);
  };

  const handleUnequipWeapon = async (slot: 'main' | 'offhand') => {
    await onUnequipWeapon(slot);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-6">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        ⚔️ Battle Configuration
        <span className="text-xs text-gray-400 font-normal">
          Configure your robot for combat
        </span>
      </h2>

      {/* Combat Status Panel - Direction B Aesthetic */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 bg-gradient-to-br from-gray-700 to-gray-750 p-5 rounded-lg border border-gray-600 shadow-lg">
        {/* HP Bar with Color Coding */}
        <div className="space-y-2">
          <div className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Hull Integrity</div>
          <div className="text-2xl font-bold" style={{ color: getHPColor(hpPercent) }}>
            {robot.currentHP} / {robot.maxHP}
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-600">
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{
                width: `${hpPercent}%`,
                backgroundColor: getHPColor(hpPercent),
              }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {Math.round(hpPercent)}% operational
          </div>
        </div>

        {/* Shield Bar with Color Coding */}
        <div className="space-y-2">
          <div className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Energy Shield</div>
          <div className="text-2xl font-bold" style={{ color: getShieldColor(shieldPercent) }}>
            {robot.currentShield} / {robot.maxShield}
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-600">
            <div
              className="h-full transition-all duration-300 ease-in-out"
              style={{
                width: `${shieldPercent}%`,
                backgroundColor: getShieldColor(shieldPercent),
              }}
            />
          </div>
          <div className="text-xs text-gray-400">
            {Math.round(shieldPercent)}% capacity
          </div>
        </div>

        {/* Battle Readiness Indicator */}
        <div className="space-y-2">
          <div className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Battle Status</div>
          <div className={`text-2xl font-bold ${readinessStatus.color}`}>
            {readinessStatus.icon} {robot.battleReadiness}%
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-600">
            <div
              className={`h-full transition-all duration-300 ease-in-out ${
                robot.battleReadiness >= 80 ? 'bg-green-500' :
                robot.battleReadiness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${robot.battleReadiness}%` }}
            />
          </div>
          <div className={`text-xs font-semibold ${readinessStatus.color}`}>
            {readinessStatus.text}
          </div>
        </div>

        {/* Repair Cost */}
        <div className="space-y-2">
          <div className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Repair Cost</div>
          <div className="text-2xl font-bold text-yellow-400">
            ₡{robot.repairCost.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-4">
            Current damage repair estimate
          </div>
        </div>
      </div>

      {/* Weapon Loadout Section */}
      <div className="mb-6">
        <LoadoutSelector
          robotId={robot.id}
          currentLoadout={robot.loadoutType}
          onLoadoutChange={handleLoadoutChange}
        />
        
        {/* Weapon Slots with Enhanced Display */}
        <div className="mt-4">
          <h4 className="text-md font-semibold mb-3 text-gray-300 uppercase tracking-wide">
            Equipped Weapons
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <WeaponSlot
              label="Main Weapon"
              weapon={robot.mainWeapon}
              onEquip={() => {
                setWeaponSlotToEquip('main');
                setShowWeaponModal(true);
              }}
              onUnequip={() => handleUnequipWeapon('main')}
            />
            {(robot.loadoutType === 'weapon_shield' || robot.loadoutType === 'dual_wield') && (
              <WeaponSlot
                label="Offhand Weapon"
                weapon={robot.offhandWeapon}
                onEquip={() => {
                  setWeaponSlotToEquip('offhand');
                  setShowWeaponModal(true);
                }}
                onUnequip={() => handleUnequipWeapon('offhand')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Battle Stance Section */}
      <div className="mb-6">
        <StanceSelector
          robotId={robot.id}
          currentStance={robot.stance}
          onStanceChange={handleStanceChange}
        />
      </div>

      {/* Yield Threshold Section */}
      <div>
        <YieldThresholdSlider
          robotId={robot.id}
          currentThreshold={robot.yieldThreshold}
          robotAttributes={robot}
          repairBayLevel={0}
          onThresholdChange={handleThresholdChange}
        />
      </div>

      {/* Weapon Selection Modal */}
      {showWeaponModal && (
        <WeaponSelectionModal
          isOpen={showWeaponModal}
          onClose={() => setShowWeaponModal(false)}
          onSelect={handleEquipWeapon}
          weapons={weapons}
          currentWeaponId={weaponSlotToEquip === 'main' ? robot.mainWeaponId : robot.offhandWeaponId}
          currentRobotId={robot.id}
          slot={weaponSlotToEquip}
          robotLoadoutType={robot.loadoutType}
        />
      )}
    </div>
  );
}

export default BattleConfigTab;
