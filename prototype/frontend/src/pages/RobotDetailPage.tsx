import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import TabNavigation from '../components/TabNavigation';
import BattleConfigTab from '../components/BattleConfigTab';
import PerformanceStats from '../components/PerformanceStats';
import EffectiveStatsDisplay from '../components/EffectiveStatsDisplay';
import CompactUpgradeSection from '../components/CompactUpgradeSection';
import RobotImage from '../components/RobotImage';
import RobotImageSelector from '../components/RobotImageSelector';
import StatisticalRankings from '../components/StatisticalRankings';
import PerformanceByContext from '../components/PerformanceByContext';
import RecentBattles from '../components/RecentBattles';
import UpcomingMatches from '../components/UpcomingMatches';
import UpgradePlanner from '../components/UpgradePlanner';
import Toast from '../components/Toast';
import { getMatchHistory } from '../utils/matchmakingApi';

interface Robot {
  id: number;
  name: string;
  userId: number;
  imageUrl: string | null;
  elo: number;
  currentLeague: string;
  leagueId: string;
  leaguePoints: number;
  fame: number;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  mainWeapon: WeaponInventory | null;
  offhandWeapon: WeaponInventory | null;
  user?: {
    username: string;
    stableName: string | null;
  };
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
  loadoutType: string;
  handsRequired: string;
  description: string | null;
  baseDamage: number;
  cooldown: number;
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [recentBattles, setRecentBattles] = useState<any[]>([]);
  const [battleReadiness, setBattleReadiness] = useState<any>({ isReady: true, warnings: [] });
  const [leagueRank, setLeagueRank] = useState<{ rank: number; total: number; percentile: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Tab state management from URL
  const tabParam = searchParams.get('tab') as 'overview' | 'matches' | 'battle-config' | 'upgrades' | 'stats' | null;
  const activeTab = tabParam || 'overview';

  const handleTabChange = (tab: 'overview' | 'matches' | 'battle-config' | 'upgrades' | 'stats') => {
    setSearchParams({ tab });
  };

  // Max attribute level cap (from STABLE_SYSTEM.md)
  // const MAX_ATTRIBUTE_LEVEL = 50;

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

      // Fetch league rank for this robot
      try {
        const leagueResponse = await fetch(`http://localhost:3001/api/leagues/${robotData.currentLeague}/standings?instance=${robotData.leagueId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (leagueResponse.ok) {
          const leagueData = await leagueResponse.json();
          const standings = leagueData.data || [];
          const robotIndex = standings.findIndex((r: any) => r.id === parseInt(id!));
          
          if (robotIndex !== -1) {
            const rank = robotIndex + 1;
            const total = standings.length;
            const percentile = total > 0 ? ((total - rank) / total) * 100 : 0;
            setLeagueRank({ rank, total, percentile });
          }
        }
      } catch (leagueError) {
        console.error('Failed to fetch league rank:', leagueError);
        // Don't fail the entire page if league rank fails
      }

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
        const data = await facilitiesResponse.json();
        const facilities = data.facilities || data; // Handle both response formats
        console.log('Facilities API Response:', data);
        console.log('Facilities Array:', facilities);
        
        // Always set training level (even if 0)
        const trainingFacility = facilities.find((f: any) => f.type === 'training_facility');
        setTrainingLevel(trainingFacility?.currentLevel || 0);

        // Always set academy levels (even if 0)
        const newAcademyLevels = {
          combat_training_academy: facilities.find((f: any) => f.type === 'combat_training_academy')?.currentLevel || 0,
          defense_training_academy: facilities.find((f: any) => f.type === 'defense_training_academy')?.currentLevel || 0,
          mobility_training_academy: facilities.find((f: any) => f.type === 'mobility_training_academy')?.currentLevel || 0,
          ai_training_academy: facilities.find((f: any) => f.type === 'ai_training_academy')?.currentLevel || 0,
        };
        console.log('Academy Levels:', newAcademyLevels);
        setAcademyLevels(newAcademyLevels);
      }

      // Fetch recent battles using the same API as battle history
      const recentBattlesData = await getMatchHistory(1, 10);
      
      // Filter for this specific robot
      const robotBattles = recentBattlesData.data.filter((battle: any) => {
        // Check if this robot participated in the battle
        if (battle.battleType === 'tag_team') {
          return (
            battle.team1ActiveRobotId === parseInt(id!) ||
            battle.team1ReserveRobotId === parseInt(id!) ||
            battle.team2ActiveRobotId === parseInt(id!) ||
            battle.team2ReserveRobotId === parseInt(id!)
          );
        } else {
          return battle.robot1Id === parseInt(id!) || battle.robot2Id === parseInt(id!);
        }
      });
      
      setRecentBattles(robotBattles);

      // Calculate battle readiness
      const hpPercentage = (robotData.currentHP / robotData.maxHP) * 100;
      const hasWeapons = robotData.mainWeaponId !== null;
      const isReady = hpPercentage >= 50 && hasWeapons;
      const warnings: string[] = [];
      
      if (hpPercentage < 50) {
        warnings.push('HP below 50%');
      }
      if (!hasWeapons) {
        warnings.push('No weapons equipped');
      }
      
      setBattleReadiness({ isReady, warnings });
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

  const handleLoadoutChange = (newLoadout: string) => {
    if (!robot) return;
    fetchRobotAndWeapons(); // Refresh to get updated robot data
    setSuccessMessage(`Loadout changed to ${newLoadout}!`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleAppearanceChange = async (imageUrl: string) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    try {
      const token = localStorage.getItem('token');
      console.log('Updating robot appearance:', { robotId: id, imageUrl });
      
      const response = await axios.put(
        `http://localhost:3001/api/robots/${id}/appearance`,
        { imageUrl },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Update response:', response.data);
      setRobot(response.data.robot);
      setSuccessMessage('Robot image updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to update appearance:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to update robot image');
    }
  };

  const handleCommitUpgrades = async (upgradePlan: any) => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    // Store original robot state for rollback
    const originalRobot = { ...robot };

    try {
      const token = localStorage.getItem('token');
      
      console.log('Committing upgrade plan:', upgradePlan);
      console.log('Robot ID:', id);
      console.log('Current robot state:', robot);
      
      // Optimistic UI update: immediately apply upgrades to robot state
      const optimisticRobot = { ...robot };
      for (const [attribute, plan] of Object.entries(upgradePlan)) {
        const { plannedLevel } = plan as any;
        (optimisticRobot as any)[attribute] = plannedLevel;
      }
      setRobot(optimisticRobot);

      // Call bulk upgrades endpoint
      const response = await axios.post(
        `http://localhost:3001/api/robots/${id}/upgrades`,
        { upgrades: upgradePlan },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Upgrade response:', response.data);

      // Update state with actual robot data from server
      setRobot(response.data.robot);
      await refreshUser();
      
      const upgradeCount = Object.keys(upgradePlan).length;
      setToast({
        message: `Successfully upgraded ${upgradeCount} attribute${upgradeCount > 1 ? 's' : ''}!`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to commit upgrades:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error message:', err.message);
      
      // Rollback optimistic update
      setRobot(originalRobot);
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to commit upgrades';
      const errorDetails = err.response?.data?.required 
        ? ` (Required: ₡${err.response.data.required.toLocaleString()}, Current: ₡${err.response.data.current.toLocaleString()})`
        : '';
      
      setToast({
        message: errorMessage + errorDetails,
        type: 'error',
      });
      
      // Refresh robot data to ensure consistency
      await fetchRobotAndWeapons();
      
      // Re-throw error so UpgradePlanner knows the commit failed
      throw err;
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

  // Check if user owns this robot
  const isOwner = user && robot.userId === user.id;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Robot Header - Visible to All Users */}
        <div className="mb-8">
          <div className="mb-4">
            <button
              onClick={() => navigate('/robots')}
              className="text-blue-400 hover:text-blue-300"
            >
              ← Back to Robots
            </button>
          </div>
          
          {/* Robot Header Card */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-start gap-6">
              {/* Robot Image with Edit Button */}
              <RobotImage
                imageUrl={robot.imageUrl}
                robotName={robot.name}
                size="hero"
                showEdit={isOwner}
                onEditClick={() => setShowImageSelector(true)}
              />
              
              {/* Robot Info - Compact Layout */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <h1 className="text-3xl font-bold">{robot.name}</h1>
                  {robot.user && (
                    <div className="text-right text-sm">
                      <div className="text-gray-400">Owner</div>
                      <div className="text-white font-semibold">
                        {robot.user.stableName || robot.user.username}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">ELO:</span>
                    <span className="text-white font-semibold">{robot.elo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Current League:</span>
                    <span className="text-white font-semibold capitalize">
                      {robot.currentLeague} {robot.leagueId ? robot.leagueId.split('_')[1] : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Win Rate:</span>
                    <span className="text-white font-semibold">
                      {robot.totalBattles > 0 
                        ? ((robot.wins / robot.totalBattles) * 100).toFixed(1) 
                        : '0.0'}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Battles:</span>
                    <span className="text-white font-semibold">{robot.totalBattles}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Record:</span>
                    <span className="text-white font-semibold">
                      {robot.wins}W - {robot.losses}L - {robot.draws}D
                    </span>
                  </div>
                </div>

                {/* Performance Stats - Compact Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 mb-1">League Points</div>
                    <div className="text-white font-semibold">
                      {robot.leaguePoints}
                      {leagueRank && (
                        <span className="text-gray-400 text-xs ml-1">
                          (#{leagueRank.rank}/{leagueRank.total}, Top {leagueRank.percentile.toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 mb-1">Fame</div>
                    <div className="text-yellow-400 font-semibold">{robot.fame}</div>
                  </div>
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 mb-1">Damage (Dealt / Taken)</div>
                    <div className="text-white font-semibold">
                      {robot.damageDealtLifetime.toLocaleString()} / {robot.damageTakenLifetime.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 mb-1">Destroyed / Ratio</div>
                    <div className="text-green-400 font-semibold">
                      {robot.kills} / {robot.losses > 0 
                        ? (robot.kills / robot.losses).toFixed(2) 
                        : robot.kills.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-gray-700 p-2 rounded">
                    <div className="text-gray-400 mb-1">Lifetime Repairs</div>
                    <div className="text-white font-semibold">₡{robot.totalRepairsPaid.toLocaleString()}</div>
                  </div>
                  {robot.titles && robot.titles.trim() && (
                    <div className="bg-gray-700 p-2 rounded">
                      <div className="text-gray-400 mb-1">Titles</div>
                      <div className="text-yellow-400 font-semibold text-xs truncate">
                        {robot.titles.split(',').length} earned
                      </div>
                    </div>
                  )}
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

        {/* Tab Navigation */}
        <TabNavigation 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isOwner={isOwner}
        />

        {/* Tab Content */}
        <div role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`} className="animate-fade-in">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <StatisticalRankings robotId={robot.id} />
              <PerformanceByContext robotId={robot.id} />
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="space-y-6">
              <RecentBattles battles={recentBattles} robotId={robot.id} />
              <UpcomingMatches robotId={robot.id} battleReadiness={battleReadiness} />
            </div>
          )}

          {activeTab === 'battle-config' && isOwner && (
            <BattleConfigTab
              robot={robot}
              weapons={weapons}
              onRobotUpdate={(updates) => {
                setRobot({ ...robot, ...updates });
                setSuccessMessage('Configuration updated successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
              }}
              onEquipWeapon={async (slot, weaponInventoryId) => {
                const endpoint =
                  slot === 'main'
                    ? `http://localhost:3001/api/robots/${id}/equip-main-weapon`
                    : `http://localhost:3001/api/robots/${id}/equip-offhand-weapon`;

                const response = await axios.put(endpoint, { weaponInventoryId });
                setRobot(response.data.robot);
                setSuccessMessage('Weapon equipped successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
              }}
              onUnequipWeapon={async (slot) => {
                const endpoint =
                  slot === 'main'
                    ? `http://localhost:3001/api/robots/${id}/unequip-main-weapon`
                    : `http://localhost:3001/api/robots/${id}/unequip-offhand-weapon`;

                const response = await axios.delete(endpoint);
                setRobot(response.data.robot);
                setSuccessMessage('Weapon unequipped!');
                setTimeout(() => setSuccessMessage(''), 3000);
              }}
            />
          )}

          {activeTab === 'upgrades' && isOwner && (
            <UpgradePlanner
              robot={robot}
              currentCredits={currency}
              trainingLevel={trainingLevel}
              academyLevels={academyLevels}
              onCommit={handleCommitUpgrades}
              onNavigateToFacilities={() => navigate('/facilities')}
            />
          )}

          {activeTab === 'stats' && (
            <div className="mb-6">
              <EffectiveStatsDisplay robot={robot} />
            </div>
          )}

          {/* Non-Owner View for owner-only tabs */}
          {!isOwner && (activeTab === 'battle-config' || activeTab === 'upgrades' || activeTab === 'stats') && (
            <div className="bg-gray-800 p-6 rounded-lg text-center">
              <p className="text-gray-400 text-lg">
                {activeTab === 'stats' 
                  ? 'Detailed stats are only visible to the robot owner.'
                  : 'You can only view battle configuration and upgrades for your own robots.'}
              </p>
              <button
                onClick={() => navigate('/robots')}
                className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded"
              >
                View My Robots
              </button>
            </div>
          )}
        </div>

        {/* Robot Image Selector Modal */}
        {isOwner && (
          <RobotImageSelector
            isOpen={showImageSelector}
            currentImageUrl={robot.imageUrl}
            onSelect={handleAppearanceChange}
            onClose={() => setShowImageSelector(false)}
          />
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default RobotDetailPage;
