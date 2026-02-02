import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import LoadoutSelector from '../components/LoadoutSelector';
import WeaponSlot from '../components/WeaponSlot';
import WeaponSelectionModal from '../components/WeaponSelectionModal';
import StanceSelector from '../components/StanceSelector';
import YieldThresholdSlider from '../components/YieldThresholdSlider';
import PerformanceStats from '../components/PerformanceStats';
import EffectiveStatsTable from '../components/EffectiveStatsTable';
import CompactUpgradeSection from '../components/CompactUpgradeSection';

interface Robot {
  id: number;
  name: string;
  userId: number;
  elo: number;
  currentLeague: string;
  leaguePoints: number;
  fame: number;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  mainWeapon: WeaponInventory | null;
  offhandWeapon: WeaponInventory | null;
  // 23 Core Attributes
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
  // Combat State
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  battleReadiness: number;
  repairCost: number;
  // Performance Tracking
  totalBattles: number;
  wins: number;
  draws: number;
  losses: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  kills: number;
  totalRepairsPaid: number;
  titles: string | null;
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
    let isFetching = false;
    let fetchTimeout: NodeJS.Timeout | null = null;

    const debouncedFetch = () => {
      // Clear any pending fetch
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }

      // Prevent multiple simultaneous fetches
      if (isFetching) {
        return;
      }

