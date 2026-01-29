import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import LoadoutSelector from '../components/LoadoutSelector';
import WeaponSlot from '../components/WeaponSlot';
import WeaponSelectionModal from '../components/WeaponSelectionModal';
import StatComparison from '../components/StatComparison';
import { calculateAttributeBonus, getAttributeDisplay } from '../utils/robotStats';

interface Robot {
  id: number;
  name: string;
  elo: number;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  loadoutType: string;
  mainWeapon: WeaponInventory | null;
  offhandWeapon: WeaponInventory | null;
  combatPower: number;
  targetingSystems: number;
  criticalSystems: number;
  penetration: number;
  weaponControl: number;
  attackSpeed: number;
  armorPlating: number;
  shieldCapacity: number;
  evasionThrusters: number;
  damageDampeners: number;
  counterProtocols: number;
  hullIntegrity: number;
  servoMotors: number;
  gyroStabilizers: number;
  hydraulicSystems: number;
  powerCore: number;
  combatAlgorithms: number;
  threatAnalysis: number;
  adaptiveAI: number;
  logicCores: number;
  syncProtocols: number;
  supportSystems: number;
  formationTactics: number;
}

interface WeaponInventory {
  id: number;
  weapon: Weapon;
}

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  description: string | null;
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

function RobotDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [robot, setRobot] = useState<Robot | null>(null);
  const [weapons, setWeapons] = useState<WeaponInventory[]>([]);
  const [currency, setCurrency] = useState(0);
  const [trainingLevel, setTrainingLevel] = useState(0);
  const [academyLevels, setAcademyLevels] = useState({
    combat_training_academy: 0,
    defense_training_academy: 0,
    mobility_training_academy: 0,
    ai_training_academy: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showWeaponModal, setShowWeaponModal] = useState(false);
  const [weaponSlotToEquip, setWeaponSlotToEquip] = useState<'main' | 'offhand'>('main');
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const MAX_ATTRIBUTE_LEVEL = 50;

  // Get cap for academy level (from STABLE_SYSTEM.md)
  const getCapForLevel = (level: number): number => {
    const capMap: { [key: number]: number } = {
      0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
      5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50
    };
    return capMap[level] || 10;
  };

  const attributeCategories = {
    'Combat Systems': {
      academy: 'combat_training_academy',
      attributes: [
        { key: 'combatPower', label: 'Combat Power' },
        { key: 'targetingSystems', label: 'Targeting Systems' },
        { key: 'criticalSystems', label: 'Critical Systems' },
        { key: 'penetration', label: 'Penetration' },
        { key: 'weaponControl', label: 'Weapon Control' },
        { key: 'attackSpeed', label: 'Attack Speed' },
      ],
    },
    'Defensive Systems': {
      academy: 'defense_training_academy',
      attributes: [
        { key: 'armorPlating', label: 'Armor Plating' },
        { key: 'shieldCapacity', label: 'Shield Capacity' },
        { key: 'evasionThrusters', label: 'Evasion Thrusters' },
        { key: 'damageDampeners', label: 'Damage Dampeners' },
        { key: 'counterProtocols', label: 'Counter Protocols' },
      ],
    },
    'Chassis & Mobility': {
      academy: 'mobility_training_academy',
      attributes: [
        { key: 'hullIntegrity', label: 'Hull Integrity' },
        { key: 'servoMotors', label: 'Servo Motors' },
        { key: 'gyroStabilizers', label: 'Gyro Stabilizers' },
        { key: 'hydraulicSystems', label: 'Hydraulic Systems' },
        { key: 'powerCore', label: 'Power Core' },
      ],
    },
    'AI Processing': {
      academy: 'ai_training_academy',
      attributes: [
        { key: 'combatAlgorithms', label: 'Combat Algorithms' },
        { key: 'threatAnalysis', label: 'Threat Analysis' },
        { key: 'adaptiveAI', label: 'Adaptive AI' },
        { key: 'logicCores', label: 'Logic Cores' },
      ],
    },
    'Team Coordination': {
      academy: 'ai_training_academy',
      attributes: [
        { key: 'syncProtocols', label: 'Sync Protocols' },
        { key: 'supportSystems', label: 'Support Systems' },
        { key: 'formationTactics', label: 'Formation Tactics' },
      ],
    },
  };

  useEffect(() => {
    fetchRobotAndWeapons();

    // Re-fetch when page becomes visible (e.g., returning from Facilities page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchRobotAndWeapons();
      }
    };

    // Re-fetch when window regains focus (e.g., clicking back to this tab/window)
    const handleFocus = () => {
      fetchRobotAndWeapons();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [id, location]); // Re-fetch when route location changes

  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  const fetchRobotAndWeapons = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch robot details
      const robotResponse = await fetch(`http://localhost:3001/api/robots/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (robotResponse.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!robotResponse.ok) {
        throw new Error('Failed to fetch robot');
      }

      const robotData = await robotResponse.json();
      setRobot(robotData);

      // Fetch weapon inventory
      const weaponsResponse = await fetch('http://localhost:3001/api/weapon-inventory', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (weaponsResponse.ok) {
        const weaponsData = await weaponsResponse.json();
        setWeapons(weaponsData);
      }

      // Fetch training facility level
      const facilitiesResponse = await fetch('http://localhost:3001/api/facilities', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (facilitiesResponse.ok) {
        const facilities = await facilitiesResponse.json();
        
        // Always set training level (even if 0)
        const trainingFacility = facilities.find((f: any) => f.type === 'training_facility');
        setTrainingLevel(trainingFacility?.currentLevel || 0);

        // Always set academy levels (even if 0)
        setAcademyLevels({
          combat_training_academy: facilities.find((f: any) => f.type === 'combat_training_academy')?.currentLevel || 0,
          defense_training_academy: facilities.find((f: any) => f.type === 'defense_training_academy')?.currentLevel || 0,
          mobility_training_academy: facilities.find((f: any) => f.type === 'mobility_training_academy')?.currentLevel || 0,
          ai_training_academy: facilities.find((f: any) => f.type === 'ai_training_academy')?.currentLevel || 0,
        });
      }
    } catch (err) {
      setError('Failed to load robot details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (attribute: string, currentLevel: number) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    const baseCost = (currentLevel + 1) * 1000;
    const discountPercent = trainingLevel * 5;
    const upgradeCost = Math.floor(baseCost * (1 - discountPercent / 100));

    if (currency < upgradeCost) {
      setError('Insufficient credits for this upgrade');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/robots/${id}/upgrade`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ attribute }),
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade attribute');
      }

      setRobot(data.robot);
      setCurrency(data.currency);
      setSuccessMessage(`${attribute} upgraded to level ${currentLevel + 1}!`);
      
      // Refresh user data
      await refreshUser();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade attribute');
      console.error(err);
    }
  };

  const handleEquipWeapon = async (weaponInventoryId: number) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    try {
      const endpoint =
        weaponSlotToEquip === 'main'
          ? `http://localhost:3001/api/robots/${id}/equip-main-weapon`
          : `http://localhost:3001/api/robots/${id}/equip-offhand-weapon`;

      const response = await axios.put(endpoint, { weaponInventoryId });
      setRobot(response.data.robot);
      setSuccessMessage('Weapon equipped successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to equip weapon:', err);
      setError(err.response?.data?.error || 'Failed to equip weapon');
    }
  };

  const handleUnequipWeapon = async (slot: 'main' | 'offhand') => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    try {
      const endpoint =
        slot === 'main'
          ? `http://localhost:3001/api/robots/${id}/unequip-main-weapon`
          : `http://localhost:3001/api/robots/${id}/unequip-offhand-weapon`;

      const response = await axios.delete(endpoint);
      setRobot(response.data.robot);
      setSuccessMessage('Weapon unequipped!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to unequip weapon:', err);
      setError(err.response?.data?.error || 'Failed to unequip weapon');
    }
  };

  const handleLoadoutChange = (newLoadout: string) => {
    if (!robot) return;
    fetchRobotAndWeapons(); // Refresh to get updated robot data
    setSuccessMessage(`Loadout changed to ${newLoadout}!`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading robot details...</div>
      </div>
    );
  }

  if (!robot) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Robot not found</p>
          <button
            onClick={() => navigate('/robots')}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
          >
            Back to Robots
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => navigate('/robots')}
                className="text-blue-400 hover:text-blue-300 mb-4"
              >
                ← Back to Robots
              </button>
              <h2 className="text-3xl font-bold">{robot.name}</h2>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchRobotAndWeapons();
              }}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
              title="Refresh robot data and academy levels"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Currency Balance */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Credits Balance</h3>
            <div className="text-3xl font-bold text-green-400">
              ₡{currency.toLocaleString()}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded mb-6">
            {successMessage}
          </div>
        )}

        {/* Weapon Loadout */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Weapon Loadout</h3>
          
          {/* Loadout Type Selector */}
          <div className="mb-6">
            <LoadoutSelector
              robotId={robot.id}
              currentLoadout={robot.loadoutType}
              onLoadoutChange={handleLoadoutChange}
            />
          </div>

          {/* Weapon Slots */}
          <div className="space-y-4">
            <WeaponSlot
              label="Main Weapon"
              weapon={robot.mainWeapon}
              onEquip={() => {
                setWeaponSlotToEquip('main');
                setShowWeaponModal(true);
              }}
              onUnequip={() => handleUnequipWeapon('main')}
            />
            
            {/* Only show offhand slot for weapon_shield and dual_wield loadouts */}
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

        {/* Effective Stats Display */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Effective Stats (Modified by Weapons & Loadout)</h3>
          <StatComparison
            robot={robot}
            attributes={Object.values(attributeCategories).flatMap((cat) => cat.attributes)}
            showOnlyModified={true}
          />
        </div>

        {/* Weapon Selection Modal */}
        <WeaponSelectionModal
          isOpen={showWeaponModal}
          onClose={() => setShowWeaponModal(false)}
          onSelect={handleEquipWeapon}
          weapons={weapons}
          currentWeaponId={
            weaponSlotToEquip === 'main' ? robot.mainWeaponId : robot.offhandWeaponId
          }
          title={`Select ${weaponSlotToEquip === 'main' ? 'Main' : 'Offhand'} Weapon`}
          slot={weaponSlotToEquip}
          robotLoadoutType={robot.loadoutType}
        />

        {/* Attributes */}
        {Object.entries(attributeCategories).map(([category, config]) => {
          const academyType = config.academy as keyof typeof academyLevels;
          const academyLevel = academyLevels[academyType];
          const attributeCap = getCapForLevel(academyLevel);

          return (
            <div key={category} className="bg-gray-800 p-6 rounded-lg mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">{category}</h3>
                <div className="text-sm">
                  <span className="text-gray-400">Attribute Cap: </span>
                  <span className="text-blue-400 font-semibold">{attributeCap}</span>
                  {academyLevel === 0 && (
                    <span className="ml-2 text-xs text-yellow-400">
                      (Upgrade {category === 'Combat Systems' ? 'Combat' : 
                               category === 'Defensive Systems' ? 'Defense' : 
                               category === 'Chassis & Mobility' ? 'Mobility' : 
                               'AI'} Training Academy to increase)
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {config.attributes.map(({ key, label }) => {
                  const currentLevel = robot[key as keyof Robot] as number;
                  const baseCost = (currentLevel + 1) * 1000;
                  const discountPercent = trainingLevel * 5;
                  const upgradeCost = Math.floor(baseCost * (1 - discountPercent / 100));
                  const canUpgrade = currentLevel < MAX_ATTRIBUTE_LEVEL && currentLevel < attributeCap;
                  const canAfford = currency >= upgradeCost;
                  const atCap = currentLevel >= attributeCap;

                  // Calculate weapon bonuses
                  const bonus = calculateAttributeBonus(key, robot.mainWeapon, robot.offhandWeapon);
                  const loadoutBonus = 0; // No loadout bonus in attribute training section
                  const attrDisplay = getAttributeDisplay(currentLevel, bonus, loadoutBonus);

                  return (
                    <div key={key} className="bg-gray-700 p-4 rounded flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{label}</span>
                          <span className={`font-bold ${attrDisplay.hasBonus ? 'text-green-400' : 'text-blue-400'}`}>
                            {attrDisplay.hasBonus ? (
                              <>
                                <span className="text-blue-400">Level {currentLevel}</span>
                                <span className="text-green-400"> (+{bonus} from weapons)</span>
                                <span className="text-gray-400"> = {attrDisplay.effective}</span>
                              </>
                            ) : (
                              <>Level {currentLevel}</>
                            )}
                          </span>
                          {atCap && currentLevel < MAX_ATTRIBUTE_LEVEL && (
                            <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded">
                              Academy Cap Reached
                            </span>
                          )}
                        </div>
                        {canUpgrade && !atCap && (
                          <div className="text-sm text-gray-400 mt-1">
                            {discountPercent > 0 ? (
                              <>
                                <span className="line-through mr-2">₡{baseCost.toLocaleString()}</span>
                                <span className="text-green-400">₡{upgradeCost.toLocaleString()} ({discountPercent}% off)</span>
                              </>
                            ) : (
                              <>Upgrade Cost: ₡{upgradeCost.toLocaleString()}</>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleUpgrade(key, currentLevel)}
                        disabled={!canUpgrade || !canAfford || atCap}
                        className={`px-4 py-2 rounded font-semibold transition-colors ${
                          canUpgrade && canAfford && !atCap
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-gray-600 cursor-not-allowed'
                        }`}
                      >
                        {atCap && currentLevel < MAX_ATTRIBUTE_LEVEL
                          ? 'Upgrade Academy'
                          : !canUpgrade
                          ? 'Max Level'
                          : !canAfford
                          ? 'Not Enough Credits'
                          : `Upgrade (₡${upgradeCost.toLocaleString()})`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RobotDetailPage;
