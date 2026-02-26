import { useEffect, useState, useMemo } from 'react';
import apiClient from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import ViewModeToggle from '../components/ViewModeToggle';
import WeaponTable from '../components/WeaponTable';
import FilterPanel, { WeaponFilters } from '../components/FilterPanel';
import ActiveFiltersDisplay from '../components/ActiveFiltersDisplay';
// import SearchBar from '../components/SearchBar';
// import { SortOption } from '../components/SortDropdown';
import ComparisonBar from '../components/ComparisonBar';
import ComparisonModal from '../components/ComparisonModal';
import WeaponDetailModal from '../components/WeaponDetailModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { calculateWeaponCooldown, ATTRIBUTE_LABELS } from '../utils/weaponConstants';
import { calculateWeaponWorkshopDiscount, applyDiscount } from '../../../shared/utils/discounts';
import { getWeaponImagePath } from '../utils/weaponImages';

interface Weapon {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  handsRequired: string;
  description: string;
  baseDamage: number;
  cost: number;
  cooldown: number;
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
  const [ownedWeapons, setOwnedWeapons] = useState<Map<number, number>>(new Map());
  const [equippedWeaponsCount, setEquippedWeaponsCount] = useState(0);
  const [weaponWorkshopLevel, setWeaponWorkshopLevel] = useState(0);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<number | null>(null);
  
