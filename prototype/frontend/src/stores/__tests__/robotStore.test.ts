import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRobotStore } from '../robotStore';
import type { Robot } from '../../utils/robotApi';

// Mock the robotApi module
vi.mock('../../utils/robotApi', () => ({
  fetchMyRobots: vi.fn(),
}));

// Import the mocked function after vi.mock
import { fetchMyRobots } from '../../utils/robotApi';
const mockFetchMyRobots = vi.mocked(fetchMyRobots);

const mockRobot: Robot = {
  id: 1,
  name: 'TestBot',
  imageUrl: null,
  elo: 1000,
  fame: 50,
  currentHP: 100,
  maxHP: 100,
  currentShield: 50,
  maxShield: 50,
  repairCost: 10,
  level: 1,
  currentLeague: 'Bronze',
  leagueId: 'bronze-1',
  leaguePoints: 100,
  userId: 1,
  createdAt: '2025-01-01T00:00:00Z',
  wins: 5,
  losses: 3,
  draws: 1,
  totalBattles: 9,
  battleReadiness: 100,
  yieldThreshold: 25,
  loadoutType: 'balanced',
  mainWeaponId: null,
  offhandWeaponId: null,
  combatPower: 10,
  targetingSystems: 10,
  criticalSystems: 10,
  penetration: 10,
  weaponControl: 10,
  attackSpeed: 10,
  armorPlating: 10,
  shieldCapacity: 10,
  evasionThrusters: 10,
  damageDampeners: 10,
  counterProtocols: 10,
  hullIntegrity: 10,
  servoMotors: 10,
  gyroStabilizers: 10,
  hydraulicSystems: 10,
  powerCore: 10,
  combatAlgorithms: 10,
  threatAnalysis: 10,
  adaptiveAI: 10,
  logicCores: 10,
  syncProtocols: 10,
};

describe('robotStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useRobotStore.setState({
      robots: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty robots array', () => {
      const { robots } = useRobotStore.getState();
      expect(robots).toEqual([]);
    });

    it('should have loading set to false', () => {
      const { loading } = useRobotStore.getState();
      expect(loading).toBe(false);
    });

    it('should have error set to null', () => {
      const { error } = useRobotStore.getState();
      expect(error).toBeNull();
    });
  });

  describe('fetchRobots', () => {
    it('should set loading to true while fetching', async () => {
      // Make fetchMyRobots hang so we can inspect intermediate state
      let resolve: (value: Robot[]) => void;
      mockFetchMyRobots.mockImplementation(
        () => new Promise<Robot[]>((r) => { resolve = r; })
      );

      const fetchPromise = useRobotStore.getState().fetchRobots();
      expect(useRobotStore.getState().loading).toBe(true);
      expect(useRobotStore.getState().error).toBeNull();

      resolve!([]);
      await fetchPromise;
    });

    it('should populate robots on success', async () => {
      const robots = [mockRobot, { ...mockRobot, id: 2, name: 'TestBot2' }];
      mockFetchMyRobots.mockResolvedValue(robots);

      await useRobotStore.getState().fetchRobots();

      const state = useRobotStore.getState();
      expect(state.robots).toEqual(robots);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on failure', async () => {
      mockFetchMyRobots.mockRejectedValue(new Error('Network error'));

      await useRobotStore.getState().fetchRobots();

      const state = useRobotStore.getState();
      expect(state.robots).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should handle non-Error rejection with fallback message', async () => {
      mockFetchMyRobots.mockRejectedValue('something went wrong');

      await useRobotStore.getState().fetchRobots();

      const state = useRobotStore.getState();
      expect(state.error).toBe('Failed to fetch robots');
      expect(state.loading).toBe(false);
    });

    it('should clear previous error on new fetch', async () => {
      // First call fails
      mockFetchMyRobots.mockRejectedValueOnce(new Error('fail'));
      await useRobotStore.getState().fetchRobots();
      expect(useRobotStore.getState().error).toBe('fail');

      // Second call succeeds
      mockFetchMyRobots.mockResolvedValueOnce([mockRobot]);
      await useRobotStore.getState().fetchRobots();

      const state = useRobotStore.getState();
      expect(state.error).toBeNull();
      expect(state.robots).toEqual([mockRobot]);
    });
  });

  describe('clear', () => {
    it('should reset state to initial values', async () => {
      // Populate the store first
      mockFetchMyRobots.mockResolvedValue([mockRobot]);
      await useRobotStore.getState().fetchRobots();
      expect(useRobotStore.getState().robots).toHaveLength(1);

      // Clear
      useRobotStore.getState().clear();

      const state = useRobotStore.getState();
      expect(state.robots).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should clear error state', () => {
      useRobotStore.setState({ error: 'some error' });
      useRobotStore.getState().clear();
      expect(useRobotStore.getState().error).toBeNull();
    });
  });
});
