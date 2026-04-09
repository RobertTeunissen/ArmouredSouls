import { describe, it, expect } from 'vitest';
import {
  createMockRobot,
  createMockRobots,
  createMockInstance,
  createMockInstances,
  createMockPaginatedResponse,
  mockUser,
} from './testUtils';

describe('Test Infrastructure', () => {
  describe('Mock Data Factories', () => {
    it('should create a mock robot with default values', () => {
      const robot = createMockRobot();
      
      expect(robot).toHaveProperty('id');
      expect(robot).toHaveProperty('name');
      expect(robot).toHaveProperty('elo');
      expect(robot).toHaveProperty('leaguePoints');
      expect(robot).toHaveProperty('wins');
      expect(robot).toHaveProperty('draws');
      expect(robot).toHaveProperty('losses');
      expect(robot).toHaveProperty('totalBattles');
      expect(robot).toHaveProperty('userId');
      expect(robot).toHaveProperty('user');
      expect(robot.user).toHaveProperty('username');
    });

    it('should create a mock robot with overrides', () => {
      const robot = createMockRobot({
        id: 999,
        name: 'CustomBot',
        elo: 2000,
        userId: 5,
      });
      
      expect(robot.id).toBe(999);
      expect(robot.name).toBe('CustomBot');
      expect(robot.elo).toBe(2000);
      expect(robot.userId).toBe(5);
    });

    it('should create multiple mock robots', () => {
      const robots = createMockRobots(5);
      
      expect(robots).toHaveLength(5);
      expect(robots[0].id).toBe(1);
      expect(robots[4].id).toBe(5);
      expect(robots[0].name).toBe('Robot1');
      expect(robots[4].name).toBe('Robot5');
    });

    it('should create a mock instance with default values', () => {
      const instance = createMockInstance();
      
      expect(instance).toHaveProperty('leagueId');
      expect(instance).toHaveProperty('leagueTier');
      expect(instance).toHaveProperty('currentRobots');
      expect(instance).toHaveProperty('maxRobots');
    });

    it('should create a mock instance with overrides', () => {
      const instance = createMockInstance({
        leagueId: 'gold_5',
        leagueTier: 'gold',
        currentRobots: 75,
        maxRobots: 150,
      });
      
      expect(instance.leagueId).toBe('gold_5');
      expect(instance.leagueTier).toBe('gold');
      expect(instance.currentRobots).toBe(75);
      expect(instance.maxRobots).toBe(150);
    });

    it('should create multiple mock instances', () => {
      const instances = createMockInstances('silver', 3);
      
      expect(instances).toHaveLength(3);
      expect(instances[0].leagueId).toBe('silver_1');
      expect(instances[1].leagueId).toBe('silver_2');
      expect(instances[2].leagueId).toBe('silver_3');
      expect(instances.every(i => i.leagueTier === 'silver')).toBe(true);
    });

    it('should create a mock paginated response', () => {
      const robots = createMockRobots(3);
      const response = createMockPaginatedResponse(robots, 1, 50);
      
      expect(response.data).toHaveLength(3);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.pageSize).toBe(50);
      expect(response.pagination.total).toBe(3);
      expect(response.pagination.totalPages).toBe(1);
    });

    it('should calculate total pages correctly in paginated response', () => {
      const robots = createMockRobots(125);
      const response = createMockPaginatedResponse(robots, 1, 50);
      
      expect(response.pagination.totalPages).toBe(3); // 125 / 50 = 2.5, rounded up to 3
    });
  });

  describe('Mock User', () => {
    it('should have required user properties', () => {
      expect(mockUser).toHaveProperty('id');
      expect(mockUser).toHaveProperty('username');
      expect(mockUser).toHaveProperty('role');
      expect(mockUser).toHaveProperty('currency');
      expect(mockUser).toHaveProperty('prestige');
    });

    it('should have valid default values', () => {
      expect(mockUser.id).toBe(1);
      expect(mockUser.username).toBe('testuser');
      expect(mockUser.role).toBe('user');
      expect(mockUser.currency).toBeGreaterThan(0);
      expect(mockUser.prestige).toBeGreaterThanOrEqual(0);
    });
  });
});
