/** Wire contract for `GET /api/finances/summary`. */

export interface FinancialSummary {
  currentBalance: number;
  prestige: number;
  dailyOperatingCosts: number;
  dailyPassiveIncome: number;
  netPassiveIncome: number;
  prestigeMultiplier: number;
}
