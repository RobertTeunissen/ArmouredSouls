import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import ViewModeToggle from '../components/ViewModeToggle';
import WeaponTable from '../components/WeaponTable';
import FilterPanel, { WeaponFilters } from '../components/FilterPanel';
import ActiveFiltersDisplay from '../components/ActiveFiltersDisplay';
import SearchBar from '../components/SearchBar';
import SortDropdown, { SortOption } from '../components/SortDropdown';
import ComparisonBar from '../components/ComparisonBar';
import ComparisonModal from '../components/ComparisonModal';
import { calculateWeaponCooldown, ATTRIBUTE_LABELS } from '../utils/weaponConstants';
import { calculateWeaponWorkshopDiscount, applyDiscount } from '../../../shared/utils/discounts';
import { getWeaponImagePath } from '../utils/weaponImages';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  description: string;
  baseDamage: number;
  cost: number;
  // Attribute bonuses
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

interface Facility {
  id: number;
  type: string;
  facilityType: string;
  level: number;
  currentLevel: number;
}

interface StorageStatus {
  currentWeapons: number;
  maxCapacity: number;
  remainingSlots: number;
  isFull: boolean;
  percentageFull: number;
}

type ViewMode = 'card' | 'table';

function WeaponShopPage() {
  const { user, refreshUser } = useAuth();
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [weaponWorkshopLevel, setWeaponWorkshopLevel] = useState(0);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<number | null>(null);
  
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('weaponShopViewMode');
    return (saved as ViewMode) || 'card';
  });

  // Filter state
  const [filters, setFilters] = useState<WeaponFilters>({
    loadoutTypes: [],
    weaponTypes: [],
    priceRange: null,
    canAffordOnly: false,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Sort state with localStorage persistence
  const [sortBy, setSortBy] = useState<string>(() => {
    const saved = localStorage.getItem('weaponShopSortBy');
    return saved || 'name-asc';
  });

  // Comparison state
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch weapons
        const weaponsResponse = await axios.get('http://localhost:3001/api/weapons');
        setWeapons(weaponsResponse.data);

        // Fetch facilities to get Weapon Workshop level
        const facilitiesResponse = await axios.get('http://localhost:3001/api/facilities');
        const weaponWorkshop = facilitiesResponse.data.find((f: Facility) => f.type === 'weapons_workshop');
        setWeaponWorkshopLevel(weaponWorkshop?.currentLevel || 0);

        // Fetch storage status
        const storageResponse = await axios.get('http://localhost:3001/api/weapon-inventory/storage-status');
        setStorageStatus(storageResponse.data);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load weapons');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('weaponShopViewMode', mode);
  };

  const handleFiltersChange = (newFilters: WeaponFilters) => {
    setFilters(newFilters);
  };

  const handleRemoveFilter = (filterType: string, value?: string) => {
    const newFilters = { ...filters };
    
    if (filterType === 'loadoutType' && value) {
      newFilters.loadoutTypes = newFilters.loadoutTypes.filter(t => t !== value);
    } else if (filterType === 'weaponType' && value) {
      newFilters.weaponTypes = newFilters.weaponTypes.filter(t => t !== value);
    } else if (filterType === 'priceRange') {
      newFilters.priceRange = null;
    } else if (filterType === 'canAfford') {
      newFilters.canAffordOnly = false;
    }
    
    setFilters(newFilters);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    localStorage.setItem('weaponShopSortBy', newSortBy);
  };

  // Search weapons by name, description, type
  const searchWeapons = (weapons: Weapon[], query: string): Weapon[] => {
    if (!query.trim()) return weapons;
    
    const lowerQuery = query.toLowerCase();
    return weapons.filter(weapon =>
      weapon.name.toLowerCase().includes(lowerQuery) ||
      weapon.description.toLowerCase().includes(lowerQuery) ||
      weapon.weaponType.toLowerCase().includes(lowerQuery) ||
      weapon.loadoutType.toLowerCase().replace('_', ' ').includes(lowerQuery)
    );
  };

  // Sort weapons
  const sortWeapons = (weapons: Weapon[], sortOption: string): Weapon[] => {
    const sorted = [...weapons];
    
    switch (sortOption) {
      case 'price-asc':
        return sorted.sort((a, b) => 
          calculateDiscountedPrice(a.cost) - calculateDiscountedPrice(b.cost)
        );
      case 'price-desc':
        return sorted.sort((a, b) => 
          calculateDiscountedPrice(b.cost) - calculateDiscountedPrice(a.cost)
        );
      case 'damage-desc':
        return sorted.sort((a, b) => b.baseDamage - a.baseDamage);
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'dps-desc':
        const getDPS = (w: Weapon) => 
          w.baseDamage / calculateWeaponCooldown(w.weaponType, w.baseDamage);
        return sorted.sort((a, b) => getDPS(b) - getDPS(a));
      default:
        return sorted;
    }
  };

  // Apply search, filters, and sorting
  const processedWeapons = useMemo(() => {
    // Step 1: Search
    let result = searchWeapons(weapons, debouncedSearchQuery);

    // Step 2: Filter
    result = result.filter(weapon => {
      // Loadout type filter (OR logic within category)
      if (filters.loadoutTypes.length > 0) {
        if (!filters.loadoutTypes.includes(weapon.loadoutType)) {
          return false;
        }
      }

      // Weapon type filter (OR logic within category)
      if (filters.weaponTypes.length > 0) {
        if (!filters.weaponTypes.includes(weapon.weaponType)) {
          return false;
        }
      }

      // Price range filter
      if (filters.priceRange) {
        const discountedPrice = calculateDiscountedPrice(weapon.cost);
        if (discountedPrice < filters.priceRange.min || discountedPrice > filters.priceRange.max) {
          return false;
        }
      }

      // Can afford filter
      if (filters.canAffordOnly && user) {
        const discountedPrice = calculateDiscountedPrice(weapon.cost);
        if (user.currency < discountedPrice) {
          return false;
        }
      }

      return true;
    });

    // Step 3: Sort (for card view)
    if (viewMode === 'card') {
      result = sortWeapons(result, sortBy);
    }

    return result;
  }, [weapons, debouncedSearchQuery, filters, user, weaponWorkshopLevel, sortBy, viewMode]);

  const calculateDiscountedPrice = (basePrice: number): number => {
    const discountPercent = calculateWeaponWorkshopDiscount(weaponWorkshopLevel);
    return applyDiscount(basePrice, discountPercent);
  };

  const handlePurchase = async (weaponId: number, basePrice: number) => {
    if (!user) return;

    const finalCost = calculateDiscountedPrice(basePrice);

    if (user.currency < finalCost) {
      alert('Insufficient credits!');
      return;
    }

    // Check storage capacity
    if (storageStatus && storageStatus.isFull) {
      alert('Storage capacity full! Upgrade Storage Facility to increase capacity.');
      return;
    }

    if (!confirm('Are you sure you want to purchase this weapon?')) {
      return;
    }

    setPurchasing(weaponId);
    try {
      await axios.post('http://localhost:3001/api/weapon-inventory/purchase', {
        weaponId,
      });
      await refreshUser();
      
      // Refresh storage status after purchase
      const storageResponse = await axios.get('http://localhost:3001/api/weapon-inventory/storage-status');
      setStorageStatus(storageResponse.data);
      
      alert('Weapon purchased successfully!');
    } catch (err: any) {
      console.error('Purchase failed:', err);
      alert(err.response?.data?.error || 'Failed to purchase weapon');
    } finally {
      setPurchasing(null);
    }
  };

  // Comparison handlers
  const toggleComparison = (weaponId: number) => {
    setSelectedForComparison(prev => {
      if (prev.includes(weaponId)) {
        return prev.filter(id => id !== weaponId);
      } else if (prev.length < 3) {
        return [...prev, weaponId];
      }
      return prev; // Already at max (3)
    });
  };

  const handleCompare = () => {
    if (selectedForComparison.length >= 2) {
      setShowComparisonModal(true);
    }
  };

  const handleClearComparison = () => {
    setSelectedForComparison([]);
  };

  const handleRemoveFromComparison = (weaponId: number) => {
    setSelectedForComparison(prev => prev.filter(id => id !== weaponId));
    if (selectedForComparison.length <= 2) {
      setShowComparisonModal(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'energy': return 'text-blue-400';
      case 'ballistic': return 'text-orange-400';
      case 'melee': return 'text-red-400';
      case 'explosive': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getAttributeBonuses = (weapon: Weapon): string[] => {
    const bonuses: string[] = [];

    ATTRIBUTE_LABELS.forEach(({ key, label }) => {
      const value = weapon[key as keyof Weapon] as number;
      if (value !== 0) {
        bonuses.push(`${label}: ${value > 0 ? '+' : ''}${value}`);
      }
    });

    return bonuses;
  };

  const groupedWeapons = {
    shield: processedWeapons.filter(w => w.loadoutType === 'weapon_shield' && w.weaponType === 'shield'),
    two_handed: processedWeapons.filter(w => w.loadoutType === 'two_handed'),
    one_handed: processedWeapons.filter(w => w.loadoutType === 'single'),
  };

  // Sort options for dropdown
  const sortOptions: SortOption[] = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'damage-desc', label: 'Damage: High to Low' },
    { value: 'dps-desc', label: 'DPS: High to Low' },
  ];

  const getLoadoutTypeLabel = (loadoutType: string) => {
    switch (loadoutType) {
      case 'shield': return 'Shield';
      case 'two_handed': return 'Two-Handed';
      case 'one_handed': return 'One-Handed (Single, Dual Wield, or with Shield)';
      default: return loadoutType;
    }
  };

  const getLoadoutTypeColor = (loadoutType: string) => {
    switch (loadoutType) {
      case 'shield': return 'text-cyan-400';
      case 'two_handed': return 'text-purple-400';
      case 'one_handed': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Weapon Shop</h1>
          <p className="text-gray-400">Purchase weapons to equip your robots. Weapons provide attribute bonuses and combat capabilities.</p>
        </div>

        {/* Storage Capacity */}
        {storageStatus && (
          <div className="bg-gray-800 p-6 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold">Storage Capacity</h3>
              <span className="text-lg font-bold">
                {storageStatus.currentWeapons} / {storageStatus.maxCapacity}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
              <div
                className={`h-4 rounded-full transition-all ${
                  storageStatus.isFull
                    ? 'bg-red-500'
                    : storageStatus.percentageFull >= 80
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(storageStatus.percentageFull, 100)}%` }}
              />
            </div>
            <div className="text-sm text-gray-400">
              {storageStatus.isFull ? (
                <span className="text-red-400 font-semibold">
                  ⚠️ Storage full! Upgrade Storage Facility to increase capacity.
                </span>
              ) : storageStatus.percentageFull >= 80 ? (
                <span className="text-yellow-400">
                  Running low on storage space. {storageStatus.remainingSlots} slot(s) remaining.
                </span>
              ) : (
                `${storageStatus.remainingSlots} slot(s) available`
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-gray-400">
            Loading weapons...
          </div>
        )}

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-200 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Filter Panel */}
            <FilterPanel
              filters={filters}
              onFiltersChange={handleFiltersChange}
              userCredits={user?.currency || 0}
              weaponCount={weapons.length}
              filteredCount={processedWeapons.length}
            />

            {/* Active Filters Display */}
            <ActiveFiltersDisplay
              filters={filters}
              onRemoveFilter={handleRemoveFilter}
            />

            {/* View Mode Toggle */}
            <div className="flex justify-end mb-6">
              <ViewModeToggle viewMode={viewMode} onViewModeChange={handleViewModeChange} />
            </div>

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <WeaponTable
                  weapons={processedWeapons}
                  onPurchase={handlePurchase}
                  calculateDiscountedPrice={calculateDiscountedPrice}
                  userCredits={user?.currency || 0}
                  isFull={storageStatus?.isFull || false}
                  purchasing={purchasing}
                  hasDiscount={weaponWorkshopLevel > 0}
                  discountPercent={calculateWeaponWorkshopDiscount(weaponWorkshopLevel)}
                />
              </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
              <>
                {processedWeapons.length === 0 ? (
                  <div className="bg-gray-800 rounded-lg p-12 text-center">
                    <p className="text-gray-400 text-lg mb-2">No weapons match your filters</p>
                    <p className="text-gray-500 text-sm">Try adjusting your filters to see more weapons</p>
                  </div>
                ) : (
                  <>
                        {Object.entries(groupedWeapons).map(([loadoutType, weaponList]) => (
                      weaponList.length > 0 && (
                        <div key={loadoutType} className="mb-8">
                          <h2 className={`text-2xl font-bold mb-4 ${getLoadoutTypeColor(loadoutType)}`}>
                            {getLoadoutTypeLabel(loadoutType)}
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {weaponList.map((weapon) => {
                      const bonuses = getAttributeBonuses(weapon);
                      const discountedPrice = calculateDiscountedPrice(weapon.cost);
                      const hasDiscount = weaponWorkshopLevel > 0;
                      const isSelected = selectedForComparison.includes(weapon.id);
                      return (
                        <div key={weapon.id} className="bg-gray-800 p-6 rounded-lg relative">
                          {/* Comparison Checkbox */}
                          <div className="absolute top-4 left-4 z-10">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleComparison(weapon.id)}
                                disabled={!isSelected && selectedForComparison.length >= 3}
                                className="w-5 h-5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                              />
                              <span className="text-sm text-gray-400">Compare</span>
                            </label>
                          </div>
                          
                          {/* Weapon Image */}
                          <div className="mb-4 flex justify-center">
                            <img 
                              src={getWeaponImagePath(weapon.name)}
                              alt={weapon.name}
                              className="w-48 h-48 object-contain"
                              onError={(e) => {
                                // Fallback if image doesn't load
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>

                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-semibold">{weapon.name}</h3>
                            <span className={`text-sm font-semibold uppercase ${getTypeColor(weapon.weaponType)}`}>
                              {weapon.weaponType}
                            </span>
                          </div>

                          <p className="text-gray-400 text-sm mb-4">{weapon.description}</p>

                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Loadout Type:</span>
                              <span className="font-semibold capitalize">{weapon.loadoutType.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Base Damage:</span>
                              <span className="font-semibold">{weapon.baseDamage}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Cooldown:</span>
                              <span className="font-semibold">{calculateWeaponCooldown(weapon.weaponType, weapon.baseDamage)}s</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Cost:</span>
                              <div className="flex flex-col items-end">
                                {hasDiscount && (
                                  <span className="text-xs text-gray-500 line-through">₡{weapon.cost.toLocaleString()}</span>
                                )}
                                <span className="font-semibold text-green-400">
                                  ₡{discountedPrice.toLocaleString()}
                                  {hasDiscount && <span className="text-xs ml-1">({calculateWeaponWorkshopDiscount(weaponWorkshopLevel)}% off)</span>}
                                </span>
                              </div>
                            </div>
                          </div>

                          {bonuses.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-700 rounded">
                              <div className="text-xs text-gray-400 mb-2">Attribute Bonuses:</div>
                              <div className="flex flex-wrap gap-1">
                                {bonuses.map((bonus, idx) => (
                                  <span key={idx} className="text-xs bg-gray-600 px-2 py-1 rounded">
                                    {bonus}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => handlePurchase(weapon.id, weapon.cost)}
                            disabled={
                              purchasing === weapon.id ||
                              !!(user && user.currency < discountedPrice) ||
                              !!(storageStatus && storageStatus.isFull)
                            }
                            className={`w-full py-2 rounded transition-colors ${
                              storageStatus && storageStatus.isFull
                                ? 'bg-red-900 text-red-300 cursor-not-allowed'
                                : user && user.currency < discountedPrice
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : purchasing === weapon.id
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {storageStatus && storageStatus.isFull
                              ? 'Storage Full'
                              : purchasing === weapon.id
                              ? 'Purchasing...'
                              : user && user.currency < discountedPrice
                              ? 'Insufficient Credits'
                              : 'Purchase'}
                          </button>
                        </div>
                      );
                    })}
                          </div>
                        </div>
                      )
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Comparison Bar */}
        <ComparisonBar
          selectedCount={selectedForComparison.length}
          onCompare={handleCompare}
          onClear={handleClearComparison}
        />

        {/* Comparison Modal */}
        {showComparisonModal && (
          <ComparisonModal
            weapons={weapons.filter(w => selectedForComparison.includes(w.id))}
            onClose={() => setShowComparisonModal(false)}
            onPurchase={(weaponId) => {
              const weapon = weapons.find(w => w.id === weaponId);
              if (weapon) {
                handlePurchase(weaponId, weapon.cost);
              }
            }}
            onRemove={handleRemoveFromComparison}
            userCurrency={user?.currency || 0}
            weaponWorkshopLevel={weaponWorkshopLevel}
            storageIsFull={storageStatus?.isFull || false}
            purchasingId={purchasing}
          />
        )}
      </div>
    </div>
  );
}

export default WeaponShopPage;
