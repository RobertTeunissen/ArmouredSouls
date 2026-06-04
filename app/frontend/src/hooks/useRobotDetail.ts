/**
 * Custom hook for Robot Detail page state management and data fetching.
 *
 * Extracted from RobotDetailPage.tsx during hook extraction (Backlog #50).
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import {
  fetchRobotById,
  updateAppearance,
  commitUpgrades,
  equipMainWeapon,
  equipOffhandWeapon,
  unequipMainWeapon,
  unequipOffhandWeapon,
} from '../utils/robotApi';
import type { UpgradePlan } from '../utils/robotApi';
import { ApiError } from '../utils/ApiError';
import { useRobotStore } from '../stores';
import { useAuth } from '../contexts/AuthContext';
import type { TabId } from '../components/TabNavigation';
import type { Facility } from '../components/facilities/types';
import type { RangeBand } from '../utils/weaponRange';
import { getMatchHistory, BattleHistory } from '../utils/matchmakingApi';
import type { RobotWithAttributes } from '../types/robot';
import { createLogger } from '../utils/logger';

const log = createLogger('useRobotDetail');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RobotDetail {
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
  mainWeapon: WeaponInventoryItem | null;
  offhandWeapon: WeaponInventoryItem | null;
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

export interface WeaponInventoryItem {
  id: number;
  weapon: WeaponDetail;
  robotsMain?: Array<{ id: number; name: string }>;
  robotsOffhand?: Array<{ id: number; name: string }>;
}

export interface WeaponDetail {
  id: number;
  name: string;
  weaponType: string;
  loadoutType: string;
  handsRequired: string;
  rangeBand: RangeBand;
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

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRobotDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';

  const [robot, setRobot] = useState<RobotDetail | null>(null);
  const [weapons, setWeapons] = useState<WeaponInventoryItem[]>([]);
  const [currency, setCurrency] = useState(0);
  const [trainingLevel, setTrainingLevel] = useState(0);
  const [repairBayLevel, setRepairBayLevel] = useState(0);
  const [activeRobotCount, setActiveRobotCount] = useState(1);
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
  const [recentBattles, setRecentBattles] = useState<BattleHistory[]>([]);
  const [battleReadiness, setBattleReadiness] = useState<{ isReady: boolean; warnings: string[] }>({ isReady: true, warnings: [] });
  const [leagueRank, setLeagueRank] = useState<{ rank: number; total: number; percentile: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Tab state management from URL
  const tabParam = searchParams.get('tab') as TabId | null;
  const activeTab: TabId = tabParam || 'overview';

  const handleTabChange = (tab: TabId): void => {
    const params: Record<string, string> = { tab };
    if (isOnboarding) {
      params.onboarding = 'true';
    }
    setSearchParams(params);
  };

  useEffect(() => {
    let isFetching = false;
    let fetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const debouncedFetch = () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }
      if (isFetching) {
        return;
      }
      fetchTimeout = setTimeout(() => {
        isFetching = true;
        fetchRobotAndWeapons().finally(() => {
          isFetching = false;
        });
      }, 100);
    };

    debouncedFetch();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        debouncedFetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  const fetchRobotAndWeapons = async (): Promise<void> => {
    try {
      const robotData = await fetchRobotById(parseInt(id!));
      setRobot(robotData as unknown as RobotDetail);

      // Fetch league rank
      try {
        const leagueData = await api.get<{ data?: Array<{ id: number }> } | Array<{ id: number }>>(
          `/api/leagues/${robotData.currentLeague}/standings`,
          { params: { instance: robotData.leagueId } },
        );
        const standings = Array.isArray(leagueData) ? leagueData : (leagueData.data ?? []);
        const robotIndex = standings.findIndex((r: { id: number }) => r.id === parseInt(id!));

        if (robotIndex !== -1) {
          const rank = robotIndex + 1;
          const total = standings.length;
          const percentile = total > 0 ? ((total - rank) / total) * 100 : 0;
          setLeagueRank({ rank, total, percentile });
        }
      } catch (leagueError) {
        log.error('Failed to fetch league rank', { error: leagueError });
      }

      // Fetch weapon inventory
      try {
        const weaponsData = await api.get<WeaponInventoryItem[]>('/api/weapon-inventory');
        setWeapons(weaponsData);
      } catch (err) {
        log.error('Failed to fetch weapons', { err });
      }

      // Fetch facilities
      try {
        const data = await api.get<{ facilities?: Facility[] } | Facility[]>('/api/facilities');
        const facilities = Array.isArray(data) ? data : (data.facilities ?? []);

        const trainingFacility = facilities.find((f: Facility) => f.type === 'training_facility');
        setTrainingLevel(trainingFacility?.currentLevel || 0);

        const repairBay = facilities.find((f: Facility) => f.type === 'repair_bay');
        setRepairBayLevel(repairBay?.currentLevel || 0);

        setAcademyLevels({
          combat_training_academy: facilities.find((f: Facility) => f.type === 'combat_training_academy')?.currentLevel || 0,
          defense_training_academy: facilities.find((f: Facility) => f.type === 'defense_training_academy')?.currentLevel || 0,
          mobility_training_academy: facilities.find((f: Facility) => f.type === 'mobility_training_academy')?.currentLevel || 0,
          ai_training_academy: facilities.find((f: Facility) => f.type === 'ai_training_academy')?.currentLevel || 0,
        });

        // Fetch active robot count for repair cost calculation
        try {
          const storeState = useRobotStore.getState();
          if (storeState.robots.length === 0) {
            await storeState.fetchRobots();
          }
          const robotsData = useRobotStore.getState().robots;
          const activeCount = robotsData.filter((r) => r.name !== 'Bye Robot').length;
          setActiveRobotCount(activeCount);
        } catch (err) {
          log.error('Failed to fetch robots count', { err });
        }
      } catch (err) {
        log.error('Failed to fetch facilities', { err });
      }

      // Fetch recent battles
      try {
        const recentBattlesData = await getMatchHistory(1, 10, undefined, parseInt(id!));
        setRecentBattles(recentBattlesData.data);
      } catch (err) {
        log.error('Failed to fetch recent battles', { err });
      }

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
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          logout();
          navigate('/login');
          return;
        }
        if (err.statusCode === 404) {
          setError(`Robot with ID ${id} not found. It may have been deleted or you may not have permission to view it.`);
          setLoading(false);
          return;
        }
      }
      setError('Failed to load robot details');
    } finally {
      setLoading(false);
    }
  };

  const handleAppearanceChange = async (imageUrl: string): Promise<void> => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    // If the imageUrl starts with /uploads/, it was set by the upload confirm handler
    if (imageUrl.startsWith('/uploads/')) {
      setRobot({ ...robot, imageUrl });
      setSuccessMessage('Robot image updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }

    try {
      const result = await updateAppearance(parseInt(id!), imageUrl);
      setRobot(result.robot as unknown as RobotDetail);
      setSuccessMessage('Robot image updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : undefined;
      setError(message || 'Failed to update robot image');
    }
  };

  const handleCommitUpgrades = async (upgradePlan: Record<string, UpgradePlan>): Promise<void> => {
    if (!robot) return;

    setError('');
    setSuccessMessage('');

    const originalRobot = { ...robot };

    try {
      // Optimistic UI update
      const optimisticRobot = { ...robot };
      for (const [attribute, plan] of Object.entries(upgradePlan)) {
        const { plannedLevel } = plan;
        (optimisticRobot as Record<string, unknown>)[attribute] = plannedLevel;
      }
      setRobot(optimisticRobot);

      const result = await commitUpgrades(parseInt(id!), upgradePlan);
      setRobot(result.robot as unknown as RobotDetail);
      await refreshUser();

      const upgradeCount = Object.keys(upgradePlan).length;
      setToast({
        message: `Successfully upgraded ${upgradeCount} attribute${upgradeCount > 1 ? 's' : ''}!`,
        type: 'success',
      });
    } catch (err: unknown) {
      // Rollback optimistic update
      setRobot(originalRobot);

      let errorMessage = 'Failed to commit upgrades';
      let errorDetails = '';
      if (err instanceof ApiError) {
        errorMessage = err.message || errorMessage;
        if (err.details && typeof err.details === 'object' && 'required' in err.details) {
          const details = err.details as { required: number; current: number };
          errorDetails = ` (Required: ₡${details.required.toLocaleString()}, Current: ₡${details.current.toLocaleString()})`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setToast({
        message: errorMessage + errorDetails,
        type: 'error',
      });

      await fetchRobotAndWeapons();
      throw err;
    }
  };

  const handleEquipWeapon = async (slot: 'main' | 'offhand', weaponInventoryId: number): Promise<void> => {
    const result = slot === 'main'
      ? await equipMainWeapon(parseInt(id!), weaponInventoryId)
      : await equipOffhandWeapon(parseInt(id!), weaponInventoryId);

    setRobot(result.robot as unknown as RobotDetail);
    setSuccessMessage('Weapon equipped successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleUnequipWeapon = async (slot: 'main' | 'offhand'): Promise<void> => {
    const result = slot === 'main'
      ? await unequipMainWeapon(parseInt(id!))
      : await unequipOffhandWeapon(parseInt(id!));

    setRobot(result.robot as unknown as RobotDetail);
    setSuccessMessage('Weapon unequipped!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleRobotUpdate = (updates: Partial<RobotWithAttributes>): void => {
    if (robot) {
      setRobot({ ...robot, ...updates } as RobotDetail);
      setSuccessMessage('Configuration updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const isOwner = user && robot ? robot.userId === user.id : false;

  return {
    // Core data
    robot,
    weapons,
    currency,
    loading,
    error,
    successMessage,

    // Facilities
    trainingLevel,
    repairBayLevel,
    activeRobotCount,
    academyLevels,

    // Battle data
    recentBattles,
    battleReadiness,
    leagueRank,

    // Tab state
    activeTab,
    handleTabChange,

    // Image selector
    showImageSelector,
    setShowImageSelector,
    handleAppearanceChange,

    // Upgrades
    handleCommitUpgrades,

    // Weapon equip/unequip
    handleEquipWeapon,
    handleUnequipWeapon,

    // Robot updates
    handleRobotUpdate,

    // Toast
    toast,
    setToast,

    // Ownership & navigation context
    isOwner,
    isOnboarding,
    navigate,
    id,
  };
}
