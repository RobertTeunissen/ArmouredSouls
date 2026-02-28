import { useState, useMemo } from 'react';
import AttributeUpgradeRow from './AttributeUpgradeRow';
import ConfirmationModal from './ConfirmationModal';

interface Robot {
  id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface UpgradePlannerProps {
  robot: Robot;
  currentCredits: number;
  trainingLevel: number;
  academyLevels: {
    combat_training_academy: number;
    defense_training_academy: number;
    mobility_training_academy: number;
    ai_training_academy: number;
  };
  workshopLevel?: number; // Workshop level for additional discounts
  onCommit: (upgrades: UpgradePlan) => Promise<void>;
  onNavigateToFacilities: () => void;
}

interface AttributeUpgrade {
  currentLevel: number;
  plannedLevel: number;
  cost: number;
  baseCost: number; // Cost before discounts
}

interface UpgradePlan {
  [attributeName: string]: AttributeUpgrade;
}

// Category colors matching the design system
const categoryColors = {
  'Combat Systems': { bg: 'bg-red-900/30', text: 'text-red-400', icon: '⚔️' },
  'Defensive Systems': { bg: 'bg-blue-900/30', text: 'text-blue-400', icon: '🛡️' },
  'Chassis & Mobility': { bg: 'bg-green-900/30', text: 'text-green-400', icon: '⚙️' },
  'AI Processing': { bg: 'bg-yellow-900/30', text: 'text-yellow-400', icon: '🧠' },
  'Team Coordination': { bg: 'bg-purple-900/30', text: 'text-purple-400', icon: '🤝' },
};

// Attribute categories with their attributes and icons
const attributeCategories = {
  'Combat Systems': {
    academy: 'combat_training_academy',
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
    attributes: [
      { key: 'combatAlgorithms', label: 'Combat Algorithms', icon: '🧮' },
      { key: 'threatAnalysis', label: 'Threat Analysis', icon: '🔍' },
      { key: 'adaptiveAI', label: 'Adaptive AI', icon: '🤖' },
      { key: 'logicCores', label: 'Logic Cores', icon: '💻' },
    ],
  },
  'Team Coordination': {
    academy: 'ai_training_academy',
    attributes: [
      { key: 'syncProtocols', label: 'Sync Protocols', icon: '🔗' },
      { key: 'supportSystems', label: 'Support Systems', icon: '🆘' },
      { key: 'formationTactics', label: 'Formation Tactics', icon: '📐' },
    ],
  },
};

// Get cap for academy level
const getCapForLevel = (level: number): number => {
  const capMap: { [key: number]: number } = {
    0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
    5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
  };
  return capMap[level] || 10;
};

function UpgradePlanner({ 
  robot, 
  currentCredits, 
  trainingLevel,
  academyLevels,
  // workshopLevel — reserved for future weapon discount integration
  onCommit,
  onNavigateToFacilities
}: UpgradePlannerProps) {
  const [upgradePlan, setUpgradePlan] = useState<UpgradePlan>({});
  const [isCommitting, setIsCommitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Calculate base cost for a single level upgrade (before discounts)
  const calculateBaseCost = (currentLevel: number): number => {
    return (Math.floor(currentLevel) + 1) * 1500;
  };

  // Calculate cost for a single level upgrade with training facility discount
  const calculateUpgradeCost = (currentLevel: number): number => {
    const baseCost = calculateBaseCost(currentLevel);
    const trainingDiscountPercent = trainingLevel * 10; // 10% per training facility level, capped at 90%
    const trainingDiscount = trainingDiscountPercent / 100;
    
    // Apply training facility discount
    return Math.floor(baseCost * (1 - trainingDiscount));
  };

  // Calculate total cost for multiple levels
  const calculateTotalCostForAttribute = (currentLevel: number, plannedLevel: number): { cost: number; baseCost: number } => {
    let totalCost = 0;
    let totalBaseCost = 0;
    for (let level = currentLevel; level < plannedLevel; level++) {
      totalBaseCost += calculateBaseCost(level);
      totalCost += calculateUpgradeCost(level);
    }
    return { cost: totalCost, baseCost: totalBaseCost };
  };

  // Calculate total cost of all planned upgrades with debouncing
  const totalPlannedCost = useMemo(() => {
    return Object.values(upgradePlan).reduce((sum, upgrade) => sum + upgrade.cost, 0);
  }, [upgradePlan]);

  // Calculate total base cost (before discounts)
  const totalBaseCost = useMemo(() => {
    return Object.values(upgradePlan).reduce((sum, upgrade) => sum + upgrade.baseCost, 0);
  }, [upgradePlan]);

  // Calculate total savings from discounts
  const totalSavings = totalBaseCost - totalPlannedCost;

  // Calculate remaining credits
  const remainingCredits = currentCredits - totalPlannedCost;

  // Handle increment
  const handleIncrement = (attributeKey: string, categoryAcademy: string) => {
    const currentLevel = Math.floor(robot[attributeKey] as number);
    const academyLevel = academyLevels[categoryAcademy as keyof typeof academyLevels];
    const cap = getCapForLevel(academyLevel);
    
    const currentPlan = upgradePlan[attributeKey];
    const plannedLevel = currentPlan ? currentPlan.plannedLevel : currentLevel;

    // Check if at cap
    if (plannedLevel >= cap) {
      return;
    }

    const newPlannedLevel = plannedLevel + 1;
    const { cost: newCost, baseCost: newBaseCost } = calculateTotalCostForAttribute(currentLevel, newPlannedLevel);

    setUpgradePlan(prev => ({
      ...prev,
      [attributeKey]: {
        currentLevel,
        plannedLevel: newPlannedLevel,
        cost: newCost,
        baseCost: newBaseCost,
      },
    }));
  };

  // Handle decrement
  const handleDecrement = (attributeKey: string) => {
    const currentLevel = Math.floor(robot[attributeKey] as number);
    const currentPlan = upgradePlan[attributeKey];
    
    if (!currentPlan || currentPlan.plannedLevel <= currentLevel) {
      return;
    }

    const newPlannedLevel = currentPlan.plannedLevel - 1;

    if (newPlannedLevel === currentLevel) {
      // Remove from plan if back to current level
      const newPlan = { ...upgradePlan };
      delete newPlan[attributeKey];
      setUpgradePlan(newPlan);
    } else {
      const { cost: newCost, baseCost: newBaseCost } = calculateTotalCostForAttribute(currentLevel, newPlannedLevel);
      setUpgradePlan(prev => ({
        ...prev,
        [attributeKey]: {
          currentLevel,
          plannedLevel: newPlannedLevel,
          cost: newCost,
          baseCost: newBaseCost,
        },
      }));
    }
  };

  // Handle reset
  const handleReset = () => {
    setUpgradePlan({});
  };

  // Handle commit
  const handleCommit = async () => {
    if (totalPlannedCost > currentCredits) {
      return;
    }

    setIsCommitting(true);
    try {
      await onCommit(upgradePlan);
      setUpgradePlan({});
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Failed to commit upgrades:', error);
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle commit button click - show confirmation modal
  const handleCommitClick = () => {
    if (totalPlannedCost > currentCredits || !hasPlannedUpgrades) {
      return;
    }
    setShowConfirmModal(true);
  };

  const hasPlannedUpgrades = Object.keys(upgradePlan).length > 0;
  const canAfford = remainingCredits >= 0;

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        ⬆️ Upgrade Planner
      </h2>

      {/* Discount Information */}
      <div className="mb-4 space-y-2">
        {trainingLevel > 0 && (
          <div className="bg-green-900/20 border border-green-700 text-green-300 px-4 py-2 rounded flex items-center justify-between">
            <span className="font-semibold">Training Facility Discount:</span>
            <span>{trainingLevel * 10}%</span>
          </div>
        )}
      </div>

      {/* Attributes by Category - Grid Layout with Fixed Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
        {Object.entries(attributeCategories).map(([category, config]) => {
          const colors = categoryColors[category as keyof typeof categoryColors];
          const academyType = config.academy as keyof typeof academyLevels;
          const academyLevel = academyLevels[academyType];
          const cap = getCapForLevel(academyLevel);

          // Calculate total planned cost for this category
          const categoryPlannedCost = config.attributes.reduce((sum, attr) => {
            const plan = upgradePlan[attr.key];
            return sum + (plan ? plan.cost : 0);
          }, 0);

          // Calculate the height needed for the tallest category (6 attributes)
          const maxAttributes = 6;
          const attributeHeight = 'h-[42px]'; // Fixed height per attribute row

          return (
            <div key={category} className="space-y-2">
              {/* Category Header */}
              <div className={`${colors.bg} ${colors.text} px-3 py-2 rounded-lg`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{colors.icon}</span>
                  <span className="font-semibold text-sm">{category}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    Cap: {cap} (Academy Lv{academyLevel})
                  </span>
                  {categoryPlannedCost > 0 && (
                    <span className="font-semibold">
                      +₡{categoryPlannedCost.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Attributes in Category - Fixed Height Grid */}
              <div className="space-y-2">
                {config.attributes.map(({ key, label, icon }) => {
                  const currentLevel = Math.floor(robot[key] as number);
                  const plan = upgradePlan[key];
                  const plannedLevel = plan ? plan.plannedLevel : currentLevel;
                  const cost = plan ? plan.cost : 0;
                  const baseCost = plan ? plan.baseCost : 0;
                  const isAtCap = plannedLevel >= cap;
                  const hasPlannedChange = plannedLevel > currentLevel;

                  return (
                    <div key={key} className={attributeHeight}>
                      <AttributeUpgradeRow
                        attributeKey={key}
                        label={label}
                        icon={icon}
                        currentLevel={currentLevel}
                        plannedLevel={plannedLevel}
                        cost={cost}
                        baseCost={baseCost}
                        cap={cap}
                        isAtCap={isAtCap}
                        hasPlannedChange={hasPlannedChange}
                        onIncrement={() => handleIncrement(key, academyType)}
                        onDecrement={() => handleDecrement(key)}
                        compact={true}
                      />
                    </div>
                  );
                })}
                {/* Add empty spacers to maintain alignment */}
                {Array.from({ length: maxAttributes - config.attributes.length }).map((_, i) => (
                  <div key={`spacer-${i}`} className={attributeHeight} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cost Summary - Sticky Bottom Panel */}
      <div className="sticky bottom-0 bg-gray-900 border-t-2 border-gray-700 p-4 rounded-lg space-y-3">
        {/* Show original cost and savings if discounts apply */}
        {totalSavings > 0 && hasPlannedUpgrades && (
          <div className="bg-green-900/20 border border-green-700 rounded p-3 space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Original Cost:</span>
              <span className="text-gray-400 line-through">₡{totalBaseCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-300 font-semibold">Total Savings:</span>
              <span className="text-green-400 font-bold">-₡{totalSavings.toLocaleString()}</span>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center text-xl">
          <span className="text-gray-300 font-semibold">Total Planned Cost:</span>
          <span className="text-yellow-400 font-bold text-2xl">₡{totalPlannedCost.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center text-lg">
          <span className="text-gray-300">Current Credits:</span>
          <span className="text-white font-bold">₡{currentCredits.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-center text-xl border-t border-gray-700 pt-3">
          <span className="text-gray-300 font-semibold">Remaining Credits:</span>
          <span className={`font-bold ${remainingCredits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ₡{remainingCredits.toLocaleString()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-3">
          <button
            onClick={handleCommitClick}
            disabled={!hasPlannedUpgrades || !canAfford || isCommitting}
            className={`
              flex-1 py-3 rounded font-semibold transition-colors
              ${hasPlannedUpgrades && canAfford && !isCommitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {isCommitting ? 'Committing...' : 'Commit Upgrades'}
          </button>
          
          <button
            onClick={handleReset}
            disabled={!hasPlannedUpgrades || isCommitting}
            className={`
              px-6 py-3 rounded font-semibold transition-colors
              ${hasPlannedUpgrades && !isCommitting
                ? 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }
            `}
          >
            Reset Plan
          </button>
        </div>

        {!canAfford && hasPlannedUpgrades && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded text-sm">
            Insufficient credits. Remove some upgrades or visit the{' '}
            <button
              onClick={onNavigateToFacilities}
              className="underline hover:text-red-200"
            >
              Facilities page
            </button>
            {' '}to earn more credits.
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          title="Confirm Upgrades"
          message={
            <div className="space-y-3">
              <p className="text-gray-300">
                You are about to upgrade {Object.keys(upgradePlan).length} attribute{Object.keys(upgradePlan).length > 1 ? 's' : ''}:
              </p>
              <div className="bg-gray-900/50 rounded p-3 max-h-48 overflow-y-auto space-y-1">
                {Object.entries(upgradePlan).map(([attr, plan]) => {
                  const category = Object.entries(attributeCategories).find(([_, config]) =>
                    config.attributes.some(a => a.key === attr)
                  );
                  const attrConfig = category?.[1].attributes.find(a => a.key === attr);
                  return (
                    <div key={attr} className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        {attrConfig?.icon} {attrConfig?.label}
                      </span>
                      <span className="text-blue-400">
                        {plan.currentLevel} → {plan.plannedLevel}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between text-base">
                  <span className="text-gray-300">Total Cost:</span>
                  <span className="text-yellow-400 font-bold">₡{totalPlannedCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="text-gray-300">Remaining Credits:</span>
                  <span className={`font-bold ${remainingCredits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ₡{remainingCredits.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          }
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          onConfirm={handleCommit}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
}

export default UpgradePlanner;
