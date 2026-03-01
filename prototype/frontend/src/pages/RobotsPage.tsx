import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import RobotImage from '../components/RobotImage';
import ConfirmationModal from '../components/ConfirmationModal';
import ViewModeToggle from '../components/ViewModeToggle';
import apiClient from '../utils/apiClient';
import { fetchMyRobots } from '../utils/robotApi';

interface Robot {
  id: number;
  name: string;
  imageUrl: string | null;
  elo: number;
  fame: number;
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
  const [showRepairConfirmation, setShowRepairConfirmation] = useState(false);
  const [repairCostInfo, setRepairCostInfo] = useState({ discountedCost: 0, discount: 0 });
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('robotsViewMode');
    return (saved as 'card' | 'table') || 'card';
  });
  const [sortColumn, setSortColumn] = useState<string>('elo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();  useEffect(() => {
    fetchRobots();
    fetchFacilities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const data = await fetchMyRobots();
      
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
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      setError('Failed to load robots');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacilities = async () => {
    try {
      const response = await apiClient.get('/api/facilities');
      const data = response.data;
      const facilities = data.facilities || data; // Handle both response formats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repairBay = facilities.find((f: any) => f.type === 'repair_bay');
      if (repairBay) {
        setRepairBayLevel(repairBay.currentLevel || 0);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rosterExpansion = facilities.find((f: any) => f.type === 'roster_expansion');
      if (rosterExpansion) {
        setRosterLevel(rosterExpansion.currentLevel || 0);
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
    
    // New formula: discount = repairBayLevel × (5 + activeRobotCount), capped at 90%
    const activeRobotCount = robots.filter(r => r.name !== 'Bye Robot').length;
    const discount = Math.min(90, repairBayLevel * (5 + activeRobotCount));
    const discountedCost = Math.floor(totalBaseCost * (1 - discount / 100));
    
    // Debug logging
    const robotsNeedingRepair = robots.filter(r => {
      const hasRepairCost = (r.repairCost || 0) > 0;
      const hasHPDamage = r.currentHP < r.maxHP;
      return hasRepairCost || hasHPDamage;
    });
    
    console.log('Repair cost calculation:', {
      robotCount: robots.length,
      activeRobotCount,
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

    // Store cost info and show confirmation modal
    setRepairCostInfo({ discountedCost, discount });
    setShowRepairConfirmation(true);
  };

  const confirmRepairAll = async () => {
    try {
      await apiClient.post('/api/robots/repair-all', {});

      // Close modal and refresh
      setShowRepairConfirmation(false);
      
      // Refresh robots list to show updated status and user credits
      await Promise.all([fetchRobots(), refreshUser()]);
    } catch (err) {
      console.error('Repair all error:', err);
      alert('Failed to repair robots. Please try again.');
      setShowRepairConfirmation(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedRobots = () => {
    const sorted = [...robots];
    
    sorted.sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let aValue: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bValue: any;

      switch (sortColumn) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'elo':
          aValue = a.elo;
          bValue = b.elo;
          break;
        case 'fame':
          aValue = a.fame;
          bValue = b.fame;
          break;
        case 'league':
          aValue = a.leaguePoints;
          bValue = b.leaguePoints;
          break;
        case 'winRate':
          aValue = a.totalBattles > 0 ? (a.wins / a.totalBattles) : 0;
          bValue = b.totalBattles > 0 ? (b.wins / b.totalBattles) : 0;
          break;
        case 'hp':
          aValue = (a.currentHP / a.maxHP);
          bValue = (b.currentHP / b.maxHP);
          break;
        case 'shield':
          aValue = a.maxShield > 0 ? (a.currentShield / a.maxShield) : 0;
          bValue = b.maxShield > 0 ? (b.currentShield / b.maxShield) : 0;
          break;
        case 'readiness':
          aValue = calculateReadiness(a.currentHP, a.maxHP);
          bValue = calculateReadiness(b.currentHP, b.maxHP);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const displayedRobots = viewMode === 'table' ? getSortedRobots() : robots;

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

        {/* View Mode Toggle */}
        {robots.length > 0 && (
          <div className="flex justify-end mb-6">
            <ViewModeToggle 
              viewMode={viewMode} 
              onViewModeChange={(mode) => {
                setViewMode(mode);
                localStorage.setItem('robotsViewMode', mode);
              }} 
            />
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {robots.length === 0 ? (
          <div className="bg-[#1a1f29] p-12 rounded-lg text-center">
            <p className="text-xl text-gray-400 mb-4">You don&apos;t have any robots yet.</p>
            <p className="text-gray-500 mb-6">Create your first robot to start battling!</p>
            <button
              onClick={() => navigate('/robots/create')}
              className="bg-[#3fb950] hover:bg-[#4fc960] px-8 py-3 rounded-lg transition-colors font-semibold"
            >
              Create Your First Robot
            </button>
          </div>
        ) : (
          <>
            {/* Table View */}
            {viewMode === 'table' && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-900">
                      <tr>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            Robot
                            {sortColumn === 'name' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('elo')}
                        >
                          <div className="flex items-center gap-1">
                            ELO
                            {sortColumn === 'elo' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('fame')}
                        >
                          <div className="flex items-center gap-1">
                            Fame
                            {sortColumn === 'fame' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('league')}
                        >
                          <div className="flex items-center gap-1">
                            League
                            {sortColumn === 'league' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('winRate')}
                        >
                          <div className="flex items-center gap-1">
                            Record
                            {sortColumn === 'winRate' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('hp')}
                        >
                          <div className="flex items-center gap-1">
                            HP
                            {sortColumn === 'hp' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('shield')}
                        >
                          <div className="flex items-center gap-1">
                            Shield
                            {sortColumn === 'shield' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Weapons</th>
                        <th 
                          className="px-4 py-3 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                          onClick={() => handleSort('readiness')}
                        >
                          <div className="flex items-center gap-1">
                            Readiness
                            {sortColumn === 'readiness' && (
                              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRobots.map((robot) => {
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
                          <tr 
                            key={robot.id}
                            className="border-t border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
                            onClick={() => navigate(`/robots/${robot.id}`)}
                          >
                            {/* Robot Name & Image */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <RobotImage
                                  imageUrl={robot.imageUrl}
                                  robotName={robot.name}
                                  size="small"
                                />
                                <span className="font-semibold">{robot.name}</span>
                              </div>
                            </td>
                            
                            {/* ELO */}
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#58a6ff]">{robot.elo}</span>
                            </td>
                            
                            {/* Fame */}
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#ffd700]">{robot.fame}</span>
                            </td>
                            
                            {/* League */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold capitalize">{robot.currentLeague}</span>
                                <span className="text-xs text-gray-400">LP: {robot.leaguePoints}</span>
                              </div>
                            </td>
                            
                            {/* Record */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">{robot.wins}W-{robot.losses}L-{robot.draws}D</span>
                                <span className="text-xs text-gray-400">{winRate}% WR</span>
                              </div>
                            </td>
                            
                            {/* HP */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-gray-400">{robot.currentHP}/{robot.maxHP}</span>
                                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${getHPColor(robot.currentHP, robot.maxHP)}`}
                                    style={{ width: `${hpPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            
                            {/* Shield */}
                            <td className="px-4 py-3">
                              {robot.maxShield > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-xs text-gray-400">{robot.currentShield}/{robot.maxShield}</span>
                                  <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className="h-full transition-all bg-[#58a6ff]"
                                      style={{ width: `${shieldPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">N/A</span>
                              )}
                            </td>
                            
                            {/* Weapons */}
                            <td className="px-4 py-3">
                              <div className="text-sm">
                                {robot.mainWeapon ? (
                                  <>
                                    <div>{robot.mainWeapon.weapon.name}</div>
                                    {robot.offhandWeapon && (
                                      <div className="text-gray-400">+ {robot.offhandWeapon.weapon.name}</div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-500">None</span>
                                )}
                              </div>
                            </td>
                            
                            {/* Readiness */}
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className={`font-semibold ${readinessStatus.color}`}>
                                  {actualReadiness}%
                                </span>
                                <span className={`text-xs ${readinessStatus.color}`}>
                                  {readinessStatus.text}
                                </span>
                              </div>
                            </td>
                            
                            {/* Actions */}
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/robots/${robot.id}`);
                                }}
                                className="text-sm text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
                              >
                                View Details →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedRobots.map((robot) => {
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
                      <span className="text-gray-400">Fame:</span>
                      <span className="font-semibold text-[#ffd700]">{robot.fame}</span>
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
                        {robot.offhandWeapon && ` + ${robot.offhandWeapon.weapon.name}`}
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
          </>
        )}
      </div>

      {/* Repair Confirmation Modal */}
      {showRepairConfirmation && (
        <ConfirmationModal
          title="Confirm Repair"
          message={
            <div>
              <p className="mb-2">
                Are you sure you want to repair all robots?
              </p>
              <div className="bg-gray-700 p-3 rounded mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Cost:</span>
                  <span className="text-xl font-bold text-green-400">
                    ₡{repairCostInfo.discountedCost.toLocaleString()}
                  </span>
                </div>
                {repairCostInfo.discount > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="text-gray-500">Repair Bay Discount:</span>
                    <span className="text-blue-400">{repairCostInfo.discount}% off</span>
                  </div>
                )}
              </div>
            </div>
          }
          confirmLabel="Repair All"
          cancelLabel="Cancel"
          onConfirm={confirmRepairAll}
          onCancel={() => setShowRepairConfirmation(false)}
        />
      )}
    </div>
  );
}

export default RobotsPage;
