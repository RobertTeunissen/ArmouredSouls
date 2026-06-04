/**
 * Custom hook for Robots list page state management and data fetching.
 *
 * Extracted from RobotsPage.tsx during hook extraction (Backlog #50).
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { repairAllRobots } from '../utils/robotApi';
import { useRobotStore } from '../stores';
import { useStableOverview } from './useSubscriptions';
import type { Facility } from '../components/facilities/types';

// ─── Utility functions ───────────────────────────────────────────────────────

export const getHPColor = (currentHP: number, maxHP: number): string => {
  const percentage = (currentHP / maxHP) * 100;
  if (percentage >= 70) return 'bg-green-500';
  if (percentage >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
};

export const calculateWinRate = (wins: number, totalBattles: number): string => {
  if (totalBattles === 0) return '0.0';
  return ((wins / totalBattles) * 100).toFixed(1);
};

export const calculateReadiness = (currentHP: number, maxHP: number): number => {
  const hpPercent = (currentHP / maxHP) * 100;
  return Math.round(hpPercent);
};

export const isLoadoutComplete = (
  loadoutType: string,
  mainWeaponId: number | null,
  offhandWeaponId: number | null,
  offhandWeapon: { weapon: { weaponType: string } } | null
): { complete: boolean; reason: string } => {
  if (!mainWeaponId) {
    return { complete: false, reason: 'No Main Weapon' };
  }

  switch (loadoutType) {
    case 'single':
      return { complete: true, reason: '' };
    case 'two_handed':
      return { complete: true, reason: '' };
    case 'dual_wield':
      if (!offhandWeaponId) {
        return { complete: false, reason: 'Missing Offhand Weapon' };
      }
      return { complete: true, reason: '' };
    case 'weapon_shield':
      if (!offhandWeaponId) {
        return { complete: false, reason: 'Missing Shield' };
      }
      if (offhandWeapon && offhandWeapon.weapon.weaponType !== 'shield') {
        return { complete: false, reason: 'Offhand Must Be Shield' };
      }
      return { complete: true, reason: '' };
    default:
      return { complete: false, reason: 'Invalid Loadout Type' };
  }
};

export const getReadinessStatus = (
  currentHP: number,
  maxHP: number,
  loadoutType: string,
  mainWeaponId: number | null,
  offhandWeaponId: number | null,
  offhandWeapon: { weapon: { weaponType: string } } | null
): { text: string; color: string; reason: string } => {
  const readiness = calculateReadiness(currentHP, maxHP);
  const hpPercent = (currentHP / maxHP) * 100;

  const loadoutCheck = isLoadoutComplete(loadoutType, mainWeaponId, offhandWeaponId, offhandWeapon);
  if (!loadoutCheck.complete) {
    return { text: 'Not Ready', color: 'text-red-500', reason: loadoutCheck.reason };
  }

  if (readiness >= 80) {
    return { text: 'Battle Ready', color: 'text-green-500', reason: '' };
  }

  let reason = '';
  if (hpPercent < 80) {
    reason = 'Low HP';
  }

  if (readiness >= 50) {
    return { text: 'Damaged', color: 'text-yellow-500', reason };
  }

  return { text: 'Critical', color: 'text-red-500', reason };
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRobotsList() {
  const storeRobots = useRobotStore(state => state.robots);
  const storeLoading = useRobotStore(state => state.loading);
  const storeError = useRobotStore(state => state.error);
  const fetchRobots = useRobotStore(state => state.fetchRobots);

  const [repairBayLevel, setRepairBayLevel] = useState(0);
  const [rosterLevel, setRosterLevel] = useState(0);
  const [showRepairConfirmation, setShowRepairConfirmation] = useState(false);
  const [repairCostInfo, setRepairCostInfo] = useState({ discountedCost: 0, discount: 0, totalBaseCost: 0 });
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const saved = localStorage.getItem('robotsViewMode');
    return (saved as 'card' | 'table') || 'card';
  });
  const [sortColumn, setSortColumn] = useState<string>('elo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { refreshUser } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isOnboarding = searchParams.get('onboarding') === 'true';

  // Subscription data for EventBadge display
  const { data: subscriptionOverview } = useStableOverview();
  const subscriptionsByRobotId = useMemo(() => {
    const map: Record<number, string[]> = {};
    if (subscriptionOverview?.robots) {
      for (const robot of subscriptionOverview.robots) {
        map[robot.robotId] = robot.subscriptions.map(s => s.eventType);
      }
    }
    return map;
  }, [subscriptionOverview]);

  // Sort robots by ELO (highest first) as default
  const robots = useMemo(() => {
    return [...storeRobots].sort((a, b) => b.elo - a.elo);
  }, [storeRobots]);

  const loading = storeLoading;
  const error = storeError;

  useEffect(() => {
    fetchRobots();
    fetchFacilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Refetch facilities when page becomes visible
  useEffect(() => {
    const handleFocus = () => {
      fetchFacilities();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchFacilities = async (): Promise<void> => {
    try {
      const data = await api.get<{ facilities?: Facility[] } | Facility[]>('/api/facilities');
      const facilities = Array.isArray(data) ? data : (data.facilities ?? []);
      const repairBay = facilities.find((f: Facility) => f.type === 'repair_bay');
      if (repairBay) {
        setRepairBayLevel(repairBay.currentLevel || 0);
      }
      const rosterExpansion = facilities.find((f: Facility) => f.type === 'roster_expansion');
      if (rosterExpansion) {
        setRosterLevel(rosterExpansion.currentLevel || 0);
      }
    } catch {
      // Silently fail - facilities are optional
    }
  };

  const calculateTotalRepairCost = (): { totalBaseCost: number; discountedCost: number; discount: number } => {
    const REPAIR_COST_PER_HP = 50;

    const totalBaseCost = robots.reduce((sum, robot) => {
      if (robot.repairCost && robot.repairCost > 0) {
        return sum + robot.repairCost;
      }
      const hpDamage = robot.maxHP - robot.currentHP;
      if (hpDamage > 0) {
        return sum + (hpDamage * REPAIR_COST_PER_HP);
      }
      return sum;
    }, 0);

    const activeRobotCount = robots.filter(r => r.name !== 'Bye Robot').length;
    const discount = Math.min(90, repairBayLevel * (5 + activeRobotCount));
    const costAfterRepairBay = Math.floor(totalBaseCost * (1 - discount / 100));
    const MANUAL_REPAIR_DISCOUNT = 0.5;
    const discountedCost = Math.floor(costAfterRepairBay * MANUAL_REPAIR_DISCOUNT);

    return { totalBaseCost, discountedCost, discount };
  };

  const handleRepairAll = async (): Promise<void> => {
    const { totalBaseCost, discountedCost, discount } = calculateTotalRepairCost();

    if (discountedCost === 0) {
      alert('No robots need repair!');
      return;
    }

    setRepairCostInfo({ discountedCost, discount, totalBaseCost });
    setShowRepairConfirmation(true);
  };

  const confirmRepairAll = async (): Promise<void> => {
    try {
      await repairAllRobots();
      setShowRepairConfirmation(false);
      await Promise.all([fetchRobots(), refreshUser()]);
    } catch {
      alert('Failed to repair robots. Please try again.');
      setShowRepairConfirmation(false);
    }
  };

  const handleSort = (column: string): void => {
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
      let aValue: string | number;
      let bValue: string | number;

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

  const handleViewModeChange = (mode: 'card' | 'table'): void => {
    setViewMode(mode);
    localStorage.setItem('robotsViewMode', mode);
  };

  const { discountedCost, discount } = calculateTotalRepairCost();
  const needsRepair = discountedCost > 0;
  const maxRobots = rosterLevel + 1;
  const atCapacity = robots.length >= maxRobots;

  return {
    // Data
    robots,
    displayedRobots,
    loading,
    error,
    subscriptionsByRobotId,

    // Pagination / capacity
    maxRobots,
    atCapacity,

    // View mode
    viewMode,
    handleViewModeChange,

    // Sort (table view)
    sortColumn,
    sortDirection,
    handleSort,

    // Repair
    needsRepair,
    discountedCost,
    discount,
    showRepairConfirmation,
    repairCostInfo,
    handleRepairAll,
    confirmRepairAll,
    setShowRepairConfirmation,

    // Onboarding
    isOnboarding,
  };
}
