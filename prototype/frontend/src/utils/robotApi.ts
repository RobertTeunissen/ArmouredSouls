import apiClient from './apiClient';

export interface Robot {
  id: number;
  name: string;
  imageUrl?: string | null;
  elo: number;
  fame: number;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  repairCost: number;
  level: number;
  currentLeague: string;
  leagueId: string | null;
  leaguePoints: number;
  userId: number;
  createdAt: string;
  wins: number;
  losses: number;
  draws: number;
  totalBattles: number;
  battleReadiness: number;
  yieldThreshold: number;
  loadoutType: string;
  mainWeaponId: number | null;
  offhandWeaponId: number | null;
  // Attributes
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
  // Weapons (optional includes)
  mainWeapon?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  offhandWeapon?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Fetch the authenticated user's robots.
 * This is the single source of truth — use this instead of calling GET /api/robots directly.
 */
export const fetchMyRobots = async (): Promise<Robot[]> => {
  const response = await apiClient.get('/api/robots');
  return response.data;
};

/**
 * Fetch all robots across all users (admin/public listing).
 */
export const fetchAllRobots = async (): Promise<Robot[]> => {
  const response = await apiClient.get('/api/robots/all/robots');
  return response.data;
};
