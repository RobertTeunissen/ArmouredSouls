import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import RobotImage from '../components/RobotImage';

interface Robot {
  id: number;
  name: string;
  imageUrl: string | null;
  elo: number;
  currentLeague: string;
  leaguePoints: number;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  battleReadiness: number;
  repairCost: number;
  loadoutType: string; // "single", "weapon_shield", "two_handed", "dual_wield"
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  mainWeapon: {
    weapon: {
      name: string;
      weaponType: string;
    };
  } | null;
  offhandWeapon: {
    weapon: {
      name: string;
      weaponType: string;
    };
  } | null;
  createdAt: string;
}

// Utility functions
const getHPColor = (currentHP: number, maxHP: number): string => {
  const percentage = (currentHP / maxHP) * 100;
  if (percentage >= 70) return 'bg-green-500'; // Success color
  if (percentage >= 30) return 'bg-yellow-500'; // Warning color
  return 'bg-red-500'; // Error color
};

const calculateWinRate = (wins: number, totalBattles: number): string => {
  if (totalBattles === 0) return '0.0';
  return ((wins / totalBattles) * 100).toFixed(1);
};

const calculateReadiness = (currentHP: number, maxHP: number): number => {
  // Battle readiness is based on HP only
  // Shields regenerate automatically between battles and don't cost credits
  // Therefore shield capacity should NOT affect battle readiness
  const hpPercent = (currentHP / maxHP) * 100;
  return Math.round(hpPercent);
};

// Check if loadout is complete based on loadout type
const isLoadoutComplete = (
  loadoutType: string,
  mainWeaponId: number | null,
  offhandWeaponId: number | null,
  offhandWeapon: { weapon: { weaponType: string } } | null
): { complete: boolean; reason: string } => {
  // Main weapon always required
  if (!mainWeaponId) {
    return { complete: false, reason: 'No Main Weapon' };
  }

  // Check based on loadout type
  switch (loadoutType) {
    case 'single':
      // Only main weapon required
      return { complete: true, reason: '' };
      
    case 'two_handed':
      // Only main weapon required (two-handed weapons use main slot)
      return { complete: true, reason: '' };
      
    case 'dual_wield':
      // Main weapon AND offhand weapon required
      if (!offhandWeaponId) {
        return { complete: false, reason: 'Missing Offhand Weapon' };
      }
      return { complete: true, reason: '' };
      
    case 'weapon_shield':
      // Main weapon AND shield required
      if (!offhandWeaponId) {
        return { complete: false, reason: 'Missing Shield' };
      }
      // Verify offhand is actually a shield
      if (offhandWeapon && offhandWeapon.weapon.weaponType !== 'shield') {
        return { complete: false, reason: 'Offhand Must Be Shield' };
      }
      return { complete: true, reason: '' };
      
    default:
      // Unknown loadout type - treat as incomplete
      return { complete: false, reason: 'Invalid Loadout Type' };
  }
};

const getReadinessStatus = (
  currentHP: number, 
  maxHP: number,
  loadoutType: string,
  mainWeaponId: number | null,
  offhandWeaponId: number | null,
  offhandWeapon: { weapon: { weaponType: string } } | null
): { text: string; color: string; reason: string } => {
  // Battle readiness is based on HP and loadout only
  // Shields regenerate automatically and don't affect readiness
  const readiness = calculateReadiness(currentHP, maxHP);
  const hpPercent = (currentHP / maxHP) * 100;
  
  // Check loadout completeness first - critical for battle
  const loadoutCheck = isLoadoutComplete(loadoutType, mainWeaponId, offhandWeaponId, offhandWeapon);
  if (!loadoutCheck.complete) {
    return { text: 'Not Ready', color: 'text-red-500', reason: loadoutCheck.reason };
  }
  
  if (readiness >= 80) {
    return { text: 'Battle Ready', color: 'text-green-500', reason: '' };
  }
  
  // Determine reason for not being battle ready (HP only - shields regenerate)
  let reason = '';
  if (hpPercent < 80) {
    reason = 'Low HP';
  }
  
  if (readiness >= 50) {
    return { text: 'Damaged', color: 'text-yellow-500', reason };
  }
  
  return { text: 'Critical', color: 'text-red-500', reason };
};

