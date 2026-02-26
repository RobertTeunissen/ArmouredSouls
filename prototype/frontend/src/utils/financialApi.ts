/**
 * Financial API utilities
 * Provides functions to interact with the economy/financial endpoints
 */

import apiClient from './apiClient';

/**
 * Financial Summary for Dashboard
 */
export interface FinancialSummary {
  currentBalance: number;
  prestige: number;
  dailyOperatingCosts: number;
  dailyPassiveIncome: number;
  netPassiveIncome: number;
  prestigeMultiplier: number;
}

export const getFinancialSummary = async (): Promise<FinancialSummary> => {
  const response = await apiClient.get('/api/finances/summary');
  return response.data;
};

/**
 * Daily Financial Report
 */
export interface FinancialReport {
  revenue: {
    battleWinnings: number;
    prestigeBonus: number;
    merchandising: number;
    streaming: number;
    streamingBattleCount?: number;
    total: number;
  };
  expenses: {
    operatingCosts: number;
    operatingCostsBreakdown: Array<{
      facilityType: string;
      facilityName: string;
      cost: number;
    }>;
    repairs: number;
    total: number;
  };
  netIncome: number;
  currentBalance: number;
  financialHealth: 'excellent' | 'good' | 'stable' | 'warning' | 'critical';
  profitMargin: number;
  daysToBankruptcy: number;
  multiplierBreakdown?: {
    prestige: {
      current: number;
      multiplier: number;
      bonusPercent: number;
      nextTier: { threshold: number; bonus: string } | null;
    };
    merchandising: {
      baseRate: number;
      prestigeMultiplier: number;
      total: number;
      formula: string;
    };
    streaming: {
      baseRate: number;
      battleMultiplier: number;
      fameMultiplier: number;
      totalBattles: number;
      totalFame: number;
      total: number;
      formula: string;
    };
  };
}

export const getDailyFinancialReport = async (
  battleWinnings: number = 0
): Promise<FinancialReport> => {
  const response = await apiClient.get(`/api/finances/daily?battleWinnings=${battleWinnings}`);
  return response.data;
};

/**
 * Operating Costs Breakdown
 */
export interface OperatingCosts {
  total: number;
  breakdown: Array<{
    facilityType: string;
    facilityName: string;
    cost: number;
  }>;
}

export const getOperatingCosts = async (): Promise<OperatingCosts> => {
  const response = await apiClient.get('/api/finances/operating-costs');
  return response.data;
};

/**
 * Revenue Streams
 */
export interface RevenueStreams {
  passive: {
    merchandising: number;
    streaming: number;
    total: number;
  };
  battleMultipliers: {
    prestigeMultiplier: number;
    prestigeBonus: number;
  };
  robotCount: number;
  prestige: number;
}

export const getRevenueStreams = async (): Promise<RevenueStreams> => {
  const response = await apiClient.get('/api/finances/revenue-streams');
  return response.data;
};

/**
 * Financial Projections
 */
export interface FinancialProjections {
  current: {
    balance: number;
    dailyNet: number;
  };
  projections: {
    weekly: number;
    monthly: number;
  };
  metrics: {
    daysToBankruptcy: number;
    daysToBreakEven: number | null;
  };
  recommendations: string[];
}

export const getFinancialProjections = async (): Promise<FinancialProjections> => {
  const response = await apiClient.get('/api/finances/projections');
  return response.data;
};

/**
 * Format currency with symbol
 */
export const formatCurrency = (amount: number): string => {
  return `₡${amount.toLocaleString()}`;
};

/**
 * Get financial health color
 */
export const getHealthColor = (
  health: 'excellent' | 'good' | 'stable' | 'warning' | 'critical'
): string => {
  switch (health) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-blue-400';
    case 'stable':
      return 'text-yellow-400';
    case 'warning':
      return 'text-orange-400';
    case 'critical':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

/**
 * Get financial health icon
 */
export const getHealthIcon = (
  health: 'excellent' | 'good' | 'stable' | 'warning' | 'critical'
): string => {
  switch (health) {
    case 'excellent':
    case 'good':
      return '✅';
    case 'stable':
      return '⚠️';
    case 'warning':
    case 'critical':
      return '❌';
    default:
      return '❓';
  }
};

/**
 * Per-Robot Financial Report
 */
export interface RobotFinancialData {
  id: number;
  name: string;
  currentLeague: string;
  elo: number;
  revenue: {
    battleWinnings: number;
    merchandising: number;
    streaming: number;
    total: number;
  };
  costs: {
    repairs: number;
    allocatedFacilities: number;
    total: number;
  };
  netIncome: number;
  roi: number;
  metrics: {
    winRate: number;
    avgEarningsPerBattle: number;
    totalBattles: number;
    fameContribution: number;
    repairCostPercentage: number;
  };
  battles: Array<{
    id: number;
    isWinner: boolean;
    reward: number;
    repairCost: number;
    battleType: string;
    createdAt: string;
  }>;
}

export interface PerRobotFinancialReport {
  robots: RobotFinancialData[];
  summary: {
    totalRevenue: number;
    totalCosts: number;
    totalNetIncome: number;
    averageROI: number;
    mostProfitable: string | null;
    leastProfitable: string | null;
  };
}

export const getPerRobotFinancialReport = async (): Promise<PerRobotFinancialReport> => {
  const response = await apiClient.get('/api/finances/per-robot');
  return response.data;
};

/**
 * Facility ROI Calculator
 */
export interface FacilityROIData {
  currentLevel: number;
  targetLevel: number;
  upgradeCost: number;
  dailyCostIncrease: number;
  dailyBenefitIncrease: number;
  netDailyChange: number;
  breakevenDays: number | null;
  net30Days: number;
  net90Days: number;
  net180Days: number;
  affordable: boolean;
  recommendation: string;
  recommendationType: 'excellent' | 'good' | 'neutral' | 'poor' | 'not_affordable';
}

export const calculateFacilityROI = async (
  facilityType: string,
  targetLevel: number
): Promise<FacilityROIData> => {
  const response = await apiClient.post('/api/finances/roi-calculator', { facilityType, targetLevel });
  return response.data;
};
