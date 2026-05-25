/**
 * usePracticeArena — encapsulates all Practice Arena page-level state,
 * data fetching, cycle polling, and simulation execution.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePracticeHistory, type PracticeHistoryEntry } from '../../hooks/usePracticeHistory';
import { api } from '../../utils/api';
import { ApiError } from '../../utils/ApiError';
import { fetchMyRobots } from '../../utils/robotApi';
import type {
  OwnedRobot,
  SparringPartnerDef,
  SlotState,
  PracticeBattleResult,
  PracticeBatchResult,
} from './types';
import { DEFAULT_SPARRING } from './constants';

function makeDefaultSlot(): SlotState {
  return {
    mode: 'owned',
    robotId: null,
    overrides: {},
    sparringConfig: { ...DEFAULT_SPARRING },
  };
}

export interface UsePracticeArenaReturn {
  // Data
  robots: OwnedRobot[];
  sparringDefs: SparringPartnerDef[];
  loadingInit: boolean;
  // Slots
  slot1: SlotState;
  slot2: SlotState;
  setSlot1: (s: SlotState) => void;
  setSlot2: (s: SlotState) => void;
  // Battle controls
  batchCount: number;
  setBatchCount: (n: number) => void;
  running: boolean;
  runProgress: string;
  canRun: boolean;
  handleRun: () => void;
  handleReRun: () => void;
  // Results
  battleResult: PracticeBattleResult | null;
  batchResult: PracticeBatchResult | null;
  error: string | null;
  cycleOffline: boolean;
  ownedRobotName: string | undefined;
  // History
  historyResults: PracticeHistoryEntry[];
  clearHistory: () => void;
  // Facilities
  trainingLevel: number;
  academyLevels: {
    combat_training_academy: number;
    defense_training_academy: number;
    mobility_training_academy: number;
    ai_training_academy: number;
  };
}

export function usePracticeArena(userId: number): UsePracticeArenaReturn {
  const { results: historyResults, addResult, clearHistory } = usePracticeHistory(userId);

  // Data
  const [robots, setRobots] = useState<OwnedRobot[]>([]);
  const [sparringDefs, setSparringDefs] = useState<SparringPartnerDef[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);

  // Slots
  const [slot1, setSlot1] = useState<SlotState>(makeDefaultSlot());
  const [slot2, setSlot2] = useState<SlotState>(() => ({
    ...makeDefaultSlot(),
    mode: 'sparring',
  }));

  // Battle
  const [batchCount, setBatchCount] = useState(1);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [battleResult, setBattleResult] = useState<PracticeBattleResult | null>(null);
  const [batchResult, setBatchResult] = useState<PracticeBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cycle unavailability
  const [cycleOffline, setCycleOffline] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Facilities
  const [trainingLevel, setTrainingLevel] = useState(0);
  const [academyLevels, setAcademyLevels] = useState({
    combat_training_academy: 0,
    defense_training_academy: 0,
    mobility_training_academy: 0,
    ai_training_academy: 0,
  });

  // Last config for re-run
  const lastConfigRef = useRef<{ slot1: SlotState; slot2: SlotState; count: number } | null>(null);

  // ---- Fetch initial data ----
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [robotsData, sparringData, facData] = await Promise.all([
          fetchMyRobots(),
          api.get<{ sparringPartners?: SparringPartnerDef[] } | SparringPartnerDef[]>('/api/practice-arena/sparring-partners'),
          api.get<{ facilities?: Array<{ type: string; currentLevel: number }> } | Array<{ type: string; currentLevel: number }>>('/api/facilities').catch(() => [] as Array<{ type: string; currentLevel: number }>),
        ]);
        setRobots(robotsData as unknown as OwnedRobot[]);
        const defs = Array.isArray(sparringData) ? sparringData : (sparringData.sparringPartners ?? []);
        setSparringDefs(defs);

        const facilities = Array.isArray(facData) ? facData : (facData.facilities ?? []);
        const tf = facilities.find((f) => f.type === 'training_facility');
        setTrainingLevel(tf?.currentLevel || 0);
        setAcademyLevels({
          combat_training_academy: facilities.find((f) => f.type === 'combat_training_academy')?.currentLevel || 0,
          defense_training_academy: facilities.find((f) => f.type === 'defense_training_academy')?.currentLevel || 0,
          mobility_training_academy: facilities.find((f) => f.type === 'mobility_training_academy')?.currentLevel || 0,
          ai_training_academy: facilities.find((f) => f.type === 'ai_training_academy')?.currentLevel || 0,
        });
      } catch {
        // Silently handle
      } finally {
        setLoadingInit(false);
      }
    };
    fetchData();
  }, []);

  // ---- Cycle polling cleanup ----
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const startCyclePoll = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        await api.get('/api/practice-arena/sparring-partners');
        setCycleOffline(false);
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch {
        // Still offline
      }
    }, 15000);
  }, []);

  // ---- Build request payload ----
  const buildSlotPayload = (slot: SlotState) => {
    if (slot.mode === 'owned') {
      const payload: Record<string, unknown> = { type: 'owned', robotId: slot.robotId };
      const o = slot.overrides;
      if (o && (o.attributes || o.loadoutType || o.stance || o.yieldThreshold !== undefined || o.mainWeaponId || o.offhandWeaponId || o.tuningBonuses)) {
        const { simulatedAcademyLevels: _ignored, ...backendOverrides } = o;
        payload.overrides = backendOverrides;
      }
      return payload;
    }
    return { type: 'sparring', config: slot.sparringConfig };
  };

  const isSlotValid = (slot: SlotState): boolean => {
    if (slot.mode === 'owned') {
      if (slot.robotId === null) return false;
      const robot = robots.find(r => r.id === slot.robotId);
      return !!robot?.mainWeaponId;
    }
    return true;
  };

  const canRun = isSlotValid(slot1) && isSlotValid(slot2) && !running && !cycleOffline
    && (slot1.mode === 'owned' || slot2.mode === 'owned');

  const getOwnedRobotName = (): string | undefined => {
    if (slot1.mode === 'owned' && slot1.robotId) return robots.find(r => r.id === slot1.robotId)?.name;
    if (slot2.mode === 'owned' && slot2.robotId) return robots.find(r => r.id === slot2.robotId)?.name;
    return undefined;
  };
  const ownedRobotName = getOwnedRobotName();

  // ---- Run simulation ----
  const runSimulation = useCallback(async (s1: SlotState, s2: SlotState, count: number) => {
    setRunning(true);
    setError(null);
    setBattleResult(null);
    setBatchResult(null);
    setRunProgress(count > 1 ? `Simulating battle 1 of ${count}...` : 'Running combat simulation...');
    lastConfigRef.current = { slot1: s1, slot2: s2, count };

    try {
      const payload = {
        robot1: buildSlotPayload(s1),
        robot2: buildSlotPayload(s2),
        count,
      };

      const data = await api.post<PracticeBattleResult | PracticeBatchResult & { results?: PracticeBattleResult[] }>(
        '/api/practice-arena/battle',
        payload,
      ) as PracticeBattleResult | PracticeBatchResult;

      const toHistoryEntry = (r: PracticeBattleResult) => {
        const cr = r.combatResult;
        return {
          timestamp: new Date().toISOString(),
          combatResult: {
            winnerId: cr.winnerId,
            robot1FinalHP: cr.robot1FinalHP,
            robot2FinalHP: cr.robot2FinalHP,
            robot1FinalShield: cr.robot1FinalShield ?? 0,
            robot2FinalShield: cr.robot2FinalShield ?? 0,
            robot1Damage: cr.robot1Damage ?? 0,
            robot2Damage: cr.robot2Damage ?? 0,
            robot1DamageDealt: cr.robot1DamageDealt ?? 0,
            robot2DamageDealt: cr.robot2DamageDealt ?? 0,
            durationSeconds: cr.durationSeconds,
            isDraw: cr.isDraw,
          },
          robot1: r.robot1Info,
          robot2: r.robot2Info,
        };
      };

      if (count > 1 && 'results' in data && data.results) {
        const batch = data as PracticeBatchResult;
        setBatchResult(batch);
        setBattleResult(batch.results[0] || null);
        batch.results.forEach((r) => addResult(toHistoryEntry(r)));
      } else {
        const single = ('results' in data && data.results ? data.results[0] : data) as PracticeBattleResult;
        setBattleResult(single);
        addResult(toHistoryEntry(single));
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const status = err.statusCode;
        const details = err.details as { code?: string; retryAfter?: number; remaining?: number } | undefined;

        if (status === 503 && err.code === 'CYCLE_IN_PROGRESS') {
          setCycleOffline(true);
          startCyclePoll();
          setError(null);
        } else if (status === 429) {
          const retrySeconds = details?.retryAfter || 900;
          const minutes = Math.ceil(retrySeconds / 60);
          const remaining = details?.remaining ?? 0;
          setError(`Rate limit reached (${remaining} battles remaining). Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
        } else {
          setError(err.message || 'Simulation failed. Please try again.');
        }
      } else {
        setError('Network error. Please check your connection.');
      }
    } finally {
      setRunning(false);
      setRunProgress('');
    }
  }, [addResult, startCyclePoll]);

  const handleRun = () => runSimulation(slot1, slot2, batchCount);

  const handleReRun = () => {
    if (lastConfigRef.current) {
      runSimulation(lastConfigRef.current.slot1, lastConfigRef.current.slot2, lastConfigRef.current.count);
    }
  };

  return {
    robots, sparringDefs, loadingInit,
    slot1, slot2, setSlot1, setSlot2,
    batchCount, setBatchCount, running, runProgress, canRun,
    handleRun, handleReRun,
    battleResult, batchResult, error, cycleOffline, ownedRobotName,
    historyResults, clearHistory,
    trainingLevel, academyLevels,
  };
}
