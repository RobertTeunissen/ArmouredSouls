import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
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
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  const MAX_ATTRIBUTE_LEVEL = 50;

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
  }, [id]);

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
        const trainingFacility = facilities.find((f: any) => f.facilityType === 'training_facility');
        if (trainingFacility) {
          setTrainingLevel(trainingFacility.level);
        }

        // Fetch academy levels for attribute caps
        setAcademyLevels({
          combat_training_academy: facilities.find((f: any) => f.facilityType === 'combat_training_academy')?.level || 0,
          defense_training_academy: facilities.find((f: any) => f.facilityType === 'defense_training_academy')?.level || 0,
          mobility_training_academy: facilities.find((f: any) => f.facilityType === 'mobility_training_academy')?.level || 0,
          ai_training_academy: facilities.find((f: any) => f.facilityType === 'ai_training_academy')?.level || 0,
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

  const handleWeaponChange = async (weaponInventoryId: string, slot: 'main' | 'offhand' = 'main') => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const bodyData: any = {};
      
      if (slot === 'main') {
        bodyData.mainWeaponId = weaponInventoryId === '' ? null : parseInt(weaponInventoryId);
      } else {
        bodyData.offhandWeaponId = weaponInventoryId === '' ? null : parseInt(weaponInventoryId);
      }

      const response = await fetch(`http://localhost:3001/api/robots/${id}/weapon`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to equip weapon');
      }

      setRobot(data.robot);
      setSuccessMessage(weaponInventoryId === '' ? 'Weapon unequipped!' : 'Weapon equipped successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to equip weapon');
      console.error(err);
    }
  };

  const handleLoadoutChange = async (newLoadoutType: string) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/robots/${id}/weapon`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ loadoutType: newLoadoutType }),
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change loadout type');
      }

      setRobot(data.robot);
      setSuccessMessage(`Loadout changed to ${newLoadoutType}!`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change loadout type');
      console.error(err);
    }
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
          <button
            onClick={() => navigate('/robots')}
            className="text-blue-400 hover:text-blue-300 mb-4"
          >
            ← Back to Robots
          </button>
          <h2 className="text-3xl font-bold">{robot.name}</h2>
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

        {/* Weapon Selection */}
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Weapon Loadout</h3>
          
          {/* Loadout Type Selection */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">Loadout Type</label>
            <select
              value={robot.loadoutType}
              onChange={(e) => handleLoadoutChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="single">Single Weapon</option>
              <option value="dual-wield">Dual Wield (Two Weapons)</option>
              <option value="weapon+shield">Weapon + Shield</option>
              <option value="two-handed">Two-Handed Weapon</option>
            </select>
            <div className="mt-2 p-3 bg-blue-900 bg-opacity-30 rounded border border-blue-700">
              <p className="text-xs text-blue-300">
                {robot.loadoutType === 'single' && 'One weapon for balanced combat'}
                {robot.loadoutType === 'dual-wield' && 'Two weapons for increased attack speed'}
                {robot.loadoutType === 'weapon+shield' && 'Weapon and shield for defensive play'}
                {robot.loadoutType === 'two-handed' && 'Two-handed weapon for maximum damage'}
              </p>
            </div>
          </div>

          {/* Main Weapon */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Main Weapon</label>
            <select
              value={robot.mainWeaponId || ''}
              onChange={(e) => handleWeaponChange(e.target.value, 'main')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">No Weapon</option>
              {weapons.map((weaponInv) => (
                <option key={weaponInv.id} value={weaponInv.id}>
                  {weaponInv.weapon.name} ({weaponInv.weapon.weaponType}) - Damage: {weaponInv.weapon.baseDamage}
                </option>
              ))}
            </select>
            {robot.mainWeapon && (
              <div className="mt-2 bg-gray-700 p-3 rounded text-sm">
                <p className="text-gray-300">{robot.mainWeapon.weapon.description}</p>
                <div className="mt-1 flex gap-4">
                  <span>Type: <span className="font-semibold capitalize">{robot.mainWeapon.weapon.weaponType}</span></span>
                  <span>Damage: <span className="font-semibold">{robot.mainWeapon.weapon.baseDamage}</span></span>
                </div>
              </div>
            )}
          </div>

          {/* Offhand Weapon */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Offhand Weapon (Optional)</label>
            <select
              value={robot.offhandWeaponId || ''}
              onChange={(e) => handleWeaponChange(e.target.value, 'offhand')}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">No Weapon</option>
              {weapons.map((weaponInv) => (
                <option key={weaponInv.id} value={weaponInv.id}>
                  {weaponInv.weapon.name} ({weaponInv.weapon.weaponType}) - Damage: {weaponInv.weapon.baseDamage}
                </option>
              ))}
            </select>
            {robot.offhandWeapon && (
              <div className="mt-2 bg-gray-700 p-3 rounded text-sm">
                <p className="text-gray-300">{robot.offhandWeapon.weapon.description}</p>
                <div className="mt-1 flex gap-4">
                  <span>Type: <span className="font-semibold capitalize">{robot.offhandWeapon.weapon.weaponType}</span></span>
                  <span>Damage: <span className="font-semibold">{robot.offhandWeapon.weapon.baseDamage}</span></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attributes */}
        {Object.entries(attributeCategories).map(([category, config]) => {
          const academyType = config.academy as keyof typeof academyLevels;
          const academyLevel = academyLevels[academyType];
          const attributeCap = 50 + (academyLevel * 5);

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
                  const attrDisplay = getAttributeDisplay(currentLevel, bonus);

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
                                <span className="text-gray-400"> = {attrDisplay.total}</span>
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
