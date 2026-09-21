export interface LeaguePopulationStatus {
  minRobotsRequired: number;
  totalEntities: number;
  totalInstances: number;
  activeInstances: number;
  instancesBelowMinimum: number;
  smallestInstancePopulation: number;
}

/** Returns precise population-gate copy for selected-instance and tier-wide views. */
export function getLeaguePopulationWarning(
  status: LeaguePopulationStatus,
  entityLabel: 'robots' | 'teams',
  selectedInstance: boolean,
): string | null {
  if (status.totalInstances === 0 || status.instancesBelowMinimum === 0) return null;

  if (selectedInstance) {
    return `Promotion/demotion paused in this instance — need ${status.minRobotsRequired} ${entityLabel}, currently ${status.totalEntities}`;
  }

  if (status.activeInstances === 0) {
    return `Promotion/demotion paused in all ${status.totalInstances} instance${status.totalInstances === 1 ? '' : 's'} — each needs ${status.minRobotsRequired} ${entityLabel} (smallest: ${status.smallestInstancePopulation}).`;
  }

  return `Promotion/demotion paused in ${status.instancesBelowMinimum} instance${status.instancesBelowMinimum === 1 ? '' : 's'} below ${status.minRobotsRequired} ${entityLabel} (smallest: ${status.smallestInstancePopulation}). Other instances remain active.`;
}