  // Detail modal state
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon | null>(null);
  
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
    onlyOwnedWeapons: false,
  });

  // Search state (currently unused - search functionality not implemented yet)
  const [searchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Sort state with localStorage persistence
  const [sortBy] = useState<string>(() => {
    const saved = localStorage.getItem('weaponShopSortBy');
    return saved || 'name-asc';
  });

  // Comparison state
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

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
        const weaponsResponse = await apiClient.get('/api/weapons');
        setWeapons(weaponsResponse.data);

        // Fetch owned weapons inventory
        const inventoryResponse = await apiClient.get('/api/weapon-inventory');
        const inventory = inventoryResponse.data;
        
        // Count owned weapons by weapon ID
        const ownedMap = new Map<number, number>();
        let equippedCount = 0;
        inventory.forEach((item: any) => {
          const weaponId = item.weaponId;
          ownedMap.set(weaponId, (ownedMap.get(weaponId) || 0) + 1);
          // Count if weapon is equipped (has robots using it)
          if (item.robotsMain?.length > 0 || item.robotsOffhand?.length > 0) {
            equippedCount++;
          }
        });
        setOwnedWeapons(ownedMap);
        setEquippedWeaponsCount(equippedCount);

        // Fetch facilities to get Weapon Workshop level
        const facilitiesResponse = await apiClient.get('/api/facilities');
        const facilities = facilitiesResponse.data.facilities || facilitiesResponse.data;
        const weaponWorkshop = facilities.find((f: Facility) => f.type === 'weapons_workshop');
        setWeaponWorkshopLevel(weaponWorkshop?.currentLevel || 0);

        // Fetch storage status
        const storageResponse = await apiClient.get('/api/weapon-inventory/storage-status');
        setStorageStatus(storageResponse.data);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        
        // Check if it's an authentication error
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Authentication failed. Please log out and log back in.');
        } else {
          setError('Failed to load weapons. Please try refreshing the page.');
        }
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
    } else if (filterType === 'onlyOwned') {
      newFilters.onlyOwnedWeapons = false;
    }
    
    setFilters(newFilters);
  };

  // Sort handler (currently managed by ViewModeToggle component)
  // const handleSortChange = (newSortBy: string) => {
  //   setSortBy(newSortBy);
  //   localStorage.setItem('weaponShopSortBy', newSortBy);
  // };

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
        const getDPS = (w: Weapon) => w.baseDamage / w.cooldown;
        return sorted.sort((a, b) => getDPS(b) - getDPS(a));
      default:
        return sorted;
    }
  };

  // Calculate discounted price (must be defined before processedWeapons useMemo)
  const calculateDiscountedPrice = (basePrice: number): number => {
    const discountPercent = calculateWeaponWorkshopDiscount(weaponWorkshopLevel);
    return applyDiscount(basePrice, discountPercent);
  };

  // Helper function to check if weapon is compatible with a loadout type
  // Based on compatibility rules from WEAPONS_AND_LOADOUT.md
  const isWeaponCompatibleWithLoadout = (weapon: Weapon, loadoutType: string): boolean => {
    const { handsRequired, weaponType } = weapon;

    // Helper to check if weapon is a one-handed weapon (not shield)
    const isOneHandedWeapon = () => handsRequired === 'one' && weaponType !== 'shield';

    switch (loadoutType) {
      case 'single':
        // Single loadout: one-handed weapons only (not shields)
        return isOneHandedWeapon();
      
      case 'weapon_shield':
        // Weapon + Shield loadout: one-handed weapons (main) OR shields (offhand)
        return isOneHandedWeapon() || (handsRequired === 'shield' && weaponType === 'shield');
      
      case 'two_handed':
        // Two-handed loadout: only two-handed weapons
        return handsRequired === 'two';
      
      case 'dual_wield':
        // Dual-wield loadout: one-handed weapons only (not shields)
        return isOneHandedWeapon();
      
      default:
        return false;
    }
  };

  // Apply search, filters, and sorting
  const processedWeapons = useMemo(() => {
    // Step 1: Search
    let result = searchWeapons(weapons, debouncedSearchQuery);

    // Step 2: Filter
    result = result.filter(weapon => {
      // Loadout type filter (OR logic within category)
      // Changed from exact loadoutType match to compatibility check
      if (filters.loadoutTypes.length > 0) {
        const isCompatible = filters.loadoutTypes.some(loadoutType =>
          isWeaponCompatibleWithLoadout(weapon, loadoutType)
        );
        if (!isCompatible) {
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

      // Only owned weapons filter
      if (filters.onlyOwnedWeapons) {
        const ownedCount = ownedWeapons.get(weapon.id) || 0;
        if (ownedCount === 0) {
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
  }, [weapons, debouncedSearchQuery, filters, user, weaponWorkshopLevel, sortBy, viewMode, ownedWeapons]);

  const handlePurchase = async (weaponId: number, basePrice: number) => {
    if (!user) return;

    const finalCost = calculateDiscountedPrice(basePrice);
    const weapon = weapons.find(w => w.id === weaponId);
    const weaponName = weapon?.name || 'weapon';

    if (user.currency < finalCost) {
      setConfirmationModal({
        isOpen: true,
        title: 'Insufficient Credits',
        message: `You don't have enough credits to purchase this weapon. You need ₡${finalCost.toLocaleString()} but only have ₡${user.currency.toLocaleString()}.`,
        onConfirm: () => setConfirmationModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Check storage capacity
    if (storageStatus && storageStatus.isFull) {
      setConfirmationModal({
        isOpen: true,
        title: 'Storage Full',
        message: 'Storage capacity full! Upgrade Storage Facility to increase capacity.',
        onConfirm: () => setConfirmationModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Show confirmation dialog
    setConfirmationModal({
      isOpen: true,
      title: 'Confirm Purchase',
      message: `Are you sure you want to purchase ${weaponName} for ₡${finalCost.toLocaleString()}?`,
      onConfirm: async () => {
        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
        
        setPurchasing(weaponId);
        try {

          await apiClient.post('/api/weapon-inventory/purchase', {
            weaponId,
          });
          await refreshUser();
          
          // Refresh storage status after purchase
          const storageResponse = await apiClient.get('/api/weapon-inventory/storage-status');
          setStorageStatus(storageResponse.data);
          
          // Refresh owned weapons
          const inventoryResponse = await apiClient.get('/api/weapon-inventory');
          const inventory = inventoryResponse.data;
          const ownedMap = new Map<number, number>();
          inventory.forEach((item: any) => {
            const wId = item.weaponId;
            ownedMap.set(wId, (ownedMap.get(wId) || 0) + 1);
          });
          setOwnedWeapons(ownedMap);
          
          // Show success message
          setConfirmationModal({
            isOpen: true,
            title: 'Purchase Successful',
            message: `${weaponName} purchased successfully!`,
            onConfirm: () => setConfirmationModal(prev => ({ ...prev, isOpen: false })),
          });
          
          // Close detail modal if open
          if (selectedWeapon?.id === weaponId) {
            setSelectedWeapon(null);
          }
        } catch (err: any) {
          console.error('Purchase failed:', err);
          setConfirmationModal({
            isOpen: true,
            title: 'Purchase Failed',
            message: err.response?.data?.error || 'Failed to purchase weapon',
            onConfirm: () => setConfirmationModal(prev => ({ ...prev, isOpen: false })),
          });
        } finally {
          setPurchasing(null);
        }
      },
    });
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

  // Sort options for dropdown (defined but not directly used - ViewModeToggle manages sorting)
  // const sortOptions: SortOption[] = [
  //   { value: 'name-asc', label: 'Name (A-Z)' },
  //   { value: 'price-asc', label: 'Price: Low to High' },
  //   { value: 'price-desc', label: 'Price: High to Low' },
  //   { value: 'damage-desc', label: 'Damage: High to Low' },
  //   { value: 'dps-desc', label: 'DPS: High to Low' },
  // ];

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
            
            {/* Dual-color progress bar showing equipped vs available */}
            <div className="w-full bg-gray-700 rounded-full h-4 mb-2 overflow-hidden flex">
              {/* Equipped weapons segment (blue) */}
              {equippedWeaponsCount > 0 && (
                <div
                  className="h-4 bg-blue-500 transition-all"
                  style={{ width: `${(equippedWeaponsCount / storageStatus.maxCapacity) * 100}%` }}
                  title={`${equippedWeaponsCount} weapon(s) equipped`}
                />
              )}
              {/* Available weapons segment (capacity-based color) */}
              {storageStatus.currentWeapons - equippedWeaponsCount > 0 && (
                <div
                  className={`h-4 transition-all ${
                    storageStatus.isFull
                      ? 'bg-red-500'
                      : storageStatus.percentageFull >= 80
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${((storageStatus.currentWeapons - equippedWeaponsCount) / storageStatus.maxCapacity) * 100}%` }}
                  title={`${storageStatus.currentWeapons - equippedWeaponsCount} weapon(s) available`}
                />
              )}
            </div>
            
            {/* Legend and status text */}
            <div className="flex items-center justify-between gap-4 text-sm mb-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-300">Equipped: {equippedWeaponsCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded ${
                    storageStatus.isFull
                      ? 'bg-red-500'
                      : storageStatus.percentageFull >= 80
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}></div>
                  <span className="text-gray-300">Available: {storageStatus.currentWeapons - equippedWeaponsCount}</span>
                </div>
              </div>
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
            <p className="mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-sm transition-colors"
            >
              Retry
            </button>
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
                  onWeaponClick={(weapon) => setSelectedWeapon(weapon as any)}
                  ownedWeapons={ownedWeapons}
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
                          {/* Owned Indicator */}
                          {ownedWeapons.get(weapon.id) && (
                            <div className="absolute top-4 right-4 z-10 bg-blue-900/50 border border-blue-600 px-2 py-1 rounded text-xs font-semibold text-blue-300">
                              Already Own ({ownedWeapons.get(weapon.id)})
                            </div>
                          )}
                          
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
                          <div className="mb-4 flex justify-center cursor-pointer" onClick={() => setSelectedWeapon(weapon)}>
                            <img 
                              src={getWeaponImagePath(weapon.name)}
                              alt={weapon.name}
                              className="w-48 h-48 object-contain hover:scale-105 transition-transform"
                              onError={(e) => {
                                // Fallback if image doesn't load
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>

                          <div className="flex justify-between items-start mb-4">
                            <h3 
                              className="text-xl font-semibold cursor-pointer hover:text-blue-400 transition-colors"
                              onClick={() => setSelectedWeapon(weapon)}
                            >
                              {weapon.name}
                            </h3>
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

        {/* Weapon Detail Modal */}
        {selectedWeapon && (
          <WeaponDetailModal
            weapon={selectedWeapon}
            onClose={() => setSelectedWeapon(null)}
            onPurchase={handlePurchase}
            calculateDiscountedPrice={calculateDiscountedPrice}
            userCredits={user?.currency || 0}
            isFull={storageStatus?.isFull || false}
            purchasing={purchasing === selectedWeapon.id}
            hasDiscount={weaponWorkshopLevel > 0}
            discountPercent={calculateWeaponWorkshopDiscount(weaponWorkshopLevel)}
            ownedCount={ownedWeapons.get(selectedWeapon.id) || 0}
          />
        )}

        {/* Confirmation Modal */}
        {confirmationModal.isOpen && (
          <ConfirmationModal
            title={confirmationModal.title}
            message={confirmationModal.message}
            confirmLabel={confirmationModal.title === 'Confirm Purchase' ? 'Purchase' : 'OK'}
            cancelLabel="Cancel"
            onConfirm={confirmationModal.onConfirm}
            onCancel={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
          />
        )}
      </div>
    </div>
  );
}

export default WeaponShopPage;