function RobotsPage() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [repairBayLevel, setRepairBayLevel] = useState(0);
  const [rosterLevel, setRosterLevel] = useState(0);
  const { logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchRobots();
    fetchFacilities();
  }, [location]); // Refetch when navigating to this page

  // Refetch facilities when page becomes visible (after navigating back from facility upgrades)
  useEffect(() => {
    const handleFocus = () => {
      fetchFacilities();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchRobots = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/robots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch robots');
      }

      const data = await response.json();
      
      // Debug logging
      console.log('Fetched robots:', {
        count: data.length,
        robots: data.map((r: Robot) => ({
          id: r.id,
          name: r.name,
          currentHP: r.currentHP,
          maxHP: r.maxHP,
          repairCost: r.repairCost,
        })),
      });
      
      // Sort robots by ELO (highest first)
      const sortedData = data.sort((a: Robot, b: Robot) => b.elo - a.elo);
      setRobots(sortedData);
    } catch (err) {
      setError('Failed to load robots');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacilities = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/facilities', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const facilities = data.facilities || data; // Handle both response formats
        const repairBay = facilities.find((f: any) => f.type === 'repair_bay');
        if (repairBay) {
          setRepairBayLevel(repairBay.currentLevel || 0);
        }
        const rosterExpansion = facilities.find((f: any) => f.type === 'roster_expansion');
        if (rosterExpansion) {
          setRosterLevel(rosterExpansion.currentLevel || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch facilities:', err);
    }
  };

  const calculateTotalRepairCost = () => {
    const REPAIR_COST_PER_HP = 50; // 50 credits per HP (matches backend)
    
    // Calculate repair cost for each robot
    const totalBaseCost = robots.reduce((sum, robot) => {
      // If repairCost is set by backend, use it
      if (robot.repairCost && robot.repairCost > 0) {
        return sum + robot.repairCost;
      }
      
      // Otherwise, calculate based on HP damage
      const hpDamage = robot.maxHP - robot.currentHP;
      if (hpDamage > 0) {
        return sum + (hpDamage * REPAIR_COST_PER_HP);
      }
      
      return sum;
    }, 0);
    
    const discount = repairBayLevel * 5; // 5% per level
    const discountedCost = Math.floor(totalBaseCost * (1 - discount / 100));
    
    // Debug logging
    const robotsNeedingRepair = robots.filter(r => {
      const hasRepairCost = (r.repairCost || 0) > 0;
      const hasHPDamage = r.currentHP < r.maxHP;
      return hasRepairCost || hasHPDamage;
    });
    
    console.log('Repair cost calculation:', {
      robotCount: robots.length,
      robotsNeedingRepair: robotsNeedingRepair.length,
      robotsWithRepairCost: robots.filter(r => (r.repairCost || 0) > 0).length,
      robotsWithHPDamage: robots.filter(r => r.currentHP < r.maxHP).length,
      totalBaseCost,
      discount,
      discountedCost,
      repairBayLevel,
    });
    
    return { totalBaseCost, discountedCost, discount };
  };

  const handleRepairAll = async () => {
    const { discountedCost, discount } = calculateTotalRepairCost();
    
    if (discountedCost === 0) {
      alert('No robots need repair!');
      return;
    }

    if (!confirm(`Repair all robots for ₡${discountedCost.toLocaleString()}${discount > 0 ? ` (${discount}% off)` : ''}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/robots/repair-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(`Repair failed: ${data.error}`);
        return;
      }

      // Show success message
      alert(data.message);
      
      // Refresh robots list to show updated status and user credits
      await Promise.all([fetchRobots(), refreshUser()]);
    } catch (err) {
      console.error('Repair all error:', err);
      alert('Failed to repair robots. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e14] text-white flex items-center justify-center">
        <div className="text-xl">Loading robots...</div>
      </div>
    );
  }

  const { discountedCost, discount } = calculateTotalRepairCost();
  const needsRepair = discountedCost > 0;
  const maxRobots = rosterLevel + 1;
  const atCapacity = robots.length >= maxRobots;

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">
            My Robots <span className="text-gray-400 text-2xl">({robots.length}/{maxRobots})</span>
          </h2>
          <div className="flex gap-4">
            {robots.length > 0 && (
              <button
                onClick={handleRepairAll}
                disabled={!needsRepair}
                className={`px-6 py-3 rounded-lg transition-colors font-semibold ${
                  needsRepair
                    ? 'bg-[#d29922] hover:bg-[#e0a832] text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
                title={needsRepair ? `Repair all robots for ₡${discountedCost.toLocaleString()}${discount > 0 ? ` (${discount}% off)` : ''}` : 'No repairs needed'}
              >
                🔧 Repair All{needsRepair ? `: ₡${discountedCost.toLocaleString()}${discount > 0 ? ` (${discount}% off)` : ''}` : ''}
              </button>
            )}
            <button
              onClick={() => navigate('/robots/create')}
              disabled={atCapacity}
              className={`px-6 py-3 rounded-lg transition-colors font-semibold ${
                atCapacity
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-[#3fb950] hover:bg-[#4fc960] text-white'
              }`}
              title={atCapacity ? `Robot limit reached (${maxRobots}). Upgrade Roster Expansion facility to create more robots.` : 'Create a new robot'}
            >
              + Create New Robot
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {robots.length === 0 ? (
          <div className="bg-[#1a1f29] p-12 rounded-lg text-center">
            <p className="text-xl text-gray-400 mb-4">You don't have any robots yet.</p>
            <p className="text-gray-500 mb-6">Create your first robot to start battling!</p>
            <button
              onClick={() => navigate('/robots/create')}
              className="bg-[#3fb950] hover:bg-[#4fc960] px-8 py-3 rounded-lg transition-colors font-semibold"
            >
              Create Your First Robot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {robots.map((robot) => {
              const hpPercentage = Math.round((robot.currentHP / robot.maxHP) * 100);
              const shieldPercentage = robot.maxShield > 0 
                ? Math.round((robot.currentShield / robot.maxShield) * 100)
                : 0;
              const winRate = calculateWinRate(robot.wins, robot.totalBattles);
              const actualReadiness = calculateReadiness(robot.currentHP, robot.maxHP);
              const readinessStatus = getReadinessStatus(
                robot.currentHP, 
                robot.maxHP,
                robot.loadoutType,
                robot.mainWeaponId,
                robot.offhandWeaponId,
                robot.offhandWeapon
              );

              return (
                <div
                  key={robot.id}
                  className="bg-[#252b38] p-6 rounded-lg border-2 border-[#3d444d] hover:border-[#58a6ff] transition-colors cursor-pointer"
                  onClick={() => navigate(`/robots/${robot.id}`)}
                >
                  {/* Robot Portrait */}
                  <div className="flex justify-center mb-4">
                    <RobotImage
                      imageUrl={robot.imageUrl}
                      robotName={robot.name}
                      size="medium"
                    />
                  </div>

                  {/* Robot Info */}
                  <h3 className="text-xl font-bold mb-2 text-center">{robot.name}</h3>
                  
                  <div className="space-y-2 text-sm mb-4">
                    {/* ELO, League, League Points */}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">ELO:</span>
                      <span className="font-semibold text-[#58a6ff]">{robot.elo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">League:</span>
                      <span className="font-semibold capitalize">{robot.currentLeague} │ LP: {robot.leaguePoints}</span>
                    </div>
                    
                    {/* Win/Loss/Draw Record */}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Record:</span>
                      <span className="font-semibold">
                        {robot.wins}W-{robot.losses}L-{robot.draws}D ({winRate}%)
                      </span>
                    </div>
                  </div>

                  {/* HP Bar */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>HP</span>
                      <span>{hpPercentage}%</span>
                    </div>
                    <div className="w-full h-6 bg-[#1a1f29] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getHPColor(robot.currentHP, robot.maxHP)}`}
                        style={{ width: `${hpPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Shield Bar */}
                  {robot.maxShield > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Shield</span>
                        <span>{shieldPercentage}%</span>
                      </div>
                      <div className="w-full h-5 bg-[#1a1f29] rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-300 bg-[#58a6ff]"
                          style={{ width: `${shieldPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Weapon & Readiness */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Weapon:</span>
                      <span className="font-semibold">
                        {robot.mainWeapon ? robot.mainWeapon.weapon.name : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Readiness:</span>
                      <span className={`font-semibold ${readinessStatus.color}`}>
                        {actualReadiness}% │ {readinessStatus.text}
                        {readinessStatus.reason && ` (${readinessStatus.reason})`}
                      </span>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/robots/${robot.id}`);
                    }}
                    className="mt-4 w-full border border-[#58a6ff] text-[#58a6ff] hover:bg-[#58a6ff] hover:bg-opacity-10 px-4 py-2 rounded transition-colors"
                  >
                    View Details →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RobotsPage;
