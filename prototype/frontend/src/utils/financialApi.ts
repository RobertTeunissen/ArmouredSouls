/**
 * Financial API utilities
 * Provides functions to interact with the economy/financial endpoints
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Get authentication headers with token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

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
  const response = await axios.get(
    `${API_BASE_URL}/finances/summary`,
    getAuthHeaders()
  );
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
}

export const getDailyFinancialReport = async (
  battleWinnings: number = 0
): Promise<FinancialReport> => {
  const response = await axios.get(
    `${API_BASE_URL}/finances/daily?battleWinnings=${battleWinnings}`,
    getAuthHeaders()
  );
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
  const response = await axios.get(
    `${API_BASE_URL}/finances/operating-costs`,
    getAuthHeaders()
  );
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
  const response = await axios.get(
    `${API_BASE_URL}/finances/revenue-streams`,
    getAuthHeaders()
  );
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
  const response = await axios.get(
    `${API_BASE_URL}/finances/projections`,
    getAuthHeaders()
  );
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
  const response = await axios.get(
    `${API_BASE_URL}/finances/per-robot`,
    getAuthHeaders()
  );
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
  const response = await axios.post(
    `${API_BASE_URL}/finances/roi-calculator`,
    { facilityType, targetLevel },
    getAuthHeaders()
  );
  return response.data;
};
