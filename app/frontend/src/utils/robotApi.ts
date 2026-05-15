import { api } from './api';

export interface WeaponSlot {
  id: number;
  weaponId: number;
  customName?: string | null;
  purchasedAt: string;
  weapon: {
    id: number;
    name: string;
    baseDamage: number;
    cooldown: number;
    weaponType: string;
    rangeBand: string;
    damageType: string;
    handsRequired: string;
    loadoutType: string;
    cost: number;
    specialProperty?: string | null;
    description?: string | null;
  };
}

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
  mainWeapon?: WeaponSlot | null;
  offhandWeapon?: WeaponSlot | null;
}

export interface UpgradePlan {
  currentLevel: number;
  plannedLevel: number;
  cost?: number;
  baseCost?: number;
}

export interface LeagueHistoryEntry {
  cycleNumber: number;
  destinationTier: string;
  changeType: string;
  leaguePoints: number;
}

export interface TuningAllocationState {
  robotId: number;
  facilityLevel: number;
  poolSize: number;
  allocated: number;
  remaining: number;
  perAttributeMaxes: Record<string, number>;
  allocations: Record<string, number>;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's robots.
 */
export const fetchMyRobots = async (): Promise<Robot[]> => {
  return api.get<Robot[]>('/api/robots');
};

/**
 * Fetch all robots across all users (admin/public listing).
 */
export const fetchAllRobots = async (): Promise<Robot[]> => {
  return api.get<Robot[]>('/api/robots/all/robots');
};

/**
 * Fetch a single robot by ID.
 */
export const fetchRobotById = async (robotId: number): Promise<Robot> => {
  return api.get<Robot>(`/api/robots/${robotId}`);
};

/**
 * Fetch league history for a robot.
 */
export const fetchRobotLeagueHistory = async (robotId: number): Promise<{ data: LeagueHistoryEntry[] }> => {
  return api.get<{ data: LeagueHistoryEntry[] }>(`/api/robots/${robotId}/league-history`);
};

/**
 * Fetch performance context (leagues, tournaments, tag team) for a robot.
 */
export const fetchPerformanceContext = async (robotId: number): Promise<{
  leagues: unknown[];
  tournaments: unknown[];
  tagTeam: unknown | null;
}> => {
  return api.get(`/api/robots/${robotId}/performance-context`);
};

/**
 * Fetch statistical rankings for a robot.
 */
export const fetchRobotRankings = async (robotId: number): Promise<unknown> => {
  return api.get(`/api/robots/${robotId}/rankings`);
};

/**
 * Fetch tuning allocation state for a robot.
 */
export const fetchTuningAllocation = async (robotId: number): Promise<TuningAllocationState> => {
  return api.get<TuningAllocationState>(`/api/robots/${robotId}/tuning-allocation`);
};

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new robot with the given name.
 */
export const createRobot = async (name: string): Promise<{ robot: Robot }> => {
  return api.post<{ robot: Robot }>('/api/robots', { name });
};

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Update a robot's loadout type (two_handed, dual_wield, weapon_shield).
 */
export const updateLoadoutType = async (robotId: number, loadoutType: string): Promise<{ robot: Robot }> => {
  return api.put<{ robot: Robot }>(`/api/robots/${robotId}/loadout-type`, { loadoutType });
};

/**
 * Update a robot's battle stance.
 */
export const updateStance = async (robotId: number, stance: string): Promise<Robot> => {
  return api.patch<Robot>(`/api/robots/${robotId}/stance`, { stance });
};

/**
 * Update a robot's yield threshold.
 */
export const updateYieldThreshold = async (robotId: number, yieldThreshold: number): Promise<Robot> => {
  return api.patch<Robot>(`/api/robots/${robotId}/yield-threshold`, { yieldThreshold });
};

// ─── Weapons ─────────────────────────────────────────────────────────────────

/**
 * Equip a weapon in the main hand slot.
 */
export const equipMainWeapon = async (robotId: number, weaponInventoryId: number): Promise<{ robot: Robot }> => {
  return api.put<{ robot: Robot }>(`/api/robots/${robotId}/equip-main-weapon`, { weaponInventoryId });
};

/**
 * Equip a weapon in the offhand slot.
 */
export const equipOffhandWeapon = async (robotId: number, weaponInventoryId: number): Promise<{ robot: Robot }> => {
  return api.put<{ robot: Robot }>(`/api/robots/${robotId}/equip-offhand-weapon`, { weaponInventoryId });
};

/**
 * Unequip the main hand weapon.
 */
export const unequipMainWeapon = async (robotId: number): Promise<{ robot: Robot }> => {
  return api.delete<{ robot: Robot }>(`/api/robots/${robotId}/unequip-main-weapon`);
};

/**
 * Unequip the offhand weapon.
 */
export const unequipOffhandWeapon = async (robotId: number): Promise<{ robot: Robot }> => {
  return api.delete<{ robot: Robot }>(`/api/robots/${robotId}/unequip-offhand-weapon`);
};

// ─── Upgrades & Tuning ───────────────────────────────────────────────────────

/**
 * Commit attribute upgrades for a robot.
 */
export const commitUpgrades = async (
  robotId: number,
  upgrades: Record<string, UpgradePlan>,
): Promise<{ robot: Robot }> => {
  return api.post<{ robot: Robot }>(`/api/robots/${robotId}/upgrades`, { upgrades });
};

/**
 * Update tuning allocation for a robot.
 */
export const updateTuningAllocation = async (
  robotId: number,
  allocations: Record<string, number>,
): Promise<TuningAllocationState> => {
  return api.put<TuningAllocationState>(`/api/robots/${robotId}/tuning-allocation`, allocations);
};

// ─── Appearance ──────────────────────────────────────────────────────────────

/**
 * Update a robot's appearance (preset image URL).
 */
export const updateAppearance = async (robotId: number, imageUrl: string): Promise<{ robot: Robot }> => {
  return api.put<{ robot: Robot }>(`/api/robots/${robotId}/appearance`, { imageUrl });
};

/**
 * Upload a custom robot image (multipart form data).
 */
export const uploadRobotImage = async (
  robotId: number,
  file: File,
  acknowledgeRobotLikeness = false,
): Promise<{ preview: string; confirmationToken: string }> => {
  const formData = new FormData();
  formData.append('image', file);

  let url = `/api/robots/${robotId}/image`;
  if (acknowledgeRobotLikeness) {
    url += '?acknowledgeRobotLikeness=true';
  }

  return api.post<{ preview: string; confirmationToken: string }>(url, formData);
};

/**
 * Confirm a previously uploaded robot image.
 */
export const confirmRobotImage = async (
  robotId: number,
  confirmationToken: string,
): Promise<{ robot: Robot }> => {
  return api.put<{ robot: Robot }>(`/api/robots/${robotId}/image/confirm`, { confirmationToken });
};

// ─── Repair ──────────────────────────────────────────────────────────────────

/**
 * Repair all robots owned by the authenticated user.
 */
export const repairAllRobots = async (): Promise<void> => {
  return api.post<void>('/api/robots/repair-all', {});
};