      // Debounce: wait 100ms to see if another event fires
      fetchTimeout = setTimeout(() => {
        isFetching = true;
        fetchRobotAndWeapons().finally(() => {
          isFetching = false;
        });
      }, 100);
    };

    // Initial fetch on mount
    debouncedFetch();

    // Re-fetch when page becomes visible (e.g., returning from Facilities page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        debouncedFetch();
      }
    };

    // Re-fetch when window regains focus (e.g., clicking back to this tab/window)
    const handleFocus = () => {
      debouncedFetch();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }
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
      console.log(`Fetching robot with ID: ${id}`);
      const robotResponse = await fetch(`http://localhost:3001/api/robots/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (robotResponse.status === 401) {
        console.log('Authentication failed, redirecting to login');
        logout();
        navigate('/login');
        return;
      }

      if (robotResponse.status === 404) {
        console.log(`Robot not found with ID: ${id}`);
        setError(`Robot with ID ${id} not found. It may have been deleted or you may not have permission to view it.`);
        setLoading(false);
        return;
      }

      if (!robotResponse.ok) {
        const errorData = await robotResponse.json().catch(() => ({}));
        console.error('Failed to fetch robot:', robotResponse.status, errorData);
        throw new Error(errorData.error || 'Failed to fetch robot');
      }

      const robotData = await robotResponse.json();
      console.log('Robot data received:', robotData.name);
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

  // Check if user owns this robot
  const isOwner = user && robot.userId === user.id;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Robot Header - Visible to All Users */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <button
              onClick={() => navigate('/robots')}
              className="text-blue-400 hover:text-blue-300"
            >
              ← Back to Robots
            </button>
            <button
              onClick={() => {
                setLoading(true);
                fetchRobotAndWeapons();
              }}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
              title="Refresh robot data"
            >
              🔄 Refresh
            </button>
          </div>
          
          {/* Robot Header Card */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-start gap-6">
              {/* Image Placeholder */}
              <div className="w-48 h-48 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <div className="text-center">
                  <div className="text-6xl mb-2">🤖</div>
                  <div className="text-gray-400 text-sm">Frame #{robot.frameId || 1}</div>
                </div>
              </div>
              
              {/* Robot Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-4">{robot.name}</h1>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400">ELO Rating:</span>
                    <span className="ml-2 text-white font-semibold">{robot.elo}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">League:</span>
                    <span className="ml-2 text-white font-semibold capitalize">{robot.currentLeague}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Win Rate:</span>
                    <span className="ml-2 text-white font-semibold">
                      {robot.totalBattles > 0 
                        ? ((robot.wins / robot.totalBattles) * 100).toFixed(1) 
                        : '0.0'}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Battles:</span>
                    <span className="ml-2 text-white font-semibold">{robot.totalBattles}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error and Success Messages */}
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

        {/* Performance & Statistics - Visible to All Users */}
        <div className="mb-6">
          <PerformanceStats robot={robot} />
        </div>

        {/* Owner-Only Sections */}
        {isOwner ? (
          <>
            {/* Battle Configuration Section */}
            <div className="bg-gray-800 p-6 rounded-lg mb-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                ⚔️ Battle Configuration
              </h2>

              {/* Current State Display */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-700 p-4 rounded-lg">
                <div>
                  <div className="text-gray-400 text-sm">Current HP</div>
                  <div className="text-xl font-semibold">
                    {robot.currentHP} / {robot.maxHP}
                    <span className="text-sm text-gray-400 ml-2">
                      ({Math.round((robot.currentHP / robot.maxHP) * 100)}%)
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Max HP = 50 + (Hull Integrity × 5)
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Energy Shield</div>
                  <div className="text-xl font-semibold">
                    {robot.maxShield}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Shield Capacity × 2
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Battle Readiness</div>
                  <div className="text-xl font-semibold">
                    {robot.battleReadiness}%
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Repair Cost</div>
                  <div className="text-xl font-semibold text-yellow-400">
                    ₡{robot.repairCost.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Weapon Loadout and Equipment */}
              <div className="mb-6">
                {/* Loadout Type Selector */}
                <LoadoutSelector
                  robotId={robot.id}
                  currentLoadout={robot.loadoutType}
                  onLoadoutChange={handleLoadoutChange}
                />
                
                {/* Weapon Slots */}
                <div className="mt-4">
                  <h4 className="text-md font-semibold mb-3">Equipped Weapons</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

              {/* Battle Stance */}
              <div className="mb-6">
                <StanceSelector
                  robotId={robot.id}
                  currentStance={robot.stance}
                  onStanceChange={(newStance) => {
                    setRobot({ ...robot, stance: newStance });
                    setSuccessMessage(`Stance updated to ${newStance}`);
                    setTimeout(() => setSuccessMessage(''), 3000);
                  }}
                />
              </div>

              {/* Yield Threshold */}
              <div>
                <YieldThresholdSlider
                  robotId={robot.id}
                  currentThreshold={robot.yieldThreshold}
                  robotAttributes={robot}
                  repairBayLevel={0}
                  onThresholdChange={(newThreshold) => {
                    setRobot({ ...robot, yieldThreshold: newThreshold });
                    setSuccessMessage(`Yield threshold updated to ${newThreshold}%`);
                    setTimeout(() => setSuccessMessage(''), 3000);
                  }}
                />
              </div>
            </div>

            {/* Effective Stats Overview */}
            <div className="mb-6">
              <EffectiveStatsTable robot={robot} />
            </div>

            {/* Upgrade Robot Section */}
            <CompactUpgradeSection
              categories={Object.entries(attributeCategories).map(([category, config]) => {
                const academyType = config.academy as keyof typeof academyLevels;
                const academyLevel = academyLevels[academyType];
                const attributeCap = getCapForLevel(academyLevel);
                
                return {
                  category,
                  attributes: config.attributes,
                  cap: attributeCap,
                  academyLevel,
                };
              })}
              robot={robot}
              trainingLevel={trainingLevel}
              currency={currency}
              onUpgrade={handleUpgrade}
              onNavigateToFacilities={() => navigate('/facilities')}
            />
          </>
        ) : (
          /* Non-Owner View */
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <p className="text-gray-400 text-lg">
              You can only view battle configuration and upgrades for your own robots.
            </p>
            <button
              onClick={() => navigate('/robots')}
              className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
            >
              View My Robots
            </button>
          </div>
        )}

        {/* Weapon Selection Modal */}
        {isOwner && (
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
        )}
      </div>
    </div>
  );
}

export default RobotDetailPage;
