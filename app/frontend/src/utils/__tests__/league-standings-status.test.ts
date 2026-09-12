import { describe, expect, it } from 'vitest';
import { getLeaguePopulationWarning, LeaguePopulationStatus } from '../league-standings-status';

const BASE_STATUS: LeaguePopulationStatus = {
  minRobotsRequired: 10,
  totalEntities: 18,
  totalInstances: 2,
  activeInstances: 1,
  instancesBelowMinimum: 1,
  smallestInstancePopulation: 8,
};

describe('getLeaguePopulationWarning', () => {
  it('should report the selected instance population', () => {
    expect(getLeaguePopulationWarning(
      { ...BASE_STATUS, totalEntities: 8, totalInstances: 1, activeInstances: 0 },
      'robots',
      true,
    )).toBe('Promotion/demotion paused in this instance — need 10 robots, currently 8');
  });

  it('should say other instances remain active only for a mixed tier', () => {
    expect(getLeaguePopulationWarning(BASE_STATUS, 'teams', false)).toBe(
      'Promotion/demotion paused in 1 instance below 10 teams (smallest: 8). Other instances remain active.',
    );
  });

  it('should report when every populated instance is blocked', () => {
    expect(getLeaguePopulationWarning(
      { ...BASE_STATUS, activeInstances: 0, instancesBelowMinimum: 2, smallestInstancePopulation: 8 },
      'teams',
      false,
    )).toBe(
      'Promotion/demotion paused in all 2 instances — each needs 10 teams (smallest: 8).',
    );
  });

  it('should return no warning for an empty tier', () => {
    expect(getLeaguePopulationWarning(
      { ...BASE_STATUS, totalEntities: 0, totalInstances: 0, activeInstances: 0, instancesBelowMinimum: 0, smallestInstancePopulation: 0 },
      'robots',
      false,
    )).toBeNull();
  });
});
