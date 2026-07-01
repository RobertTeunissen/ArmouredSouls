/**
 * Economy System — Pure Calculation Functions
 *
 * Deterministic, side-effect-free functions for the economy system.
 * No database access — suitable for unit testing without mocks.
 *
 * Service-layer logic (Prisma queries, financial processing) lives in
 * `src/services/economy/` and `src/utils/economyCalculations.ts`.
 */

// ==================== OPERATING COSTS ====================

/** Named constants for facility operating costs (credits/day per level). */
const FACILITY_OPERATING_COSTS: Record<string, (level: number) => number> = {
  repair_bay: (level) => 1000 + (level - 1) * 500,
  training_facility: (level) => 250 * level,
  weapons_workshop: (level) => 100 * level,
  roster_expansion: () => 0, // Calculated separately based on actual roster size
  storage_facility: (level) => 500 + (level - 1) * 250,
  booking_office: (level) => 150 * level,
  combat_training_academy: (level) => 250 * level,
  defense_training_academy: (level) => 250 * level,
  mobility_training_academy: (level) => 250 * level,
  ai_training_academy: (level) => 250 * level,
  merchandising_hub: (level) => 200 * level,
  streaming_studio: (level) => 100 * level,
  tuning_bay: (level) => 300 * level,
};

/**
 * Calculate daily operating cost for a single facility.
 * Formula varies by facility type as specified in PRD.
 */
export function calculateFacilityOperatingCost(facilityType: string, level: number): number {
  if (level === 0) return 0;
  const calculator = Object.hasOwn(FACILITY_OPERATING_COSTS, facilityType)
    ? FACILITY_OPERATING_COSTS[facilityType]
    : undefined;
  return calculator ? calculator(level) : 0;
}

// ==================== REVENUE STREAMS ====================

/**
 * Get prestige multiplier for battle winnings.
 * Smooth formula: min(1.50, 1 + prestige / 50,000)
 * Cap: +50% at 25,000+ prestige
 */
export function getPrestigeMultiplier(prestige: number): number {
  return Math.min(1.50, 1 + prestige / 50000);
}

/**
 * Calculate battle winnings with prestige bonus.
 */
export function calculateBattleWinnings(baseReward: number, prestige: number): number {
  const multiplier = getPrestigeMultiplier(prestige);
  return Math.round(baseReward * multiplier);
}

/**
 * Get prestige progress information for UI display.
 * Returns null if already at max (50% bonus at 25,000+ prestige).
 */
export function getNextPrestigeTier(currentPrestige: number): { threshold: number; bonus: string } | null {
  if (currentPrestige >= 25000) return null; // Cap reached
  return { threshold: 25000, bonus: '+50% (max)' };
}

/**
 * Get merchandising base rate by Merchandising Hub level.
 */
export function getMerchandisingBaseRate(merchandisingHubLevel: number): number {
  const rates: Record<number, number> = {
    1: 5000,
    2: 10000,
    3: 15000,
    4: 20000,
    5: 25000,
    6: 30000,
    7: 35000,
    8: 40000,
    9: 45000,
    10: 50000,
  };
  return rates[merchandisingHubLevel] || 0;
}

/**
 * Calculate daily merchandising income.
 * Formula: base_rate × (1 + prestige/10000)
 */
export function calculateMerchandisingIncome(merchandisingHubLevel: number, prestige: number): number {
  if (merchandisingHubLevel === 0) return 0;

  const baseRate = getMerchandisingBaseRate(merchandisingHubLevel);
  const prestigeMultiplier = 1 + (prestige / 10000);

  return Math.round(baseRate * prestigeMultiplier);
}

/**
 * Calculate financial health status based on balance and net income.
 */
export function calculateFinancialHealth(
  balance: number,
  netIncome: number,
): 'excellent' | 'good' | 'stable' | 'warning' | 'critical' {
  if (balance < 50000) return 'critical';
  if (balance < 100000) return 'warning';

  if (netIncome < 0) {
    if (balance < 500000) return 'warning';
    return 'stable';
  }

  if (balance >= 1000000) return 'excellent';
  if (balance >= 500000) return 'good';
  return 'stable';
}

// ==================== LEAGUE REWARDS ====================

/**
 * Get the base win reward for a league tier.
 * Participation reward is derived as 20% of this value.
 */
export function getLeagueWinReward(league: string): number {
  const rewards: Record<string, number> = {
    bronze: 7500,
    silver: 15000,
    gold: 30000,
    platinum: 60000,
    diamond: 115000,
    champion: 225000,
  };

  return rewards[league.toLowerCase()] || rewards.bronze;
}

/**
 * Calculate participation reward (20% of league win reward).
 */
export function getParticipationReward(league: string): number {
  return Math.round(getLeagueWinReward(league) * 0.2);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get human-readable facility name from type.
 */
export function getFacilityName(type: string): string {
  const names: Record<string, string> = {
    repair_bay: 'Repair Bay',
    training_facility: 'Training Facility',
    weapons_workshop: 'Weapons Workshop',
    roster_expansion: 'Roster Expansion',
    storage_facility: 'Storage Facility',
    booking_office: 'Booking Office',
    combat_training_academy: 'Combat Training Academy',
    defense_training_academy: 'Defense Training Academy',
    mobility_training_academy: 'Mobility Training Academy',
    ai_training_academy: 'AI Training Academy',
    merchandising_hub: 'Merchandising Hub',
    streaming_studio: 'Streaming Studio',
    tuning_bay: 'Tuning Bay',
  };
  return names[type] || type;
}
