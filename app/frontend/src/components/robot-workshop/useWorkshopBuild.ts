import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTuningAllocation, updateTuningAllocation } from '../../utils/robotApi';
import type { UpgradePlan as ApiUpgradePlan } from '../../utils/robotApi';
import {
  ALL_ATTRIBUTES,
  capFor,
  maxAllPlan,
  planTotal,
  plannedLevelOf,
  setPlannedLevel,
  tuningChanged,
  tuningMaxAt,
  tuningOverflow,
  tuningTotal,
  type AcademyLevels,
  type AttributeValues,
  type CostContext,
  type TuningMap,
  type UpgradePlan,
} from '../../utils/workshopBuild';
import type { RobotAttributeKey } from '../../types/robot';

export interface TuningPool {
  poolSize: number;
  facilityLevel: number;
}

interface Options {
  robotId: number;
  values: AttributeValues;
  academyLevels: AcademyLevels;
  costs: CostContext;
  credits: number;
  /** Commits the upgrade plan (from `useRobotDetail`); throws on failure. */
  commitUpgrades: (plan: Record<string, ApiUpgradePlan>) => Promise<void>;
}

export interface WorkshopBuild {
  plan: UpgradePlan;
  tuning: TuningMap;
  savedTuning: TuningMap;
  pool: TuningPool | null;
  tuningError: boolean;
  upgradeCost: number;
  tuningUsed: number;
  tuningRemaining: number;
  hasChanges: boolean;
  /** Tuning differs from what is saved. */
  tuningDirty: boolean;
  saving: boolean;
  setLevel: (key: RobotAttributeKey, level: number) => void;
  maxAttribute: (key: RobotAttributeKey) => void;
  /** Max a group of attributes (one category) with the credits the rest of the plan leaves. */
  maxAttributes: (keys: readonly RobotAttributeKey[]) => void;
  maxAll: () => void;
  setTuning: (key: RobotAttributeKey, value: number) => void;
  resetTuning: () => void;
  discard: () => void;
  /** Commits upgrades, then saves tuning. Returns true when everything saved. */
  save: () => Promise<boolean>;
}

/**
 * State of the Build table: the upgrade plan and the tuning allocation, saved
 * together. Upgrades commit first (they cost credits); tuning that no longer
 * fits an upgraded attribute is trimmed to its new max before it is saved.
 */
export function useWorkshopBuild({ robotId, values, academyLevels, costs, credits, commitUpgrades }: Options): WorkshopBuild {
  const [plan, setPlan] = useState<UpgradePlan>({});
  const [tuning, setTuningState] = useState<TuningMap>({});
  const [savedTuning, setSavedTuning] = useState<TuningMap>({});
  const [pool, setPool] = useState<TuningPool | null>(null);
  const [tuningError, setTuningError] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTuning = useCallback(async (): Promise<void> => {
    // The page passes 0 until the robot has loaded; there is nothing to fetch yet.
    if (robotId <= 0) return;
    try {
      const state = await fetchTuningAllocation(robotId);
      setPool({ poolSize: state.poolSize, facilityLevel: state.facilityLevel });
      setTuningState({ ...state.allocations });
      setSavedTuning({ ...state.allocations });
      setTuningError(false);
    } catch {
      setTuningError(true);
    }
  }, [robotId]);

  // A different robot starts with a clean plan.
  useEffect(() => {
    setPlan({});
    setPool(null);
    void loadTuning();
  }, [loadTuning]);

  const upgradeCost = planTotal(plan);
  const tuningUsed = tuningTotal(tuning);
  const tuningRemaining = Math.max(0, (pool?.poolSize ?? 0) - tuningUsed);
  const tuningDirty = tuningChanged(tuning, savedTuning);
  const hasChanges = Object.keys(plan).length > 0 || tuningDirty;

  const setLevel = useCallback((key: RobotAttributeKey, level: number) => {
    setPlan((p) => setPlannedLevel(p, values, key, level, academyLevels, costs));
  }, [values, academyLevels, costs]);

  // Re-plan `keys` with the credits the rest of the plan leaves, spread round-robin.
  const maxAttributes = useCallback((keys: readonly RobotAttributeKey[]) => {
    setPlan((p) => {
      const next = { ...p };
      for (const key of keys) delete next[key];
      const group = maxAllPlan(values, academyLevels, credits - planTotal(next), costs, keys);
      for (const key of keys) {
        const planned = group[key];
        if (planned) next[key] = planned;
      }
      return next;
    });
  }, [values, academyLevels, credits, costs]);

  const maxAttribute = useCallback((key: RobotAttributeKey) => maxAttributes([key]), [maxAttributes]);

  const maxAll = useCallback(() => {
    setPlan(maxAllPlan(values, academyLevels, credits, costs));
  }, [values, academyLevels, credits, costs]);

  const setTuning = useCallback((key: RobotAttributeKey, value: number) => {
    setTuningState((t) => {
      const next = { ...t };
      if (value <= 0) delete next[key];
      else next[key] = Math.round(value * 100) / 100;
      return next;
    });
  }, []);

  const resetTuning = useCallback(() => setTuningState({}), []);

  const discard = useCallback(() => {
    setPlan({});
    setTuningState({ ...savedTuning });
  }, [savedTuning]);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      if (Object.keys(plan).length > 0) {
        await commitUpgrades(plan as Record<string, ApiUpgradePlan>);
      }
      const overflow = tuningOverflow(tuning, plan, academyLevels);
      const fitted: TuningMap = { ...tuning };
      for (const key of Object.keys(overflow) as RobotAttributeKey[]) {
        fitted[key] = tuningMaxAt(capFor(key, academyLevels), plannedLevelOf(plan, values, key));
      }
      setPlan({});
      if (tuningChanged(fitted, savedTuning) || Object.keys(overflow).length > 0) {
        const allocations: Record<string, number> = {};
        for (const { key } of ALL_ATTRIBUTES) allocations[key] = fitted[key] ?? 0;
        const state = await updateTuningAllocation(robotId, allocations);
        setTuningState({ ...state.allocations });
        setSavedTuning({ ...state.allocations });
      }
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [plan, tuning, savedTuning, values, academyLevels, robotId, commitUpgrades]);

  return useMemo(() => ({
    plan, tuning, savedTuning, pool, tuningError, upgradeCost, tuningUsed, tuningRemaining, hasChanges, tuningDirty, saving,
    setLevel, maxAttribute, maxAttributes, maxAll, setTuning, resetTuning, discard, save,
  }), [plan, tuning, savedTuning, pool, tuningError, upgradeCost, tuningUsed, tuningRemaining, hasChanges, tuningDirty, saving,
    setLevel, maxAttribute, maxAttributes, maxAll, setTuning, resetTuning, discard, save]);
}
