/**
 * Custom hook for fetching and managing robot detail page data.
 * Extracts the data-fetching logic from RobotDetailPage to keep the component focused on rendering.
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import apiClient from '../utils/apiClient';
import { useRobotStore } from '../stores';
import { useAuth } from '../contexts/AuthContext';
import { getMatchHistory } from '../utils/matchmakingApi';
import type { Facility } from '../components/facilities/types';

// Re-export types so the page doesn't need to define them
export interface RobotUser {
  id: number;
  username: string;
  stableName?: string;
}

export interface RobotWeapon {
  id: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    baseDamage: number;
    handsRequired: string;
    rangeBand: string;
  };
}

export interface Robot {
  id: number;
  name: string;
  userId: number;
  elo: number;
  currentLeague: string;
  leagueId: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  fame: number;
  kills: number;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  mainWeapon: RobotWeapon | null;
  offhandWeapon: RobotWeapon | null;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  imageUrl: string | null;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  totalRepairsPaid: number;
  titles: string | null;
  user: RobotUser;
  // Attributes (Decimal fields serialized as numbers)
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

export interface WeaponInventory {
  id: number;
  weaponId: number;
  weapon: {
    id: number;
    name: string;
    weaponType: string;
    baseDamage: number;
    cost: number;
    handsRequired: string;
    rangeBand: string;
  };
}

export interface AcademyLevels {
  combat_training_academy: number;
  defense_training_academy: number;
  mobility_training_academy: number;
  ai_training_academy: number;
}

export interface BattleReadiness {
  isReady: boolean;
  warnings: string[];
}

export interface LeagueRank {
  rank: number;
  total: number;
  percentile: number;
}

export interface UseRobotDetailResult {
  robot: Robot | null;
  setRobot: React.Dispatch<React.SetStateAction<Robot | null>>;
  weapons: WeaponInventory[];
  currency: number;
  trainingLevel: number;
  repairBayLevel: number;
  activeRobotCount: number;
  academyLevels: AcademyLevels;
  loading: boolean;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  recentBattles: unknown[];
  battleReadiness: BattleReadiness;
  leagueRank: LeagueRank | null;
  refetch: () => Promise<void>;
}

export function useRobotDetail(robotId: string | undefined): UseRobotDetailResult {
  const [robot, setRobot] = useState<Robot | null>(null);
  const [weapons, setWeapons] = useState<WeaponInventory[]>([]);
  const [currency, setCurrency] = useState(0);
  const [trainingLevel, setTrainingLevel] = useState(0);
  const [repairBayLevel, setRepairBayLevel] = useState(0);
  const [activeRobotCount, setActiveRobotCount] = useState(1);
  const [academyLevels, setAcademyLevels] = useState<AcademyLevels>({
    combat_training_academy: 0,
    defense_training_academy: 0,
    mobility_training_academy: 0,
    ai_training_academy: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentBattles, setRecentBattles] = useState<unknown[]>([]);
  const [battleReadiness, setBattleReadiness] = useState<BattleReadiness>({ isReady: true, warnings: [] });
  const [leagueRank, setLeagueRank] = useState<LeagueRank | null>(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      setCurrency(user.currency);
    }
  }, [user]);

  const fetchRobotAndWeapons = useCallback(async () => {
    if (!robotId) return;

    try {
      const robotResponse = await apiClient.get(`/api/robots/${robotId}`);
      const robotData = robotResponse.data;
      setRobot(robotData);

      // Fetch league rank (non-blocking)
      try {
        const leagueResponse = await apiClient.get(
          `/api/leagues/${robotData.currentLeague}/standings?instance=${robotData.leagueId}`,
        );
        const standings = leagueResponse.data.data || [];
        const robotIndex = standings.findIndex((r: { id: number }) => r.id === parseInt(robotId));
        if (robotIndex !== -1) {
          const rank = robotIndex + 1;
          const total = standings.length;
          setLeagueRank({ rank, total, percentile: total > 0 ? ((total - rank) / total) * 100 : 0 });
        }
      } catch {
        // League rank is non-critical
      }

      // Fetch weapon inventory (non-blocking)
      try {
        const weaponsResponse = await apiClient.get('/api/weapon-inventory');
        setWeapons(weaponsResponse.data);
      } catch {
        // Weapons are non-critical for page load
      }

      // Fetch facilities (non-blocking)
      try {
        const facilitiesResponse = await apiClient.get('/api/facilities');
        const data = facilitiesResponse.data;
        const facilities = data.facilities || data;

        const findLevel = (type: string) =>
          facilities.find((f: Facility) => f.type === type)?.currentLevel || 0;

        setTrainingLevel(findLevel('training_facility'));
        setRepairBayLevel(findLevel('repair_bay'));
        setAcademyLevels({
          combat_training_academy: findLevel('combat_training_academy'),
          defense_training_academy: findLevel('defense_training_academy'),
          mobility_training_academy: findLevel('mobility_training_academy'),
          ai_training_academy: findLevel('ai_training_academy'),
        });

        // Fetch active robot count via store
        try {
          const storeState = useRobotStore.getState();
          if (storeState.robots.length === 0) {
            await storeState.fetchRobots();
          }
          const robotsData = useRobotStore.getState().robots;
          setActiveRobotCount(robotsData.filter((r) => r.name !== 'Bye Robot').length);
        } catch {
          // Non-critical
        }
      } catch {
        // Facilities are non-critical
      }

      // Fetch recent battles (non-blocking)
      try {
        const recentBattlesData = await getMatchHistory(1, 10, undefined, parseInt(robotId));
        setRecentBattles(recentBattlesData.data);
      } catch {
        // Non-critical
      }

      // Calculate battle readiness
      const hpPercentage = (robotData.currentHP / robotData.maxHP) * 100;
      const hasWeapons = robotData.mainWeaponId !== null;
      const warnings: string[] = [];
      if (hpPercentage < 50) warnings.push('HP below 50%');
      if (!hasWeapons) warnings.push('No weapons equipped');
      setBattleReadiness({ isReady: hpPercentage >= 50 && hasWeapons, warnings });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          logout();
          return;
        }
        if (err.response?.status === 404) {
          setError(`Robot with ID ${robotId} not found.`);
          setLoading(false);
          return;
        }
      }
      setError('Failed to load robot details');
    } finally {
      setLoading(false);
    }
  }, [robotId, logout]);

  // Debounced fetch with visibility/focus re-fetch
  useEffect(() => {
    let isFetching = false;
    let fetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const debouncedFetch = () => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      if (isFetching) return;

      fetchTimeout = setTimeout(() => {
        isFetching = true;
        fetchRobotAndWeapons().finally(() => {
          isFetching = false;
        });
      }, 100);
    };

    debouncedFetch();

    const handleVisibilityChange = () => {
      if (!document.hidden) debouncedFetch();
    };
    const handleFocus = () => debouncedFetch();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (fetchTimeout) clearTimeout(fetchTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchRobotAndWeapons]);

  return {
    robot,
    setRobot,
    weapons,
    currency,
    trainingLevel,
    repairBayLevel,
    activeRobotCount,
    academyLevels,
    loading,
    error,
    setError,
    recentBattles,
    battleReadiness,
    leagueRank,
    refetch: fetchRobotAndWeapons,
  };
}
