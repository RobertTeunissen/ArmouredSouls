/**
 * Custom hook for Weapon Shop page state management and data fetching.
 *
 * Extracted from WeaponShopPage.tsx during component splitting (Spec 18).
 */

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import type { WeaponFilters } from '../FilterPanel';
import { ATTRIBUTE_LABELS } from '../../utils/weaponConstants';
import { calculateWeaponWorkshopDiscount, applyDiscount } from '../../../../shared/utils/discounts';
import { getWeaponOptimalRange } from '../../utils/weaponRange';
import type { Weapon, WeaponFacility, StorageStatus, ViewMode } from './types';

export function useWeaponShop() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

  const isOnboarding = searchParams.get('onboarding') === 'true';

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
    rangeBands: [],
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
        // Filter out test weapons (Basic Laser is created by tests and shouldn't be purchasable)
        const filteredWeapons = weaponsResponse.data.filter((w: Weapon) =>
          w.name !== 'Basic Laser' && w.cost >= 10000 // Filter out test weapons with unrealistic prices
        );
        setWeapons(filteredWeapons);

        // Fetch owned weapons inventory
        const inventoryResponse = await apiClient.get('/api/weapon-inventory');
        const inventory = inventoryResponse.data;

        // Count owned weapons by weapon ID
        const ownedMap = new Map<number, number>();
        let equippedCount = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        const weaponWorkshop = facilities.find((f: WeaponFacility) => f.type === 'weapons_workshop');
        setWeaponWorkshopLevel(weaponWorkshop?.currentLevel || 0);

        // Fetch storage status
        const storageResponse = await apiClient.get('/api/weapon-inventory/storage-status');
        setStorageStatus(storageResponse.data);
      } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
    } else if (filterType === 'rangeBand' && value) {
      newFilters.rangeBands = newFilters.rangeBands.filter(b => b !== value);
    } else if (filterType === 'priceRange') {
      newFilters.priceRange = null;
    } else if (filterType === 'canAfford') {
      newFilters.canAffordOnly = false;
    } else if (filterType === 'onlyOwned') {
      newFilters.onlyOwnedWeapons = false;
    }

    setFilters(newFilters);
  };

  // Search weapons by name, description, type
  const searchWeapons = (weaponList: Weapon[], query: string): Weapon[] => {
    if (!query.trim()) return weaponList;

    const lowerQuery = query.toLowerCase();
    return weaponList.filter(weapon =>
      weapon.name.toLowerCase().includes(lowerQuery) ||
      weapon.description.toLowerCase().includes(lowerQuery) ||
      weapon.weaponType.toLowerCase().includes(lowerQuery) ||
      weapon.loadoutType.toLowerCase().replace('_', ' ').includes(lowerQuery)
    );
  };

  // Calculate discounted price
  const calculateDiscountedPrice = (basePrice: number): number => {
    const discountPercent = calculateWeaponWorkshopDiscount(weaponWorkshopLevel);
    return applyDiscount(basePrice, discountPercent);
  };

  // Sort weapons
  const sortWeapons = (weaponList: Weapon[], sortOption: string): Weapon[] => {
    const sorted = [...weaponList];

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
      case 'dps-desc': {
        const getDPS = (w: Weapon) => w.baseDamage / w.cooldown;
        return sorted.sort((a, b) => getDPS(b) - getDPS(a));
      }
      default:
        return sorted;
    }
  };

  // Helper function to check if weapon is compatible with a loadout type
  const isWeaponCompatibleWithLoadout = (weapon: Weapon, loadoutType: string): boolean => {
    const { handsRequired, weaponType } = weapon;
    const isOneHandedWeapon = () => handsRequired === 'one' && weaponType !== 'shield';

    switch (loadoutType) {
      case 'single':
        return isOneHandedWeapon();
      case 'weapon_shield':
        return isOneHandedWeapon() || (handsRequired === 'shield' && weaponType === 'shield');
      case 'two_handed':
        return handsRequired === 'two';
      case 'dual_wield':
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
      if (filters.loadoutTypes.length > 0) {
        const isCompatible = filters.loadoutTypes.some(loadoutType =>
          isWeaponCompatibleWithLoadout(weapon, loadoutType)
        );
        if (!isCompatible) return false;
      }

      if (filters.weaponTypes.length > 0) {
        if (!filters.weaponTypes.includes(weapon.weaponType)) return false;
      }

      if (filters.rangeBands.length > 0) {
        const weaponRange = getWeaponOptimalRange(weapon);
        if (!filters.rangeBands.includes(weaponRange)) return false;
      }

      if (filters.priceRange) {
        const discountedPrice = calculateDiscountedPrice(weapon.cost);
        if (discountedPrice < filters.priceRange.min || discountedPrice > filters.priceRange.max) return false;
      }

      if (filters.canAffordOnly && user) {
        const discountedPrice = calculateDiscountedPrice(weapon.cost);
        if (user.currency < discountedPrice) return false;
      }

      if (filters.onlyOwnedWeapons) {
        const ownedCount = ownedWeapons.get(weapon.id) || 0;
        if (ownedCount === 0) return false;
      }

      return true;
    });

    // Step 3: Sort (for card view)
    if (viewMode === 'card') {
      result = sortWeapons(result, sortBy);
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inventory.forEach((item: any) => {
            const wId = item.weaponId;
            ownedMap.set(wId, (ownedMap.get(wId) || 0) + 1);
          });
          setOwnedWeapons(ownedMap);

          // Update onboarding state if in onboarding mode
          if (isOnboarding) {
            try {
              const existingState = await apiClient.get('/api/onboarding/state');
              const currentChoices = existingState.data?.data?.choices || {};
              const weaponsPurchased = currentChoices.weaponsPurchased || [];
              await apiClient.post('/api/onboarding/state', {
                choices: {
                  ...currentChoices,
                  weaponsPurchased: [...weaponsPurchased, weaponId],
                },
              });
            } catch {
              // Non-critical: onboarding state update failed, continue anyway
            }
          }

          // Show success message
          setConfirmationModal({
            isOpen: true,
            title: 'Purchase Successful',
            message: isOnboarding
              ? `${weaponName} purchased successfully! You can continue shopping or return to the tutorial when ready.`
              : `${weaponName} purchased successfully!`,
            onConfirm: () => {
              setConfirmationModal(prev => ({ ...prev, isOpen: false }));
            },
          });

          // Close detail modal if open
          if (selectedWeapon?.id === weaponId) {
            setSelectedWeapon(null);
          }
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
      return prev;
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

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'energy': return 'text-primary';
      case 'ballistic': return 'text-orange-400';
      case 'melee': return 'text-error';
      case 'explosive': return 'text-warning';
      default: return 'text-secondary';
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

  const getLoadoutTypeLabel = (loadoutType: string): string => {
    switch (loadoutType) {
      case 'shield': return 'Shield';
      case 'two_handed': return 'Two-Handed';
      case 'one_handed': return 'One-Handed (Single, Dual Wield, or with Shield)';
      default: return loadoutType;
    }
  };

  const getLoadoutTypeColor = (loadoutType: string): string => {
    switch (loadoutType) {
      case 'shield': return 'text-cyan-400';
      case 'two_handed': return 'text-purple-400';
      case 'one_handed': return 'text-success';
      default: return 'text-secondary';
    }
  };

  const groupedWeapons = {
    shield: processedWeapons.filter(w => w.loadoutType === 'weapon_shield' && w.weaponType === 'shield'),
    two_handed: processedWeapons.filter(w => w.loadoutType === 'two_handed'),
    one_handed: processedWeapons.filter(w => w.loadoutType === 'single'),
  };

  return {
    user,
    weapons,
    processedWeapons,
    groupedWeapons,
    ownedWeapons,
    equippedWeaponsCount,
    weaponWorkshopLevel,
    storageStatus,
    loading,
    error,
    purchasing,
    selectedWeapon, setSelectedWeapon,
    viewMode,
    filters,
    selectedForComparison,
    showComparisonModal, setShowComparisonModal,
    confirmationModal, setConfirmationModal,
    handleViewModeChange,
    handleFiltersChange,
    handleRemoveFilter,
    handlePurchase,
    calculateDiscountedPrice,
    toggleComparison,
    handleCompare,
    handleClearComparison,
    handleRemoveFromComparison,
    getTypeColor,
    getAttributeBonuses,
    getLoadoutTypeLabel,
    getLoadoutTypeColor,
  };
}
